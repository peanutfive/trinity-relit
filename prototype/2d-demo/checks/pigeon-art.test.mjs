import test from 'node:test';import assert from 'node:assert/strict';
globalThis.Image=class{complete=true;naturalWidth=1536;};
const {pigeonGroundPose,renderPigeon}=await import('../pigeon-art.js');
test('staggered pigeons step with alternate feet, lower head and peck instead of rigid group bobbing',()=>{
 const phases=[0,2,2.4,3.2,3.7,4,5.2,6.5].map(t=>pigeonGroundPose(t,0));
 assert.ok(new Set(phases.map(p=>p.frame)).size>=4);
 assert.ok(new Set(Array.from({length:5},(_,i)=>pigeonGroundPose(2,i).frame)).size>=3,'flock must not move in lockstep');
 for(let t=0;t<8;t+=.05){const p=pigeonGroundPose(t,0);assert.ok(Math.abs(p.x)<=3.01);}
 const a=pigeonGroundPose(7.8-.0001,0),b=pigeonGroundPose(7.8,0);assert.ok(Math.abs(a.x-b.x)<.01,'walks return continuously to their anchor');
});
test('new airborne bird cycles wing silhouettes while grounded pecking stays grounded',()=>{
 const frames=new Set();
 for(const time of [0,.11,.21]){const calls=[],c={save(){},restore(){},translate(){},rotate(){},scale(){},drawImage(...a){calls.push(a);}};
  assert.equal(renderPigeon(c,{kind:'pigeon',x:100,y:100,visualOptions:{flying:true}},{},time),true);
  assert.ok(calls[0][0].src.endsWith('/assets/pigeon-poses-v3.png'));frames.add(calls[0][1]);}
 assert.equal(frames.size,3);
});
test('flock anchors do not place multiple pigeons on top of each other',async()=>{
 const {PIGEON_FLOCK}=await import('../pigeon-motion.js');
 assert.equal(PIGEON_FLOCK.length,5);
 for(let i=0;i<5;i++)for(let j=i+1;j<5;j++)assert.ok(Math.hypot(PIGEON_FLOCK[i][0]-PIGEON_FLOCK[j][0],PIGEON_FLOCK[i][1]-PIGEON_FLOCK[j][1])>12);
});
