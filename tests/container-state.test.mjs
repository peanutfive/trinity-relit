import assert from 'node:assert/strict';
import test from 'node:test';
import { GameEngine, GameState, SAVE_VERSION } from '../prototype/js/engine.js';
import { Parser } from '../prototype/js/parser.js';
import { buildIntentCandidates, suggestIntent } from '../prototype/js/intent.js';
import { stubUi } from './harness.mjs';

function fixture() {
  const output = [], saves = [];
  const items = {
    box: { cn: '透明盒', aliases: ['box'], container: true, transparent: true,
      open: s => s.hasFlag('box_open'), start: 'inventory' },
    opaque: { cn: '不透明盒', aliases: ['opaque'], container: true, open: false, start: 'palace_gate' },
    card: { cn: '测试卡', aliases: ['card'], desc: '卡片描述。', start: 'in:box' },
    bag: { cn: '满袋', aliases: ['bag'], container: true, start: null },
    empty_bag: { cn: '空袋', aliases: ['bag', 'paper bag'], container: true, start: null },
    soggy_bag: { cn: '湿袋', aliases: ['bag', 'soggy bag'], container: true, start: null },
    stone: { cn: '石头', aliases: ['stone'], start: 'palace_gate' },
  };
  const room = { name: '夹具房间', cn: '夹具房间', desc: '用于验证容器。', exits: {}, events: [] };
  const eng = new GameEngine({ rooms: { palace_gate: room }, items, parser: new Parser(),
    ui: stubUi(output), onAutosave: save => saves.push(save) });
  return { eng, output, saves, get state() { return eng.state; } };
}

test('直接容器关系只有一份位置，移动父项不复制或提升内容物', () => {
  const s = new GameState();
  s.take('bag');
  s.putIn('card', 'bag');
  assert.equal(s.containerOf('card'), 'bag');
  assert.deepEqual(s.contents('bag'), ['card']);
  assert.equal(s.has('card'), false);
  assert.equal(s.carrying('card'), false);
  assert.equal(s.carryCount(), 1);
  s.drop('bag');
  assert.equal(s.itemAt('card'), 'in:bag');
  s.toPocket('bag');
  assert.deepEqual(s.contents('pocket'), ['bag']);
  assert.equal(s.containerOf('bag'), null);
  assert.equal(s.carryCount(), 0);
});

test('putIn拒绝自身、间接循环和已有坏链，失败不改变位置', () => {
  const s = new GameState();
  s.take('a');
  s.putIn('b', 'a');
  s.putIn('c', 'b');
  const before = s.serialize();
  for (const args of [['a', 'a'], ['a', 'c'], ['bad', ''], ['__proto__', 'a']]) {
    assert.throws(() => s.putIn(...args));
    assert.deepEqual(s.serialize(), before);
  }
  s.itemLoc.x = 'in:y';
  s.itemLoc.y = 'in:x';
  assert.throws(() => s.putIn('z', 'x'));
  assert.equal(s.itemAt('z'), undefined);
});

test('透明闭容器可见但不可取，不透明闭容器隐藏；嵌套查询遵守全部父项', () => {
  const g = fixture();
  assert.equal(g.eng.isVisible('card'), true);
  assert.equal(g.eng.isAccessible('card'), false);
  g.state.setFlag('box_open');
  assert.equal(g.eng.isAccessible('card'), true);
  g.state.putIn('box', 'opaque');
  assert.equal(g.eng.isVisible('card'), false);
  assert.equal(g.eng.isAccessible('card'), false);
  g.state.take('box');
  g.state.toPocket('empty_bag');
  g.state.putIn('card', 'empty_bag');
  assert.equal(g.eng.isVisible('card'), true);
  assert.equal(g.eng.isAccessible('card'), false, '先从口袋拿出袋子，才能直接取其内容');
});

test('销毁父对象不销毁其内容，但该内容不再可见或可取', () => {
  const g = fixture();
  g.state.putIn('card', 'empty_bag');
  g.state.destroy('empty_bag');
  assert.equal(g.state.itemAt('card'), 'in:empty_bag');
  assert.equal(g.eng.isVisible('card'), false);
  assert.equal(g.eng.isAccessible('card'), false);
  assert.equal(g.eng._resolveItem('card'), 'card', '唯一ID仍能解析，执行时检查访问');
});

test('共享bag别名优先可见形态，独有ID不因不可见而丢失', () => {
  const g = fixture();
  g.state.destroy('bag');
  g.state.take('empty_bag');
  assert.equal(g.eng._resolveItem('bag'), 'empty_bag');
  g.state.destroy('empty_bag');
  g.state.placeItem('soggy_bag', 'palace_gate');
  assert.equal(g.eng._resolveItem('bag'), 'soggy_bag');
  assert.equal(g.eng._resolveItem('empty_bag'), 'empty_bag');
});

test('通用拿取检查闭容器、from来源和顶层8件上限', async () => {
  const g = fixture();
  await g.eng.processInput('take card from box');
  assert.equal(g.state.itemAt('card'), 'in:box');
  g.state.setFlag('box_open');
  await g.eng.processInput('take card from opaque');
  assert.equal(g.state.itemAt('card'), 'in:box');
  for (let i = 0; i < 7; i++) g.state.take(`held_${i}`);
  assert.equal(g.state.carryCount(), 8);
  await g.eng.processInput('take card from box');
  assert.equal(g.state.itemAt('card'), 'in:box');
  g.state.drop('held_0');
  await g.eng.processInput('take card from box');
  assert.equal(g.state.itemAt('card'), 'inventory');
  assert.equal(g.state.carryCount(), 8);
});

test('从口袋拿出也受8件上限约束；错误from不移动物品', async () => {
  const g = fixture();
  g.state.toPocket('stone');
  for (let i = 0; i < 7; i++) g.state.take(`held_${i}`);
  await g.eng.processInput('take stone from pocket');
  assert.equal(g.state.itemAt('stone'), 'pocket');
  g.state.drop('held_0');
  await g.eng.processInput('take stone from box');
  assert.equal(g.state.itemAt('stone'), 'pocket');
  await g.eng.processInput('take stone from pocket');
  assert.equal(g.state.itemAt('stone'), 'inventory');
  assert.equal(g.state.carryCount(), 8);
});

test('通用检查和背包呈现可见内容，不将内容物提升为顶层', async () => {
  const g = fixture();
  await g.eng.processInput('examine card');
  assert.ok(g.output.some(line => line.text.includes('卡片描述')));
  g.output.length = 0;
  await g.eng.processInput('inventory');
  const inventory = g.output.find(line => line.type === 'inventory').text;
  assert.match(inventory, /透明盒\n\s+· 测试卡/);
  assert.equal(inventory.match(/测试卡/g).length, 1);
  assert.equal(g.state.itemAt('card'), 'in:box');
});

test('按状态变化的原版对象名用于拿出响应和语义例句，不输出函数源码', async () => {
  const g = fixture();
  g.eng.items.card.en = s => s.hasFlag('unfolded') ? 'piece of paper' : 'paper bird';
  g.eng.items.box.en = 'paper bag';
  g.state.setFlag('unfolded');
  g.state.setFlag('box_open');
  const candidate = buildIntentCandidates(g.eng).find(entry => entry.id === 'item:take:card');
  assert.ok(candidate.examples.includes('take piece of paper'));
  await g.eng.processInput('take card from box');
  assert.ok(g.output.some(line => line.text.includes('You take the piece of paper out of the paper bag.')));
  assert.equal(g.output.some(line => line.text.includes('=>')), false);
});

test('v3往返容器链，允许内容留在已销毁的旧袋里且仍不可访问', async () => {
  const g = fixture();
  g.state.putIn('card', 'empty_bag');
  g.state.destroy('empty_bag');
  const save = g.eng.serialize();
  assert.equal(SAVE_VERSION, 3);
  const restored = fixture();
  await restored.eng.deserialize(JSON.parse(JSON.stringify(save)));
  assert.deepEqual(restored.eng.serialize().state, save.state);
  assert.equal(restored.eng.isVisible('card'), false);
  assert.equal(restored.eng.isAccessible('card'), false);
});

test('v1准备为规范v3，不替换活状态或保存，不复活明确destroyed物品', async () => {
  const g = fixture();
  const before = g.eng.serialize().state;
  const legacy = { version: 1, savedAt: '2000-01-01T00:00:00.000Z', state: {
    room: 'palace_gate', chapter: 'prologue', itemLoc: { box: 'destroyed', card: 'pocket', bag: 'destroyed' },
  } };
  const prepared = await g.eng.prepareSave(legacy);
  assert.equal(prepared.version, 3);
  assert.equal(prepared.savedAt, legacy.savedAt);
  assert.equal(prepared.state.itemLoc.box, 'destroyed');
  assert.equal(prepared.state.itemLoc.bag, 'destroyed');
  assert.equal(prepared.state.itemLoc.empty_bag, undefined);
  assert.deepEqual(g.eng.serialize().state, before);
  assert.equal(g.saves.length, 0);
  assert.equal(await g.eng.validateSave(prepared), true);
  await g.eng.deserialize(prepared);
  assert.equal(g.state.itemAt('card'), 'pocket');
});

test('v1不能伪装容器格式，未来版本和v2非法父项/循环拒绝且不改活状态', async () => {
  const g = fixture();
  const before = g.eng.serialize();
  const base = { box: 'inventory', card: 'in:box', empty_bag: 'inventory' };
  const invalid = [
    { version: 1, itemLoc: base }, { version: 4, itemLoc: base },
    { itemLoc: { ...base, card: 'in:unknown' } },
    { itemLoc: { ...base, unknown: 'in:box' } },
    { itemLoc: { ...base, card: 'in:stone' } },
    { itemLoc: { box: 'inventory', card: 'in:empty_bag' } },
    { itemLoc: { ...base, card: 'in:' } },
    { itemLoc: { ...base, box: 'in:empty_bag', empty_bag: 'in:box' } },
    { itemLoc: { ...base, box: 'in:box' } },
  ];
  for (const patch of invalid) {
    const save = { ...before, version: patch.version ?? 2, state: { ...before.state, itemLoc: patch.itemLoc } };
    await assert.rejects(g.eng.prepareSave(save));
    await assert.rejects(g.eng.deserialize(save));
    assert.deepEqual(g.eng.serialize().state, before.state);
    assert.equal(g.saves.length, 0);
  }
});

test('内容物语义候选共享访问和容量判断，闭笼不提供拿取选项', () => {
  const g = fixture();
  const ids = () => buildIntentCandidates(g.eng).map(candidate => candidate.id);
  assert.ok(ids().includes('item:examine:card'));
  assert.equal(ids().includes('item:take:card'), false);
  g.state.setFlag('box_open');
  assert.ok(ids().includes('item:take:card'));
  for (let i = 0; i < 7; i++) g.state.take(`held_${i}`);
  assert.equal(ids().includes('item:take:card'), false);
  g.state.putIn('box', 'opaque');
  assert.equal(ids().includes('item:examine:card'), false);
});

test('内容物选项在容器状态改变或移走后失效，确认不会穿过旧可见性', async () => {
  const g = fixture();
  g.state.setFlag('box_open');
  const resolver = { resolve: async () => ({ kind: 'suggest', candidateIds: ['item:take:card'] }) };
  const suggestion = await suggestIntent(g.eng, '把里面那张卡拿给我', resolver);
  assert.equal(suggestion.validate('item:take:card').command.noun, 'card');
  g.state.clearFlag('box_open');
  assert.equal(suggestion.validate('item:take:card'), null);
  assert.equal(g.state.itemAt('card'), 'in:box');
});
