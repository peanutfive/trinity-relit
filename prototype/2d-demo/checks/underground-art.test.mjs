import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
globalThis.Image=class{complete=true;naturalWidth=1983;};
const {renderUndergroundSprite,UG_PROP_REGIONS,undergroundLighting}=await import('../underground-art.js');
test('八个背景与原始透明物件图集保存完整提示，取样在PNG边界内',async()=>{
 for(const name of ['bluff','cottage','cemetery','barrow','ossuary','ug-entry','ug-middle','ug-inner']){
  const version=name==='ossuary'?'v2':'v1';
  const b=await readFile(new URL(`../assets/${name}-${version}.png`,import.meta.url));assert.equal(b.readUInt32BE(16),1619);assert.equal(b.readUInt32BE(20),name==='cemetery'?972:971);assert.ok((await readFile(new URL(`../assets/${name}-${version}.prompt.txt`,import.meta.url),'utf8')).length>500);assert.ok(await readFile(new URL(`../assets/${name}-${version}.route-layout.svg`,import.meta.url)));
 }
 const b=await readFile(new URL('../assets/ug-props-v1.png',import.meta.url));assert.equal(b[25],6);const w=b.readUInt32BE(16),h=b.readUInt32BE(20);
 for(const [x,y,rw,rh]of Object.values(UG_PROP_REGIONS))assert.ok(x>=0&&y>=0&&x+rw<=w&&y+rh<=h);
});
test('灯笼开灭取样、可移动物件尺寸和光源查询保持只读',()=>{
 const calls=[],c={drawImage(...a){calls.push(a);}},s={itemLoc:{lantern:'inventory'},flags:[]},before=JSON.stringify(s);
 assert.deepEqual(undergroundLighting(s),{lantern:false,splinter:false});renderUndergroundSprite(c,{kind:'lantern',x:180,y:190},s);assert.equal(calls[0][1],UG_PROP_REGIONS.lantern[0]);assert.equal(calls[0].at(-1),19);assert.equal(JSON.stringify(s),before);
 s.flags=['lantern_on'];assert.ok(undergroundLighting(s).lantern);renderUndergroundSprite(c,{kind:'lantern',x:350,y:173,visualOptions:{drawAt:{x:350,y:128}}},s);assert.equal(calls[1][1],UG_PROP_REGIONS.lit[0]);assert.equal(calls[1][6],109,'灯笼在圆筒口绘制，不强迫人物脚点移到筒顶');
 renderUndergroundSprite(c,{kind:'soap_bubble',x:307,y:210},s);assert.equal(calls[2].at(-1),19);
});
