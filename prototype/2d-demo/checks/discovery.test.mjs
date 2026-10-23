import test from 'node:test';
import assert from 'node:assert/strict';
import { createDiscovery, PAPER_CRAFT_ID } from '../discovery.js';
import { createPrologueSession } from '../engine-adapter.js';
import { getHotspots } from '../prologue-actions.js';
import { ROOMS } from '../../js/data/prologue.js';

function pond() {
  const engine = createPrologueSession();
  engine.state.room = 'round_pond';
  return engine;
}

function discoveryParagraphs() {
  const view = known => Object.freeze({ inRoom: id => id === 'paper_bird', hasFlag: flag => flag === 'seen_paper_bird' && known });
  const paragraphs = text => text.split(/\n\s*\n/);
  const base = paragraphs(ROOMS.round_pond.desc(view(true)));
  return paragraphs(ROOMS.round_pond.desc(view(false))).filter(part => !base.includes(part));
}

test('小船和折纸鸟为同ID同锚点对象，观察前不泄露名称或拿取动作', () => {
  const { state } = pond();
  const discovery = createDiscovery();
  const source = getHotspots(state);
  const original = structuredClone(source);
  const before = state.serialize();
  const unknown = discovery.mapHotspots(state, source);
  const craft = unknown.find(object => object.id === PAPER_CRAFT_ID);
  assert.equal(unknown.filter(object => object.itemId === 'paper_bird' || object.id === 'round_pond:boats').length, 1);
  assert.equal(craft.label, '白色的小船');
  assert.equal(craft.kind, 'paper_boat');
  assert.deepEqual(craft.actions, [{ label: '观察小船', command: 'examine boats' }]);
  assert.equal(unknown.some(object => /折纸|纸鸟/.test(object.label)), false);
  const result = discovery.inspect(state, { command: 'examine boats', success: true });
  assert.equal(result.ok, true);
  const known = discovery.mapHotspots(state, source).find(object => object.id === PAPER_CRAFT_ID);
  assert.equal(known.label, '折纸鸟');
  assert.equal(known.kind, 'paper_bird');
  assert.deepEqual([known.id, known.x, known.y], [craft.id, craft.x, craft.y]);
  assert.ok(known.actions.some(action => action.label === '伸手拿取' && action.command === 'take paper bird'));
  assert.deepEqual(state.serialize(), before);
  assert.deepEqual(source, original);
  assert.equal(state.hasFlag('seen_paper_bird'), false);
});

test('识别不依赖引擎的提前seen标记，原章节发现全文只输出一次且保留环境描述', async () => {
  const engine = pond();
  const { state } = engine;
  ROOMS.round_pond.onEnter(state);
  assert.equal(state.hasFlag('seen_paper_bird'), true, '当前章节进入时即设置seen标记');
  const discovery = createDiscovery();
  assert.equal(discovery.mapHotspots(state, getHotspots(state)).find(object => object.id === PAPER_CRAFT_ID).label, '白色的小船');
  const paragraphs = discoveryParagraphs();
  assert.equal(paragraphs.length, 2, '完整的英文和中文发现段落');
  const withDiscovery = ROOMS.round_pond.desc({ inRoom: id => state.inRoom(id), hasFlag: () => false });
  const expectedEnvironment = ROOMS.round_pond.desc(state);
  assert.equal(discovery.filterOutput(withDiscovery, state), expectedEnvironment);
  const flagsBefore = [...state.flags];
  await engine.processInput('examine boats');
  const first = discovery.inspect(state, { command: 'examine boats', success: true });
  assert.equal(first.text, paragraphs.join('\n\n'));
  const second = discovery.inspect(state, { command: 'examine boats', success: true });
  assert.equal(second.text, '');
  assert.equal(second.newlyIdentified, false);
  for (const paragraph of paragraphs) {
    const output = `${expectedEnvironment}\n\n${first.text}\n\n${second.text}`;
    assert.equal(output.split(paragraph).length - 1, 1);
  }
  assert.deepEqual([...state.flags], flagsBefore);
});

test('未识别时过滤章节自动发现段，船队、鸭子与道路段和其他文本原样保留', () => {
  const { state } = pond();
  const discovery = createDiscovery();
  const full = ROOMS.round_pond.desc(state);
  const paragraphs = discoveryParagraphs();
  const expected = full.split(/\n\s*\n/).filter(part => !paragraphs.includes(part)).join('\n\n');
  assert.equal(discovery.filterOutput(full, state), expected);
  assert.equal(expected.split(/\n\s*\n/).length, 4);
  const boats = ROOMS.round_pond.events.find(event => event.id === 'examine_boats');
  const boatText = boats.text(Object.freeze({ inRoom: () => true, hasFlag: () => true }));
  assert.equal(discovery.filterOutput(`${boatText}\n\n${paragraphs.join('\n\n')}`, state), boatText);
  const environment = ROOMS.round_pond.events.find(event => event.id === 'examine_pond').text;
  assert.equal(discovery.filterOutput(environment, state), environment);
  assert.equal(discovery.filterOutput('plain\n\n  unchanged\n\n', state), 'plain\n\n  unchanged\n\n');
});

test('真实观察命令已输出发现段时，先过滤后识别仍只显示一份原文', async () => {
  const output = [];
  const ui = Object.fromEntries(['text', 'system', 'inventory', 'location', 'userInput']
    .map(name => [name, text => { if (typeof text === 'string') output.push(text); }]));
  const engine = createPrologueSession({ ui });
  engine.state.room = 'round_pond';
  const discovery = createDiscovery();
  await engine.processInput('examine boats');
  const originalState = engine.state.serialize();
  const filtered = output.map(text => discovery.filterOutput(text, engine.state));
  const result = discovery.inspect(engine.state, { command: 'examine boats', success: true });
  const shown = [...filtered, result.text].join('\n\n');
  for (const paragraph of discoveryParagraphs()) {
    assert.ok(output.some(text => text.includes(paragraph)), '确实覆盖章节原有发现输出');
    assert.equal(shown.split(paragraph).length - 1, 1);
  }
  assert.deepEqual(engine.state.serialize(), originalState, '过滤与识别不改变引擎状态');
});

test('拿走后合并对象消失，放回后仍为已识别的同一对象', async () => {
  const engine = pond(), { state } = engine;
  const discovery = createDiscovery();
  discovery.inspect(state, { command: 'examine boats', success: true });
  await engine.processInput('take paper bird');
  assert.equal(state.has('paper_bird'), true);
  const taken = discovery.mapHotspots(state, getHotspots(state));
  assert.equal(taken.some(object => object.id === PAPER_CRAFT_ID || object.id === 'round_pond:boats' || object.itemId === 'paper_bird'), false);
  await engine.processInput('drop paper bird');
  const returned = discovery.mapHotspots(state, getHotspots(state)).find(object => object.id === PAPER_CRAFT_ID);
  assert.equal(returned.label, '折纸鸟');
  assert.deepEqual([returned.x, returned.y], [300, 176]);
});

test('检查失败、错误房间、错误命令或对象不在场时不增加观察知识', () => {
  for (const scenario of [
    { success: false }, { success: undefined }, { success: 'true' },
    { success: true, command: 'take paper bird' }, { success: true, room: 'long_water' },
    { success: true, take: true },
  ]) {
    const { state } = pond();
    if (scenario.room) state.room = scenario.room;
    if (scenario.take) state.take('paper_bird');
    const before = state.serialize(), discovery = createDiscovery();
    const result = discovery.inspect(state, { command: 'examine boats', ...scenario });
    assert.equal(result.ok, false);
    assert.equal(result.text, '');
    assert.deepEqual(discovery.snapshot(), { observed: [], identified: [] });
    assert.deepEqual(state.serialize(), before);
  }
});

test('观察知识可JSON持久化；恢复替换状态、拒绝坏档且不共享外部数组', () => {
  const { state } = pond();
  const first = createDiscovery();
  first.inspect(state, { command: 'examine boats', success: true });
  const saved = JSON.parse(JSON.stringify(first.snapshot()));
  const second = createDiscovery(saved);
  saved.observed.length = 0;
  assert.deepEqual(second.snapshot(), first.snapshot());
  assert.equal(second.mapHotspots(state, getHotspots(state)).find(object => object.id === PAPER_CRAFT_ID).label, '折纸鸟');
  assert.equal(second.inspect(state, { command: 'examine boats', success: true }).text, '');
  const before = second.snapshot();
  for (const invalid of [null, [], {}, { observed: [], identified: [PAPER_CRAFT_ID] }, { observed: [1], identified: [] }, { observed: ['unknown'], identified: [] }]) {
    assert.equal(second.restore(invalid), false);
    assert.deepEqual(second.snapshot(), before);
  }
  const copy = second.snapshot();
  copy.identified.length = 0;
  assert.deepEqual(second.snapshot(), before);
  assert.equal(second.restore({ observed: [], identified: [] }), true);
  assert.equal(second.mapHotspots(state, getHotspots(state)).find(object => object.id === PAPER_CRAFT_ID).label, '白色的小船');
  assert.equal(state.hasFlag('seen_paper_bird'), false);
});

test('其他房间的热点与输出保持不变，不改变原state', () => {
  const { state } = createPrologueSession();
  const discovery = createDiscovery();
  const before = state.serialize(), source = getHotspots(state);
  assert.equal(discovery.mapHotspots(state, source), source);
  const text = ROOMS.palace_gate.desc(state);
  assert.equal(discovery.filterOutput(text, state), text);
  assert.deepEqual(state.serialize(), before);
});
