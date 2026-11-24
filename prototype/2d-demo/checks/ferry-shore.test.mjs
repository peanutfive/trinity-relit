import assert from 'node:assert/strict';
import test from 'node:test';
import { ROOMS as TEXT_WABE } from '../../js/data/wabe.js';
import { matchingEvent } from '../../js/intent.js';
import { createPrologueSession } from '../engine-adapter.js';
import { withFerryShore } from '../ferry-shore.js';

function session() {
  const lines=[];
  const engine=createPrologueSession({ui:{
    text:value=>lines.push(value),system:value=>lines.push(value),location(){},inventory(){},userInput(){},
  }});
  return {engine,async enter(input){
    const turn=engine.state.turns;
    lines.length=0;
    await engine.processInput(input);
    assert.equal(engine.state.turns,turn+1);
    return lines.join('\n');
  }};
}

async function river() {
  const run=session();
  await run.engine.transitionChapter({to:'wabe',roomCandidates:['the_river']});
  run.engine.state.sundialSymbol=6;
  return run;
}

test('同一处河岸可分别看船、船夫和水面，重看与读档不会改变行程',async()=>{
  const {engine,enter}=await river();
  assert.match(await enter('examine dory'),/ancient design/);
  assert.equal(engine.state.hasFlag('river_oarsman_recognized'),false);
  assert.match(await enter('examine oarsman'),/hooded cloak/);
  assert.equal(engine.state.hasFlag('river_oarsman_recognized'),true);
  assert.match(await enter('look at boatman'),/hooded cloak/);
  assert.match(await enter('look in the boat'),/ancient design/);
  assert.match(await enter('examine river'),/dark and still/);
  const other=session();
  await other.engine.deserialize(JSON.parse(JSON.stringify(engine.serialize())));
  assert.equal(other.engine.state.room,'the_river');
  assert.equal(other.engine.state.hasFlag('river_oarsman_recognized'),true);
  assert.equal(other.engine.currentRoom().exits(other.engine.state).in.to,'islet');
});

test('从口袋递币会先拿出来，在岸上递交和展示都保留手中银币',async()=>{
  const {engine,enter}=await river();
  engine.state.toPocket('silver_coin');
  const first=await enter('give silver coin to oarsman');
  assert.match(first,/taking the silver coin out of your pocket first/);
  assert.match(first,/get in the dory/);
  assert.equal(engine.state.itemAt('silver_coin'),'inventory');
  for(const command of ['show silver coin to oarsman','give silver coin to boatman']) {
    const text=await enter(command);
    assert.doesNotMatch(text,/pocket/);
    assert.match(text,/get in the dory/);
    assert.equal(engine.state.itemAt('silver_coin'),'inventory');
    assert.equal(engine.state.room,'the_river');
    assert.equal(engine.state.hasFlag('ferry_paid'),false);
    assert.equal(engine.state.score,0);
  }
});

test('放在地上或从未持有的银币既不转移也不被当作普通硬币',async()=>{
  const {engine,enter}=await river();
  engine.state.take('coin');
  assert.match(await enter('give silver coin to oarsman'),/not holding that/);
  assert.equal(engine.state.itemAt('silver_coin'),undefined);
  engine.state.placeItem('silver_coin','the_river');
  assert.match(await enter('give silver coin to oarsman'),/not holding a silver coin/);
  assert.equal(engine.state.itemAt('silver_coin'),'the_river');
  assert.equal(engine.state.itemAt('coin'),'inventory');
  assert.equal(engine.state.hasFlag('ferry_paid'),false);
});

test('二维河岸仅在既有渡船可见时启用专属命令，保留原章节和岛上付款',async()=>{
  const original=TEXT_WABE.the_river;
  const shore=withFerryShore(original);
  assert.equal(shore.exits,original.exits);
  assert.deepEqual(shore.events.slice(-original.events.length),original.events);
  assert.ok(!original.events.some(event=>event.id==='river_examine_dory'));
  const {engine,enter}=await river();
  for(const symbol of [2,6]){
    engine.state.sundialSymbol=symbol;
    const visible=engine.currentRoom().exits(engine.state).in.to==='islet';
    for(const input of ['examine oarsman','examine dory','give silver coin to oarsman'])
      assert.equal(Boolean(matchingEvent(engine,engine.parser.parse(input))),visible);
  }
  engine.state.take('silver_coin');
  await enter('in');
  assert.equal(engine.state.room,'islet');
  await enter('give silver coin to oarsman');
  assert.equal(engine.state.itemAt('silver_coin'),'destroyed');
  assert.ok(engine.state.hasFlag('ferry_paid'));
});
