import {lockPortalShadow} from './vertex-install-fixture.mjs';
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
const road=['e','take ball','nw','unscrew gnomon','take gnomon','n','take paper bird','open paper bird','w','buy crumbs','feed birds','take ruby','n','push pram','push pram','wait','throw ball at tree','take umbrella','push pram','open pram','enter pram','open umbrella','take paper bird','take gnomon','enter water','enter door','n','ne','move log','take splinter','e','u'];
async function ready(){const e=createPrologueSession();e.moveTo(e.state.room);for(const c of road)await e.processInput(c);assert.equal(e.state.room,'vertex');await lockPortalShadow(e,'third');for(const c of ['d','ne','e','nw','e','s','n','in'])await e.processInput(c);assert.equal(e.state.room,'ossuary');return e;}
const snap=e=>({...e.state.serialize(),visual:{room:e.state.room,player:{x:SCENES[e.state.room].spawn[0],y:SCENES[e.state.room].spawn[1]}}});
test('合法序章与光源进入地下，拿取/点亮/留下灯笼后返回，不增加得分或物品',async()=>{
 const e=await ready();for(const c of ['in','take lantern','turn lantern','w','take walkie-talkie','drop lantern','drop splinter','w','e']){await e.processInput(c);assert.equal(e.state.dead,false,c);}
 assert.ok(e.state.hasFlag('lantern_dropped_middle'));assert.equal(e.state.itemAt('lantern'),'underground_2');
 assert.ok(getHotspots(e.state).some(o=>o.itemId==='lantern'));await e.processInput('take lantern');for(const c of ['e','e'])await e.processInput(c);
 assert.equal(e.state.room,'ossuary');assert.equal(e.state.chapter,'wabe');assert.equal(e.state.score,23);assert.ok(e.state.has('walkie_talkie'));assert.ok(e.state.has('lantern'));
});
test('纳骨堂白门与无光致命条件按游玩状态决定，表现层不能跳过',async()=>{
 const e=await ready();await e.processInput('out');await e.processInput('s');await e.processInput('s');await e.processInput('w');await e.processInput('se');await e.processInput('w');await e.processInput('sw');await e.processInput('u');
 assert.equal(e.state.room,'vertex');await e.processInput('turn ring');for(const c of ['d','ne','e','nw','e','s','n','in','in'])await e.processInput(c);assert.equal(e.state.room,'ossuary');
 const dark=await ready();await dark.processInput('drop splinter');await dark.processInput('in');assert.equal(dark.state.dead,false);await dark.processInput('w');assert.equal(dark.state.dead,true);
});
test('全部8房出入口有真实安全落点；通行别名共用物理口，西端塌方不画假门',async()=>{
 const e=await ready();await e.processInput('in');
 for(const id of ['bluff','cottage','cemetery','barrow','ossuary','underground_1','underground_2','underground_3'])for(const exit of sceneExits(id,e.state,e.rooms)){
  const target=SCENES[exit.target],a=roomArrival(target,{fromRoom:id,direction:exit.dir,exits:sceneExits(exit.target,e.state,e.rooms)});
  assert.ok(a&&!isBlocked(target,a.x,a.y),`${id}.${exit.dir}`);assert.ok(findPath(target,a,target.spawn).length);
  if(exit.interactionOnly)assert.equal(approachingExit(exit,{x:exit.x,y:exit.y+4},{x:exit.x,y:exit.y}),false);
 }
 assert.deepEqual(sceneExits('underground_3',e.state,e.rooms).map(x=>x.dir).sort(),['e','w']);assert.deepEqual(sceneExits('underground_1',e.state,e.rooms).map(x=>x.dir),['e']);
 assert.ok(sceneExits('cottage',e.state,e.rooms).every(x=>x.dir!=='out'));assert.ok(sceneExits('cemetery',e.state,e.rooms).every(x=>x.dir!=='in'));
});
test('F先观察再取物、手持灯可点亮、携物可出门；灯与对讲机只随真实位置显隐',async()=>{
 const e=await ready();await e.processInput('in');await e.processInput('w');
 let o=getHotspots(e.state).find(o=>o.itemId==='walkie_talkie');assert.equal(resolveInteraction(e.state,o),'examine walkie-talkie');assert.equal(resolveInteraction(e.state,o,{observed:new Set([o.id])}),'take walkie-talkie');
 await e.processInput('take walkie-talkie');assert.ok(!getHotspots(e.state).some(o=>o.itemId==='walkie_talkie'));await e.processInput('e');o=getHotspots(e.state).find(o=>o.itemId==='lantern');assert.ok(o);await e.processInput('take lantern');assert.ok(!getHotspots(e.state).some(o=>o.itemId==='lantern'));assert.equal(resolveHeldSelf('lantern',e.state),'turn on lantern');assert.ok(getInventoryActions('lantern',e.state).some(a=>a.command==='turn on lantern'));
 await e.processInput('turn lantern');assert.equal(resolveHeldSelf('lantern',e.state),'turn off lantern');o=getHotspots(e.state).find(o=>o.kind==='passage');assert.equal(resolveInteraction(e.state,o,{heldItem:'lantern'}),'e');
});
test('独立绘画道路中心线可走，悬崖/锅/岩壁/裂缝与圆筒禁止穿过',()=>{
 const lines={bluff:[[[45,275],[102,224],[181,189],[240,180],[340,168],[420,145],[464,132]],[[240,180],[342,211],[431,275]]],cottage:[[[16,135],[70,154],[170,210],[241,221],[410,165],[464,135]],[[241,221],[241,275]]],cemetery:[[[249,275],[244,244],[260,203],[224,161],[242,140],[246,110],[243,85]],[[224,161],[197,151],[153,144],[139,136],[118,131]]],barrow:[[[240,275],[240,211],[240,150],[240,103]]],ossuary:[[[240,275],[238,235],[240,195],[235,157],[292,123],[350,130]]],underground_1:[[[57,158],[90,164],[250,164],[390,165],[464,145]]],underground_2:[[[24,126],[82,164],[230,179],[390,164],[458,126]]],underground_3:[[[24,141],[100,165],[200,180],[300,195],[370,187],[392,174],[402,156],[411,140],[407,119]]]};
 for(const [id,paths]of Object.entries(lines))for(const path of paths)for(let i=1;i<path.length;i++)assert.ok(isSegmentWalkable(SCENES[id],path[i-1],path[i]),`${id}: ${path[i-1]}→${path[i]}`);
 for(const [id,x,y]of [['bluff',200,40],['cottage',240,159],['cemetery',100,140],['barrow',80,150],['underground_1',28,145],['underground_1',240,227],['underground_2',240,90],['underground_3',350,165]])assert.ok(isBlocked(SCENES[id],x,y),id);
});
test('新章节读档保留灯、物品、地图且不重演进场，门口短演出不再提交命令',async()=>{
 const e=await ready(),d=createNarrativeDirector(),before=snap(e);await e.processInput('in');const committed=e.state.serialize();d.onCommand(before,snap(e),'in');assert.equal(d.getState().currentEvent,'cliff_passage');d.update(.2);d.skip();assert.deepEqual(e.state.serialize(),committed);
 for(const c of ['w','take walkie-talkie','w','e','e','take lantern','turn lantern'])await e.processInput(c);
 const packet=makeVisualSave(e,{room:e.state.room,x:200,y:180,face:'right'}),fresh=createPrologueSession();await restoreVisualSave(fresh,packet);assert.deepEqual(fresh.state.serialize(),e.state.serialize());
 const model=buildChapterMap({state:fresh.state,rooms:fresh.rooms,scenes:SCENES}),nodes=illustratedMapNodes(model);assert.equal(model.chapter,'underground');assert.equal(nodes.length,3);assert.ok(nodes[0].x<nodes[1].x&&nodes[1].x<nodes[2].x);assert.equal(new Set(nodes.map(n=>n.cn)).size,3);assert.ok(terrainMarkup('underground','qa',nodes).includes('M 83 249'));assert.equal(createNarrativeDirector().getState(fresh.state).currentEvent,null);
});

test('纳骨堂入门即拾灯，东墙方向别名与点门的耗时、消门与读档',async()=>{
 for(const [out,cost] of [['e',0],['in',0],['out',0],['enter door',1]]){
  const e=await ready(),messages=[];e.ui.text=t=>messages.push(t);
  const before=e.state.turns;await e.processInput('enter door');
  assert.equal(e.state.room,'underground_3');assert.equal(e.state.turns,before+1);
  assert.equal(e.state.itemAt('lantern'),'underground_3');assert.equal(e.state.itemAt('walkie_talkie'),'underground_2');
  assert.equal(messages.filter(t=>t.includes('A lantern is lying in the dirt')).length,1);
  if(out==='e')await e.processInput('take lantern');
  const atDoor=e.state.turns;messages.length=0;await e.processInput(out);
  assert.equal(e.state.turns,atDoor+cost);assert.equal(e.state.room,'ossuary');assert.equal(e.state.chapter,'wabe');
  assert.ok(messages[0].includes('You slip through the white door.'));
  assert.ok(messages.at(-1).includes('The white door fades away'));
  assert.equal(e.state.itemAt('lantern'),out==='e'?'inventory':'underground_3');
  const save=e.serialize(),again=createPrologueSession();again.ui.text=t=>messages.push(t);
  await again.deserialize(save);
  for(const command of ['in','examine door','open door','close door','enter door']){
    messages.length=0;await again.processInput(command);
    assert.equal(again.state.room,'ossuary');
    assert.equal(again.state.turns,save.state.turns);
    assert.equal(messages.length,1);assert.match(messages[0],/white door you saw here before is gone now/);
  }
  assert.ok(!sceneExits('ossuary',again.state,again.rooms).some(x=>x.dir==='in'));
  await again.processInput('examine toadstool');
  assert.match(messages.at(-1),/twelve feet/);assert.equal(again.state.turns,save.state.turns+1);
 }
});

test('地下旧存档从西端或中室可沿东路返回，地面的旧灯不复位',async()=>{
 for(const [room,path] of [['underground_1',['e','e']],['underground_2',['e']],['underground_3',[]]]){
  const e=await ready();await e.processInput('in');const save=e.serialize();
  save.state.room=room;
  save.state.itemLoc.lantern='underground_2';
  save.state.flags=save.state.flags.filter(f=>f!=='ossuary_door_spent' && f!=='underground_items_placed');
  const old=createPrologueSession();const messages=[];old.ui.text=t=>messages.push(t);await old.deserialize(save);
  if(room==='underground_1'){
   const from=old.state.turns;
   for(const dir of ['w','in']){
    await old.processInput(dir);assert.equal(old.state.room,room);assert.equal(old.state.turns,from);
    assert.match(messages.at(-1),/landslide blocks your path/);
   }
  }
  for(const dir of path)await old.processInput(dir);
  assert.equal(old.state.room,'underground_3');assert.equal(old.state.itemAt('lantern'),'underground_2');
  await old.processInput('out');assert.equal(old.state.room,'ossuary');
  assert.ok(old.state.hasFlag('ossuary_door_spent'));assert.equal(old.state.itemAt('lantern'),'underground_2');
 }
});

test('对未对准的门和已敞开白门的观察、开关、方向指令与实机耗时一致',async()=>{
 const e=createPrologueSession();await e.activateChapter('wabe');e.state.chapter='wabe';e.moveTo('ossuary');
 const messages=[];e.ui.text=t=>messages.push(t);
 async function check(cmd, pattern, moves) {
  const before=e.state.turns;messages.length=0;await e.processInput(cmd);
  assert.match(messages[0],pattern,cmd);assert.equal(e.state.turns,before+moves,cmd);
 }
 e.state.setCnt('vertex_shadow_tick',32);e.state.clearFlag('vertex_lever_up');
 await check('look at the door',/closed white door is of stately residential design/,1);
 await check('in',/white door is closed/,0);
 await check('enter door',/white door is closed/,1);
 await check('open door',/white door won't budge/,1);
 await check('close door',/already closed/,1);
 e.state.setCnt('vertex_shadow_tick',58);await check('open door',/already open/,1);
 await check('in',/explore the door's edge/,1);assert.equal(e.state.room,'underground_3');
 await check('examine door',/open white door is of stately residential design/,1);
 await check('close door',/white door won't budge/,1);
  await check('exit door',/not in the white door/,1);
 await check('out',/slip through the white door/,0);
 e.state.setCnt('vertex_shadow_tick',32);e.state.clearFlag('vertex_lever_up');await check('in',/gone now/,0);
 e.state.setCnt('vertex_shadow_tick',58);await check('in',/gone now/,0);
});
