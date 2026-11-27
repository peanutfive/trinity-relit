import test from 'node:test';
import assert from 'node:assert/strict';
import {createPrologueSession} from '../engine-adapter.js';
import {sceneExits} from '../scene-manifest.js';
import {resolveInteraction} from '../interaction-intent.js';
import {getHotspots} from '../interaction-catalog.js';

async function atDoor(room, tick) {
  const game = createPrologueSession();
  await game.activateChapter('wabe');
  game.state.chapter = 'wabe';
  game.state.setCnt('vertex_shadow_tick', tick);
  game.state.setFlag('vertex_lever_up');
  // The visible door follows the shadow even without the gnomon installed.
  game.state.take('splinter');
  game.state.take('soap_bubble');
  game.moveTo(room);
  return game;
}

test('瀑布和纳骨堂只有各自的影尖掠过时才敞开，地图、物件查询和读档均不拨动日晷', async () => {
  for (const [room, first] of [['waterfall', 31], ['ossuary', 57]]) {
    const game = await atDoor(room, first - 1);
    for (const open of [false, true, true, false]) {
      const before = game.state.serialize();
      const door = getHotspots(game.state).find(o => o.kind === 'mushroom_gate');
      assert.equal(door.visualOptions.open, open, room);
      const exit = sceneExits(room, game.state, game.rooms).find(e => e.dir === 'in');
      assert.equal(exit && !exit.locked || false, open, room);
      assert.deepEqual(game.state.serialize(), before);
      const copy = createPrologueSession();
      await copy.deserialize(game.serialize());
      const restored = getHotspots(copy.state).find(o => o.kind === 'mushroom_gate');
      assert.equal(restored.visualOptions.open, open);
      await game.processInput('examine toadstool');
    }
  }
});

test('地下东室移动白门的两拍窗口：早一拍可立即返程，晚一拍入室门即消失', async () => {
  for (const tick of [57, 58]) {
    const game = await atDoor('ossuary', tick);
    await game.processInput('in');
    assert.equal(game.state.room, 'underground_3');
    const copy = createPrologueSession();
    await copy.deserialize(game.serialize());
    for (const play of [game, copy]) {
      const moves = play.state.turns;
      await play.processInput('out');
      assert.equal(play.state.room, tick === 57 ? 'ossuary' : 'underground_3');
      assert.equal(play.state.turns, moves);
    }
  }
});

test('在中室错过关门时刻，东墙仍有关闭的门扇，回到门前不能穿过', async () => {
  const game = await atDoor('ossuary',57);
  for (const [cmd,room] of [['in','underground_3'],['w','underground_2'],['e','underground_3']]) {
    await game.processInput(cmd);
    assert.equal(game.state.room,room);
  }
  const restored=createPrologueSession();
  await restored.deserialize(game.serialize());
  const actor=getHotspots(restored.state).find(o=>o.id==='underground_3:closed-white-door');
  assert.deepEqual(actor.actions.map(a=>a.command),['look']);
  assert.equal(resolveInteraction(restored.state,actor,{observed:new Set([actor.id])}),'look');
  const from=restored.state.turns;
  for (const cmd of ['e','out']) {
    await restored.processInput(cmd);
    assert.equal(restored.state.room,'underground_3');
    assert.equal(restored.state.turns,from);
  }
  await restored.processInput('in');
  assert.equal(restored.state.room,'underground_2');
});
