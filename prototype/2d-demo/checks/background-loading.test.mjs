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
