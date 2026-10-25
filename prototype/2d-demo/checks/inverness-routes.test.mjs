import test from 'node:test';
import assert from 'node:assert/strict';
import { SCENES, sceneExits } from '../scene-manifest.js';
import { ROOMS } from '../../js/data/prologue.js';
import { createPrologueSession } from '../engine-adapter.js';
import { getHotspots } from '../interaction-catalog.js';
import { createNarrativeDirector } from '../narrative.js';
import { actorLayout, actorHitShape } from '../actor-layout.js';
import { isBlocked, isSegmentWalkable, findPath, approachingExit } from '../world.js';

// Independent samples taken from the delivered 1619×971 painting, scaled to
// 480×288 BEFORE inspecting the new collision mesh. Never derive these samples
// from walkablePolygons or from the code's exit positions: that previously let
// a mesh crossing flowerbeds prove its own reachability.
const paintedRoutes = {
  terrace: [[16,94],[140,94],[260,94],[380,94],[464,94]],
  leftBend: [[91,106],[85,132],[89,157],[106,184],[109,190]],
  southwest: [[109,190],[82,207],[52,225],[22,246],[16,251]],
  south: [[109,190],[150,204],[185,220],[215,245],[230,275]],
  southeast: [[344,106],[344,132],[356,156],[386,177],[421,199],[444,227],[460,263],[464,275]],
};

function assertRoute(scene, points, label) {
  for (let index=0;index<points.length;index++) {
    assert.equal(isBlocked(scene,...points[index]),false,`${label}: painted ground ${points[index]}`);
    if (index) assert.equal(isSegmentWalkable(scene,points[index-1],points[index]),true,
      `${label}: continuous painted route ${points[index-1]} → ${points[index]}`);
  }
}

async function pushPramIntoTerrace() {
  const engine=createPrologueSession();
  engine.moveTo(engine.state.room);
  for (const command of ['n','n','push pram']) await engine.processInput(command);
  assert.equal(engine.state.room,'inverness_terrace');
  return engine;
}

test('因弗内斯台按独立画面采样连续通过横露台、左右弯道和西南/南分岔',()=>{
  const scene=SCENES.inverness_terrace;
  for (const [name,points] of Object.entries(paintedRoutes)) assertRoute(scene,points,name);
  for (const point of [[125,145],[200,150],[350,205],[435,145],[230,50],[425,126]]) {
    assert.equal(isBlocked(scene,...point),true,`actual flowerbed, lawn or fence remains solid: ${point}`);
  }
});

test('因弗内斯台保留原章五出口及目的地，传感区移到五个独立画面末端',async()=>{
  const engine=await pushPramIntoTerrace(),scene=SCENES.inverness_terrace;
  const expected={w:'black_lion_gate',e:'lancaster_gate',s:'round_pond',se:'lancaster_walk',sw:'broad_walk'};
  assert.deepEqual(ROOMS.inverness_terrace.exits(engine.state),expected,'不得靠改原版连接来适配素材');
  const exits=sceneExits('inverness_terrace',engine.state);
  assert.deepEqual(Object.fromEntries(exits.map(exit=>[exit.dir,exit.target])),expected);
  assert.equal(exits.length,5);
  const endpoints={w:[16,95],e:[464,95],sw:[16,251],s:[230,275],se:[464,275]};
  for (const exit of exits) {
    assert.deepEqual([exit.x,exit.y],endpoints[exit.dir],`${exit.dir} is at the painted opening`);
    assert.equal(isBlocked(scene,exit.x,exit.y),false,`${exit.dir} terminal is actual ground`);
  }
});

test('西南与南分岔不互抢，旧西南箭头附近向南行走不提前切房',()=>{
  const exits=SCENES.inverness_terrace.exits;
  const triggered=(from,to)=>exits.filter(exit=>approachingExit(exit,from,to)).map(exit=>exit.dir);
  assert.deepEqual(triggered({x:164,y:210},{x:165,y:211}),[], '旧SW(165,211)现在只是南路中段');
  assert.deepEqual(triggered({x:28,y:242},{x:27,y:243}),['sw']);
  assert.deepEqual(triggered({x:230,y:260},{x:230,y:261}),['s']);
  assert.deepEqual(triggered({x:27,y:243},{x:28,y:242}),[], '离开SW末端回到房内不切房');
  assert.deepEqual(triggered({x:230,y:261},{x:230,y:260}),[], '离开S末端回到房内不切房');
});

test('东南弯道按画面末段向下即可离开，不要求玩家猜测东南文字方向',()=>{
  const exit=SCENES.inverness_terrace.exits.find(value=>value.dir==='se');
  const from={x:464,y:260},to={x:464,y:261};
  assert.equal(isSegmentWalkable(SCENES.inverness_terrace,from,to),true);
  assert.equal(approachingExit(exit,from,to),true,'近竖直画面通道使用当地向外方向');
  assert.equal(approachingExit(exit,to,from),false,'向回走不能触发');
  const {approach,...legacyCompass}=exit;
  assert.equal(approachingExit(legacyCompass,from,to),false,'保留旧SE指南针条件会复现失败');
});

test('真实推车后车身仍阻挡，但y102露台横穿和五条分支完整可达',async()=>{
  const engine=await pushPramIntoTerrace(),scene=SCENES.inverness_terrace;
  const objects=getHotspots(engine.state),pram=objects.find(object=>object.kind==='pram');
  assert.ok(pram,'真实push pram后必须仍有车');
  assert.equal(isBlocked(scene,pram.x,pram.y),false,'车轮停在可见露台地面');
  // Match the live body's physical occupancy, including the boy. Do not open
  // this route by dropping the car's collision, shrinking it, or moving flags.
  const bodies=objects.filter(object=>['pram','boy'].includes(object.kind)).map(object=>{
    const rx=object.kind==='pram'?20:6,ry=object.kind==='pram'?7:3;
    return {x:object.x-rx,y:object.y-ry,w:rx*2,h:ry*2};
  });
  const navigation={...scene,obstacles:[...scene.obstacles,...bodies]};
  assert.equal(isBlocked(navigation,pram.x,pram.y),true,'车身实体不能穿过');
  assertRoute(navigation,[[16,102],[140,102],[235,102],[310,102],[380,102],[464,102]],'parked-pram terrace bypass');
  assert.equal(isBlocked(navigation,...scene.spawn),false,'抵达位置不在车内');
  for (const exit of sceneExits('inverness_terrace',engine.state)) {
    const path=findPath(navigation,scene.spawn,[exit.x,exit.y]);
    assert.ok(path.length>1,`${exit.dir} without nearest/teleport fallback`);
    assert.deepEqual(path.at(-1),[exit.x,exit.y],`${exit.dir} exact physical exit`);
    for (let index=1;index<path.length;index++) {
      assert.equal(isSegmentWalkable(navigation,path[index-1],path[index]),true,`${exit.dir}: safe path segment`);
    }
  }
});

test('男孩、耳机、碟子和导演共享新坐席，旧锚点不留在回退或命中范围',async()=>{
  const engine=await pushPramIntoTerrace(),objects=getHotspots(engine.state);
  const boy=objects.find(object=>object.kind==='boy'),headphones=objects.find(object=>object.kind==='headphones'),dish=objects.find(object=>object.kind==='dish');
  assert.ok(boy&&headphones&&dish);
  assert.deepEqual([boy.x,boy.y],[300,135],'新画面草地坐席');
  assert.deepEqual([headphones.x,headphones.y],[300,122],'耳机随着坐席迁移');
  const cue=actorLayout(boy).cuePoints.dish;
  assert.deepEqual([dish.x,dish.y],[boy.x+cue[0],boy.y+cue[1]],'碟子与角色实际伸手点一致');
  assert.notDeepEqual([boy.x,boy.y],[300,145]);
  assert.notDeepEqual([dish.x,dish.y],[293.5,143.5]);
  assert.deepEqual(actorHitShape(boy),{x:300,y:124.5,rx:10,ry:11.5},'命中区域跟新坐席');
  const director=createNarrativeDirector();
  const serialized=engine.state.serialize();
  for (const state of [serialized,{...serialized,visual:{room:engine.state.room,hotspots:objects}}]) {
    const actor=director.getState(state).visibleActorActions.find(value=>value.id===boy.id);
    assert.ok(actor);
    assert.deepEqual([actor.x,actor.y],[boy.x,boy.y],'有/无visual快照都不得回落到旧坐席');
  }
});
