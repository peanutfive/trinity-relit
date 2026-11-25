import assert from 'node:assert/strict';
import test from 'node:test';
import {createPrologueSession} from '../engine-adapter.js';
import {ferryView} from '../ferry-state.js';
import {isletDoorView} from '../islet-shadow.js';
import {getWabeHotspots} from '../wabe-actions.js';
import {vertexGnomonView,vertexShadowView,moorDoorHidden,VERTEX_DIAL,VERTEX_SOCKET} from '../islet-shadow.js';

function session(){
  const lines=[];
  const engine=createPrologueSession({ui:{text:t=>lines.push(t),system:t=>lines.push(t),location(){},inventory(){},userInput(){}}});
  async function play(...inputs){
    for(const input of inputs) {
      lines.length=0;
      await engine.processInput(input);
      assert.equal(engine.state.dead,false,input);
    }
    return lines.join('\n');
  }
  return {engine,play};
}
async function freshVertex(){
  const g=session();
  g.engine.moveTo(g.engine.state.room);
  await g.play('e','take ball','nw','unscrew gnomon','take gnomon','n','take paper bird','open paper bird','w','buy crumbs','feed birds','take ruby','n','push pram','push pram','wait','throw ball at tree','take umbrella','push pram','open pram','enter pram','open umbrella','take paper bird','take gnomon','enter water','enter door','e','u');
  assert.equal(g.engine.state.room,'vertex');
  assert.equal(g.engine.state.carrying('gnomon'),true);
  return g;
}
async function crossArbor(g){
  await g.play('d','s','u','n','s','d','n','u');
  assert.equal(g.engine.state.room,'vertex');
}

test('序章指针与正常顶台的螺纹不合；随身经过藤架后可装，拧下只落在盘面',async()=>{
  const g=await freshVertex(),s=g.engine.state;
  assert.equal(vertexGnomonView(s).controls,false);
  assert.match(await g.play('examine bolt'),/left-handed/);
  assert.match(await g.play('examine hole'),/right-handed/);
  assert.match(await g.play('examine shadow'),/ground below/);
  assert.match(await g.play('examine lever'),/can.t see any lever/);
  assert.match(await g.play('turn ring to seventh symbol'),/no visible markings/);
  assert.match(await g.play('turn ring'),/grasp the edges/);
  assert.match(await g.play('turn ring'),/casually spin/);
  assert.match(await g.play('put gnomon in hole'),/doesn.t match/);
  const score=s.score;
  await crossArbor(g);
  assert.match(await g.play('examine hole'),/left-handed/);
  await g.play('drop gnomon');
  assert.match(await g.play('put gnomon in hole'),/not holding/);
  assert.equal(s.itemAt('gnomon'),'vertex');
  await g.play('take gnomon','put gnomon on dial');
  assert.equal(s.itemAt('gnomon'),VERTEX_DIAL);
  assert.match(await g.play('examine sundial'),/lying on top/);
  assert.match(await g.play('take gnomon'),/off the sundial/);
  assert.match(await g.play('put gnomon in hole'),/rises out of the floor/);
  assert.equal(s.itemAt('gnomon'),VERTEX_SOCKET);
  assert.equal(s.score,score+5);
  assert.equal(vertexShadowView(s).leverUp,true);
  assert.deepEqual(getWabeHotspots(s).filter(o=>o.itemId==='gnomon').map(o=>o.id),['vertex:fixed-gnomon']);
  assert.match(await g.play('take gnomon'),/wobbles/);
  await g.play('push lever','turn ring to seventh symbol');
  assert.equal(vertexShadowView(s).leverUp,false);
  assert.match(await g.play('unscrew gnomon'),/straightens itself/);
  assert.equal(s.itemAt('gnomon'),VERTEX_DIAL);
  assert.equal(vertexShadowView(s).leverUp,true);
  assert.equal(moorDoorHidden(s),true);
  assert.equal(g.engine.rooms.moor.exits(s).in,undefined);
  assert.deepEqual(getWabeHotspots(s).filter(o=>o.itemId==='gnomon').map(o=>o.id),['vertex:dial-gnomon']);
  assert.ok(!getWabeHotspots(s).some(o=>o.id==='vertex:lever'));
  const reload=session();await reload.engine.deserialize(g.engine.serialize());
  assert.equal(reload.engine.state.itemAt('gnomon'),VERTEX_DIAL);
  assert.match(await reload.play('put gnomon in hole'),/not holding/);
  await reload.play('take gnomon','put gnomon in hole');
  assert.equal(reload.engine.state.itemAt('gnomon'),VERTEX_SOCKET);
  assert.equal(reload.engine.state.score,score+5);
  assert.equal(moorDoorHidden(reload.engine.state),false);
});

test('拆下锁在第七符号的指针，渡船仍在工作，上岛时门已错开',async()=>{
  const g=await freshVertex(),s=g.engine.state;
  await crossArbor(g);
  await g.play('put gnomon in hole','push lever','turn ring to seventh symbol');
  assert.equal(isletDoorView(s).aligned,true);
  await g.play('unscrew gnomon','d','se');
  assert.equal(s.room,'the_river');
  // Coin acquisition and ferry fare have their own from-title playthrough.
  s.wear('shroud');s.take('silver_coin');
  for(let i=0;i<12 && !ferryView(s).docked;i++) await g.play('look');
  await g.play('enter dory','give silver coin to oarsman','s');
  assert.equal(s.room,'islet');
  assert.equal(s.itemAt('gnomon'),VERTEX_DIAL);
  assert.equal(isletDoorView(s).open,false);
  assert.match(await g.play('enter door'),/door is closed/);
  assert.equal(s.room,'islet');
});

test('携针与把针留在地面穿过藤架，分别改变孔和物品的观测手性',async()=>{
  const g=await freshVertex(),s=g.engine.state;
  await g.play('drop gnomon');
  await crossArbor(g);
  await g.play('take gnomon');
  assert.equal(vertexGnomonView(s).boltThread,'right');
  assert.equal(vertexGnomonView(s).holeThread,'left');
  assert.match(await g.play('put gnomon in hole'),/doesn.t match/);
  await crossArbor(g);
  assert.equal(vertexGnomonView(s).holeThread,'right');
  assert.match(await g.play('put gnomon in hole'),/screw the gnomon/);
  assert.equal(s.itemAt('gnomon'),VERTEX_SOCKET);
});

test('旧顶台控制不复制或搬走原物，未到顶台的旧档使用实物安装规则',async()=>{
  const g=await freshVertex();
  const base=g.engine.serialize();
  for(const location of ['inventory','south_bog','destroyed',undefined]){
    const old=structuredClone(base);
    old.state.flags=old.state.flags.filter(f=>f!=='vertex_install_rules');
    if(location===undefined)delete old.state.itemLoc.gnomon;
    else old.state.itemLoc.gnomon=location;
    const loaded=session();await loaded.engine.deserialize(old);
    const state=loaded.engine.state;
    assert.equal(state.itemAt('gnomon'),location);
    assert.equal(vertexGnomonView(state).legacy,true);
    assert.equal(state.score,old.state.score);
    await loaded.play('unscrew gnomon');
    assert.equal(state.itemAt('gnomon'),location);
    assert.equal(vertexGnomonView(state).onDial,false);
    await loaded.play('push lever','turn ring to seventh symbol');
    assert.equal(vertexShadowView(state).centered,true);
    const twice=session();await twice.engine.deserialize(loaded.engine.serialize());
    assert.equal(twice.engine.state.itemAt('gnomon'),location);
  }
  const old=structuredClone(base);
  old.state.flags=old.state.flags.filter(f=>f!=='vertex_install_rules');
  old.state.visited=old.state.visited.filter(id=>id!=='vertex');
  old.state.room='bottom_of_stairs';
  const early=session();await early.engine.deserialize(old);
  await early.play('u');
  assert.equal(vertexGnomonView(early.engine.state).controls,false);
  assert.equal(early.engine.state.carrying('gnomon'),true);
});
