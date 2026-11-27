import test from 'node:test';
import assert from 'node:assert/strict';
import {createPrologueSession} from '../engine-adapter.js';
import {lanternView, lanternSwitchCommand} from '../lantern-story.js';
import {arborLight} from '../arbor-light-state.js';

function session() {
  const lines=[];
  const engine=createPrologueSession({ui:{
    text:text=>lines.push(text), system:text=>lines.push(text), inventory(){}, location(){}, userInput(){},
  }});
  const command=async input=>{lines.length=0;await engine.processInput(input);return lines.join('\n');};
  return {engine,state:engine.state,command};
}

async function chamber() {
  const game=session();
  await game.engine.activateChapter('wabe');
  game.state.chapter='wabe';
  game.state.take('splinter');
  game.state.setCnt('vertex_shadow_tick',58);
  game.state.clearFlag('vertex_lever_up');
  game.engine.moveTo('ossuary');
  await game.command('in');
  assert.equal(game.state.room,'underground_3');
  return game;
}

test('泥地初见、原版开关、拾放与一次得分；普通观察和背包消耗不同',async()=>{
  const {state,command}=await chamber();
  assert.match(await command('look'),/lying in the dirt at your feet/);
  assert.doesNotMatch(await command('examine cylinder'),/lantern|灯笼/i);
  assert.match(await command('examine lantern'),/waterproof lantern.*turned off/);
  assert.equal(lanternSwitchCommand(state),'turn on lantern');
  assert.match(await command('switch the lamp on'),/CLICK\. The lantern emits a warm, yellow beam\./);
  assert.deepEqual(lanternView(state.serialize()),{location:'underground_3',lit:true,switchOn:true,remaining:29});
  assert.match(await command('打开提灯'),/already turned on/);
  assert.match(await command('examine switch'),/switch is turned on/);
  assert.match(await command('关灯'),/You turn off the lantern's switch/);
  const before=state.turns;
  await command('inventory'); await command('score');
  assert.equal(state.turns,before);
  const startScore=state.score;
  assert.match(await command('拿灯笼'),/You pick up the lantern/);
  assert.equal(state.score,startScore+1);
  assert.match(await command('take lantern'),/already holding/);
  assert.doesNotMatch(await command('look'),/lying in the dirt/);
  assert.match(await command('drop lantern'),/You put down the lantern/);
  assert.match(await command('look'),/There's a lantern here/);
  const beforeRefusal=state.turns;
  assert.match(await command('drop lantern'),/not holding a lantern/);
  assert.equal(state.turns,beforeRefusal);
  await command('take lantern');
  assert.equal(state.score,startScore+1);
});

test('点灯回合计入三十步，开关可暂停用电，临暗提示中断长等待，耗尽后开关仍在 ON',async()=>{
  const {state,command,engine}=await chamber();
  await command('take lantern');await command('turn on lantern');
  assert.equal(lanternView(state).remaining,29);
  await command('e');
  assert.equal(state.room,'ossuary');
  const before=state.turns;
  await command('wait');
  assert.equal(state.turns,before+4);
  await command('turn lantern off');
  const remaining=lanternView(state).remaining;
  for(let n=0;n<8;n++)await command('examine lantern');
  assert.equal(lanternView(state).remaining,remaining);
  await command('turn on lantern');
  while(lanternView(state).remaining>11) await command('examine lantern');
  assert.match(await command('wait'),/light is getting dimmer/);
  assert.equal(lanternView(state).remaining,9);
  assert.match(await command('examine lantern'),/beam is very dim/);
  assert.match(await command('wait'),/light is quite dim now/);
  assert.equal(lanternView(state).remaining,4);
  assert.match(await command('examine lantern'),/beam is almost out/);
  assert.match(await command('wait'),/light flickers and goes out/);
  assert.deepEqual(lanternView(state),{location:'inventory',lit:false,switchOn:true,remaining:0});
  const restored=session();
  await restored.engine.deserialize(engine.serialize());
  assert.deepEqual(lanternView(restored.engine.state),lanternView(state));
  assert.equal(lanternSwitchCommand(restored.engine.state),'turn off lantern');
  assert.match(await restored.command('turn on lantern'),/already turned on/);
  await restored.command('turn lantern off');
  assert.match(await restored.command('turn on lantern'),/doesn't respond/);
  assert.doesNotMatch(await restored.command('examine lantern'),/beam/);
});

test('放下的灯仍耗电，别处猜灯不耗回合，远处熄灯不播提示',async()=>{
  const {state,command}=await chamber();
  await command('turn on lantern');await command('w');
  const before=state.turns, charge=lanternView(state).remaining;
  for(const guess of ['examine lantern','take lantern','关灯'])assert.match(await command(guess),/can't see any lantern/);
  assert.equal(state.turns,before);
  assert.equal(lanternView(state).remaining,charge);
  while(lanternView(state).lit)assert.doesNotMatch(await command('wait'),/lantern's light/);
  assert.equal(state.itemAt('lantern'),'underground_3');
  await command('e');assert.match(await command('examine lantern'),/switch is turned on\./);
});

test('同一盏灯能带到凉亭，旧档保留已点灯、移置或销毁的既有物位',async()=>{
  const game=await chamber();
  await game.command('take lantern');await game.command('turn on lantern');
  await game.command('out');
  assert.equal(game.state.chapter,'wabe');assert.equal(game.state.room,'ossuary');
  game.engine.moveTo('top_of_arbor');game.state.placeItem('splinter','south_bog');
  assert.equal(arborLight(game.state),'lantern');
  await game.command('drop lantern');assert.equal(arborLight(game.state),'lantern');
  await game.command('turn off lantern');assert.equal(arborLight(game.state),null);
  for(const location of ['inventory','pocket','top_of_arbor','destroyed']){
    const save=game.engine.serialize();
    delete save.state.counters.lantern_charge;
    save.state.flags=save.state.flags.filter(f=>!['underground_items_placed','lantern_switch_on','scored_lantern_underground'].includes(f));
    save.state.flags.push('lantern_on');
    save.state.itemLoc.lantern=location;
    const restored=session();await restored.engine.deserialize(save);
    const s=restored.engine.state;
    assert.deepEqual(lanternView(s),{location,lit:true,switchOn:true,remaining:30});
    restored.engine.moveTo('underground_1');
    assert.equal(s.itemAt('lantern'),location);
    assert.equal(s.score,save.state.score);
  }
});
