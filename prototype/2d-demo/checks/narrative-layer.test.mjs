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
  async function command(input) {
    director.skip();
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
      if(!layer.hiddenKinds.includes(object.kind))drawStoryProp(ctx,object,state,0);
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
  assert.equal(during.filter(object=>object.kind==='pigeon').length,8);
  g.director.update(2);
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
