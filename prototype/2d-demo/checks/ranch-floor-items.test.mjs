import assert from 'node:assert/strict';
import test from 'node:test';
import { GameState } from '../../js/engine.js';
import { createPrologueSession } from '../engine-adapter.js';
import { pointerTarget, withinReach } from '../interaction-targets.js';
import { getRanchHotspots } from '../ranch-actions.js';
import { rememberIndoorDrops } from '../ranch-floor-items.js';
import { SCENES } from '../scene-manifest.js';
import { findPath, isBlocked } from '../world.js';

function snapshot(state,player) {
  return {...state.serialize(),visual:{
    room:state.room,player:{...player},hotspots:getRanchHotspots(state),
  }};
}

function ground(state,id) {
  const matches=getRanchHotspots(state).filter(item=>item.itemId===id && !item.visualOptions?.onShelf);
  assert.equal(matches.length,1,state.room+' 地面应有一件 '+id);
  return matches[0];
}

function checkPosition(state,id) {
  const item=ground(state,id), scene=SCENES[state.room];
  const position=[item.x,item.y];
  assert.deepEqual(item.drawAt??position,position,id+' 绘制位置与脚下位置应相同');
  assert.ok(!isBlocked(scene,item.x,item.y) && findPath(scene,scene.spawn,item).length,id+' 落点应连通');
  for(const padding of [0,8]) {
    const hit=pointerTarget(getRanchHotspots(state),{x:item.x,y:item.y-2},{padding});
    assert.equal(hit?.itemId,id,id+' 图上实体应可分别点击、触摸');
  }
  return position;
}

async function kitchenFixture() {
  const engine=createPrologueSession();
  await engine.activateChapter('ranch');
  engine.state.chapter='ranch';
  engine.state.take('splinter');
  engine.moveTo('kitchen');
  // These commands use the normal parser and room events. Snapshot and update
  // the same UI-only position data as game.js does around a command.
  async function act(command,player) {
    const before=snapshot(engine.state,player);
    await engine.processInput(command);
    assert.equal(engine.state.turns,before.turns+1,command);
    rememberIndoorDrops(before,engine.state,SCENES[engine.state.room]);
  }
  await act('take knife from cupboard',{x:309,y:102,face:'up'});
  assert.ok(engine.state.carrying('knife'));
  return {engine,act};
}

test('厨房与东南房间的物品落在手边，取走相邻一件不会重排，重进及存读都留在原地',async()=>{
  for(const [room,away,back,keep,take] of [
    ['kitchen','e','w','knife','splinter'],['se_room','w','e','splinter','knife'],
  ]) {
    const {engine,act}=await kitchenFixture();
    const feet={x:132,y:206,face:'right'};
    if(room==='se_room')await act('e',feet);
    assert.equal(engine.state.room,room);
    assert.ok(!isBlocked(SCENES[room],feet.x,feet.y));
    await act('drop '+take,feet);
    const first=checkPosition(engine.state,take);
    assert.ok(withinReach(feet,ground(engine.state,take)),'掉落物应在玩家附近');
    await act('drop '+keep,feet);
    assert.deepEqual(checkPosition(engine.state,take),first);
    const kept=checkPosition(engine.state,keep);
    assert.notDeepEqual(kept,first);
    assert.ok(withinReach(feet,ground(engine.state,keep)),'第二件掉落物也应在手边');
    await act('take '+take,feet);
    assert.ok(engine.state.carrying(take));
    assert.deepEqual(checkPosition(engine.state,keep),kept);
    await act(away,feet);
    assert.notEqual(engine.state.room,room);
    await act(back,feet);
    assert.deepEqual(checkPosition(engine.state,keep),kept);
    const save=JSON.parse(JSON.stringify(engine.serialize()));
    const resumed=createPrologueSession();
    await resumed.deserialize(save);
    assert.deepEqual(checkPosition(resumed.state,keep),kept);
  }
});

test('旧存档只记了物品所在房间，两件都可达，捡取一件后另一件仍在原处',async()=>{
  for(const room of ['kitchen','se_room','nw_room','spare_room','bedroom','bathroom','hallway','icehouse']) {
    // Old saves have item locations but no per-item visual coordinates.
    const state=new GameState();
    state.chapter='ranch';
    state.room=room;
    state.placeItem('splinter',room);
    state.placeItem('knife',room);
    const old=state.serialize();
    const loaded=GameState.deserialize(old);
    const point=checkPosition(loaded,'knife');
    const other=checkPosition(loaded,'splinter');
    assert.notDeepEqual(point,other);
    const before=snapshot(loaded,{x:other[0],y:other[1],face:'up'});
    loaded.take('splinter');
    rememberIndoorDrops(before,loaded,SCENES[room]);
    assert.deepEqual(checkPosition(loaded,'knife'),point);
    assert.deepEqual(checkPosition(GameState.deserialize(loaded.serialize()),'knife'),point);
    assert.deepEqual(checkPosition(GameState.deserialize(old),'knife'),point);
  }
});

test('重新放下手中物品时按玩家的新位置落地，面向柜子也能从地面拾回',async()=>{
  const {engine,act}=await kitchenFixture();
  const firstFoot={x:355,y:208,face:'down'};
  await act('drop splinter',firstFoot);
  const first=checkPosition(engine.state,'splinter');
  await act('take splinter',firstFoot);
  const byShelf={x:324,y:96,face:'up'};
  assert.ok(isBlocked(SCENES.kitchen,byShelf.x,byShelf.y-19),'玩家面对橱柜底部');
  await act('drop splinter',byShelf);
  const second=checkPosition(engine.state,'splinter');
  assert.notDeepEqual(second,first);
  assert.ok(withinReach(byShelf,ground(engine.state,'splinter')));
  assert.ok(findPath(SCENES.kitchen,byShelf,second).length);
});

test('室内落点不会接管庭院或淤泥层的既有物位',()=>{
  for(const room of ['back_yard','underwater']) {
    const state=new GameState();
    state.chapter='ranch';
    state.room=room;
    state.take('splinter');
    const before=snapshot(state,{x:144,y:121,face:'down'});
    state.drop('splinter');
    const prior=state.serialize();
    const normal=ground(state,'splinter');
    rememberIndoorDrops(before,state,SCENES[room]);
    assert.deepEqual(state.serialize(),prior);
    assert.deepEqual(ground(state,'splinter'),normal);
  }
});
