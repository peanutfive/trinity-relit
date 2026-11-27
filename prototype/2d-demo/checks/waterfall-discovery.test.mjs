import test from 'node:test';
import assert from 'node:assert/strict';
import {createPrologueSession} from '../engine-adapter.js';
import {getHotspots} from '../interaction-catalog.js';
import {resolveInteraction} from '../interaction-intent.js';
import {pointerTarget,nearbyTarget} from '../interaction-targets.js';
import {SCENES,sceneExits} from '../scene-manifest.js';
import {isSegmentWalkable,isBlocked,findPath} from '../world.js';
import {roomArrival} from '../arrivals.js';

async function playAtFalls() {
  const lines = [];
  const game = createPrologueSession({ui:{text:t=>lines.push(t),system:t=>lines.push(t),location(){},inventory(){},userInput(){}}});
  await game.transitionChapter({to:'wabe',roomCandidates:['bottom_of_stairs']});
  await game.processInput('w');
  await game.processInput('w');
  assert.equal(game.state.room,'waterfall');
  return {game, async play(cmd) { lines.length=0; await game.processInput(cmd); return lines.join('\n'); }};
}

test('靠近瀑布、普通观察和碰到挡路的水幕都不会发现冰穴，细查后可经同一岩沿往返', async()=>{
  for (const [inspect,enter,leave] of [
    ['look behind the waterfall','w','e'], ['搜索瀑布','进入洞口','out'],
  ]) {
    const {game,play} = await playAtFalls();
    const state = game.state;
    const start = state.turns, score = state.score;
    for (const [cmd,answer] of [['w',/blocks your path/],['enter opening',/can.t see/],['examine waterfall',/white curtain/]]) {
      assert.match(await play(cmd),answer);
      assert.equal(state.turns,start);
      assert.equal(state.hasFlag('waterfall_opening_found'),false);
      assert.equal(sceneExits(state.room,state,game.rooms).some(e=>e.target==='ice_cavern'),false);
    }
    const survey=pointerTarget(getHotspots(state),{x:127,y:79});
    assert.equal(resolveInteraction(state,survey),'search waterfall');
    assert.equal(nearbyTarget(getHotspots(state),{x:122,y:80,face:'left'}).id,survey.id);
    assert.match(await play(inspect),/Careful inspection/);
    assert.equal(state.turns,start+1);
    assert.match(await play('enter waterfall'),/frigid water/);
    assert.match(await play('look through the waterfall'),/white curtain/);
    assert.match(await play('touch water'),/very cold/);
    assert.equal(state.turns,start+4);
    assert.equal(state.room,'waterfall');
    assert.match(await play(inspect),/There's an opening/);
    assert.match(await play('examine opening'),/Little can be seen/);
    assert.equal(resolveInteraction(state,pointerTarget(getHotspots(state),{x:127,y:79})),'w');
    await play(enter);
    assert.equal(state.room,'ice_cavern');
    assert.match(await play('look'),/opening in the east wall/);
    const resumed=createPrologueSession();
    await resumed.deserialize(game.serialize());
    await resumed.processInput(leave);
    assert.equal(resumed.state.room,'waterfall');
    assert.equal(resumed.state.score,score);
    assert.ok(resumed.state.hasFlag('waterfall_opening_found'));
    const exits=sceneExits('waterfall',resumed.state,resumed.rooms);
    const arrival=roomArrival(SCENES.waterfall,{direction:leave,fromRoom:'ice_cavern',exits});
    assert.equal(arrival.entrance,'w');
    assert.ok(arrival.x<171);
    await resumed.processInput('w');
    assert.equal(resumed.state.room,'ice_cavern');
  }
});

test('池北岩沿每个转折都能通过，水潭不允许抄近路',()=>{
  const route=[[300,166],[311,145],[301,132],[283,119],[262,110],[242,103],[216,95],[192,88],[168,82],[147,79],[124,80]];
  for (let i=1;i<route.length;i++) assert.ok(isSegmentWalkable(SCENES.waterfall,route[i-1],route[i]),String(route[i]));
  for (const [x,y] of [[120,117],[185,130],[260,147]]) assert.ok(isBlocked(SCENES.waterfall,x,y));
  assert.ok(findPath(SCENES.waterfall,SCENES.waterfall.spawn,route.at(-1)).length);
});
