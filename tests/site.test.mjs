import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import { once } from 'node:events';
import { createStaticServer } from '../scripts/serve.mjs';

test('site is below 100 KB and makes no third-party runtime requests', async () => {
  let total = 0;
  const files = await readdir(new URL('../docs/', import.meta.url));
  for (const name of files) {
    const file = new URL(`../docs/${name}`, import.meta.url);
    total += (await stat(file)).size;
    const text = await readFile(file, 'utf8');
    assert.doesNotMatch(text, /(?:src|href)=["']https?:|fetch\s*\(|XMLHttpRequest|navigator\.sendBeacon|@import\s/i);
  }
  assert.ok(total < 100 * 1024, `Runtime size: ${total} bytes`);
});

test('HTML has unique IDs, viewport, Russian language and no blocking third-party assets', async () => {
  const html = await readFile(new URL('../docs/index.html', import.meta.url), 'utf8');
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
  assert.equal(ids.length, new Set(ids).size);
  assert.match(html, /<html lang="ru">/);
  assert.match(html, /name="viewport"/);
  assert.doesNotMatch(html, /user-scalable=no|maximum-scale=1/);
  assert.match(html, /type="module" src="\.\/app.mjs"/);
  for (const [, id] of html.matchAll(/aria-labelledby="([^"]+)"/g)) assert.ok(ids.includes(id), id);
  const app = await readFile(new URL('../docs/app.mjs', import.meta.url), 'utf8');
  for (const [, id] of app.matchAll(/\$\('([^']+)'\)/g)) assert.ok(ids.includes(id), id);
});

test('all production files serve under the GitHub Pages project path', async t => {
  const server = createStaticServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => { server.closeAllConnections(); server.close(); });
  const base = `http://127.0.0.1:${server.address().port}/dinosaur-game/`;
  for (const filename of ['', 'styles.css', 'app.mjs', 'engine.mjs', 'art.mjs', 'icon.svg']) {
    const response = await fetch(base + filename);
    assert.equal(response.status, 200, filename);
    if (filename.endsWith('.mjs')) assert.match(response.headers.get('content-type'), /javascript/);
    assert.ok((await response.text()).length > 50);
  }
  assert.equal((await fetch(base + 'missing')).status, 404);
  assert.equal((await fetch(base + '%2e%2e%2fpackage.json')).status, 404);
});
