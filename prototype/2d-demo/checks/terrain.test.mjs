import test from 'node:test';
import assert from 'node:assert/strict';
import { SCENES } from '../scene-manifest.js';
import { GameState } from '../../js/engine.js';
import { ITEMS } from '../../js/data/items.js';
import { getHotspots } from '../interaction-catalog.js';
import { createPrologueSession } from '../engine-adapter.js';
import { isBlocked, isSegmentWalkable, nearestWalkable, findPath } from '../world.js';
import { applyRemainingTerrain, applyTerrainHotspotAdjustments, REMAINING_TERRAIN_ROOMS } from '../terrain.js';

function calibratedScenes() {
  const scenes=structuredClone(SCENES);
  applyRemainingTerrain(scenes);
  return scenes;
}
function defaultHotspots(room) {
  const state=new GameState();state.room=room;state.chapter=SCENES[room].chapter;
  state.itemLoc=Object.fromEntries(Object.entries(ITEMS).filter(([,item])=>item.start).map(([id,item])=>[id,item.start]));
  return applyTerrainHotspotAdjustments(room,getHotspots(state));
}

test('其余十五场景补齐地面；重复调用不改原方向、目标或四个精校场景',()=>{
  const scenes=structuredClone(SCENES),keep={};
  for(const id of ['palace_gate','broad_walk','flower_walk','round_pond'])keep[id]=structuredClone(scenes[id]);
  const truth=Object.fromEntries(Object.entries(scenes).map(([id,scene])=>[id,scene.exits.map(({dir,target})=>({dir,target}))]));
  const result=applyRemainingTerrain(scenes);assert.equal(result.updated.length,15);
  for(const id of REMAINING_TERRAIN_ROOMS){
    assert.ok(scenes[id].walkablePolygons.length>0,id);
    assert.deepEqual(scenes[id].footprint,{rx:6,ry:3});
    assert.deepEqual(scenes[id].exits.map(({dir,target})=>({dir,target})),truth[id]);
  }
  for(const [id,prior]of Object.entries(keep)){
    // Destination landing points must track the other scene's newly calibrated
    // spawn, while this room's own ground traces/exit positions stay unchanged.
    const withoutLandings=scene=>({...scene,exits:scene.exits.map(({spawn,...exit})=>exit)});
    assert.deepEqual(withoutLandings(scenes[id]),withoutLandings(prior),id);
  }
  const after=structuredClone(scenes);applyRemainingTerrain(scenes);assert.deepEqual(scenes,after);
});

test('长水湖禁止穿越湖面，涉水房只开放下方可见的浅水河床',()=>{
  const scenes=calibratedScenes();
  for(const point of [[350,150],[350,240],[270,200],[430,80]])assert.equal(isBlocked(scenes.long_water,...point),true,`long_water ${point}`);
  assert.equal(isBlocked(scenes.long_water,170,235),false);
  for(const point of [[320,80],[420,150],[210,100]])assert.equal(isBlocked(scenes.wading,...point),true,`wading深水 ${point}`);
  for(const point of [[180,238],[220,245],[300,267]])assert.equal(isBlocked(scenes.wading,...point),false,`wading浅水 ${point}`);
});

test('南北沼泽的积水、落木与树林不可穿，蜿蜒泥路保持通行',()=>{
  const scenes=calibratedScenes();
  for(const point of [[115,135],[395,236],[355,128]])assert.equal(isBlocked(scenes.south_bog,...point),true,`south_bog ${point}`);
  assert.equal(isBlocked(scenes.south_bog,249,172),false);
  for(const point of [[125,200],[370,180]])assert.equal(isBlocked(scenes.north_bog,...point),true,`north_bog ${point}`);
  assert.equal(isBlocked(scenes.north_bog,240,180),false);
});

test('石阶可登，平台基座和侧面的崖壁/管道/围墙不作为地面',()=>{
  const scenes=calibratedScenes();
  assert.equal(isBlocked(scenes.bottom_of_stairs,242,100),false);
  assert.equal(isBlocked(scenes.bottom_of_stairs,348,150),true);
  assert.equal(isBlocked(scenes.vertex,242,135),true);
  assert.equal(isBlocked(scenes.vertex,242,245),false);
  assert.equal(isBlocked(scenes.black_lion_gate,350,60),true);
  assert.equal(isBlocked(scenes.lancaster_gate,340,200),true);
  assert.equal(isBlocked(scenes.trellises,135,80),true);
  assert.equal(isBlocked(scenes.summit,172,200),true);
});

test('所有新增地面的出生点、默认出口和调整后的热点都能在互动距离内接近',()=>{
  const scenes=calibratedScenes(),errors=[];
  for(const id of REMAINING_TERRAIN_ROOMS){
    const scene=scenes[id];
    if(isBlocked(scene,...scene.spawn)){errors.push(`${id}:spawn`);continue;}
    for(const object of [...scene.exits,...defaultHotspots(id)]){
      const target=[object.x,object.y],near=nearestWalkable(scene,target,{from:scene.spawn});
      if(!near||Math.hypot(near.x-object.x,near.y-object.y)>=object.radius){errors.push(`${id}:${object.id||object.dir}:range`);continue;}
      const path=findPath(scene,scene.spawn,near);
      if(!path.length){errors.push(`${id}:${object.id||object.dir}:path`);continue;}
      for(let step=1;step<path.length;step++)if(!isSegmentWalkable(scene,path[step-1],path[step]))errors.push(`${id}:${object.id||object.dir}:segment`);
    }
  }
  assert.deepEqual(errors,[]);
});

test('推车到因弗内斯后，真实车身占位仍保留通向南出口的完整步行路径',async()=>{
  const engine=createPrologueSession();engine.moveTo(engine.state.room);
  for(const input of ['n','n','push pram'])await engine.processInput(input);
  assert.equal(engine.state.room,'inverness_terrace');
  const scene=calibratedScenes().inverness_terrace;
  const objects=getHotspots(engine.state),pram=objects.find(object=>object.kind==='pram');
  assert.ok(pram,'推来的婴儿车必须仍在场');
  assert.equal(isBlocked(scene,pram.x,pram.y),false,'车轮落在实际步道上');
  // Match the physical foot areas used for the visible car and boy; the player
  // ellipse is still applied by world.js rather than baking it into these boxes.
  const bodies=objects.filter(object=>['pram','boy'].includes(object.kind)).map(object=>{
    const rx=object.kind==='pram'?20:6,ry=object.kind==='pram'?7:3;
    return {x:object.x-rx,y:object.y-ry,w:rx*2,h:ry*2};
  });
  const navigation={...scene,obstacles:[...scene.obstacles,...bodies]};
  assert.equal(isBlocked(navigation,pram.x,pram.y),true,'不能用取消车身碰撞来让路');
  assert.equal(isBlocked(navigation,...scene.spawn),false,'出生点不能落进车身');
  const exit=scene.exits.find(exit=>exit.dir==='s');
  assert.ok(exit);assert.equal(exit.target,'round_pond');
  const nearest=nearestWalkable(navigation,exit,{from:scene.spawn});
  assert.ok(nearest&&Math.hypot(nearest.x-exit.x,nearest.y-exit.y)<exit.radius,'车前不能被误当成出口');
  const path=findPath(navigation,scene.spawn,exit);
  assert.ok(path.length>1,'不用nearest容错也必须能走到真正的南出口');
  assert.deepEqual(path.at(-1),[exit.x,exit.y]);
  for(let index=1;index<path.length;index++)assert.ok(isSegmentWalkable(navigation,path[index-1],path[index]));
});

test('热点校准只改视觉坐标/距离，保留稳定身份、事件和动作',()=>{
  const objects=[{id:'long_water:door',kind:'door',x:320,y:145,radius:37,eventId:'examine_door_lw',actions:[{label:'涉水',command:'s'}]},
    {id:'item:paper_bird',kind:'paper_bird',itemId:'paper_bird',x:275,y:220,radius:37,actions:[{command:'take paper bird'}]}];
  const prior=structuredClone(objects),adjusted=applyTerrainHotspotAdjustments('long_water',objects);
  assert.deepEqual(objects,prior,'不能修改原目录对象');
  for(let i=0;i<objects.length;i++){
    assert.equal(adjusted[i].id,objects[i].id);assert.equal(adjusted[i].eventId,objects[i].eventId);
    assert.deepEqual(adjusted[i].actions,objects[i].actions);
  }
  assert.ok(adjusted[0].radius>objects[0].radius);assert.ok(adjusted[1].x<210);
});
