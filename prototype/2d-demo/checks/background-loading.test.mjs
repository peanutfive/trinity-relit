import test from 'node:test';
import assert from 'node:assert/strict';
const requests=[],images=[];
globalThis.Image=class{complete=false;naturalWidth=0;constructor(){images.push(this);}set src(value){this.url=value;requests.push(value);} };
const {ensureSceneArt,requestedSceneArt}=await import('../art.js');
test('背景只按进入房间请求，同图多面板复用；失败允许重试',async()=>{
 assert.deepEqual(requestedSceneArt(),[],'导入画面模块不应下载全部章节');
 const base=requests.length;
 const first=ensureSceneArt('palace_gate'),second=ensureSceneArt('broad_walk');
 assert.equal(first,second);assert.equal(requests.length,base+1);assert.equal(requestedSceneArt().length,1);
 const orbit=ensureSceneArt('orbit_satellite');assert.notEqual(first,orbit);assert.equal(requests.length,base+2);
 assert.ok(requests[base+1].endsWith('/assets/orbit-satellite-v1.png'));
 assert.equal(requests.some(src=>src.includes('arbor-top')),false);
 const failed=assert.rejects(orbit,/加载失败/);images.at(-1).onerror();await failed;
 assert.equal(requestedSceneArt().length,1);ensureSceneArt('orbit_satellite');assert.equal(requests.length,base+3);
 await assert.rejects(ensureSceneArt('unmade'),/尚未制作/);
});

test('读档、实时场景和过场快照按同一破损标志选择风车画面',async()=>{
  const before=requests.length;
  const room='under_windmill', flag='binoculars_broken';
  const broken=ensureSceneArt(room,{flags:[flag]});
  assert.equal(ensureSceneArt(room,{flags:new Set([flag])}),broken);
  assert.ok(requests.at(-1).endsWith('under_windmill-damaged-v1.png'));
  images.at(-1).onload();await broken;
  const intact=ensureSceneArt(room,{flags:new Set()});
  assert.ok(requests.at(-1).endsWith('under_windmill-v1.png'));
  images.at(-1).onload();await intact;
  assert.equal(ensureSceneArt(room),intact);
  assert.equal(requests.length,before+2);
});

test('后院从两侧进门或刷新都等两扇独立的门叶载入，缺图能单独重试',async()=>{
  const start=images.length;
  const first=ensureSceneArt('back_yard',{flags:['back_yard_screen_door_open']});
  const [base,...doors]=images.slice(start);
  assert.equal(doors.length,2);
  assert.notEqual(doors[0].url,doors[1].url);
  base.onload();doors[0].onload();
  const failure=assert.rejects(first,/加载失败/);
  doors[1].onerror();await failure;
  const next=ensureSceneArt('back_yard',{flags:new Set(['back_yard_iron_gate_open'])});
  assert.equal(images.length,start+4);
  assert.equal(images.at(-1).url,doors[1].url);
  images.at(-1).onload();
  assert.equal(await next,base);
});
