// Run directly for a fresh-title installation, disassembly, reload and real legacy import.
// The same controls are used by browser-smoke; chapter fixtures use normal engine commands.
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { access } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const mirrorLoop = [
  ['d','bottom_of_stairs','vertex:stairs'], ['s','trellises'],
  ['u','top_of_arbor','trellises:ascent'], ['n','north_arbor'],
  ['s','top_of_arbor'], ['d','trellises','top_of_arbor:descent'],
  ['n','bottom_of_stairs'], ['u','vertex','bottom_of_stairs:stairs'],
];

export async function fitGnomonFixture(engine) {
  const s=engine.state;
  assert.equal(s.room,'vertex');
  assert.ok(s.has('gnomon'),'序章过门的同一枚指针必须随身');
  assert.equal(s.flipped,false);
  const score=s.score;
  await engine.processInput('put gnomon in hole');
  assert.ok(s.carrying('gnomon'),'右旋孔不接受原有的左旋指针');
  assert.equal(s.score,score);
  async function crossArbor() {
    for(const [command,room] of mirrorLoop) {
      await engine.processInput(command);
      assert.equal(s.room,room,command);
    }
  }
  await crossArbor();
  assert.equal(s.flipped,true);
  await engine.processInput('put gnomon in hole');
  assert.equal(s.has('gnomon'),false);
  assert.equal(s.score,score+5);
  // Downstream routes have measured entrances in the original orientation.
  await crossArbor();
  assert.equal(s.flipped,false);
  assert.equal(s.has('gnomon'),false);
}

export async function checkInstalledPointer({state,drain,hold,clearHand,perform,walk,saveAndResume,screenshot},extended) {
  const get=async id=>(await state()).objects.find(o=>o.id===id);
  const hole='vertex:hole', fixed='vertex:fixed-gnomon', loose='vertex:dial-gnomon';
  const install='put gnomon in hole';
  const click=async (id,command,input)=>{await perform(command,{objectId:id,input});await drain();};
  async function mirror() {
    for(const [dir,room,hotspot] of mirrorLoop){
      if(hotspot)await click(hotspot,dir); else await walk(dir,room);
      assert.equal((await state()).room,room);
    }
  }
  async function carryPointer(){
    await clearHand();
    await hold('gnomon','日晷指针');
  }
  const before=await state(),base=before.score;
  assert.ok(before.inventory.includes('gnomon'));
  assert.equal(before.flipped,false);
  assert.ok(await get(hole));
  assert.ok(!(await get('vertex:lever')));
  assert.ok(!(await get(fixed)));
  await clearHand();
  await click(hole,'examine hole');
  if(extended)await click(hole,'examine hole','F');
  await carryPointer();
  await click(hole,install,'F');
  assert.ok((await state()).inventory.includes('gnomon'));
  assert.equal((await state()).score,base);
  await screenshot('vertex-threads-mismatch');
  if(extended)await saveAndResume('vertex-mismatched');
  await clearHand();
  await mirror();
  assert.equal((await state()).flipped,true);
  await click(hole,'examine hole');
  await carryPointer();
  await click(hole,install,'F');
  assert.equal((await state()).score,base+5);
  assert.ok(!(await state()).inventory.includes('gnomon'));
  assert.ok(await get('vertex:lever'));
  assert.ok(await get(fixed));
  assert.ok(!(await get(hole)));
  await screenshot('vertex-installed');
  if(extended){
    await saveAndResume('vertex-installed');
    await clearHand();
    await click(fixed,'unscrew gnomon');
    assert.ok(await get(loose));
    assert.ok(await get(hole));
    assert.ok(!(await get('vertex:lever')));
    assert.ok(!(await state()).inventory.includes('gnomon'));
    await screenshot('vertex-on-dial');
    await saveAndResume('vertex-on-dial');
    assert.ok(await get(loose));
    await click(loose,'take gnomon');
    assert.equal((await state()).inventory.filter(id=>id==='gnomon').length,1);
    assert.ok(!(await get(loose)));
    await carryPointer();
    await click(hole,install);
    assert.equal((await state()).score,base+5);
    assert.ok(await get(fixed));
    assert.ok(!(await state()).inventory.includes('gnomon'));
  }
  await clearHand();
  await mirror();
  assert.equal((await state()).flipped,false);
  assert.ok(await get(fixed));
}

if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const dir=dirname(fileURLToPath(import.meta.url));
  const legacy=process.env.LEGACY_VERTEX_SAVE || join(dir,'../../../artifacts/agent-team/evidence/t34-windmill-final/normal-route/fresh-prologue/hd2d-export.json');
  await access(legacy);
  const {stdout}=await promisify(execFile)(process.execPath,[join(dir,'browser-smoke.mjs'),'--vertex-regression'],{
    env:{...process.env,LEGACY_VERTEX_SAVE:legacy},maxBuffer:8*1024*1024,
  });
  process.stdout.write(stdout);
}
