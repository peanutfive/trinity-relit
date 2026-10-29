import test from 'node:test';import assert from 'node:assert/strict';
import {filterVisualPresence,VISUAL_PRESENCE_RULES} from '../visual-text-policy.js';
import {createPrologueSession} from '../engine-adapter.js';import {getHotspots} from '../interaction-catalog.js';import {ITEMS} from '../../js/data/items.js';
import {SCENES} from '../scene-manifest.js';
test('visible football remains in scene but its automatic flower presence is suppressed in both languages',async()=>{
 const e=createPrologueSession();await e.processInput('e');const before=e.state.serialize();
 const original=e.rooms.flower_walk.desc(e.state),objects=getHotspots(e.state);
 assert.ok(objects.some(o=>o.kind==='ball'));
 const view=filterVisualPresence(original,{room:'flower_walk',objects,source:'room'});
 assert.ok(view.removed.includes('ball-in-flowers'));assert.ok(!view.text.includes('soccer ball'));assert.ok(!view.text.includes('足球'));
 assert.ok(view.text.includes('Albert Memorial'));assert.deepEqual(e.state.serialize(),before);
 assert.equal(filterVisualPresence(ITEMS.ball.roomDesc,{room:'flower_walk',objects,source:'item-annotation'}).text,'');
 assert.equal(filterVisualPresence(ITEMS.ball.roomDesc,{room:'meadow',objects,source:'item-annotation'}).text,'','a dropped ball must not acquire the old blossom reminder elsewhere');
});
test('explicit inspection and narrative are retained, even if the exact same sentence occurs there',()=>{
 for(const r of VISUAL_PRESENCE_RULES){const text=r.paragraphs.join('\n\n');assert.equal(filterVisualPresence(text,{room:r.rooms[0],objects:[{kind:r.kinds[0]}],source:'event'}).text,text);}
});
test('absence, hidden props and other rooms do not suppress a clue that the player cannot see',()=>{
 const text=ITEMS.ball.roomDesc;
 for(const objects of [[],[{kind:'ball',visual:false}]])assert.equal(filterVisualPresence(text,{room:'flower_walk',objects,source:'room'}).removed.length,0);
 assert.equal(filterVisualPresence(text,{room:'broad_walk',objects:[{kind:'ball'}],source:'room'}).removed.length,0);
});
test('curated presence removals leave original auditory, transformation and inscription clues intact',()=>{
 const text='Her voice quavers with heartbreak.\n\nLong Water, Four O’Clock\n\nTEMPUS EDAX RERUM\n\n那白色的帆其实是翅膀。';
 assert.equal(filterVisualPresence(text,{room:'round_pond',objects:[{kind:'paper_bird'}],source:'room'}).text,text);
 for(const r of VISUAL_PRESENCE_RULES){const result=filterVisualPresence(r.paragraphs.join('\n\n'),{room:r.rooms[0],objects:[{kind:r.kinds[0]}],source:'room'});assert.equal(result.text,'',r.id);assert.deepEqual(result.removed,[r.id]);}
});
test('every marked removal still matches actual chapter wording and an actual visible object',async()=>{
 for(const r of VISUAL_PRESENCE_RULES){
  const e=createPrologueSession(),chapter=SCENES[r.rooms[0]].chapter;if(chapter!=='prologue'){await e.activateChapter(chapter);e.state.chapter=chapter;}
  if(r.rooms[0]==='shelter'){await e.activateChapter('japan');e.state.chapter='japan';e.state.setFlag('umbrella_given_to_girl');e.state.placeItem('spade','shelter');}
  e.state.room=r.rooms[0];
  if(r.id==='ruby-at-feet'){e.state.setFlag('ruby_visible');e.state.placeItem('ruby','broad_walk');}
  if(r.id==='parked-pram')e.state.setFlag('pram_at_walk');
  if(r.id==='umbrella-in-tree'){e.state.setFlag('umbrella_woman_done');e.state.placeItem('umbrella','lancaster_gate_tree');}
  if(r.id==='ball-on-ground')e.state.placeItem('ball','lancaster_gate');
  if(r.id==='loose-gnomon')e.state.setFlag('gnomon_unscrewed');
  const original=e.rooms[e.state.room].desc(e.state),objects=getHotspots(e.state);
  for(const paragraph of r.paragraphs)assert.ok(original.includes(paragraph),`${r.id}: chapter wording changed`);
  assert.ok(filterVisualPresence(original,{room:e.state.room,objects,source:'room'}).removed.includes(r.id),`${r.id}: visible target missing`);
 }
});
