import test from 'node:test';
import assert from 'node:assert/strict';
import { createPrologueSession } from '../engine-adapter.js';
import { getHotspots, getInventoryActions, pramRoom } from '../prologue-actions.js';
import { ROOMS, TIMERS } from '../../js/data/prologue.js';
import { Parser } from '../../js/parser.js';

function game() {
  const output = [];
  const ui = Object.fromEntries(['text', 'system', 'inventory', 'location', 'userInput'].map(name => [name, (...args) => output.push(args.join('\n'))]));
  return { engine: createPrologueSession({ ui }), output };
}
async function command(game, input) {
  const begin = game.output.length;
  await game.engine.processInput(input);
  assert.equal(game.engine.state.dead, false, input);
  assert.doesNotMatch(game.output.slice(begin).join('\n'), /这句话无法识别|错误：|尚未开放/, input);
}
async function choose(game, input) {
  const state = game.engine.state;
  const actions = [...getHotspots(state).flatMap(object => object.actions), ...state.inventoryList().flatMap(({ id }) => getInventoryActions(id, state))];
  assert.ok(actions.some(action => action.command === input), `${state.room} 没有可用的图形动作 ${input}`);
  await command(game, input);
}

test('目录只读、引用真实事件，动作均可解析，隐藏对象不会提前显示', () => {
  const { engine } = game();
  const parser = new Parser();
  for (const room of Object.keys(ROOMS)) {
    engine.state.room = room;
    const before = engine.state.serialize();
    const objects = getHotspots(engine.state);
    assert.deepEqual(engine.state.serialize(), before);
    assert.equal(new Set(objects.map(object => object.id)).size, objects.length);
    for (const object of objects) {
      assert.ok(Number.isFinite(object.x) && Number.isFinite(object.y));
      if (object.eventId) assert.ok(ROOMS[room].events.some(event => event.id === object.eventId), `${room}/${object.eventId}`);
      for (const action of object.actions) assert.ok(parser.parse(action.command), action.command);
    }
  }
  engine.state.room = 'broad_walk';
  assert.equal(getHotspots(engine.state).some(object => object.kind === 'ruby'), false);
  engine.state.room = 'long_water';
  assert.equal(getHotspots(engine.state).some(object => object.kind === 'door' || object.kind === 'missile'), false);
  engine.state.room = 'lancaster_gate';
  assert.equal(getHotspots(engine.state).some(object => object.id === 'lancaster_gate:umbrella-tree'), false);
});

test('当前规则回归：序章操作均由热点/背包目录完成，经既有引擎进入 Meadow', async () => {
  const g = game(), state = g.engine.state;
  await command(g, 'e');
  await choose(g, 'take ball');
  assert.ok(state.has('ball'));
  await command(g, 'nw');
  await choose(g, 'take gnomon');
  assert.equal(state.has('gnomon'), false, '未旋下前必须由原事件阻挡');
  await choose(g, 'unscrew gnomon');
  await choose(g, 'take gnomon');
  await command(g, 'n');
  await choose(g, 'take paper bird');
  await choose(g, 'open paper bird');
  await choose(g, 'read paper bird');
  await command(g, 'w');
  await choose(g, 'buy crumbs');
  assert.ok(state.has('bag'));
  assert.equal(getInventoryActions('bag', state).some(action => action.label === '放下'), false);
  await choose(g, 'feed birds');
  assert.ok(getHotspots(state).some(object => object.kind === 'ruby'));
  await choose(g, 'take ruby');
  assert.ok(state.hasFlag('wind_changed'));
  assert.equal(getHotspots(state).some(object => object.kind === 'ruby'), false);
  await command(g, 'n');
  assert.equal(pramRoom(state), state.room);
  await choose(g, 'push pram');
  assert.equal(state.room, 'inverness_terrace');
  await choose(g, 'examine headphones');
  await choose(g, 'examine dish');
  await choose(g, 'push pram');
  assert.equal(state.room, 'lancaster_gate');
  await choose(g, 'wait');
  assert.ok(state.hasFlag('umbrella_woman_done'));
  await choose(g, 'take umbrella');
  assert.equal(state.has('umbrella'), false, '树上的伞应够不到');
  await choose(g, 'throw ball at tree');
  await choose(g, 'take umbrella');
  assert.ok(state.has('umbrella'));
  await choose(g, 'push pram');
  assert.equal(state.room, 'lancaster_walk');
  await choose(g, 'read notice');
  await choose(g, 'examine sculpture');
  await choose(g, 'e');
  assert.equal(state.room, 'lancaster_walk', '步行不能直接穿过草坪');
  await choose(g, 'enter pram');
  assert.equal(state.hasFlag('in_pram'), false, '关闭的车不能坐入');
  await choose(g, 'open pram');
  await choose(g, 'enter pram');
  await choose(g, 'exit pram');
  await choose(g, 'enter pram');
  await choose(g, 'open umbrella');
  assert.equal(state.room, 'long_water');
  assert.ok(state.hasFlag('pram_broken'));
  assert.equal(state.itemAt('paper_bird'), 'long_water');
  await choose(g, 'take paper bird');
  await choose(g, 'take gnomon');
  await choose(g, 'enter water');
  assert.ok(state.hasFlag('white_door_visible'));
  assert.equal(state.room, 'wading');
  assert.equal(g.engine.loadedChapters.has('wabe'), false);
  await choose(g, 'enter door');
  assert.equal(state.room, 'meadow');
  assert.equal(state.chapter, 'wabe');
  assert.ok(state.hasFlag('prologue_done'));
  assert.equal(state.score, 15);
  assert.ok(g.engine.loadedChapters.has('wabe'));
});

test('放下物品重新出现在当前房间，不靠界面改状态', async () => {
  const g = game();
  await command(g, 'e');
  await choose(g, 'take ball');
  await choose(g, 'drop ball');
  assert.equal(g.engine.state.itemAt('ball'), 'flower_walk');
  assert.ok(getHotspots(g.engine.state).some(object => object.itemId === 'ball'));
  await choose(g, 'take ball');
  assert.equal(g.engine.state.score, 1, '重复拾取不重复得分');
});

test('独立会话不污染章模块，预加载和读档恢复计时器协议正确', async () => {
  const first = createPrologueSession();
  assert.equal(first.rooms.meadow, undefined);
  assert.equal(first.timerHandlers.get('doomsday'), TIMERS.doomsday);
  await first.activateChapter('wabe');
  assert.ok(first.rooms.meadow);
  assert.equal(ROOMS.meadow, undefined);
  const second = createPrologueSession();
  assert.equal(second.rooms.meadow, undefined);
  await first.processInput('n');
  await first.processInput('s');
  assert.ok(first.state.timer);
  const save = JSON.parse(JSON.stringify(first.serialize()));
  await second.deserialize(save);
  assert.equal(second.state.timer.perTurn, TIMERS.doomsday);
  const before = second.state.serialize();
  await assert.rejects(second.deserialize({ ...save, state: { ...save.state, chapter: 'pacific', room: 'lagoon' } }), /加载失败/);
  assert.deepEqual(second.state.serialize(), before, '不支持的章节读档不能破坏当前状态');
});

test('上游帮助老妇人和接触她手中雨伞均可由动作目录触发，事件完成后不重播', async () => {
  for (const input of ['help woman', 'hold umbrella']) {
    const g = game();
    for (const dir of ['n', 'n', 'e', 'e']) await command(g, dir);
    const state = g.engine.state;
    assert.equal(state.room, 'lancaster_gate');
    assert.equal(state.hasFlag('umbrella_woman_done'), false);
    assert.ok(state.hasFlag('umbrella_woman_seen'));
    await choose(g, input);
    assert.ok(state.hasFlag('umbrella_woman_done'));
    assert.ok(state.hasFlag('seen_woman_face'));
    assert.equal(state.itemAt('umbrella'), 'lancaster_gate_tree');
    const objects = getHotspots(state);
    assert.equal(objects.some(object => object.id === 'lancaster_gate:woman'), false);
    assert.ok(objects.some(object => object.id === 'lancaster_gate:umbrella-tree'));
    assert.equal(objects.flatMap(object => object.actions).some(action => action.command === input), false);
  }
});

test('动作目录覆盖当前序章可解析事件；仅记录既有不可解析草坪动作及白门重复别名', async () => {
  const { ITEMS } = await import('../../js/data/items.js');
  const parser = new Parser();
  const covered = new Set();
  const nounMatches = (input, choices) => choices.some(choice => input === choice || ITEMS[choice]?.aliases?.includes(input));
  const matches = (cmd, match) => match && match.verb.includes(cmd.verb)
    && (!match.noun || (cmd.noun && nounMatches(cmd.noun, match.noun)))
    && (!match.noun2 || (cmd.noun2 && nounMatches(cmd.noun2, match.noun2)));
  const scenarios = [
    () => {},
    s => { s.destroy('coin'); },
    s => { s.take('bag'); },
    s => { s.setFlag('ruby_visible'); },
    s => { s.setFlag('gnomon_unscrewed'); },
    s => { s.take('paper_bird'); },
    s => { s.take('paper_bird'); s.setFlag('bird_unfolded'); },
    s => { s.setFlag('pram_at_inverness'); },
    s => { s.setFlag('pram_at_lancaster'); },
    s => { s.setFlag('pram_at_walk'); },
    s => { s.setFlag('pram_at_walk'); s.setFlag('pram_open'); s.setFlag('in_pram'); },
    s => { s.setFlag('umbrella_woman_seen'); },
    s => { s.setFlag('umbrella_woman_seen'); s.setFlag('umbrella_woman_done'); s.take('ball'); },
    s => { s.setFlag('umbrella_woman_done'); s.placeItem('umbrella', 'lancaster_gate'); },
    s => { s.take('umbrella'); },
    s => { s.setFlag('white_door_visible'); s.setFlag('missile_visible'); },
  ];
  for (const room of Object.keys(ROOMS)) for (const setup of scenarios) {
    const { engine } = game();
    engine.state.room = room;
    setup(engine.state);
    const state = engine.state;
    const actions = [...getHotspots(state).flatMap(object => object.actions), ...state.inventoryList().flatMap(({ id }) => getInventoryActions(id, state))];
    for (const action of actions) {
      const cmd = parser.parse(action.command);
      assert.ok(cmd, `${room}: ${action.command}`);
      if (cmd.type !== 'simple' && cmd.type !== 'compound') continue;
      const event = ROOMS[room].events.find(event => (!event.when || event.when(state)) && matches(cmd, event.match));
      if (event) covered.add(event.id);
    }
  }
  const gaps = Object.values(ROOMS).flatMap(room => room.events.map(event => event.id)).filter(id => !covered.has(id));
  assert.deepEqual(gaps.sort(), ['go_through_door_emb','walk_on_grass','unseen_white_door','unseen_white_door_shore',...Object.keys(ROOMS).map(id=>`read_time_${id}`)].sort());
  // No visual bypass of the parser: the existing grass event's verbs are unsupported,
  // while the white-door trigger-only event duplicates the exposed enter_door action.
  assert.equal(parser.parse('walk on grass'), null);
  assert.equal(parser.parse('go grass'), null);
});
