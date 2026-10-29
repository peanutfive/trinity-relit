import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
globalThis.Image=class{complete=true;naturalWidth=1916;};
const {renderCliffSprite,CLIFF_PROP_REGIONS}=await import('../cliff-art.js');
const draws=(object,time=0)=>{
 const calls=[],c=new Proxy({globalAlpha:1,drawImage(...args){calls.push(args);}},{get:(t,k)=>k in t?t[k]:()=>{},set:(t,k,v)=>(t[k]=v,true)});
 assert.equal(renderCliffSprite(c,{x:286,y:220,...object},{chapter:'wabe'},time),true);return calls;
};
test('五张原始背景保留独立5:3全幅与实际提示，透明物件图集用实际边界取样',async()=>{
 for(const name of ['under-cliff-v1','ice-cavern-v1','craters-edge-v1','crater-v1','bottom-of-stairs-v2']){
  const b=await readFile(new URL(`../assets/${name}.png`,import.meta.url));assert.equal(b.readUInt32BE(16),1619);assert.equal(b.readUInt32BE(20),971);
  assert.ok((await readFile(new URL(`../assets/${name}.prompt.txt`,import.meta.url),'utf8')).length>500);
 }
 const sheet=await readFile(new URL('../assets/cliff-props-v1.png',import.meta.url));assert.equal(sheet.readUInt32BE(16),1916);assert.equal(sheet.readUInt32BE(20),821);assert.equal(sheet[25],6);
 for(const [x,y,w,h]of Object.values(CLIFF_PROP_REGIONS))assert.ok(x>=0&&y>=0&&x+w<=1916&&y+h<=821);
});
test('蜂巢悬挂在独立绘制点，蜂群错峰摆翼；金属保持地面尺寸而非巨型奖励',()=>{
 const hive=draws({kind:'cliff_hive',visualOptions:{drawAt:{x:340,y:117}}});assert.equal(hive.length,1);assert.equal(hive[0][7],34);assert.equal(hive[0][8],44);
 const a=draws({kind:'cliff_bees'},0),b=draws({kind:'cliff_bees'},.31);assert.equal(a.length,7);assert.equal(b.length,7);assert.ok(a.some((v,i)=>v[2]!==b[i][2]));
 const metal=draws({kind:'cliff_metal'});assert.equal(metal.length,1);assert.equal(metal[0][7],18);assert.equal(metal[0][8],14);
});
