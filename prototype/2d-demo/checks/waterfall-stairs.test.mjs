import test from 'node:test';
import assert from 'node:assert/strict';
import {createPrologueSession} from '../engine-adapter.js';
import {getHotspots} from '../interaction-catalog.js';
import {resolveInteraction} from '../interaction-intent.js';
import {pointerTarget} from '../interaction-targets.js';
import {sceneExits} from '../scene-manifest.js';

function session() {
  const lines=[];
  const game=createPrologueSession({ui:{text:t=>lines.push(t),system:t=>lines.push(t),
    location(){},inventory(){},userInput(){}}});
  async function step(command,room,cost,text) {
    const {turns,score}=game.state;
    lines.length=0;
    await game.processInput(command);
    assert.equal(game.state.room,room,command);
    assert.equal(game.state.turns,turns+cost,command);
    assert.equal(game.state.score,score,command);
    assert.match(lines.join('\n'),text,command);
  }
  return {game,step};
}

test('崖壁石阶的实际上下行、明确反爬和走错垂直方向有不同的反馈及回合数',async()=>{
  for(const flipped of [false,true]){
    const {game,step}=session();
    await game.transitionChapter({to:'wabe',roomCandidates:['south_bog']});
    game.state.flipped=flipped;
    await game.processInput('w');
    const falls='waterfall', upper='cemetery';
    await step('examine stone steps',falls,1,/carved into the face/);
    await step('d',falls,0,/can't go that way/);
    await step('climb down steps',falls,1,/already at the bottom/);
    await step('n',upper,1,/carefully ascend/);
    await step('score',upper,0,/分/);
    await step('u',upper,0,/can't go that way/);
    await step('上石阶',upper,1,/already at the top/);
    await step('查看石阶',upper,1,/carved into the face/);
    await step('climb down the stone stairs',falls,1,/carefully descend/);
    await step('u',upper,1,/carefully ascend/);
    await step('下石阶',falls,1,/carefully descend/);
    await step('climb steps',upper,1,/carefully ascend/);
    await step('d',falls,1,/carefully descend/);
    await step('爬上石阶',upper,1,/carefully ascend/);
    await step('s',falls,1,/carefully descend/);
  }
});

test('上下两端的实体先观察再走，手持物和旧墓地存档仍走同一段石阶',async()=>{
  const original=session().game;
  await original.transitionChapter({to:'wabe',roomCandidates:['cemetery']});
  original.state.take('spade');
  const {game,step}=session();
  await game.deserialize(original.serialize());
  for(const [room,other,cmd,x,y] of [['cemetery','waterfall','s',246,251],['waterfall','cemetery','n',229,69]]){
    const stairs=pointerTarget(getHotspots(game.state),{x,y});
    assert.equal(stairs?.id,room+':steps');
    assert.equal(resolveInteraction(game.state,stairs,{heldItem:'spade'}),'examine steps');
    const second=resolveInteraction(game.state,stairs,{heldItem:'spade',observed:new Set([stairs.id])});
    assert.equal(second,cmd);
    assert.equal(sceneExits(room,game.state,game.rooms).filter(e=>e.target===other).length,1);
    await step(second,other,1,/stone steps/);
    assert.equal(game.state.has('spade'),true);
  }
});

test('原有小屋存档仍从前后两门往返，南方不再通往墓地',async()=>{
  const run=session();
  await run.game.transitionChapter({to:'wabe',roomCandidates:['cottage']});
  const {game,step}=session();
  await game.deserialize(run.game.serialize());
  assert.deepEqual(Object.keys(game.currentRoom().exits(game.state)).sort(),['e','w']);
  await step('s','cottage',0,/no exit that way/);
  await step('out','cottage',0,/Which way do you want to go out/);
  for(const [cmd,room] of [['e','herb_garden'],['w','cottage'],['w','bluff'],['e','cottage']]){
    await step(cmd,room,1,/\S/);
  }
});
