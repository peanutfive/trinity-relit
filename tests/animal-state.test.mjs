import assert from 'node:assert/strict';
import test from 'node:test';
import { GameEngine, SAVE_VERSION } from '../prototype/js/engine.js';
import { Parser } from '../prototype/js/parser.js';
import { buildIntentCandidates, suggestIntent } from '../prototype/js/intent.js';
import { discoverLemming } from '../prototype/js/animal-rules.js';
import { createGame, stubUi } from './harness.mjs';

function fixture() {
  const output = [], saves = [];
  const room = { name: '状态测试', cn: '状态测试', desc: '状态测试。', exits: {}, events: [] };
  const items = {
    cage: { en: 'birdcage', cn: '鸟笼', aliases: ['cage', 'birdcage', '鸟笼'],
      start: 'cottage', container: true, transparent: true, size: 10, mass: 6, capacity: 8 },
    magpie: { en: 'magpie', cn: '喜鹊', aliases: ['magpie', 'bird', '喜鹊'], start: 'in:cage', desc: '喜鹊。' },
    lemming: { en: 'lemming', cn: '活旅鼠', aliases: ['lemming', 'live lemming', '旅鼠', '活旅鼠'],
      start: null, size: 4, mass: 3, desc: '活旅鼠。' },
    roadrunner: { en: 'roadrunner', cn: '走鹃', aliases: ['roadrunner', 'bird', '走鹃'], start: null, size: 5, mass: 5, desc: '走鹃。' },
    dead_lemming: { en: 'dead lemming', cn: '死旅鼠', aliases: ['dead lemming', 'lemming', '旅鼠', '死旅鼠'],
      start: null, size: 3, mass: 3, desc: '死旅鼠。' },
    dead_magpie: { en: 'dead magpie', cn: '死喜鹊', aliases: ['dead magpie', 'magpie', 'bird', '死喜鹊'],
      start: null, size: 3, mass: 3, desc: '死喜鹊。' },
    dead_roadrunner: { en: 'dead roadrunner', cn: '死走鹃', aliases: ['dead roadrunner', 'roadrunner', 'bird', '死走鹃'],
      start: null, size: 5, mass: 5, desc: '死走鹃。' },
    tower_box: { en: 'box', cn: '箱面', aliases: ['box'], start: 'palace_gate', surface: true },
    ruby: { en: 'ruby', cn: '红宝石', aliases: ['ruby'], start: null },
  };
  const eng = new GameEngine({ rooms: { palace_gate: room, cottage: room, cliff_edge: room, assembly_room: room },
    items, parser: new Parser(), ui: stubUi(output), onAutosave: save => saves.push(save) });
  return { eng, output, saves, get state() { return eng.state; } };
}

const legacy = (version, itemLoc = {}, flags = []) => ({ version, state: {
  room: 'palace_gate', chapter: 'prologue', itemLoc, flags, score: 8, turns: 12,
} });

test('v3新游戏初始闭笼含喜鹊，动物阶段是可独立保存的纯值', () => {
  const g = fixture();
  assert.equal(SAVE_VERSION, 3);
  assert.equal(g.state.itemAt('cage'), 'cottage');
  assert.equal(g.state.containerOf('magpie'), 'cage');
  assert.equal(g.state.hasFlag('cage_open'), false);
  assert.equal(g.state.animals.magpie.active, true);
  const save = g.eng.serialize();
  save.state.animals.lemming.grace = 1;
  assert.equal(g.state.animals.lemming.grace, 0, '导出对象不能改活阶段');
  assert.deepEqual(JSON.parse(JSON.stringify(g.eng.serialize())).state, g.eng.serialize().state);
});

test('v3动物窗口往返不重置、不重放进入，也不共用章节timer', async () => {
  const g = fixture();
  g.state.take('lemming');
  g.state.animals.lemming = { active: true, grace: 1 };
  g.state.animals.roadrunner = { active: true, grace: 1, prepared: true, takeable: true };
  g.state.putIn('roadrunner', 'cage');
  g.state.startTimer(5, 'fixture', () => {});
  const save = g.eng.serialize();
  const restored = fixture();
  restored.eng.registerTimerHandlers({ fixture: () => {} });
  await restored.eng.deserialize(save);
  assert.deepEqual(restored.state.serialize(), save.state);
  save.state.animals.lemming.grace = 0;
  assert.equal(restored.state.animals.lemming.grace, 1, '导入也不能共享对象引用');
  assert.equal(restored.state.timer.remaining, 5);
  assert.equal(restored.saves.length, 0);
});

test('v1/v2扁平旅鼠位置规范化为笼内关系且不追补旧计分', async () => {
  for (const version of [1, 2]) {
    const g = fixture();
    const before = g.eng.serialize().state;
    const save = legacy(version, { cage: 'inventory', lemming: 'cage' }, ['cage_has_lemming', 'scored_lemming_tundra']);
    const prepared = await g.eng.prepareSave(save);
    assert.equal(prepared.version, 3);
    assert.equal(prepared.state.itemLoc.lemming, 'in:cage');
    assert.ok(prepared.state.flags.includes('cage_taken_scored'));
    assert.ok(prepared.state.flags.includes('cage_lemming_scored'));
    assert.ok(prepared.state.flags.includes('animal_lemming_discovered'));
    assert.equal(prepared.state.flags.includes('cage_has_lemming'), false);
    assert.equal(prepared.state.score, 8);
    assert.equal(prepared.state.turns, 12);
    assert.equal(prepared.state.animals.lemming.active, true);
    assert.deepEqual(g.eng.serialize().state, before);
    assert.equal(g.saves.length, 0);
    await g.eng.deserialize(prepared);
    assert.equal(g.eng.isVisible('lemming'), true);
    assert.equal(g.eng.isAccessible('lemming'), false);
  }
});

test('旧笼内flag仅补缺失位置，明确destroyed或其他位置不会被塞回笼', async () => {
  for (const [loc, expected] of [[undefined, 'in:cage'], ['destroyed', 'destroyed'], ['cliff_edge', 'cliff_edge'], ['inventory', 'inventory']]) {
    const g = fixture();
    const itemLoc = { cage: 'inventory', ...(loc === undefined ? {} : { lemming: loc }) };
    await g.eng.deserialize(legacy(2, itemLoc, ['cage_has_lemming']));
    assert.equal(g.state.itemAt('lemming'), expected);
    assert.equal(g.state.hasFlag('cage_has_lemming'), false);
    assert.equal(g.state.animals.lemming.active, expected !== 'destroyed');
    assert.equal(g.state.hasFlag('animal_lemming_discovered'), true);
    if (loc === 'destroyed') {
      g.eng.moveTo('cliff_edge');
      discoverLemming(g.state, g.eng);
      assert.equal(g.state.itemAt('lemming'), 'destroyed', '再次查看裂缝不能复活明确销毁物');
    }
  }
});

test('旧死亡或蛇吃历史不恢复活体、不创造可捡尸体、不补分', async () => {
  for (const flags of [['lemming_dead'], ['snake_killed_lemming', 'lemming_dead']]) {
    const g = fixture();
    await g.eng.deserialize(legacy(1, { cage: 'inventory', lemming: 'assembly_room' }, flags));
    assert.equal(g.state.itemAt('lemming'), 'destroyed');
    assert.equal(g.state.itemAt('dead_lemming'), undefined);
    assert.equal(g.state.animals.lemming.active, false);
    assert.equal(g.state.hasFlag('animal_lemming_discovered'), true);
    assert.equal(g.state.score, 8);
    if (flags.includes('snake_killed_lemming')) {
      assert.equal(g.state.hasFlag('snake_gone'), true);
      assert.equal(g.state.hasFlag('snake_lemming_scored'), true);
    }
  }
});

test('旧档缺新增动物不按新游戏start补喜鹊，明确毁笼保留；旧小屋门继续开着', async () => {
  for (const itemLoc of [{}, { cage: 'destroyed' }]) {
    const g = fixture();
    await g.eng.deserialize(legacy(2, itemLoc));
    assert.equal(g.state.itemAt('cage'), itemLoc.cage || 'cottage');
    for (const id of ['magpie', 'roadrunner', 'dead_magpie', 'dead_roadrunner']) assert.equal(g.state.itemAt(id), undefined);
    assert.equal(g.state.animals.magpie.active, false);
    assert.equal(g.state.animals.roadrunner.active, false);
    assert.equal(g.state.hasFlag('cottage_front_open'), true);
    assert.equal(g.state.hasFlag('cottage_back_open'), true);
  }
});

test('旧档已放下的笼也保护首取奖励，新补的笼仍可首次计分', async () => {
  const old = fixture();
  await old.eng.deserialize(legacy(2, { cage: 'palace_gate' }));
  await old.eng.processInput('take cage');
  assert.equal(old.state.score, 8);
  const fresh = fixture();
  await fresh.eng.deserialize(legacy(2));
  fresh.eng.moveTo('cottage');
  await fresh.eng.processInput('take cage');
  assert.equal(fresh.state.score, 9);
});

test('旧档明确红宝石历史保护新奖励，缺失对象不猜测已经取得', async () => {
  for (const ruby of [undefined, 'inventory', 'destroyed', 'palace_gate']) {
    const g = fixture();
    await g.eng.deserialize(legacy(2, ruby === undefined ? {} : { ruby }));
    assert.equal(g.state.hasFlag('ruby_taken_scored'), ruby !== undefined);
    assert.equal(g.state.score, 8);
    assert.equal(g.state.itemAt('ruby'), ruby);
  }
});

test('v3拒绝非法阶段、非纯值和错误死因，预检不改状态或保存', async () => {
  const g = fixture();
  const before = g.eng.serialize();
  const invalid = [
    animals => { animals.lemming.grace = 2; },
    animals => { animals.lemming.grace = 1; },
    animals => { animals.lemming.active = 'yes'; },
    animals => { animals.roadrunner.prepared = 1; },
    animals => { animals.roadrunner = null; },
    animals => { animals.deaths.dead_magpie = 'unknown'; },
    animals => { animals.deaths.dead_roadrunner = {}; },
    animals => { animals.magpie.callback = () => {}; },
    animals => { delete animals.magpie; },
    animals => { animals.extra = {}; },
  ];
  for (const mutate of invalid) {
    const save = structuredClone(before);
    mutate(save.state.animals);
    await assert.rejects(g.eng.prepareSave(save), /动物阶段/);
    await assert.rejects(g.eng.deserialize(save), /动物阶段/);
    assert.deepEqual(g.eng.serialize().state, before.state);
    assert.equal(g.saves.length, 0);
  }
});

test('v3拒绝旧双重真相和同身份活体尸体冲突，不以可访问性猜测生死', async () => {
  const g = fixture();
  const before = g.eng.serialize();
  for (const patch of [
    state => { state.itemLoc.lemming = 'cage'; },
    state => { state.flags.push('cage_has_lemming'); },
    state => { state.flags.push('lemming_dead'); },
    state => { state.itemLoc.lemming = 'palace_gate'; state.itemLoc.dead_lemming = 'palace_gate'; state.animals.deaths.dead_lemming = 'drowned'; },
    state => { state.itemLoc.lemming = 'cliff_edge'; state.itemLoc.dead_lemming = 'palace_gate'; },
    state => { state.itemLoc.magpie = 'in:cage'; state.itemLoc.dead_magpie = 'palace_gate'; },
    state => { state.itemLoc.roadrunner = 'cliff_edge'; state.itemLoc.dead_roadrunner = 'palace_gate'; },
  ]) {
    const save = structuredClone(before); patch(save.state);
    await assert.rejects(g.eng.prepareSave(save));
    assert.deepEqual(g.eng.serialize().state, before.state);
  }
  const hiddenLive = structuredClone(before);
  hiddenLive.state.itemLoc.cage = 'destroyed';
  hiddenLive.state.itemLoc.lemming = 'in:cage';
  hiddenLive.state.animals.lemming.active = true;
  const prepared = await g.eng.prepareSave(hiddenLive);
  assert.equal(prepared.state.itemLoc.lemming, 'in:cage');
  assert.equal(prepared.state.itemLoc.cage, 'destroyed');
  assert.equal(prepared.state.animals.lemming.active, true);
});

test('相同动物别名的可见活体与尸体要澄清，不推进回合或timer', async () => {
  const g = fixture();
  g.state.placeItem('lemming', 'palace_gate');
  g.state.placeItem('dead_lemming', 'palace_gate');
  let ticks = 0;
  g.state.startTimer(3, 'fixture', () => ticks++);
  assert.equal(g.eng._resolveItem('lemming'), null);
  await g.eng.processInput('take lemming');
  assert.equal(g.state.turns, 0);
  assert.equal(ticks, 0);
  assert.equal(g.state.timer.remaining, 3);
  assert.match(g.output.at(-1).text, /活旅鼠、死旅鼠/);
  assert.equal(g.state.itemAt('lemming'), 'palace_gate');
  assert.equal(g.state.itemAt('dead_lemming'), 'palace_gate');
});

test('活体已离场时普通同义词解析可见尸体，不能误抓销毁活体', async () => {
  const g = fixture();
  g.state.destroy('lemming');
  g.state.placeItem('dead_lemming', 'palace_gate');
  g.state.animals.deaths.dead_lemming = 'drowned';
  assert.equal(g.eng._resolveItem('lemming'), 'dead_lemming');
  await g.eng.processInput('take lemming');
  assert.equal(g.state.carrying('dead_lemming'), true);
  assert.equal(g.state.itemAt('lemming'), 'destroyed');
});

test('动物候选沿用规则和可访问性，闭笼不拿、喜鹊不手拿', () => {
  const g = fixture();
  g.eng.moveTo('cottage');
  let candidates = buildIntentCandidates(g.eng);
  assert.ok(candidates.some(c => c.id === 'animal:magpie:examine'));
  assert.equal(candidates.some(c => c.command.verb === 'take' && c.command.itemId === 'magpie'), false);
  g.state.putIn('dead_lemming', 'cage');
  candidates = buildIntentCandidates(g.eng);
  assert.ok(candidates.some(c => c.id === 'animal:dead_lemming:examine'));
  assert.equal(candidates.some(c => c.id === 'animal:dead_lemming:take'), false);
  g.state.setFlag('cage_open');
  assert.ok(buildIntentCandidates(g.eng).some(c => c.id === 'animal:dead_lemming:take'));
});

test('明确候选可在同名实体间选择，旧候选在动物死亡或读档后失效', async () => {
  const g = fixture();
  g.state.placeItem('lemming', 'palace_gate');
  g.state.placeItem('dead_lemming', 'palace_gate');
  const resolver = { resolve: async () => ({ kind: 'suggest', candidateIds: ['animal:dead_lemming:take'] }) };
  const suggestion = await suggestIntent(g.eng, '拿起那只死的小动物', resolver);
  const chosen = suggestion.validate('animal:dead_lemming:take');
  assert.equal(chosen.command.itemId, 'dead_lemming');
  await g.eng._runCommandTurn(chosen.command);
  assert.equal(g.state.carrying('dead_lemming'), true);
  assert.equal(g.state.itemAt('lemming'), 'palace_gate');
  assert.equal(suggestion.validate('animal:dead_lemming:take'), null);
  const another = await suggestIntent(g.eng, '拿那只活的小动物', { resolve: async () => ({ kind: 'suggest', candidateIds: ['animal:lemming:take'] }) });
  g.state.destroy('lemming');
  assert.equal(another.validate('animal:lemming:take'), null);
});

test('动物普通回合只结算一次，未知输入和免回合房间动作不消耗持有窗口', async () => {
  const g = fixture();
  g.state.take('lemming');
  g.state.animals.lemming = { active: true, grace: 1 };
  g.eng.rooms.palace_gate = { ...g.eng.rooms.palace_gate, events: [
    { id: 'free', match: { verb: ['listen'], noun: ['test'] }, advancesTurn: false, text: '测试响应。' },
  ] };
  await g.eng.processInput('这完全不是指令');
  await g.eng.processInput('listen test');
  assert.equal(g.state.turns, 0);
  assert.equal(g.state.animals.lemming.grace, 1);
  assert.equal(g.state.carrying('lemming'), true);
  await g.eng.processInput('wait');
  assert.equal(g.state.turns, 1);
  assert.equal(g.state.animals.lemming.grace, 0);
  assert.equal(g.state.carrying('lemming'), true);
  await g.eng.processInput('wait');
  assert.equal(g.state.turns, 2);
  assert.equal(g.state.itemAt('lemming'), 'destroyed');
  assert.equal(g.state.animals.lemming.active, false);
});

test('表面父项保持真实可见关系和读档，不伪造可开合容器', async () => {
  const g = fixture();
  g.state.putIn('ruby', 'tower_box');
  assert.equal(g.eng.items.tower_box.container, undefined);
  assert.equal(g.eng.containerIsOpen('tower_box'), false);
  assert.equal(g.eng.isVisible('ruby'), true);
  assert.equal(g.eng.isAccessible('ruby'), true);
  const save = g.eng.serialize();
  await g.eng.deserialize(save);
  assert.equal(g.state.containerOf('ruby'), 'tower_box');
  await g.eng.processInput('take ruby from box');
  assert.equal(g.state.carrying('ruby'), true);
  assert.equal(g.output.some(entry => entry.text.includes('out of the box')), false);
  assert.match(g.output.at(-1).text, /箱面上/);
});

test('房间动作可读取第三参数原命令，两参数事件和声明的推进契约保持兼容', async () => {
  const g = fixture();
  let received, oldCalls = 0;
  g.eng.rooms.palace_gate = { ...g.eng.rooms.palace_gate, events: [
    { id: 'source_check', match: { verb: ['take'], noun: ['ruby'] },
      act(s, eng, cmd) { assert.equal(s, g.state); assert.equal(eng, g.eng); received = cmd; return { advancesTurn: false }; },
      text: '来源校验。' },
    { id: 'old_action', match: { verb: ['listen'], noun: ['test'] }, advancesTurn: false,
      act(s, eng) { assert.equal(s, g.state); assert.equal(eng, g.eng); oldCalls++; }, text: '旧动作。' },
  ] };
  await g.eng.processInput('take ruby from cage');
  assert.equal(received.verb, 'take');
  assert.equal(received.prep, 'from');
  assert.equal(received.noun2, 'cage');
  assert.equal(g.state.turns, 1, 'act返回值不更改事件的推进声明');
  await g.eng.processInput('listen test');
  assert.equal(oldCalls, 1);
  assert.equal(g.state.turns, 1);
});

test('闭门壁橱共享袋内木片光照，look与喜鹊开笼选同一分支', async () => {
  const g = createGame();
  g.state.clearTimer();
  g.state.setFlag('snake_gone');
  for (const id of ['cage', 'empty_bag', 'splinter']) g.state.take(id);
  await g.eng.transitionChapter({ to: 'ranch', roomCandidates: ['closet'] });
  await g.eng.processInput('put splinter in paper bag');
  assert.equal(g.state.containerOf('splinter'), 'empty_bag');
  await g.eng.processInput('close door');
  assert.equal(g.eng.isVisible('splinter'), true);
  const start = g.output.length;
  await g.eng.processInput('look');
  const description = g.output.slice(start).map(entry => entry.text).join('\n');
  assert.match(description, /Its single closed door is in the south wall/);
  assert.doesNotMatch(description, /completely dark/);
  const releaseStart = g.output.length;
  await g.eng.processInput('open cage');
  assert.match(g.output.slice(releaseStart).map(entry => entry.text).join('\n'), /circles around the inside of the closet/);
  assert.equal(g.state.containerOf('magpie'), 'cage');
  assert.equal(g.state.hasFlag('cage_open'), false);
});
