// A local performance receipt, never a machine-dependent CI speed assertion.
import assert from 'node:assert/strict';
import {SCENES} from '../scene-manifest.js';
import {nearestWalkable,findPath,isSegmentWalkable} from '../world.js';
const cases=[['round_pond',[425,22]],['south_arbor',[262,142]],['trellises',[340,33]]];
const receipts=[];
for(const [room,target]of cases){
 const base=SCENES[room],runs=[];
 for(let index=0;index<3;index++){
  const scene={...base,obstacles:[...base.obstacles]},start=performance.now();
  const landing=nearestWalkable(scene,target,{from:base.spawn}),nearest=performance.now();
  assert.ok(landing);const path=findPath(scene,base.spawn,landing),end=performance.now();
  assert.ok(path.length);for(let i=1;i<path.length;i++)assert.ok(isSegmentWalkable(scene,path[i-1],path[i]));
  runs.push({nearestMs:+(nearest-start).toFixed(3),pathMs:+(end-nearest).toFixed(3),totalMs:+(end-start).toFixed(3),points:path.length});
 }
 receipts.push({room,target,runs});
}
console.log(JSON.stringify(receipts,null,2));
