import assert from 'node:assert/strict';
import test from 'node:test';
import { ITEMS as TEXT_ITEMS } from '../../js/data/items.js';
import { createPrologueSession } from '../engine-adapter.js';
import { ITEMS, PAPERBACK_ID as book } from '../exploration-items.js';

function start() {
  const output=[];
  const engine=createPrologueSession({ui:{text:t=>output.push(t),system:t=>output.push(t),location(){},userInput(){},inventory(){}}});
  return {engine,async command(input){output.length=0;await engine.processInput(input);return output.join('\n');}};
}

test('二维独有的平装书在棚屋角落只有一份，触及携物上限时不改变书的位置',async()=>{
  const g=start();
  assert.equal(Object.hasOwn(TEXT_ITEMS,book),false);
  assert.equal(g.engine.items,ITEMS);
  assert.equal(g.engine.state.itemAt(book),'shack');
  const turn=g.engine.state.turns;
  assert.match(await g.command('examine book'),/can.t see any book/);
  assert.equal(g.engine.state.turns,turn);
  await g.engine.transitionChapter({to:'desert',roomCandidates:['shack']});
  const s=g.engine.state;
  assert.match(await g.command('观察书封'),/DESERT ISLAND DECAMERON/);
  assert.match(await g.command('drop book'),/not holding a book/);
  assert.equal(s.hasFlag('paperback_moved'),false);
  for(const id of ['spade','splinter','watch','coin','credit_card','ruby','bandage','shroud'])s.take(id);
  assert.match(await g.command('take paperback'),/holding too much/);
  assert.equal(s.itemAt(book),'shack');
  assert.equal(s.hasFlag('paperback_moved'),false);
  s.drop('spade');
  assert.match(await g.command('take book'),/^Taken\./);
  assert.equal(s.carrying(book),true);
  assert.equal(s.hasFlag('paperback_moved'),true);
  assert.match(await g.command('take book'),/already holding the book/);
  assert.equal(s.inventoryList().filter(item=>item.id===book).length,1);
  assert.equal(s.score,0);
});

test('同一本书能带过塔梯和牧场边界，在异地放下、刷新、拾回并带走',async()=>{
  const g=start();
  await g.engine.transitionChapter({to:'desert',roomCandidates:['shack']});
  await g.command('拿平装书');
  for(const [cmd,room] of [['w','tower_platform'],['d','tower_landing'],['d','base_of_tower'],['se','shallow_crater'],['se','nw_ranch']]){
    await g.command(cmd);
    assert.equal(g.engine.state.room,room);
    assert.equal(g.engine.state.itemAt(book),'inventory');
  }
  assert.match(await g.command('drop paperback'),/^Dropped\./);
  assert.equal(g.engine.state.itemAt(book),'nw_ranch');
  const again=start();
  await again.engine.deserialize(structuredClone(g.engine.serialize()));
  assert.equal(again.engine.state.itemAt(book),'nw_ranch');
  await again.command('nw');
  assert.equal(again.engine.state.room,'shallow_crater');
  assert.match(await again.command('examine book'),/can.t see any book/);
  assert.match(await again.command('take book'),/can.t see any book/);
  assert.equal(again.engine.state.itemAt(book),'nw_ranch');
  await again.command('se');
  assert.match(await again.command('检查平装书'),/DESERT ISLAND DECAMERON/);
  await again.command('take book');
  await again.command('nw');
  assert.match(await again.command('放下书'),/^Dropped\./);
  assert.equal(again.engine.state.itemAt(book),'shallow_crater');
  const restored=start();
  await restored.engine.deserialize(structuredClone(again.engine.serialize()));
  assert.equal(restored.engine.state.roomItems().filter(id=>id===book).length,1);
  await restored.command('take book');
  assert.equal(restored.engine.state.carrying(book),true);
});

test('旧档缺少书字段时只补首发位置，已有的手持、落地及被移除状态各自保留',async()=>{
  const g=start();
  await g.engine.transitionChapter({to:'ranch',roomCandidates:['nw_ranch']});
  for(const location of [undefined,'inventory','pocket','shack','nw_ranch','shallow_crater','destroyed']){
    const save=structuredClone(g.engine.serialize());
    if(location===undefined)delete save.state.itemLoc[book];
    else save.state.itemLoc[book]=location;
    const next=start();
    await next.engine.deserialize(save);
    assert.equal(next.engine.state.itemAt(book),location??'shack');
    const nextSave=next.engine.serialize();
    const again=start();
    await again.engine.deserialize(nextSave);
    assert.equal(again.engine.state.itemAt(book),location??'shack');
    assert.equal(Object.keys(again.engine.state.itemLoc).filter(id=>id===book).length,1);
  }
});
