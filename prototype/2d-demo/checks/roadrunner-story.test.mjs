import assert from 'node:assert/strict';
import test from 'node:test';
import {createPrologueSession} from '../engine-adapter.js';
import {setShadowSymbol} from '../islet-shadow.js';
import {roadrunnerView,TOWER_RUBY_BOX} from '../roadrunner-story.js';

function game() {
  const messages=[];
  const engine=createPrologueSession({ui:{text:t=>messages.push(t),system:t=>messages.push(t),location(){},inventory(){},userInput(){}}});
  return {engine,s:()=>engine.state,async input(cmd){messages.length=0;await engine.processInput(cmd);return messages.join('\n');}};
}
async function restore(g) {
  const copy=game();await copy.engine.deserialize(structuredClone(g.engine.serialize()));return copy;
}
async function sandbar(symbol) {
  const g=game(),s=g.s();
  await g.engine.transitionChapter({to:'wabe',roomCandidates:['the_river']});
  // Normal required fare and shroud; their pickup and dial are tested independently.
  s.take('silver_coin');s.wear('shroud');setShadowSymbol(s,symbol);s.clearFlag('vertex_lever_up');
  await g.input('wait');await g.input('wait');
  await g.input('enter dory');await g.input('give silver coin to oarsman');
  assert.equal(s.room,'sand_bar');return g;
}
async function tower() {
  const g=await sandbar(7);
  assert.match(await g.input('s'),/prances through the open door/);
  await g.input('enter door');assert.equal(g.s().room,'shack');
  for(const [dir,room] of [['w','tower_platform'],['d','tower_landing']]) {
    await g.input(dir);assert.equal(g.s().room,room);
    const t=g.s().turns;assert.match(await g.input('examine bird'),/can't see any bird/);assert.equal(g.s().turns,t);
  }
  assert.match(await g.input('d'),/deposits the ruby on the box/);
  return g;
}
test('小岛门闭时走鹃衔着独一颗红宝石，够不到；运动影尖开门后自己穿过，仅一次',async()=>{
  const g=await sandbar(6);
  await g.input('s');const s=g.s(),v=()=>roadrunnerView(s);
  assert.equal(v().perched,true);assert.equal(v().birdRoom,'islet');assert.equal(v().rubyInBeak,true);
  assert.match(await g.input('查看走鹃'),/holding a ruby in its beak/);
  assert.match(await g.input('看红宝石'),/sparkle with crimson fire/);
  assert.match(await g.input('捡红宝石'),/toadstool is too high/);assert.equal(s.has('ruby'),false);
  // Set only the clock fixture. The normal next turn must open the door and
  // send the bird through even though the player never steps off the island.
  s.setCnt('vertex_shadow_tick',160);s.setFlag('vertex_lever_up');
  const first=await g.input('look');assert.match(first,/prances through the open door/);
  const r=await restore(g);assert.equal(roadrunnerView(r.s().serialize()).perched,false);
  const t=r.s().turns;assert.match(await r.input('examine roadrunner'),/can't see any roadrunner/);
  assert.equal(r.s().turns,t);assert.doesNotMatch(await r.input('look'),/prances through/);
});
test('塔脚才结伴，箱盖取宝石一次计分，放地与放回盖面、口袋、存读均保持同一物位',async()=>{
  const g=await tower(),s=g.s();
  assert.equal(roadrunnerView(s).birdRoom,'base_of_tower');assert.equal(s.itemAt('ruby'),TOWER_RUBY_BOX);
  const points=s.score;
  const startTurn=s.turns;
  assert.match(await g.input('drop ruby'),/not holding a ruby/);assert.equal(s.turns,startTurn);
  assert.match(await g.input('take ruby from pocket'),/isn't in your pocket/);assert.equal(s.itemAt('ruby'),TOWER_RUBY_BOX);
  assert.match(await g.input('take ruby from box'),/off the box/);assert.equal(s.score,points+1);
  assert.match(await g.input('put ruby in pocket'),/in your pocket/);
  const r=await restore(g);assert.equal(r.s().itemAt('ruby'),'pocket');assert.equal(roadrunnerView(r.s()).rubyOnBox,false);
  assert.match(await r.input('examine ruby'),/out of your pocket first/);
  await r.input('take ruby');await r.input('drop ruby');assert.equal(r.s().itemAt('ruby'),'base_of_tower');
  assert.match(await r.input('take ruby from box'),/isn't on the box/);
  assert.match(await r.input('take ruby'),/Taken/);
  await r.input('put ruby on box');assert.equal(r.s().itemAt('ruby'),TOWER_RUBY_BOX);
  await r.input('se');assert.equal(r.s().room,'shallow_crater');
  const before=r.s().turns;assert.match(await r.input('take ruby'),/can't see any ruby/);assert.equal(r.s().turns,before);
  assert.doesNotMatch(await r.input('nw'),/deposits the ruby/);
  await r.input('take ruby');assert.equal(r.s().score,points+1);
});
test('牧场橱柜与塔脚共用原有红宝石，异地不能取回，柜中物位可恢复',async()=>{
  const g=await tower(),s=g.s();await g.input('take ruby');
  const score=s.score;
  for(const input of ['se','se','e','s','w','s','w','n','open door','e']) await g.input(input);
  assert.equal(s.room,'kitchen');
  assert.match(await g.input('put ruby in cupboard'),/ruby in the cupboard/);
  assert.equal(s.itemAt('ruby'),'cupboard');
  const r=await restore(g);await r.input('w');const turns=r.s().turns;
  assert.match(await r.input('take ruby'),/can't see any ruby/);assert.equal(r.s().turns,turns);
  await r.input('e');assert.match(await r.input('take ruby'),/out of the cupboard/);
  assert.equal(r.s().itemAt('ruby'),'inventory');assert.equal(r.s().score,score);
  await r.input('drop ruby');assert.equal(r.s().itemAt('ruby'),'kitchen');
});
test('院落随行，水边/高台留驻，照看、等候、免费失败与界面只读分开',async()=>{
  const g=await tower();
  for(const c of ['se','se','e','s','se'])await g.input(c);
  const s=g.s();assert.equal(s.room,'south_reservoir');assert.equal(roadrunnerView(s).visible,true);
  const t=s.turns;await g.input('inventory');await g.input('score');
  for(let i=0;i<20;i++)roadrunnerView(s.serialize());
  assert.equal(s.turns,t);assert.match(await g.input('examine bird'),/resembles a gray pheasant/);
  assert.equal(s.turns,t+1);await g.input('wait');assert.equal(s.turns,t+3);
  await g.input('u');assert.equal(s.room,'edge_reservoir');assert.equal(roadrunnerView(s).birdRoom,'south_reservoir');
  await g.input('in');assert.equal(s.room,'reservoir');assert.equal(roadrunnerView(s).visible,false);
  const t2=s.turns;await g.input('examine bird');assert.equal(s.turns,t2);
  await g.input('u');await g.input('d');await g.input('ne');assert.equal(roadrunnerView(s).birdRoom,'under_windmill');
  await g.input('u');assert.equal(s.room,'windmill');assert.equal(roadrunnerView(s).visible,false);
  const saved=await restore(g);await saved.input('d');assert.equal(roadrunnerView(saved.s()).visible,true);
});
test('室外走鹃不能穿过关闭的门进屋，一扇真实外门打开才会出现；关门不抹除屋内鸟',async()=>{
  for(const preopen of [false,true]){
    const g=await tower();
    for(const cmd of ['se','se','e','s','w'])await g.input(cmd);
    assert.equal(g.s().room,'front_deck');if(preopen)await g.input('open left door');
    for(const cmd of ['s','w','n'])await g.input(cmd);
    const s=g.s();assert.equal(s.room,'hallway');assert.equal(roadrunnerView(s).visible,preopen);
    if(!preopen) {
      const t=s.turns;assert.match(await g.input('看走鹃'),/can't see any roadrunner/);
      assert.equal(s.turns,t);await g.input('look');assert.equal(roadrunnerView(s).birdRoom,'sw_yard');
    }
    await g.input('open door');assert.equal(roadrunnerView(s).visible,true);
    await g.input('e');await g.input('close door');assert.equal(roadrunnerView(s).birdRoom,'kitchen');
    await g.input('n');assert.equal(s.room,'nw_room');assert.equal(roadrunnerView(s).visible,true);
  }
});
test('曾走过小岛、棚屋和两级塔梯的旧档能恢复，旧捷径与已有宝石不会增殖',async()=>{
  const g=await tower();await g.input('se');
  const data=g.engine.serialize();
  data.state.flags=data.state.flags.filter(f=>!f.startsWith('roadrunner_'));
  delete data.state.counters.roadrunner_room;
  delete data.state.itemLoc.ruby;
  const r=game();await r.engine.deserialize(structuredClone(data));
  assert.equal(roadrunnerView(r.s()).joined,true);assert.equal(roadrunnerView(r.s()).birdRoom,'shallow_crater');
  assert.equal(r.s().itemAt('ruby'),TOWER_RUBY_BOX);
  for(const stored of ['inventory','cupboard','destroyed','front_deck']) {
    const kept=structuredClone(data);kept.state.itemLoc.ruby=stored;
    const old=game();await old.engine.deserialize(kept);assert.equal(old.s().itemAt('ruby'),stored);
    assert.equal(roadrunnerView(old.s()).rubyOnBox,false);
  }
  data.state.flags=data.state.flags.filter(f=>f!=='river_ferry_crossed');data.state.flags.push('wabe_to_islet_used');
  const shortcut=game();await shortcut.engine.deserialize(data);
  assert.equal(roadrunnerView(shortcut.s()).joined,false);await shortcut.input('nw');
  assert.equal(shortcut.s().room,'base_of_tower');assert.equal(shortcut.s().itemAt('ruby'),undefined);
  assert.equal(roadrunnerView(shortcut.s()).visible,false);
});
test('从风车失足、潜回水底取镜后观鸟：手持或佩戴、跨房保存焦点、改看风车后可重新对焦',async()=>{
  const g=await tower();
  g.s().take('splinter'); // The normally obtainable glowing splinter lights the bottom.
  for(const cmd of ['se','se','e','s','se','ne','u','take binoculars','d','take binoculars','u','u','d']) await g.input(cmd);
  const s=g.s();assert.equal(s.room,'south_reservoir');assert.equal(s.itemAt('binoculars'),'inventory');
  const ordinary=await g.input('examine roadrunner');assert.match(ordinary,/gray pheasant/);
  const score=s.score,turns=s.turns;
  const first=await g.input('observe roadrunner through binoculars');
  assert.match(first,/focus the binoculars on the roadrunner/);assert.match(first,/It appears much closer now/);
  assert.doesNotMatch(first,/gray pheasant/);assert.equal(s.turns,turns+1);assert.equal(s.score,score);
  await g.input('wear binoculars');assert.equal(s.itemAt('binoculars'),'worn');
  const again=await g.input('用望远镜观察走鹃');assert.match(again,/much closer/);assert.doesNotMatch(again,/focus the binoculars/);
  const saved=await restore(g);await saved.input('nw');
  assert.doesNotMatch(await saved.input('look at bird with binoculars'),/focus the binoculars/);
  await saved.input('se');await saved.input('look at windmill through binoculars');
  assert.match(await saved.input('用双筒望远镜看那只走鹃'),/focus the binoculars on the roadrunner/);
  await saved.input('look at reservoir through binoculars');
  assert.match(await saved.input('look at roadrunner through binoculars'),/focus the binoculars on the roadrunner/);
  assert.equal(saved.s().score,score);
});
test('观鸟分别检查鸟与望远镜：脚边有镜但未拿要花一拍，目标不在场免费，失败保留先前焦点',async()=>{
  const g=await tower(),s=g.s();
  for(const cmd of ['se','se','e','s','se']) await g.input(cmd);
  const cmd='look at roadrunner through binoculars';
  const t=s.turns;assert.match(await g.input(cmd),/can't see any binoculars/);assert.equal(s.turns,t);
  s.take('binoculars'); // Focused absence/reference cases following the recovery route above.
  await g.input(cmd);await g.input('drop binoculars');assert.equal(s.inRoom('binoculars'),true);
  const onShore=s.turns;assert.match(await g.input(cmd),/have to be holding/);assert.equal(s.turns,onShore+1);
  await g.input('u');const atEdge=s.turns;assert.equal(roadrunnerView(s).visible,false);
  assert.match(await g.input(cmd),/Those things aren't here/);assert.equal(s.turns,atEdge);
  await g.input('d');await g.input('take binoculars');await g.input('u');
  const apart=s.turns;assert.match(await g.input(cmd),/can't see any roadrunner/);assert.equal(s.turns,apart);
  await g.input('d');const both=await g.input(cmd);
  assert.match(both,/much closer/);assert.doesNotMatch(both,/focus the binoculars/);
});
