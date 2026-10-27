import test from 'node:test';
import assert from 'node:assert/strict';
import { createPrologueSession } from '../engine-adapter.js';
import { getHotspots, getInventoryActions } from '../interaction-catalog.js';
import { resolveInteraction, resolveHeldSelf } from '../interaction-intent.js';
import { makeVisualSave, restoreVisualSave, VISUAL_SAVE_KEY } from '../save.js';
import { SCENES } from '../scene-manifest.js';
import { ROOMS as PROLOGUE } from '../../js/data/prologue.js';
import { ROOMS as JAPAN } from '../../js/data/japan.js';

function game() {
  const output = [];
  const ui = Object.fromEntries(['text', 'system', 'inventory', 'location', 'userInput']
    .map(name => [name, (...args) => output.push(args.join('\n'))]));
  return {engine: createPrologueSession({ui}), output, observed: new Set()};
}
async function command(g, input, {fatal = false} = {}) {
  const from = g.output.length;
  await g.engine.processInput(input);
  const text = g.output.slice(from).join('\n');
  assert.doesNotMatch(text, /这句话无法识别|错误：|尚未开放|没有可进入的起始房间/, input);
  assert.equal(g.engine.state.dead, fatal, input);
  return text;
}
async function interact(g, id, heldItem = null) {
  const object = getHotspots(g.engine.state).find(object => object.id === id);
  assert.ok(object, `missing ${id}`);
  const input = resolveInteraction(g.engine.state, object, {heldItem, observed: g.observed});
  assert.ok(input, `no intention for ${id}/${heldItem}`);
  const turns = g.engine.state.turns;
  const text = await command(g, input);
  g.observed.add(id);
  assert.equal(g.engine.state.turns, turns + 1, `${input} settles one original turn`);
  return {input, text};
}
async function reachVertex(g) {
  g.engine.moveTo(g.engine.state.room);
  for (const input of ['e', 'take ball', 'nw', 'unscrew gnomon', 'take gnomon',
    'n', 'take paper bird', 'open paper bird', 'w', 'buy crumbs', 'feed birds',
    'take ruby', 'n', 'push pram', 'push pram', 'wait', 'throw ball at tree',
    'take umbrella', 'push pram', 'open pram', 'enter pram', 'open umbrella',
    'take paper bird', 'take gnomon', 'enter water', 'enter door', 'n', 'ne', 'e', 'u'])
    await command(g, input);
  assert.equal(g.engine.state.room, 'vertex');
  assert.equal(g.engine.state.chapter, 'wabe');
  assert.ok(g.engine.state.has('umbrella'));
  assert.ok(g.engine.state.has('paper_bird'));
  assert.ok(g.engine.state.hasFlag('bird_unfolded'));
}
async function reachMoor(g, symbol = 1) {
  await reachVertex(g);
  await interact(g, 'vertex:ring');
  for (let turns = 0; g.engine.state.sundialSymbol !== symbol && turns < 7; turns++)
    assert.equal((await interact(g, 'vertex:ring')).input, 'turn ring');
  assert.equal(g.engine.state.sundialSymbol, symbol);
  for (const input of ['d', 'e', 'e']) await command(g, input);
  assert.equal(g.engine.state.room, 'moor');
}
async function reachPlayground(g) {
  await reachMoor(g);
  assert.equal((await interact(g, 'moor:mushroom-gate', 'umbrella')).input, 'look');
  assert.equal((await interact(g, 'moor:mushroom-gate', 'umbrella')).input, 'in');
  assert.equal(g.engine.state.chapter, 'japan');
  assert.equal(g.engine.state.room, 'playground');
}
const snapshot = g => {
  const {version, state} = g.engine.serialize();
  return JSON.parse(JSON.stringify({version, state}));
};
function visualSave(g) {
  const [x, y] = SCENES[g.engine.state.room].spawn;
  return makeVisualSave(g.engine, {room: g.engine.state.room, x, y, face: 'left',
    knowledge: {observed: [...g.observed], paper: {observed: [], identified: []}}});
}

test('2D入口仅按需加载Wabe和Japan，不污染文字版房间字典或其他session', async () => {
  const original = Object.keys(PROLOGUE), a = game(), b = game();
  assert.equal(a.engine.rooms.playground, undefined);
  assert.equal(await a.engine.activateChapter('japan'), true);
  assert.equal(a.engine.rooms.playground, JAPAN.playground);
  assert.equal(a.engine.rooms.shelter, JAPAN.shelter);
  assert.equal(b.engine.rooms.playground, undefined);
  assert.deepEqual(Object.keys(PROLOGUE), original);
  assert.equal(await a.engine.activateChapter('underground'), false);
  assert.equal(await a.engine.activateChapter('__proto__'), false);
  assert.equal(a.engine.rooms.underground, undefined);
  assert.notEqual(VISUAL_SAVE_KEY, 'trinity-relit:save:v1');
});

test('转环选择Mars后穿门，等待女孩、交伞、拾铲、折纸、骑鸟返回只执行原章动作', async () => {
  const g = game();
  await reachPlayground(g);
  const state = g.engine.state;
  assert.equal(state.itemAt('spade'), 'shelter');
  assert.equal(getHotspots(state).some(object => object.kind === 'japan_girl'), false);
  assert.equal(getHotspots(state).some(object => object.kind === 'spade'), false);
  const before = snapshot(g);
  for (let i = 0; i < 4; i++) {
    getHotspots(state); getInventoryActions('paper_bird', state);
    resolveHeldSelf('paper_bird', state);
  }
  assert.deepEqual(snapshot(g), before, 'querying the visual catalog never advances the story');
  assert.equal((await interact(g, 'playground:children')).input, 'wait');
  assert.ok(state.hasFlag('girl_found_playground'));
  assert.equal((await interact(g, 'playground:girl', 'umbrella')).input, 'give umbrella to girl');
  assert.equal(state.itemAt('umbrella'), 'destroyed');
  assert.equal(getHotspots(state).some(object => object.kind === 'japan_girl'), false);
  assert.equal((await interact(g, 'playground:shelter-entry', 'paper_bird')).input, 'e');
  assert.equal(state.room, 'shelter');
  assert.equal(getHotspots(state).filter(object => object.kind === 'japan_girl').length, 1);
  assert.equal((await interact(g, 'japan:item:spade')).input, 'examine spade');
  assert.equal((await interact(g, 'japan:item:spade')).input, 'take spade');
  assert.ok(state.has('spade'));
  assert.equal(getHotspots(state).some(object => object.itemId === 'spade'), false);
  assert.equal((await interact(g, 'shelter:girl', 'paper_bird')).input, 'give paper to girl');
  assert.equal(state.hasFlag('bird_unfolded'), false);
  assert.ok(state.has('paper_bird'));
  assert.equal(state.score, before.state.score + 4);
  assert.equal(resolveInteraction(state, getHotspots(state).find(object => object.kind === 'japan_girl'),
    {heldItem: 'paper_bird'}), null, 'folded paper does not offer refolding again');
  await command(g, 'w');
  assert.equal(state.room, 'playground');
  const ride = resolveHeldSelf('paper_bird', state);
  assert.equal(ride, 'ride bird');
  await command(g, ride);
  assert.equal(state.chapter, 'wabe'); assert.equal(state.room, 'moor');
  assert.ok(state.has('spade')); assert.ok(state.has('paper_bird'));
  assert.ok(state.hasFlag('wabe_to_japan_used'));
});

test('非Mars符号的蘑菇门保留原拒绝，观察和尝试都不会替玩家切换符号', async () => {
  const g = game(); await reachMoor(g, 2);
  assert.equal((await interact(g, 'moor:mushroom-gate')).input, 'look');
  const failed = await interact(g, 'moor:mushroom-gate');
  assert.equal(failed.input, 'in'); assert.match(failed.text, /The mushroom door is closed/);
  assert.equal(g.engine.state.sundialSymbol, 2);
  assert.equal(g.engine.state.room, 'moor'); assert.equal(g.engine.state.chapter, 'wabe');
  assert.equal(g.engine.state.hasFlag('wabe_to_japan_used'), false);
});

test('Japan白门可以直接返回，不要求先替玩家完成女孩谜题', async () => {
  const g = game(); await reachPlayground(g);
  assert.equal((await interact(g, 'playground:white-door', 'paper_bird')).input, 'look');
  assert.equal((await interact(g, 'playground:white-door', 'paper_bird')).input, 'enter door');
  assert.equal(g.engine.state.room, 'moor'); assert.equal(g.engine.state.chapter, 'wabe');
  assert.equal(g.engine.state.hasFlag('girl_found_playground'), false);
  assert.equal(g.engine.state.itemAt('spade'), 'shelter');
});

test('跨章存档恢复Japan女孩与铲子状态，回Moor读档后仍可重新进入Japan', async () => {
  const g = game(); await reachPlayground(g);
  await interact(g, 'playground:children');
  await interact(g, 'playground:girl', 'umbrella');
  await interact(g, 'playground:shelter-entry');
  await interact(g, 'japan:item:spade'); await interact(g, 'japan:item:spade');
  const saved = visualSave(g), expected = snapshot(g), restored = game();
  await restoreVisualSave(restored.engine, JSON.stringify(saved));
  assert.deepEqual(snapshot(restored), expected);
  assert.ok(restored.engine.rooms.moor, 'visited chapters are loaded before restoring');
  assert.ok(restored.engine.rooms.playground);
  assert.equal(getHotspots(restored.engine.state).some(object => object.itemId === 'spade'), false);
  assert.ok(getHotspots(restored.engine.state).some(object => object.id === 'shelter:girl'));
  await interact(restored, 'shelter:girl', 'paper_bird');
  await command(restored, 'out');
  await command(restored, resolveHeldSelf('paper_bird', restored.engine.state));
  const returnedSave = visualSave(restored), returned = game();
  await restoreVisualSave(returned.engine, returnedSave);
  assert.equal(returned.engine.state.chapter, 'wabe');
  assert.equal(returned.engine.state.room, 'moor');
  assert.ok(returned.engine.state.has('spade'));
  await interact(returned, 'moor:mushroom-gate'); await interact(returned, 'moor:mushroom-gate');
  await interact(returned, 'playground:shelter-entry');
  assert.equal(returned.engine.state.itemAt('spade'), 'inventory', 'onEnter does not re-place a collected spade');
  assert.equal(getHotspots(returned.engine.state).filter(object => object.kind === 'japan_girl').length, 1);
});

test('地上物品与女孩状态只读显隐；南北致命边界继续由原规则执行', async () => {
  const g = game(); await reachPlayground(g);
  await command(g, 'e');
  assert.equal(getHotspots(g.engine.state).some(object => object.kind === 'japan_girl'), false,
    'before the umbrella gift the girl is not already inside');
  await command(g, 'take spade'); await command(g, 'drop spade');
  assert.equal(getHotspots(g.engine.state).filter(object => object.itemId === 'spade').length, 1);
  await command(g, 'w');
  await command(g, 'drop paper bird');
  assert.equal(getHotspots(g.engine.state).filter(object => object.itemId === 'paper_bird').length, 1);
  await command(g, 'take paper bird');
  const saved = snapshot(g);
  for (const direction of ['n', 's']) {
    const fatal = game(); await fatal.engine.deserialize(saved);
    await command(fatal, direction, {fatal: true});
  }
});
