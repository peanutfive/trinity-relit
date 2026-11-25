import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash} from 'node:crypto';
import {createPrologueSession} from '../engine-adapter.js';
import {riverEndingLead,riverEndingResult} from '../river-ending-story.js';

// These are commands available in the ordinary 2D garden. The timer begins
// at the opening scene's actual onEnter, as it does when Start is clicked.
const pathToLake=['e','take ball','nw','unscrew gnomon','take gnomon','n','take paper bird','open paper bird',
  'w','buy crumbs','feed birds','take ruby','n','push pram','push pram','wait','throw ball at tree',
  'take umbrella','push pram','open pram','enter pram','open umbrella'];
const originalDigest='afbcca03a209e5254391c0ead35b13c2f34a71e0aa3b9c323904f6ff9bb0954b';

function session() {
  const output=[],saves=[];
  const game=createPrologueSession({
    ui:{text:line=>output.push(line),system:line=>output.push(line),userInput(){},location(){},inventory(){}},
    onAutosave:save=>saves.push(save)
  });
  game.moveTo(game.state.room);
  return {game,state:game.state,output,saves};
}

async function act(game,commands) {
  for (const command of commands) await game.processInput(command);
}

function assertEnding(g,before,cause) {
  const {state,output}=g;
  const result=riverEndingResult(before,state);
  assert.equal(result.cause,cause);
  assert.equal(state.dead,true);
  assert.equal(state.turns,before.turns);
  assert.equal(result.turns,before.turns);
  assert.deepEqual(riverEndingResult(before,state.serialize()),result);
  assert.equal(riverEndingResult(state,state),null);
  const words=result.pages.map(page=>page.split('\n\n')[0]).join(' ');
  assert.equal(createHash('sha256').update(words).digest('hex'),originalDigest);
  const lead=riverEndingLead(output,result);
  assert.equal(lead.at(-1),result.intro);
  assert.equal(lead.join('\n').split(result.intro.split('\n\n')[0]).length,2);
  assert.doesNotMatch(lead.join('\n'),/lifeless strip of sand|soundless landing|你死了。|Minutes later/);
  assert.match(result.pages[2],/silver coin you didn't know you had/);
  return {lead,result};
}

test('宫殿门平静等待四步，警报可中断；环顾、等待走到同一份 0分119步尾声',async()=>{
  for (const command of ['look','wait']) {
    const g=session();const {game,state}=g;
    await act(game,['time','score','inventory','help']);
    assert.equal(state.turns,0);
    await act(game,['wait','look','wait']);
    assert.equal(state.turns,9);
    assert.equal(state.cnt('prologue_seconds'),135);
    assert.equal(g.saves.at(-1).state.turns,9);
    let before;
    for(let i=0;i<120&&!state.dead;i++) {
      before=state.serialize();g.output.length=0;await game.processInput(command);
    }
    assert.equal(before.turns,119);assert.equal(before.counters.doom_phase,8);
    const {result}=assertEnding(g,before,'garden-clock');
    assert.equal(result.score,0);assert.equal(result.rank.en,'TOURIST');
    assert.match(result.intro,/The east wind falls silent/);
    assert.equal(g.saves.at(-1).state.turns,119);
    assert.equal(g.saves.at(-1).state.dead,false);
  }
});

test('同一份冻结湖边存档按真实回合计分；岸上与涉水濒临超时仍可以正当命令过门',async()=>{
  for(const earlyWaits of [0,2]) {
    const g=session();await act(g.game,[...Array(earlyWaits).fill('wait'),...pathToLake]);
    assert.equal(g.state.room,'long_water');
    const reached=g.state.turns;assert.equal(g.state.cnt('prologue_seconds'),1785);
    const arrival=g.game.serialize();
    for(const finalRoom of ['long_water','wading']) {
      const lake=session();await lake.game.deserialize(arrival);lake.state=lake.game.state;
      await act(lake.game,[finalRoom==='wading'?'swim':'wait',...Array(5).fill('wait')]);
      const snap=lake.game.serialize(),before=snap.state;
      assert.equal(before.room,finalRoom);assert.equal(before.turns,reached+6);
      assert.equal(before.counters.long_water_phase,6);assert.equal(before.counters.prologue_seconds,1785);
      for(const input of (finalRoom==='long_water'?['look','w']:['wait'])) {
        const end=session();await end.game.deserialize(snap);end.state=end.game.state;
        end.output.length=0;await end.game.processInput(input);
        const {lead,result}=assertEnding(end,before,'long-water');
        assert.match(result.intro,/a searing glare envelops the Long Water/);
        assert.equal(result.score,15);assert.equal(result.rank.en,'EXPLORER');
        if (input==='w') assert.match(lead[0],/frozen in your tracks/);
      }
      if (finalRoom==='wading') {
        await act(lake.game,['enter door','n']);
        assert.equal(lake.state.chapter,'wabe');assert.equal(lake.state.room,'summit');
        assert.equal(lake.state.dead,false);assert.equal(lake.state.turns,before.turns+2);
        assert.equal(riverEndingResult(before,lake.state),null);
      }
    }
  }
});

test('旧公园精确秒数可以恢复遗漏的等待步，估算档与湖边已停的钟延续原存步数',async()=>{
  const first=session();await act(first.game,['wait','wait']);
  const old=first.game.serialize();old.state.turns=2;
  const fixed=session();await fixed.game.deserialize(old);
  assert.equal(fixed.game.state.turns,8);
  await act(fixed.game,['wait']);assert.equal(fixed.game.state.turns,12);
  const estimated=structuredClone(old);estimated.state.flags.push('prologue_clock_estimated');
  const prior=session();await prior.game.deserialize(estimated);assert.equal(prior.game.state.turns,2);
  await act(prior.game,['wait']);assert.equal(prior.game.state.turns,6);
  const lake=session();await act(lake.game,pathToLake);
  const frozen=lake.game.serialize();frozen.state.turns=38;
  const restored=session();await restored.game.deserialize(frozen);
  assert.equal(restored.game.state.turns,38);
  await act(restored.game,['swim','wait','wait','enter door']);
  assert.equal(restored.game.state.room,'meadow');assert.equal(restored.game.state.turns,42);
});

test('提前死亡、已经结束的状态以及其他章节均不误认作公园或长水湖的结局',async()=>{
  const g=session();const before=g.state.serialize();
  assert.equal(riverEndingResult(before,{...before,dead:true}),null);
  assert.equal(riverEndingResult(before,before),null);
  await g.game.transitionChapter({to:'wabe',roomCandidates:['meadow']});
  const meadow=g.game.state.serialize();
  assert.equal(riverEndingResult(before,{...meadow,dead:true}),null);
  assert.equal(riverEndingResult(meadow,{...meadow,dead:true}),null);
});
