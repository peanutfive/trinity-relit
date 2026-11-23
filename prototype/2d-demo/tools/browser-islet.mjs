// Real keyboard and canvas inputs. Only the separately labelled payment case seeds an item.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createPrologueSession } from '../engine-adapter.js';
import { makeVisualSave } from '../save.js';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const url = new URL(process.env.DEMO_URL || 'http://127.0.0.1:8080/2d-demo/');
const roadsOnly = new URL(url);
roadsOnly.searchParams.set('reviewRoutes', '1');
const output = process.env.QA_OUTPUT || join(tmpdir(), 'trinity-t27-browser');
const receipts = [];
const errors = [];

const startRoute = [
  'e', 'take ball', 'nw', 'unscrew gnomon', 'take gnomon',
  'n', 'take paper bird', 'open paper bird', 'w', 'buy crumbs', 'feed birds',
  'take ruby', 'n', 'push pram', 'push pram', 'wait', 'throw ball at tree',
  'take umbrella', 'push pram', 'open pram', 'enter pram', 'open umbrella',
  'take paper bird', 'take gnomon', 'enter water', 'enter door', 'e', 'u',
];

async function riverSave({ open, seedCoin = false }) {
  const engine = createPrologueSession();
  engine.moveTo(engine.state.room);
  for (const command of startRoute) await engine.processInput(command);
  assert.equal(engine.state.room, 'vertex');
  if (open) {
    for (let i = 0; i < 7 && engine.state.sundialSymbol !== 6; i++) await engine.processInput('turn ring');
  }
  assert.equal(engine.state.sundialSymbol === 6, open);
  for (const command of ['d', 'se']) await engine.processInput(command);
  assert.equal(engine.state.room, 'the_river');
  assert.equal(engine.state.dead, false);
  assert.equal(engine.state.has('silver_coin'), false);
  if (seedCoin) engine.state.placeItem('silver_coin', 'inventory');
  return makeVisualSave(engine, { room: 'the_river', x: 285, y: 165, face: 'right' });
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, hasTouch: true });
page.setDefaultTimeout(8000);
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
await mkdir(output, { recursive: true });

const state = () => page.evaluate(() => JSON.parse(window.render_game_to_text()));
const tick = ms => page.evaluate(ms => window.advanceTime(ms), ms);
const shot = name => page.screenshot({ path: join(output, `${name}.png`) });
const gameState = ({ room, chapter, turns, inventory, flags, sundialSymbol }) =>
  ({ room, chapter, turns, inventory, flags, sundialSymbol });

async function until(predicate, description) {
  for (let i = 0; i < 140; i++) {
    const current = await state();
    if (predicate(current)) return current;
    await tick(85);
  }
  const { room, player, lastCommand, navigation } = await state();
  throw Error(`${description}: ${JSON.stringify({ room, player, lastCommand, navigation })}`);
}

async function drain() {
  const pages = [];
  for (let i = 0; i < 35; i++) {
    const current = await until(s => !s.processing, '操作没有结算');
    if (current.dialogue) {
      pages.push(current.dialogue.text);
      await page.keyboard.press('f');
    }
    else if (current.narrative.busy) await tick(100);
    else return pages;
  }
  throw Error('对话或演出未结束');
}

async function importSave(save) {
  await drain();
  await page.keyboard.press('Escape');
  await page.getByRole('tab', { name: '探索进度' }).click();
  await page.locator('#save-file').setInputFiles({
    name: 'river.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(save)),
  });
  assert.equal((await until(s => !s.processing && s.mode !== 'paused', '存档未恢复')).room, 'the_river');
  await drain();
  assert.equal((await state()).sundialSymbol, save.engine.state.sundialSymbol);
}

async function canvasPoint(x, y) {
  const canvas = await page.locator('canvas').boundingBox();
  assert.ok(canvas);
  return [canvas.x + x * canvas.width / 480, canvas.y + y * canvas.height / 288];
}

async function walkTo(x, y) {
  const from = (await state()).room;
  await page.mouse.click(...await canvasPoint(x, y));
  const current = await until(s => {
    assert.equal(s.room, from, '中途路点不得误切房');
    return !s.navigation.path.length && !s.processing;
  }, `未走到 ${x},${y}`);
  assert.ok(Math.hypot(current.player.x - x, current.player.y - y) <= 7,
    `${from}: ${current.player.x},${current.player.y} 未到达 ${x},${y}`);
}

async function tapDirection(key, ms) {
  await page.keyboard.down(key);
  try { await tick(ms); }
  finally { await page.keyboard.up(key); }
}

async function walkRoad(points, key, target, entrance) {
  const from = (await state()).room;
  for (const point of points) await walkTo(...point);
  await tick(600);
  await page.keyboard.down(key);
  try { await until(s => s.room !== from, `${from} 未从绘制道路抵达 ${target}`); }
  finally { await page.keyboard.up(key); }
  const arrival = (await state()).navigation.arrival;
  assert.equal((await state()).room, target);
  assert.equal(arrival?.fromRoom, from);
  assert.equal(arrival?.entrance, entrance);
  assert.equal(arrival?.matched, true);
  receipts.push({ case: 'keyboard-road', from, target, entrance, foot: [arrival.x, arrival.y] });
  await drain();
}

async function approach(kind, point, key) {
  await walkTo(...point);
  await tapDirection(key, 12);
  const current = await state();
  const object = current.objects.find(object => object.kind === kind);
  assert.ok(object, `${current.room} 缺少 ${kind}`);
  assert.equal(current.nearby, object.label);
  return object;
}

async function pressF(command, target) {
  const before = await state();
  assert.equal(before.mode, 'exploring');
  await page.keyboard.press('f');
  const current = await until(s => !s.processing && s.lastCommand === command
    && (!target || s.room === target), `F 未执行 ${command}`);
  if (target && target !== before.room) {
    receipts.push({ case: 'F-passage', from: before.room, target, command, turn: current.turns });
    await shot(`${before.room}-to-${target}`);
  }
  const pages = await drain();
  if (before.room === 'the_river' && target === 'islet') {
    assert.ok(pages.length >= 2 && pages.some(text => text.includes('脚步声')));
    assert.equal(new Set(pages).size, pages.length, '渡口抵达描述只显示一次');
    assert.ok(current.removedPresence.includes('islet-toadstool-presence'));
  }
  return current;
}

async function boardFromRiver() {
  const ferry = await approach('islet_ferry', [306, 165], 'd');
  assert.ok(ferry.actions.some(action => action.command === 'in'));
  const before = await state();
  assert.equal(before.exits.find(exit => exit.dir === 'in')?.interactionOnly, true);
  assert.equal(before.boundaries.some(exit => exit.dir === 'in'), false);
  // Clicking the old exit anchor on the beach acts as a ground click.
  await walkTo(324, 165);
  assert.deepEqual(gameState(await state()), gameState(before));
  // Walking to the water cannot take the interaction-only passage either.
  await tapDirection('d', 350);
  assert.deepEqual(gameState(await state()), gameState(before));
  await approach('islet_ferry', [306, 165], 'd');
  await pressF('examine river');
  const oneWay = !before.flags.includes('ferry_paid') && !before.inventory.includes('silver_coin');
  if (oneWay) {
    await page.locator('#hint').filter({ hasText: '单程' }).waitFor();
    await shot('river-ready-to-board');
  }
  const arrival = await pressF('in', 'islet');
  assert.equal(arrival.navigation.arrival?.fromRoom, 'the_river');
  assert.equal(arrival.navigation.arrival?.entrance, 'ferry');
  assert.equal((await state()).chapter, 'islet');
}

async function goToSandBar() {
  await walkRoad([[200, 178], [236, 119], [238, 76]], 'w', 'sand_bar', 's');
}

async function goEastFromCrater() {
  await walkRoad([[351, 154], [411, 144], [444, 129]], 'd', 'desert_6', 'w');
}

async function checkMap(chapter, rooms, connections, screenshot) {
  const before = gameState(await state());
  await page.keyboard.press('m');
  const current = await until(s => s.mode === 'map', '地图未打开');
  assert.equal(current.map.chapter, chapter);
  assert.equal(current.map.selected, current.room);
  assert.equal(current.map.nodes, rooms.length);
  const known = await page.locator('.chapter-map [data-room-id]').evaluateAll(nodes =>
    nodes.map(node => node.getAttribute('data-room-id')).sort());
  assert.deepEqual(known, [...rooms].sort());
  const painted = await page.locator('.chapter-map [data-from][data-to]').evaluateAll(edges =>
    [...new Set(edges.map(edge => [edge.getAttribute('data-from'), edge.getAttribute('data-to')].sort().join('|')))].sort());
  assert.deepEqual(painted, connections.map(pair => [...pair].sort().join('|')).sort());
  assert.deepEqual(gameState(current), before);
  await shot(screenshot);
  await page.keyboard.press('m');
  assert.equal((await state()).mode, 'exploring');
  assert.deepEqual(gameState(await state()), before);
}

try {
  await page.goto(roadsOnly.href);
  await page.waitForFunction(() => window.render_game_to_text && JSON.parse(window.render_game_to_text()).art === 'loaded');
  await page.locator('#start').click();
  await importSave(await riverSave({ open: false }));
  const closed = gameState(await state());
  await tapDirection('d', 620);
  const blocked = await state();
  assert.deepEqual(gameState(blocked), closed);
  assert.equal(blocked.objects.some(object => object.kind === 'islet_ferry'), false);
  assert.equal(blocked.exits.some(exit => exit.dir === 'in'), false);
  assert.equal(blocked.boundaries.some(exit => exit.dir === 'in'), false);
  await shot('river-closed');

  await importSave(await riverSave({ open: true }));
  await boardFromRiver();
  await goToSandBar();
  const unpaid = await state();
  assert.equal(unpaid.exits.some(exit => exit.dir === 'out'), false);
  assert.equal(unpaid.inventory.includes('silver_coin'), false);
  assert.equal(unpaid.objects.some(o => o.actions.some(action => action.command === 'give silver coin to oarsman')), false);
  await approach('islet_ferry', [245, 154], 'd');
  await pressF('look');
  const denied = await pressF('out');
  assert.equal(denied.room, 'sand_bar');
  assert.ok(denied.dialogue?.text, '无法返航时应反馈原因');
  assert.deepEqual(denied.inventory, unpaid.inventory);
  assert.equal(denied.flags.includes('ferry_paid'), false);
  receipts.push({ case: 'unpaid-return-denied', room: denied.room, turns: [unpaid.turns, denied.turns] });
  await checkMap('islet', ['islet', 'sand_bar'], [['islet', 'sand_bar']], 'islet-map');
  await walkRoad([[210, 255]], 's', 'islet', 'n');
  await approach('islet_gate', [343, 166], 'd');
  await pressF('examine toadstool');
  const crater = await pressF('enter door', 'shallow_crater');
  assert.equal(crater.navigation.arrival?.fromRoom, 'islet');
  assert.equal(crater.navigation.arrival?.entrance, 'door');
  assert.equal((await state()).chapter, 'desert');
  await shot('crater-arrival');

  // The two terrain loops use a real ground approach and then a held key.
  await walkRoad([[116, 174], [55, 155], [30, 145]], 'a', 'desert_5', 'e');
  assert.deepEqual((await state()).boundaries.map(({ dir, target }) => ({ dir, target })),
    [{ dir: 'w', target: 'desert_4' }]);
  await walkTo(80, 177);
  await walkTo(33, 184);
  const westBoundary = gameState(await state());
  await tapDirection('a', 530);
  assert.deepEqual(gameState(await state()), westBoundary);
  await shot('desert-west');
  await walkRoad([[426, 136]], 'd', 'shallow_crater', 'w');
  await goEastFromCrater();
  assert.deepEqual((await state()).boundaries.map(({ dir, target }) => ({ dir, target })),
    [{ dir: 'e', target: 'desert_7' }]);
  await walkRoad([[54, 154]], 'a', 'shallow_crater', 'e');
  const desertRooms = ['shallow_crater', 'desert_5', 'desert_6'];
  const desertRoads = [['desert_5', 'shallow_crater'], ['shallow_crater', 'desert_6']];
  await checkMap('desert', desertRooms, desertRoads, 'desert-map');
  await page.setViewportSize({ width: 844, height: 390 });
  await checkMap('desert', desertRooms, desertRoads, 'phone-desert-map');
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.setViewportSize({ width: 1440, height: 900 });

  await goEastFromCrater();
  await walkTo(427, 177);
  await page.keyboard.press('Escape');
  const saved = await state();
  await page.goto(url.href);
  await page.locator('#continue-save').click();
  await drain();
  const restored = await state();
  assert.deepEqual(gameState(restored), gameState(saved));
  assert.deepEqual([restored.player.x, restored.player.y, restored.player.facing],
    [saved.player.x, saved.player.y, saved.player.facing]);
  await tapDirection('d', 800);
  const frontier = await state();
  assert.deepEqual(gameState(frontier), gameState(restored));
  assert.equal(frontier.routeMarker?.exit, null);
  assert.match(frontier.routeMarker?.text || '', /前方场景制作中/);
  await shot('desert-boundary-restored');
  receipts.push({ case: 'main-route', fixture: '现有引擎指令到达的河岸存档', boundary: frontier.boundaries });

  // Silver coin has no acquisition path in the current project data.
  await importSave(await riverSave({ open: true, seedCoin: true }));
  await boardFromRiver();
  await goToSandBar();
  await approach('islet_ferry', [245, 154], 'd');
  await page.keyboard.press('i');
  await page.getByRole('button', { name: '银币', exact: true }).click();
  const beforePayment = await state();
  const payment = await pressF('give silver coin to oarsman');
  assert.equal(payment.turns, beforePayment.turns + 1);
  assert.equal(payment.flags.includes('ferry_paid'), true);
  assert.equal(payment.inventory.includes('silver_coin'), false);
  assert.equal(payment.heldItem, null);
  const paid = await state();
  assert.equal(paid.exits.find(exit => exit.dir === 'out')?.target, 'the_river');
  assert.equal(paid.objects.some(o => o.actions.some(action => action.command === 'give silver coin to oarsman')), false);
  await shot('paid-ferry');
  await pressF('out', 'the_river');
  assert.equal((await state()).flags.includes('ferry_paid'), true);
  receipts.push({ case: 'paid-return', fixture: '河岸存档追加一枚不可在当前流程中获得的银币' });

  // On a phone-sized frame, tap the actual hull rather than the ground anchor.
  await approach('islet_ferry', [306, 165], 'd');
  await page.setViewportSize({ width: 844, height: 390 });
  await page.touchscreen.tap(...await canvasPoint(371, 152));
  const touched = await until(s => !s.processing && s.room === 'islet', '触控登船未抵达小岛');
  assert.equal(touched.lastCommand, 'in');
  assert.equal(touched.inventory.includes('silver_coin'), false);
  await drain();
  await shot('phone-islet-touch-arrival');
  receipts.push({ case: 'touch-boarding', from: 'the_river', target: 'islet' });
  await page.setViewportSize({ width: 1440, height: 900 });
  await goToSandBar();
  await approach('islet_gate', [174, 214], 'a');
  await pressF('look');
  const fromSandBar = await pressF('enter door', 'shallow_crater');
  assert.equal(fromSandBar.navigation.arrival?.fromRoom, 'sand_bar');
  assert.equal(fromSandBar.navigation.arrival?.entrance, 'door');

  assert.deepEqual(errors, []);
  await writeFile(join(output, 'result.json'), `${JSON.stringify({ receipts, errors }, null, 2)}\n`);
  console.log('通过河岸条件、单程、付费返航、实路通行、章节地图、沙漠边界与续玩检查');
} catch (error) {
  await shot('failure').catch(() => {});
  const current = await state().catch(() => null);
  await writeFile(join(output, 'failure.json'), `${JSON.stringify({
    message: error.message, current: current && { ...gameState(current), player: current.player,
      lastCommand: current.lastCommand, mode: current.mode, navigation: current.navigation }, receipts, errors,
  }, null, 2)}\n`);
  throw error;
} finally {
  await browser.close();
}
