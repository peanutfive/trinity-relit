// Real inputs and normal save import; no live engine state mutation.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { createPrologueSession } from '../engine-adapter.js';
import { makeVisualSave } from '../save.js';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const out = process.env.QA_OUTPUT || '/tmp/trinity-interactions-qa';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [], receipts = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
const state = () => page.evaluate(() => JSON.parse(window.render_game_to_text()));
const tick = ms => page.evaluate(ms => window.advanceTime(ms), ms);
const shot = name => page.screenshot({ path: `${out}/${name}.png`, fullPage: true });
async function drain() {
  for (let i = 0; i < 100; i++) {
    const s = await state();
    if (s.processing) { await page.waitForTimeout(20); continue; }
    if (s.dialogue) await page.keyboard.press('f');
    else if (s.narrative.busy) await page.click('#skip-event');
    else return;
  }
  throw Error('dialogue did not finish');
}
async function fixture(commands, x, y, face = 'up') {
  const engine = createPrologueSession(); engine.moveTo(engine.state.room);
  for (const command of commands) await engine.processInput(command);
  const save = makeVisualSave(engine, { room: engine.state.room, x, y, face });
  await page.keyboard.press('Escape'); await page.getByRole('tab', { name: '探索进度' }).click();
  await page.locator('#save-file').setInputFiles({ name: 'interactions.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(save)) });
  await page.waitForFunction(room => { const s = JSON.parse(window.render_game_to_text()); return s.room === room && s.mode !== 'paused' && !s.processing; }, engine.state.room);
  await drain();
}
async function click(x, y) {
  const box = await page.locator('canvas').boundingBox();
  await page.mouse.click(box.x + x / 480 * box.width, box.y + y / 288 * box.height);
}
async function move(key, ms) { await page.keyboard.down(key); await tick(ms); await page.keyboard.up(key); }
try {
  await page.goto(process.env.DEMO_URL || 'http://127.0.0.1:8080/2d-demo/');
  await page.waitForFunction(() => window.render_game_to_text && JSON.parse(window.render_game_to_text()).sprites === 'loaded');
  await page.click('#start'); await drain();
  // Hold only automatic RAF to reproduce a click/movement conflict on its exact frame.
  await page.evaluate(() => { const raf = requestAnimationFrame.bind(window); let next; window.requestAnimationFrame = callback => { next = callback; return 0; }; window.__resumeFrames = () => { window.requestAnimationFrame = raf; if (next) raf(next); }; });
  await page.waitForTimeout(60);
  await fixture([], 183, 244);
  const empty = await state(); await page.keyboard.press('f');
  let s = await state(); assert.equal(s.lastCommand, empty.lastCommand); assert.equal(s.dialogue, null); assert.equal(s.turns, empty.turns);
  receipts.push('invisible self and empty F do not trigger a command or dialogue');
  await fixture(['e'], 290, 160, 'down');
  const facing = await state(); await page.keyboard.press('f');
  assert.equal((await state()).lastCommand, facing.lastCommand, 'F must not inspect the ball behind the player');
  await move('ArrowUp', 90); await page.keyboard.press('f');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).lastCommand === 'examine ball' && !JSON.parse(window.render_game_to_text()).processing);
  await shot('facing-ball-inspection'); await drain(); await page.keyboard.press('f');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).inventory.includes('ball')); await drain();
  receipts.push('face the ball, F observes, repeated F collects');
  await fixture(['e'], 290, 160);
  const bare = await state(); await click(324, 139); await tick(1600);
  s = await state(); assert.equal(s.lastCommand, bare.lastCommand); assert.equal(s.dialogue, null); assert.ok(!s.inventory.includes('ball'));
  await shot('click-ground-beside-ball');
  receipts.push('clicking bare ground beside a small sprite does not inspect it');
  await fixture(['e'], 240, 240);
  await click(307, 134); assert.equal((await state()).navigation.target, 'item:ball');
  await move('ArrowLeft', 120); s = await state(); assert.equal(s.navigation.target, null); assert.equal(s.navigation.path.length, 0);
  await tick(1600); assert.equal((await state()).dialogue, null);
  receipts.push('manual movement cancels a pending automatic interaction');
  await fixture(['e'], 275, 160);
  const interrupted = await state(); await click(307, 134); await tick(30);
  s = await state(); assert.equal(s.navigation.target, 'item:ball');
  // Text state rounds world coordinates to integers; allow that rounding in
  // this setup check. The following input still exercises the exact race.
  assert.ok(Math.hypot(s.player.x - 307, s.player.y - 139) < 36.2, 'old target has entered automatic interaction reach');
  await move('ArrowLeft', 30); s = await state();
  assert.equal(s.lastCommand, interrupted.lastCommand); assert.equal(s.dialogue, null); assert.equal(s.navigation.target, null);
  receipts.push('movement wins on the very frame a queued object enters reach');
  await click(307, 134); assert.equal((await state()).navigation.target, 'item:ball');
  await click(240, 230); assert.equal((await state()).navigation.target, null); await tick(1800); assert.equal((await state()).dialogue, null);
  receipts.push('a new ground click replaces the previous object request');
  await click(307, 134); await tick(1800);
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).lastCommand === 'examine ball' && !JSON.parse(window.render_game_to_text()).processing);
  s = await state(); assert.ok(Math.hypot(s.player.x - 307, s.player.y - 139) < 37); assert.ok(!s.inventory.includes('ball'));
  await shot('click-walks-to-ball'); await drain();
  receipts.push('clicking actual sprite walks around flowerbeds, then observes within reach');
  await fixture(['n', 'ne'], 320, 100);
  const boyProps=(await state()).objects, dish=boyProps.find(o=>o.kind==='dish'), headphones=boyProps.find(o=>o.kind==='headphones');
  await click(dish.x, dish.y-1.5); await tick(1000);
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).lastCommand === 'examine dish'); await drain();
  await click(headphones.x, headphones.y); await tick(1000);
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).lastCommand === 'examine headphones');
  await shot('boy-detail-targets'); await drain();
  receipts.push('dish and headphones can be selected instead of their overlapping owner');
  await fixture(['n', 'ne', 'e', 'wait'], 260, 190);
  await click(338, 114); await tick(2000);
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).lastCommand === 'examine umbrella');
  await shot('tree-umbrella-canopy-target'); await drain();
  receipts.push('the open tree umbrella can be selected at the outer canopy');
  await fixture(['n', 'e'], 270, 210);
  await click(300, 172.5); await tick(1800);
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).lastCommand === 'examine boats'); await drain();
  await page.keyboard.press('f');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).inventory.includes('paper_bird'));
  await shot('paper-craft-bank-pickup'); await drain();
  receipts.push('the small boat can be observed and the same paper craft taken from the bank');
  // Return to a normal live loop, then check touch tolerance in a narrow viewport.
  await page.evaluate(() => window.__resumeFrames());
  await page.setViewportSize({ width: 390, height: 844 });
  await fixture(['e'], 290, 160);
  const box = await page.locator('canvas').boundingBox();
  const touch = await page.context().newCDPSession(page);
  await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x + 319 / 480 * box.width, y: box.y + 134 / 288 * box.height }] });
  await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).lastCommand === 'examine ball');
  await shot('touch-ball-tolerance'); receipts.push('touch has limited small-object tolerance in a narrow viewport');
  assert.deepEqual(errors, []); await writeFile(`${out}/result.json`, JSON.stringify({ pass: true, receipts, errors }, null, 2));
  console.log(`PASS ${receipts.length} real interaction scenarios; no page/resource errors.`);
} catch (error) {
  await shot('failure').catch(() => {}); await writeFile(`${out}/failure.json`, JSON.stringify({ error: error.message, state: await state().catch(() => null), errors }, null, 2)); throw error;
} finally { await browser.close(); }
