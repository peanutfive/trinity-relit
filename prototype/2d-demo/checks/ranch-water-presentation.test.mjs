import test from 'node:test';
import assert from 'node:assert/strict';
import { GameState } from '../../js/engine.js';
import { getRanchHotspots, positionWaterTarget } from '../ranch-actions.js';
import { pointerTarget } from '../interaction-targets.js';
import { keyboardInteraction } from '../interaction-context.js';
import { createNarrativeDirector } from '../narrative.js';
import { RANCH_WATER_LAYOUT } from '../ranch-water-layout.js';
import { chartConnection, illustratedMapNodes } from '../map-geography.js';
import { findPath, isBlocked } from '../world.js';

function state(room) {const s=new GameState();s.room=room;s.chapter='ranch';return s;}

test('水深操作跟随泳者，三处岸沿都能游到，点岸前的水只游泳',()=>{
  const s=state('reservoir'), scene=RANCH_WATER_LAYOUT.reservoir;
  for(const x of [113,238,360]){
    const player={x,y:192,face:'down'};
    const targets=getRanchHotspots(s).map(o=>positionWaterTarget(o,player));
    const shore=targets.find(o=>o.shoreline),dive=targets.find(o=>o.actorRelative);
    assert.equal(shore.x,x);
    assert.ok(findPath(scene,scene.spawn,shore).length);
    assert.equal(shore.actions[0].command,'s');
    assert.equal(pointerTarget(targets,{x,y:219}).id,shore.id);
    assert.ok(scene.propOnlyExitDirs.includes('s'));
    assert.equal(pointerTarget(targets,{x:x+7,y:199}),undefined);
    assert.equal(keyboardInteraction(s,dive).command,'d');
    assert.equal(isBlocked(scene,x,229),true);
  }
});

test('暗水不泄露物件，有光时木片、纸鸟、望远镜独立可点，拿走一个不会挪动其他物件',()=>{
  const s=state('underwater');s.placeItem('binoculars','underwater');s.placeItem('paper_bird','underwater');
  assert.deepEqual(getRanchHotspots(s).map(o=>o.kind),['passage']);
  s.placeItem('splinter','underwater');
  const objects=getRanchHotspots(s).filter(o=>o.itemId);
  assert.equal(objects.length,3);
  for(const object of objects){
    const {x,y}=object.pointerShape;
    assert.equal(pointerTarget(objects,{x,y}).itemId,object.itemId);
    assert.ok(findPath(RANCH_WATER_LAYOUT.underwater,RANCH_WATER_LAYOUT.underwater.spawn,object).length);
  }
  const mirror=objects.find(o=>o.itemId==='binoculars');
  assert.equal(keyboardInteraction(s,mirror).command,'take binoculars');
  const light=objects.find(o=>o.itemId==='splinter');s.take('paper_bird');
  assert.deepEqual(getRanchHotspots(s).find(o=>o.itemId==='splinter'),light);
});

test('翻板演出先留在木台再切到入水点，跳过或放完都不更改章节状态',()=>{
  const a={...state('windmill').serialize(),visual:{player:{x:188,y:114,face:'left'}}};
  const b={...state('reservoir').serialize(),visual:{player:{x:333,y:141,face:'left'}},flags:['binoculars_broken']};
  const copy=JSON.stringify([a,b]);
  for(const skip of [true,false]){
    const dir=createNarrativeDirector();dir.onCommand(a,b,'take binoculars');
    assert.equal(dir.getState(b).sceneRoom,'windmill');
    assert.equal(dir.getState(b).hidePlayer,true);
    assert.ok(dir.getState(b).hiddenKinds.includes('binoculars'));
    dir.update(1.8);
    assert.equal(dir.getState(b).sceneRoom,'reservoir');
    if(skip)dir.skip();else dir.update(1);
    assert.equal(dir.getState(b).busy,false);
  }
  assert.equal(JSON.stringify([a,b]),copy);
});

test('牧场的缓坡与铁门只绘一条地面路，潜水与竖梯保留高低层标记',()=>{
 const rows=[['front_yard','front_deck','in','d',true],['se_ranch','se_yard','in','out',true],
   ['windmill','under_windmill','d','u',false],['underwater','reservoir','u','d',false]];
 for(const [from,to,dir,back,road] of rows){
  const nodes=illustratedMapNodes({chapter:'ranch',nodes:[{id:from},{id:to}]});
  const edges=[{from,to,direction:dir},{from:to,to:from,direction:back}];
  assert.equal(chartConnection(edges[0],nodes,'ranch',edges).road,road);
 }
});
