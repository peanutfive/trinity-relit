import test from 'node:test';
import assert from 'node:assert/strict';
import {GameState} from '../../js/engine.js';
import {SCENES} from '../scene-manifest.js';
import {companionHotspots,recordCompanionArrival,TOWER_BOX} from '../roadrunner-layout.js';
import {sampleRoadrunnerBeat} from '../roadrunner-art.js';
import {TOWER_RUBY_BOX} from '../roadrunner-story.js';
import {pointerTarget} from '../interaction-targets.js';
import {resolveInteraction} from '../interaction-intent.js';
import {isSegmentWalkable} from '../world.js';

function towerState(){
  const state=new GameState();
  state.chapter='desert';
  state.room='base_of_tower';
  state.setFlag('roadrunner_entered_white_door');
  return state;
}
test('降到塔脚后走鹃让开主角的身体，脚下行迹可走，原地观察和读图不会移动它',()=>{
  const state=towerState(),scene=SCENES.base_of_tower;
  const before=state.serialize(),player=scene.sourceArrivals.tower_landing;
  state.setFlag('roadrunner_at_your_side');state.setCnt('roadrunner_room',1);
  state.placeItem('ruby',TOWER_RUBY_BOX);
  const objects=companionHotspots(state,scene);
  const beat=recordCompanionArrival(before,state,scene,player,'u',objects);
  assert.equal(beat.kind,'drop');
  assert.deepEqual(beat.path.slice(0,2),[TOWER_BOX.perch,TOWER_BOX.sand]);
  for(let i=2;i<beat.path.length;i++)assert.ok(isSegmentWalkable(scene,beat.path[i-1],beat.path[i]));
  const feet=beat.path.at(-1);
  assert.ok(Math.abs(feet[0]-player.x)>=21 || feet[1]>=player.y+18);
  const bird=companionHotspots(state,scene).find(o=>o.kind==='companion_bird');
  assert.deepEqual(bird.drawAt,feet);
  assert.equal(recordCompanionArrival(state.serialize(),state,scene,{x:300,y:215},null,[]),null);
  assert.deepEqual(companionHotspots(state,scene)[0].drawAt,feet);
  assert.equal(resolveInteraction(state,bird),'examine roadrunner');
  assert.equal(resolveInteraction(state,bird,{heldItem:'binoculars'}),'look at roadrunner through binoculars');
});
test('箱盖上的红宝石能单独点中，选中手中那颗才能放回原来的箱盖',()=>{
  const state=towerState(),scene=SCENES.base_of_tower;
  state.placeItem('ruby',TOWER_RUBY_BOX);
  const [gx,gy]=TOWER_BOX.gem;
  const pick=()=>pointerTarget(companionHotspots(state,scene),{x:gx,y:gy-2});
  const gem=pick();
  assert.equal(resolveInteraction(state,gem),'examine ruby');
  assert.equal(resolveInteraction(state,gem,{observed:new Set([gem.id])}),'take ruby');
  state.take('ruby');assert.ok(!pick());
  const selected=companionHotspots(state,scene,{heldItem:'ruby'});
  assert.equal(resolveInteraction(state,pointerTarget(selected,{x:gx,y:gy}),{heldItem:'ruby'}),'put ruby on box');
});
test('吐石阶段始终只出现一颗红宝石，跳过或减弱动画仍落到同一处',()=>{
  const options={path:[TOWER_BOX.perch,TOWER_BOX.sand,[177,187]],dropAt:TOWER_BOX.gem};
  for(const t of [0,.48,.49,.63,.77,1.15,3]){
    const frame=sampleRoadrunnerBeat('drop',t,options);
    assert.equal(Number(Boolean(frame.bird?.carrying))+Number(Boolean(frame.ruby))+Number(!frame.hideGroundRuby),1);
  }
  const skipped=sampleRoadrunnerBeat('drop',0,{...options,skip:true});
  assert.deepEqual(skipped,sampleRoadrunnerBeat('drop',0,{...options,reducedMotion:true}));
  assert.deepEqual([skipped.bird.x,skipped.bird.y],options.path.at(-1));
});
