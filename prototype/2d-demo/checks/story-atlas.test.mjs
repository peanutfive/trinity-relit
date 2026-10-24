import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

globalThis.Image = class { complete = true; naturalWidth = 1536; };
const { renderStorySprite } = await import('../story-atlas.js');
function drawBoy(pose,time=0) {
  const draws=[];
  const context={ save(){},restore(){},drawImage(...args){draws.push(args);} };
  assert.equal(renderStorySprite(context,{kind:'boy',x:300,y:145,visualOptions:{pose}},{},time),true);
  assert.equal(draws.length,1);
  return draws[0];
}

test('bubble actions draw distinct new painted poses with a stable anatomical scale', () => {
  const poses=['dip','blow','admire','startled'].map(pose=>drawBoy(pose));
  assert.ok(poses.every(draw=>draw[0].src.endsWith('/assets/boy-poses-v2.png')));
  assert.equal(new Set(poses.map(draw=>draw[1])).size,4,'actions must not all reuse the same static illustration');
  assert.equal(new Set(poses.map(draw=>draw[7]/draw[3])).size,1,'rising must not rescale the child');
  assert.deepEqual(drawBoy('dip',0),drawBoy('dip',10),'the renderer must not independently advance the narrative pose');
});

test('new transparent sprite file has the canvas dimensions required by pose cells', async () => {
  for(const file of ['boy-poses-v2.png','umbrella-woman-poses-v2.png']) {
    const bytes=await readFile(new URL(`../assets/${file}`,import.meta.url));
    assert.equal(bytes.subarray(1,4).toString(),'PNG');
    assert.equal(bytes.readUInt32BE(16),1536);
    assert.equal(bytes.readUInt32BE(20),1024);
    assert.equal(bytes[25],6,'RGBA transparency is retained in the shipped asset');
  }
});

test('new standing body frames carry a separate umbrella through the opening action', async () => {
  const {BODY_POSES}=await import('../umbrella-motion.js');
  const draws=['prepare','raise','open','hold','brace','released','look_up','wipe','kick'].map(action=>{
    const calls=[],context={save(){},restore(){},translate(){},rotate(){},scale(){},drawImage(...args){calls.push(args);}};
    assert.equal(renderStorySprite(context,{kind:'umbrella_woman',x:194,y:159,visualOptions:{action,umbrella:false}},{},0),true);
    assert.equal(calls.length,1,'empty human pose must contain no second umbrella');
    assert.ok(calls[0][0].src.endsWith('/assets/umbrella-motion-v3.png'));
    return calls[0];
  });
  assert.equal(new Set(draws.map(d=>`${d[1]}:${d[2]}`)).size,9);
  for(let i=0;i<draws.length;i++) {
    const d=draws[i],p=BODY_POSES[i],scale=d[8]/d[4];
    assert.ok(Math.abs((p.foot[1]-p.head)*scale-33)<.01,'human head-to-foot height stays33 even when hands rise above head');
  }
});
