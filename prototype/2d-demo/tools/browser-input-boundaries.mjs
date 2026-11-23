// Playwright sends repeat=true for a second down() on a key that is still held.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const url = process.env.DEMO_URL || 'http://127.0.0.1:8080/2d-demo/';
const output = process.env.QA_OUTPUT || join(tmpdir(), 'trinity-2d-input-boundaries');
const state = page => page.evaluate(() => JSON.parse(window.render_game_to_text()));
const tick = (page, ms) => page.evaluate(ms => window.advanceTime(ms), ms);

async function position(page) {
  const { room, player, turns } = await state(page);
  return { room, x: player.x, y: player.y, turns };
}

async function drainDialogue(page) {
  for (let i = 0; i < 20; i++) {
    await page.waitForFunction(() => !JSON.parse(window.render_game_to_text()).processing);
    if ((await state(page)).mode !== 'dialogue') return;
    await page.keyboard.press('f');
  }
  throw new Error('对话未能关闭');
}

async function expectHeldKeyToStayStopped(page, key) {
  const before = await position(page);
  await page.keyboard.down(key);
  await tick(page, 180);
  const afterRepeat = await position(page);
  assert.deepEqual(afterRepeat, before, `${key} 自动重复使角色恢复走动`);

  const repeat = await page.evaluate(() => window.qaLastKeydown);
  assert.equal(repeat.key, key);
  assert.equal(repeat.repeat, true);
  if (key === 'ArrowUp') assert.equal(repeat.prevented, true);

  await page.keyboard.up(key);
  await page.keyboard.down(key);
  await tick(page, 120);
  const after = await position(page);
  assert.equal(after.room, before.room);
  assert.ok(after.y < before.y, `${key} 松开再按应让角色向上行走（${before.y} → ${after.y}）`);
  await page.keyboard.up(key);
  return { before, afterRepeat, afterFreshPress: after };
}

async function scenario(browser, name, test) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.setDefaultTimeout(7000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text());
  });
  try {
    await page.goto(url);
    await page.waitForFunction(() => typeof window.render_game_to_text === 'function'
      && JSON.parse(window.render_game_to_text()).art === 'loaded');
    await page.locator('#start').click();
    await drainDialogue(page);
    assert.equal((await state(page)).mode, 'exploring');
    await page.evaluate(() => {
      window.addEventListener('keydown', event => {
        window.qaLastKeydown = { key: event.key, repeat: event.repeat, prevented: event.defaultPrevented };
      });
    });
    const result = await test(page);
    await page.screenshot({ path: join(output, `${name}.png`) });
    assert.deepEqual(errors, []);
    return { scenario: name, ...result };
  } finally {
    await page.close();
  }
}

await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  const results = [
    await scenario(browser, 'map', async page => {
      const start = await position(page);
      await page.keyboard.down('ArrowUp');
      await tick(page, 100);
      const first = await position(page);
      assert.ok(first.y < start.y);
      await page.keyboard.down('ArrowUp');
      await tick(page, 100);
      assert.ok((await position(page)).y < first.y, '持续按住方向键时仍能走动');
      await page.keyboard.press('m');
      assert.equal((await state(page)).mode, 'map');
      await page.keyboard.press('m');
      assert.equal((await state(page)).mode, 'exploring');
      return expectHeldKeyToStayStopped(page, 'ArrowUp');
    }),
    await scenario(browser, 'pause-remap', async page => {
      await page.keyboard.press('Escape');
      await page.locator('[data-binding="up"]').click();
      await page.keyboard.press('x');
      assert.equal((await state(page)).controls.up, 'x');
      await page.keyboard.press('Escape');
      const start = await position(page);
      await page.keyboard.down('x');
      await tick(page, 100);
      assert.ok((await position(page)).y < start.y);
      await page.keyboard.press('Escape');
      assert.equal((await state(page)).mode, 'paused');
      await page.keyboard.press('Escape');
      assert.equal((await state(page)).mode, 'exploring');
      return expectHeldKeyToStayStopped(page, 'x');
    }),
    await scenario(browser, 'dialogue-fresh-key', async page => {
      await page.keyboard.press('l');
      await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'dialogue');
      const before = await position(page);
      await page.keyboard.down('ArrowUp');
      await tick(page, 120);
      assert.deepEqual(await position(page), before);
      await drainDialogue(page);
      assert.equal((await state(page)).mode, 'exploring');
      await tick(page, 120);
      assert.deepEqual(await position(page), before);
      return expectHeldKeyToStayStopped(page, 'ArrowUp');
    }),
    await scenario(browser, 'room-transition', async page => {
      await page.keyboard.down('ArrowUp');
      await tick(page, 2800);
      await page.waitForFunction(() => {
        const { room, processing } = JSON.parse(window.render_game_to_text());
        return room === 'broad_walk' && !processing;
      });
      await drainDialogue(page);
      assert.equal((await state(page)).mode, 'exploring');
      if ((await state(page)).narrative.busy) await page.locator('#skip-event').click();
      assert.equal((await state(page)).narrative.busy, false);
      return expectHeldKeyToStayStopped(page, 'ArrowUp');
    }),
  ];
  await writeFile(join(output, 'result.json'), `${JSON.stringify(results, null, 2)}\n`);
  console.log('通过 2D 移动输入检查（地图、暂停改键、对话、方向键切房）');
} finally {
  await browser.close();
}
