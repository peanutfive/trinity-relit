// Real touch, keyboard and canvas inputs after a ferry trip with legitimately acquired fare.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { playedFerryCheckpoint } from './played-ferry-checkpoint.mjs';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const url = new URL(process.env.DEMO_URL || 'http://127.0.0.1:8080/2d-demo/');
const roadsOnly = new URL(url);
roadsOnly.searchParams.set('reviewRoutes', '1');
const output = process.env.QA_OUTPUT || join(tmpdir(), 'trinity-t27-browser');
const receipts = [];
const errors = [];

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

async function importSave(file, room) {
  await drain();
  await page.keyboard.press('Escape');
  await page.getByRole('tab', { name: '探索进度' }).click();
  await page.locator('#save-file').setInputFiles(file);
  assert.equal((await until(s => !s.processing && s.mode !== 'paused' && s.room===room, '存档未恢复')).room, room);
  await drain();
}

async function exportSave(name) {
  await page.keyboard.press('Escape');
  await page.getByRole('tab', { name: '探索进度' }).click();
  await page.locator('#save-now').click();
  const downloaded = page.waitForEvent('download');
  await page.locator('#export-save').click();
  const path = join(output,name);
  await (await downloaded).saveAs(path);
  await page.keyboard.press('Escape');
  return path;
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
    && s.turns>before.turns && (!target || s.room === target), `F 未执行 ${command}`);
  if (target && target !== before.room) {
    receipts.push({ case: 'F-passage', from: before.room, target, command, turn: current.turns });
    await shot(`${before.room}-to-${target}`);
  }
  await drain();
  return current;
}

async function touchVessel(id, command) {
  const before = await state();
  const object = before.objects.find(entry => entry.id===`${before.room}:${id}`);
  assert.ok(object?.actions.some(action => action.command===command));
  const {points} = object.pointerShape;
  const midpoint = points.reduce(([x,y],[px,py]) => [x+px/points.length,y+py/points.length],[0,0]);
  await page.touchscreen.tap(...await canvasPoint(...midpoint));
  const after = await until(s => !s.processing && s.turns>before.turns && s.lastCommand===command, `触摸未完成 ${command}`);
  assert.equal(after.turns,before.turns+1);
  const pages = await drain();
  assert.equal(new Set(pages).size,pages.length,'渡口抵达描述只显示一次');
  receipts.push({case:'touch',command,from:before.room,target:after.room,turn:after.turns});
  return after;
}

async function crossFromRiver() {
  const first = await state();
  assert.equal(first.ferry.phase,0);
  assert.ok(first.ferry.visible && !first.ferry.docked);
  await walkTo(324,165);
  await tapDirection('d',350);
  assert.deepEqual(gameState(await state()),gameState(first));
  await page.setViewportSize({width:844,height:390});
  for (const phase of [1,2]) {
    const before = await state();
    await page.keyboard.press('r');
    await until(s => !s.processing && s.turns===before.turns+1 && s.ferry.phase===phase,'渡船阶段未推进');
    await drain();
  }
  await touchVessel('ferry','examine dory');
  const boarded = await touchVessel('ferry','enter dory');
  assert.ok(boarded.ferry.onboard);
  assert.equal(boarded.room,'the_river');
  await shot('phone-dory-aboard');
  await page.keyboard.press('i');
  await page.getByRole('button',{name:'银币',exact:true}).click();
  const paid = await touchVessel('oarsman','give silver coin to oarsman');
  assert.equal(paid.room,'sand_bar');
  assert.equal(paid.navigation.arrival?.entrance,'ferry');
  assert.equal(paid.navigation.arrival?.fromRoom,'the_river');
  assert.ok(paid.ferry.crossed && !paid.ferry.legacyPaid);
  assert.ok(!paid.inventory.includes('silver_coin') && !paid.exits.some(exit => exit.dir==='out'));
  await shot('phone-sand-bar-arrival');
  await page.setViewportSize({width:1440,height:900});
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
  const {file} = await playedFerryCheckpoint({stage:'river',url,output});
  await page.goto(roadsOnly.href);
  await page.waitForFunction(() => window.render_game_to_text && JSON.parse(window.render_game_to_text()).art === 'loaded');
  await page.locator('#start').click();
  await importSave(file,'the_river');
  await crossFromRiver();
  const sandBarSave = await exportSave('sand-bar-paid-played.json');
  await walkRoad([[210, 255]], 's', 'islet', 'n');
  await goToSandBar();
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
  const west = await state();
  assert.equal(west.exits.find(exit => exit.dir === 'w')?.target, 'desert_4');
  assert.equal(west.boundaries.some(boundary => boundary.dir === 'w'), false);
  await shot('desert-west');
  await walkRoad([[426, 136]], 'd', 'shallow_crater', 'w');
  await goEastFromCrater();
  const east = await state();
  assert.equal(east.exits.find(exit => exit.dir === 'e')?.target, 'desert_7');
  assert.equal(east.boundaries.some(boundary => boundary.dir === 'e'), false);
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
  assert.equal(restored.routeMarker?.exit?.target, 'desert_7');
  await shot('desert-east-route-restored');
  await walkRoad([], 'd', 'desert_7', 'w');
  receipts.push({ case: 'main-route', source: '正常取得银币并付费到达沙洲的实玩进度' });

  await importSave(sandBarSave,'sand_bar');
  await approach('islet_gate', [174, 214], 'a');
  await pressF('look');
  const fromSandBar = await pressF('enter door', 'shallow_crater');
  assert.equal(fromSandBar.navigation.arrival?.fromRoom, 'sand_bar');
  assert.equal(fromSandBar.navigation.arrival?.entrance, 'door');

  if (process.env.PLAYED_LEGACY_SAND_BAR) {
    await importSave(process.env.PLAYED_LEGACY_SAND_BAR,'sand_bar');
    const old = await state();
    assert.equal(old.ferry.legacyPaid,true);
    await approach('islet_ferry',[245,154],'d');
    if (!old.observed.includes('sand_bar:ferry')) await pressF('examine dory');
    await pressF('out','the_river');
    receipts.push({case:'legacy-paid-return',source:'旧版本正式游玩导出'});
  }

  assert.deepEqual(errors, []);
  await writeFile(join(output, 'result.json'), `${JSON.stringify({ receipts, errors }, null, 2)}\n`);
  console.log('通过触摸登艇付费、沙洲与小岛、两侧白门、地图及沙漠续玩检查');
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
