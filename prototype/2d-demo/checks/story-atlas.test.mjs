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

test('standing umbrella actor uses six distinct cells and preserves body scale after losing her umbrella', () => {
  const actions=[{action:'hold'},{action:'released',umbrella:false},{action:'wipe'},
    {action:'kick'},{action:'leave',progress:0},{action:'leave',progress:.15}];
  const draws=actions.map(visualOptions=>{
    const calls=[],context={save(){},restore(){},drawImage(...args){calls.push(args);}};
    assert.equal(renderStorySprite(context,{kind:'umbrella_woman',x:165,y:155,visualOptions},{},0),true);
    assert.equal(calls.length,1,'free umbrella must not be baked into empty-handed poses');
    assert.ok(calls[0][0].src.endsWith('/assets/umbrella-woman-poses-v2.png'));
    return calls[0];
  });
  assert.equal(new Set(draws.map(draw=>`${draw[1]}:${draw[2]}`)).size,6);
  assert.equal(new Set(draws.map(draw=>draw[7]/draw[3])).size,1,'body scale stays constant even though the open pose has a canopy above the head');
});
