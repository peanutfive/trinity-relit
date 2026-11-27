import assert from 'node:assert/strict';
import test from 'node:test';
import {GameEngine} from '../../js/engine.js';
import {Parser} from '../../js/parser.js';
import {ITEMS} from '../../js/data/items.js';
import {ROOMS} from '../../js/data/wabe.js';
import {arborLight} from '../arbor-light-state.js';
import {bogLogView, freeBogAction, initializeBogLog, parseBogAction, restoreBogLog, withBogLog} from '../bog-log-story.js';

function bog() {
  const lines=[];
  const room=withBogLog(ROOMS.south_bog),parser=new Parser();
  const engine=new GameEngine({rooms:{south_bog:room},items:ITEMS,parser,preloadedChapters:['wabe'],
    ui:{text:t=>lines.push(t),system:t=>lines.push(t),location(){},inventory(){},userInput(){}}});
  const s=engine.state;
  initializeBogLog(s);s.chapter='wabe';engine.moveTo('south_bog');
  return {s,engine,room,async act(input){
    lines.length=0;
    const command=parser.parse(input) || parseBogAction(input);
    assert.ok(command,input);
    const refusal=freeBogAction(s,command);
    if (refusal) return refusal;
    assert.ok(await engine._runCommandTurn(command),input);
    return lines.join('\n');
  }};
}

test('初见朽木时木片还不可见；查看和轻触各过一回合，猜木片、猜堆均免费',async()=>{
  for(const [look,touch] of [['examine log','touch log'],['观察圆木','摸摸朽木']]) {
    const g=bog(),s=g.s;
    assert.deepEqual(bogLogView(s.serialize()),{intact:true,crumbled:false,looseSplinter:false});
    assert.equal(arborLight(s),null);assert.ok(!s.roomItems().includes('splinter'));
    assert.match(g.room.desc(s),/stream that wanders west and southeast/);
    assert.match(g.room.desc(s),/A splintered log lies rotting/);
    const initial=s.turns;
    assert.match(await g.act(look),/Its edges flicker/);
    assert.match(await g.act(touch),/old and squishy/);
    assert.equal(s.turns,initial+2);
    const previous=s.serialize();
    for(const command of ['take splinter','examine splinter','take splinter from log']) {
      assert.match(await g.act(command),/can't see any splinter here/);
    }
    assert.match(await g.act('examine heap'),/can't see any heap here/);
    assert.deepEqual(s.serialize(),previous);
  }
});

test('移动才露出唯一木片，满手无法得分；拾起一分、放下重取不重奖，朽堆不产新物',async()=>{
  for (const move of ['move log','take log','pull log','push log','搬动朽木']) {
    const g=bog(),s=g.s;
    s.score=15;
    assert.match(await g.act(move),/crumbles into a heap of damp corruption/);
    assert.equal(s.score,15);assert.equal(s.turns,1);
    assert.deepEqual(bogLogView(s),{intact:false,crumbled:true,looseSplinter:true});
    assert.match(g.room.desc(s),/a splinter \(providing light\) here/);
    assert.doesNotMatch(g.room.desc(s),/log lies rotting/);
    const previous=s.serialize();
    assert.match(await g.act('examine log'),/All that's left of the log/);
    assert.match(await g.act('take log'),/All that's left of the log/);
    assert.deepEqual(s.serialize(),previous);
    assert.match(await g.act('examine heap'),/heap of damp corruption/);
    assert.match(await g.act('examine splinter'),/about a foot long/);
    assert.match(await g.act('take splinter from log'),/isn't in the heap/);
    assert.equal(s.itemAt('splinter'),'south_bog');
    const ballast=Array.from({length:8},(_,i)=>'carried_'+i);
    for (const id of ballast) s.take(id);
    assert.match(await g.act('take splinter'),/holding too much/);
    assert.equal(s.itemAt('splinter'),'south_bog');assert.equal(s.score,15);
    for (const id of ballast) s.drop(id);
    assert.match(await g.act('take splinter'),/score just went up by 1 point/);
    assert.equal(s.score,16);assert.equal(s.itemAt('splinter'),'inventory');assert.equal(arborLight(s),'splinter');
    assert.equal(s.roomItems().filter(id=>id==='splinter').length,0);
    assert.doesNotMatch(g.room.desc(s),/a splinter \(providing light\)/);
    assert.match(await g.act('take splinter'),/already holding the splinter/);
    await g.act('drop splinter');assert.deepEqual(bogLogView(s),{intact:false,crumbled:true,looseSplinter:true});
    assert.match(await g.act('take splinter'),/pick up the splinter/);
    assert.equal(s.score,16);
  }
});

test('旧档已取得、异地放置、销毁或留在沼泽时保留当时的位置与分数；未访过才从完整朽木开始',async()=>{
  const g=bog();
  for (const [visited,oldLocation,expected] of [
    [false,'south_bog','bog_rotten_log'],[false,'inventory','inventory'],
    [true,'south_bog','south_bog'],[true,'inventory','inventory'],[true,'underwater','underwater'],
    [true,'cupboard','cupboard'],[true,'top_of_arbor','top_of_arbor'],[true,'destroyed','destroyed'],
    [true,undefined,undefined],[false,undefined,'bog_rotten_log']
  ]) {
    const h=bog(),s=h.s;
    s.flags.clear();s.visited.clear();if(visited)s.visited.add('south_bog');
    s.score=26;const saved=s.serialize();
    if(oldLocation===undefined) {
      delete saved.itemLoc.splinter;
      s.placeItem('splinter','south_bog'); // mirror the shared reader's starting-location backfill
    } else {
      saved.itemLoc.splinter=oldLocation;s.placeItem('splinter',oldLocation);
    }
    restoreBogLog(s,saved);
    assert.equal(s.itemAt('splinter'),expected);
    const after=s.serialize();restoreBogLog(s,after);assert.deepEqual(s.serialize(),after);
    if(expected==='south_bog') { await h.act('take splinter');assert.equal(s.itemAt('splinter'),'inventory'); }
    assert.equal(s.score,26);
  }
  const before=g.s.serialize();initializeBogLog(g.s);
  assert.deepEqual(g.s.serialize(),before);
});

test('完整朽木、刚碎开和拾后放回三份新档恢复后，可继续且仅首取加分',async()=>{
  const original=bog(),packets=[];
  packets.push(original.engine.serialize());
  await original.act('move log');packets.push(original.engine.serialize());
  await original.act('take splinter');await original.act('drop splinter');packets.push(original.engine.serialize());
  for (const [index,packet] of packets.entries()) {
    const restored=bog();
    await restored.engine.deserialize(packet);
    const s=restored.engine.state;restoreBogLog(s,packet.state);
    assert.deepEqual(s.serialize(),packet.state);
    if(index===0) await restored.engine._runCommandTurn(parseBogAction('move log'));
    await restored.engine._runCommandTurn({type:'simple',verb:'take',noun:'splinter'});
    assert.equal(s.itemAt('splinter'),'inventory');assert.equal(s.score,1);
  }
});
