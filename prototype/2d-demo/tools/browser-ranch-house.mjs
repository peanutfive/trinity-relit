import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { SCENES } from '../scene-manifest.js';
import { VISUAL_SAVE_KEY } from '../save.js';
import { testRanchFloorItems } from './browser-ranch-floor-items.mjs';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const url = process.env.DEMO_URL || 'http://127.0.0.1:8080/2d-demo/';
const output = process.env.QA_OUTPUT || join(tmpdir(), 'trinity-ranch-house');
const checkpointOnly = process.argv.includes('--checkpoint-only');
const southWingOnly = process.argv.includes('--south-wing-only');
const kitchen = process.argv.includes('--kitchen');
const kitchenOnly = process.argv.includes('--kitchen-only');
const icehouse = process.argv.includes('--icehouse');
const southeastRoom = process.argv.includes('--southeast-room');
const floorItems = process.argv.includes('--floor-items');
const prelude = join(output, 'normal-route');
const playedSave = process.env.PLAYED_RANCH_SAVE || join(prelude, 'windmill-normal-save.json');
await mkdir(output, { recursive: true });
if (!process.env.PLAYED_RANCH_SAVE) {
  const journey = fileURLToPath(new URL('./browser-ranch-journey.mjs', import.meta.url));
  await promisify(execFile)(process.execPath, [journey, '--windmill-checkpoint'], {
    env: { ...process.env, DEMO_URL: url, QA_OUTPUT: prelude },
  });
}
const saved = JSON.parse(await readFile(playedSave, 'utf8'));
assert.ok(['under_windmill', 'front_yard', 'ne_yard'].includes(saved.engine.state.room));
assert.equal(saved.engine.state.itemLoc.splinter, 'inventory');

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, hasTouch: true });
page.setDefaultTimeout(8000);
const errors = [], steps = [], animationFrames = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });

const state = () => page.evaluate(() => JSON.parse(window.render_game_to_text()));
const tick = ms => page.evaluate(value => window.advanceTime(value), ms);
const shot = name => page.screenshot({ path: join(output, `${name}.png`) });
const feet = ({ player }) => [player.x, player.y, player.facing];
const story = ({ room, turns, score, inventory, flags, observed }) => ({ room, turns, score, inventory, flags, observed });
const keys = { n: ['w'], ne: ['w', 'd'], e: ['d'], se: ['s', 'd'], s: ['s'], sw: ['s', 'a'], w: ['a'], nw: ['w', 'a'] };

async function until(predicate, description) {
  for (let step = 0; step < 160; step++) {
    const current = await state();
    if (predicate(current)) return current;
    await tick(70);
  }
  const { room, player, nearby, navigation, lastCommand, mode } = await state();
  throw Error(`${description}: ${JSON.stringify({ room, player, nearby, navigation, lastCommand, mode })}`);
}

async function drain() {
  for (let step = 0; step < 80; step++) {
    const current = await until(s => !s.processing, '操作未完成');
    if (current.narrative.busy) await tick(100);
    else if (current.mode === 'dialogue') await page.locator('#next').click();
    else return current;
  }
  throw Error('叙事未结束');
}

async function point([x, y], touch = false) {
  const canvas = await page.locator('canvas').boundingBox();
  assert.ok(canvas);
  const screen = [canvas.x + x * canvas.width / 480, canvas.y + y * canvas.height / 288];
  if (touch) await page.touchscreen.tap(...screen);
  else await page.mouse.click(...screen);
}

async function hold(directions, ms) {
  for (const key of directions) await page.keyboard.down(key);
  try { await tick(ms); }
  finally { for (const key of directions) await page.keyboard.up(key); }
}

async function walkUnderSign([x, y], room) {
  for (let step = 0; step < 120; step++) {
    const current = await state();
    assert.equal(current.room, room);
    const dx = x - current.player.x, dy = y - current.player.y;
    if (Math.hypot(dx, dy) < 5) return;
    const directions = [];
    if (Math.abs(dx) > 2.5) directions.push(dx > 0 ? 'd' : 'a');
    if (Math.abs(dy) > 2.5) directions.push(dy > 0 ? 's' : 'w');
    await hold(directions, 28);
  }
  throw Error(`无法步行到标识下方 ${x},${y}`);
}

async function walkTo([x, y]) {
  const before = await drain();
  const marker = before.routeMarker;
  if (marker?.exit && x >= marker.left && x <= marker.left + marker.width && y >= marker.top && y <= marker.top + marker.height)
    await walkUnderSign([x, y], before.room);
  else await point([x, y]);
  const after = await until(s => {
    assert.equal(s.room, before.room, `地面点 ${x},${y} 误触路口`);
    assert.equal(s.turns, before.turns, `地面点 ${x},${y} 误触交互`);
    return !s.processing && !s.navigation.path.length;
  }, `无法走到画面点 ${x},${y}`);
  assert.ok(Math.hypot(after.player.x - x, after.player.y - y) <= 7,
    `${before.room} 没有走到画面点 ${x},${y}，停在 ${feet(after)}`);
}

function checkArrival(before, after, target, command, entrance, { take, place, score = 0 } = {}) {
  assert.equal(after.room, target);
  assert.equal(after.chapter, 'ranch');
  assert.equal(after.lastCommand, command);
  assert.equal(after.turns, before.turns + 1);
  assert.equal(after.score, before.score + score);
  const expectedInventory = before.inventory.filter(id => id !== place);
  if (take) expectedInventory.push(take);
  assert.deepEqual(after.inventory.toSorted(), expectedInventory.toSorted());
  assert.equal(after.art, 'loaded');
  if (target !== before.room) {
    assert.equal(after.navigation.arrival?.fromRoom, before.room);
    if (entrance) {
      assert.equal(after.navigation.arrival?.entrance, entrance);
      assert.equal(after.navigation.arrival?.matched, true);
    }
    const authored = SCENES[target].sourceArrivals?.[before.room];
    if (authored) assert.deepEqual(feet(after), [Math.round(authored.x), Math.round(authored.y), authored.face]);
  }
}

async function road(dir, target, entrance, points, directions = keys[dir]) {
  const before = await drain();
  const route = before.exits.find(exit => exit.dir === dir);
  assert.equal(route?.target, target, `缺少 ${before.room}.${dir} 的路线`);
  assert.equal(Boolean(route.interactionOnly), false);
  for (const waypoint of points) await walkTo(waypoint);
  await tick(550);
  for (const key of directions) await page.keyboard.down(key);
  let after;
  try { after = await until(s => s.room !== before.room && !s.processing, `${before.room} 走 ${dir} 没有到 ${target}`); }
  finally { for (const key of directions) await page.keyboard.up(key); }
  checkArrival(before, after, target, dir, entrance);
  await drain();
  steps.push({ from: before.room, to: target, command: dir, input: 'walking', points, keys:directions,
    entrance, foot: feet(after), turn:after.turns });
}

async function action(command, target, { point: hitPoint, touch = false, entrance, label, screenshot, take, place, score, animation } = {}) {
  const before = await drain();
  assert.ok(before.objects.some(object => object.actions.some(action => action.command === command)),
    `${before.room} 缺少实际 ${command} 物件`);
  if (label) assert.equal(before.nearby, label);
  if (hitPoint) await point(hitPoint, touch);
  else await page.keyboard.press('f');
  const after = await until(s => !s.processing && s.turns > before.turns, `未执行 ${command}`);
  checkArrival(before, after, target, command, entrance, { take, place, score });
  const dialogue = after.dialogue?.text;
  if (animation) await captureStairs(animation);
  await drain();
  if (screenshot) await shot(screenshot);
  steps.push({ from: before.room, to: target, command, input: touch ? 'touch' : hitPoint ? 'click' : 'F',
    point: hitPoint, entrance, foot: feet(after), dialogue, take, place, score });
  return after;
}

async function captureStairs(name) {
  const mid = await until(s=>s.narrative.currentEvent==='ranch_cellar_stairs' && s.narrative.elapsed>=1.05,
    '未看到冰库楼梯中段');
  assert.equal(mid.narrative.sceneRoom,'icehouse');
  assert.ok(mid.narrative.elapsed<1.30);
  await shot(name);
  await page.keyboard.press('Escape');
  const paused = await until(s=>s.mode==='paused','演出没有暂停');
  await tick(2400);
  const frozen = await state();
  assert.equal(frozen.narrative.currentEvent,'ranch_cellar_stairs');
  assert.equal(frozen.narrative.elapsed,paused.narrative.elapsed);
  assert.deepEqual(story(frozen),story(mid));
  await page.keyboard.press('Escape');
  const resumed = await until(s=>s.narrative.elapsed>frozen.narrative.elapsed+0.05,'演出没有从中段继续');
  await drain();
  assert.deepEqual(story(await state()),story(mid));
  animationFrames.push({name,seconds:mid.narrative.elapsed,paused:paused.narrative.elapsed,
    frozen:frozen.narrative.elapsed,resumed:resumed.narrative.elapsed,turn:mid.turns,room:mid.narrative.sceneRoom});
}

async function touchRoad(dir, target, entrance, hitPoint) {
  const before = await drain();
  assert.equal(before.exits.find(exit => exit.dir === dir)?.target, target);
  await point(hitPoint, true);
  const after = await until(s => s.room !== before.room && !s.processing, `${before.room} 没能点过敞口 ${hitPoint}`);
  checkArrival(before, after, target, dir, entrance);
  await drain();
  steps.push({ from:before.room,to:target,command:dir,input:'touch opening',point:hitPoint,entrance,foot:feet(after) });
}

async function approach(label, directions, waypoint) {
  if (waypoint) await walkTo(waypoint);
  const room = (await state()).room;
  for (let step = 0; step < 42; step++) {
    await hold(directions, 25);
    const current = await state();
    assert.equal(current.room, room, `靠近 ${label} 时提前通过门洞`);
    if (current.nearby === label) return;
  }
  throw Error(`没有靠近 ${label}，停在 ${feet(await state())}`);
}

async function importPlayedProgress() {
  await page.goto(url);
  await page.waitForFunction(() => window.render_game_to_text && JSON.parse(window.render_game_to_text()).art === 'loaded');
  await page.locator('#start').click();
  await drain();
  await page.keyboard.press('Escape');
  await page.getByRole('tab', { name: '探索进度' }).click();
  await page.locator('#save-file').setInputFiles(playedSave);
  const current = await until(s => !s.processing && s.room === saved.engine.state.room, '正常实玩导出无法读取');
  assert.ok(current.inventory.includes('splinter'));
  assert.equal(current.turns, saved.engine.state.turns);
  await drain();
}

async function saveProgress(exportName) {
  const before = await drain();
  await page.keyboard.press('Escape');
  await page.getByRole('tab', { name: '探索进度' }).click();
  await page.locator('#save-now').click();
  const packet = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), VISUAL_SAVE_KEY);
  assert.equal(packet.engine.state.room, before.room);
  assert.equal(packet.engine.state.turns, before.turns);
  if (exportName) {
    const downloaded = page.waitForEvent('download');
    await page.locator('#export-save').click();
    await (await downloaded).saveAs(join(output, exportName));
    await page.keyboard.press('Escape');
  }
  return before;
}

async function reopen(screenshot) {
  const before = await saveProgress();
  await page.reload();
  await page.locator('#continue-save').click();
  await until(s => s.room === before.room && !s.processing && s.art === 'loaded', '没能继续实玩存档');
  const after = await drain();
  assert.deepEqual(story(after), story(before));
  assert.deepEqual(feet(after), feet(before));
  await shot(screenshot);
  steps.push({ action: 'save-reload', room: after.room, foot: feet(after) });
}

async function reachNorthYard() {
  if ((await state()).room === 'under_windmill') {
    await road('sw', 'south_reservoir', 'ne', [[143, 233], [120, 242], [87, 253]]);
    await road('nw', 'front_yard', 'se', [[298,145],[245,154],[180,164],[127,160],[100,143],[78,115],[61,84],[49,60],[37,47]]);
  }
  if ((await state()).room === 'front_yard') {
    await saveProgress('front-yard-played.json');
    await approach('上坡', ['a'], [204, 125]);
    await action('w', 'front_deck', { entrance: 'e', label: '上坡' });
    await road('n', 'ne_yard', 's', [[194, 42]]);
  }
  assert.equal((await state()).room, 'ne_yard');
  if (checkpointOnly) await saveProgress('north-yard-played.json');
  await shot('north-yard-arrival');
}

const outsideDoor = { noun: 'outside door', flag: 'ne_yard_outside_door_open', label: '外门' };
const southGate = { noun: 'iron gate', flag: 'sw_yard_iron_gate_open', label: '铁门' };
const northGate = { noun: 'iron gate', flag: 'back_yard_iron_gate_open', label: '铁门' };
const screenDoor = { noun: 'screen door', flag: 'back_yard_screen_door_open', label: '纱门' };
const kitchenDoor = { noun: 'outer door', flag: 'hallway_outer_door_open', label: '外门' };
const deckLeftDoor = { noun: 'left door', flag: 'front_deck_left_door_open', label: '左门' };
const roomFrontDoor = { noun: 'front door', flag: deckLeftDoor.flag, label: '前门' };
const rightDeckFlag = 'front_deck_right_door_open';

function doorHandle(current, { noun }, open) {
  const command = `${open ? 'close' : 'open'} ${noun}`;
  return current.objects.find(object => object.actions.some(action => action.command === command));
}

async function toggleDoor(door, opening, options = {}) {
  const before = await drain();
  assert.equal(before.flags.includes(door.flag), !opening);
  assert.ok(doorHandle(before, door, !opening), `${before.room} 缺门扇物件`);
  const verb = opening ? 'open' : 'close';
  const after = await action(`${verb} ${door.noun}`, before.room,
    options.point ? options : { ...options, label: door.label });
  assert.equal(after.flags.includes(door.flag), opening);
  assert.ok(doorHandle(after, door, opening));
  return after;
}

async function staysPut(directions, { route, target, point: ground, label, picture, stop } = {}) {
  if (ground) await walkTo(ground);
  const before = await drain();
  if (route && target) assert.equal(before.exits.some(exit => exit.dir === route && exit.target === target), false);
  await hold(directions, 840);
  const after = await drain();
  assert.deepEqual(story(after), story(before), `按 ${directions.join('+')} 误触 ${label || route || '边界'}`);
  if (stop) {
    assert.ok(Math.hypot(after.player.x - before.player.x, after.player.y - before.player.y) > 6, '未实际走向门扇');
    assert.ok(stop(after.player), `脚底越过关闭的门扇 ${feet(after)}`);
  }
  steps.push({ command:'blocked-movement', room:before.room, keys:directions, label, from:feet(before), stopped:feet(after) });
  if (picture) await shot(picture);
}

async function checkMap(chapter, required, connections, screenshot, { concealed = [], concealedConnections = [], closed, stairway } = {}) {
  const before = await drain();
  await page.keyboard.press('m');
  const active = await until(s => s.mode === 'map', '未打开探索地图');
  assert.equal(active.map.chapter, chapter);
  assert.equal(active.map.selected, before.room);
  const map = page.locator('.chapter-map');
  const nodes = await map.locator('[data-room-id]').evaluateAll(items => items.map(item => item.dataset.roomId));
  for (const id of required) assert.ok(nodes.includes(id), `地图丢失已探索节点 ${id}`);
  for (const id of concealed) assert.ok(!nodes.includes(id), `地图提前显示未走过的地点 ${id}`);
  const seen = await map.locator('[data-from][data-to]').evaluateAll(routes =>
    routes.map(item => [item.dataset.from, item.dataset.to].sort().join('|')));
  for (const pair of connections) assert.ok(seen.includes(pair.toSorted().join('|')), `地图丢失连线 ${pair.join('、')}`);
  for (const pair of concealedConnections)
    assert.ok(!seen.includes(pair.toSorted().join('|')), `地图提前显示未走过的门 ${pair.join('、')}`);
  if (closed !== undefined) {
    const detail = await map.locator('.map-route-summary').textContent();
    assert.equal(detail.includes('门已关'), closed, `地图闭门提示与 ${before.room} 的实走进度不符`);
  }
  if (stairway) {
    const stairs = await map.locator('.map-stairway').evaluateAll(items => items.map(item=>[item.dataset.from,item.dataset.to].sort()));
    assert.equal(stairs.filter(pair=>pair.join('|')===stairway.toSorted().join('|')).length,1);
  }
  await shot(screenshot);
  await page.keyboard.press('m');
  assert.deepEqual(story(await state()), story(before));
  steps.push({ command:'map', room:before.room, required, connections, concealed, concealedConnections, closed, stairway });
}

async function testBedroom() {
  await staysPut(['a'], { point:[124,170], route:'w', target:'bedroom', label:'东北院外门关闭',
    picture:'north-door-closed',stop:player=>player.x>=100 });
  await checkMap('ranch', ['ne_yard'], [], 'north-unvisited-door-map', { concealed:['bedroom'],closed:false });
  await approach(outsideDoor.label, ['a'], [134,165]);
  await toggleDoor(outsideDoor, true, { screenshot:'north-door-open' });

  await page.setViewportSize({ width:390,height:844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await toggleDoor(outsideDoor, false, { point:[100,143],touch:true,screenshot:'phone-door-leaf' });
  await toggleDoor(outsideDoor, true, { point:[90,150],touch:true });
  await action('w', 'bedroom', { point:[88,144],touch:true,entrance:'e',screenshot:'phone-doorway-entry' });
  await page.setViewportSize({ width:1440,height:900 });
  await shot('bedroom-entry');
  await action('examine corner', 'bedroom', { point:[121,87],screenshot:'bedroom-mattress-mark' });

  await approach(outsideDoor.label, ['d'], [385,177]);
  await toggleDoor(outsideDoor, false, { screenshot:'bedroom-closed' });
  await reopen('bedroom-closed-reopened');
  await checkMap('ranch', ['bedroom','ne_yard'], [['bedroom','ne_yard']], 'bedroom-closed-door-map', { closed:true });
  await staysPut(['d'], { point:[408,156],route:'e',target:'ne_yard',label:'卧室外门关闭',stop:player=>player.x<=431 });
  await approach(outsideDoor.label, ['d'], [385,155]);
  await toggleDoor(outsideDoor, true, { screenshot:'bedroom-open' });
  await road('e', 'ne_yard', 'w', [[410,154]]);
  assert.ok((await state()).flags.includes(outsideDoor.flag));
  await staysPut(['d'], { label:'离开门洞的反向移动' });
  await checkMap('ranch', ['front_yard','front_deck','ne_yard','bedroom'],
    [['front_deck','ne_yard'],['ne_yard','bedroom']], 'bedroom-map');
}

async function walkToSouthwestYard() {
  await road('s', 'front_deck', 'n', [[183,244]]);
  await road('s', 'se_yard', 'n', [[155,244]]);
  await road('w', 'sw_yard', 'e', [[43,144]]);
}

async function testSouthGate() {
  await walkToSouthwestYard();
  await shot('southwest-yard-entry');
  await staysPut(['a'], { label:'刚从东南院进西南院时继续向西' });
  await road('e', 'se_yard', 'w', [[437,96]]);
  await road('w', 'sw_yard', 'e', [[43,144]]);

  await road('n', 'hallway', 's', [[205,111],[201,78]]);
  await shot('hallway-from-yard');
  await reopen('hallway-reopened');
  await road('s', 'sw_yard', 'n', [[235,242]]);

  await staysPut(['s','a'], { point:[128,178],route:'sw',target:'sw_ranch',label:'院内铁门关闭',
    picture:'south-gate-inside-closed',stop:player=>player.y<=208 });
  await approach(southGate.label, ['s','a'], [133,166]);
  await toggleDoor(southGate, true, { screenshot:'south-gate-inside-open' });
  await road('sw', 'sw_ranch', 'ne', [[126,183]]);

  await approach(southGate.label, ['w','d'], [209,128]);
  await toggleDoor(southGate, false, { screenshot:'south-gate-outside-closed' });
  await reopen('south-gate-outside-reopened');
  await checkMap('ranch', ['sw_ranch','sw_yard'], [['sw_ranch','sw_yard']], 'south-closed-gate-map', { closed:true });
  await staysPut(['w','d'], { route:'ne',target:'sw_yard',label:'院外铁门关闭',stop:player=>player.x<=238 });
  await approach(southGate.label, ['w','d'], [211,130]);
  await toggleDoor(southGate, true, { screenshot:'south-gate-outside-open' });
  await road('ne', 'sw_yard', 'sw', [[220,126]]);
  assert.ok((await state()).flags.includes(southGate.flag));
  await checkMap('ranch', ['se_yard','sw_yard','sw_ranch','hallway','bedroom'],
    [['se_yard','sw_yard'],['sw_ranch','sw_yard'],['sw_yard','hallway']], 'south-gate-map');
}

async function testWideHallway() {
  await road('n', 'hallway', 's', [[205,111],[201,78]]);
  await road('n', 'back_yard', 's', [[197,58]]);
  await shot('back-yard-entry');
  await road('s', 'hallway', 'n', [[279,239]]);
  await road('n', 'back_yard', 's', [[275,57]]);
  await page.setViewportSize({ width:390,height:844 });
  await touchRoad('s', 'hallway', 'n', [187,272]);
  await page.setViewportSize({ width:1440,height:900 });
  await road('n', 'back_yard', 's', [[237,55]]);
}

async function testNorthGate() {
  await staysPut(['w','a'], { point:[117,88],route:'nw',target:'nw_ranch',label:'后院铁门关闭' });
  await approach(northGate.label, ['w','a'], [129,96]);
  await toggleDoor(northGate, true, { screenshot:'northwest-gate-from-yard' });
  await road('nw', 'nw_ranch', 'se', [[115,83]]);
  const gateArrival = await state();
  assert.deepEqual(feet(gateArrival), [200,110,'left']);
  await walkUnderSign([209,124], 'nw_ranch');
  const atEntrance = await state();
  assert.equal(atEntrance.turns, gateArrival.turns);
  const sign = atEntrance.routeMarker;
  assert.equal(sign?.exit?.dir, 'se');
  for (const object of atEntrance.objects.filter(object=>object.label==='铁门')) {
    const points = object.pointerShape.points;
    const xs = points.map(([x])=>x), ys = points.map(([,y])=>y);
    assert.ok(sign.left + sign.width <= Math.min(...xs) || sign.left >= Math.max(...xs)
      || sign.top + sign.height <= Math.min(...ys) || sign.top >= Math.max(...ys), '路牌挡住西北门扇或门洞');
  }
  steps.push({ command:'direct-gate-approach', room:atEntrance.room, from:feet(gateArrival), to:feet(atEntrance), sign });
  await shot('northwest-gate-clear');
  await approach(northGate.label, ['d'], [207,101]);
  let closed = await toggleDoor(northGate, false, { screenshot:'northwest-gate-outside-closed' });
  assert.ok(closed.flags.includes(screenDoor.flag));
  await reopen('northwest-gate-reopened');
  await checkMap('ranch', ['nw_ranch','back_yard'], [['nw_ranch','back_yard']], 'northwest-closed-gate-map', { closed:true });
  await staysPut(['s','d'], { route:'se',target:'back_yard',label:'西北外围铁门关闭' });
  await approach(northGate.label, ['s','d'], [209,124]);
  await toggleDoor(northGate, true, { screenshot:'northwest-gate-from-outside' });
  await road('se', 'back_yard', 'nw', [[210,123]]);
  const current = await state();
  assert.ok(current.flags.includes(northGate.flag) && current.flags.includes(screenDoor.flag));
}

async function testRearRooms() {
  await testWideHallway();
  const initial = await state();
  assert.equal(initial.flags.includes(northGate.flag), false);
  assert.equal(initial.flags.includes(screenDoor.flag), false);
  await checkMap('ranch', ['nw_ranch','back_yard'], [], 'northwest-gate-never-crossed-map',
    { concealedConnections:[['nw_ranch','back_yard']],closed:false });
  await approach(screenDoor.label, ['d'], [365,160]);
  const opened = await toggleDoor(screenDoor, true, { screenshot:'back-yard-screen-open' });
  assert.equal(opened.flags.includes(northGate.flag), false);
  await reopen('back-yard-screen-reopened');
  await testNorthGate();

  await road('e', 'spare_room', 'w', [[377,155]]);
  await shot('spare-room-entry');
  await action('examine map', 'spare_room', { point:[322,31],screenshot:'spare-room-chart' });
  const fixed = await action('take map', 'spare_room', { point:[322,31] });
  assert.match(fixed.dialogue?.text, /墙上/);
  assert.ok(fixed.objects.some(object => object.id === 'spare_room:wall-map' && !object.itemId));

  await page.setViewportSize({ width:390,height:844 });
  const closed = await toggleDoor(screenDoor, false, { point:[65,152],touch:true,screenshot:'spare-room-screen-closed' });
  await page.setViewportSize({ width:1440,height:900 });
  assert.ok(closed.flags.includes(northGate.flag));
  await reopen('spare-room-screen-reopened');
  await staysPut(['a'], { point:[77,163],route:'w',target:'back_yard',label:'备用间纱门关闭' });
  await approach(screenDoor.label, ['a'], [100,163]);
  await toggleDoor(screenDoor, true);
  await road('w', 'back_yard', 'e', [[81,164]]);
  await page.setViewportSize({ width:390,height:844 });
  await action('e', 'spare_room', { point:[409,145],touch:true,entrance:'w',screenshot:'phone-open-screen-entry' });
  await page.setViewportSize({ width:1440,height:900 });
  await road('e', 'bedroom', 'w', [[392,148]]);
  await road('w', 'spare_room', 'e', [[69,155]]);
  await road('e', 'bedroom', 'w', [[392,148]]);
  await road('e', 'ne_yard', 'w', [[410,154]]);

  await checkMap('ranch', ['front_deck','ne_yard','bedroom','se_yard','sw_yard','hallway','back_yard','spare_room','nw_ranch'],
    [['front_deck','ne_yard'],['ne_yard','bedroom'],['front_deck','se_yard'],['se_yard','sw_yard'],
      ['sw_yard','hallway'],['hallway','back_yard'],['back_yard','spare_room'],['spare_room','bedroom'],['back_yard','nw_ranch']],
    'house-complete-loop-map');
}

async function walkToHallway() {
  await walkToSouthwestYard();
  await road('n', 'hallway', 's', [[205,111],[201,78]]);
}

async function testKitchenDoor() {
  await walkToHallway();
  await staysPut(['d'], { point:[286,172],route:'e',target:'kitchen',label:'短廊外门关闭' });
  await checkMap('ranch', ['hallway'], [], 'kitchen-unvisited-map', { concealed:['kitchen'],closed:false });
  await approach(kitchenDoor.label, ['d'], [276,171]);
  await toggleDoor(kitchenDoor, true, { screenshot:'hallway-kitchen-door-open' });

  await page.setViewportSize({ width:390,height:844 });
  await toggleDoor(kitchenDoor, false, { point:[307,150],touch:true,screenshot:'phone-kitchen-door-leaf' });
  await toggleDoor(kitchenDoor, true, { point:[320,154],touch:true });
  await action('e', 'kitchen', { point:[320,154],touch:true,entrance:'w',screenshot:'phone-kitchen-doorway' });
  await page.setViewportSize({ width:1440,height:900 });
  await shot('kitchen-entry');

  await approach(kitchenDoor.label, ['a'], [102,163]);
  await toggleDoor(kitchenDoor, false, { screenshot:'inside-kitchen-door-closed' });
  await reopen('kitchen-door-closed-reopened');
  await checkMap('ranch', ['hallway','kitchen'], [['hallway','kitchen']], 'kitchen-closed-door-map', { closed:true });
  await staysPut(['a'], { point:[86,185],route:'w',target:'hallway',label:'厨房外门关闭' });
  await approach(kitchenDoor.label, ['a'], [102,184]);
  await toggleDoor(kitchenDoor, true);
}

async function holdInventoryItem(id, label) {
  await drain();
  await page.keyboard.press('i');
  await page.locator('#choices').getByRole('button', { name:label, exact:true }).click();
  assert.equal((await state()).heldItem, id);
}

function shelfPoint(current, itemId) {
  const item = current.objects.find(object=>object.itemId===itemId && object.visualOptions?.onShelf);
  assert.ok(item, `敞柜没有显示 ${itemId}`);
  return [item.pointerShape.x,item.pointerShape.y];
}

async function testCupboard() {
  const before = await drain();
  assert.ok(before.objects.some(object=>object.kind==='ranch_cupboard'));
  assert.ok(before.objects.some(object=>object.itemId==='knife'));
  const cabinetPoint = [287,55];
  await approach('橱柜', ['w'], [287,124]);
  const cupboard = await action('examine cupboard', 'kitchen', { label:'橱柜',screenshot:'kitchen-cupboard' });
  assert.match(cupboard.dialogue?.text, /牛排刀/);

  await page.setViewportSize({ width:390,height:844 });
  await action('take knife from cupboard','kitchen', {
    point:shelfPoint(cupboard,'knife'),touch:true,take:'knife',score:1,screenshot:'phone-take-knife',
  });
  await page.setViewportSize({ width:1440,height:900 });
  await reopen('knife-inventory-reopened');
  await holdInventoryItem('knife', '刀');
  await action('put knife in cupboard','kitchen', { point:cabinetPoint,place:'knife',screenshot:'knife-returned' });
  await holdInventoryItem('splinter', '木片');
  const bothStored = await action('put splinter in cupboard','kitchen', { point:cabinetPoint,place:'splinter' });
  await reopen('knife-cupboard-reopened');
  const both = await action('examine cupboard','kitchen', { point:cabinetPoint,screenshot:'cupboard-two-items' });
  assert.match(both.dialogue?.text, /牛排刀/);
  assert.match(both.dialogue?.text, /木片/);
  for (const id of ['knife','splinter']) assert.deepEqual(shelfPoint(both,id),shelfPoint(bothStored,id));
  const wood = await action('take splinter from cupboard','kitchen', { point:shelfPoint(both,'splinter'),take:'splinter' });
  assert.deepEqual(shelfPoint(wood,'knife'),shelfPoint(both,'knife'));
  await action('take knife from cupboard','kitchen', { point:shelfPoint(wood,'knife'),take:'knife' });
  await reopen('knife-retaken-reopened');
  await page.keyboard.press('i');
  assert.equal(await page.locator('#choices').getByRole('button', { name:'刀', exact:true }).count(), 1);
  await page.keyboard.press('i');
  await drain();
}

async function testNorthRooms() {
  await road('n','nw_room','s', [[225,103]]);
  await shot('northwest-room-from-kitchen');
  await road('n','spare_room','s', [[232,85]]);
  await road('n','bathroom','s', [[228,75]]);
  await shot('bathroom-from-spare-room');
  await action('examine sink','bathroom', { point:[199,80],screenshot:'bathroom-sink' });
  const fixed = await action('take sink','bathroom', { point:[199,80] });
  assert.match(fixed.dialogue?.text, /固定|墙/);
  await reopen('bathroom-reopened');
  await road('s','spare_room','n', [[236,213]]);
  await road('s','nw_room','n', [[230,241]]);
  await road('s','kitchen','n', [[229,225]]);
  await checkMap('ranch', ['hallway','kitchen','nw_room','spare_room','bathroom'],
    [['hallway','kitchen'],['kitchen','nw_room'],['nw_room','spare_room'],['spare_room','bathroom']], 'kitchen-north-map');
}

async function testKitchenWing() {
  await testKitchenDoor();
  await testCupboard();
  if (!kitchenOnly) await testNorthRooms();
  await road('w','hallway','e', [[87,185]]);
  assert.ok((await state()).inventory.includes('knife'));
  await shot('hallway-return-with-knife');
}

async function checkOtherDeckDoor() {
  const before = await drain();
  assert.equal(before.room,'front_deck');
  assert.ok(before.flags.includes(deckLeftDoor.flag));
  assert.ok(!before.flags.includes(rightDeckFlag));
  assert.ok(!before.exits.some(exit=>['w','in'].includes(exit.dir)));
  const right = [101,85];
  await point(right,true);
  await until(s=>!s.processing&&!s.navigation.path.length,'点击右门后未结算');
  await tick(180);
  const after = await drain();
  assert.deepEqual(story(after),story(before),'点右门改动了左门或故事状态');
  steps.push({from:before.room,to:after.room,command:'right-door-touch',input:'touch',point:right,foot:feet(after)});
  await shot('phone-right-door-untouched');
}

async function checkRoomDoorOcclusion() {
  const before = await drain();
  await walkUnderSign([416,137],'se_room');
  for (let step = 0; step < 16; step++) {
    const current = await state();
    assert.equal(current.room,'se_room');
    if (current.player.x >= 430) break;
    await hold(['s','d'],20);
  }
  assert.ok((await state()).player.x >= 430);
  for (let step = 0; step < 16 && (await state()).player.y < 174; step++) await hold(['s'],20);
  const behind = await drain();
  assert.ok(behind.player.y >= 174 && behind.player.y < 188);
  assert.deepEqual(story(behind),story(before));
  await shot('room-open-leaf-behind-player-view');
  for (const point of [[410,181],[409,203],[433,198]]) await walkUnderSign(point,'se_room');
  const inFront = await drain();
  assert.deepEqual(story(inFront),story(before));
  await shot('room-open-leaf-in-front-player-view');
  steps.push({command:'open-leaf-depth',room:'se_room',behind:feet(behind),inFront:feet(inFront)});
}

async function testSoutheastRoom() {
  await testKitchenDoor();
  await checkMap('ranch',['hallway','kitchen','front_deck'],[],'southeast-room-unvisited-map', {concealed:['se_room']});
  await road('e','se_room','w',[[401,158]]);
  await shot('southeast-room-from-kitchen');
  await page.setViewportSize({width:390,height:844});
  await touchRoad('w','kitchen','e',[32,131]);
  await touchRoad('e','se_room','w',[437,128]);
  await page.setViewportSize({width:1440,height:900});

  await staysPut(['d'], {point:[398,175],route:'e',target:'front_deck',label:'东南房间前门关闭'});
  await approach(roomFrontDoor.label,['d'],[386,176]);
  await toggleDoor(roomFrontDoor,true,{screenshot:'southeast-room-front-door-open'});
  await checkRoomDoorOcclusion();
  await road('e','front_deck','sw',[[400,175]]);
  await shot('front-deck-from-southeast-room');
  assert.ok(doorHandle(await state(),deckLeftDoor,true));

  await page.setViewportSize({width:390,height:844});
  await checkOtherDeckDoor();
  await toggleDoor(deckLeftDoor,false,{point:[68,199],touch:true,screenshot:'phone-front-deck-left-leaf'});
  await page.setViewportSize({width:1440,height:900});
  await reopen('front-deck-left-closed-reopened');
  let latest = await state();
  assert.equal(latest.flags.includes(rightDeckFlag),false);
  await checkMap('ranch',['front_deck','se_room'],[['front_deck','se_room']], 'front-deck-left-closed-map', {closed:true,concealed:['assembly_room']});
  await staysPut(['s','a'], {point:[109,190],route:'sw',target:'se_room',label:'前廊左门关闭'});
  await approach(deckLeftDoor.label,['a'],[118,211]);
  await toggleDoor(deckLeftDoor,true,{screenshot:'front-deck-left-open'});

  await page.setViewportSize({width:390,height:844});
  await action('sw','se_room',{point:[78,190],touch:true,entrance:'e',screenshot:'phone-southeast-room-doorway'});
  await page.setViewportSize({width:1440,height:900});
  latest = await state();
  assert.ok(latest.flags.includes(roomFrontDoor.flag));
  assert.equal(latest.flags.includes(rightDeckFlag),false);
  assert.ok(doorHandle(latest,roomFrontDoor,true));
  await reopen('southeast-room-reopened');
  await page.setViewportSize({width:390,height:844});
  await toggleDoor(roomFrontDoor,false,{point:[435,165],touch:true,screenshot:'phone-room-front-door-leaf'});
  await page.setViewportSize({width:1440,height:900});
  await approach(roomFrontDoor.label,['d'],[386,176]);
  await toggleDoor(roomFrontDoor,true);
  await road('w','kitchen','e',[[82,163]]);
  await road('e','se_room','w',[[401,158]]);
  await page.setViewportSize({width:390,height:844});
  await action('e','front_deck',{point:[437,141],touch:true,entrance:'sw',screenshot:'phone-room-front-doorway-return'});
  await page.setViewportSize({width:1440,height:900});
  await checkMap('ranch',['front_deck','se_room','kitchen','hallway'],
    [['front_deck','se_room'],['se_room','kitchen'],['kitchen','hallway']], 'southeast-room-loop-map', {concealed:['assembly_room']});
}

function staircase(current, target) {
  const exits = current.exits.filter(exit=>exit.target===target);
  assert.equal(exits.length,1,'同一楼梯只显示一个出口');
  assert.equal(exits[0].interactionOnly,true);
  const passage = current.objects.filter(object=>object.actions.some(action=>action.command===exits[0].dir));
  assert.equal(passage.length,1,'同一楼梯只应有一个互动');
  return { exit:exits[0], object:passage[0] };
}

async function dropWoodBeforeStairs() {
  const before = await drain();
  await holdInventoryItem('splinter','木片');
  await page.keyboard.press('i');
  await page.locator('#inventory-drop').click();
  const after = await until(s=>!s.processing && s.lastCommand==='drop splinter' && s.turns>before.turns,'走廊没有放下木片');
  checkArrival(before,after,'hallway','drop splinter',null,{place:'splinter'});
  assert.ok(after.objects.some(object=>object.itemId==='splinter'));
  await drain();
  steps.push({ command:'drop splinter',room:'hallway',input:'inventory menu',turn:after.turns });
}

async function testIcehouse() {
  await walkToHallway();
  await saveProgress('hallway-played.json');
  await checkMap('ranch', ['hallway'], [], 'icehouse-unvisited-map', {concealed:['icehouse']});
  await dropWoodBeforeStairs();
  await staysPut(['a'], {point:[168,177],label:'走到西阶不会自行下楼'});
  const down = staircase(await state(),'icehouse');
  await approach(down.object.label,['a'],[172,178]);
  const arrival = await action(down.exit.dir,'icehouse',{
    label:down.object.label,entrance:SCENES.icehouse.sourceArrivals.hallway.entrance,screenshot:'icehouse-without-wood',
    animation:'icehouse-down-mid-stair',
  });
  assert.ok(!arrival.inventory.includes('splinter')&&!arrival.inventory.includes('lantern'));
  assert.ok(arrival.objects.every(object=>!object.itemId));
  const wall = await action('touch wall','icehouse',{point:[110,61],screenshot:'icehouse-wall-left'});
  assert.match(wall.dialogue?.text,/冰凉|潮湿/);
  assert.ok(wall.player.x>=85 && wall.player.x<=132,`墙面偏左触点没有带角色走到同侧 ${feet(wall)}`);
  await reopen('icehouse-reopened');
  await checkMap('ranch', ['hallway','icehouse'], [['hallway','icehouse']], 'icehouse-stairs-map', {stairway:['hallway','icehouse']});

  const up = staircase(await state(),'hallway');
  await page.setViewportSize({width:390,height:844});
  await action(up.exit.dir,'hallway',{point:[376,132],touch:true,entrance:'w',screenshot:'phone-icehouse-return'});
  assert.ok((await state()).objects.some(object=>object.itemId==='splinter'));
  await action(down.exit.dir,'icehouse',{
    point:[120,178],touch:true,entrance:SCENES.icehouse.sourceArrivals.hallway.entrance,screenshot:'phone-icehouse-entry',
  });
  await page.setViewportSize({width:1440,height:900});
  await approach(up.object.label,['d'],[316,153]);
  await action(up.exit.dir,'hallway',{label:up.object.label,entrance:'w',animation:'icehouse-up-mid-stair'});

  const item = (await state()).objects.find(object=>object.itemId==='splinter');
  assert.ok(item);
  const itemPoint = [item.pointerShape.x,item.pointerShape.y];
  if (!(await state()).observed.includes(item.id)) await action('examine splinter','hallway',{point:itemPoint});
  await action('take splinter','hallway',{point:itemPoint,take:'splinter'});
  await reopen('hallway-reopened-after-icehouse');
}

try {
  await importPlayedProgress();
  await reachNorthYard();
  if (!checkpointOnly) {
    if (floorItems) {
      await testKitchenDoor();
      await testRanchFloorItems({ page,state,until,drain,shot,steps,feet,checkArrival,walkTo,road,action,reopen,
        holdInventoryItem,shelfPoint });
    }
    else if (southeastRoom) await testSoutheastRoom();
    else if (icehouse) await testIcehouse();
    else if (kitchen || kitchenOnly) await testKitchenWing();
    else {
      await testBedroom();
      await testSouthGate();
      if (!southWingOnly) await testRearRooms();
    }
  }
  assert.deepEqual(errors, []);
  await writeFile(join(output, 'result.json'), `${JSON.stringify({ source: saved.engine.state.room,
    sourceTurn:saved.engine.state.turns, steps, animationFrames, errors }, null, 2)}\n`);
  if (checkpointOnly) console.log('经正式道路和坡道到达东北院');
  else if (floorItems) console.log('两间屋内地面拾放、往返刷新与同位置触摸拾取通过');
  else if (southeastRoom) console.log('东南房间双向通行、前廊左门和触摸命中通过');
  else if (icehouse) console.log('短廊西阶、暗处无木片、手机上下楼、地图与刷档通过');
  else if (kitchen || kitchenOnly) console.log('厨房外门、敞柜、北侧房间、触摸与存档通过');
  else console.log('牧场双侧门、触摸门洞、走廊、刷新与地图通过');
} catch (error) {
  await shot('failure').catch(() => {});
  await writeFile(join(output, 'failure.json'), `${JSON.stringify({ message: error.message,
    current: await state().catch(() => null), steps, animationFrames, errors }, null, 2)}\n`);
  throw error;
} finally {
  await browser.close();
}
