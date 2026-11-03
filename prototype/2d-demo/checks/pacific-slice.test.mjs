import test from 'node:test';
import assert from 'node:assert/strict';
import {createPrologueSession} from '../engine-adapter.js';
import {SCENES, sceneExits, sceneBoundaries} from '../scene-manifest.js';
import {getHotspots, getInventoryActions} from '../interaction-catalog.js';
import {resolveInteraction} from '../interaction-intent.js';
import {roomArrival} from '../arrivals.js';
import {isBlocked, findPath} from '../world.js';
import {buildChapterMap} from '../chapter-map.js';
import {illustratedMapNodes, MAP_SIZE} from '../map-geography.js';
import {makeVisualSave, restoreVisualSave} from '../save.js';
import {ROOMS} from '../../js/data/pacific.js';

// The seven-turn adapted switch is intentionally tested as it exists. These
// receipts do not claim to reproduce the 1986 tide, PA, sliding doors or clock.
const PROLOGUE = [
  'e', 'take ball', 'nw', 'unscrew gnomon', 'take gnomon',
  'n', 'take paper bird', 'open paper bird', 'w', 'buy crumbs', 'feed birds',
  'take ruby', 'n', 'push pram', 'push pram', 'wait', 'throw ball at tree',
  'take umbrella', 'push pram', 'open pram', 'enter pram', 'open umbrella',
  'take paper bird', 'take gnomon', 'enter water', 'enter door',
];
const ROOM_IDS = Object.keys(ROOMS);
const FULL_TOUR = ['s', 'd', 's', 'w', 'n', 'e'];
const snapshot = engine => {
  const {version, state} = engine.serialize();
  return JSON.parse(JSON.stringify({version, state}));
};

function session() {
  const output = [];
  const ui = Object.fromEntries(['text', 'system', 'inventory', 'location', 'userInput']
    .map(name => [name, (...args) => output.push({name, text: args.join('\n')})]));
  return {engine: createPrologueSession({ui}), output};
}

async function command(game, input) {
  const start = game.output.length;
  await game.engine.processInput(input);
  const response = game.output.slice(start).map(entry => entry.text).join('\n');
  assert.equal(game.engine.state.dead, false, input);
  assert.doesNotMatch(response,
    /这句话无法识别|错误：|尚未开放|没有可进入的起始房间|暂时无法确定你的意思/, input);
  return response;
}

async function commands(game, inputs) {
  for (const input of inputs) await command(game, input);
}

async function brink({symbol = 4} = {}) {
  const game = session(), {engine} = game;
  engine.moveTo(engine.state.room);
  await commands(game, [...PROLOGUE, 'e', 'u']);
  assert.equal(engine.state.room, 'vertex');
  for (let tries = 0; engine.state.sundialSymbol !== symbol && tries < 7; tries++)
    await command(game, 'turn ring');
  assert.equal(engine.state.sundialSymbol, symbol);
  await commands(game, ['d', 'w', 'ne']);
  assert.equal(engine.state.room, 'chasms_brink');
  assert.equal(engine.state.chapter, 'wabe');
  return game;
}

async function pacific() {
  const game = await brink();
  await command(game, 'in');
  assert.equal(game.engine.state.room, 'mesa');
  assert.equal(game.engine.state.chapter, 'pacific');
  assert.ok(game.engine.loadedChapters.has('pacific'));
  return game;
}

async function bottom() {
  const game = await pacific();
  await commands(game, ['s', 'd']);
  assert.equal(game.engine.state.room, 'bottom_scaffold');
  return game;
}

function objectOf(engine, kind) {
  const object = getHotspots(engine.state).find(object => object.kind === kind);
  assert.ok(object, `${engine.state.room}: ${kind}`);
  return object;
}

async function openBox(game) {
  const {engine} = game, box = objectOf(engine, 'pacific_box'), observed = new Set();
  assert.equal(resolveInteraction(engine.state, box, {observed, heldItem: 'gnomon'}), 'look');
  await command(game, 'look');
  observed.add(box.id);
  assert.equal(resolveInteraction(engine.state, box, {observed, heldItem: 'gnomon'}), 'open box');
  await command(game, 'open box');
  assert.ok(engine.state.hasFlag('pacific_box_open'));
}

test('合法序章拨海王星进入七房，椰子与返程均使用现章命令，不赠送谜题结果', async () => {
  const game = await pacific(), {engine} = game, initial = snapshot(engine).state;
  assert.equal(engine.state.timer, null, '当前适配入门不会启动原版岛上时钟');
  await commands(game, FULL_TOUR);
  assert.equal(engine.state.room, 'east_beach');
  for (const room of ROOM_IDS) {
    assert.ok(SCENES[room], room);
    assert.equal(SCENES[room].chapter, 'pacific');
    assert.ok(engine.state.visited.has(room), room);
  }
  assert.equal(engine.state.itemAt('coconut'), 'east_beach');
  assert.equal(engine.state.hasFlag('pacific_box_open'), false);
  assert.equal(engine.state.hasFlag('pacific_switch_pushed'), false);
  assert.equal(engine.state.hasFlag('pacific_button_pushed'), false);
  assert.equal(engine.state.score, initial.score);
  assert.equal(engine.state.sundialSymbol, initial.sundialSymbol);
  await commands(game, ['w', 'u', 'out']);
  assert.equal(engine.state.room, 'chasms_brink');
  assert.equal(engine.state.chapter, 'wabe');
  assert.ok(engine.state.hasFlag('wabe_to_pacific_used'));
  assert.equal(engine.state.timer, null);
});

test('蘑菇门首次观察、再次F进门；错误符号保持关闭，不把三十英尺裂隙变成路', async () => {
  for (const symbol of [1, 4]) {
    const game = await brink({symbol}), {engine} = game;
    const gate = getHotspots(engine.state).find(object => object.id === 'chasms_brink:toadstool');
    assert.ok(gate);
    const observed = new Set(), heldItem = symbol === 4 ? 'gnomon' : null;
    assert.equal(resolveInteraction(engine.state, gate, {heldItem, observed}), 'examine toadstool');
    await command(game, 'examine toadstool');
    observed.add(gate.id);
    if (symbol === 4) {
      assert.equal(gate.kind, 'pacific_gate');
      assert.equal(resolveInteraction(engine.state, gate, {heldItem, observed}), 'in');
    } else {
      assert.equal(resolveInteraction(engine.state, gate, {observed}), 'examine toadstool');
      assert.ok(gate.actions.every(action => action.command !== 'in'));
      assert.equal(sceneExits('chasms_brink', engine.state, engine.rooms).some(exit => exit.target === 'mesa'), false);
    }
    await command(game, 'in');
    assert.equal(engine.state.room, symbol === 4 ? 'mesa' : 'chasms_brink');
    assert.equal(engine.state.chapter, symbol === 4 ? 'pacific' : 'wabe');
  }
  assert.equal(isBlocked(SCENES.chasms_brink, 260, 80), true, '没有伪造可跨深渊的桥或步行带');
});

test('箱体F仅调用现有look/open；内部控件逐状态采用push，持物不阻断操作', async () => {
  const game = await bottom(), {engine} = game;
  assert.equal(getHotspots(engine.state).some(object => ['pacific_switch', 'pacific_button'].includes(object.kind)), false);
  await openBox(game);
  const offSwitch = objectOf(engine, 'pacific_switch');
  const beforeButton = objectOf(engine, 'pacific_button');
  assert.equal(resolveInteraction(engine.state, beforeButton, {heldItem: 'gnomon'}), 'look');
  assert.equal(resolveInteraction(engine.state, offSwitch, {heldItem: 'gnomon'}), 'push switch');
  await command(game, 'push switch');
  assert.equal(engine.state.timer.id, 'pacific_switch');
  assert.equal(engine.state.timer.remaining, 6, '启动动作本身结算一周期');
  assert.equal(resolveInteraction(engine.state, objectOf(engine, 'pacific_switch'), {heldItem: 'gnomon'}), 'look');
  assert.equal(resolveInteraction(engine.state, objectOf(engine, 'pacific_button'), {heldItem: 'gnomon'}), 'push button');
  await command(game, 'push button');
  assert.equal(engine.state.timer, null);
  assert.ok(engine.state.hasFlag('pacific_button_pushed'));
  assert.equal(engine.state.hasFlag('pacific_timer_expired'), false);
  for (const kind of ['pacific_switch', 'pacific_button'])
    assert.equal(resolveInteraction(engine.state, objectOf(engine, kind)), 'look');
});

test('计时中地图、热点、背包动作与来源查询只读，六次后续周期到期且不伪造核爆', async () => {
  const game = await bottom(), {engine} = game;
  await openBox(game);
  await command(game, 'push switch');
  const before = snapshot(engine);
  for (let pass = 0; pass < 3; pass++) {
    const map = buildChapterMap({state: engine.state, rooms: engine.rooms, scenes: SCENES});
    assert.equal(map.chapter, 'pacific');
    assert.equal(map.warnings.length, 0);
    getHotspots(engine.state);
    getInventoryActions('gnomon', engine.state);
    sceneExits(engine.state.room, engine.state, engine.rooms);
    sceneBoundaries(engine.state.room, engine.state, engine.rooms);
  }
  assert.deepEqual(snapshot(engine), before, '浏览界面不提交游戏周期');
  await commands(game, ['wait', 'wait', 'wait', 'wait', 'wait']);
  assert.equal(engine.state.timer.remaining, 1);
  assert.equal(engine.state.hasFlag('pacific_timer_expired'), false);
  await command(game, 'wait');
  assert.equal(engine.state.timer, null);
  assert.ok(engine.state.hasFlag('pacific_timer_expired'));
  assert.equal(engine.state.dead, false);
  assert.equal(resolveInteraction(engine.state, objectOf(engine, 'pacific_button')), 'push button');
  const response = await command(game, 'push button');
  assert.match(response, /Too late|太迟/);
  assert.equal(engine.state.hasFlag('pacific_button_pushed'), false);
  assert.equal(engine.state.timer, null, '失败后不伪造复位或新倒计时');
});

test('活动计时存档经懒加载恢复回调，及时与到期分支保持完整且不重放进入', async () => {
  const game = await bottom(), {engine} = game;
  await openBox(game);
  await commands(game, ['push switch', 'wait', 'wait']);
  const scene = SCENES.bottom_scaffold, [x, y] = scene.spawn;
  const packet = makeVisualSave(engine, {room: 'bottom_scaffold', x, y, face: 'up',
    knowledge: {observed: ['bottom_scaffold:box'], paper: {observed: [], identified: []}}});
  const expected = snapshot(engine);
  for (const timely of [true, false]) {
    const fresh = session();
    let autosaves = 0;
    fresh.engine.onAutosave = () => autosaves++;
    assert.equal(fresh.engine.loadedChapters.has('pacific'), false);
    const restored = await restoreVisualSave(fresh.engine, JSON.stringify(packet));
    assert.equal(restored.repositioned, false);
    assert.deepEqual(snapshot(fresh.engine), expected);
    assert.ok(fresh.engine.loadedChapters.has('pacific'));
    assert.equal(typeof fresh.engine.state.timer.perTurn, 'function');
    assert.equal(autosaves, 0);
    assert.equal(fresh.engine.state.timer.remaining, 4);
    assert.equal(fresh.output.length, 0, '还原不重放房间开场和计时提示');
    if (timely) {
      await command(fresh, 'push button');
      assert.ok(fresh.engine.state.hasFlag('pacific_button_pushed'));
      assert.equal(fresh.engine.state.hasFlag('pacific_timer_expired'), false);
    } else {
      await commands(fresh, ['wait', 'wait', 'wait', 'wait']);
      assert.ok(fresh.engine.state.hasFlag('pacific_timer_expired'), '登记回调实际执行到期副作用');
      assert.equal(fresh.engine.state.hasFlag('pacific_button_pushed'), false);
    }
    assert.equal(fresh.engine.state.timer, null);
  }
});

test('椰子先观察再拿取，地图/重绘不改变唯一ID，背包仅提供现有拿放观察', async () => {
  const game = await pacific(), {engine} = game;
  await commands(game, ['s', 'e']);
  const coconut = getHotspots(engine.state).find(object => object.itemId === 'coconut');
  assert.ok(coconut);
  const observed = new Set();
  assert.equal(resolveInteraction(engine.state, coconut, {observed}), 'examine coconut');
  await command(game, 'examine coconut');
  observed.add(coconut.id);
  assert.equal(resolveInteraction(engine.state, coconut, {observed}), 'take coconut');
  await command(game, 'take coconut');
  assert.ok(engine.state.has('coconut'));
  assert.equal(getHotspots(engine.state).some(object => object.itemId === 'coconut'), false);
  const actions = getInventoryActions('coconut', engine.state);
  assert.ok(actions.some(action => action.command === 'drop coconut'));
  assert.ok(actions.every(action => !/^(cut|open|give|point)/.test(action.command)));
  await command(game, 'drop coconut');
  const dropped = getHotspots(engine.state).filter(object => object.itemId === 'coconut');
  assert.equal(dropped.length, 1);
  assert.equal(dropped[0].id, coconut.id);
  assert.equal(engine.state.itemAt('coconut'), 'east_beach');
  assert.equal(engine.state.hasFlag('coconut_cracked'), false);
});

test('太平洋地图只揭已走地点，全部当前原章连接保持只读且坐标落在地图内', async () => {
  const game = await pacific(), {engine} = game;
  let map = buildChapterMap({state: engine.state, rooms: engine.rooms, scenes: SCENES});
  assert.deepEqual(map.nodes.map(node => node.id), ['mesa']);
  await commands(game, FULL_TOUR);
  const before = snapshot(engine);
  map = buildChapterMap({state: engine.state, rooms: engine.rooms, scenes: SCENES});
  assert.deepEqual(map.nodes.map(node => node.id).sort(), [...ROOM_IDS].sort());
  assert.equal(map.warnings.length, 0);
  assert.ok(map.nodes.every(node => node.visual && node.cn !== '未知地点'));
  assert.ok(map.chapters.some(chapter => chapter.id === 'wabe'));
  for (const id of ROOM_IDS) {
    const model = ROOMS[id].exits(engine.state);
    const actual = Object.fromEntries(map.edges.filter(edge => edge.from === id).map(edge => [edge.direction, edge.to]));
    const expected = Object.fromEntries(Object.entries(model).filter(([, target]) => typeof target === 'string' && ROOM_IDS.includes(target)));
    assert.deepEqual(actual, expected, id);
  }
  const points = illustratedMapNodes(map);
  assert.equal(points.length, 7);
  for (const point of points) {
    assert.ok(point.x >= 0 && point.x <= MAP_SIZE.width, point.id);
    assert.ok(point.y >= 0 && point.y <= MAP_SIZE.height, point.id);
  }
  assert.deepEqual(snapshot(engine), before);
});

test('七房真实场景出口可达，对称连接按返回口落地，单向西滩连接不伪造反向出口', async () => {
  const game = await pacific(), {engine} = game;
  const before = snapshot(engine);
  let directed = 0;
  for (const id of ROOM_IDS) {
    const scene = SCENES[id], view = Object.create(engine.state);
    Object.defineProperty(view, 'room', {value: id});
    assert.equal(isBlocked(scene, ...scene.spawn), false, `${id} spawn`);
    const raw = ROOMS[id].exits(view), exits = sceneExits(id, view, engine.rooms);
    for (const exit of exits) {
      const original = raw[exit.dir];
      assert.equal(exit.target, typeof original === 'string' ? original : original.to, `${id}.${exit.dir}`);
      const path = findPath(scene, scene.spawn, [exit.x, exit.y], {nearest: true});
      assert.ok(path.length, `${id}.${exit.dir} reachable`);
      assert.ok(Math.hypot(path.at(-1)[0] - exit.x, path.at(-1)[1] - exit.y) <= exit.radius,
        `${id}.${exit.dir} reaches the actual exit sensor`);
      if (!ROOM_IDS.includes(exit.target)) continue;
      const returns = sceneExits(exit.target, engine.state, engine.rooms);
      const arrival = roomArrival(SCENES[exit.target], {fromRoom: id, direction: exit.dir, exits: returns});
      assert.ok(arrival, `${id}.${exit.dir} arrival`);
      assert.equal(arrival.matched, returns.some(route => route.target === id), `${id}.${exit.dir} truthful reverse`);
      assert.equal(isBlocked(SCENES[exit.target], arrival.x, arrival.y), false);
      assert.ok(findPath(SCENES[exit.target], arrival, SCENES[exit.target].spawn).length);
      assert.ok(returns.every(route => Math.hypot(arrival.x - route.x, arrival.y - route.y) >= route.radius + 8),
        `${id}.${exit.dir} clears every exit sensor`);
      directed++;
    }
  }
  assert.ok(directed >= 20, '所有独立已绘制通行口均须实际查路');
  assert.equal(ROOMS.west_beach.exits(engine.state).se, 'south_beach');
  assert.equal(Object.values(ROOMS.west_beach.exits(engine.state)).includes('bottom_scaffold'), false);
  assert.deepEqual(snapshot(engine), before);
});
