import assert from 'node:assert/strict';
import test from 'node:test';
import {createPrologueSession} from '../engine-adapter.js';
import {arborLight} from '../arbor-light-state.js';

async function inMeadow(){
  const lines=[],names=[],saves=[];
  const engine=createPrologueSession({ui:{
    text:t=>lines.push(t),system:t=>lines.push(t),location:(en,cn)=>names.push([en,cn]),inventory(){},userInput(){}
  },onAutosave:s=>saves.push(s)});
  await engine.transitionChapter({to:'wabe',roomCandidates:['meadow']});
  return {engine,lines,names,saves,async play(...commands){
    lines.length=0;names.length=0;
    for(const command of commands) await engine.processInput(command);
    return lines.join('\n');
  }};
}

test('不带光从草地进入两处坡道，顶部标题黑暗；环顾与猜物免费，南北均可退回',async()=>{
  const g=await inMeadow(),s=g.engine.state;
  await g.play('n','e','e');
  assert.equal(s.room,'trellises');
  const initial=s.turns;
  assert.match(await g.play('u'),/can't go that way/);
  assert.equal(s.room,'trellises');assert.equal(s.turns,initial);
  await g.play('se','w');
  assert.equal(s.room,'arboretum');
  for(const [side,room] of [['n','north_arbor'],['s','south_arbor']]) {
    const slope=await g.play(side);
    assert.equal(s.room,room);assert.match(slope,/floor.*pergola/);
    const text=await g.play('up');
    assert.deepEqual(g.names.at(-1),['Darkness','黑暗']);
    assert.equal(s.room,'top_of_arbor');assert.equal(arborLight(s),null);
    assert.match(text,/completely dark/);assert.match(text,/sense of direction/);
    assert.doesNotMatch(text,/cleaved by|sparkling sculpture|leafy tunnels/);
    const before=s.serialize();
    for(const verb of ['look','examine crystal','观察雕塑','take axe']) assert.match(await g.play(verb),/too dark to see/);
    assert.match(await g.play('out'),/Which way do you want to go out/);
    assert.match(await g.play('down'),/Which way do you want to go down/);
    assert.match(await g.play('w'),/Something bushy blocks/);
    await g.play('score','i');
    assert.deepEqual(s.serialize(),before);
    await g.play(side,'d');
    assert.equal(s.room,'arboretum');assert.equal(s.flipped,false);
  }
});

test('首次观察晶瓶免费并保存，重复可读铭文；真实越顶后东西路不换，铭文倒写',async()=>{
  const g=await inMeadow(),s=g.engine.state;
  await g.play('n','e','e','se','w');
  const initial=s.turns;
  assert.match(await g.play('观察水晶'),/a crystalline bottle, eight feet high/);
  assert.equal(s.turns,initial);const saved=g.saves.at(-1);
  const h=await inMeadow();await h.engine.deserialize(saved);
  const world=h.engine.state;
  assert.match(await h.play('examine sculpture'),/FELIX KLEIN 1849-1925/);
  assert.equal(world.turns,initial+1);
  await h.play('n','in','s');
  assert.equal(world.flipped,false);
  const mid=h.engine.serialize();const restored=await inMeadow();
  await restored.engine.deserialize(mid);
  const state=restored.engine.state;
  await restored.play('out');assert.equal(state.room,'arboretum');assert.equal(state.flipped,true);
  assert.match(await restored.play('read inscription'),/5291-9481 NIELK XILEF/);
  await restored.play('e');assert.equal(state.room,'arborvitaes_n');
  await restored.play('w','w');assert.equal(state.room,'arborvitaes_s');
  await restored.play('e','s','u','n','d');
  assert.equal(state.flipped,false);
});

test('木片只在随身或留在顶层时照亮，顶层没有水晶；旧道具的物位与落地反馈一致',async()=>{
  const g=await inMeadow(),s=g.engine.state;
  await g.play('n','ne','take splinter','se','se','w','s','u');
  assert.equal(s.room,'top_of_arbor');assert.deepEqual(g.names.at(-1),['Top of Arbor','藤架顶部']);
  const lit=await g.play('look');assert.match(lit,/flickering light of the splinter/);
  assert.match(lit,/tunnels curve down to the north and south/);
  assert.match(lit,/An arborvitae is cleaved by a silver axe/);
  const before=s.turns;assert.match(await g.play('examine crystal'),/can't see any crystal here/);assert.equal(s.turns,before);
  await g.play('take axe');assert.doesNotMatch(await g.play('look'),/axe/);
  await g.play('drop axe');assert.match(await g.play('look'),/There's an axe here/);
  await g.play('drop splinter');
  assert.equal(arborLight(s),'splinter');
  await g.play('n','in');
  assert.deepEqual(g.names.at(-1),['Top of Arbor','藤架顶部']);
  await g.play('take splinter','n','d','drop splinter','n','u');
  assert.deepEqual(g.names.at(-1),['Darkness','黑暗']);
  assert.equal(s.itemAt('axe'),'top_of_arbor');assert.match(await g.play('take axe'),/too dark/);
  for (const [location,on,expected] of [['top_of_arbor',true,'lantern'],['inventory',true,'lantern'],
      ['inventory',false,null],['arboretum',true,null],['destroyed',true,null]]) {
    const state={...s.serialize(),itemLoc:{...s.itemLoc,lantern:location},flags:on?['lantern_on']:[]};
    assert.equal(arborLight(state),expected);
  }
});

test('旧顶层存档没有上坡侧记录时保留原翻转状态、物品归属，回到植物园后可继续完整穿越',async()=>{
  const g=await inMeadow();
  await g.play('n','e','e','se','w','s','u');
  for (const [flipped,where] of [[true,'inventory'],[false,'arboretum'],[true,'destroyed']]) {
    const save=g.engine.serialize();delete save.state.counters.arbor_entry_side;
    save.state.flipped=flipped;save.state.itemLoc.axe=where;
    const h=await inMeadow();await h.engine.deserialize(save);const s=h.engine.state;
    await h.play('n','d');assert.equal(s.room,'arboretum');assert.equal(s.flipped,flipped);
    assert.equal(s.itemAt('axe'),where);assert.equal(s.itemAt('crystal'),undefined);
    await h.play('n','u','s','d');
    assert.equal(s.flipped,!flipped);assert.equal(s.itemAt('axe'),where);
  }
});
