import test from 'node:test';
import assert from 'node:assert/strict';
import {createJapanMotion,sampleJapanMotion} from '../japan-motion.js';
import {SCENES,sceneExits,sceneBoundaries} from '../scene-manifest.js';
import {isBlocked,isSegmentWalkable,findPath,leavingBoundaryExit} from '../world.js';
import {GIRL_SCALE,GIRL_FRAMES,JAPAN_GROUPS,JAPAN_PROPS} from '../japan-art-layout.js';
import {createPrologueSession} from '../engine-adapter.js';
import {createNarrativeDirector} from '../narrative.js';
import {JAPAN_POINTS as P} from '../japan-route-layout.js';
import {roomArrival} from '../arrivals.js';
import {terrainMarkup} from '../chapter-map-art.js';
import {buildChapterMap} from '../chapter-map.js';
const route=['e','take ball','nw','unscrew gnomon','take gnomon','n','take paper bird','open paper bird','w','buy crumbs','feed birds','take ruby','n','push pram','push pram','wait','throw ball at tree','take umbrella','push pram','open pram','enter pram','open umbrella','take paper bird','take gnomon','enter water','enter door','n','ne','e','u'];
async function japan(){
 const engine=createPrologueSession();engine.moveTo(engine.state.room);
 for(const c of route)await engine.processInput(c);
 for(let i=0;engine.state.sundialSymbol!==1&&i<7;i++)await engine.processInput('turn ring');
 for(const c of ['d','e','e','in'])await engine.processInput(c);
 assert.equal(engine.state.room,'playground');
 return engine;
}
const snapshot=e=>({...e.state.serialize(),visual:{room:e.state.room,player:{x:220,y:170}}});
test('冷却期内已走到屏幕边缘，继续向外仍能离场；向内或内部门口不触发',()=>{
 const exit={dir:'e',x:464,y:232,radius:17};
 assert.equal(leavingBoundaryExit(exit,{x:467,y:232},{x:1,y:0}),true);
 assert.equal(leavingBoundaryExit(exit,{x:467,y:232},{x:-1,y:0}),false);
 assert.equal(leavingBoundaryExit({...exit,x:240},{x:243,y:232},{x:1,y:0}),false);
 assert.equal(leavingBoundaryExit({...exit,interactionOnly:true},{x:467,y:232},{x:1,y:0}),false);
 assert.equal(leavingBoundaryExit(exit,{x:438,y:232},{x:1,y:0}),false);
});
test('女孩靠近与接伞后步行逐点接地，时间由真实路程决定，终点与静态演员一致',()=>{
 for(const type of ['japan_girl_approach','japan_give_umbrella']){
  const motion=createJapanMotion(type);assert.ok(motion.walk.distance>50);assert.ok(motion.duration>motion.walk.distance/40);
  let last=null;
  for(let i=0;i<=80;i++){
   const f=sampleJapanMotion({type,motion,duration:motion.duration,elapsed:motion.duration*i/80});
   const a=f.actors.find(o=>o.kind==='japan_girl');assert.ok(!isBlocked(SCENES.playground,a.x,a.y));
   if(last)assert.ok(isSegmentWalkable(SCENES.playground,last,[a.x,a.y]));last=[a.x,a.y];
   assert.deepEqual(f.hiddenKinds,['japan_girl']);
  }
  assert.ok(Math.hypot(last[0]-(type.endsWith('approach')?P.girl.x:P.entrance.x),last[1]-(type.endsWith('approach')?P.girl.y:P.entrance.y))<.01);
 }
});
test('独立于碰撞定义的绘画道路中心线可连续步行；沼水、后墙与坡外拒绝落脚',()=>{
 const samples={the_bend:[[[16,130],[230,131],[464,130]],[[239,16],[236,72],[233,139],[255,220],[245,275]],[[20,251],[117,210],[233,139],[327,87],[425,16]]],moor:[[[16,121],[111,117],[185,114],[238,130],[296,103],[337,109]],[[250,16],[244,73],[238,130],[282,167],[326,207]],[[57,16],[140,77],[238,130]]],playground:[[[240,16],[240,116],[239,198],[240,275]],[[30,150],[140,151],[238,160],[331,150],[444,151]]],shelter:[[[30,166],[116,170],[255,158],[305,203]],[[116,170],[100,115],[420,115],[440,217]]]};
 for(const [room,lines]of Object.entries(samples))for(const line of lines)for(let i=1;i<line.length;i++)assert.ok(isSegmentWalkable(SCENES[room],line[i-1],line[i]),`${room}: ${line[i-1]} → ${line[i]}`);
 for(const [room,x,y]of [['moor',180,230],['moor',395,190],['shelter',230,70],['playground',100,70]])assert.ok(isBlocked(SCENES[room],x,y));
});
test('儿童坐姿不放大，所有裁切保留在实际PNG内，教师保持成人比例',()=>{
 for(const f of GIRL_FRAMES){const [x,y,w,h]=f.source;assert.ok(x>=0&&y>=0&&x+w<=1448&&y+h<=1086);assert.ok(f.foot[0]>=x&&f.foot[0]<=x+w&&f.foot[1]>=y&&f.foot[1]<=y+h);}
 assert.ok(GIRL_FRAMES[7].source[3]*GIRL_SCALE<18);assert.ok(GIRL_FRAMES[0].source[3]*GIRL_SCALE<24);
 assert.ok(JAPAN_GROUPS.japan_teachers.source[3]*JAPAN_GROUPS.japan_teachers.scale>24);
 for(const p of Object.values(JAPAN_PROPS)){const [x,y,w,h]=p.source;assert.ok(x+w<=1536&&y+h<=1024);}
});
test('真实交伞/折纸/骑鸟只提交一次；演出、跳过、读查询不改变原始状态',async()=>{
 const e=await japan(),d=createNarrativeDirector();
 for(const [c,type]of [['wait','japan_girl_approach'],['give umbrella to girl','japan_give_umbrella'],['e',null],['give paper to girl','japan_refold'],['w',null],['ride bird','japan_paper_flight']]){
  d.skip();const before=snapshot(e);await e.processInput(c);const after=snapshot(e),committed=e.state.serialize();
  d.onCommand(before,after,c);if(type)assert.equal(d.getState().currentEvent,type);
  if(type==='japan_paper_flight'){
   const initial=d.getState();assert.equal(initial.sceneRoom,'playground');assert.equal(initial.hidePlayer,true);assert.equal(initial.groundActors.length,2);
   d.update(2.5);const mid=d.getState();assert.ok(mid.groundActors.find(a=>a.kind==='giant_paper_bird').x<before.visual.player.x+11);assert.equal(e.state.room,'moor');
  }
  d.update(.2);d.getState();d.skip();assert.deepEqual(e.state.serialize(),committed);
 }
 assert.ok(e.state.has('paper_bird'));assert.equal(e.state.hasFlag('bird_unfolded'),false);
});
test('跨章白门从对应门口内侧入场，方向别名不生成第二扇门；未制作边界不移动玩家',async()=>{
 const e=await japan(),s=e.state;
 const entries=sceneExits(s.room,s,e.rooms),landing=roomArrival(SCENES.playground,{fromRoom:'moor',direction:'in',exits:entries});
 assert.equal(landing.entrance,'out');assert.ok(landing.x>P.door.x+25);assert.ok(!isBlocked(SCENES.playground,landing.x,landing.y));
 assert.ok(entries.filter(x=>x.dir==='in'||x.dir==='out').every(x=>x.interactionOnly));
 await e.processInput('out');
 const back=roomArrival(SCENES.moor,{fromRoom:'playground',direction:'out',exits:sceneExits('moor',s,e.rooms)});
 assert.equal(back.entrance,'in');assert.ok(back.x<P.gate.x-25);assert.ok(findPath(SCENES.moor,back,SCENES.moor.spawn).length);
 const before=s.serialize();assert.deepEqual(sceneBoundaries('the_bend',s,e.rooms).map(x=>x.dir).sort(),['nw','s']);assert.deepEqual(s.serialize(),before);
});
test('日本章M地图使用独立山丘底稿，首次只标已到地点、不显示谜题物品',async()=>{
 const e=await japan(),model=buildChapterMap({state:e.state,rooms:e.rooms,scenes:SCENES}),terrain=terrainMarkup('japan','japan-test',model.nodes);
 assert.equal(model.nodes.length,1);assert.equal(model.nodes[0].id,'playground');assert.ok(terrain.includes('map-landscape'));assert.ok(!terrain.includes('shelter'));assert.ok(!terrain.includes('避难所'));
 await e.processInput('e');const two=buildChapterMap({state:e.state,rooms:e.rooms,scenes:SCENES});assert.equal(two.nodes.length,2);
});
