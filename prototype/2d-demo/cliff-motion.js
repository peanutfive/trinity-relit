import {CLIFF_ROUTE_LAYOUT} from './cliff-route-layout.js';
import {findPath} from './world.js';
const pairs={
  'under_cliff:ice_cavern':'in','ice_cavern:under_cliff':'out',
  'craters_edge:crater':'d','crater:craters_edge':'u',
};
export function createCliffPassage(before,after){
  const dir=pairs[`${before.room}:${after.room}`];if(!dir)return null;
  const scene=CLIFF_ROUTE_LAYOUT[before.room],p=before.visual?.player||{x:scene.spawn[0],y:scene.spawn[1]};
  const [x,y]=scene.exitAnchors[dir],path=findPath({...scene,footprint:{rx:6,ry:3}},p,{x,y},{nearest:true});
  if(!path.length)return null;
  const distance=path.slice(1).reduce((sum,to,i)=>sum+Math.hypot(to[0]-path[i][0],to[1]-path[i][1]),0);
  return {path,distance,walkDuration:Math.max(.4,distance/46),duration:Math.max(.4,distance/46)+.45};
}
export function sampleCliffPassage(motion,elapsed){
  let remaining=motion.distance*Math.min(1,Math.max(0,elapsed/motion.walkDuration));
  let p=motion.path[0],dx=0,dy=-1;
  for(let i=1;i<motion.path.length;i++){
    const a=motion.path[i-1],b=motion.path[i],length=Math.hypot(b[0]-a[0],b[1]-a[1]);
    dx=b[0]-a[0];dy=b[1]-a[1];
    if(remaining<=length){const t=length?remaining/length:1;p=[a[0]+dx*t,a[1]+dy*t];break;}
    remaining-=length;p=b;
  }
  return {actor:{id:'cliff:traveller',kind:'cliff_traveller',x:p[0],y:p[1],visualOptions:{
    walking:elapsed<motion.walkDuration,distance:Math.min(motion.distance,elapsed*46),
    facing:Math.abs(dx)>Math.abs(dy)?(dx>0?'right':'left'):(dy>0?'down':'up')}},
    fade:Math.max(0,Math.min(1,(elapsed-motion.walkDuration)/.45))};
}
