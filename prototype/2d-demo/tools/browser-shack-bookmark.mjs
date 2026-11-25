// Use a normal island-to-shack checkpoint, or continue from the tested book acquisition.
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { pointerCenter } from './browser-islet-route.mjs';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const url = process.env.DEMO_URL || 'http://127.0.0.1:8080/2d-demo/';
const output = process.env.QA_OUTPUT || join(tmpdir(), 'trinity-shack-bookmark');
const upstream = join(output, 'normal-island-route');
const checkpoint = process.env.PLAYED_SHACK_BOOK_SAVE || process.env.PLAYED_SHACK_SAVE
  || join(upstream, 'shack-shut-played.json');
await mkdir(output, { recursive: true });
if (!process.env.PLAYED_SHACK_SAVE && !process.env.PLAYED_SHACK_BOOK_SAVE) {
  const script = fileURLToPath(new URL('./browser-islet.mjs', import.meta.url));
  await promisify(execFile)(process.execPath, [script], {
    env: { ...process.env, DEMO_URL: url, QA_OUTPUT: upstream },
  });
}
const groundCheckpoint = process.env.PLAYED_SHACK_SAVE || (!process.env.PLAYED_SHACK_BOOK_SAVE ? checkpoint : null);
const start = JSON.parse(await readFile(checkpoint, 'utf8')).engine.state;
assert.equal(start.room, 'shack');
assert.ok(start.flags.includes('river_ferry_crossed'));

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, hasTouch: true });
const errors = [];
const receipts = [];
page.setDefaultTimeout(8000);
page.on('pageerror', error => errors.push(error.message));
page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
page.on('response', response => {
  if (response.status() >= 400) errors.push(response.status() + ' ' + response.url());
});

const state = () => page.evaluate(() => JSON.parse(window.render_game_to_text()));
const tick = ms => page.evaluate(ms => window.advanceTime(ms), ms);
const shot = name => page.screenshot({ path: join(output, name + '.png') });
const feet = s => [s.player.x, s.player.y, s.player.facing];

async function until(check, label) {
  for (let step = 0; step < 165; step++) {
    const current = await state();
    if (check(current)) return current;
    await tick(75);
  }
  const current = await state();
  throw Error(`${label}: ${current.room} · ${current.lastCommand} · ${feet(current)}`);
}

async function drain() {
  for (let pageIndex = 0; pageIndex < 60; pageIndex++) {
    const current = await until(s => !s.processing, '动作未结算');
    if (current.mode === 'dialogue') await page.keyboard.press('f');
    else if (current.narrative.busy) await tick(100);
    else return current;
  }
  throw Error('文字或过场未结束');
}

async function pointAt([x, y], touch = false) {
  const box = await page.locator('canvas').boundingBox();
  assert.ok(box);
  const point = [box.x + x * box.width / 480, box.y + y * box.height / 288];
  if (touch) await page.touchscreen.tap(...point);
  else await page.mouse.click(...point);
}

async function action(command, input, label, points = 0) {
  const before = await state();
  await input();
  const after = await until(s => !s.processing && s.turns > before.turns, `未完成 ${command}`);
  assert.equal(after.lastCommand, command);
  assert.equal(after.turns, before.turns + 1);
  assert.equal(after.score, before.score + points);
  receipts.push({ command, input: label, from: before.room, to: after.room, turn: after.turns, score: after.score });
  return after;
}

async function hold(label, id) {
  await page.keyboard.press('i');
  await page.getByRole('button', { name: label, exact: true }).click();
  assert.equal((await state()).heldItem, id);
}

async function passage(direction, destination) {
  const before = await drain();
  const object = before.objects.find(item => item.id === `${before.room}:passage:${direction}`);
  assert.ok(object, direction);
  const current = await action(direction, () => pointAt(pointerCenter(object)), 'mouse-passage');
  assert.equal(current.room, destination);
  assert.equal(current.navigation.arrival?.fromRoom, before.room);
  return drain();
}

async function saveAndReload(label) {
  const before = await drain();
  await page.keyboard.press('Escape');
  await page.getByRole('tab', { name: '探索进度' }).click();
  await page.locator('#save-now').click();
  const download = page.waitForEvent('download');
  await page.locator('#export-save').click();
  const file = join(output, label + '.json');
  await (await download).saveAs(file);

  await page.reload();
  await page.locator('#continue-save').click();
  await until(s => s.room === before.room && !s.processing && s.art === 'loaded', '未恢复进度');
  const now = await drain();
  for (const key of ['room', 'inventory', 'turns', 'score', 'flags']) assert.deepEqual(now[key], before[key], key);
  assert.deepEqual(feet(now), feet(before));
  receipts.push({ reload: label, room: now.room, turn: now.turns, score: now.score });

  return JSON.parse(await readFile(file, 'utf8')).engine.state;
}

async function importPlayedSave(file) {
  await drain();
  await page.keyboard.press('Escape');
  await page.getByRole('tab', { name: '探索进度' }).click();
  await page.locator('#save-file').setInputFiles(file);
  await until(s => s.room === 'shack' && !s.processing && s.mode !== 'paused', '正式棚屋进度无法导入');
  return drain();
}

async function importAndGetBook() {
  await page.goto(url);
  await page.waitForFunction(() => window.render_game_to_text && JSON.parse(window.render_game_to_text()).art === 'loaded');
  await page.locator('#start').click();
  const current = await importPlayedSave(checkpoint);
  if (!current.inventory.includes('paperback')) {
    const book = current.objects.find(item => item.id === 'shack:paperback');
    assert.ok(book, '棚屋的原位平装书可触及');
    await page.setViewportSize({ width: 844, height: 390 });
    const tapBook = () => pointAt(pointerCenter(book), true);
    const cover = await action('examine book', tapBook, 'touch-book-cover');
    assert.match(cover.dialogue?.text, /荒岛十日谈/);
    assert.ok(!cover.inventory.includes('paperback'));
    await drain();
    await action('take book', tapBook, 'touch-book');
    await drain();
    await page.setViewportSize({ width: 1440, height: 900 });
  }
  const carrying = await state();
  assert.deepEqual(carrying.inventory.filter(id => id === 'paperback'), ['paperback']);
  assert.ok(!carrying.objects.some(object => object.itemId === 'paperback'));
}

const has = (s, id) => s.inventory.filter(item => item === id).length;
const objects = (s, id) => s.objects.filter(item => item.itemId === id);
const bookmarkFloor = s => {
  const [card] = objects(s, 'slip');
  assert.equal(objects(s, 'slip').length, 1, '应有唯一硬纸书签');
  assert.equal(has(s, 'slip'), 0);
  return card;
};
const flipBook = command => action(command, async () => {
  await page.keyboard.press('i');
  await page.locator('#inventory-book-cover').click();
}, 'inventory-cover');

async function touchBookmark(points) {
  const before = await drain();
  const card = bookmarkFloor(before);
  const location = card.pointerShape ? pointerCenter(card) : [card.x, card.y - 3];
  await page.setViewportSize({ width: 844, height: 390 });
  const tap = () => pointAt(location, true);
  if (!before.observed.includes(card.id)) {
    const examined = await action('examine slip', tap, 'touch-card-face');
    assert.match(examined.dialogue?.text, /诗|书签|打着/);
    await drain();
  }
  const took = await action('take slip', tap, 'touch-card-pickup', points);
  assert.equal(has(took, 'slip'), 1);
  assert.deepEqual(objects(took, 'slip'), []);
  await drain();
  await page.setViewportSize({ width: 1440, height: 900 });
}

async function walkTo(point) {
  const before = await drain();
  await pointAt(point);
  const after = await until(s => !s.processing && !s.navigation.path.length, '未走到地面脚点');
  assert.equal(after.room, before.room);
  assert.equal(after.turns, before.turns);
  assert.ok(Math.hypot(after.player.x - point[0], after.player.y - point[1]) < 7);
}

async function pickupNearbyBookmark() {
  const card = bookmarkFloor(await state());
  // A loose card falls near the player's feet on open. Face it without clicking
  // its hit area so the second collection is exercised through F.
  let current = await state();
  for (let step = 0; step < 6 && current.nearby !== card.label; step++) {
    const dx = card.x - current.player.x, dy = card.y - current.player.y;
    const key = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'd' : 'a') : (dy > 0 ? 's' : 'w');
    await page.keyboard.down(key);
    try { await tick(20); }
    finally { await page.keyboard.up(key); }
    current = await state();
  }
  assert.equal(current.nearby, card.label);
  const pressF = () => page.keyboard.press('f');
  if (!(await state()).observed.includes(card.id)) {
    await action('examine slip', pressF, 'F-examine');
    await drain();
  }
  const took = await action('take slip', pressF, 'F-pickup');
  assert.equal(has(took, 'slip'), 1);
  assert.deepEqual(objects(took, 'slip'), []);
  await drain();
}

async function checkCarryAndReload() {
  const initial = await drain();
  assert.equal(has(initial, 'paperback'), 1);
  assert.equal(has(initial, 'slip'), 0);
  assert.deepEqual(objects(initial, 'slip'), []);
  const originalScore = initial.score;
  const initialSave = await saveAndReload('book-held-before-reading');
  assert.ok(!initialSave.flags.includes('paperback_open'));
  await hold('平装书', 'paperback');
  const read = await action('read book', () => page.locator('#held-item').click(), 'hand-book');
  assert.match(read.dialogue?.text, /硬纸片|书页/);
  await shot('first-opening-text');
  const before = bookmarkFloor(await drain());
  await tick(900);
  await shot('book-open-card-on-floor');
  const ground = await saveAndReload('card-floor-restored');
  assert.equal(ground.itemLoc.slip, 'shack');
  assert.deepEqual(bookmarkFloor(await state()).pointerShape, before.pointerShape);
  await touchBookmark(1);
  const picked = await saveAndReload('card-picked-restored');
  assert.equal(picked.itemLoc.slip, 'inventory');

  await hold('硬纸书签', 'slip');
  const pen = await action('put slip in book', async () => {
    await page.keyboard.press('i');
    await page.locator('#inventory-bookmark').click();
  }, 'inventory-bookmark');
  assert.equal(has(pen, 'slip'), 0);
  assert.deepEqual(objects(pen, 'slip'), []);
  await drain();
  await hold('平装书', 'paperback');
  await flipBook('close book');
  const shut = await saveAndReload('book-closed-with-card');
  assert.equal(shut.itemLoc.paperback, 'inventory');
  assert.equal(shut.itemLoc.slip, 'paperback');
  assert.ok(!shut.flags.includes('paperback_open'));

  for (const [direction, destination] of [
    ['w', 'tower_platform'], ['d', 'tower_landing'], ['d', 'base_of_tower'],
  ]) {
    const after = await passage(direction, destination);
    assert.equal(has(after, 'paperback'), 1);
    assert.deepEqual(objects(after, 'slip'), []);
  }
  const tower = await saveAndReload('book-with-card-at-tower-foot');
  assert.equal(tower.itemLoc.slip, 'paperback');
  await hold('平装书', 'paperback');
  const reopened = await flipBook('open book');
  assert.match(reopened.dialogue?.text, /硬纸片|书页/);
  bookmarkFloor(await drain());
  assert.equal((await state()).room, 'base_of_tower');
  await tick(900);
  await shot('book-reopened-card-at-tower-foot');
  await pickupNearbyBookmark();
  assert.equal((await state()).score, originalScore + 1);
  for (const [direction, destination] of [
    ['u', 'tower_landing'], ['u', 'tower_platform'], ['e', 'shack'],
  ]) {
    const after = await passage(direction, destination);
    assert.equal(has(after, 'paperback'), 1);
    assert.equal(has(after, 'slip'), 1);
    assert.deepEqual(objects(after, 'slip'), []);
  }
  await walkTo([242, 220]);
  await hold('平装书', 'paperback');
  assert.match(await page.locator('#hint').textContent(), /^F\s*·\s*翻阅/);
  await action('read book', () => page.keyboard.press('f'), 'F-held-book');
  assert.deepEqual(objects(await drain(), 'slip'), []);
  const returned = await saveAndReload('return-to-shack-both-items');
  assert.equal(returned.itemLoc.slip, 'inventory');
  assert.equal(returned.itemLoc.paperback, 'inventory');
}

async function checkGroundBook() {
  const initial = await importPlayedSave(groundCheckpoint);
  assert.equal(has(initial, 'paperback'), 0);
  const [book] = objects(initial, 'paperback');
  assert.ok(book && objects(initial, 'paperback').length === 1);
  assert.deepEqual(objects(initial, 'slip'), []);
  const cover = await action('examine book', () => pointAt(pointerCenter(book), true), 'touch-ground-cover');
  assert.match(cover.dialogue?.text, /荒岛十日谈/);
  const open = page.getByRole('button', { name: '翻开书', exact: true });
  for (let i = 0; i < 12 && !await open.isVisible(); i++) {
    assert.equal((await state()).mode, 'dialogue', '看封面应提供翻开地面书的动作');
    await page.keyboard.press('f');
  }
  assert.ok(await open.isVisible());
  await shot('ground-book-can-open');
  await action('open book', () => open.click(), 'ground-book-choice');
  const revealed = await drain();
  assert.equal(has(revealed, 'paperback'), 0);
  assert.equal(objects(revealed, 'paperback').length, 1);
  const [bookX] = book.drawAt;
  const card = bookmarkFloor(revealed);
  const viewerSide = revealed.player.x - bookX;
  assert.ok(Math.abs(viewerSide) >= 22, '点书后应与书本留出展示空间');
  assert.equal(Math.sign(card.x - bookX), -Math.sign(viewerSide), '书签应落到人物对面');
  await tick(900);
  assert.deepEqual(feet(await state()), feet(revealed), '无需再移动即可看清书和书签');
  await shot('opened-book-and-bookmark-on-floor');
  receipts.push({ case: 'book-and-card-visible', foot: feet(revealed), book: book.drawAt, card: [card.x, card.y] });
  await touchBookmark(1);
  await hold('硬纸书签', 'slip');
  await action('put slip in book', () => pointAt(pointerCenter(book), true), 'touch-put-into-ground-book');
  const restored = await saveAndReload('card-placed-in-ground-book');
  assert.equal(restored.itemLoc.paperback, 'shack');
  assert.equal(restored.itemLoc.slip, 'paperback');
  assert.deepEqual(objects(await state(), 'slip'), []);
}

try {
  await importAndGetBook();
  await checkCarryAndReload();
  if (groundCheckpoint) await checkGroundBook();
  assert.deepEqual(errors, []);
  await writeFile(join(output, 'result.json'), JSON.stringify({
    pass: true, source: checkpoint, groundCheckpoint, receipts, errors,
  }, null, 2));
  console.log('通过持书翻阅、硬纸书签取放、合书过梯、重新打开及存读档');
} catch (error) {
  await shot('failure').catch(() => {});
  await writeFile(join(output, 'failure.json'), JSON.stringify({
    message: error.message, snapshot: await state().catch(() => null), receipts, errors,
  }, null, 2));
  throw error;
} finally {
  await browser.close();
}
