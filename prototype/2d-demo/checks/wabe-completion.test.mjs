import test from 'node:test';
import assert from 'node:assert/strict';
import {createPrologueSession} from '../engine-adapter.js';
import {SCENES, sceneExits, sceneBoundaries} from '../scene-manifest.js';
import {getHotspots, getInventoryActions} from '../interaction-catalog.js';
import {resolveInteraction} from '../interaction-intent.js';
import {pointerTarget, withinReach} from '../interaction-targets.js';
import {roomArrival} from '../arrivals.js';
import {isBlocked, findPath} from '../world.js';
import {buildChapterMap} from '../chapter-map.js';
import {illustratedMapNodes, MAP_SIZE} from '../map-geography.js';
import {makeVisualSave, restoreVisualSave} from '../save.js';
import {ROOMS} from '../../js/data/wabe.js';

// Exercise only commands already accepted by the shared chapter. In particular,
// these checks do not manufacture the missing oak bridge, bubble suit or ferry.
const PROLOGUE = [
  'e', 'take ball', 'nw', 'unscrew gnomon', 'take gnomon',
  'n', 'take paper bird', 'open paper bird', 'w', 'buy crumbs', 'feed birds',
  'take ruby', 'n', 'push pram', 'push pram', 'wait', 'throw ball at tree',
  'take umbrella', 'push pram', 'open pram', 'enter pram', 'open umbrella',
  'take paper bird', 'take gnomon', 'enter water', 'enter door',
];
const ROOMS_ADDED = ['chasms_brink', 'promontory', 'herb_garden', 'the_river'];
const CONNECTIONS = [
  ['chasms_brink', 'ne', 'bluff', 'sw'],
  ['chasms_brink', 'e', 'under_cliff', 'w'],
  ['chasms_brink', 'se', 'the_bend', 'nw'],
  ['chasms_brink', 'sw', 'south_bog', 'ne'],
  ['chasms_brink', 'w', 'north_bog', 'e'],
  ['chasms_brink', 'nw', 'promontory', 'se'],
  ['promontory', 's', 'north_bog', 'n'],
  ['herb_garden', 'w', 'cottage', 'e'],
  ['the_river', 'n', 'the_bend', 's'],
  ['the_river', 'w', 'trellises', 'e'],
  ['the_river', 'nw', 'bottom_of_stairs', 'se'],
];
const snapshot = engine => {
  // savedAt describes this serialization call, not a change to game progress.
  const {version, state} = engine.serialize();
  return JSON.parse(JSON.stringify({version, state}));
};

function session() {
  const output = [];
  const ui = Object.fromEntries(['text', 'system', 'inventory', 'location', 'userInput']
    .map(name => [name, (...args) => output.push(args.join('\n'))]));
  return {engine: createPrologueSession({ui}), output};
}

async function run(game, inputs) {
  for (const input of inputs) {
    const first = game.output.length;
    await game.engine.processInput(input);
    assert.equal(game.engine.state.dead, false, input);
    assert.doesNotMatch(game.output.slice(first).join('\n'),
      /这句话无法识别|错误：|尚未开放|没有可进入的起始房间/, input);
  }
}

async function meadow() {
  const game = session();
  game.engine.moveTo(game.engine.state.room);
  await run(game, PROLOGUE);
  assert.equal(game.engine.state.room, 'meadow');
  assert.equal(game.engine.state.chapter, 'wabe');
  return game;
}

async function brink() {
  const game = await meadow();
  await run(game, ['n', 'ne', 'take splinter', 'ne']);
  assert.equal(game.engine.state.room, 'chasms_brink');
  return game;
}

async function garden() {
  const game = await brink();
  await run(game, ['ne', 'e', 'e']);
  assert.equal(game.engine.state.room, 'herb_garden');
  return game;
}

async function setSymbol(game, symbol) {
  assert.equal(game.engine.state.room, 'vertex');
  for (let count = 0; game.engine.state.sundialSymbol !== symbol && count < 7; count++)
    await run(game, ['turn ring']);
  assert.equal(game.engine.state.sundialSymbol, symbol);
}

function byCommand(engine, command) {
  const target = getHotspots(engine.state).find(object => object.actions.some(action => action.command === command));
  assert.ok(target, `${engine.state.room}: ${command}`);
  return target;
}

test('合法序章拿木片后走完四房与全部旧邻接，返程不改物品、得分或符号', async () => {
  const game = await brink(), {engine} = game;
  const initial = snapshot(engine).state;
  for (const [from, direction, to, reverse] of CONNECTIONS.slice(0, 6)) {
    assert.equal(engine.state.room, from);
    await run(game, [direction]);
    assert.equal(engine.state.room, to);
    await run(game, [reverse]);
    assert.equal(engine.state.room, from);
  }
  await run(game, ['nw', 's', 'n', 'se', 'ne', 'e', 'e', 'w', 'e', 'w', 'w', 'sw', 'se', 's']);
  assert.equal(engine.state.room, 'the_river');
  for (const [from, direction, to, reverse] of CONNECTIONS.slice(8)) {
    assert.equal(engine.state.room, from);
    await run(game, [direction]);
    assert.equal(engine.state.room, to);
    await run(game, [reverse]);
    assert.equal(engine.state.room, from);
  }
  for (const id of new Set(CONNECTIONS.flatMap(([from, , to]) => [from, to])))
    assert.ok(engine.state.visited.has(id), id);
  assert.deepEqual(engine.state.itemLoc, initial.itemLoc);
  assert.equal(engine.state.sundialSymbol, initial.sundialSymbol);
  assert.equal(engine.state.flipped, initial.flipped);
  assert.equal(engine.state.score, initial.score);
  assert.equal(engine.state.itemAt('soap_bubble'), 'cottage');
  assert.ok(engine.state.has('splinter'));
});

test('二十二条双向来源入口按真实返回口落地，清出出口传感区并可走回房内', async () => {
  const {engine} = await brink(), before = snapshot(engine);
  for (const [from, direction, to, reverse] of CONNECTIONS) {
    for (const [source, dir, target, returnDir] of [[from, direction, to, reverse], [to, reverse, from, direction]]) {
      const exits = sceneExits(source, engine.state, engine.rooms);
      const route = exits.find(exit => exit.dir === dir);
      assert.equal(route?.target, target, `${source}.${dir}`);
      const original = ROOMS[source].exits(engine.state)[dir];
      assert.equal(route.target, typeof original === 'string' ? original : original.to);
      const returns = sceneExits(target, engine.state, engine.rooms);
      const arrival = roomArrival(SCENES[target], {fromRoom: source, direction: dir, exits: returns});
      assert.ok(arrival?.matched, `${source}.${dir} → ${target}`);
      assert.equal(arrival.entrance, returnDir);
      assert.equal(isBlocked(SCENES[target], arrival.x, arrival.y), false);
      assert.ok(returns.every(exit => Math.hypot(arrival.x - exit.x, arrival.y - exit.y) >= exit.radius + 8));
      assert.ok(findPath(SCENES[target], arrival, SCENES[target].spawn).length);
    }
  }
  assert.deepEqual(snapshot(engine), before, '来源查询不可执行原章出口动作');
});

test('巨人三个细部仅观察，重复F不送泡、不新增巨碟或攀爬机制', async () => {
  const game = await brink(), {engine} = game;
  await run(game, ['nw']);
  const initial = snapshot(engine).state;
  const observed = new Set();
  for (const command of ['examine boy', 'examine dish', 'examine headphones']) {
    const object = byCommand(engine, command);
    assert.equal(resolveInteraction(engine.state, object, {observed}), command);
    await run(game, [command]);
    observed.add(object.id);
    assert.equal(resolveInteraction(engine.state, object, {observed}), command);
    await run(game, [command]);
  }
  assert.deepEqual(engine.state.itemLoc, initial.itemLoc);
  assert.equal(engine.state.itemAt('soap_bubble'), 'cottage');
  assert.equal(engine.state.score, initial.score);
  assert.deepEqual([...engine.state.flags], initial.flags);
  assert.equal(getHotspots(engine.state).some(object => object.itemId === 'soap_bubble'), false);
  assert.ok(getHotspots(engine.state).every(object => object.actions.every(action =>
    !/^(take .*bubble|enter dish|climb |give )/.test(action.command))));
});

test('橡树、深渊和河岸主动观察可达既有事件，观察不创造桥、渡船或额外出口', async () => {
  const game = await brink(), {engine} = game;
  const stateBefore = snapshot(engine).state;
  for (const command of ['examine oak', 'examine chasm', 'examine toadstool']) {
    const object = byCommand(engine, command);
    assert.equal(resolveInteraction(engine.state, object), command);
    await run(game, [command]);
  }
  assert.equal(engine.state.room, 'chasms_brink');
  assert.equal(sceneExits('chasms_brink', engine.state, engine.rooms).some(exit => ['n', 'u', 'd'].includes(exit.dir)), false);
  await run(game, ['se', 's']);
  const river = byCommand(engine, 'examine river');
  assert.equal(resolveInteraction(engine.state, river), 'examine river');
  const first = game.output.length;
  await run(game, ['examine river']);
  assert.match(game.output.slice(first).join('\n'), /河水暗沉而静止/);
  assert.deepEqual(engine.state.itemLoc, stateBefore.itemLoc);
  assert.equal(engine.state.score, stateBefore.score);
  assert.deepEqual(sceneExits('the_river', engine.state, engine.rooms).map(exit => exit.dir).sort(), ['n', 'nw', 'w']);
});

test('药草遵循当前章：蒜先观察再取放并保留同一物品，百里香保持不可取', async () => {
  const game = await garden(), {engine} = game;
  const before = snapshot(engine).state, observed = new Set();
  const garlic = byCommand(engine, 'take garlic');
  assert.equal(garlic.itemId, 'garlic');
  assert.equal(resolveInteraction(engine.state, garlic, {observed}), 'examine garlic');
  await run(game, ['examine garlic']);
  observed.add(garlic.id);
  assert.equal(resolveInteraction(engine.state, garlic, {observed}), 'take garlic');
  await run(game, ['take garlic']);
  assert.ok(engine.state.has('garlic'));
  assert.equal(getHotspots(engine.state).some(object => object.itemId === 'garlic'), false);
  assert.ok(getInventoryActions('garlic', engine.state).some(action => action.command === 'drop garlic'));
  await run(game, ['drop garlic']);
  const dropped = getHotspots(engine.state).filter(object => object.itemId === 'garlic');
  assert.equal(dropped.length, 1);
  assert.equal(dropped[0].id, garlic.id, '认知与续玩使用稳定物品ID');
  const thyme = byCommand(engine, 'examine thyme');
  assert.equal(thyme.itemId, 'thyme');
  assert.ok(thyme.actions.every(action => action.command !== 'take thyme'));
  await run(game, ['examine herbs', 'examine thyme', 'take thyme']);
  assert.equal(engine.state.itemAt('thyme'), 'herb_garden');
  assert.equal(engine.state.has('thyme'), false);
  assert.equal(engine.state.score, before.score);
  assert.equal(engine.state.sundialSymbol, before.sundialSymbol);
  assert.equal(engine.state.itemAt('garlic'), 'herb_garden');
});

test('交付画中的毒菌、药床和巨人鞋沿与命中及占位一致，空岩台不抢毒菌观察', async () => {
  const game = await brink(), {engine} = game;
  // Independent visible samples from the delivered backgrounds/actor composite,
  // not coordinates copied back out of each object's own hit configuration.
  const mushroom = byCommand(engine, 'examine toadstool');
  assert.equal(pointerTarget(getHotspots(engine.state), {x:277, y:29})?.id, mushroom.id);
  assert.notEqual(pointerTarget(getHotspots(engine.state), {x:260, y:71})?.id, mushroom.id);
  await run(game, ['nw']);
  assert.equal(isBlocked(SCENES.promontory, 240, 174), true, '巨人右鞋的落地范围不可穿过');
  await run(game, ['se', 'ne', 'e', 'e']);
  const herbs = byCommand(engine, 'examine herbs'), thyme = byCommand(engine, 'examine thyme');
  assert.equal(pointerTarget(getHotspots(engine.state), {x:177, y:126})?.id, herbs.id);
  assert.equal(pointerTarget(getHotspots(engine.state), {x:300, y:166})?.id, thyme.id);
  assert.equal(isBlocked(SCENES.herb_garden, 223, 137), false, '药床旁的中间土路是合法观察站位');
  assert.equal(withinReach({x:223, y:137}, herbs), true, '玩家走到真实药床旁即可F观察');
  assert.equal(isBlocked(SCENES.herb_garden,365,155),true,'毒菌树干具有独立实体占位');
  assert.equal(isBlocked(SCENES.herb_garden,365,185),false,'观察点在树干前的真实土路上');
});

test('未制作的Pacific、Tundra和Islet只保留开放边界，闭门不画自出口或可玩门船', async () => {
  const cases = [
    {symbol: 4, room: 'chasms_brink', target: 'mesa', route: ['d', 'w', 'ne']},
    {symbol: 5, room: 'herb_garden', target: 'tundra_1', route: ['d', 'ne', 'e', 'nw', 'e', 'e']},
    {symbol: 6, room: 'the_river', target: 'islet', route: ['d', 'se']},
  ];
  for (const entry of cases) {
    const game = await meadow(), {engine} = game;
    await run(game, ['e', 'u']);
    await setSymbol(game, entry.symbol);
    await run(game, entry.route);
    assert.equal(engine.state.room, entry.room);
    const before = snapshot(engine);
    for (let count = 0; count < 3; count++) {
      assert.equal(sceneExits(entry.room, engine.state, engine.rooms).some(exit => exit.dir === 'in'), false);
      assert.deepEqual(sceneBoundaries(entry.room, engine.state, engine.rooms).filter(exit => exit.dir === 'in')
        .map(exit => exit.target), [entry.target]);
      const objects = getHotspots(engine.state);
      assert.ok(objects.every(object => object.actions.every(action => action.command !== 'in')));
      assert.equal(objects.some(object => /ferry|charon|oarsman/.test(object.kind)), false);
      buildChapterMap({state: engine.state, rooms: engine.rooms, scenes: SCENES});
    }
    assert.deepEqual(snapshot(engine), before, '看边界不调用transitionChapter或设置门已使用flag');
  }
  const {engine} = await brink(); // Current default is Pluto, with all three doors closed.
  for (const {room} of cases) {
    assert.equal(sceneExits(room, engine.state, engine.rooms).some(exit => exit.dir === 'in'), false);
    assert.equal(sceneBoundaries(room, engine.state, engine.rooms).some(exit => exit.dir === 'in'), false);
  }
});

test('M地图只揭示已走四房和真实道路，不泄露未制作章节或推进回合', async () => {
  const game = await meadow(), {engine} = game;
  const first = buildChapterMap({state: engine.state, rooms: engine.rooms, scenes: SCENES});
  assert.ok(ROOMS_ADDED.every(id => !first.nodes.some(node => node.id === id)));
  await run(game, ['n', 'ne', 'take splinter', 'n', 'n', 'se', 'ne', 'e', 'e', 'w', 'w', 'sw', 'se', 's']);
  const before = snapshot(engine);
  for (let count = 0; count < 3; count++) {
    const map = buildChapterMap({state: engine.state, rooms: engine.rooms, scenes: SCENES});
    assert.equal(map.chapter, 'wabe');
    const points = illustratedMapNodes(map);
    for (const id of ROOMS_ADDED) {
      const point = points.find(node => node.id === id);
      assert.ok(point?.visual, id);
      assert.equal(point.cn, ROOMS[id].cn);
      assert.ok(point.x > 20 && point.x < MAP_SIZE.width - 20);
      assert.ok(point.y > 30 && point.y < MAP_SIZE.height - 30);
    }
    for (const [from, direction, to] of CONNECTIONS.filter(([, , target]) => engine.state.visited.has(target)))
      assert.ok(map.edges.some(edge => edge.from === from && edge.direction === direction && edge.to === to));
    assert.equal(map.nodes.some(node => ['mesa', 'tundra_1', 'islet'].includes(node.id)), false);
    assert.ok(map.edges.every(edge => edge.direction !== 'in' || !ROOMS_ADDED.includes(edge.from)));
    assert.deepEqual(map.warnings, []);
  }
  assert.deepEqual(snapshot(engine), before);
});

test('四房独立续玩保留真实物品和观察记录，不重演进场、丢入口或自动拾物', async () => {
  const game = await brink(), {engine} = game;
  for (const [route, room] of [[[], 'chasms_brink'], [['nw'], 'promontory'],
    [['se', 'ne', 'e', 'e'], 'herb_garden'], [['w', 'w', 'sw', 'se', 's'], 'the_river']]) {
    await run(game, route);
    assert.equal(engine.state.room, room);
    if (room === 'herb_garden') await run(game, ['take garlic']);
    const observed = getHotspots(engine.state).map(object => object.id);
    const [x, y] = SCENES[room].spawn;
    const packet = makeVisualSave(engine, {room, x, y, face: 'up',
      knowledge: {observed, paper: {observed: [], identified: []}}});
    const fresh = session(), saved = snapshot(engine);
    assert.equal(fresh.engine.rooms[room], undefined);
    let autosaves = 0;
    fresh.engine.onAutosave = () => autosaves++;
    const restored = await restoreVisualSave(fresh.engine, JSON.stringify(packet));
    assert.equal(restored.repositioned, false, room);
    assert.deepEqual(restored.visual.knowledge, packet.visual.knowledge);
    assert.deepEqual(snapshot(fresh.engine), saved);
    assert.equal(fresh.output.length, 0, room);
    assert.equal(autosaves, 0);
    assert.ok(fresh.engine.loadedChapters.has('wabe'));
    const after = snapshot(fresh.engine);
    sceneExits(room, fresh.engine.state, fresh.engine.rooms);
    sceneBoundaries(room, fresh.engine.state, fresh.engine.rooms);
    getHotspots(fresh.engine.state);
    buildChapterMap({state: fresh.engine.state, rooms: fresh.engine.rooms, scenes: SCENES});
    assert.deepEqual(snapshot(fresh.engine), after);
    if (['herb_garden', 'the_river'].includes(room)) {
      assert.ok(fresh.engine.state.has('garlic'));
      assert.equal(getHotspots(fresh.engine.state).some(object => object.itemId === 'garlic'), false);
    }
    await run(fresh, [room === 'promontory' ? 'se' : room === 'chasms_brink' ? 'e' : room === 'herb_garden' ? 'w' : 'n']);
    assert.notEqual(fresh.engine.state.room, room, '恢复后可通过真实出口继续探索');
  }
});
