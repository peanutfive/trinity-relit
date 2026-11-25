// Walk the painted trails with real browser input from a reachable checkpoint.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SCENES } from '../scene-manifest.js';
import { playedFerryCheckpoint } from './played-ferry-checkpoint.mjs';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const url = new URL(process.env.DEMO_URL || 'http://127.0.0.1:8080/2d-demo/');
const roadsOnly = new URL(url);
roadsOnly.searchParams.set('reviewRoutes', '1');
const output = process.env.QA_OUTPUT || join(tmpdir(), 'trinity-t30-browser');
const desert = new Set(Object.keys(SCENES).filter(id => /^(shallow_crater|(?:desert|foothills)_\d)$/.test(id)));
const directionKeys = { n: 'w', e: 'd', s: 's', w: 'a' };
const pavedConnections = { foothills_1: 'paved_road_2', foothills_2: 'paved_road_4', foothills_3: 'paved_road_5' };

// These are ground points read from the shipped backgrounds, short of their
// exit hit regions. The final stride always uses the matching direction key.
const roadPoints = {
  shallow_crater: { w: [[116, 174], [55, 155], [30, 145]], e: [[351, 154], [411, 144], [444, 129]] },
  desert_1: { e: [[235, 168], [296, 145], [375, 125], [432, 116]], s: [[235, 168], [235, 215], [244, 248]] },
  desert_2: { w: [[266, 154], [203, 158], [110, 148], [43, 143]], e: [[266, 154], [327, 144], [405, 147], [433, 141]] },
  desert_3: { w: [[232, 158], [130, 157], [43, 146]], e: [[232, 158], [350, 149], [433, 143]] },
  desert_4: { w: [[236, 148], [120, 150], [43, 142]], e: [[236, 148], [433, 145]], s: [[232, 154], [230, 210], [245, 250]] },
  desert_5: { w: [[80, 177], [33, 184]], e: [[400, 146], [426, 136]] },
  desert_6: { w: [[54, 154]], e: [[410, 175], [427, 177]] },
  desert_7: { w: [[240, 152], [149, 141], [43, 130]], e: [[240, 152], [368, 138], [437, 131]],
    s: [[240, 158], [230, 202], [230, 248]] },
  desert_8: { w: [[234, 157], [117, 151], [43, 145]], e: [[234, 157], [345, 152], [436, 145]] },
  desert_9: { w: [[207, 164], [108, 148], [43, 142]] },
  foothills_1: { n: [[234, 164], [262, 111], [270, 69], [279, 42]], s: [[234, 164], [243, 212], [232, 248]],
    w: [[147, 151], [85, 130], [43, 121]] },
  foothills_2: { n: [[237, 143], [233, 95], [243, 57]], s: [[239, 179], [231, 208], [239, 248]],
    w: [[238, 140], [125, 140], [43, 139]], e: [[238, 140], [371, 140], [437, 139]] },
  foothills_3: { n: [[226, 138], [230, 99], [246, 62], [249, 43]], e: [[226, 138], [353, 135], [437, 132]],
    w: [[226, 138], [142, 142], [43, 131]] },
};

await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, hasTouch: true });
page.setDefaultTimeout(8000);
const errors = [];
const receipts = new Map();
const visited = new Set();
const connectors = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });

const state = () => page.evaluate(() => JSON.parse(window.render_game_to_text()));
const tick = ms => page.evaluate(ms => window.advanceTime(ms), ms);
const shot = name => page.screenshot({ path: join(output, `${name}.png`) });
const progress = ({ room, chapter, turns, inventory, flags }) => ({ room, chapter, turns, inventory, flags });
const feet = ({ player }) => [player.x, player.y, player.facing];
const edgeKey = (from, { dir }) => `${from}:${dir}`;
const edgePair = (first, second) => [first, second].sort().join('|');

async function until(predicate, message) {
  for (let i = 0; i < 140; i++) {
    const current = await state();
    if (predicate(current)) return current;
    await tick(85);
  }
  const { room, player, lastCommand, navigation } = await state();
  throw Error(`${message}: ${JSON.stringify({ room, player, lastCommand, navigation })}`);
}

async function drain() {
  for (let i = 0; i < 35; i++) {
    const current = await until(s => !s.processing, '操作没有结算');
    if (current.dialogue) await page.keyboard.press('f');
    else if (current.narrative.busy) await tick(100);
    else return;
  }
  throw Error('对话或演出未结束');
}

async function clickPoint([x, y], touch = false) {
  const canvas = await page.locator('canvas').boundingBox();
  assert.ok(canvas);
  const screen = [canvas.x + x * canvas.width / 480, canvas.y + y * canvas.height / 288];
  if (touch) await page.touchscreen.tap(...screen);
  else await page.mouse.click(...screen);
}

async function walkTo(point, touch = false) {
  const before = await state();
  await clickPoint(point, touch);
  const current = await until(s => {
    assert.equal(s.room, before.room, '中途路点不能触发出口');
    return !s.processing && !s.navigation.path.length;
  }, `未抵达有图路点 ${point}`);
  assert.ok(Math.hypot(current.player.x - point[0], current.player.y - point[1]) <= 7,
    `${before.room}: ${feet(current)} 未抵达有图路点 ${point}`);
  assert.equal(current.turns, before.turns);
}

async function walkRoad(exit) {
  const before = await state();
  const points = roadPoints[before.room]?.[exit.dir];
  assert.ok(points, `${before.room}.${exit.dir} 缺少实际画面取样`);
  for (const point of points) await walkTo(point);
  await tick(600);
  const key = directionKeys[exit.dir];
  assert.ok(key);
  await page.keyboard.down(key);
  let arrival;
  try { arrival = await until(s => s.room !== before.room && !s.processing, `未走到 ${exit.target}`); }
  finally { await page.keyboard.up(key); }
  assert.equal(arrival.room, exit.target);
  assert.equal(arrival.turns, before.turns + 1);
  assert.equal(arrival.navigation.arrival?.fromRoom, before.room);
  assert.equal(arrival.navigation.arrival?.matched, true);
  const reciprocal = arrival.exits.find(back => back.target === before.room);
  assert.ok(reciprocal, `${arrival.room} 缺少来源返程`);
  assert.equal(arrival.navigation.arrival.entrance, reciprocal.dir);
  assert.ok(arrival.exits.every(candidate =>
    Math.hypot(arrival.player.x - candidate.x, arrival.player.y - candidate.y) > candidate.radius),
  `${arrival.room} 在路口感应区内落地`);
  await drain();
  receipts.set(edgeKey(before.room, exit), { from: before.room, dir: exit.dir,
    target: exit.target, entrance: reciprocal.dir, feet: feet(await state()) });
  return reciprocal;
}

async function explore(returnDirection) {
  const { room, exits, boundaries } = await state();
  visited.add(room);
  await shot(room);
  const pave = pavedConnections[room];
  if (pave) {
    assert.equal(exits.find(exit => exit.dir === 'w')?.target, pave);
    assert.equal(boundaries.some(boundary => boundary.dir === 'w'), false);
    connectors.push({ room, target: pave });
  }
  for (const exit of exits) {
    if (exit.dir === returnDirection || !desert.has(exit.target) || receipts.has(edgeKey(room, exit))) continue;
    const back = await walkRoad(exit);
    if (!visited.has(exit.target)) await explore(back.dir);
    await walkRoad(back);
  }
  assert.equal((await state()).room, room);
}

async function checkMap(rooms, connections, screenshot) {
  const before = progress(await state());
  await page.keyboard.press('m');
  const map = await until(s => s.mode === 'map', '地图未打开');
  assert.equal(map.map.chapter, 'desert');
  assert.equal(map.map.selected, before.room);
  assert.deepEqual(progress(map), before);
  const pane = page.locator('.chapter-map');
  const nodes = await pane.locator('[data-room-id]').evaluateAll(elements =>
    elements.map(element => element.getAttribute('data-room-id')).sort());
  assert.deepEqual(nodes, [...rooms].sort());
  const edges = await pane.locator('[data-from][data-to]').evaluateAll(elements => [...new Set(elements.map(element =>
    [element.getAttribute('data-from'), element.getAttribute('data-to')].sort().join('|')))].sort());
  assert.deepEqual(edges, [...connections].sort());
  await shot(screenshot);
  await page.keyboard.press('m');
  const after = await state();
  assert.equal(after.mode, 'exploring');
  assert.deepEqual(progress(after), before);
}

async function dropGnomon() {
  await page.keyboard.press('i');
  await page.getByRole('button', { name: '日晷指针', exact: true }).click();
  await page.keyboard.press('i');
  await page.locator('#inventory-drop').click();
  const dropped = await until(s => !s.processing && s.objects.some(object => object.itemId === 'gnomon'), '物品未落地');
  assert.equal(dropped.inventory.includes('gnomon'), false);
  await drain();
  return dropped.objects.find(object => object.itemId === 'gnomon').id;
}

async function retrieveGnomon(id) {
  const object = (await state()).objects.find(object => object.id === id);
  assert.ok(object?.pointerShape);
  const point = [object.pointerShape.x, object.pointerShape.y];
  await clickPoint(point, true);
  await until(s => !s.processing && s.observed.includes(id), '触屏未观察地面物品');
  await drain();
  await clickPoint(point, true);
  await until(s => !s.processing && s.inventory.includes('gnomon'), '触屏未拾取物品');
  await drain();
  assert.equal((await state()).objects.some(object => object.id === id), false);
}

try {
  const { file } = await playedFerryCheckpoint({stage:'crater',url,output});
  await page.goto(roadsOnly.href);
  await page.waitForFunction(() => window.render_game_to_text && JSON.parse(window.render_game_to_text()).art === 'loaded');
  await page.locator('#start').click();
  await drain();
  await page.keyboard.press('Escape');
  await page.getByRole('tab', { name: '探索进度' }).click();
  await page.locator('#save-file').setInputFiles(file);
  await until(s => s.room === 'shallow_crater' && !s.processing, '浅坑存档未载入');
  await drain();
  assert.equal(desert.size, 13);
  await checkMap(['shallow_crater'], [], 'initial-map');
  await explore();
  assert.deepEqual([...visited].sort(), [...desert].sort());
  assert.deepEqual(connectors.map(({ room }) => room).sort(), Object.keys(pavedConnections));
  const expected = [...desert].flatMap(id => SCENES[id].exits
    .filter(exit => desert.has(exit.target)).map(exit => edgeKey(id, exit)));
  assert.equal(expected.length, 28);
  assert.deepEqual([...receipts.keys()].sort(), expected.sort());
  const trailRoads = [...receipts.values()];
  const drawnRoads = new Set(trailRoads.map(({ from, target }) => edgePair(from, target)));
  await checkMap(desert, drawnRoads, 'desert-map');

  // Return to the middle foothill and save near a newly connected road.
  for (const dir of ['w', 'w', 's']) {
    const exit = (await state()).exits.find(exit => exit.dir === dir);
    assert.ok(exit);
    await walkRoad(exit);
  }
  assert.equal((await state()).room, 'foothills_2');
  const groundItem = await dropGnomon();
  const approach = roadPoints.foothills_2.w.at(-1);
  await walkTo(approach);
  await page.keyboard.press('Escape');
  const saved = await state();
  await page.goto(url.href);
  await page.locator('#continue-save').click();
  await drain();
  const restored = await state();
  assert.deepEqual(progress(restored), progress(saved));
  assert.deepEqual(feet(restored), feet(saved));
  assert.ok(restored.objects.some(object => object.id === groundItem));
  assert.equal(restored.routeMarker?.exit?.target, pavedConnections.foothills_2);
  await shot('restored-west-road');
  await page.setViewportSize({ width: 844, height: 390 });
  await checkMap(desert, drawnRoads, 'phone-map');
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await retrieveGnomon(groundItem);
  await shot('phone-recovered-item');
  const west = (await state()).exits.find(exit => exit.dir === 'w');
  await walkRoad(west);
  const pavedArrival = receipts.get('foothills_2:w');
  await shot('paved-road-arrival');
  assert.deepEqual(errors, []);
  await writeFile(join(output, 'result.json'), `${JSON.stringify({
    checkpoint: '仅通过现有动作抵达浅坑，未预置状态', visits: [...visited], roads: trailRoads,
    playableExits: trailRoads.length, connectors, pavedArrival, roomAfterReload: restored.room, restoredFeet: feet(restored),
    recoveredItem: groundItem, errors,
  }, null, 2)}\n`);
  console.log(`通过沙地与山麓 ${visited.size} 处、${trailRoads.length} 条键盘道路、地图和手机续玩检查`);
} catch (error) {
  await shot('failure').catch(() => {});
  const current = await state().catch(() => null);
  await writeFile(join(output, 'failure.json'), `${JSON.stringify({ message: error.message,
    current: current && { ...progress(current), player: current.player, routeMarker: current.routeMarker,
      lastCommand: current.lastCommand, mode: current.mode, navigation: current.navigation },
    visits: [...visited], roads: [...receipts.values()], errors,
  }, null, 2)}\n`);
  throw error;
} finally {
  await browser.close();
}
