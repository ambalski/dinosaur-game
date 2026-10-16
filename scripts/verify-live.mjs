import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const base = process.env.BASE_URL || 'https://ambalski.github.io/dinosaur-game/';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const files = (await readdir(new URL('../docs/', import.meta.url))).filter(name => !name.startsWith('.'));
const checks = [];
for (const file of files) {
  const local = await readFile(new URL(`../docs/${file}`, import.meta.url));
  const response = await fetch(new URL(file, base), { signal: AbortSignal.timeout(30000), cache: 'no-store' });
  if (!response.ok) throw new Error(`${file}: HTTP ${response.status}`);
  const deployed = Buffer.from(await response.arrayBuffer());
  if (hash(local) !== hash(deployed)) throw new Error(`${file}: deployed content does not match local file`);
  checks.push({ file, bytes: local.length, sha256: hash(local), status: response.status });
  console.log(`MATCH ${file} (${local.length} bytes)`);
}
await mkdir(new URL('../test-results/', import.meta.url), { recursive: true });
await writeFile(new URL('../test-results/deployment.json', import.meta.url), JSON.stringify({ url: base, checkedAt: new Date().toISOString(), totalBytes: checks.reduce((sum, item) => sum + item.bytes, 0), files: checks }, null, 2));
console.log(`Verified ${checks.length} deployed files at ${base}`);
