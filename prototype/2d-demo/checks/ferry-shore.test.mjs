import assert from 'node:assert/strict';
import test from 'node:test';
import { ROOMS as TEXT_WABE } from '../../js/data/wabe.js';
import { ROOMS as TEXT_ISLET } from '../../js/data/islet.js';
import { createPrologueSession } from '../engine-adapter.js';
import { ferryView } from '../ferry-state.js';
import { getHotspots } from '../interaction-catalog.js';
import { resolveInteraction } from '../interaction-intent.js';

function session() {
  const lines=[];
  const engine=createPrologueSession({ui:{
    text:value=>lines.push(value),system:value=>lines.push(value),location(){},inventory(){},userInput(){},
  }});
  return {
    engine,lines,view:()=>ferryView(engine.state),
    async enter(input) {
      lines.length=0;
      await engine.processInput(input);
      return lines.join('\n');
    },
  };
}

async function river(symbol=2,elapsed=0) {
  const run=session();
  run.engine.state.turns=elapsed;
  run.engine.state.sundialSymbol=symbol;
  await run.engine.transitionChapter({to:'wabe',roomCandidates:['bottom_of_stairs']});
  assert.match(await run.enter('se'),/lone vessel/);
  return run;
}

async function dock(run,phase=2) {
  for (let i=0;i<phase;i++) await run.enter('look');
  assert.equal(run.view().phase,phase);
  assert.ok(run.view().docked);
}

async function restore(run) {
  const next=session();
  await next.engine.deserialize(JSON.parse(JSON.stringify(run.engine.serialize())));
  assert.deepEqual(next.view(),run.view());
  return next;
}

test('七个日晷符号从初抵这天起排班，每十二个有效回合循环，离岸活动也推进',async()=>{
  for (let symbol=1;symbol<=7;symbol++) {
    const run=await river(symbol,symbol*5);
    assert.equal(run.view().phase,0);
    assert.equal(run.engine.currentRoom().exits(run.engine.state).in,undefined);
    for(let i=1;i<=12;i++) {
      await run.enter('look');
      assert.equal(run.view().phase,i%12);
      assert.equal(run.view().visible,i<=5 || i===12);
      assert.equal(run.view().docked,i>=2 && i<=4);
    }
    await run.enter('nw');
    await run.enter('look');
    await run.enter('se');
    assert.equal(run.view().phase,3);
  }
});

test('看船首遇能辨识船夫，消失后猜船不耗回合，重新出现时保持认知',async()=>{
  const run=await river();
  assert.equal(run.engine.state.hasFlag('river_oarsman_recognized'),false);
  const first=await run.enter('examine oarsman');
  assert.match(first,/hooded cloak/);
  assert.doesNotMatch(first,/make out a dark oarsman/);
  assert.match(await run.enter('look in the boat'),/ancient design/);
  assert.match(await run.enter('examine river'),/dark and still/);
  await run.enter('wait');await run.enter('wait');await run.enter('wait');
  assert.equal(run.view().visible,false);
  const again=await restore(run);
  const turn=again.engine.state.turns;
  assert.match(await again.enter('examine dory'),/can't see any dory/);
  assert.match(await again.enter('examine oarsman'),/can't see any oarsman/);
  assert.equal(again.engine.state.turns,turn);
  await again.enter('wait');
  assert.equal(again.engine.state.turns,turn+4);
  assert.match(await again.enter('wait'),/reappears/);
  assert.equal(again.view().phase,0);
  assert.doesNotMatch(await again.enter('wait'),/make out a dark oarsman/);
});

test('从岸边递交、出示、猜银币或掉在岸上的银币都不能买票',async()=>{
  const run=await river();
  const state=run.engine.state;
  state.take('coin');
  assert.match(await run.enter('give silver coin to oarsman'),/not holding that/);
  assert.equal(state.itemAt('silver_coin'),undefined);
  state.placeItem('silver_coin','the_river');
  assert.match(await run.enter('give silver coin to oarsman'),/not holding a silver coin/);
  state.toPocket('silver_coin');
  const first=await run.enter('give silver coin to oarsman');
  assert.match(first,/taking the silver coin out of your pocket first/);
  assert.match(first,/get in the dory/);
  assert.match(await run.enter('show silver coin to oarsman'),/get in the dory/);
  assert.equal(state.itemAt('silver_coin'),'inventory');
  assert.equal(state.itemAt('coin'),'inventory');
  assert.equal(state.hasFlag('ferry_paid'),false);
});

test('三个停泊时刻皆可登艇，未穿或只手持衣物会被赶回；太早、太晚均够不到',async()=>{
  for(const phase of [0,1,2,3,4,5]) {
    const run=await river();
    run.engine.state.wear('shroud');
    for(let i=0;i<phase;i++) await run.enter('look');
    const text=await run.enter('enter dory');
    const canBoard=phase>=2 && phase<=4;
    assert.equal(run.view().onboard,canBoard);
    assert.match(text,canBoard?/skeletal hand/:/where you're standing/);
    if(canBoard)assert.equal(run.view().phase,phase);
  }
  const run=await river();
  run.engine.state.take('shroud');
  await dock(run);
  assert.match(await run.enter('enter dory'),/London vacation shorts/);
  assert.equal(run.view().onboard,false);
  assert.match(await run.enter('enter dory'),/vacation shorts and kicks/);
  assert.equal(run.engine.state.room,'the_river');
});

test('停船催资和离艇按实际动作计时，读艇内存档保持位置与余下时限',async()=>{
  const run=await river();
  run.engine.state.wear('shroud');
  await dock(run);
  await run.enter('enter dory');
  const again=await restore(run);
  assert.match(await again.enter('n'),/while you're in the dory/);
  assert.equal(again.view().phase,2);
  const late=await restore(again);
  assert.match(await late.enter('wait'),/swift kick/);
  assert.equal(late.view().onboard,false);
  assert.equal(late.view().phase,3);
  const early=await restore(run);
  assert.match(await early.enter('exit dory'),/clamber out/);
  assert.equal(early.view().phase,3);
  const turn=run.engine.state.turns;
  assert.match(await run.enter('out'),/clamber out/);
  assert.equal(run.engine.state.turns,turn);
  assert.equal(run.view().phase,2);
  await run.enter('in');
  assert.equal(run.engine.state.turns,turn);
  assert.equal(run.view().onboard,true);
});

test('信用卡不能充作船资，船夫撕卡后仍等真币；一回合的催资后仍可成功交付',async()=>{
  const run=await river();
  const state=run.engine.state;
  state.wear('shroud');
  state.toPocket('silver_coin');
  await dock(run,4);
  await run.enter('enter dory');
  const card=await run.enter('give credit card to oarsman');
  assert.match(card,/rips the card in half/);
  assert.match(card,/growing impatience/);
  assert.equal(state.itemAt('credit_card'),'destroyed');
  assert.equal(state.hasFlag('ferry_paid'),false);
  const receipt=await run.enter('give silver coin to oarsman');
  assert.match(receipt,/taking the silver coin out of your pocket/);
  assert.match(receipt,/accepts the silver coin/);
  assert.match(receipt,/empty dory away from the shore/);
  assert.equal(state.room,'sand_bar');
  assert.equal(state.chapter,'islet');
  assert.equal(state.itemAt('silver_coin'),'destroyed');
  assert.equal(state.hasFlag('wabe_to_islet_used'),false);
  assert.equal(run.view().crossed,true);
  assert.equal(run.view().legacyPaid,false);
  assert.equal(run.view().phase,10);
  const ashore=await restore(run);
  assert.equal(ashore.engine.currentRoom().exits(ashore.engine.state).out,undefined);
  const phases=[];
  for(let i=0;i<5;i++){await ashore.enter('wait');phases.push(ashore.view().phase);}
  assert.deepEqual(phases,[11,3,7,8,9]);
  assert.match(await ashore.enter('enter dory'),/pushes you away from the dory/);
  assert.equal(ashore.engine.state.room,'sand_bar');
  await ashore.enter('s');
  assert.equal(ashore.engine.state.room,'islet');
  await ashore.enter('enter door');
  assert.equal(ashore.engine.state.room,'shallow_crater');
});

test('旧河岸档第一次恢复启动排班，旧票已付与旧岛尚未付两类都保留原路',async()=>{
  const original=await river(6,12);
  const snapshot=original.engine.serialize();
  snapshot.state.flags=snapshot.state.flags.filter(f=>!f.startsWith('river_ferry_'));
  snapshot.state.counters={};
  const reloaded=session();
  await reloaded.engine.deserialize(snapshot);
  assert.equal(reloaded.view().phase,0);
  await reloaded.enter('look');
  assert.equal(reloaded.view().phase,1);
  for(const room of ['islet','sand_bar']){
    const old=session();
    await old.engine.transitionChapter({to:'islet',roomCandidates:[room]});
    old.engine.state.sundialSymbol=6;
    old.engine.state.setFlag('wabe_to_islet_used');
    old.engine.state.take('silver_coin');
    const next=await restore(old);
    assert.equal(next.view().legacyUnpaid,true);
    assert.equal(next.view().docked,true);
    assert.match(await next.enter('examine dory'),/ancient design/);
    assert.match(await next.enter('examine oarsman'),/hooded cloak/);
    await next.enter('give silver coin to oarsman');
    assert.equal(next.engine.state.itemAt('silver_coin'),'destroyed');
    assert.equal(next.view().legacyPaid,true);
    assert.match(await next.enter('examine oarsman'),/hooded cloak/);
    if(room==='islet')await next.enter('n');
    await next.enter('out');
    assert.equal(next.engine.state.room,'the_river');
    next.engine.state.sundialSymbol=4;
    assert.match(await next.enter('examine dory'),/ancient design/);
    await next.enter('in');
    assert.equal(next.engine.state.room,'islet');
  }
  assert.ok(TEXT_WABE.the_river.exits(original.engine.state).in);
  assert.ok(TEXT_ISLET.sand_bar.events.some(event=>event.id==='give_coin_to_oarsman_sb'));
});

test('正常渡河后沙洲没有菌门，穿门只在南侧小岛生效',async()=>{
  const run=await river();
  run.engine.state.wear('shroud');
  run.engine.state.toPocket('silver_coin');
  await dock(run);
  await run.enter('enter dory');
  await run.enter('give silver coin to oarsman');
  const next=await restore(run);
  const state=next.engine.state;
  const turn=state.turns;
  for(const command of ['enter door','enter white door','进入白门','examine door','观察毒菌','examine toadstool']){
    assert.match(await next.enter(command),/You can't see any (door|toadstool) here\./);
    assert.equal(state.room,'sand_bar');
    assert.equal(state.turns,turn);
    assert.equal(state.hasFlag('islet_done'),false);
  }
  await next.enter('s');
  assert.equal(state.room,'islet');
  await next.enter('enter white door');
  assert.equal(state.room,'shallow_crater');
  assert.equal(state.hasFlag('islet_done'),true);
});

test('两类历史登岛档读入后仍可用沙洲原有白门',async()=>{
  for(const flag of ['wabe_to_islet_used','ferry_paid']) {
    const run=session();
    await run.engine.transitionChapter({to:'islet',roomCandidates:['sand_bar']});
    run.engine.state.setFlag(flag);
    const next=await restore(run);
    await next.enter('enter door');
    assert.equal(next.engine.state.room,'shallow_crater');
    assert.equal(next.engine.state.hasFlag('islet_done'),true);
  }
});

test('小岛首次靠近按 F、点菌盖与中英文查看菌柄均只描述可见的高度',async()=>{
  const run=await river();
  const state=run.engine.state;
  state.wear('shroud');
  state.take('silver_coin');
  await dock(run);
  await run.enter('enter dory');
  await run.enter('give silver coin to oarsman');
  await run.enter('s');
  const objects=getHotspots(state);
  const near=objects.find(object=>object.id==='islet:gate');
  const crown=objects.find(object=>object.id==='islet:crown');
  const initialLocation=state.itemAt('toadstool_islet');
  const expected='The toadstool must be at least twelve feet from base to crown.\n\n这株毒菌从根部到菌盖，少说也有十二英尺高。';
  const inspect=resolveInteraction(state,near);
  assert.equal(inspect,'examine toadstool');
  assert.equal(resolveInteraction(state,crown),inspect);
  for(const command of [inspect,'look at the mushroom','examine stem','examine crown','观察毒菌','看蘑菇','检查菌柄','查看菌盖']) {
    assert.equal(await run.enter(command),expected);
    assert.equal(state.room,'islet');
    assert.equal(state.itemAt('toadstool_islet'),initialLocation);
    assert.equal(state.hasFlag('islet_done'),false);
  }
  assert.equal(resolveInteraction(state,near,{observed:new Set([near.id])}),'enter door');
});
