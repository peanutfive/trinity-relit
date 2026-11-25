import assert from 'node:assert/strict';
import test from 'node:test';
import {createPrologueSession} from '../engine-adapter.js';
import {riverEndingResult, RANCH_RIVER_ENDING} from '../river-ending-story.js';

async function lastLivingTurn() {
  const engine=createPrologueSession();
  await engine.transitionChapter({to:'ranch',roomCandidates:['front_deck']});
  for(const cmd of ['open right door','nw','n','s']) await engine.processInput(cmd);
  assert.equal(engine.state.room,'assembly_room');
  assert.equal(engine.state.hasFlag('ranch_snake_bitten'),true);
  assert.equal(engine.state.dead,false);
  return engine;
}

test('T54 的末次动作结算最后一个活回合；场景三段只读、银币与渡船状态无写入，死亡档不覆盖活档',async()=>{
  const game=await lastLivingTurn();
  const saves=[];
  game.onAutosave=save=>saves.push(save);
  game.state.score=30;
  game.state.setFlag('river_ferry_crossed');game.state.setFlag('ferry_paid');
  const before=game.state.serialize();
  await game.processInput('score');await game.processInput('i');
  assert.deepEqual(game.state.serialize(),before);
  await game.processInput('look');
  const after=game.state,terminal=after.serialize();
  assert.equal(after.dead,true);assert.equal(after.room,'assembly_room');assert.equal(after.turns,before.turns);
  assert.equal(saves.length,0);
  const result=riverEndingResult(before,after);
  assert.equal(result.pages.length,3);
  assert.match(result.pages[0],/lifeless strip of sand/);assert.match(result.pages[1],/oarsman at the stern/);
  assert.match(result.pages[2],/silver coin you didn't know you had/);
  assert.match(result.pages[2],/first glimpse of the opposite shore/);
  assert.match(result.intro,/windows are filled with light/);
  for(const text of [result.intro,...result.pages,result.summary]) {
    const [en,cn]=text.split('\n\n');assert.ok(en);assert.match(cn,/\p{Script=Han}/u);
  }
  assert.equal(result.score,30);assert.equal(result.turns,before.turns);assert.equal(result.maxScore,100);
  assert.equal(result.rank.en,'EXPLORER');
  assert.match(result.summary,new RegExp('Your score is 30 points out of 100, in '+before.turns+' moves'));
  assert.deepEqual(riverEndingResult(before,terminal),result);
  assert.equal(riverEndingResult(terminal,terminal),null);
  assert.equal(after.itemAt('silver_coin'),before.itemLoc.silver_coin);
  assert.deepEqual(after.visited,new Set(before.visited));assert.equal(after.hasFlag('river_ferry_onboard'),false);
  await game.processInput('in');await game.processInput('wait');assert.deepEqual(after.serialize(),terminal);
});
test('末局倒下处决定亮光入口；持币、没带及在别处使用不同叙事',async()=>{
  const original=await lastLivingTurn();const save=original.serialize();
  for(const [input,room,location,light,coin] of [
    ['e','front_deck','inventory',/desert around you/,/your silver coin,/],
    ['n','closet','pocket',/cracks in the north wall/,/your silver coin,/],
    ['s','se_room','destroyed',/windows are filled/,/coin you didn't know you had/],
    ['w','nw_room','kitchen',/windows are filled/,/coin you didn't know you had/]
  ]){
    const game=createPrologueSession();await game.deserialize(save);
    const s=game.state;s.placeItem('silver_coin',location);const before=s.serialize();
    await game.processInput(input);assert.equal(s.room,room);
    const r=riverEndingResult(before,s.serialize());assert.match(r.intro,light);assert.match(r.pages[2],coin);
    assert.equal(s.itemAt('silver_coin'),location);assert.equal(s.turns,before.turns);
  }
});
test('称号按原版四段阈值，并保留 1 point 和 1 move',async()=>{
  const game=await lastLivingTurn(),before=game.state.serialize();await game.processInput('look');
  const after=game.state.serialize();
  for(const [score,rank] of [[0,'TOURIST'],[1,'TOURIST'],[14,'TOURIST'],[15,'EXPLORER'],
    [49,'EXPLORER'],[50,'HISTORIAN'],[99,'HISTORIAN'],[100,'TOURIST']]) {
    const r=riverEndingResult({...before,turns:1},{...after,score,turns:1});
    assert.equal(r.rank.en,rank);assert.ok(r.summary.includes('rank of '+rank+'.]'));
    assert.ok(r.summary.includes('in 1 move.'));
    assert.ok(r.summary.includes(score===1?'1 point out':' points out'));
  }
});
test('普通房间、未结局、倒下前的咬伤及其他终局都不进入这个尾声',async()=>{
  const game=createPrologueSession(),s=game.state;
  const initial=s.serialize();await game.processInput('look');
  assert.equal(s.turns,initial.turns+1);assert.equal(riverEndingResult(initial,s),null);
  const ordinaryDeath={...initial,dead:true};assert.equal(riverEndingResult(initial,ordinaryDeath),null);
  const wounded=await lastLivingTurn(),pre=wounded.state.serialize();
  assert.equal(riverEndingResult(pre,pre),null);
  const otherEnding={...pre,dead:true};assert.equal(riverEndingResult(pre,otherEnding),null);
  assert.equal(riverEndingResult(pre,{...otherEnding,room:'the_river',flags:[...otherEnding.flags,RANCH_RIVER_ENDING]}),null);
});
