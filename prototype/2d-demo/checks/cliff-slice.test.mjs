import test from 'node:test';
import assert from 'node:assert/strict';
import {createPrologueSession} from '../engine-adapter.js';
import {SCENES,sceneExits,sceneBoundaries} from '../scene-manifest.js';
import {getHotspots} from '../interaction-catalog.js';
import {resolveInteraction} from '../interaction-intent.js';
import {isBlocked,isSegmentWalkable,findPath,approachingExit} from '../world.js';
import {roomArrival} from '../arrivals.js';
import {createCliffPassage,sampleCliffPassage} from '../cliff-motion.js';
import {createNarrativeDirector} from '../narrative.js';
import {makeVisualSave,restoreVisualSave} from '../save.js';
import {filterVisualPresence} from '../visual-text-policy.js';
import {buildChapterMap} from '../chapter-map.js';
import {illustratedMapNodes} from '../map-geography.js';
import {ROOMS} from '../../js/data/wabe.js';
const road=['e','take ball','nw','unscrew gnomon','take gnomon','n','take paper bird','open paper bird','w','buy crumbs','feed birds','take ruby','n','push pram','push pram','wait','throw ball at tree','take umbrella','push pram','open pram','enter pram','open umbrella','take paper bird','take gnomon','enter water','enter door','n','ne','e'];
async function garden(){const e=createPrologueSession();e.moveTo(e.state.room);for(const c of road){await e.processInput(c);assert.equal(e.state.dead,false,c);}assert.equal(e.state.room,'bottom_of_stairs');return e;}
const snap=(e,player)=>({...e.state.serialize(),visual:{room:e.state.room,player:player||{x:SCENES[e.state.room].spawn[0],y:SCENES[e.state.room].spawn[1]}}});

test('四房由真实序章进入，经洞穴/坑底支线返回闭环，不改变物品/符号规则',async()=>{
 const e=await garden(),symbol=e.state.sundialSymbol;
 for(const c of ['ne','examine hive','examine bees','in','examine icicles','out','e','examine crater','d','examine lump'])await e.processInput(c);
 assert.equal(e.state.room,'crater');assert.equal(e.state.itemAt('lump'),'crater');assert.ok(!e.state.has('lump'));
 await e.processInput('take lump');assert.ok(!e.state.has('lump'),'原章固定金属不被图形层改成可取奖励');
 for(const c of ['u','s','w','n','sw'])await e.processInput(c);
 assert.equal(e.state.room,'bottom_of_stairs');assert.equal(e.state.sundialSymbol,symbol);
 for(const id of ['under_cliff','ice_cavern','craters_edge','crater'])assert.ok(e.state.visited.has(id));
});
test('独立画面中心线可走，岩壁/坑壁与无路的背面不可穿；楼梯NE不借中心U',()=>{
 const lines={
 bottom_of_stairs:[[[237,210],[237,100],[237,25]],[[237,181],[335,160],[380,140],[409,118],[441,86],[451,62],[447,36],[448,16]],[[237,181],[130,176],[16,175]],[[237,181],[335,196],[403,221],[464,237]],[[38,16],[47,39],[48,70],[47,89],[67,115],[89,132],[118,147],[170,163],[237,181]]],
 under_cliff:[[[16,157],[124,171],[241,186],[365,170],[464,152]],[[24,273],[101,228],[241,186],[353,227],[455,272]],[[235,275],[230,241],[241,186],[248,147],[237,105]]],
 ice_cavern:[[[46,132],[64,145],[95,168],[134,187],[240,205],[370,210]]],
 craters_edge:[[[16,116],[85,119],[120,157],[170,187],[223,219],[247,275]],[[16,226],[72,202],[125,168],[140,109],[94,57],[49,16]],[[176,189],[224,212],[285,205],[310,175],[330,143],[340,129]]],
 crater:[[[57,25],[75,49],[102,85],[99,112],[110,151],[132,192],[178,230],[255,230]]],
 };
 for(const [id,paths]of Object.entries(lines))for(const path of paths)for(let i=1;i<path.length;i++)assert.ok(isSegmentWalkable(SCENES[id],path[i-1],path[i]),`${id}: ${path[i-1]} → ${path[i]}`);
 for(const [id,x,y]of [['under_cliff',135,90],['ice_cavern',300,70],['craters_edge',400,90],['crater',400,90],['bottom_of_stairs',180,100]])assert.ok(isBlocked(SCENES[id],x,y),`${id}: wall`);
 const entry={x:43.498,y:167.646},path=findPath(SCENES.bottom_of_stairs,entry,{x:245,y:112});assert.ok(path.length);
 for(let i=1;i<path.length;i++){
  const a=path[i-1],b=path[i],steps=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/.25);
  for(let j=0;j<=steps;j++)assert.ok(!isBlocked(SCENES.bottom_of_stairs,a[0]+(b[0]-a[0])*j/steps,a[1]+(b[1]-a[1])*j/steps),'左路点击石阶须连续通行，不得漏过亚像素转角裂缝');
 }
});
test('出入口方向与原章一致，来源入口内侧出现且向内走不立刻返程',async()=>{
 const e=await garden();
 for(const id of ['bottom_of_stairs','under_cliff','ice_cavern','craters_edge','crater']){
  const ex=sceneExits(id,e.state,e.rooms);for(const exit of ex){
   const raw=ROOMS[id].exits(e.state)[exit.dir];assert.equal(exit.target,typeof raw==='string'?raw:raw.to);
   const target=SCENES[exit.target],returns=sceneExits(exit.target,e.state,e.rooms),a=roomArrival(target,{fromRoom:id,direction:exit.dir,exits:returns});
   assert.ok(a&&!isBlocked(target,a.x,a.y));assert.ok(findPath(target,a,target.spawn).length);
  }
 }
 for(const [id,dir]of [['under_cliff','in'],['ice_cavern','out'],['craters_edge','d'],['crater','u']]){
  const exit=sceneExits(id,e.state,e.rooms).find(x=>x.dir===dir);assert.equal(exit.interactionOnly,true);
  assert.equal(approachingExit(exit,{x:exit.x,y:exit.y+5},{x:exit.x,y:exit.y}),false);
  const o=getHotspots({...e.state,room:id,inRoom:e.state.inRoom.bind(e.state),roomItems:()=>[]}).find(o=>o.kind==='passage');
  assert.equal(resolveInteraction(e.state,o,{heldItem:'umbrella'}),dir,'手持物品不锁住出口');
 }
 assert.ok(sceneBoundaries('under_cliff',e.state,e.rooms).some(x=>x.dir==='w'));
 assert.equal(sceneBoundaries('craters_edge',e.state,e.rooms).some(x=>x.dir==='nw'),false);
 assert.equal(sceneExits('craters_edge',e.state,e.rooms).find(x=>x.dir==='nw').target,'bluff');
});
test('洞口及缓坡短演出使用可走地面，完成/跳过只改变呈现，存档恢复不重演',async()=>{
 const e=await garden(),d=createNarrativeDirector();await e.processInput('ne');
 for(const command of ['in','out','e','d','u']){
  d.skip();const before=snap(e);await e.processInput(command);const after=snap(e),committed=e.state.serialize();
  d.onCommand(before,after,command);const motion=createCliffPassage(before,after);
  if(!motion)continue;
  assert.equal(d.getState().currentEvent,'cliff_passage');assert.equal(d.getState().sceneRoom,before.room);assert.equal(d.getState().hidePlayer,true);
  let prev=null;for(let i=0;i<=20;i++){const f=sampleCliffPassage(motion,motion.duration*i/20),a=f.actor;assert.ok(!isBlocked(SCENES[before.room],a.x,a.y));if(prev)assert.ok(isSegmentWalkable(SCENES[before.room],prev,[a.x,a.y]));prev=[a.x,a.y];}
  d.update(.3);d.skip();assert.deepEqual(e.state.serialize(),committed);
  const save=makeVisualSave(e,{room:e.state.room,x:SCENES[e.state.room].spawn[0],y:SCENES[e.state.room].spawn[1],face:'down'});
  const prepared=await restoreVisualSave(createPrologueSession(),save);assert.equal(prepared.save.engine.state.room,e.state.room);
  assert.equal(createNarrativeDirector().getState(e.state).currentEvent,null);
 }
});
test('可见金属提示仅在进场删除；主动观察/烫伤、蜂巢声音与磁力感受保留',async()=>{
 const e=await garden();for(const c of ['ne','e','d'])await e.processInput(c);
 const text=ROOMS.crater.desc(e.state),objects=getHotspots(e.state),shown=filterVisualPresence(text,{room:'crater',objects,source:'room'});
 assert.ok(shown.removed.includes('crater-hot-metal'));assert.ok(!shown.text.includes('lies here'));assert.ok(shown.text.includes('magnetic attraction'));
 assert.equal(filterVisualPresence(text,{room:'crater',objects,source:'event'}).text,text);
 assert.equal(objects.filter(o=>o.itemId==='lump').length,1);
 assert.ok(objects.find(o=>o.itemId==='lump').actions.every(a=>!a.command.startsWith('take ')));
 e.state.room='under_cliff';const hive=filterVisualPresence(ROOMS.under_cliff.desc(e.state),{room:e.state.room,objects:getHotspots(e.state),source:'room'});assert.ok(hive.text.includes('frightening drone'));
});
test('M只揭示已探索四房且靠近北部崖地，存读档不移动已知地图节点',async()=>{
 const e=await garden();for(const c of ['ne','in','out','e','d'])await e.processInput(c);
 const model=buildChapterMap({state:e.state,rooms:e.rooms,scenes:SCENES}),nodes=illustratedMapNodes(model);
 assert.ok(nodes.some(n=>n.id==='crater'));assert.ok(!nodes.some(n=>n.id==='bluff'));
 const cliff=nodes.find(n=>n.id==='under_cliff'),ice=nodes.find(n=>n.id==='ice_cavern'),pit=nodes.find(n=>n.id==='crater');
 assert.ok(Math.hypot(cliff.x-ice.x,cliff.y-ice.y)<150);assert.ok(pit.x>cliff.x&&pit.y<330);
});
