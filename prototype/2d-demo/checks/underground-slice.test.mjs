import test from 'node:test';import assert from 'node:assert/strict';
import {createPrologueSession} from '../engine-adapter.js';
import {SCENES,sceneExits} from '../scene-manifest.js';
import {getHotspots,getInventoryActions} from '../interaction-catalog.js';
import {resolveInteraction,resolveHeldSelf} from '../interaction-intent.js';
import {isBlocked,isSegmentWalkable,findPath,approachingExit} from '../world.js';
import {roomArrival} from '../arrivals.js';
import {makeVisualSave,restoreVisualSave} from '../save.js';
import {createNarrativeDirector} from '../narrative.js';
import {buildChapterMap} from '../chapter-map.js';
import {illustratedMapNodes} from '../map-geography.js';
import {terrainMarkup} from '../chapter-map-art.js';
const road=['e','take ball','nw','unscrew gnomon','take gnomon','n','take paper bird','open paper bird','w','buy crumbs','feed birds','take ruby','n','push pram','push pram','wait','throw ball at tree','take umbrella','push pram','open pram','enter pram','open umbrella','take paper bird','take gnomon','enter water','enter door','n','ne','take splinter','e','u'];
async function ready(){const e=createPrologueSession();e.moveTo(e.state.room);for(const c of road)await e.processInput(c);assert.equal(e.state.room,'vertex');for(let i=0;e.state.sundialSymbol!==2&&i<7;i++)await e.processInput('turn ring');for(const c of ['d','ne','e','nw','e','s','n','in'])await e.processInput(c);assert.equal(e.state.room,'ossuary');return e;}
const snap=e=>({...e.state.serialize(),visual:{room:e.state.room,player:{x:SCENES[e.state.room].spawn[0],y:SCENES[e.state.room].spawn[1]}}});
test('合法序章与光源进入地下，拿取/点亮/留下灯笼后返回，不增加得分或物品',async()=>{
 const e=await ready();for(const c of ['in','e','take walkie-talkie','e','take lantern','turn lantern','w','drop lantern','drop splinter','w','e']){await e.processInput(c);assert.equal(e.state.dead,false,c);}
 assert.ok(e.state.hasFlag('lantern_dropped_middle'));assert.equal(e.state.itemAt('lantern'),'underground_2');
 assert.ok(getHotspots(e.state).some(o=>o.itemId==='lantern'));await e.processInput('take lantern');for(const c of ['w','w'])await e.processInput(c);
 assert.equal(e.state.room,'ossuary');assert.equal(e.state.chapter,'wabe');assert.equal(e.state.score,17);assert.ok(e.state.has('walkie_talkie'));assert.ok(e.state.has('lantern'));
});
test('Pluto门与无光致命条件继续由原章决定，表现层不能跳过',async()=>{
 const e=await ready();await e.processInput('out');await e.processInput('s');await e.processInput('s');await e.processInput('w');await e.processInput('se');await e.processInput('w');await e.processInput('sw');await e.processInput('u');
 assert.equal(e.state.room,'vertex');await e.processInput('turn ring');for(const c of ['d','ne','e','nw','e','s','n','in','in'])await e.processInput(c);assert.equal(e.state.room,'ossuary');
 const dark=await ready();await dark.processInput('drop splinter');await dark.processInput('in');assert.equal(dark.state.dead,false);await dark.processInput('e');assert.equal(dark.state.dead,true);
});
test('全部8房出入口有真实安全落点；通行别名共用物理口，封闭末室不画假门',async()=>{
 const e=await ready();await e.processInput('in');
 for(const id of ['bluff','cottage','cemetery','barrow','ossuary','underground_1','underground_2','underground_3'])for(const exit of sceneExits(id,e.state,e.rooms)){
  const target=SCENES[exit.target],a=roomArrival(target,{fromRoom:id,direction:exit.dir,exits:sceneExits(exit.target,e.state,e.rooms)});
  assert.ok(a&&!isBlocked(target,a.x,a.y),`${id}.${exit.dir}`);assert.ok(findPath(target,a,target.spawn).length);
  if(exit.interactionOnly)assert.equal(approachingExit(exit,{x:exit.x,y:exit.y+4},{x:exit.x,y:exit.y}),false);
 }
 assert.deepEqual(sceneExits('underground_3',e.state,e.rooms).map(x=>x.dir),['w']);
 assert.ok(sceneExits('cottage',e.state,e.rooms).every(x=>x.dir!=='out'));assert.ok(sceneExits('cemetery',e.state,e.rooms).every(x=>x.dir!=='in'));
});
test('F先观察再取物、手持灯可点亮、携物可出门；灯与对讲机只随真实位置显隐',async()=>{
 const e=await ready();await e.processInput('in');await e.processInput('e');
 let o=getHotspots(e.state).find(o=>o.itemId==='walkie_talkie');assert.equal(resolveInteraction(e.state,o),'examine walkie-talkie');assert.equal(resolveInteraction(e.state,o,{observed:new Set([o.id])}),'take walkie-talkie');
 await e.processInput('take walkie-talkie');assert.ok(!getHotspots(e.state).some(o=>o.itemId==='walkie_talkie'));await e.processInput('e');o=getHotspots(e.state).find(o=>o.itemId==='lantern');assert.ok(o);await e.processInput('take lantern');assert.ok(!getHotspots(e.state).some(o=>o.itemId==='lantern'));assert.equal(resolveHeldSelf('lantern',e.state),'turn lantern');assert.ok(getInventoryActions('lantern',e.state).some(a=>a.command==='turn lantern'));
 await e.processInput('turn lantern');assert.equal(resolveHeldSelf('lantern',e.state),'examine lantern');for(const c of ['w','w'])await e.processInput(c);o=getHotspots(e.state).find(o=>o.kind==='passage');assert.equal(resolveInteraction(e.state,o,{heldItem:'lantern'}),'w');
});
test('独立绘画道路中心线可走，悬崖/锅/岩壁/裂缝与圆筒禁止穿过',()=>{
 const lines={bluff:[[[45,275],[102,224],[181,189],[240,180],[340,168],[420,145],[464,132]],[[240,180],[342,211],[431,275]]],cottage:[[[16,135],[70,154],[170,210],[241,221],[410,165],[464,135]],[[241,221],[241,275]]],cemetery:[[[249,275],[274,240],[254,204],[222,164],[193,135],[222,110],[238,85]]],barrow:[[[240,275],[240,211],[240,150],[240,103]]],ossuary:[[[240,275],[238,235],[240,195],[235,157],[292,123],[350,130]]],underground_1:[[[28,145],[90,164],[250,164],[390,165],[464,145]]],underground_2:[[[24,126],[82,164],[230,179],[390,164],[458,126]]],underground_3:[[[24,141],[100,165],[200,180],[300,195],[379,180]]]};
 for(const [id,paths]of Object.entries(lines))for(const path of paths)for(let i=1;i<path.length;i++)assert.ok(isSegmentWalkable(SCENES[id],path[i-1],path[i]),`${id}: ${path[i-1]}→${path[i]}`);
 for(const [id,x,y]of [['bluff',200,40],['cottage',240,159],['cemetery',100,140],['barrow',80,150],['underground_1',240,227],['underground_2',240,90],['underground_3',350,165]])assert.ok(isBlocked(SCENES[id],x,y),id);
});
test('新章节读档保留灯、物品、地图且不重演进场，门口短演出不再提交命令',async()=>{
 const e=await ready(),d=createNarrativeDirector(),before=snap(e);await e.processInput('in');const committed=e.state.serialize();d.onCommand(before,snap(e),'in');assert.equal(d.getState().currentEvent,'cliff_passage');d.update(.2);d.skip();assert.deepEqual(e.state.serialize(),committed);
 for(const c of ['e','take walkie-talkie','e','take lantern','turn lantern'])await e.processInput(c);
 const packet=makeVisualSave(e,{room:e.state.room,x:200,y:180,face:'right'}),fresh=createPrologueSession();await restoreVisualSave(fresh,packet);assert.deepEqual(fresh.state.serialize(),e.state.serialize());
 const model=buildChapterMap({state:fresh.state,rooms:fresh.rooms,scenes:SCENES}),nodes=illustratedMapNodes(model);assert.equal(model.chapter,'underground');assert.equal(nodes.length,3);assert.ok(nodes[0].x<nodes[1].x&&nodes[1].x<nodes[2].x);assert.equal(new Set(nodes.map(n=>n.cn)).size,3);assert.ok(terrainMarkup('underground','qa',nodes).includes('M 83 249'));assert.equal(createNarrativeDirector().getState(fresh.state).currentEvent,null);
});
