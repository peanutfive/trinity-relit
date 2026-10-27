import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
globalThis.Image=class{complete=true;naturalWidth=1536;};
const {renderJapanSprite}=await import('../japan-art.js');
function draws(object,state={chapter:'japan'}){
 const calls=[],c=new Proxy({globalAlpha:1,drawImage(...args){calls.push(args);}},{get:(t,k)=>k in t?t[k]:()=>{},set:(t,k,v)=>(t[k]=v,true)});
 assert.equal(renderJapanSprite(c,{x:250,y:160,...object},state,0),true);return calls;
}
test('实际Japan演员与道具PNG保留透明通道，坐姿、站姿、步态使用独立源画',async()=>{
 for(const [file,w,h]of [['japan-actors-v1.png',1448,1086],['japan-props-v1.png',1536,1024]]){
  const b=await readFile(new URL(`../assets/${file}`,import.meta.url));assert.equal(b.readUInt32BE(16),w);assert.equal(b.readUInt32BE(20),h);assert.equal(b[25],6);
 }
 const frames=[0,3,4,7,8,9].map(frame=>draws({kind:'japan_girl',visualOptions:{frame}})[0]);
 assert.equal(new Set(frames.map(d=>`${d[1]},${d[2]}`)).size,6);
 assert.equal(new Set(frames.map(d=>d[7]/d[3])).size,1,'座姿不能通过放大贴图维持站姿高度');
 const a=draws({kind:'japan_girl',visualOptions:{walking:true,distance:1}}),b=draws({kind:'japan_girl',visualOptions:{walking:true,distance:8}});assert.notEqual(a[0][1],b[0][1]);
});
test('同一蘑菇有闭合和开启源画，纸张折叠状态来自引擎，女孩持伞附着独立道具',()=>{
 const a=draws({kind:'mushroom_gate',visualOptions:{open:false}}),b=draws({kind:'mushroom_gate',visualOptions:{open:true}});assert.notEqual(a[0][1],b[0][1]);
 const folded=draws({kind:'paper_bird'},{chapter:'japan',hasFlag:()=>false}),open=draws({kind:'paper_bird'},{chapter:'japan',hasFlag:()=>true});assert.notEqual(folded[0][1],open[0][1]);
 const holding=draws({kind:'japan_girl',visualOptions:{umbrella:true}});assert.equal(holding.length,2);assert.ok(holding[0][0].src.endsWith('japan-actors-v1.png'));assert.ok(holding[1][0].src.endsWith('umbrella-motion-v3.png'));
});
