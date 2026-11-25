// Exercise the browser entry point from a checkpoint reached through game commands.
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
const output = process.env.QA_OUTPUT || join(tmpdir(), 'trinity-paved-roads');
const road = number => `paved_road_${number}`;
const hill = number => `foothills_${number}`;
const facingKeys = { n: ['w'], s: ['s'], e: ['d'], w: ['a'], se: ['d'], nw: ['a'] };
const photographed = new Set(), visited = new Set(), receipts = [], cornerProbes = [], errors = [];

// Final approach samples are on the painted carriageway or the unpaved shoulder.
const painted = {
  shallow_crater: { w: [30,145] },
  desert_5: { w: [33,184] },
  desert_4: { s: [245,250] },
  foothills_1: { w: [43,121] },
  foothills_2: { w: [43,139] },
  foothills_3: { w: [43,133] },
  paved_road_1: { n: [240,74], s: [232,244], nw: [43,80], se: [436,212] },
  paved_road_2: { n: [165,71], s: [167,245], e: [443,81] },
  paved_road_3: { n: [230,76], s: [224,245] },
  paved_road_4: { n: [223,76], s: [199,245], e: [434,137] },
  paved_road_5: { n: [185,83], s: [244,245], e: [447,70] },
  paved_road_6: { n: [236,77], s: [224,245] },
};

await mkdir(output, { recursive: true });
const browser = await chromium.launch(), page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
const state = () => page.evaluate(() => JSON.parse(window.render_game_to_text()));
const tick = ms => page.evaluate(ms => window.advanceTime(ms), ms);
const shot = name => page.screenshot({ path: join(output, name + '.png') });
const feet = s => [s.player.x, s.player.y, s.player.facing];
const progress = s => [s.room, s.chapter, s.turns, s.inventory, s.flags];

async function until(check, note, stepMs = 80) {
  for (let i = 0; i < Math.ceil(9600 / stepMs); i++) {
    const current = await state();
    if (check(current)) return current;
    await tick(stepMs);
  }
  const { room, navigation, player } = await state();
  throw Error(`${note}: ${JSON.stringify({room, navigation, player})}`);
}
async function drain() {
  for (let i = 0; i < 40; i++) {
    const s = await until(current => !current.processing, '命令未完成');
    if (s.dialogue) await page.keyboard.press('f');
    else if (s.narrative.busy) await tick(200);
    else return;
  }
  throw Error('对话未关闭');
}
async function clickGround(x, y) {
  const bounds = await page.locator('canvas').boundingBox();
  await page.mouse.click(bounds.x + bounds.width * x / 480, bounds.y + bounds.height * y / 288);
}
async function approach(id, dir, stepMs = 80) {
  const point = painted[id]?.[dir];
  assert.ok(point, `${id}.${dir} 缺画面取样`);
  await clickGround(...point);
  const s = await until(current => {
    assert.equal(current.room, id);
    return !current.navigation.path.length && !current.processing;
  }, `${id} 路面无法接近`, stepMs);
  assert.ok(Math.hypot(s.player.x-point[0], s.player.y-point[1]) < 6, `${id}.${dir} 路面有阻挡`);
  return s;
}

async function travel(dir, expected, mouse = false) {
  const before = await state(), exit = before.exits.find(route => route.dir === dir);
  assert.equal(exit?.target, expected);
  await approach(before.room, dir);
  await tick(600);
  // At the far end of the fifth road's dirt branch the painted path climbs northeast.
  const keys = before.room === road(5) && dir === 'e' ? ['d', 'w'] : facingKeys[dir];
  if (mouse) await clickGround(exit.x, exit.y);
  else for (const key of keys) await page.keyboard.down(key);
  let after;
  try { after = await until(s => !s.processing && s.room !== before.room, `${before.room}.${dir} 未出路口`); }
  finally { if (!mouse) for (const key of keys) await page.keyboard.up(key); }
  assert.equal(after.room, expected);
  assert.equal(after.turns, before.turns + 1);
  const reverse = after.exits.find(route => route.target === before.room);
  assert.ok(reverse);
  assert.equal(after.navigation.arrival.entrance, reverse.dir);
  assert.equal(after.navigation.arrival.fromRoom, before.room);
  assert.equal(after.navigation.arrival.matched, true);
  assert.ok(after.exits.every(route => Math.hypot(after.player.x-route.x,after.player.y-route.y)>route.radius));
  receipts.push({ from: before.room, dir, target: after.room, entrance: reverse.dir, mouse });
  visited.add(after.room);
  await drain();
  if (!photographed.has(after.room)) {
    await until(s => s.art === 'loaded', `${after.room} 背景没有完成加载`);
    await shot(after.room);
    photographed.add(after.room);
  }
}

async function checkMap(name) {
  const before = await state();
  await page.keyboard.press('m');
  const map = await until(s => s.mode === 'map', '地图没有打开');
  assert.equal(map.map.chapter, 'desert');
  assert.equal(map.map.selected, before.room);
  assert.deepEqual(progress(map), progress(before));
  const shown = await page.locator('.chapter-map [data-room-id]').evaluateAll(nodes => nodes.map(n => n.dataset.roomId).sort());
  assert.deepEqual(shown, [...visited].sort());
  const edges = await page.locator('.chapter-map [data-from][data-to]').evaluateAll(lines =>
    [...new Set(lines.map(line => [line.dataset.from,line.dataset.to].sort().join('|')))].sort());
  const expectedEdges = new Set();
  for (const id of visited) for (const exit of SCENES[id].exits) {
    if (visited.has(exit.target)) expectedEdges.add([id,exit.target].sort().join('|'));
  }
  assert.deepEqual(edges, [...expectedEdges].sort());
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await shot(name);
  await page.keyboard.press('Escape');
  const after = await state();
  assert.equal(after.mode, 'exploring');
  assert.deepEqual(progress(after), progress(before));
}

async function boundary(dir) {
  const before = await state(), location = before.boundaries.find(exit => exit.dir === dir);
  assert.ok(location, `${before.room}.${dir} 缺制作边界`);
  assert.equal(before.exits.some(exit => exit.dir === dir), false);
  await approach(before.room, dir);
  for (const key of facingKeys[dir]) await page.keyboard.down(key);
  try { await tick(650); } finally { for (const key of facingKeys[dir]) await page.keyboard.up(key); }
  const after = await state();
  assert.deepEqual(progress(after), progress(before));
  assert.ok(Math.hypot(after.player.x-location.x, after.player.y-location.y)<18,
    `${before.room}.${dir} 未抵达实际路口`);
  receipts.push({ boundary: dir, room: before.room, foot: feet(after) });
  await shot(`${before.room}-boundary-${dir}`);
}

// On the second plate this journey has a long level segment just touching
// the shoulder. Turning early at its first bend used to strand the player.
async function checkShoulderCorner() {
  const id = road(2);
  for (const stepMs of [48, 71, 93]) {
    const before = await state();
    assert.equal(before.room, id);
    assert.equal(before.navigation.arrival.fromRoom, road(3));
    assert.equal(before.navigation.arrival.entrance, 'n');
    const after = await approach(id, 'e', stepMs);
    assert.deepEqual(progress(after), progress(before));
    cornerProbes.push({stepMs, start: feet(before), target: painted[id].e, end: feet(after)});
    await travel('n', road(3));
    await travel('s', id);
  }
}

try {
  const { file,save } = await playedFerryCheckpoint({stage:'crater',url,output});
  await page.goto(roadsOnly.href);
  await page.waitForFunction(() => window.render_game_to_text && JSON.parse(window.render_game_to_text()).art === 'loaded');
  await page.locator('#start').click(); await drain();
  await page.keyboard.press('Escape');
  await page.getByRole('tab', {name:'探索进度'}).click();
  await page.locator('#save-file').setInputFiles(file);
  await until(s => s.room === 'shallow_crater' && !s.processing && s.mode !== 'paused','浅坑读档失败');
  await drain();
  for (const room of save.engine.state.visited) if (SCENES[room]?.chapter==='desert') visited.add(room);
  await travel('w','desert_5');
  await travel('w','desert_4');
  await travel('s',hill(2));
  const entryRoads = receipts.splice(0);
  await checkMap('before-roads');
  await travel('w', road(4));
  await checkMap('first-road');
  await travel('e', hill(2), true); await travel('w', road(4));
  await travel('s', road(3)); await travel('s', road(2));
  await checkShoulderCorner();
  await travel('e', hill(1)); await travel('w', road(2));
  await travel('s', road(1)); await boundary('s'); await boundary('se'); await boundary('nw');
  await travel('n', road(2)); await travel('n', road(3)); await travel('n', road(4));
  await travel('n', road(5)); await travel('e', hill(3)); await travel('w', road(5));
  await travel('n', road(6)); await boundary('n');
  await page.keyboard.press('Escape');
  const recorded = await state();
  await page.goto(url.href);
  await page.locator('#continue-save').click(); await drain();
  const restored = await state();
  assert.deepEqual(progress(restored), progress(recorded));
  assert.deepEqual(feet(restored), feet(recorded));
  assert.equal(restored.routeMarker?.exit,null);
  assert.match(restored.routeMarker.text,/前方场景制作中/);
  await shot('road-end-restored');
  await page.setViewportSize({width:844,height:390});
  await checkMap('all-six-road-map');
  await page.goto(roadsOnly.href); await page.locator('#continue-save').click(); await drain();
  await travel('s', road(5));
  await travel('s', road(4));
  const travelled = new Set(receipts.filter(receipt => receipt.target)
    .map(receipt => receipt.from + '>' + receipt.target));
  assert.equal(travelled.size, 16, '六段公路和三条山麓支路均应双向实走');
  assert.deepEqual(errors,[]);
  await writeFile(join(output,'result.json'),JSON.stringify({checkpoint:'shallow_crater',entryRoads,rooms:[...visited],receipts,cornerProbes,errors},null,2));
  console.log('通过六段铺装路、三个山麓岔口、四处制作边界、地图与续玩验收');
} catch (error) {
  await shot('failure').catch(() => {});
  await writeFile(join(output,'failure.json'),JSON.stringify({message:error.message,state:await state().catch(()=>null),receipts,cornerProbes,errors},null,2));
  throw error;
} finally { await browser.close(); }
