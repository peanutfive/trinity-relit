import test from 'node:test';
import assert from 'node:assert/strict';
import { createPrologueSession } from '../engine-adapter.js';
import { getHotspots } from '../interaction-catalog.js';
import { createNarrativeDirector, drawStoryProp, setStorySpriteRenderer } from '../narrative.js';
import { resolveStoryActor } from '../prologue-art.js';

function game() {
  const engine=createPrologueSession(),director=createNarrativeDirector();
  engine.moveTo(engine.state.room);
  const snapshot=()=>({...engine.state.serialize(),visual:{room:engine.state.room,
    player:{x:260,y:208},hotspots:getHotspots(engine.state)}});
  async function command(input,{skip=true}={}) {
    if(skip)director.skip();
    const before=snapshot();
    await engine.processInput(input);
    assert.equal(engine.state.dead,false,input);
    const after=snapshot();
    const added=director.onCommand(before,after,input);
    return {before,after,added};
  }
  return {engine,director,command};
}

function canvasStub() {
  return new Proxy({globalAlpha:1},{
    get:(target,key)=>key in target?target[key]:(()=>{}),
    set:(target,key,value)=>(target[key]=value,true),
  });
}

function painted(game,{world=true}={}) {
  const calls=[],ctx=canvasStub(),state=game.engine.state;
  setStorySpriteRenderer((_,object)=>{calls.push({...object});return true;});
  try {
    const layer=game.director.getState(state);
    if(world)for(const object of [...getHotspots(state),...layer.persistentActors]) {
      if(!layer.hiddenKinds.includes(object.kind))drawStoryProp(ctx,
        {...object,visualOptions:{...object.visualOptions,...layer.actorVisuals[object.id]}},state,0);
    }
    game.director.draw(ctx,layer.sceneRoom||state.room,state,0);
    return calls;
  } finally {setStorySpriteRenderer(null);}
}

test('真实旋下指针期间只画导演指针，完成或跳过后只恢复基础指针',async()=>{
  const g=game();
  await g.command('e');await g.command('nw');
  const {after,added}=await g.command('unscrew gnomon');
  assert.ok(added.includes('gnomon_unscrew'));
  assert.equal(after.itemLoc.gnomon,'the_wabe','原引擎仍把指针留在日晷上');
  assert.ok(g.director.getState().hiddenKinds.includes('gnomon'));
  g.director.update(.4);
  assert.equal(painted(g).filter(object=>object.kind==='gnomon').length,1);
  const committed=g.engine.state.serialize();
  g.director.skip();
  assert.equal(painted(g).filter(object=>object.kind==='gnomon').length,1);
  assert.equal(g.director.getState().hiddenKinds.includes('gnomon'),false);
  assert.deepEqual(g.engine.state.serialize(),committed,'跳过只影响演出');
});

test('真实首次到大道时飞入鸽群替代静止鸽群，结束后恢复原基础群',async()=>{
  const g=game();
  const {added}=await g.command('n');
  assert.ok(added.includes('birds_arrive'));
  assert.ok(getHotspots(g.engine.state).some(object=>object.kind==='birds'));
  const during=painted(g);
  assert.equal(during.filter(object=>['birds','pigeons'].includes(object.kind)).length,0);
  assert.equal(during.filter(object=>object.kind==='pigeon').length,5);
  g.director.update(g.director.getState().duration);
  const after=painted(g);
  assert.equal(after.filter(object=>object.kind==='birds').length,1);
  assert.equal(after.filter(object=>object.kind==='pigeon').length,0);
});

test('真实推车路线进入长水湖，导弹显现期间不叠加已经全亮的基础导弹',async()=>{
  const g=game();
  for(const command of ['e','take ball','nw','unscrew gnomon','take gnomon','n',
    'take paper bird','open paper bird','w','buy crumbs','feed birds','take ruby',
    'n','push pram','push pram','wait','throw ball at tree','take umbrella',
    'push pram','open pram','enter pram','open umbrella'])await g.command(command);
  assert.equal(g.engine.state.room,'long_water');
  assert.ok(g.engine.state.hasFlag('missile_visible'));
  for(let index=0;index<5&&g.director.getState().currentEvent!=='missile_reveal';index++) {
    g.director.update(g.director.getState().duration);
  }
  assert.equal(g.director.getState().currentEvent,'missile_reveal');
  assert.ok(g.director.getState().hiddenKinds.includes('missile'));
  assert.equal(painted(g).filter(object=>object.kind==='missile').length,1);
  g.director.skip();
  assert.equal(painted(g).filter(object=>object.kind==='missile').length,1);
});

test('喂鸟后的摊主和鸽群交回实体列表；导演draw不在排序结束后补画常驻演员',async()=>{
  const g=game();
  await g.command('n');await g.command('buy crumbs');await g.command('feed birds');
  const committed=g.engine.state.serialize();
  assert.equal(getHotspots(g.engine.state).some(object=>object.id==='broad_walk:woman'),false);
  const during=g.director.getState();
  const seller=during.persistentActors.find(object=>object.id==='broad_walk:woman');
  assert.deepEqual({room:seller.room,kind:seller.kind,x:seller.x,y:seller.y,actorId:seller.actorId},
    {room:'broad_walk',kind:'woman',x:143,y:166,actorId:'bird_food_seller'});
  assert.equal(seller.visualOptions.pose,'seated');
  assert.equal(seller.visualOnly,true);assert.equal(seller.radius,0);assert.deepEqual(seller.actions,[]);
  assert.equal(during.persistentActors.some(object=>object.kind==='birds'),false,'喂食演出自行绘制鸽子');
  assert.equal(painted(g,{world:false}).some(object=>object.actorId==='bird_food_seller'),false);
  g.director.skip();
  const resting=g.director.getState();
  assert.deepEqual(resting.persistentActors.map(object=>object.id),['broad_walk:woman','broad_walk:birds']);
  assert.equal(painted(g,{world:false}).length,0,'空闲导演只画环境叶片');
  assert.equal(painted(g).filter(object=>object.actorId==='bird_food_seller').length,1);
  assert.equal(painted(g).filter(object=>object.kind==='birds').length,1);
  assert.deepEqual(g.engine.state.serialize(),committed,'查询/绘制/跳过不改变回合、物品或标记');
});

test('读档后首次查询可直接使用引擎state，返回的常驻对象副本互不污染',async()=>{
  const g=game();
  await g.command('n');await g.command('buy crumbs');await g.command('feed birds');
  const fresh=createNarrativeDirector(),state=g.engine.state;
  const layer=fresh.getState(state);
  assert.equal(layer.sceneRoom,'broad_walk');
  assert.equal(layer.persistentActors.length,2);
  layer.persistentActors[0].x=999;layer.persistentActors[0].visualOptions.pose='changed';
  layer.persistentActors[1].actions.push({command:'changed'});
  const next=fresh.getState(state);
  assert.equal(next.persistentActors[0].x,143);
  assert.equal(next.persistentActors[0].visualOptions.pose,'seated');
  assert.deepEqual(next.persistentActors[1].actions,[]);
  assert.equal(fresh.getState().persistentActors.length,0,'查询不偷偷保存或修改传入状态');
});

test('摊主身份不会变成兰开斯特撑伞老妇，离开大道不产生另一位常驻老妇',async()=>{
  const g=game();
  await g.command('n');await g.command('buy crumbs');await g.command('feed birds');g.director.skip();
  const seller=g.director.getState().persistentActors[0];
  assert.deepEqual(resolveStoryActor(seller,{room:'lancaster_gate'}),{kind:'woman',actorId:'bird_food_seller'});
  assert.deepEqual(resolveStoryActor({id:'lancaster_gate:woman',kind:'woman'},{room:'lancaster_gate'}),
    {kind:'umbrella_woman',actorId:'lancaster_umbrella_woman'});
  await g.command('e');await g.command('ne');g.director.skip();
  assert.equal(g.engine.state.room,'lancaster_gate');
  assert.deepEqual(g.director.getState().persistentActors,[]);
});

async function reachBoy(g) {
  for(const command of ['n','n','e'])await g.command(command);
  assert.equal(g.engine.state.room,'inverness_terrace');
}

test('男孩真实三轮原文对应抬棒吹泡、打响指泡破、蘸棒搅水，角色本身收到姿态转换',async()=>{
  const g=game();await reachBoy(g);
  const id='inverness_terrace:boy';
  const blow=g.director.getState(g.engine.state).actorVisuals[id];
  assert.deepEqual([blow.fromPhase,blow.targetPhase,blow.fromPose,blow.targetPose,blow.gesture],
    [0,1,'dip','blow','blow']);
  assert.equal(blow.pose,'dip');assert.equal(blow.progress,0);
  g.director.update(.6);
  const mid=g.director.getState(g.engine.state);
  assert.equal(mid.actorVisuals[id].pose,'blow');
  assert.equal(mid.actorVisuals[id].progress,.5);
  assert.equal(mid.visibleActorActions.find(actor=>actor.id===id).action,'blow');
  const boy=painted(g).filter(object=>object.kind==='boy');
  assert.equal(boy.length,1,'角色仍由基础实体排序绘制，不靠额外泡泡代替动作');
  assert.equal(boy[0].visualOptions.pose,'blow');
  const {before,after}=await g.command('wait');
  assert.equal(after.counters.boy_cycle,before.counters.boy_cycle+1);
  assert.equal(after.turns,before.turns+1,'一条合法命令只推进原引擎的一轮');
  const snap=g.director.getState().actorVisuals[id];
  assert.deepEqual([snap.fromPhase,snap.targetPhase,snap.action,snap.gesture],[1,2,'admire','snap']);
  g.director.update(.6);
  assert.equal(painted(g).find(object=>object.kind==='boy').visualOptions.pose,'admire');
  await g.command('wait');
  const dip=g.director.getState().actorVisuals[id];
  assert.deepEqual([dip.fromPhase,dip.targetPhase,dip.action,dip.gesture],[2,0,'dip','swish']);
});

test('男孩动作只由新counter触发一次，快速下一轮替代旧姿态而非堆叠延后文字动作',async()=>{
  const g=game();await reachBoy(g);
  g.director.update(.2);
  const transition=await g.command('wait',{skip:false});
  const id='inverness_terrace:boy',layer=g.director.getState();
  assert.equal(layer.currentEvent,'bubble_cycle');
  assert.equal(layer.actorVisuals[id].targetPhase,2);
  assert.equal(layer.elapsed,0);
  assert.equal(layer.queued.includes('bubble_cycle'),false);
  assert.ok(layer.history.some(event=>event.id==='bubble_cycle:1'&&event.skipped));
  assert.deepEqual(g.director.onCommand(transition.before,transition.after,'wait'),[],
    '同一已提交counter差异不会重复入队');
  assert.equal(g.director.getState().currentEvent,'bubble_cycle');
  assert.equal(g.director.getState().triggered.filter(event=>event==='bubble_cycle:2').length,1);
  const unchanged=g.engine.state.serialize(),time=g.director.getState().elapsed;
  for(let index=0;index<5;index++){g.director.getState(g.engine.state);painted(g);g.director.update(0);}
  assert.equal(g.director.getState().elapsed,time,'暂停期间无dt时，查询/绘制不推进动作');
  g.director.update(5);
  assert.deepEqual(g.engine.state.serialize(),unchanged,'整段播放不增加回合或counter');
});

test('男孩动作跳过后保持目标阶段；存档恢复读取真实counter且不重播旧动作',async()=>{
  const g=game();await reachBoy(g);await g.command('wait');
  const id='inverness_terrace:boy',committed=g.engine.state.serialize();
  g.director.skip();
  const settled=g.director.getState().actorVisuals[id];
  assert.deepEqual([settled.pose,settled.boyPhase,settled.active,settled.progress],['admire',2,false,1]);
  const restored=createPrologueSession();await restored.deserialize(g.engine.serialize());
  const fresh=createNarrativeDirector(),layer=fresh.getState(restored.state);
  assert.equal(layer.currentEvent,null);assert.deepEqual(layer.triggered,[]);
  assert.deepEqual(layer.actorVisuals[id],settled);
  assert.deepEqual(restored.state.serialize(),committed);
  layer.actorVisuals[id].pose='changed';layer.visibleActorActions[0].progress=99;
  assert.equal(fresh.getState(restored.state).actorVisuals[id].pose,'admire','返回副本不能污染导演');
});

test('男孩受惊使用离场姿态和消失前锚点，离开房间不拖带上一轮动作',async()=>{
  const g=game();await reachBoy(g);
  await g.command('take dish',{skip:false});
  const id='inverness_terrace:boy',layer=g.director.getState();
  assert.equal(layer.currentEvent,'boy_startled');
  assert.equal(layer.actorVisuals[id].pose,'startled');
  assert.deepEqual([layer.visibleActorActions[0].x,layer.visibleActorActions[0].y],[300,145]);
  const actors=painted(g).filter(object=>object.kind==='boy');
  assert.equal(actors.length,1);assert.equal(actors[0].visualOptions.startled,true);
  g.director.skip();assert.equal(g.director.getState().actorVisuals[id],undefined);
  const next=game();await reachBoy(next);await next.command('e',{skip:false});
  assert.equal(next.director.getState().queued.includes('bubble_cycle'),false);
  assert.equal(next.director.getState().actorVisuals[id],undefined);
  assert.equal(next.director.getState().sceneRoom,'lancaster_gate');
});

test('撑伞老妇人站立抬伞并分离绘制单把伞，脱手后沿连续轨迹飞出',async()=>{
  const g=game();await reachBoy(g);await g.command('e');g.director.skip();
  const id='lancaster_gate:woman',standing=g.director.getState().actorVisuals[id];
  assert.deepEqual([standing.pose,standing.umbrella,standing.standing],
    ['standing_umbrella',true,true]);
  const {before,after}=await g.command('wait');
  assert.equal(after.flags.includes('umbrella_woman_done'),true);
  assert.equal(after.itemLoc.umbrella,'lancaster_gate_tree');
  assert.equal(before.visual.hotspots.some(object=>object.id===id&&object.kind==='woman'),true);
  const first=g.director.getState(),options=first.actorVisuals[id];
  assert.equal(first.currentEvent,'umbrella_gust');
  for(const kind of ['woman','bird_woman','old_woman','umbrella_woman','umbrella','umbrella_tree'])
    assert.ok(first.hiddenKinds.includes(kind),kind);
  assert.deepEqual([options.pose,options.action,options.umbrella,options.open],['prepare','prepare',true,false]);
  const held=painted(g);
  assert.equal(held.filter(object=>object.actorId==='lancaster_umbrella_woman').length,1);
  assert.equal(held.filter(object=>object.kind==='umbrella').length,1,'只有一把独立雨伞从手中撑开，人体素材不烘焙第二把');
  const sourceActor=before.visual.hotspots.find(object=>object.id===id);
  assert.deepEqual([first.visibleActorActions[0].x,first.visibleActorActions[0].y],[sourceActor.x,sourceActor.y],
    '使用消失前角色的真实位置，而不是错误的默认另一侧锚点');
  g.director.update(5.2);
  const released=g.director.getState().actorVisuals[id],drawn=painted(g);
  assert.equal(released.action,'released');assert.equal(released.umbrella,false);
  assert.equal(drawn.filter(object=>object.actorId==='lancaster_umbrella_woman').length,1);
  assert.equal(drawn.filter(object=>object.kind==='umbrella').length,1);
  assert.equal(drawn.find(object=>object.kind==='umbrella').visualOptions.open,true);
});

test('夺伞演出的绕树、仰望、擦泪、踢树、离场动作可供QA读取；完成/读档不重演',async()=>{
  const g=game();await reachBoy(g);await g.command('e');await g.command('wait');
  const id='lancaster_gate:woman',committed=g.engine.state.serialize(),duration=g.director.getState().duration;
  let last=0;
  for(const [at,action,pose] of [[8.3/13.2,'circle','circle'],[9.8/13.2,'look_up','look_up'],[10.6/13.2,'wipe','wipe'],[11.3/13.2,'kick','kick'],[12.3/13.2,'leave','leave']]){
    g.director.update((at-last)*duration);last=at;
    const layer=g.director.getState(),visible=layer.visibleActorActions.find(actor=>actor.id===id);
    assert.equal(visible.action,action);assert.equal(visible.pose,pose);assert.equal(visible.source,'director');
    assert.equal(visible.actorId,'lancaster_umbrella_woman');
    assert.equal(painted(g).find(object=>object.actorId==='lancaster_umbrella_woman').visualOptions.action,action);
  }
  g.director.skip();
  assert.equal(g.director.getState().actorVisuals[id],undefined);
  assert.equal(painted(g).some(object=>object.actorId==='lancaster_umbrella_woman'),false);
  assert.equal(painted(g).filter(object=>object.kind==='umbrella').length,1,'最终只剩树上的原状态雨伞');
  assert.deepEqual(g.engine.state.serialize(),committed);
  const restored=createPrologueSession();await restored.deserialize(g.engine.serialize());
  const fresh=createNarrativeDirector(),layer=fresh.getState(restored.state);
  assert.equal(layer.actorVisuals[id],undefined);assert.equal(layer.currentEvent,null);
  assert.deepEqual(restored.state.serialize(),committed);
});
