import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { createStaticServer } from '../scripts/serve.mjs';
import { SAVE_KEY } from '../docs/engine.mjs';

const { chromium, webkit, devices } = process.env.PLAYWRIGHT_MODULE
  ? await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href)
  : await import('playwright');
const browserType = process.env.BROWSER === 'webkit' ? webkit : chromium;
const server = process.env.BASE_URL ? null : createStaticServer();
if (server) { server.listen(0, '127.0.0.1'); await once(server, 'listening'); }
const baseURL = process.env.BASE_URL || `http://127.0.0.1:${server.address().port}/dinosaur-game/`;
const browser = await browserType.launch({ headless: true });
let passed = 0;
const results = [];

async function check(name, run) {
  await run();
  passed++;
  results.push(name);
  console.log(`PASS ${name}`);
}
async function readState(page) { return page.evaluate(key => JSON.parse(localStorage.getItem(key)), SAVE_KEY); }
async function injectState(page, transform) {
  const state = await readState(page);
  transform(state);
  await page.evaluate(({ key, value }) => localStorage.setItem(key, value), { key: SAVE_KEY, value: JSON.stringify(state) });
  await page.reload();
  await page.locator('.answer').first().waitFor();
}
async function assertNoOverflow(page) {
  const dimensions = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
  assert.ok(dimensions.scroll <= dimensions.width + 1, `Horizontal overflow: ${JSON.stringify(dimensions)}`);
}
async function selectMode(page, mode, max = 10) {
  await page.getByRole('button', { name: 'Настройки для взрослых', exact: true }).click();
  await page.locator('#mode-setting').selectOption(mode);
  await page.locator('#range-setting').selectOption(String(max));
  await page.getByRole('button', { name: 'Сохранить и играть', exact: true }).click();
}
async function solve(page) {
  const state = await readState(page);
  await page.getByRole('button', { name: `Ответ ${state.question.answer}`, exact: true }).click();
  await page.locator('#next-button').waitFor();
  return state;
}

try {
  const context = await browser.newContext({ ...devices['iPhone 13'], reducedMotion: 'reduce' });
  const page = await context.newPage();
  const errors = [];
  const requests = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => requests.push(request.url()));
  page.on('response', response => { if (response.status() >= 400) errors.push(`HTTP ${response.status()} ${response.url()}`); });
  await page.goto(baseURL, { waitUntil: 'networkidle' });

  await check('opens directly into a playable Russian counting task on iPhone viewport', async () => {
    assert.equal(await page.locator('html').getAttribute('lang'), 'ru');
    assert.equal(await page.locator('.answer').count(), 4);
    assert.equal((await readState(page)).question.type, 'count');
    await assertNoOverflow(page);
    const boxes = await page.locator('.answer').evaluateAll(nodes => nodes.map(n => { const r = n.getBoundingClientRect(); return { width: r.width, height: r.height }; }));
    assert.ok(boxes.every(r => r.width >= 44 && r.height >= 44));
  });

  await check('touch counting never counts a leaf twice', async () => {
    const token = page.locator('.leaf-token').first();
    await token.tap();
    await token.tap();
    assert.equal(await token.locator('.token-number').textContent(), '1');
    assert.match(await page.locator('#tap-hint').textContent(), /Посчитали: 1/);
  });

  await check('wrong answer keeps the task, offers help and grants no reward', async () => {
    const state = await readState(page);
    const wrong = state.question.choices.find(n => n !== state.question.answer);
    await page.getByRole('button', { name: `Ответ ${wrong}`, exact: true }).tap();
    assert.equal((await readState(page)).total, 0);
    assert.equal((await readState(page)).question.answer, state.question.answer);
    assert.match(await page.locator('#feedback').textContent(), /Давай проверим/);
    await page.locator('#help-button').tap();
    assert.equal(await page.locator('.token-number').count(), state.question.answer);
  });

  await check('correct answer hatches one dinosaur and reload cannot duplicate it', async () => {
    const state = await readState(page);
    await page.locator(`[data-answer="${state.question.answer}"]`).evaluate(button => { button.click(); button.click(); });
    assert.equal((await readState(page)).total, 1);
    assert.equal(await page.locator('#nest.hatched').count(), 1);
    assert.match(await page.locator('#solution').textContent(), new RegExp(String(state.question.answer)));
    await page.reload({ waitUntil: 'networkidle' });
    assert.equal((await readState(page)).total, 1);
    assert.equal(await page.locator('#next-button').isVisible(), true);
    await page.locator('#next-button').tap();
  });

  await check('addition has two groups and counts their combined quantity', async () => {
    const state = await readState(page);
    assert.equal(state.question.type, 'add');
    assert.equal(await page.locator('.object-group').count(), 2);
    assert.equal(await page.locator('.leaf-token:not(.removed)').count(), state.question.answer);
    await solve(page);
    assert.match(await page.locator('#solution').textContent(), /Добавили/);
    await page.locator('#next-button').tap();
  });

  await check('subtraction keeps removed leaves visible and prevents counting them', async () => {
    const state = await readState(page);
    assert.equal(state.question.type, 'subtract');
    assert.equal(await page.locator('.leaf-token.removed').count(), state.question.b);
    assert.equal(await page.locator('.leaf-token.removed:disabled').count(), state.question.b);
    assert.equal(await page.locator('.leaf-token:not(.removed)').count(), state.question.answer);
    await solve(page);
    await page.locator('#next-button').tap();
  });

  await check('five answers finish a round with an explicit rest point', async () => {
    for (let i = 0; i < 2; i++) { await solve(page); await page.locator('#next-button').tap(); }
    assert.equal((await readState(page)).total, 5);
    assert.equal(await page.locator('#complete-screen').isVisible(), true);
    await page.locator('#complete-garden').tap();
    assert.equal(await page.locator('#garden-dialog').isVisible(), true);
    assert.equal(await page.locator('.dino-card:not(.locked)').count(), 5);
    await page.getByRole('button', { name: 'Вернуться к игре', exact: true }).tap();
    await page.locator('#play-again').tap();
    assert.equal((await readState(page)).total, 5);
    assert.equal((await readState(page)).round, 0);
  });

  await check('settings preserve collection and apply the chosen skill and range', async () => {
    await selectMode(page, 'subtract', 5);
    const state = await readState(page);
    assert.equal(state.total, 5);
    assert.equal(state.question.type, 'subtract');
    assert.ok(state.question.a <= 5);
  });

  await check('zero is taught explicitly when all leaves are removed', async () => {
    await injectState(page, state => {
      state.question = { type: 'subtract', a: 3, b: 3, answer: 0, max: 5, choices: [0, 1, 2, 3] };
      state.phase = 'question'; state.attempts = 0;
    });
    await page.locator('#help-button').tap();
    assert.match(await page.locator('#feedback').textContent(), /ничего не осталось|Ничего не осталось/);
    await solve(page);
    assert.match(await page.locator('#solution').textContent(), /Это ноль/);
    assert.equal((await readState(page)).total, 6);
  });

  await check('layouts fit 320, 375, 390, 430, 768 and 1280 pixel widths, including large additions', async () => {
    await selectMode(page, 'add', 10);
    for (const [a, b] of [[5, 5], [9, 1]]) {
      await injectState(page, state => {
        state.question = { type: 'add', a, b, answer: 10, max: 10, choices: [7, 8, 9, 10] };
        state.phase = 'question'; state.attempts = 0;
      });
      for (const width of [320, 375, 390, 430, 768, 1280]) {
        await page.setViewportSize({ width, height: width > 700 ? 900 : 844 });
        await assertNoOverflow(page);
        const clipped = await page.locator('.leaf-token, .answer').evaluateAll(nodes => nodes.some(n => { const r = n.getBoundingClientRect(); return r.left < 0 || r.right > innerWidth; }));
        assert.equal(clipped, false, `Clipped buttons at ${width}`);
      }
    }
  });

  await check('keyboard opens and dismisses accessible dialogs and reduced motion disables hatch animation', async () => {
    await page.locator('#open-garden').focus();
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('#garden-dialog').isVisible(), true);
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#garden-dialog').isVisible(), false);
    assert.equal(await page.evaluate(() => document.activeElement.id), 'open-garden');
    await solve(page);
    assert.equal(await page.locator('#nest-art').evaluate(n => getComputedStyle(n).animationName), 'none');
  });

  await check('loaded game remains playable when network becomes unavailable', async () => {
    await context.setOffline(true);
    await page.locator('#next-button').click();
    const total = (await readState(page)).total;
    await solve(page);
    assert.equal((await readState(page)).total, total + 1);
    await context.setOffline(false);
  });

  await check('no browser exceptions, missing assets or external asset requests', async () => {
    assert.deepEqual(errors, []);
    const origin = new URL(baseURL).origin;
    assert.ok(requests.every(url => new URL(url).origin === origin));
  });
  await context.close();

  await check('blocked storage still allows play with an honest persistence notice', async () => {
    const isolated = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await isolated.addInitScript(() => {
      Storage.prototype.getItem = () => { throw new Error('Storage blocked'); };
      Storage.prototype.setItem = () => { throw new Error('Storage blocked'); };
    });
    const tab = await isolated.newPage();
    await tab.goto(baseURL);
    await tab.locator('.answer').first().waitFor();
    assert.equal(await tab.locator('#storage-notice').isVisible(), true);
    const answer = await tab.locator('.leaf-token').count();
    await tab.locator(`[data-answer="${answer}"]`).click();
    assert.equal(await tab.locator('#next-button').isVisible(), true);
    await isolated.close();
  });

  await check('malformed storage recovers to a playable fresh game', async () => {
    const isolated = await browser.newContext();
    await isolated.addInitScript(key => { localStorage.setItem(key, '{broken'); }, SAVE_KEY);
    const tab = await isolated.newPage();
    await tab.goto(baseURL);
    await tab.locator('.answer').first().waitFor();
    assert.equal((await readState(tab)).total, 0);
    await isolated.close();
  });

  const report = { browser: browserType.name(), url: baseURL, passed, tests: results, checkedAt: new Date().toISOString() };
  await mkdir(new URL('../test-results/', import.meta.url), { recursive: true });
  await writeFile(new URL(`../test-results/${process.env.BASE_URL ? 'production-' : ''}${browserType.name()}.json`, import.meta.url), JSON.stringify(report, null, 2));
  console.log(`${passed} browser checks passed (${browserType.name()}).`);
} finally {
  await browser.close();
  if (server) { server.closeAllConnections(); server.close(); }
}
