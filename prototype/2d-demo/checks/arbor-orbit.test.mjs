import test from 'node:test';
import assert from 'node:assert/strict';
import {createPrologueSession} from '../engine-adapter.js';
import {SCENES, sceneExits} from '../scene-manifest.js';
import {getHotspots, getInventoryActions} from '../interaction-catalog.js';
import {resolveInteraction, resolveHeldSelf} from '../interaction-intent.js';
import {roomArrival} from '../arrivals.js';
import {isBlocked, findPath} from '../world.js';
import {buildChapterMap} from '../chapter-map.js';
import {makeVisualSave, restoreVisualSave} from '../save.js';

// These receipts exercise the currently adapted chapter through real commands.
// They do not claim that its flipping/space rules reproduce every 1986 rule.
const PROLOGUE = [
  'e', 'take ball', 'nw', 'unscrew gnomon', 'take gnomon',
  'n', 'take paper bird', 'open paper bird', 'w', 'buy crumbs', 'feed birds',
  'take ruby', 'n', 'push pram', 'push pram', 'wait', 'throw ball at tree',
  'take umbrella', 'push pram', 'open pram', 'enter pram', 'open umbrella',
  'take paper bird', 'take gnomon', 'enter water', 'enter door',
];
const FLOAT_DIRECTIONS = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw', 'u', 'd', 'in'];
const stateOf = game => game.engine.state;
const snapshot = game => {
  const {version, state} = game.engine.serialize();
  return JSON.parse(JSON.stringify({version, state}));
};

function game() {
  const output = [];
  const ui = Object.fromEntries(['text', 'system', 'inventory', 'location', 'userInput']
    .map(name => [name, (...args) => output.push({name, text: args.join('\n')})]));
  return {engine: createPrologueSession({ui}), output};
}

async function command(g, input) {
  const from = g.output.length;
  await g.engine.processInput(input);
  const text = g.output.slice(from).map(entry => entry.text).join('\n');
  assert.doesNotMatch(text, /这句话无法识别|错误：|尚未开放|没有可进入的起始房间/, input);
  assert.equal(stateOf(g).dead, false, input);
  return text;
}

async function commands(g, inputs) {
  for (const input of inputs) await command(g, input);
}

async function trellises() {
  const g = game();
  g.engine.moveTo(stateOf(g).room);
  await commands(g, [...PROLOGUE, 'n', 'ne', 'take splinter', 'e', 's']);
  assert.equal(stateOf(g).room, 'trellises');
  assert.equal(stateOf(g).chapter, 'wabe');
  assert.equal(stateOf(g).flipped, false);
  assert.ok(stateOf(g).has('splinter'));
  return g;
}

async function takeAxe(g) {
  await command(g, 'u');
  assert.equal(stateOf(g).room, 'top_of_arbor');
  const axe = getHotspots(stateOf(g)).find(object => object.itemId === 'axe');
  assert.ok(axe, '独立斧头只能在真实物品位置出现');
  const observed = new Set();
  assert.equal(resolveInteraction(stateOf(g), axe, {observed}), 'examine axe');
  await command(g, resolveInteraction(stateOf(g), axe, {observed}));
  observed.add(axe.id);
  assert.equal(resolveInteraction(stateOf(g), axe, {observed}), 'take axe');
  await command(g, resolveInteraction(stateOf(g), axe, {observed}));
  assert.ok(stateOf(g).has('axe'));
  assert.equal(getHotspots(stateOf(g)).some(object => object.itemId === 'axe'), false);
  return axe;
}

async function chooseSymbol(g, symbol) {
  assert.equal(stateOf(g).room, 'vertex');
  for (let count = 0; stateOf(g).sundialSymbol !== symbol && count < 7; count++)
    await command(g, 'turn ring');
  assert.equal(stateOf(g).sundialSymbol, symbol);
}

async function waterfall({axe = true, bubble = true, symbol = 3} = {}) {
  const g = await trellises();
  if (axe) {
    await takeAxe(g);
    await commands(g, ['n', 's', 'd']);
    assert.equal(stateOf(g).flipped, true);
  }
  await commands(g, ['n', 'u']);
  await chooseSymbol(g, symbol);
  await command(g, 'd');
  if (bubble) {
    await commands(g, ['ne', 'e', 'nw', 'e', 'take soap bubble', 'w', 'se', 'sw', 'w']);
    assert.equal(stateOf(g).room, 'bottom_of_stairs');
    assert.ok(stateOf(g).has('soap_bubble'));
  }
  await commands(g, ['w', 'w']);
  assert.equal(stateOf(g).room, 'waterfall');
  return g;
}

async function enterOrbit(g) {
  const gate = getHotspots(stateOf(g)).find(object => object.kind === 'mushroom_gate');
  assert.ok(gate);
  assert.equal(resolveInteraction(stateOf(g), gate, {heldItem: 'axe'}), 'look');
  await command(g, 'look');
  assert.equal(resolveInteraction(stateOf(g), gate, {
    heldItem: stateOf(g).has('axe') ? 'axe' : null, observed: new Set([gate.id]),
  }), 'in');
  await command(g, 'in');
  assert.equal(stateOf(g).room, 'orbit_satellite');
  assert.equal(stateOf(g).chapter, 'orbit');
  assert.ok(g.engine.loadedChapters.has('orbit'));
}

function checkArboretum(g, flipped) {
  assert.equal(stateOf(g).room, 'arboretum');
  assert.equal(stateOf(g).flipped, flipped);
  const before = snapshot(g);
  const expected = flipped
    ? {w: 'arborvitaes_n', e: 'arborvitaes_s'}
    : {e: 'arborvitaes_n', w: 'arborvitaes_s'};
  for (let count = 0; count < 3; count++) {
    const exits = sceneExits('arboretum', stateOf(g), g.engine.rooms);
    assert.deepEqual(Object.fromEntries(exits.map(exit => [exit.dir, exit.target])), expected);
    const map = buildChapterMap({state: stateOf(g), rooms: g.engine.rooms, scenes: SCENES});
    assert.deepEqual(Object.fromEntries(map.edges.filter(edge => edge.from === 'arboretum')
      .map(edge => [edge.direction, edge.to])), expected);
    for (const hedge of ['arborvitaes_n', 'arborvitaes_s']) {
      const direction = hedge === 'arborvitaes_n' ? 'w' : 'e';
      const landing = roomArrival(SCENES.arboretum, {fromRoom: hedge, direction, exits});
      const matching = exits.find(exit => exit.target === hedge);
      assert.ok(landing?.matched);
      assert.equal(landing.entrance, matching.dir, '返程按当前真实连接选择入口，不固定取反方向');
      assert.equal(isBlocked(SCENES.arboretum, landing.x, landing.y), false);
      assert.ok(findPath(SCENES.arboretum, landing, SCENES.arboretum.spawn).length);
      assert.equal(landing.x < SCENES.arboretum.spawn[0], matching.dir === 'w');
    }
    getHotspots(stateOf(g));
    getInventoryActions('axe', stateOf(g));
  }
  assert.deepEqual(snapshot(g), before, '地图/入口/热点查询不可推进回合、翻转或移动物品');
}

test('真实序章接入藤架，斧头先观察再取；南北越顶各翻转一次，返程不重复翻转', async () => {
  const g = await trellises();
  await takeAxe(g);
  assert.equal(stateOf(g).flipped, false);
  await command(g, 'n');
  assert.equal(stateOf(g).room, 'north_arbor');
  assert.equal(stateOf(g).flipped, true);
  assert.deepEqual(sceneExits('north_arbor', stateOf(g), g.engine.rooms).map(exit => exit.dir), ['s']);
  await command(g, 's');
  assert.equal(stateOf(g).room, 'top_of_arbor');
  assert.equal(stateOf(g).flipped, true);
  await command(g, 's');
  assert.equal(stateOf(g).room, 'south_arbor');
  assert.equal(stateOf(g).flipped, false);
  assert.deepEqual(sceneExits('south_arbor', stateOf(g), g.engine.rooms).map(exit => exit.dir), ['n']);
  await commands(g, ['n', 'd']);
  assert.equal(stateOf(g).room, 'trellises');
  assert.equal(stateOf(g).flipped, false);
  assert.ok(stateOf(g).has('axe'));
  assert.equal(stateOf(g).score, 15, '表现接入不为普通拾物或穿行自造得分');
});

test('植物园翻转前后东西目标、M地图和两侧返程入口同步，查询始终只读', async () => {
  const g = await trellises();
  // Discover both hedge rooms before comparing the explored map's two links.
  await commands(g, ['se', 'w', 'w', 'e']);
  checkArboretum(g, false);
  await commands(g, ['e', 'nw']);
  await takeAxe(g);
  await commands(g, ['n', 's', 'd', 'se', 'w']);
  checkArboretum(g, true);
  await commands(g, ['e', 'ne']);
  assert.equal(stateOf(g).room, 'trellises');
  assert.equal(stateOf(g).flipped, true);
});

test('瀑布门分别执行错误符号、缺泡膜与具备条件三种裁决，F不能越过前置', async () => {
  for (const options of [{symbol: 2, bubble: true}, {symbol: 3, bubble: false}]) {
    const g = await waterfall(options), before = snapshot(g);
    const exit = sceneExits('waterfall', stateOf(g), g.engine.rooms).find(exit => exit.dir === 'in');
    assert.equal(exit.locked, true);
    const text = await command(g, 'in');
    assert.match(text, options.bubble ? /蘑菇门紧闭/ : /需要肥皂泡/);
    assert.equal(stateOf(g).room, 'waterfall');
    assert.equal(stateOf(g).chapter, 'wabe');
    assert.equal(stateOf(g).hasFlag('wabe_to_orbit_used'), false);
    assert.deepEqual(stateOf(g).itemLoc, before.state.itemLoc);
    assert.equal(stateOf(g).flipped, before.state.flipped);
  }
  const g = await waterfall();
  const exit = sceneExits('waterfall', stateOf(g), g.engine.rooms).find(exit => exit.dir === 'in');
  assert.equal(exit.locked, false);
  assert.equal(exit.target, 'orbit_satellite');
  await enterOrbit(g);
  assert.ok(stateOf(g).hasFlag('wabe_to_orbit_used'));
  assert.ok(stateOf(g).has('soap_bubble'));
});

test('轨道当前章的11方向交替浮行保留泡膜，手持斧头一次破泡返回Wabe', async () => {
  const g = await waterfall();
  await enterOrbit(g);
  const entered = snapshot(g), score = stateOf(g).score;
  for (const direction of FLOAT_DIRECTIONS) {
    await command(g, direction);
    assert.equal(stateOf(g).room, 'orbit_space', direction);
    assert.equal(stateOf(g).chapter, 'orbit');
    assert.ok(stateOf(g).has('soap_bubble'));
    await command(g, 'd');
    assert.equal(stateOf(g).room, 'orbit_satellite', direction);
    assert.ok(stateOf(g).has('soap_bubble'));
  }
  // OUT is also a space-to-satellite alias; it must not bypass the return room.
  await commands(g, ['u', 'out']);
  assert.equal(stateOf(g).room, 'orbit_satellite');
  const membrane = getHotspots(stateOf(g)).find(object => object.kind === 'orbit_membrane');
  assert.ok(membrane?.pointerOnly, '随身泡膜不应抢走附近出口的F交互');
  assert.equal(resolveInteraction(stateOf(g), membrane, {heldItem: 'axe'}), 'break bubble with axe');
  assert.equal(resolveHeldSelf('axe', stateOf(g)), 'break bubble with axe');
  await command(g, resolveHeldSelf('axe', stateOf(g)));
  assert.equal(stateOf(g).room, 'waterfall');
  assert.equal(stateOf(g).chapter, 'wabe');
  assert.equal(stateOf(g).itemAt('soap_bubble'), 'destroyed');
  assert.ok(stateOf(g).has('axe'));
  assert.equal(stateOf(g).score, score);
  assert.equal(stateOf(g).flipped, entered.state.flipped);
  assert.equal(stateOf(g).sundialSymbol, entered.state.sundialSymbol);
  assert.equal(getHotspots(stateOf(g)).some(object => object.kind === 'orbit_membrane'), false);
});

test('没有斧头的白门继续阻挡；空手观察卫星不赠送金属或触发磁铁事件', async () => {
  const g = await waterfall({axe: false});
  await enterOrbit(g);
  const before = snapshot(g), hull = getHotspots(stateOf(g)).find(object => object.kind === 'orbit_hull');
  assert.ok(hull);
  assert.equal(stateOf(g).itemAt('lump'), 'crater');
  assert.equal(resolveInteraction(stateOf(g), hull), 'look');
  await command(g, resolveInteraction(stateOf(g), hull));
  const text = await command(g, 'out');
  assert.match(text, /需要用斧头/);
  assert.equal(stateOf(g).room, 'orbit_satellite');
  assert.equal(stateOf(g).chapter, 'orbit');
  assert.deepEqual(stateOf(g).itemLoc, before.state.itemLoc);
  assert.ok(stateOf(g).has('soap_bubble'));
  assert.equal(getHotspots(stateOf(g)).find(object => object.kind === 'orbit_membrane')
    .actions.some(action => action.command === 'break bubble with axe'), false);
});

test('远空独立存档恢复懒加载与观察知识，地图/读档不翻转、不重演进场且可继续破泡返程', async () => {
  const g = await waterfall();
  await enterOrbit(g);
  await command(g, 'u');
  const [x, y] = SCENES.orbit_space.spawn;
  const packet = makeVisualSave(g.engine, {room: 'orbit_space', x, y, face: 'left',
    knowledge: {observed: ['waterfall:mushroom', 'arbor:item:axe'], paper: {observed: [], identified: []}}});
  const saved = snapshot(g), fresh = game();
  assert.equal(fresh.engine.rooms.orbit_space, undefined);
  let autosaves = 0;
  fresh.engine.onAutosave = () => autosaves++;
  const restored = await restoreVisualSave(fresh.engine, JSON.stringify(packet));
  assert.equal(restored.repositioned, false);
  assert.deepEqual(restored.visual.knowledge, packet.visual.knowledge);
  assert.deepEqual(snapshot(fresh), saved);
  assert.equal(fresh.output.length, 0, '恢复不调用进入事件或重新输出章节剧情');
  assert.equal(autosaves, 0);
  assert.ok(fresh.engine.loadedChapters.has('orbit'));
  assert.ok(fresh.engine.loadedChapters.has('wabe'));
  const before = snapshot(fresh);
  for (let count = 0; count < 3; count++) {
    const current = buildChapterMap({state: stateOf(fresh), rooms: fresh.engine.rooms, scenes: SCENES});
    assert.equal(current.chapter, 'orbit');
    assert.deepEqual(current.nodes.map(node => node.id).sort(), ['orbit_satellite', 'orbit_space']);
    assert.ok(current.nodes.every(node => node.visual));
    assert.ok(current.chapters.some(chapter => chapter.id === 'wabe'));
    const wabe = buildChapterMap({state: stateOf(fresh), rooms: fresh.engine.rooms, scenes: SCENES, chapter: 'wabe'});
    assert.ok(wabe.nodes.some(node => node.id === 'top_of_arbor'));
    assert.equal(wabe.nodes.some(node => node.id.startsWith('orbit_')), false);
    sceneExits(stateOf(fresh).room, stateOf(fresh), fresh.engine.rooms);
    getHotspots(stateOf(fresh));
    getInventoryActions('axe', stateOf(fresh));
  }
  assert.deepEqual(snapshot(fresh), before);
  await commands(fresh, ['d', 'break bubble with axe']);
  assert.equal(stateOf(fresh).room, 'waterfall');
  assert.equal(stateOf(fresh).chapter, 'wabe');
  assert.equal(stateOf(fresh).flipped, true);
  assert.ok(stateOf(fresh).has('axe'));
  assert.equal(stateOf(fresh).itemAt('soap_bubble'), 'destroyed');
});
