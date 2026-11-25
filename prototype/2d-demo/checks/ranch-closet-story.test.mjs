import assert from 'node:assert/strict';
import test from 'node:test';
import {createPrologueSession} from '../engine-adapter.js';
import {closetView,closetFreeResponse} from '../ranch-closet-story.js';

function game(){
  const lines=[];
  const engine=createPrologueSession({ui:{text:t=>lines.push(t),system:t=>lines.push(t),location(){},inventory(){},userInput(){}}});
  return {engine,async play(input){lines.length=0;await engine.processInput(input);return lines.join('\n');}};
}
async function start(room){
  const g=game();
  await g.engine.transitionChapter({to:'ranch',roomCandidates:[room]});
  return g;
}
async function restore(g){
  const r=game();await r.engine.deserialize(structuredClone(g.engine.serialize()));return r;
}

test('前廊两门独立，西北房、东南房和前廊都能到组装室，首次进入各给一回合退避',async()=>{
  for(const [origin,dir] of [['nw_room','e'],['se_room','n'],['front_deck','nw']]){
    const g=await start(origin),s=g.engine.state;
    if(origin==='front_deck'){
      await g.play('open left door');await g.play('nw');assert.equal(s.room,origin);
      await g.play('open right door');await g.play('close left door');
      assert.equal(s.hasFlag('front_deck_left_door_open'),false);
      assert.equal(s.hasFlag('front_deck_right_door_open'),true);
    }
    const response=await g.play(dir);
    assert.equal(s.room,'assembly_room');
    assert.match(response,/Two tiny eyes/);assert.match(response,/about to strike/);
    assert.equal(closetView(s).snake,'warning');
    const before=structuredClone(s.serialize());
    for(let i=0;i<100;i++){
      closetView(s);closetView(s.serialize());g.engine.rooms.assembly_room.exits(s);
    }
    assert.deepEqual(s.serialize(),before);
    const entered=await g.play('n');assert.match(entered,/hasty retreat/);
    assert.match(entered,/lurks just outside/);assert.equal(s.room,'closet');
    assert.equal(closetView(s).snake,'atDoor');assert.equal(s.dead,false);
  }
});
test('门内关门可避蛇，隔门看蛇、摸黑和撞上关闭的门均不消耗下一步',async()=>{
  const g=await start('se_room'),s=g.engine.state;
  await g.play('n');await g.play('n');await g.play('close door');
  assert.deepEqual(closetView(s),{doorOpen:false,frontOpen:false,lit:false,snake:'absent'});
  for(const [cmd,reply] of [['look',/too dark/],['examine door',/too dark/],['s',/is closed/],['out',/is closed/],['in',/as far as/],['w',/no exit/]]){
    const turn=s.turns;
    assert.match(await g.play(cmd),reply);
    assert.equal(s.turns,turn);assert.equal(s.room,'closet');assert.equal(s.dead,false);
  }
  await g.play('wait');await g.play('wait');
  const r=await restore(g);
  assert.deepEqual(closetView(r.engine.state),closetView(s));
  const open=await r.play('open door');
  assert.match(open,/lurks just outside/);assert.equal(closetView(r.engine.state).lit,true);
  assert.equal(closetView(r.engine.state).snake,'atDoor');
  await r.play('close door');assert.equal(r.engine.state.dead,false);
});
test('木片或真正亮起的灯在手中或橱内能照明，关门可看，放到门外就会暗下去',async()=>{
  const g=await start('nw_room'),s=g.engine.state;
  s.take('splinter');await g.play('e');await g.play('n');await g.play('close closet door');
  assert.equal(closetView(s).lit,true);assert.match(await g.play('look'),/single closed door/);
  assert.match(await g.play('examine snake'),/other side of the closet door/);
  await g.play('drop splinter');assert.equal(closetView(s).lit,true);
  s.moveItem('splinter','assembly_room');s.take('lantern');
  assert.equal(closetView(s).lit,false);s.setFlag('lantern_on');assert.equal(closetView(s).lit,true);
  s.drop('lantern');assert.equal(closetView(s).lit,true);
  s.moveItem('lantern','front_deck');assert.equal(closetView(s).lit,false);
});
test('敞开壁橱门的下一步可以关门；直接退出或耗回合逗留会挨咬，随后一次有效行动才终局',async()=>{
  for(const [input,room] of [['s','assembly_room'],['out','assembly_room'],['look','closet'],['wait','closet']]){
    const g=await start('front_deck');
    await g.play('open right door');await g.play('nw');await g.play('n');
    await g.play('close door');await g.play('open closet door');
    const r=await restore(g),s=r.engine.state;
    const bite=await r.play(input);assert.match(bite,/strikes your ankle/);
    assert.equal(s.room,room);assert.equal(s.dead,false);assert.equal(closetView(s).snake,'bitten');
    const wounded=await restore(r),v=wounded.engine.state;
    if(room==='assembly_room'){
      const count=v.turns;await wounded.play('in');assert.equal(v.turns,count);assert.equal(v.dead,false);
      assert.match(await wounded.play('s'),/throbbing fire in your ankle/);assert.equal(v.room,'se_room');
    } else assert.match(await wounded.play('close door'),/throbbing fire in your ankle/);
    assert.equal(v.dead,true);
  }
});
test('退往室外避开第一次威胁，重返相邻房仍有警告；从外侧关闭两扇门分别挡北和东',async()=>{
  const g=await start('front_deck'),s=g.engine.state;
  await g.play('open right door');await g.play('nw');
  await g.play('e');assert.equal(s.room,'front_deck');assert.equal(closetView(s).snake,'absent');
  assert.match(await g.play('nw'),/about to strike/);
  await g.play('close closet door');assert.equal(closetView(s).snake,'bitten');
  assert.equal(closetView(s).frontOpen,true);
  assert.equal(g.engine.currentRoom().exits(s).n.to,'assembly_room');
  assert.equal(g.engine.currentRoom().exits(s).e.to,'front_deck');
  assert.match(closetFreeResponse(s,g.engine.parser.parse('n')),/closet door is closed/);
  const other=await start('se_room');await other.play('n');
  assert.match(await other.play('e'),/front door is closed/);
  assert.equal(closetView(other.engine.state).snake,'warning');
  await other.play('n');assert.equal(other.engine.state.room,'closet');
});

test('两扇窗与胶带的原版反馈均先出现，随后结算观察用掉的一个回合',async()=>{
  for(const [cmd,text] of [
    ['examine window','The windows are closed and sealed with tape.'],
    ['look through window',"Little can be seen from where you're standing."],
    ['open window','The tape on the windows prevents this.'],
    ['examine tape',"You don't see anything unusual about the tape."],
  ]){
    const g=await start('se_room'),s=g.engine.state;
    await g.play('n');
    const turn=s.turns,items=structuredClone(s.itemLoc);
    const result=await g.play(cmd);
    assert.ok(result.startsWith(text),cmd);
    assert.match(result,/strikes your ankle/);
    assert.equal(s.turns,turn+1);
    assert.equal(s.room,'assembly_room');
    assert.equal(closetView(s).snake,'bitten');
    assert.deepEqual(s.itemLoc,items);
    assert.equal(s.dead,false);
    const bitten=s.turns;assert.match(await g.play('examine snake'),/isn.t here anymore/);
    assert.equal(s.turns,bitten);assert.equal(s.dead,false);
  }
});
