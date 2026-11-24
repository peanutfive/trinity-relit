import test from 'node:test';
import assert from 'node:assert/strict';
import { GameEngine } from '../../js/engine.js';
import { Parser } from '../../js/parser.js';
import { ITEMS } from '../../js/data/items.js';
import { ROOMS as textRooms } from '../../js/data/ranch.js';
import { ROOMS, reservoirBottomLit, reservoirLanternLit, restoreWindmillState, windmillBinocularsLocation } from '../ranch-story.js';

function session() {
  const log = [];
  const ui = { text: text => log.push(text), system: text => log.push(text), userInput() {}, inventory() {}, location() {} };
  const engine = new GameEngine({ rooms: { ...ROOMS }, items: ITEMS, parser: new Parser(), ui, preloadedChapters: ['ranch'] });
  engine.state.chapter = 'ranch';
  engine.moveTo('south_reservoir', true);
  const input = async (...commands) => {
    log.length = 0;
    for (const command of commands) await engine.processInput(command);
    return log.join('\n');
  };
  return { engine, input };
}

test('风车只在玩家留在台上的动作后受力，上下梯与存读档保留木板进度', async () => {
  const { engine, input } = session();
  const s = engine.state;
  assert.deepEqual(Object.keys(ROOMS), Object.keys(textRooms));
  assert.equal(ROOMS.front_yard, textRooms.front_yard);
  assert.equal(textRooms.windmill.events.length, 0);
  assert.match(await input('ne', 'u'), /The landing creaks under your weight/);
  assert.equal(s.itemAt('binoculars'), 'windmill');
  await input('i', 'd', 'wait', 'wait');
  assert.equal(s.cnt('windmill_strain'), 1);
  assert.match(await input('u'), /wooden moan/);
  assert.match(await input('look'), /sagging dangerously/);
  await input('d');
  const resumed = session();
  await resumed.engine.deserialize(engine.serialize());
  restoreWindmillState(resumed.engine.state);
  assert.match(await resumed.input('u'), /CRACK!/);
  assert.equal(resumed.engine.state.room, 'reservoir');
  assert.equal(resumed.engine.state.itemAt('binoculars'), 'underwater');
  assert.match(await resumed.input('u', 'd', 'ne', 'u'), /can't climb up to it anymore/);
  assert.equal(resumed.engine.state.room, 'under_windmill');
});

test('伸手取镜立刻翻板，手持与平台散物落底，穿戴与口袋保留', async () => {
  const { engine, input } = session();
  const s = engine.state;
  s.take('splinter');
  s.wear('watch');
  s.toPocket('credit_card');
  await input('ne', 'u');
  s.placeItem('spade', 'windmill');
  const output = await input('拿望远镜');
  assert.match(output, /stretch your arm/);
  assert.match(output, /mouth fills with water/);
  assert.equal(s.room, 'reservoir');
  for (const id of ['binoculars', 'splinter', 'spade']) assert.equal(s.itemAt(id), 'underwater');
  assert.equal(s.hasFlag('binoculars_broken'), true);
  assert.equal(s.wearing('watch'), true);
  assert.equal(s.inPocket('credit_card'), true);
  assert.equal(s.score, 0);
  const snapshot = s.serialize();
  assert.equal(reservoirBottomLit(snapshot), true);
  assert.equal(windmillBinocularsLocation(snapshot), 'underwater');
});

test('普通下水保留手持物；缺少发光木片时无法在水底摸到望远镜', async () => {
  const { engine, input } = session();
  const s = engine.state;
  s.take('lantern'); // An unlit lamp sinks too.
  await input('ne', 'u', 'take binoculars', 'd');
  assert.equal(s.room, 'underwater');
  assert.equal(reservoirBottomLit(s), false);
  assert.equal(s.cnt('reservoir_breath'), 3);
  const refusal = await input('look', 'take binoculars', 'take all', 'examine binoculars');
  assert.match(refusal, /too dark and murky/);
  assert.equal(s.cnt('reservoir_breath'), 3);
  assert.equal(s.itemAt('binoculars'), 'underwater');
  assert.equal(s.score, 0);
  assert.match(await input('wait'), /hold your breath much longer/);
  assert.match(await input('wait'), /claw your way to the surface/);
  await input('u', 'd');
  // The player can bring a light on a later visit without resetting the platform.
  s.placeItem('splinter', 'south_reservoir');
  await input('take splinter', 'u', 'n', 'd');
  assert.equal(s.carrying('splinter'), true);
  assert.equal(reservoirBottomLit(s), true);
  await input('take binoculars', 'out', 'out');
  assert.equal(s.carrying('binoculars'), true);
  assert.equal(s.room, 'edge_reservoir');
});

test('有光时可在自动换气的同一回合拾镜，放回水里再捡不重复加分', async () => {
  const { engine, input } = session();
  const s = engine.state;
  s.take('splinter');
  await input('ne', 'u', 'take binoculars', 'd');
  assert.equal(s.cnt('reservoir_breath'), 3);
  assert.match(await input('wait'), /hold your breath much longer/);
  assert.match(await input('take binoculars'), /claw your way to the surface/);
  assert.equal(s.room, 'reservoir');
  assert.equal(s.carrying('binoculars'), true);
  assert.equal(s.score, 1);
  await input('drop binoculars');
  assert.equal(s.itemAt('binoculars'), 'underwater');
  await input('d', 'take binoculars', 'u', 'u', 'd', 'wear binoculars');
  assert.equal(s.wearing('binoculars'), true);
  assert.equal(s.score, 1);
  assert.match(await input('look at windmill through binoculars'), /focus the binoculars on the windmill/);
  await input('remove binoculars');
  assert.equal(s.carrying('binoculars'), true);
  await input('drop binoculars');
  assert.match(await input('look at windmill through binoculars'), /have to be holding/);
});

test('潜水和提前屏息的时限随存档保留，主动浮面后重新换气', async () => {
  const { engine, input } = session();
  engine.state.take('splinter');
  await input('u', 'n', 'in', 'look');
  assert.equal(engine.state.cnt('reservoir_breath'), 2);
  const resumed = session();
  await resumed.engine.deserialize(engine.serialize());
  restoreWindmillState(resumed.engine.state);
  const s = resumed.engine.state;
  assert.match(await resumed.input('look'), /hold your breath much longer/);
  assert.match(await resumed.input('look'), /claw your way to the surface/);
  assert.equal(s.cnt('reservoir_breath'), 0);
  assert.match(await resumed.input('hold breath', 'wait', 'd'), /claw your way to the surface/);
  assert.equal(s.room, 'reservoir');
  assert.match(await resumed.input('d', 'u'), /gasping for air/);
  assert.equal(s.cnt('reservoir_breath'), 0);
});

test('老存档按平台状态补回唯一望远镜，保留已知位置和已有分数', async () => {
  for (const [prior, damaged, expected] of [
    [null, false, 'windmill'], [null, true, 'underwater'], ['worn', true, 'worn'],
    ['inventory', false, 'inventory'], ['south_reservoir', true, 'south_reservoir'],
    ['destroyed', true, 'destroyed'],
  ]) {
    const { engine } = session();
    const old = engine.serialize();
    old.state.room = 'under_windmill';
    old.state.flags = damaged ? ['binoculars_broken'] : [];
    if (prior) old.state.itemLoc.binoculars = prior;
    const actual = windmillBinocularsLocation(old.state);
    assert.equal(actual, expected);
    assert.equal(old.state.itemLoc.binoculars, prior ?? undefined);
    await engine.deserialize(old);
    restoreWindmillState(engine.state);
    restoreWindmillState(engine.state);
    assert.equal(engine.state.itemAt('binoculars'), expected);
    assert.equal(engine.state.score, 0);
  }
});

test('真正发光的灯笼随身或沉底都照亮水底，岸上和熄灭的灯不起作用', async () => {
  for (const [location, on, expected] of [
    ['inventory',true,true], ['underwater',true,true], ['south_reservoir',true,false],
    ['underwater',false,false], ['inventory',false,false],
  ]) {
    const { engine, input } = session();
    const s = engine.state;
    s.moveItem('lantern', location);
    if (on) s.setFlag('lantern_on');
    s.setFlag('binoculars_broken');
    await input('u', 'n', 'd');
    assert.equal(reservoirLanternLit(s.serialize()), expected);
    assert.equal(reservoirBottomLit(s), expected);
    await input('take binoculars');
    assert.equal(s.carrying('binoculars'), expected);
  }
});
