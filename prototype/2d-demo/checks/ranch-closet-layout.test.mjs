import test from 'node:test';
import assert from 'node:assert/strict';
import { GameState } from '../../js/engine.js';
import { getRanchHotspots } from '../ranch-actions.js';
import { approachingExit } from '../world.js';
import { pointerTarget } from '../interaction-targets.js';
import { SCENES, sceneExits } from '../scene-manifest.js';

test('向右前方摸壁橱门叶一路可走，向前跨过画中敞口才会出去',()=>{
  const state = new GameState();
  state.chapter='ranch';state.room='closet';
  const [exit]=sceneExits(state.room,state);
  const landing=SCENES.closet.sourceArrivals.assembly_room;
  const [x,y]=SCENES.closet.doorPlacement.openLeafApproach;
  for(let step=0;step<24;step++){
    const at=t=>({x:landing.x+(x-landing.x)*t/24,y:landing.y+(y-landing.y)*t/24});
    assert.ok(!approachingExit(exit,at(step),at(step+1)));
  }
  assert.ok(approachingExit(exit,{x:240,y:162},{x:240,y:159}));
  assert.ok(!approachingExit(exit,{x:258,y:162},{x:258,y:159}));
  for(const padding of [0,8]){
    const objects=getRanchHotspots(state);
    assert.equal(pointerTarget(objects,{x:258,y:133},{padding})?.id,'closet:door');
    assert.equal(pointerTarget(objects,{x:238,y:136},{padding})?.id,'closet:door:opening');
  }
  state.setFlag('closet_door_closed');
  assert.deepEqual(sceneExits(state.room,state),[]);
  assert.equal(pointerTarget(getRanchHotspots(state),{x:238,y:136})?.id,'closet:door');
});
