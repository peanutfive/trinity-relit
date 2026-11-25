// Continues via the normal UI from a real opening, ferry crossing and crater entry.
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SCENES } from '../scene-manifest.js';
import { VISUAL_SAVE_KEY } from '../save.js';
import { playedFerryCheckpoint } from './played-ferry-checkpoint.mjs';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const url = process.env.DEMO_URL || 'http://127.0.0.1:8080/2d-demo/';
const output = process.env.QA_OUTPUT || join(tmpdir(), 'trinity-ranch-journey');
const gatewayOnly = process.argv.includes('--gateway-only');
const windmillCheckpoint = process.argv.includes('--windmill-checkpoint');
await mkdir(output, { recursive: true });
const {file:checkpoint,save:exported} = await playedFerryCheckpoint({stage:'crater',url,output});

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, hasTouch: true });
page.setDefaultTimeout(8000);
const errors = [];
const receipts = [];
let windmillBaseline;
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });

const state = () => page.evaluate(() => JSON.parse(window.render_game_to_text()));
const tick = ms => page.evaluate(ms => window.advanceTime(ms), ms);
const shot = name => page.screenshot({ path: join(output, `${name}.png`) });
const feet = ({ player }) => [player.x, player.y, player.facing];
const story = ({ room, chapter, turns, inventory, score, flags, sundialSymbol }) =>
  ({ room, chapter, turns, inventory, score, flags, sundialSymbol });

async function until(check, failure) {
  for (let step = 0; step < 180; step++) {
    const current = await state();
    if (check(current)) return current;
    await tick(85);
  }
  const { room, player, mode, navigation, lastCommand } = await state();
  throw Error(`${failure}: ${JSON.stringify({ room, player, mode, navigation, lastCommand })}`);
}

async function drain() {
  for (let step = 0; step < 65; step++) {
    const current = await until(s => !s.processing, '操作未结算');
    if (current.mode === 'dialogue') await page.keyboard.press('f');
    else if (current.narrative.busy) await tick(130);
    else return;
  }
  throw Error('叙事未结束');
}

async function clickAt([x, y], touch = false) {
  const canvas = await page.locator('canvas').boundingBox();
  assert.ok(canvas);
  const point = [canvas.x + x / 480 * canvas.width, canvas.y + y / 288 * canvas.height];
  if (touch) await page.touchscreen.tap(...point);
  else await page.mouse.click(...point);
}

async function walkTo(point) {
  const before = await state();
  const [x, y] = point;
  const marker = before.routeMarker;
  if (marker?.exit && x >= marker.left && x <= marker.left + marker.width
      && y >= marker.top && y <= marker.top + marker.height) {
    // When a route sign covers this sample, walk the last stretch on the ground.
    await walkUnderSign(point, before.room);
  } else {
    await clickAt(point);
  }
  const after = await until(s => {
    assert.equal(s.room, before.room, `中途路点 ${point} 引发意外换房`);
    return !s.processing && !s.navigation.path.length;
  }, `未走到画面采样点 ${point}`);
  assert.ok(Math.hypot(after.player.x - point[0], after.player.y - point[1]) <= 7,
    `${before.room} 没有到达地面点 ${point}，停在 ${feet(after)}`);
  assert.equal(after.turns, before.turns);
}

async function walkUnderSign([x, y], room) {
  for (let i = 0; i < 160; i++) {
    const current = await state();
    assert.equal(current.room, room);
    const dx = x - current.player.x, dy = y - current.player.y;
    if (Math.hypot(dx, dy) <= 4) return;
    const keys = [];
    if (Math.abs(dx) > 2) keys.push(dx > 0 ? 'd' : 'a');
    if (Math.abs(dy) > 2) keys.push(dy > 0 ? 's' : 'w');
    for (const key of keys) await page.keyboard.down(key);
    try { await tick(35); }
    finally { for (const key of keys) await page.keyboard.up(key); }
  }
  throw Error(`${room} 无法步行到标识下的 ${x},${y}`);
}

async function pointerAction(objectId, point, command, target, touch = false) {
  for (let attempt = 0; attempt < 3; attempt++) {
    await drain();
    const before = await state();
    assert.ok(before.objects.some(object => object.id === objectId && object.actions.some(action => action.command === command)),
      `${before.room} 画中物件未提供 ${command}`);
    await clickAt(point, touch);
    const after = await until(s => !s.processing && (s.room !== before.room || s.turns > before.turns),
      `${objectId} 未响应点击`);
    if (after.lastCommand === command) {
      if (target) assert.equal(after.room, target);
      await drain();
      return;
    }
    assert.match(after.lastCommand || '', /^(examine |look$)/);
  }
  throw Error(`${objectId} 未执行 ${command}`);
}

async function approachF(point, direction, objectId) {
  await walkTo(point);
  await page.keyboard.down(direction);
  try { await tick(13); }
  finally { await page.keyboard.up(direction); }
  const current = await state();
  const object = current.objects.find(value => value.id === objectId);
  assert.ok(object);
  assert.equal(current.nearby, object.label);
}

async function pressF(command, target) {
  const before = await state();
  await page.keyboard.press('f');
  const after = await until(s => !s.processing && s.lastCommand === command && s.turns > before.turns,
    `F 未执行 ${command}`);
  assert.equal(after.room, target || before.room);
  await drain();
  return after;
}

async function reachCrater() {
  await page.goto(url);
  await page.waitForFunction(() => window.render_game_to_text && JSON.parse(window.render_game_to_text()).art === 'loaded');
  assert.equal((await state()).mode, 'title');
  await page.locator('#start').click();
  await drain();
  await page.keyboard.press('Escape');
  await page.getByRole('tab', { name: '探索进度' }).click();
  await page.locator('#save-file').setInputFiles(checkpoint);
  await until(s => s.room === 'shallow_crater' && !s.processing, '浏览器实走到浅坑的续玩未载入');
  await drain();
  assert.equal((await state()).turns, exported.engine.state.turns);
  assert.equal((await state()).chapter, 'desert');
  assert.ok((await state()).inventory.includes('gnomon'));
  assert.ok((await state()).inventory.includes('splinter'), '正常序章路线应已从南沼泽拾到发光木片');
  await shot('crater-checkpoint');
}

async function cross({ dir, target, entrance, points, keys, screenshot }) {
  const before = await state();
  assert.equal(before.exits.find(exit => exit.dir === dir)?.target, target);
  for (const point of points) await walkTo(point);
  await tick(600);
  for (const key of keys) await page.keyboard.down(key);
  let after;
  try { after = await until(s => s.room !== before.room && !s.processing, `按路面未到达 ${target}`); }
  finally { for (const key of keys) await page.keyboard.up(key); }
  await verifyCrossing(before, after, { dir, target, entrance, screenshot, input: 'keyboard-road' });
}

async function verifyCrossing(before, after, { dir, target, entrance, screenshot, input }) {
  assert.equal(after.room, target);
  assert.equal(after.chapter, SCENES[target].chapter);
  assert.equal(after.lastCommand, dir);
  assert.equal(after.turns, before.turns + 1);
  assert.equal(after.score, before.score);
  assert.deepEqual(after.inventory, before.inventory);
  const arrival = after.navigation.arrival;
  assert.equal(arrival?.fromRoom, before.room);
  assert.equal(arrival?.entrance, entrance);
  assert.equal(arrival?.matched, true);
  const authored = SCENES[target].sourceArrivals?.[before.room];
  if (authored) assert.deepEqual(feet(after), [Math.round(authored.x), Math.round(authored.y), authored.face]);
  assert.equal(after.art, 'loaded');
  assert.ok(after.flags.includes(`chapter_${after.chapter}_entered`));
  await drain();
  if (after.chapter === 'ranch') await checkLocationClearance();
  if (screenshot) await shot(screenshot);
  receipts.push({ from: before.room, dir, to: target, entrance, input, foot: feet(after), turns: [before.turns, after.turns] });
}

async function checkLocationClearance() {
  const { player } = await state();
  const canvas = await page.locator('canvas').boundingBox();
  const card = await page.locator('.location').boundingBox();
  assert.ok(canvas && card);
  const left = canvas.x + (player.x - 9) * canvas.width / 480;
  const right = canvas.x + (player.x + 9) * canvas.width / 480;
  const top = canvas.y + (player.y - 35) * canvas.height / 288;
  const bottom = canvas.y + player.y * canvas.height / 288;
  assert.ok(top >= canvas.y, '到达时主角头部超出画布');
  assert.ok(left >= card.x + card.width || right <= card.x || top >= card.y + card.height || bottom <= card.y,
    '牧场落点的人物被地点卡挡住');
}

async function mapAt(chapter, rooms, screenshot) {
  const before = await state();
  await page.keyboard.press('m');
  const active = await until(s => s.mode === 'map', '未打开地图');
  assert.equal(active.map.chapter, chapter);
  assert.equal(active.map.selected, before.room);
  assert.deepEqual(story(active), story(before));
  const map = page.locator('.chapter-map');
  const ids = await map.locator('[data-room-id]').evaluateAll(nodes =>
    nodes.map(node => node.getAttribute('data-room-id')).sort());
  assert.deepEqual(ids, [...rooms].sort());
  if (chapter === 'ranch') {
    const stairs = map.locator('.map-stairway');
    const discovered = ['south_reservoir', 'edge_reservoir'].every(id => rooms.includes(id));
    assert.equal(await stairs.count(), Number(discovered));
    if (discovered) {
      const markings = await stairs.evaluate(path => ({
        rooms: [path.dataset.from, path.dataset.to].sort(),
        length: path.getTotalLength(),
        tread: getComputedStyle(path).strokeDasharray,
      }));
      assert.deepEqual(markings.rooms, ['edge_reservoir', 'south_reservoir']);
      assert.ok(markings.length > 0 && markings.tread !== 'none');
    }
  }
  await shot(screenshot);
  await page.keyboard.press('m');
  assert.deepEqual(story(await state()), story(before));
}

async function reopen(screenshot) {
  const before = await state();
  await page.keyboard.press('Escape');
  await page.getByRole('tab', { name: '探索进度' }).click();
  await page.locator('#save-now').click();
  const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), VISUAL_SAVE_KEY);
  assert.equal(saved.engine.state.room, before.room);
  assert.equal(saved.engine.state.chapter, before.chapter);
  assert.equal(saved.engine.state.turns, before.turns);
  await page.reload();
  await page.locator('#continue-save').click();
  await until(s => s.room === before.room && !s.processing, '正常续玩没有回到保存房间');
  await drain();
  const restored = await state();
  assert.deepEqual(story(restored), story(before));
  assert.deepEqual(feet(restored), feet(before));
  assert.deepEqual(restored.observed, before.observed);
  assert.deepEqual(restored.discovery, before.discovery);
  if (restored.chapter === 'ranch') await checkLocationClearance();
  await shot(screenshot);
}

const entry = {
  dir: 'se', target: 'nw_ranch', entrance: 'nw', points: [[286, 194], [307, 210], [339, 219], [362, 234], [392, 253]],
  keys: ['s', 'd'], screenshot: 'ranch-entry',
};
const returnRoad = {
  dir: 'nw', target: 'shallow_crater', entrance: 'se', points: [],
  keys: ['w', 'a'], screenshot: 'crater-return',
};

const walkKeys = { n: ['w'], ne: ['w', 'd'], e: ['d'], se: ['s', 'd'], s: ['s'], sw: ['s', 'a'], w: ['a'], nw: ['w', 'a'] };
const ranchRooms = new Set(['nw_ranch', 'ne_ranch', 'front_yard', 'se_ranch', 'sw_ranch',
  'north_reservoir', 'south_reservoir', 'under_windmill']);
// Waypoints on the actual painted roads, stopping short of the exit sensors.
const ranchRoads = {
  nw_ranch: { e: [[193, 102], [248, 90], [351, 89], [438, 88]], s: [[155, 136], [147, 166], [149, 211], [150, 247]] },
  ne_ranch: {
    w: [[243, 125], [208, 112], [156, 100], [71, 90], [44, 88]], s: [[249, 157], [254, 201], [249, 248]],
    e: [[244, 126], [273, 107], [327, 99], [408, 97], [433, 96]],
  },
  front_yard: {
    n: [[221, 130], [211, 104], [201, 70], [209, 44]], s: [[222, 172], [216, 213], [199, 248]],
    ne: [[205, 89], [227, 71], [267, 58], [312, 44], [358, 35], [395, 24]],
    se: [[221, 153], [250, 176], [279, 183], [309, 194], [352, 213], [389, 230], [424, 246]],
  },
  se_ranch: {
    w: [[213, 145], [173, 149], [133, 159], [71, 163], [44, 163]], n: [[241, 132], [267, 108], [274, 73], [275, 42]],
    e: [[244, 131], [275, 127], [315, 134], [368, 136], [420, 136]],
  },
  sw_ranch: { e: [[189, 172], [244, 185], [342, 188], [438, 188]], n: [[155, 123], [153, 92], [159, 57], [160, 44]] },
  north_reservoir: {
    w: [[211, 104], [170, 102], [121, 98], [56, 92], [44, 89]],
    sw: [[155, 105], [122, 118], [96, 143], [80, 163], [57, 206], [43, 227], [36, 249]],
    se: [[242, 104], [330, 105], [365, 120], [395, 145], [423, 183], [443, 223], [456, 247]],
  },
  south_reservoir: {
    w: [[214, 158], [151, 169], [96, 167], [41, 167]],
    nw: [[127, 160], [100, 143], [78, 115], [61, 84], [49, 60], [37, 47]],
    ne: [[298, 145], [338, 133], [374, 116], [410, 85], [437, 53], [446, 42]],
  },
  under_windmill: {
    nw: [[220, 157], [213, 123], [207, 106], [197, 88], [165, 72], [123, 53], [87, 43], [60, 30]],
    sw: [[214, 165], [204, 196], [165, 220], [123, 241], [87, 253]],
  },
};

async function crossRanchRoad(exit) {
  const { room } = await state();
  const sample = ranchRoads[room]?.[exit.dir];
  const expectedBack = SCENES[exit.target]?.exits.find(back => back.target === room && !back.interactionOnly);
  assert.ok(sample && expectedBack, `${room}.${exit.dir} 缺画面路线或真实返程入口`);
  await cross({ dir: exit.dir, target: exit.target, entrance: expectedBack.dir, points: sample, keys: walkKeys[exit.dir] });
  return expectedBack.dir;
}

async function exploreRanch(visited, travelled, returnDirection) {
  const { room, exits } = await state();
  visited.add(room);
  if (['north_reservoir', 'south_reservoir', 'under_windmill'].includes(room)) await shot(room);
  if (room === 'south_reservoir') await exerciseStairs(visited);
  if (room === 'under_windmill') {
    if (!SCENES.windmill) assert.equal(exits.some(exit => exit.dir === 'u'), false);
    windmillBaseline = await captureWindmillBaseline();
  }
  for (const exit of exits) {
    const leg = `${room}:${exit.dir}`;
    if (exit.dir === returnDirection || !ranchRooms.has(exit.target) || exit.interactionOnly || travelled.has(leg)) continue;
    const backDir = await crossRanchRoad(exit);
    travelled.add(leg);
    if (!visited.has(exit.target)) await exploreRanch(visited, travelled, backDir);
    const back = (await state()).exits.find(candidate => candidate.dir === backDir && candidate.target === room);
    assert.ok(back);
    await crossRanchRoad(back);
    travelled.add(`${exit.target}:${backDir}`);
  }
}

async function climbStairs(command, target, { point, face }, screenshot) {
  const { objects, exits } = await state();
  const matching = objects.filter(object => object.actions.some(action => action.command === command));
  assert.equal(matching.length, 1, '同一处台阶只应有一个可交互物件');
  assert.ok(exits.some(exit => exit.dir === command && exit.target === target && exit.interactionOnly));
  await approachF(point, face, matching[0].id);
  const before = await state();
  const after = await pressF(command, target);
  const source = SCENES[target].sourceArrivals?.[before.room];
  assert.ok(source, `${target} 缺少台阶来向落点`);
  await verifyCrossing(before, after, { dir: command, target, entrance: source.entrance, screenshot, input: 'F-stairs' });
}

async function exerciseStairs(visited) {
  await climbStairs('u', 'edge_reservoir', { point: [237, 151], face: 'w' }, 'edge_reservoir');
  await walkTo([236, 152]);
  const dry = await state();
  assert.ok(dry.exits.filter(exit => exit.target === 'reservoir').every(exit => exit.interactionOnly));
  await page.keyboard.down('w');
  try { await tick(820); }
  finally { await page.keyboard.up('w'); }
  const waterline = await state();
  assert.deepEqual(story(waterline), story(dry));
  assert.ok(waterline.player.y >= 124 && waterline.player.y <= dry.player.y - 5,
    '角色应能靠近画中水线并停在干地一侧');
  receipts.push({ from: dry.room, input: 'blocked-water', before: feet(dry), after: feet(waterline) });
  await shot('edge-water-stop');

  await walkTo([234, 171]);
  await page.keyboard.press('i');
  await page.getByRole('button', { name: '日晷指针', exact: true }).click();
  await page.keyboard.press('i');
  await page.locator('#inventory-drop').click();
  const drop = await until(s => !s.processing && s.objects.some(object => object.itemId === 'gnomon'), '指针没有落在平台上');
  assert.equal(drop.inventory.includes('gnomon'), false);
  const item = drop.objects.find(object => object.itemId === 'gnomon');
  await drain();
  await reopen('edge-reopened');
  const restoredItem = (await state()).objects.find(object => object.id === item.id);
  assert.deepEqual(restoredItem?.pointerShape, item.pointerShape);
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await shot('phone-edge');
  await mapAt('ranch', [...visited, 'edge_reservoir'], 'phone-ranch-map');
  await pointerAction(item.id, [item.pointerShape.x, item.pointerShape.y], 'take gnomon', 'edge_reservoir', true);
  const recovered = await state();
  assert.ok(recovered.inventory.includes('gnomon') && recovered.objects.every(object => object.id !== item.id));
  receipts.push({ from: 'edge_reservoir', input: 'touch-item', item: item.id });
  await page.setViewportSize({ width: 1440, height: 900 });
  await climbStairs('d', 'south_reservoir', { point: [234, 188], face: 's' }, 'south-steps-return');
  await reopen('south-steps-reopened');
}

async function verifyReservoir() {
  const visited = new Set();
  const travelled = new Set();
  await exploreRanch(visited, travelled);
  assert.deepEqual([...visited].sort(), [...ranchRooms].sort());
  assert.equal(travelled.size, 22);
  await mapAt('ranch', [...visited, 'edge_reservoir'], 'ranch-reservoir-map');
}

async function windmillPixels() {
  const regions = { landing: [234, 62, 76, 39], ladder: [247, 117, 54, 48],
    shore: [109, 176, 109, 55], water: [27, 60, 57, 86] };
  return page.locator('canvas').evaluate((canvas, regions) => {
    const scale = canvas.width / 480;
    const context = canvas.getContext('2d');
    return Object.fromEntries(Object.entries(regions).map(([name, [x, y, w, h]]) => [name,
      Array.from(context.getImageData(x * scale, y * scale, w * scale, h * scale).data)]));
  }, regions);
}

async function exportProgress(path) {
  await page.keyboard.press('Escape');
  await page.getByRole('tab', { name: '探索进度' }).click();
  await page.locator('#save-now').click();
  const download = page.waitForEvent('download');
  await page.locator('#export-save').click();
  await (await download).saveAs(path);
  await page.keyboard.press('Escape');
  return JSON.parse(await readFile(path, 'utf8'));
}

async function captureWindmillBaseline() {
  const pixels = await windmillPixels();
  const save = await exportProgress(join(output, 'windmill-normal-save.json'));
  return { pixels, save };
}

async function exportWindmillCheckpoint() {
  for (const [dir, target] of [['e', 'ne_ranch'], ['s', 'front_yard'], ['se', 'south_reservoir'], ['ne', 'under_windmill']]) {
    const exit = (await state()).exits.find(candidate => candidate.dir === dir && candidate.target === target);
    assert.ok(exit, `未找到通往 ${target} 的正常道路`);
    await crossRanchRoad(exit);
  }
  assert.ok((await state()).inventory.includes('splinter'));
  await shot('under-windmill-checkpoint');
  const packet = await exportProgress(join(output, 'windmill-normal-save.json'));
  assert.equal(packet.engine.state.room, 'under_windmill');
  assert.equal(packet.engine.state.itemLoc.splinter, 'inventory');
  assert.equal(packet.engine.state.flags.includes('binoculars_broken'), false);
}

function changedPixels(before, after) {
  assert.equal(before.length, after.length);
  let changed = 0;
  for (let i = 0; i < before.length; i += 4) {
    if ([0, 1, 2].some(channel => Math.abs(before[i + channel] - after[i + channel]) > 10)) changed++;
  }
  return changed * 4 / before.length;
}

async function verifyWindmillVariant() {
  const { pixels, save } = windmillBaseline;
  assert.equal(save.engine.state.room, 'under_windmill');
  assert.equal(save.engine.state.flags.includes('binoculars_broken'), false);
  const variant = structuredClone(save);
  variant.engine.state.flags.push('binoculars_broken');
  await page.keyboard.press('Escape');
  await page.getByRole('tab', { name: '探索进度' }).click();
  await page.locator('#save-file').setInputFiles({ name: 'windmill-damaged-preset.json', mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(variant)) });
  const restored = await until(s => s.room === 'under_windmill' && !s.processing && s.art === 'loaded', '损坏状态副本没有由普通导入恢复');
  await drain();
  await tick(300);
  assert.deepEqual(feet(restored), [save.visual.x, save.visual.y, save.visual.face]);
  assert.equal(restored.turns, save.engine.state.turns);
  assert.ok(restored.flags.includes('binoculars_broken'));
  assert.equal(restored.exits.some(exit => exit.dir === 'u'), false);
  assert.equal(restored.objects.some(object => object.actions.some(action => action.command === 'u')), false);

  const damaged = await windmillPixels();
  const changed = Object.fromEntries(Object.keys(pixels).map(name => [name, changedPixels(pixels[name], damaged[name])]));
  assert.ok(changed.landing > 0.12, '高处木台没有在游戏画布里切换到破损状态');
  for (const name of ['ladder', 'shore', 'water']) assert.ok(changed[name] < 0.02, `${name} 的画面不应随木台改变`);
  await shot('windmill-damaged-preset');

  await walkTo([268, 176]);
  await page.keyboard.down('w');
  try { await tick(13); }
  finally { await page.keyboard.up('w'); }
  const atLadder = await state();
  await page.keyboard.press('f');
  await tick(300);
  assert.deepEqual(story(await state()), story(atLadder), '断平台下的 F 不应提交上梯命令');

  const startReceipt = receipts.length;
  for (const dir of ['nw', 'sw']) {
    const exit = (await state()).exits.find(candidate => candidate.dir === dir);
    const backDir = await crossRanchRoad(exit);
    const back = (await state()).exits.find(candidate => candidate.dir === backDir && candidate.target === 'under_windmill');
    await crossRanchRoad(back);
  }
  return { preset: '正式路线中导出的风车下存档，副本仅加入 binoculars_broken。',
    changed, ladderBlocked: true, roads: receipts.splice(startReceipt) };
}

try {
  await reachCrater();
  await cross(entry);
  let windmillPreset;
  if (windmillCheckpoint) await exportWindmillCheckpoint();
  else {
    await mapAt('ranch', ['nw_ranch'], 'ranch-map');
    await reopen('ranch-reopened');
    await cross(returnRoad);
    await mapAt('desert', ['shallow_crater'], 'desert-map-after-return');
    await reopen('crater-reopened');
    await cross({ ...entry, screenshot: 'ranch-reentry' });
    if (!gatewayOnly) {
      await verifyReservoir();
      windmillPreset = await verifyWindmillVariant();
    }
  }
  assert.deepEqual(errors, []);
  await writeFile(join(output, 'result.json'), `${JSON.stringify({
    start: '从实际开局取得墓地道具并正常付费过河的浅坑续档，经普通导入接续。',
    checkpoint: exported.engine.state.room, receipts, windmillPreset, errors,
  }, null, 2)}\n`);
  console.log(windmillCheckpoint ? '正常走到风车下并导出带木片的进度' : gatewayOnly
    ? '浅坑与牧场正常双向接入、原路重进、地图和刷新续玩通过'
    : '牧场正常进场往返、两岸步行环、台阶 F、地图和刷新续玩通过');
} catch (error) {
  await shot('failure').catch(() => {});
  const current = await state().catch(() => null);
  await writeFile(join(output, 'failure.json'), `${JSON.stringify({ message: error.message,
    current: current && { ...story(current), foot: feet(current), mode: current.mode, navigation: current.navigation },
    receipts, errors,
  }, null, 2)}\n`);
  throw error;
} finally {
  await browser.close();
}
