import test from 'node:test';
import assert from 'node:assert/strict';
import {createPrologueSession} from '../engine-adapter.js';
import {SCENES,sceneExits,sceneBoundaries} from '../scene-manifest.js';
import {getHotspots,getInventoryActions} from '../interaction-catalog.js';
import {resolveInteraction} from '../interaction-intent.js';
import {roomArrival} from '../arrivals.js';
import {isBlocked,findPath} from '../world.js';
import {buildChapterMap} from '../chapter-map.js';
import {illustratedMapNodes,MAP_SIZE} from '../map-geography.js';
import {makeVisualSave,restoreVisualSave} from '../save.js';
import {ROOMS} from '../../js/data/tundra.js';

// Real commands follow the current adaptation. In particular these receipts
// do not manufacture the original countdown, guards, escape rules or cage.
const PROLOGUE=['e','take ball','nw','unscrew gnomon','take gnomon','n','take paper bird','open paper bird','w','buy crumbs','feed birds','take ruby','n','push pram','push pram','wait','throw ball at tree','take umbrella','push pram','open pram','enter pram','open umbrella','take paper bird','take gnomon','enter water','enter door'];
const IDS=Object.keys(ROOMS);
const TOUR=['n','n','e','e','s','s','w','w','ne','u','n'];
const snapshot=engine=>{const {version,state}=engine.serialize();return JSON.parse(JSON.stringify({version,state}));};

function session(){
  const output=[];
  const ui=Object.fromEntries(['text','system','inventory','location','userInput'].map(name=>[name,(...args)=>output.push({name,text:args.join('\n')})]));
  return {engine:createPrologueSession({ui}),output};
}
async function command(game,input){
  const first=game.output.length;await game.engine.processInput(input);
  const response=game.output.slice(first).map(entry=>entry.text).join('\n');
  assert.equal(game.engine.state.dead,false,input);
  assert.doesNotMatch(response,/这句话无法识别|错误：|尚未开放|没有可进入的起始房间|暂时无法确定你的意思/,input);
  return response;
}
async function commands(game,inputs){for(const input of inputs)await command(game,input);}
async function garden(symbol=5){
  const game=session(),{engine}=game;engine.moveTo(engine.state.room);
  await commands(game,[...PROLOGUE,'e','u']);
  for(let i=0;engine.state.sundialSymbol!==symbol&&i<7;i++)await command(game,'turn ring');
  assert.equal(engine.state.sundialSymbol,symbol);
  await commands(game,['d','ne','e','nw','e','e']);
  assert.equal(engine.state.room,'herb_garden');return game;
}
async function tundra(){
  const game=await garden();await command(game,'in');
  assert.equal(game.engine.state.chapter,'tundra');assert.equal(game.engine.state.room,'tundra_1');return game;
}
async function cliff(){const game=await tundra();await commands(game,['ne','u','n']);assert.equal(game.engine.state.room,'cliff_edge');return game;}
const ofKind=(engine,kind,observed=new Set())=>{
  const object=getHotspots(engine.state,{observed}).find(value=>value.kind===kind);
  assert.ok(object,`${engine.state.room}: ${kind}`);return object;
};
const visibleMouse=(engine,observed)=>getHotspots(engine.state,{observed}).find(object=>object.itemId==='lemming'&&object.visual!==false);

test('合法序章拨天秤座后走完冻原十一房和真实返程，不赠笼/鼠副本或计时谜题',async()=>{
  const game=await tundra(),{engine}=game,initial=snapshot(engine).state;
  assert.equal(engine.state.itemAt('lemming'),'cliff_edge');assert.equal(engine.state.has('cage'),false);
  assert.ok(engine.state.hasFlag('tundra_lemming_placed'));assert.equal(engine.state.timer,null);
  await commands(game,TOUR);
  assert.equal(engine.state.room,'cliff_edge');
  assert.ok(IDS.every(id=>engine.state.visited.has(id)));
  assert.equal(engine.state.score,initial.score);assert.equal(engine.state.sundialSymbol,5);
  assert.deepEqual(engine.state.itemLoc,initial.itemLoc);
  await commands(game,['s','d','sw','out']);
  assert.equal(engine.state.chapter,'wabe');assert.equal(engine.state.room,'herb_garden');
  assert.ok(engine.state.hasFlag('wabe_to_tundra_used'));
  await command(game,'in');
  assert.equal(engine.state.itemAt('lemming'),'cliff_edge');assert.equal(engine.state.timer,null);
});

test('菌门先观察再F进门，错误符号保持关闭，门口查询不执行跨章副作用',async()=>{
  for(const symbol of [5,6]){
    const game=await garden(symbol),{engine}=game,observed=new Set(),before=snapshot(engine);
    const objects=getHotspots(engine.state,{observed});
    if(symbol===5){
      const gate=objects.find(object=>object.kind==='tundra_gate');assert.ok(gate);
      assert.equal(resolveInteraction(engine.state,gate,{heldItem:'gnomon',observed}),'look');
      observed.add(gate.id);
      assert.equal(resolveInteraction(engine.state,gate,{heldItem:'gnomon',observed}),'in');
      assert.ok(sceneExits('herb_garden',engine.state,engine.rooms).some(exit=>exit.dir==='in'&&exit.target==='tundra_1'&&exit.interactionOnly));
    }else{
      assert.ok(objects.every(object=>object.actions.every(action=>action.command!=='in')));
      assert.equal(sceneExits('herb_garden',engine.state,engine.rooms).some(exit=>exit.target==='tundra_1'),false);
    }
    assert.deepEqual(snapshot(engine),before);
    await command(game,'in');
    assert.equal(engine.state.room,symbol===5?'tundra_1':'herb_garden');
  }
});

test('裂缝发现只保存2D观察知识，F观察后才揭示同一旅鼠，再观察拿取并可放下',async()=>{
  const game=await cliff(),{engine}=game,observed=new Set(),before=snapshot(engine).state;
  const fissure=ofKind(engine,'tundra_fissure',observed);
  assert.equal(visibleMouse(engine,observed),undefined);
  assert.equal(resolveInteraction(engine.state,fissure,{observed}),'examine fissure');
  for(let i=0;i<3;i++)getHotspots(engine.state,{observed});
  assert.deepEqual(snapshot(engine).state,before,'观察目录不应移动物品或自动生成认知');
  await command(game,'examine fissure');observed.add(fissure.id);
  assert.equal(engine.state.itemAt('lemming'),'cliff_edge');
  assert.deepEqual([...engine.state.flags],before.flags,'裂缝观察不补写原章发现旗标');
  const mouse=visibleMouse(engine,observed);assert.ok(mouse);
  assert.equal(mouse.id,'tundra:item:lemming');
  assert.equal(ofKind(engine,'tundra_fissure',observed).pointerOnly,true,'发现鼠后F不被固定岩缝抢走');
  assert.equal(resolveInteraction(engine.state,mouse,{observed}),'examine lemming');
  await command(game,'examine lemming');observed.add(mouse.id);
  assert.equal(resolveInteraction(engine.state,visibleMouse(engine,observed),{observed}),'take lemming');
  await command(game,'take lemming');
  assert.ok(engine.state.has('lemming'));assert.equal(visibleMouse(engine,observed),undefined);
  assert.ok(getInventoryActions('lemming',engine.state).some(action=>action.command==='drop lemming'));
  await command(game,'drop lemming');
  assert.equal(visibleMouse(engine,observed)?.id,mouse.id);
  assert.equal(getHotspots(engine.state,{observed}).filter(object=>object.itemId==='lemming').length,1);
  assert.equal(engine.state.score,before.score);assert.equal(engine.state.has('cage'),false);
});

test('原章没有合法取笼流程，未持笼不会凭put命令赠笼、笼中鼠或分数',async()=>{
  const game=await cliff(),{engine}=game;await command(game,'take lemming');
  const before=snapshot(engine).state;
  assert.equal(engine.state.itemAt('cage'),undefined);
  assert.deepEqual(getInventoryActions('cage',engine.state),[]);
  await engine.processInput('put lemming in cage');
  assert.equal(engine.state.itemAt('cage'),undefined);assert.ok(engine.state.has('lemming'));
  assert.equal(engine.state.hasFlag('cage_has_lemming'),false);
  assert.equal(engine.state.score,before.score);
  await commands(game,['s','d','sw','out','in']);
  assert.ok(engine.state.has('lemming'),'再入章不重置唯一鼠的位置');
  assert.equal(getHotspots(engine.state).some(object=>object.itemId==='cage'),false);
});

test('预置持笼状态仅作现有条件单元检查：两处入笼分支共用一次得分，非合法取笼通关',async()=>{
  for(const room of ['cliff_edge','tundra_1']){
    const game=await cliff(),{engine}=game;await command(game,'take lemming');
    if(room==='tundra_1')await commands(game,['s','d','sw']);
    // Explicit unit fixture: no game action or visual catalog grants this cage.
    const fixture=engine.serialize();fixture.state.itemLoc.cage='inventory';await engine.deserialize(fixture);
    const score=engine.state.score;await command(game,'put lemming in cage');
    assert.equal(engine.state.itemAt('lemming'),'cage');assert.ok(engine.state.hasFlag('cage_has_lemming'));
    assert.equal(engine.state.score,score+1);assert.ok(engine.state.hasFlag('scored_lemming_tundra'));
    await engine.processInput('put lemming in cage');assert.equal(engine.state.score,score+1);
    assert.equal(getHotspots(engine.state).some(object=>object.itemId==='lemming'),false);
  }
});

test('十一房M地图与物品/通行查询只读，稳定节点不泄露未知地点或补原版山口/计时器',async()=>{
  const game=await tundra(),{engine}=game;
  const first=buildChapterMap({state:engine.state,rooms:engine.rooms,scenes:SCENES});
  assert.deepEqual(first.nodes.map(node=>node.id),['tundra_1']);
  await commands(game,TOUR);const before=snapshot(engine),observed=new Set(['cliff_edge:fissure']);
  for(let i=0;i<3;i++){
    const model=buildChapterMap({state:engine.state,rooms:engine.rooms,scenes:SCENES});
    assert.equal(model.chapter,'tundra');assert.equal(model.nodes.length,11);assert.deepEqual(model.warnings,[]);
    const nodes=illustratedMapNodes(model);
    for(const id of IDS){const node=nodes.find(node=>node.id===id);assert.ok(node?.visual,id);assert.ok(node.x>10&&node.x<MAP_SIZE.width-10&&node.y>10&&node.y<MAP_SIZE.height-10);}
    getHotspots(engine.state,{observed});getInventoryActions('lemming',engine.state);
    sceneExits(engine.state.room,engine.state,engine.rooms);sceneBoundaries(engine.state.room,engine.state,engine.rooms);
    assert.deepEqual(snapshot(engine),before);
  }
  assert.equal(engine.state.timer,null);assert.equal(ROOMS.tundra_4.exits().ne,undefined,'不在表现层补造原版缺失山口');
});

test('十一房独立续玩保留未发现/发现旅鼠与携带状态，不重放onEnter或复制物品',async()=>{
  const game=await tundra(),{engine}=game;
  const captures=[];function capture(observed=[]){const room=engine.state.room,[x,y]=SCENES[room].spawn;captures.push(makeVisualSave(engine,{room,x,y,face:'up',knowledge:{observed,paper:{observed:[],identified:[]}}}));}
  capture();for(const input of TOUR){await command(game,input);capture();}
  capture(['cliff_edge:fissure']);await command(game,'take lemming');capture(['cliff_edge:fissure','tundra:item:lemming']);
  for(const packet of captures){
    const fresh=session();let autosaves=0;fresh.engine.onAutosave=()=>autosaves++;
    const restored=await restoreVisualSave(fresh.engine,JSON.stringify(packet));
    assert.equal(restored.repositioned,false,packet.visual.room);
    assert.deepEqual(snapshot(fresh.engine),{version:packet.engine.version,state:packet.engine.state});
    assert.deepEqual(restored.visual.knowledge,packet.visual.knowledge);assert.equal(autosaves,0);assert.equal(fresh.output.length,0);
    assert.ok(fresh.engine.loadedChapters.has('tundra'));assert.equal(fresh.engine.state.timer,null);
    const observed=new Set(restored.visual.knowledge.observed);
    if(packet.visual.room==='cliff_edge')assert.equal(Boolean(visibleMouse(fresh.engine,observed)),observed.has('cliff_edge:fissure')&&!fresh.engine.state.has('lemming'));
    const before=snapshot(fresh.engine);getHotspots(fresh.engine.state,{observed});buildChapterMap({state:fresh.engine.state,rooms:fresh.engine.rooms,scenes:SCENES});
    assert.deepEqual(snapshot(fresh.engine),before);
  }
});

test('全部实际出口/来源按完整足底连续可达；门梯需F，不从高台自动走向崖边',async()=>{
  const game=await tundra(),{engine}=game,before=snapshot(engine);let checked=0;
  for(const id of IDS){
    const scene=SCENES[id],view=Object.assign(Object.create(engine.state),{room:id});assert.ok(scene,id);
    assert.equal(isBlocked(scene,...scene.spawn),false,`${id} spawn`);
    const raw=ROOMS[id].exits(view),exits=sceneExits(id,view,engine.rooms);
    for(const exit of exits){
      const original=raw[exit.dir];assert.equal(exit.target,typeof original==='string'?original:original.to);
      const path=findPath(scene,scene.spawn,[exit.x,exit.y],{nearest:true});assert.ok(path.length,`${id}.${exit.dir}`);
      assert.ok(Math.hypot(path.at(-1)[0]-exit.x,path.at(-1)[1]-exit.y)<=exit.radius,`${id}.${exit.dir}实际传感口`);
      for(let i=1;i<path.length;i++){
        const a=path[i-1],b=path[i],steps=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/.25);
        for(let j=0;j<=steps;j++)assert.equal(isBlocked(scene,a[0]+(b[0]-a[0])*j/steps,a[1]+(b[1]-a[1])*j/steps),false,`${id}.${exit.dir}足底路径`);
      }
      const returns=sceneExits(exit.target,engine.state,engine.rooms),arrival=roomArrival(SCENES[exit.target],{fromRoom:id,direction:exit.dir,exits:returns});
      assert.ok(arrival,`${id}.${exit.dir} arrival`);assert.equal(arrival.matched,true,`${id}.${exit.dir}来源返回`);
      assert.equal(isBlocked(SCENES[exit.target],arrival.x,arrival.y),false);
      assert.ok(findPath(SCENES[exit.target],arrival,SCENES[exit.target].spawn).length);
      assert.ok(returns.every(route=>Math.hypot(arrival.x-route.x,arrival.y-route.y)>=route.radius+8),`${id}.${exit.dir}退离所有传感口`);
      if(['u','d','out'].includes(exit.dir)||id==='platform'&&exit.dir==='n'){
        assert.equal(exit.interactionOnly,true,`${id}.${exit.dir}必须F确认`);
        const passage=getHotspots(view).find(object=>object.kind==='passage'&&object.actions.some(action=>action.command===exit.dir));
        assert.ok(passage);assert.equal(resolveInteraction(view,passage,{heldItem:'gnomon'}),exit.dir);
      }
      checked++;
    }
  }
  assert.equal(checked,45,'现章十一房的全部45个方向口均覆盖，不额外造路');
  assert.deepEqual(snapshot(engine),before);
});
