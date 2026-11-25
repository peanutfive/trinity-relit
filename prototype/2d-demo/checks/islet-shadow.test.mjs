import assert from 'node:assert/strict';
import test from 'node:test';
import {createPrologueSession} from '../engine-adapter.js';
import {isletDoorView,vertexShadowView} from '../islet-shadow.js';
import {shackDoorOpen} from '../shack-story.js';
import {getHotspots} from '../interaction-catalog.js';
import {resolveInteraction} from '../interaction-intent.js';
import {pointerTarget} from '../interaction-targets.js';

function game() {
  const lines=[];
  const engine=createPrologueSession({ui:{text:t=>lines.push(t),system:t=>lines.push(t),location(){},inventory(){},userInput(){}}});
  return {engine,async input(raw){lines.length=0;await engine.processInput(raw);return lines.join('\n');}};
}

async function vertex() {
  const g=game();
  await g.engine.transitionChapter({to:'wabe',roomCandidates:['bottom_of_stairs']});
  await g.input('u');
  return g;
}

async function arrive(g) {
  // Cemetery acquisition and normal fare transfer have their own full-route tests.
  g.engine.state.wear('shroud');
  g.engine.state.take('silver_coin');
  for(const input of ['d','se','wait','wait','enter dory','give silver coin to oarsman','s'])await g.input(input);
  assert.equal(g.engine.state.room,'islet');
}

test('转环后立即压杆、迟一回合、迟十二回合会冻结在三个不同位置',async()=>{
  for(const [delay,where,open] of [[0,7,true],[1,7,false],[12,1,false]]) {
    const g=await vertex();
    await g.input('turn ring to sixth symbol');
    await g.input('turn ring to seventh symbol');
    for(let i=0;i<delay;i++)await g.input('look at watch');
    await g.input('push lever');
    const state=g.engine.state;
    assert.equal(vertexShadowView(state).symbol,where);
    assert.equal(isletDoorView(state).open,open);
    assert.equal(vertexShadowView(state).leverUp,false);
    const reading=await g.input('examine shadow');
    if(open) assert.match(reading,/exactly on the seventh/);
    if(delay===1) assert.match(reading,/a little after the seventh/);
    const again=game();
    await again.engine.deserialize(structuredClone(g.engine.serialize()));
    assert.deepEqual(vertexShadowView(again.engine.state),vertexShadowView(state));
    await arrive(again);
    if(!open) {
      assert.match(await again.input('enter door'),/door is closed/);
      assert.equal(again.engine.state.room,'islet');
      assert.equal(again.engine.state.hasFlag('islet_done'),false);
    }
  }
});

test('岛上连续观察运动的影尖，白门只在影尖掠过门洞的两个回合敞开',async()=>{
  const g=await vertex();
  await g.input('turn ring to seventh symbol');
  await arrive(g);
  const s=g.engine.state;
  assert.equal(vertexShadowView(s).leverUp,true);
  // Observe until the last move before the shadow comes into sight. All time
  // passes via normal input while the player stays beside the toadstool.
  for(let i=0;i<169;i++){
    const {sector,phase}=vertexShadowView(s);
    if(sector===11 && phase===12) break;
    await g.input('examine door');
  }
  const steps=[
    "can't see any",...Array(4).fill('southward, towards'), 'almost touching',
    'across the open door','across the open door',...Array(6).fill('southward, away'), "can't see any",
  ];
  for(const phrase of steps) {
    assert.equal(isletDoorView(s).open,phrase==='across the open door');
    assert.ok((await g.input('examine shadow')).includes(phrase),phrase);
    assert.equal(s.room,'islet');
  }
});

test('同一符号读数不能修正略过的影尖；用压下的杆转至六、七可修回开门',async()=>{
  const g=await vertex();
  const state=g.engine.state;
  await g.input('push lever');
  await g.input('turn ring to seventh symbol');
  assert.ok(isletDoorView(state).open);
  // The first raised move at degree 5 lands at 6; the next move reaches 7.
  await g.input('pull lever');await g.input('look at watch');await g.input('push lever');
  assert.equal(isletDoorView(state).near,true);
  await g.input('turn ring to seventh symbol');
  assert.equal(isletDoorView(state).open,false);
  await g.input('铜环转到第六个符号');await g.input('铜环转到第七个符号');
  assert.equal(vertexShadowView(state).dialIndex,6);
  assert.equal(isletDoorView(state).aligned,true);
  const at=getHotspots(state);const lever=at.find(x=>x.id==='vertex:lever');
  assert.equal(resolveInteraction(state,lever,{observed:new Set([lever.id]),heldItem:'coin'}),'pull lever');
  assert.equal(resolveInteraction(state,at.find(x=>x.id==='vertex:fixed-gnomon')),'examine shadow');
  await arrive(g);
  const island=getHotspots(state);
  assert.equal(pointerTarget(island,{x:362,y:149})?.id,'islet:shadow');
  assert.equal(pointerTarget(island,{x:363,y:135})?.id,'islet:gate');
  assert.match(await g.input('examine shadow'),/exactly on the open door/);
  assert.match(await g.input('examine door'),/open white door/);
  await g.input('in');
  assert.equal(state.room,'shack');
  assert.equal(state.chapter,'desert');
  assert.match(await g.input('examine book'),/DESERT ISLAND DECAMERON/);
  assert.equal(shackDoorOpen(state),true);
  assert.match(await g.input('e'),/slams shut/);
  assert.equal(state.room,'shack');
  assert.equal(shackDoorOpen(state.serialize()),false);
  const again=game();await again.engine.deserialize(structuredClone(g.engine.serialize()));
  assert.match(await again.input('open door'),/won't budge/);
  assert.match(await again.input('e'),/white door is closed/);
  assert.match(await again.input('out'),/Which way/);
  const route=[['w','tower_platform'],['d','tower_landing'],['d','base_of_tower'],['se','shallow_crater'],['nw','base_of_tower'],['u','tower_landing'],['u','tower_platform'],['e','shack']];
  for(const [direction,room] of route) {
    await again.input(direction);
    assert.equal(again.engine.state.room,room);
  }
});

test('跨过七到一再到二时，精确转盘在接近标记和已经经过标记时有不同反馈',async()=>{
  // Counts start just after the real turn to seven. A locked lever makes the
  // subsequent no-op observable without another ordinary move advancing it.
  const samples=[
    [0,'seventh',false],[6,'seventh',false],[7,'seventh',true],
    [8,'first',true],[11,'first',true],[12,'first',false],[20,'first',false],[32,'first',false],
    [33,'second',true],[37,'second',true],[38,'second',false],
  ];
  for(const [moves,mark,rotates] of samples) {
    const g=await vertex();
    await g.input('turn ring to seventh symbol');
    for(let i=0;i<moves;i++) await g.input('look at watch');
    await g.input('push lever');
    const s=g.engine.state, before=vertexShadowView(s);
    const reply=await g.input('turn ring to '+mark+' symbol');
    if(rotates) {
      assert.match(reply,/clicks into place/,moves+' '+mark);
      assert.equal(vertexShadowView(s).centered,true);
    } else {
      assert.match(reply,/already pointing/,moves+' '+mark);
      assert.deepEqual(vertexShadowView(s),before);
    }
    const next=s.sundialSymbol%7+1;
    assert.match(await g.input('turn ring'),/clicks into place/);
    assert.equal(s.sundialSymbol,next);
  }
});

test('影尖上线前已过河的正常岛档维持原浅坑入口，可一直前往牧场',async()=>{
  const old=game();
  await old.engine.transitionChapter({to:'islet',roomCandidates:['islet']});
  old.engine.state.setFlag('river_ferry_crossed');
  old.engine.state.setFlag('ferry_paid');
  const played=game();
  await played.engine.deserialize(old.engine.serialize());
  assert.equal(isletDoorView(played.engine.state).legacy,true);
  await played.input('enter door');
  assert.equal(played.engine.state.room,'shallow_crater');
  await played.input('se');
  assert.equal(played.engine.state.room,'nw_ranch');
});
