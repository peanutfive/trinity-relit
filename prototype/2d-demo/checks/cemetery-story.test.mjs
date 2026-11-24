import assert from 'node:assert/strict';
import test from 'node:test';
import { createPrologueSession } from '../engine-adapter.js';
import { cemeteryView } from '../cemetery-state.js';
import { ROOMS as textWabe } from '../../js/data/wabe.js';
import { ROOMS as textIslet } from '../../js/data/islet.js';

function fixture() {
  const lines = [];
  const quiet = () => {};
  const engine = createPrologueSession({ui:{
    text: line => lines.push(line), system: quiet, inventory: quiet, location: quiet, userInput: quiet,
  }});
  return {
    engine,
    async act(...commands) {
      lines.length = 0;
      for (const command of commands) await engine.processInput(command);
      return lines.join('\n');
    },
  };
}

async function enterCemetery() {
  const game = fixture();
  await game.engine.activateChapter('wabe');
  game.engine.state.chapter = 'wabe';
  game.engine.moveTo('cemetery');
  return game;
}

test('棺盖完整时看不到棺内的物品，拿着铲子也必须实际用铲撬开', async () => {
  const {engine, act} = await enterCemetery();
  const state = engine.state;
  const start = state.score;
  await act('open crypt with spade');
  assert.equal(cemeteryView(state).open, false);
  state.take('spade');
  await act('open crypt', 'look in crypt', 'look in mouth');
  const closed = cemeteryView(state);
  assert.equal(closed.open, false);
  assert.equal(closed.inspected, false);
  assert.equal(closed.coinSeen, false);
  for (const [name, id] of [['shroud', 'shroud'], ['bandage', 'bandage'], ['silver coin', 'silver_coin']]) {
    assert.match(await act('take '+name), /can't see/);
    assert.equal(state.has(id), false);
  }
  assert.equal(state.score, start);
  await act('用铲子撬开石棺');
  assert.equal(cemeteryView(state).open, true);
  assert.equal(state.score, start+3);
  await act('close crypt', 'open crypt with spade');
  assert.equal(cemeteryView(state).open, true);
  assert.equal(state.score, start+3);
});

test('先解颌带会张口，观察才显示银币，已能触及的银币也可以直接取走', async () => {
  const {engine, act} = await enterCemetery();
  const state = engine.state;
  state.take('spade');
  await act('open crypt with spade', 'look in crypt');
  assert.equal(cemeteryView(state).inspected, true);
  await act('解开绷带');
  assert.equal(state.carrying('bandage'), true);
  assert.equal(state.score, 3);
  const open = cemeteryView(state);
  assert.equal(open.shroudOnBody, true);
  assert.equal(open.mouthOpen, true);
  assert.equal(open.coinInMouth, true);
  assert.equal(open.coinSeen, false);
  const beforeInspection = engine.serialize();

  await act('take silver coin');
  assert.equal(state.carrying('silver_coin'), true);
  assert.equal(state.score, 4);
  assert.equal(cemeteryView(state).coinInMouth, false);

  const resumed = fixture();
  await resumed.engine.deserialize(beforeInspection);
  await resumed.act('look in mouth');
  assert.equal(cemeteryView(resumed.engine.state).coinSeen, true);
  assert.equal(resumed.engine.state.score, 3);
  await resumed.act('take silver coin');
  assert.equal(resumed.engine.state.carrying('silver_coin'), true);
  assert.equal(cemeteryView(resumed.engine.state).coinSeen, false);
  assert.equal(resumed.engine.state.score, 4);
});

test('先取覆衣仍不能拿币，两件布和币放回后可以再取，得分只结一次', async () => {
  const {engine, act} = await enterCemetery();
  const state = engine.state;
  state.take('spade');
  await act('open crypt with spade', 'wear shroud');
  assert.equal(state.has('shroud'), false);
  await act('take shroud', 'put on burial shroud');
  assert.equal(state.wearing('shroud'), true);
  assert.equal(state.score, 4);
  await act('take silver coin', 'look in mouth');
  assert.equal(state.has('silver_coin'), false);
  assert.equal(cemeteryView(state).mouthOpen, false);
  await act('take off burial shroud');
  assert.equal(state.carrying('shroud'), true);
  await act('take bandage', 'take silver coin', 'put silver coin in mouth',
    'put shroud on corpse', 'put bandage on corpse');
  const closed = cemeteryView(state);
  assert.equal(closed.shroudOnBody, true);
  assert.equal(closed.bandageOnBody, true);
  assert.equal(closed.mouthOpen, false);
  assert.equal(closed.coinInMouth, true);
  assert.equal(closed.coinSeen, false);
  assert.equal(state.score, 5);

  const resumed = fixture();
  await resumed.engine.deserialize(engine.serialize());
  await resumed.act('take silver coin');
  assert.equal(resumed.engine.state.has('silver_coin'), false);
  await resumed.act('take bandage', 'take silver coin', 'take shroud');
  for (const id of ['bandage', 'silver_coin', 'shroud']) assert.equal(resumed.engine.state.carrying(id), true);
  assert.equal(resumed.engine.state.score, 5);
});

test('旧存档保留已持有、丢在别处和用于付费的物品，开棺不会再发一份', async () => {
  const old = fixture().engine.serialize();
  old.state.chapter = 'wabe';
  old.state.room = 'cemetery';
  old.state.itemLoc.spade = 'inventory';
  old.state.itemLoc.shroud = 'worn';
  old.state.itemLoc.bandage = 'barrow';
  old.state.score = 31;
  for (const prior of ['pocket', 'barrow', 'destroyed', undefined]) {
    const save = structuredClone(old);
    if (prior) save.state.itemLoc.silver_coin = prior;
    if (!prior || prior === 'destroyed') save.state.flags.push('ferry_paid');
    const {engine, act} = fixture();
    await engine.deserialize(save);
    const state = engine.state;
    assert.equal(state.score, 31);
    await act('open crypt with spade', 'look in mouth');
    assert.equal(state.score, 34);
    assert.equal(state.wearing('shroud'), true);
    assert.equal(state.itemAt('bandage'), 'barrow');
    assert.equal(state.itemAt('silver_coin'), prior ?? 'destroyed');
    assert.equal(cemeteryView(state).coinInMouth, false);
    if (prior === 'pocket') {
      await act('put silver coin in mouth', 'take silver coin');
      assert.equal(state.carrying('silver_coin'), true);
    } else {
      await act('take silver coin');
      assert.equal(state.has('silver_coin'), false);
    }
    await act('put shroud on corpse', 'take shroud');
    assert.equal(state.carrying('shroud'), true);
    assert.equal(state.score, 34);
  }
});

test('小岛与异境由二维读档入口独立装载，穿衣状态在两个章节中均可操作', async () => {
  const wabeEvents = [...textWabe.cemetery.events];
  const isletEvents = [...textIslet.islet.events];
  const {engine, act} = await enterCemetery();
  engine.state.take('spade');
  await act('open crypt with spade', 'take shroud', 'wear shroud');
  const save = engine.serialize();
  save.state.chapter = 'islet';
  save.state.room = 'islet';
  const island = fixture();
  await island.engine.deserialize(save);
  assert.equal(island.engine.state.wearing('shroud'), true);
  await island.act('脱下裹尸布');
  assert.equal(island.engine.state.carrying('shroud'), true);
  await island.act('wear shroud');
  assert.equal(island.engine.state.wearing('shroud'), true);
  assert.equal(island.engine.state.score, engine.state.score);
  assert.deepEqual(textWabe.cemetery.events, wabeEvents);
  assert.deepEqual(textIslet.islet.events, isletEvents);
});
