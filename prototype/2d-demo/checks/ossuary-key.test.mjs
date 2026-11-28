import test from 'node:test';
import assert from 'node:assert/strict';
import {createPrologueSession} from '../engine-adapter.js';
import {ossuaryKeyView} from '../ossuary-key.js';
import {getHotspots} from '../interaction-catalog.js';
import {resolveInteraction} from '../interaction-intent.js';
import {nearbyTarget,pointerTarget} from '../interaction-targets.js';
import {SCENES} from '../scene-manifest.js';
import {findPath} from '../world.js';

function session() {
  const lines=[];
  const game=createPrologueSession({ui:{text:t=>lines.push(t),system:t=>lines.push(t),location(){},inventory(){},userInput(){}}});
  return {game,async use(cmd,reply,moves,points=0) {
    const {score,turns}=game.state;
    lines.length=0;
    await game.processInput(cmd);
    assert.match(lines.join('\n'),reply,cmd);
    assert.equal(game.state.turns,turns+moves,cmd);
    assert.equal(game.state.score,score+points,cmd);
  }};
}

async function inside() {
  const play=session(),g=play.game;
  await g.transitionChapter({to:'wabe',roomCandidates:['south_bog']});
  for(const cmd of ['move log','take splinter','w','n','n','in'])await g.processInput(cmd);
  assert.equal(g.state.room,'ossuary');
  return play;
}

const visibleKey=g=>getHotspots(g.state).filter(o=>o.itemId==='key_barrow');
test('从瀑布上崖入纳骨堂，观察骸骨不会发现钥匙，翻找使同一把钥匙显现并可存读',async()=>{
  const {game,use}=await inside();
  const {state}=game;
  assert.equal(visibleKey(game).length,0);
  await use('examine key',/can.t see any key here/,0);
  const bone=nearbyTarget(getHotspots(state),{x:145,y:152,face:'up'});
  assert.equal(bone.id,'ossuary:bones');
  assert.equal(resolveInteraction(state,bone),'examine bones');
  await use('examine bones',/bleached white/,1);
  await use('take skeleton key',/can.t see any skeleton key here/,0);
  assert.equal(visibleKey(game).length,0);
  assert.equal(resolveInteraction(state,bone,{observed:new Set([bone.id])}),'search bones');
  await use('翻找骸骨',/clutched in a long-dead hand/,1);
  await use('search bones',/Further sifting/,1);
  const resumed=session();
  await resumed.game.deserialize(game.serialize());
  for(const g of [game,resumed.game]){
    const before=g.state.serialize();
    assert.deepEqual(ossuaryKeyView(before),{handExposed:true,inFingers:true});
    const [item]=visibleKey(g);
    assert.equal(item.id,'ossuary:skeleton-key');
    assert.equal(pointerTarget(getHotspots(g.state),item.visualOptions.drawAt).id,item.id);
    assert.equal(nearbyTarget(getHotspots(g.state),{x:169,y:157,face:'left'}).id,item.id);
    assert.deepEqual(findPath(SCENES.ossuary,SCENES.ossuary.spawn,[item.x,item.y]).at(-1),[item.x,item.y]);
    assert.equal(resolveInteraction(g.state,item),'examine key');
    assert.equal(resolveInteraction(g.state,item,{observed:new Set([item.id])}),'take key');
    assert.deepEqual(g.state.serialize(),before);
  }
  await resumed.use('examine key',/crooked finger/,1);
  await resumed.use('take key',/gently pry/,1,1);
  await resumed.use('take key',/already holding/,1);
  assert.deepEqual(ossuaryKeyView(resumed.game.state),{handExposed:true,inFingers:false});
  assert.equal(visibleKey(resumed.game).length,0);
  assert.equal(getHotspots(resumed.game.state).find(o=>o.id===bone.id).visualOptions.handExposed,true);
  await resumed.use('put key in pocket',/in your pocket/,1);
  await resumed.use('examine key',/out of your pocket first/,1);
  await resumed.use('take key',/out of your pocket/,1);
  await resumed.use('drop key',/drop the skeleton key/,1);
  const ground=session();
  await ground.game.deserialize(resumed.game.serialize());
  assert.equal(visibleKey(ground.game).length,1);
  assert.equal(visibleKey(ground.game)[0].id,'ug:item:key_barrow');
  await ground.use('look under the bones',/Further sifting/,1);
  await ground.use('take skeleton key',/take the skeleton key/,1);
  await ground.game.processInput('out');
  assert.equal(ground.game.state.room,'barrow');
  await ground.game.processInput('put key in hole');
  assert.equal(ground.game.state.itemAt('key_barrow'),'inventory');
  assert.equal(ground.game.state.hasFlag('barrow_door_unlocked'),false);
  assert.ok(!getHotspots(ground.game.state).some(o=>o.actions.some(a=>a.command==='put key in hole')));
});

test('手满可以在原处腾出手再取；明确取骨头也是搜索，不会把骨骸带走',async()=>{
  const {game,use}=await inside();
  await use('take bones',/catches your eye/,1);
  for(const id of ['gnomon','watch','paper_bird','spade','shroud','bandage','silver_coin','ruby'])game.state.take(id);
  await use('take key',/holding too much/,1);
  assert.equal(ossuaryKeyView(game.state).inFingers,true);
  for(const id of ['spade','shroud','bandage'])game.state.drop(id);
  await use('take key',/gently pry/,1,1);
});

test('旧档中已经可见、拿走、收好或销毁的钥匙维持原物位；未到纳骨堂的旧档能进行完整发现',async()=>{
  const base=(await inside()).game.serialize();
  for(const [location,visited,expected] of [
    ['ossuary',false,'ossuary_fingers'],['ossuary',true,'ossuary'],['inventory',true,'inventory'],
    ['pocket',true,'pocket'],['kitchen',true,'kitchen'],['cupboard',true,'cupboard'],['destroyed',true,'destroyed'],
    [null,true,null],
  ]) {
    const copy=structuredClone(base);
    copy.state.flags=copy.state.flags.filter(n=>n!=='ossuary_key_rules');
    if(!visited){
      copy.state.room='cemetery';
      copy.state.visited=copy.state.visited.filter(r=>r!=='ossuary');
    }
    if(location)copy.state.itemLoc.key_barrow=location;
    else delete copy.state.itemLoc.key_barrow;
    const run=session();await run.game.deserialize(copy);
    const s=run.game.state;
    assert.equal(s.itemAt('key_barrow')??null,expected);
    assert.equal(s.score,copy.state.score);
    if(!visited){await run.game.processInput('n');await run.game.processInput('in');}
    await run.use('search bones',visited?/Further sifting/:/catches your eye/,1);
    assert.equal(ossuaryKeyView(s).inFingers,!visited);
    if(!visited)await run.use('take key',/gently pry/,1,1);
    if(location==='ossuary' && visited)await run.use('take key',/take the skeleton key/,1);
  }
});
