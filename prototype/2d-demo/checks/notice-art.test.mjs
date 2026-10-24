import test from 'node:test';import assert from 'node:assert/strict';
import {createPrologueSession} from '../engine-adapter.js';import {getHotspots} from '../interaction-catalog.js';
globalThis.Image=class{complete=true;naturalWidth=1024;};const {renderNotice}=await import('../notice-art.js');
test('painted notice only replaces the actual lawn notice; memorial is the distant building',async()=>{
 const calls=[],c={save(){},restore(){},beginPath(){},ellipse(){},fill(){},drawImage(...x){calls.push(x);}};
 assert.equal(renderNotice(c,{id:'lancaster_walk:notice',x:315,y:170}),true);
 assert.ok(calls[0][0].src.endsWith('/assets/notice-v2.png'));
 for(const id of ['flower_walk:memorial','palace_gate:self'])assert.equal(renderNotice(c,{id,x:1,y:1}),false);
 const e=createPrologueSession();await e.processInput('e');const memorial=getHotspots(e.state).find(o=>o.id==='flower_walk:memorial');
 assert.equal(memorial.baked,true);assert.equal(memorial.kind,'memorial');assert.ok(memorial.y<100);assert.ok(memorial.radius>100);
 assert.ok(e.rooms.flower_walk.events.some(event=>event.id===memorial.eventId));
});
