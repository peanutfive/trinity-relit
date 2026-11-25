import test from 'node:test';
import assert from 'node:assert/strict';
import {createPrologueSession} from '../engine-adapter.js';
import {ITEMS as original} from '../../js/data/items.js';
import {BOOKMARK_ID as card,PAPERBACK_ID as book,paperbackView} from '../exploration-items.js';

function game(){
  const lines=[];
  const engine=createPrologueSession({ui:{text:s=>lines.push(s),system:s=>lines.push(s),inventory(){},userInput(){},location(){}}});
  async function play(input){lines.length=0;await engine.processInput(input);return lines.join('\n');}
  return {engine,play};
}
async function shack(){
  const g=game();
  await g.engine.transitionChapter({to:'desert',roomCandidates:['shack']});
  return g;
}
async function restore(g){
  const r=game();await r.engine.deserialize(structuredClone(g.engine.serialize()));return r;
}

test('在地面观察、开合书本可掉出同一张夹页，阅读须先持书',async()=>{
  const g=await shack(),s=g.engine.state;
  assert.equal(original.slip.start,null);
  assert.equal(s.itemAt(card),book);
  assert.match(await g.play('examine book'),/DESERT ISLAND DECAMERON/);
  assert.match(await g.play('examine bookmark'),/on the side you can see/);
  assert.match(await g.play('take slip from book'),/It.s closed/);
  assert.match(await g.play('read book'),/holding the book/);
  assert.match(await g.play('open book'),/falls out of the book/);
  assert.equal(s.itemAt(card),'shack');
  assert.equal(s.carrying(card),false);
  assert.match(await g.play('open book'),/already open/);
  assert.match(await g.play('take slip from book'),/isn.t on the book/);
  assert.match(await g.play('close book'),/close the book/);
  assert.match(await g.play('close book'),/already closed/);
  assert.match(await g.play('open book'),/^You open the book\./);
  assert.equal(s.roomItems().filter(id=>id===card).length,1);
  const r=await restore(g);
  assert.equal(r.engine.state.itemAt(card),'shack');
  assert.equal(paperbackView(r.engine.state).open,true);
});

test('读书开页后在当前地点落卡，装回敞开书、重新翻阅与存读只得分一次',async()=>{
  const g=await shack(),s=g.engine.state;
  await g.play('take book');await g.play('w');assert.equal(s.room,'tower_platform');
  const originalScore=s.score;
  let result=await g.play('look in book');
  assert.match(result,/falls out of the book[\s\S]+nothing catches your eye/);
  assert.equal(s.itemAt(card),'tower_platform');
  await g.play('e');assert.match(await g.play('take bookmark'),/can.t see any bookmark/);
  await g.play('w');await g.play('take bookmark');
  assert.equal(s.carrying(card),true);assert.equal(s.score,originalScore+1);
  assert.match(await g.play('examine slip'),/one side. The other side/);
  await g.play('close book');assert.match(await g.play('put slip in book'),/book is closed/);
  assert.equal(s.carrying(card),true);await g.play('open book');
  assert.match(await g.play('put bookmark in book'),/slips between the pages/);
  assert.equal(s.itemAt(card),book);assert.match(await g.play('read book'),/^You flip through/);
  await g.play('close book');await g.play('e');
  const resumed=await restore(g),t=resumed.engine.state;
  assert.equal(t.room,'shack');assert.equal(t.itemAt(card),book);
  assert.match(await resumed.play('take bookmark'),/It.s closed/);
  assert.match(await resumed.play('read book'),/falls out of the book/);
  assert.equal(t.itemAt(card),'shack');await resumed.play('take bookmark');
  await resumed.play('put slip in book');assert.match(await resumed.play('take slip from book'),/out of the book/);
  assert.equal(t.score,originalScore+1);
  await resumed.play('put bookmark in pocket');assert.equal(t.inPocket(card),true);
  assert.match(await resumed.play('put bookmark in book'),/out of your pocket first/);
  assert.match(await resumed.play('take bookmark'),/out of your pocket/);
  assert.equal(t.carrying(card),true);
});

test('读旧档时缺失的纸卡夹在那一本书中，明确存放与已有得分均不重写',async()=>{
  const g=await shack();
  for(const location of [undefined,'inventory','pocket','cupboard','destroyed','shallow_crater']){
    const save=structuredClone(g.engine.serialize());
    save.state.itemLoc[book]='tower_platform';
    if(location===undefined) delete save.state.itemLoc[card];
    else save.state.itemLoc[card]=location;
    const r=game();await r.engine.deserialize(save);
    const state=r.engine.state;assert.equal(state.itemAt(card),location??book);
    assert.equal(state.score,save.state.score);
    if(location==='inventory'||location==='pocket'){
      if(location==='pocket') await r.play('take bookmark');
      await r.play('drop slip');await r.play('take slip');
      assert.equal(state.score,save.state.score);
    }
    if(location===undefined) {
      assert.match(await r.play('examine bookmark'),/can.t see any bookmark/);
      await r.play('w');await r.play('open book');
      assert.equal(state.itemAt(card),'tower_platform');
    }
    const again=await restore(r);
    assert.deepEqual(again.engine.state.itemLoc,state.itemLoc);
  }
});

test('开书掉落与手中容量分别判定，厨房收存的旧纸卡可独立取回',async()=>{
  const g=await shack(),s=g.engine.state;
  for(const id of ['spade','splinter','watch','coin','credit_card','ruby','bandage','shroud']) s.take(id);
  await g.play('open book');assert.equal(s.itemAt(card),'shack');
  assert.match(await g.play('take bookmark'),/holding too much/);
  assert.equal(s.itemAt(card),'shack');assert.equal(s.score,0);
  s.drop('spade');await g.play('take slip');assert.equal(s.score,1);
  await g.engine.transitionChapter({to:'ranch',roomCandidates:['kitchen']});
  await g.play('put bookmark in cupboard');
  assert.equal(s.itemAt(card),'cupboard');
  const r=await restore(g);
  assert.match(await r.play('examine bookmark'),/poetry/);
  assert.match(await r.play('take bookmark from cupboard'),/out of the cupboard/);
  assert.equal(r.engine.state.carrying(card),true);assert.equal(r.engine.state.score,1);
});
