// Browser QA from normal 2D progress. Preserve the exact save files supplied.
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
const output = process.env.QA_OUTPUT || join(tmpdir(), 'trinity-ranch-closet');
const checkpointOnly = process.argv.includes('--checkpoints-only');
const prior = process.env.PLAYED_RANCH_SAVE;
const legacy = process.env.LEGACY_RANCH_HALLWAY_SAVE;
const upstream = join(output, 'normal-route');
const source = prior || join(upstream, 'windmill-normal-save.json');
await mkdir(output, { recursive: true });
if (!prior) {
  const script = fileURLToPath(new URL('./browser-ranch-journey.mjs', import.meta.url));
  await promisify(execFile)(process.execPath, [script, '--windmill-checkpoint'], {
    env: { ...process.env, DEMO_URL: url, QA_OUTPUT: upstream },
  });
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, hasTouch: true });
page.setDefaultTimeout(8000);
const steps = [];
const errors = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
page.on('response', res => { if (res.status() >= 400) errors.push(`${res.status()} ${res.url()}`); });

const state = () => page.evaluate(() => JSON.parse(window.render_game_to_text()));
const tick = ms => page.evaluate(ms => window.advanceTime(ms), ms);
const shot = label => page.screenshot({ path: join(output, label + '.png') });
const feet = s => [s.player.x, s.player.y, s.player.facing];
const passageKeys = { n: ['w'], nw: ['w','a'], w: ['a'], s: ['s'], sw: ['s','a'], e: ['d'] };
const flag = (s, id) => s.flags.includes(id);
const route = (s, dir) => s.exits.find(exit => exit.dir === dir);
const object = (s, id) => s.objects.find(hit => hit.id === id);
const story = ({ room, turns, inventory, score, flags, dead }) => ({ room, turns, inventory, score, flags, dead });
const setView = touch => page.setViewportSize(touch ? { width: 390, height: 844 } : { width: 1440, height: 900 });

async function until(predicate, reason) {
  for (let attempt = 0; attempt < 170; attempt++) {
    const s = await state();
    if (predicate(s)) return s;
    await tick(75);
  }
  const s = await state();
  throw Error(`${reason}: ${s.room}, ${feet(s)}, ${s.lastCommand}, ${JSON.stringify(s.navigation)}`);
}

async function drain() {
  const pages = [];
  for (let count = 0; count < 70; count++) {
    const s = await until(s => !s.processing, '等待动作');
    if (s.narrative.busy) await tick(95);
    else if (s.mode === 'dialogue') {
      if (s.dialogue?.text) pages.push(s.dialogue.text);
      await page.locator('#next').click();
    } else return { current: s, pages };
  }
  throw Error('未能读完叙事');
}

async function click(point, touch = false) {
  const box = await page.locator('canvas').boundingBox();
  assert.ok(box);
  const screen = [box.x + point[0] * box.width / 480, box.y + point[1] * box.height / 288];
  if (touch) await page.touchscreen.tap(...screen);
  else await page.mouse.click(...screen);
}

async function hold(keys, time) {
  for (const key of keys) await page.keyboard.down(key);
  try { await tick(time); }
  finally { for (const key of keys) await page.keyboard.up(key); }
}

async function walkWithKeys(point, room) {
  for (let step = 0; step < 100; step++) {
    const s = await state();
    assert.equal(s.room, room);
    const dx = point[0] - s.player.x, dy = point[1] - s.player.y;
    if (Math.hypot(dx, dy) < 5) return;
    const keys = [];
    if (Math.abs(dx) > 2) keys.push(dx > 0 ? 'd' : 'a');
    if (Math.abs(dy) > 2) keys.push(dy > 0 ? 's' : 'w');
    await hold(keys, 25);
  }
  throw Error(`步行无法走到 ${point}`);
}

async function moveTo(point, useKeys = false) {
  const { current: before } = await drain();
  const marker = before.routeMarker;
  const behindSign = marker?.exit && point[0] >= marker.left && point[0] <= marker.left + marker.width
    && point[1] >= marker.top && point[1] <= marker.top + marker.height;
  if (useKeys || behindSign) await walkWithKeys(point, before.room);
  else await click(point);
  const after = await until(s => !s.processing && !s.navigation.path.length, `步行至 ${point}`);
  assert.deepEqual(story(after), story(before), `步行至 ${point} 不应换房或消耗回合`);
  assert.ok(Math.hypot(after.player.x - point[0], after.player.y - point[1]) < 7,
    `实际脚点 ${feet(after)} 距离地面点 ${point} 太远`);
}

function assertInput(before, after, command, destination, arrival) {
  assert.equal(after.lastCommand, command);
  assert.equal(after.room, destination);
  assert.equal(after.score, before.score);
  assert.deepEqual(after.inventory, before.inventory);
  assert.equal(after.turns, before.turns + 1);
  if (before.room !== destination) {
    assert.equal(after.art, 'loaded');
    assert.equal(after.navigation.arrival?.fromRoom, before.room);
    assert.equal(after.navigation.arrival?.entrance, arrival);
    assert.equal(after.navigation.arrival?.matched, true);
  }
}

async function act(command, destination, { hit, touch, arrival, screenshot, dead = false } = {}) {
  const { current: before } = await drain();
  assert.ok(before.objects.some(o => o.actions.some(a => a.command === command)),
    `${before.room} 缺少可见动作 ${command}`);
  if (hit) await click(hit, touch);
  else await page.keyboard.press('f');
  const after = await until(s => !s.processing && s.turns > before.turns, `未执行 ${command}`);
  assertInput(before, after, command, destination, arrival);
  assert.equal(after.dead, dead);
  if (screenshot) await shot(screenshot);
  const { current, pages } = await drain();
  steps.push({ input: hit ? (touch ? 'touch' : 'click') : 'F', command, from: before.room,
    to: current.room, foot: feet(after), turns: [before.turns, after.turns], pages: pages.length });
  return { current, pages };
}

async function road(dir, destination, arrival, waypoints = [], keys = passageKeys[dir]) {
  const { current: before } = await drain();
  const exit = route(before, dir);
  assert.equal(exit?.target, destination, `${before.room} 缺少 ${dir} 方向`);
  assert.ok(!exit.interactionOnly);
  for (const point of waypoints) await moveTo(point);
  await tick(520);
  for (const key of keys) await page.keyboard.down(key);
  let after;
  try { after = await until(s => !s.processing && s.room !== before.room, `步行 ${dir} 后进 ${destination}`); }
  finally { for (const key of keys) await page.keyboard.up(key); }
  assertInput(before, after, dir, destination, arrival);
  assert.equal(after.dead, false);
  const result = await drain();
  steps.push({ input: 'walking', command: dir, from: before.room, to: destination,
    foot: feet(after), turns: [before.turns, after.turns], waypoints });
  return result;
}

async function importProgress(file) {
  const expected = JSON.parse(await readFile(file, 'utf8')).engine.state;
  assert.equal(expected.chapter, 'ranch');
  await drain();
  await page.keyboard.press('Escape');
  await page.getByRole('tab', { name: '探索进度' }).click();
  await page.locator('#save-file').setInputFiles(file);
  const ready = await until(s => s.mode !== 'paused' && s.room === expected.room && !s.processing,
    '正式存档恢复');
  assert.equal(ready.turns, expected.turns);
  assert.equal(ready.score, expected.score);
  assert.equal(ready.dead, false);
  await drain();
  steps.push({ input: 'import', room: ready.room, turn: ready.turns, source: file });
}

async function checkpoint(label, reload = false) {
  const { current: before } = await drain();
  await page.keyboard.press('Escape');
  await page.getByRole('tab', { name: '探索进度' }).click();
  await page.locator('#save-now').click();
  const pending = page.waitForEvent('download');
  await page.locator('#export-save').click();
  const file = join(output, label + '.json');
  await (await pending).saveAs(file);
  if (reload) {
    await page.reload();
    await page.locator('#continue-save').click();
    await until(s => s.room === before.room && !s.processing && s.art === 'loaded', '刷新后继续探索');
    const { current: restored } = await drain();
    assert.deepEqual(story(restored), story(before));
    assert.deepEqual(feet(restored), feet(before));
    assert.deepEqual(restored.objects.map(o => o.id).sort(), before.objects.map(o => o.id).sort());
    await shot(label);
  } else await page.keyboard.press('Escape');
  steps.push({ input: reload ? 'save-reload' : 'save', room: before.room, turn: before.turns, label });
  return file;
}

async function reachDeck() {
  if ((await state()).room === 'under_windmill') {
    await road('sw', 'south_reservoir', 'ne', [[143, 233], [120, 242], [87, 253]]);
  }
  if ((await state()).room === 'south_reservoir') {
    await road('nw', 'front_yard', 'se', [[298,145],[245,154],[180,164],[127,160],[100,143],[78,115],[61,84],[49,60],[37,47]]);
  }
  if ((await state()).room === 'front_yard') {
    const ramp = (await state()).objects.find(o => o.actions.some(a => a.command === 'w') && o.label === '上坡');
    assert.ok(ramp);
    await act('w', 'front_deck', { hit: pointerCenter(ramp), arrival: 'e' });
  }
  assert.equal((await state()).room, 'front_deck');
  return checkpoint('front-deck-played');
}

async function reachKitchen() {
  if ((await state()).room === 'front_deck') {
    await road('s', 'se_yard', 'n', [[155,244]]);
    await road('w', 'sw_yard', 'e', [[43,144]]);
    await road('n', 'hallway', 's', [[205,111],[201,78]]);
  }
  const before = (await drain()).current;
  assert.equal(before.room, 'hallway');
  if (!before.flags.includes('hallway_outer_door_open')) await act('open outer door', 'hallway', { hit: [320,154] });
  await act('e', 'kitchen', { hit: [320,154], arrival: 'w' });
}

async function collectApproaches(deck) {
  await act('open left door', 'front_deck', { hit: [76,192] });
  await act('sw', 'se_room', { hit: [78,190], arrival: 'e' });
  await shot('se-room-approach');
  const southeast = await checkpoint('se-room-played');

  await importProgress(legacy || deck);
  await reachKitchen();
  await road('n', 'nw_room', 's', [[225,103]]);
  await shot('nw-room-approach');
  const northwest = await checkpoint('nw-room-played');
  return { deck, southeast, northwest };
}


const closetDoor = 'closet:door';
const closetDoorOutside = 'assembly_room:closet-door';
const rightDoor = 'front_deck:right-door';
const leftDoorFlag = 'front_deck_left_door_open';
const rightDoorFlag = 'front_deck_right_door_open';

async function doorAction(id, option = {}) {
  const { current: before } = await drain();
  const handle = object(before, id);
  assert.ok(handle && handle.actions.length === 1, '场景缺少实体门扇 ' + id);
  const command = handle.actions[0].command;
  assert.match(command, /^(open|close) /);
  const hit = option.useF ? undefined : (option.hit || pointerCenter(handle));
  if (option.useF) {
    const expectedHint = command.startsWith('open ') ? /推开门/ : /合上门/;
    if (option.point || !expectedHint.test(await page.locator('#hint').textContent())) {
      await moveTo(option.point || [handle.x, handle.y], true);
    }
    assert.equal((await state()).nearby, handle.label);
    assert.match(await page.locator('#hint').textContent(), expectedHint);
  }
  return act(command, before.room, { hit, touch: option.touch, screenshot: option.screenshot });
}

async function doorway(id, command, destination, { hit, touch, arrival, dead, screenshot } = {}) {
  const { current: before } = await drain();
  const opening = object(before, id + ':opening');
  assert.ok(opening, '敞门应有与门扇分开的入口 ' + id);
  assert.ok(opening.actions.some(action => action.command === command));
  return act(command, destination, { hit: hit || pointerCenter(opening), touch, arrival, dead, screenshot });
}

async function mapCheck(label, { concealed = [], connected = [], closed } = {}) {
  const { current: before } = await drain();
  await page.keyboard.press('m');
  const current = await until(s => s.mode === 'map', '打开章节地图');
  assert.equal(current.map.chapter, 'ranch');
  assert.equal(current.map.selected, before.room);
  const map = page.locator('.chapter-map');
  const ids = await map.locator('[data-room-id]').evaluateAll(items => items.map(item => item.dataset.roomId));
  for (const id of concealed) assert.ok(!ids.includes(id), '提前显示未探索房间 ' + id);
  const edges = await map.locator('[data-from][data-to]').evaluateAll(items => items.map(item =>
    { return { pair: [item.dataset.from, item.dataset.to].sort().join('|'), dashed: item.hasAttribute('stroke-dasharray') }; }));
  for (const pair of connected) {
    const expected = pair.toSorted().join('|');
    assert.ok(edges.some(edge => edge.pair === expected), '缺少已走门路 ' + expected);
  }
  if (closed) {
    const expected = closed.toSorted().join('|');
    assert.ok(edges.some(edge => edge.pair === expected && edge.dashed), '关门后已走路线应显示为虚线');
    assert.match(await map.locator('.map-route-summary').textContent(), /门已关/);
  }
  await shot(label);
  await page.keyboard.press('m');
  assert.deepEqual(story(await state()), story(before), '查看地图不消耗回合');
  steps.push({ input: 'map', room: before.room, connected, concealed, closed });
}

function expectSnake(pages) {
  assert.match(pages.join(' '), /响尾蛇|蛇.*咬|蛇.*嘶/, '首次入室应该有来自响尾蛇的自然警示');
}

async function checkSnakeReturn({ current, pages }) {
  assert.equal(current.room, 'assembly_room');
  assert.equal(current.dead, false, '咬伤当回合仍可操作');
  assert.match(pages.join(' '), /咬|毒牙|毒蛇/, '响尾蛇应实际咬伤');

  await page.keyboard.press('r');
  const fatal = await until(s => !s.processing && s.turns > current.turns, '咬伤后的下一回合结算');
  assertInput(current, fatal, 'wait', 'assembly_room');
  assert.equal(fatal.dead, true, '下一次耗回合行动后应倒下');
  await shot('snake-next-turn-consequence');
  await drain();
  steps.push({ input: 'R', command: 'wait', room: fatal.room, turn: fatal.turns, dead: fatal.dead });
}

function assertDoorBlocks(s, doorId, dirs) {
  assert.ok(!object(s, doorId + ':opening'), '关门后仍有门洞可点');
  for (const dir of dirs) assert.ok(!route(s, dir) || route(s, dir).locked, '关闭的门仍提供 ' + dir);
}

async function testFrontEntry() {
  if ((await state()).room !== 'front_deck') throw Error('前廊进度未恢复');
  const deck = await state();
  assert.ok(!flag(deck, rightDoorFlag));
  assert.ok(!flag(deck, leftDoorFlag));
  assertDoorBlocks(deck, rightDoor, ['nw']);
  await mapCheck('before-closet-map', { concealed: ['assembly_room','closet'] });
  await doorAction(rightDoor, { hit: [101, 76], screenshot: 'right-door-open' });
  const opened = await state();
  assert.ok(flag(opened, rightDoorFlag));
  assert.ok(!flag(opened, leftDoorFlag), '前廊右门开关不能带动左门');
  await setView(true);
  const entered = await doorway(rightDoor, 'nw', 'assembly_room', { arrival: 'e', hit: [101, 76], touch: true });
  await setView(false);
  expectSnake(entered.pages);
  assert.ok(object(entered.current, closetDoorOutside + ':opening'), '壁橱北门首次遇到应敞开');
  await shot('assembly-from-right-door');
}

async function exerciseCloset() {
  await doorway(closetDoorOutside, 'n', 'closet', { arrival: 's', hit: [237, 58] });
  await shot('closet-entered-open');
  await checkpoint('closet-open-played', true);
  const open = await state();
  assert.equal(open.dead, false);
  assert.ok(object(open, closetDoor + ':opening'));
  const southExit = route(open, 's');
  assert.ok(southExit);
  await doorAction(closetDoor, { useF: true, point: [258, 165] });
  const closed = await state();
  assertDoorBlocks(closed, closetDoor, ['s', 'out']);
  await checkpoint('closet-closed-played', true);
  await mapCheck('closet-closed-map', {
    connected: [['front_deck','assembly_room'],['assembly_room','closet']], closed: ['assembly_room','closet'],
  });

  await moveTo([southExit.x, southExit.y + 32], true);
  const before = await state();
  // The room's south doorway is drawn at the upper edge, so walk upward to
  // try that exit. A shut door remains a physical obstacle with no S/OUT hit.
  await hold(['w'], 860);
  const { current: stopped } = await drain();
  assert.deepEqual(story(stopped), story(before), '朝关门走动不应通行或消耗回合');
  assert.ok(stopped.player.y < before.player.y - 6, '确实朝门行走了一段');
  assert.ok(stopped.player.y >= southExit.y - 10, '脚底不可穿过实体关门');
  assertDoorBlocks(stopped, closetDoor, ['s','out']);
  steps.push({ input:'walk-blocked', room: stopped.room, directions: ['s','out'], from:feet(before), stop:feet(stopped) });
  await shot('closet-closed-physical-stop');

  await setView(true);
  await doorAction(closetDoor, { hit: [225, 128], touch: true });
  const reopened = await state();
  assert.equal(reopened.room, 'closet', '触摸关闭的门扇只能开门');
  assert.ok(object(reopened, closetDoor + ':opening'));
  await checkSnakeReturn(await doorway(closetDoor, 's', 'assembly_room', {
    arrival: 'n', hit: [238, 136], touch: true, screenshot: 'snake-return-bite',
  }));
  await setView(false);

  await page.reload();
  await page.locator('#continue-save').click();
  const { current: restored } = await drain();
  assert.equal(restored.room, 'closet', '咬伤后继续游戏应从上个有效存档恢复');
  assert.equal(restored.dead, false);
  assert.equal(restored.turns, reopened.turns, '咬伤和倒下不能覆盖咬伤前的有效存档');
  assert.ok(object(restored, closetDoor + ':opening'), '上次有效步骤是打开壁橱门');
  steps.push({ input:'reload-after-bite', room: restored.room, turn: restored.turns });
}

async function checkOtherEntrances({ southeast, northwest }) {
  await importProgress(southeast);
  let entered = await road('n', 'assembly_room', 's', [[228,108]]);
  expectSnake(entered.pages);
  await doorway(closetDoorOutside, 'n', 'closet', { arrival: 's', hit: [237, 58] });
  await shot('closet-via-southeast');

  await importProgress(northwest);
  entered = await road('e', 'assembly_room', 'w', [[392,146]]);
  expectSnake(entered.pages);
  await doorway(closetDoorOutside, 'n', 'closet', { arrival: 's', hit: [237, 58] });
  await shot('closet-via-northwest');
}

async function checkWindows(northwest) {
  for (const { label, command, text, hit, near } of [
    { label: 'left-glass', command: 'examine window', text: /封住|封着/, hit: [125,39] },
    { label: 'right-glass-F', command: 'examine window', text: /封住|封着/, near: [354,95] },
    { label: 'window-tape', command: 'examine tape', text: /没什么特别/, hit: [110,36] },
    { label: 'window-sash', command: 'open window', text: /打不开/, hit: [125,52] },
  ]) {
    await importProgress(northwest);
    const entered = await road('e', 'assembly_room', 'w', [[392,146]]);
    expectSnake(entered.pages);
    if (near) {
      await moveTo(near);
      await hold(['w'], 16);
      assert.equal((await state()).nearby, '窗玻璃');
    }
    if (hit) await setView(true);
    const observed = await act(command, 'assembly_room', {
      hit, touch: Boolean(hit), screenshot: label + '-observation',
    });
    if (hit) await setView(false);
    assert.match(observed.pages.join(' '), text);
    assert.match(observed.pages.join(' '), /咬|毒牙/);
    assert.equal(observed.current.closet?.snake, 'bitten');
    assert.ok(!observed.current.inventory.includes('tape'));
    assert.equal(flag(observed.current, rightDoorFlag), flag(entered.current, rightDoorFlag));
    assert.equal(observed.current.closet.doorOpen, entered.current.closet.doorOpen);
  }
}

async function dropFromInventory(id, label, command) {
  const { current: before } = await drain();
  assert.ok(before.inventory.includes(id));
  await page.keyboard.press('i');
  await page.getByRole('button', { name: label, exact: true }).click();
  assert.equal((await state()).heldItem, id);
  await page.keyboard.press('i');
  await page.locator('#inventory-drop').click();
  await until(s => !s.processing && s.turns > before.turns, '放下 ' + label);
  const { current } = await drain();
  assert.equal(current.lastCommand, command);
  assert.equal(current.room, before.room);
  assert.equal(current.turns, before.turns + 1);
  assert.equal(current.score, before.score);
  assert.deepEqual(current.inventory, before.inventory.filter(item => item !== id));
  steps.push({ input: 'inventory-drop', command, room: current.room, turn: current.turns });
}

async function assertUnlitCloset() {
  const { current: s } = await drain();
  assert.equal(s.room, 'closet');
  assert.equal(s.closet.lit, false);
  assert.equal(s.closet.doorOpen, false);
  assert.ok(s.objects.every(item => !item.itemId), '黑暗中不应存在可见地物');
  assert.ok(object(s, closetDoor)?.actions.some(action => action.command === 'open closet door'));
  const luminance = await page.locator('canvas').evaluate(canvas => {
    window.advanceTime(0);
    const { data } = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
    let minimum = 255, maximum = 0;
    for (let i = 0; i < data.length; i += 4) {
      const value = Math.max(data[i], data[i + 1], data[i + 2]);
      minimum = Math.min(minimum, value);
      maximum = Math.max(maximum, value);
    }
    return {minimum, maximum};
  });
  assert.ok(luminance.maximum <= 12 && luminance.maximum - luminance.minimum <= 1, '实际画布应均匀全暗');
  return luminance;
}

async function checkUnlitCloset(deck) {
  await importProgress(deck);
  await dropFromInventory('splinter', '木片', 'drop splinter');
  assert.ok((await state()).objects.some(item => item.itemId === 'splinter'));
  await doorAction(rightDoor, { hit: [101, 76] });
  await doorway(rightDoor, 'nw', 'assembly_room', { arrival: 'e', hit: [101, 76] });
  assert.equal(await page.locator('.compass').getAttribute('aria-label'), '北在上方');
  await doorway(closetDoorOutside, 'n', 'closet', { arrival: 's', hit: [237, 58] });
  const compass = page.locator('.compass');
  assert.equal(await compass.getAttribute('aria-label'), '北在下方');
  assert.match(await compass.getAttribute('class'), /south-view/);
  assert.equal(await compass.locator('text').getAttribute('y'), '46');
  const approach = await state();
  assert.equal(approach.routeMarker?.exit?.dir, 's');
  assert.match(approach.routeMarker?.text, /^↑ 南/);
  await shot('closet-south-facing-snake-visible');
  steps.push({ input: 'compass', room: approach.room, marker: approach.routeMarker.text, feet: feet(approach) });

  await doorAction(closetDoor, { useF: true, point: [258, 165] });
  await assertUnlitCloset();
  // Leave a harmless object on the dark floor to check visibility separately
  // from whether a physical object actually exists in the room.
  await dropFromInventory('paper_bird', '纸鸟', 'drop paper bird');
  const saved = await checkpoint('dark-closet-with-paper-bird', true);
  const { itemLoc } = JSON.parse(await readFile(saved, 'utf8')).engine.state;
  assert.equal(itemLoc.splinter, 'front_deck');
  assert.equal(itemLoc.paper_bird, 'closet');

  for (const [width, height] of [[360, 800], [390, 844]]) {
    await importProgress(saved);
    await page.setViewportSize({ width, height });
    assert.equal(await page.evaluate(() => window.innerWidth), width);
    const values = await assertUnlitCloset();
    await shot('closet-fully-dark-' + width);
    await doorAction(closetDoor, { hit: [225, 128], touch: true });
    const after = await state();
    assert.equal(after.room, 'closet');
    assert.equal(after.closet.lit, true);
    assert.equal(after.closet.doorOpen, true);
    assert.equal(after.objects.filter(item => item.itemId === 'paper_bird').length, 1);
    assert.ok(!after.objects.some(item => item.itemId === 'splinter'));
    assert.equal(await compass.getAttribute('aria-label'), '北在下方');
    await shot('closet-reopened-' + width);
    steps.push({ input: 'dark-closet-touch', width, height, luminance: values, lit: after.closet.lit });
  }
  await setView(false);
}

try {
  await page.goto(url);
  await page.waitForFunction(() => window.render_game_to_text && JSON.parse(window.render_game_to_text()).art === 'loaded');
  await page.locator('#start').click();
  await importProgress(source);
  const approaches = await collectApproaches(await reachDeck());
  if (!checkpointOnly) {
    await importProgress(approaches.deck);
    await testFrontEntry();
    await exerciseCloset();
    await checkOtherEntrances(approaches);
    await checkWindows(approaches.northwest);
    await checkUnlitCloset(approaches.deck);
  }
  assert.deepEqual(errors, []);
  await writeFile(join(output, 'result.json'), JSON.stringify({ pass: true, source, legacy, approaches, steps, errors }, null, 2));
  console.log(checkpointOnly ? '正式入口到前廊、东南房间和西北房间通过' : '三个真实壁橱入口、两面门态、关闭路线、刷新、窗户和响尾蛇事件通过');
} catch (error) {
  await shot('failure').catch(() => {});
  await writeFile(join(output, 'failure.json'), JSON.stringify({
    message: error.message, current: await state().catch(() => null), steps, errors,
  }, null, 2));
  throw error;
} finally {
  await browser.close();
}
