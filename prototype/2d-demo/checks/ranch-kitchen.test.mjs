import assert from 'node:assert/strict';
import test from 'node:test';
import { roomArrival } from '../arrivals.js';
import { createPrologueSession } from '../engine-adapter.js';
import { resolveInteraction } from '../interaction-intent.js';
import { pointerTarget } from '../interaction-targets.js';
import { getRanchHotspots } from '../ranch-actions.js';
import { ROOMS } from '../ranch-story.js';
import { SCENES, sceneBoundaries, sceneExits } from '../scene-manifest.js';
import { findPath, isBlocked, isSegmentWalkable } from '../world.js';

const hallDoor = 'hallway_outer_door_open';

async function ranchFixture(room) {
  const lines = [];
  const quiet = () => {};
  const engine = createPrologueSession({ui:{
    text: text=>lines.push(text), system:quiet, location:quiet, inventory:quiet, userInput:quiet,
  }});
  await engine.activateChapter('ranch');
  engine.state.chapter = 'ranch';
  engine.moveTo(room);
  async function enter(command, destination=engine.state.room) {
    const before=engine.state.turns;
    lines.length=0;
    await engine.processInput(command);
    assert.equal(engine.state.room,destination,command);
    assert.equal(engine.state.turns,before+1,command);
    return lines.join('\n');
  }
  return {engine, enter};
}

const pairDirections = [
  ['hallway','e','kitchen','w'],
  ['kitchen','n','nw_room','s'],
  ['nw_room','n','spare_room','s'],
  ['spare_room','n','bathroom','s'],
];

test('从同一扇走廊外门进入厨房，向北走到洗手池，再沿正确入口走回来', async () => {
  const {engine,enter}=await ranchFixture('hallway');
  const state=engine.state;
  assert.match(await enter('e'), /关/);
  await enter('open outer door');
  async function walk(from,dir,to,reverse) {
    assert.equal(state.room,from);
    const exits=sceneExits(from,state,ROOMS).filter(exit=>exit.target===to);
    assert.deepEqual(exits.map(exit=>exit.dir),[dir]);
    assert.ok(findPath(SCENES[from],SCENES[from].spawn,exits[0]).length,from+' 入口不可达');
    await enter(dir,to);
    const returns=sceneExits(to,state,ROOMS);
    const arrival=roomArrival(SCENES[to],{fromRoom:from,direction:dir,exits:returns});
    assert.equal(arrival.entrance,reverse);
    assert.ok(arrival.matched,to+' 必须有明确来向');
    assert.ok(returns.every(exit=>Math.hypot(arrival.x-exit.x,arrival.y-exit.y)>exit.radius));
    assert.ok(findPath(SCENES[to],arrival,SCENES[to].spawn).length,to+' 入场应能继续走');
  }
  for (const pair of pairDirections) await walk(...pair);
  for (const [to,reverse,from,dir] of [...pairDirections].reverse()) await walk(from,dir,to,reverse);
  await enter('e','kitchen');
  await enter('close outer door');
  assert.match(await enter('w'), /关/);
  assert.ok(!sceneExits('kitchen',state,ROOMS).some(exit=>exit.target==='hallway'));
  await enter('open outer door');
  await enter('w','hallway');
  assert.ok(state.hasFlag(hallDoor));
});

test('厨房普通物品的收取与放回能存读，首次从柜内取得餐具只计一次分', async () => {
  const {engine,enter}=await ranchFixture('kitchen');
  const start=engine.state.score;
  const shelf=id=>getRanchHotspots(engine.state).find(object=>object.itemId===id && object.visualOptions?.onShelf);
  function takeFromShelf(id) {
    const item=shelf(id);
    assert.ok(item,'柜内应有 '+id);
    const command=resolveInteraction(engine.state,item);
    assert.match(command,/^take .+ from cupboard$/);
    return enter(command);
  }
  assert.ok(shelf('knife'));
  for (const cmd of ['open cupboard','close cupboard']) {
    assert.match(await enter(cmd), /没有|无/);
    assert.ok(shelf('knife'));
  }
  await takeFromShelf('knife');
  assert.ok(engine.state.has('knife'));
  assert.equal(engine.state.score,start+1);
  assert.equal(shelf('knife'),undefined);
  await enter('put knife in cupboard');
  assert.equal(engine.state.itemAt('knife'),'cupboard');
  assert.ok(shelf('knife'));
  await engine.deserialize(engine.serialize());
  await takeFromShelf('knife');
  assert.ok(engine.state.has('knife'));
  assert.equal(engine.state.score,start+1);
  await enter('put knife in cupboard');
  engine.state.take('splinter');
  await enter('put splinter in cupboard');
  assert.equal(engine.state.itemAt('splinter'),'cupboard');
  const contents=await enter('look in cupboard');
  assert.match(contents,/splinter/i);
  assert.match(contents,/knife/i);
  await enter('n','nw_room');
  await enter('s','kitchen');
  await engine.deserialize(engine.serialize());
  assert.ok(shelf('knife') && shelf('splinter'));
  await takeFromShelf('splinter');
  assert.ok(engine.state.has('splinter'));
  assert.equal(engine.state.itemAt('knife'),'cupboard');
  assert.equal(engine.state.score,start+1);
});

test('载入旧档和重进厨房时保留餐具的明确位置，只有缺失位置时才初始化', async () => {
  for (const previous of [undefined,'cupboard','inventory','kitchen','sw_yard','destroyed']) {
    const {engine,enter}=await ranchFixture('hallway');
    const save=engine.serialize();
    if(previous===undefined) delete save.state.itemLoc.knife;
    else save.state.itemLoc.knife=previous;
    await engine.deserialize(save);
    await enter('open outer door');
    await enter('e','kitchen');
    const expected=previous??'cupboard';
    assert.equal(engine.state.itemAt('knife'),expected);
    const knives=getRanchHotspots(engine.state).filter(object=>object.itemId==='knife');
    assert.equal(knives.length,['kitchen','cupboard'].includes(expected) ? 1 : 0);
    if (knives.length) {
      assert.equal(Boolean(knives[0].visualOptions?.onShelf),expected==='cupboard');
      const command=resolveInteraction(engine.state,knives[0]);
      assert.equal(command,expected==='cupboard' ? 'take knife from cupboard' : 'take knife');
    }
    await enter('n','nw_room');
    await enter('s','kitchen');
    assert.equal(engine.state.itemAt('knife'),expected);
  }
});

test('携带已满时先保留架上餐具与分数，腾出空位后才完成拿取', async () => {
  const {engine,enter}=await ranchFixture('kitchen');
  const state=engine.state, score=state.score;
  for (const id of ['splinter','umbrella','ball','gnomon','watch','credit_card','paper_bird','bag']) {
    if(state.carryCount()<8) state.take(id);
  }
  assert.equal(state.carryCount(),8);
  assert.match(await enter('take knife from cupboard'),/too much already/i);
  assert.equal(state.itemAt('knife'),'cupboard');
  assert.equal(state.score,score);
  await enter('drop splinter');
  await enter('take knife from cupboard');
  assert.ok(state.carrying('knife'));
  assert.equal(state.score,score+1);
});

test('浴室洗手池是固定设施，三种离开命令共用一个门洞', async () => {
  const {engine,enter}=await ranchFixture('bathroom');
  const possessions=engine.state.inventoryList();
  const sink=getRanchHotspots(engine.state).find(object=>object.kind==='ranch_sink');
  assert.ok(sink?.baked);
  const command=resolveInteraction(engine.state,sink);
  assert.match(await enter(command),/mildew/i);
  assert.match(await enter('look in sink'), /mildew/i);
  assert.match(await enter('take sink'),/墙/);
  assert.deepEqual(engine.state.inventoryList(),possessions);
  for(const alias of ['s','in','out']){
    assert.deepEqual(sceneExits('bathroom',engine.state,ROOMS).map(exit=>exit.dir),['s']);
    await enter(alias,'spare_room');
    await enter('n','bathroom');
  }
});

test('厨房和西北房间的东侧止于制作边界，不出现歧义方向的路牌', async () => {
  for(const [room,target] of [['kitchen','se_room'],['nw_room','assembly_room']]){
    const {engine}=await ranchFixture(room);
    const exits=sceneExits(room,engine.state,ROOMS);
    assert.ok(exits.every(exit=>exit.target!==room && exit.target!==target));
    const boundaries=sceneBoundaries(room,engine.state,ROOMS);
    assert.deepEqual(boundaries.map(route=>[route.dir,route.target]),[['e',target]]);
    assert.ok(findPath(SCENES[room],SCENES[room].spawn,boundaries[0]).length);
  }
});

test('厨房、西北房、浴室和冰库的实际门槛、地面和墙体与脚下通路一致', () => {
  const samples=[
    ['kitchen', [
      [[43,185],[106,180],[229,160],[335,157],[437,158]],
      [[229,160],[224,118],[224,68]],
      [[229,160],[298,113],[325,96]],
    ], [[124,72],[324,58],[390,52]]],
    ['nw_room', [
      [[231,54],[229,115],[230,174],[230,248],[230,268]],
      [[229,153],[340,147],[426,143]],
    ], [[130,43],[396,262],[451,130]]],
    ['bathroom', [
      [[235,260],[235,217],[231,160],[207,120],[199,108]],
      [[155,190],[235,191],[325,194]],
    ], [[198,75],[75,149],[365,255]]],
    ['icehouse', [
      [[119,202],[188,183],[250,172],[305,155],[336,152]],
      [[232,161],[214,132],[193,103]],
    ], [[200,61],[400,150],[21,160]]],
  ];
  for (const [room,paths,walls] of samples) {
    for (const path of paths) {
      for(let i=1;i<path.length;i++) {
        assert.ok(isSegmentWalkable(SCENES[room],path[i-1],path[i]),room+' 地面 '+path[i]);
      }
    }
    for (const [x,y] of walls) assert.ok(isBlocked(SCENES[room],x,y),room+' 墙面 '+[x,y]);
  }
});

test('瓷洗池、炉管和开门后的门扇可直接点选，邻近的空墙能正常略过', async () => {
  const bath=await ranchFixture('bathroom');
  const kitchen=await ranchFixture('kitchen');
  await kitchen.enter('open outer door');
  function hit(state,x,y,padding=0) {
    return pointerTarget(getRanchHotspots(state),{x,y},{padding});
  }
  for(const padding of [0,8]) {
    assert.equal(hit(bath.engine.state,199,80,padding)?.kind,'ranch_sink');
    assert.equal(hit(bath.engine.state,199,60,padding),undefined);
    assert.equal(hit(bath.engine.state,172,50,padding),undefined);
    assert.equal(hit(bath.engine.state,224,46,padding),undefined);
    const leaf=hit(kitchen.engine.state,50,159,padding);
    const gap=hit(kitchen.engine.state,38,166,padding);
    assert.equal(resolveInteraction(kitchen.engine.state,leaf),'close outer door');
    assert.equal(resolveInteraction(kitchen.engine.state,gap),'w');
    assert.equal(hit(kitchen.engine.state,92,40,padding)?.kind,'ranch_pipes');
    assert.equal(hit(kitchen.engine.state,244,40,padding),undefined);
  }
});

test('冰库靠东阶的灰光看得见，留在楼上的光源不会限制触墙和折返', async () => {
  const {engine,enter}=await ranchFixture('hallway');
  engine.state.take('splinter');
  await enter('drop splinter');
  assert.equal(engine.state.itemAt('splinter'),'hallway');
  assert.ok(!engine.state.has('lantern'));
  for(const [down,up] of [['w','e'],['d','u'],['w','out']]) {
    assert.match(await enter('examine stairs'),/icehouse/i);
    assert.match(await enter(down,'icehouse'),/descend/i);
    const routes=sceneExits('icehouse',engine.state,ROOMS);
    assert.deepEqual(routes.map(exit=>[exit.dir,exit.target]),[['e','hallway']]);
    assert.match(ROOMS.icehouse.desc(engine.state),/gray light/i);
    const walls=getRanchHotspots(engine.state).filter(item=>item.kind==='ranch_cold_wall');
    assert.equal(walls.length,1);
    assert.match(await enter(resolveInteraction(engine.state,walls[0])),/clammy/i);
    assert.match(await enter('feel walls'),/clammy/i);
    assert.match(await enter('examine stairs'),/hallway/i);
    assert.match(await enter(up,'hallway'),/trudge/i);
    assert.equal(engine.state.itemAt('splinter'),'hallway');
    const wayDown=sceneExits('hallway',engine.state,ROOMS).filter(exit=>exit.target==='icehouse');
    assert.deepEqual(wayDown.map(exit=>exit.dir),['w']);
    for(const [room,source,dir,back,exits] of [
      ['hallway','icehouse',up,'w',wayDown],['icehouse','hallway',down,'e',routes],
    ]) {
      const scene=SCENES[room];
      const arrival=roomArrival(scene,{fromRoom:source,direction:dir,exits});
      assert.equal(arrival.entrance,back);
      assert.ok(arrival.matched && findPath(scene,arrival,scene.spawn).length);
    }
  }
});
