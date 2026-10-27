import {SCENES} from './scene-manifest.js';
import {findPath} from './world.js';
import {JAPAN_POINTS as P} from './japan-route-layout.js';
const clamp=t=>Math.max(0,Math.min(1,t));
const smooth=t=>{t=clamp(t);return t*t*(3-2*t);};
const lerp=(a,b,t)=>a+(b-a)*t;
function route(from,to){
  const path=findPath(SCENES.playground,from,to,{step:2});
  if(!path.length)throw Error('Japan actor route is not on the painted ground');
  const lengths=path.slice(1).map((b,i)=>Math.hypot(b[0]-path[i][0],b[1]-path[i][1]));
  const distance=lengths.reduce((a,b)=>a+b,0);return {path,lengths,distance,duration:distance/38};
}
export function createJapanMotion(type,before={}){
  if(type==='japan_girl_approach'){
    const walk=route({x:240,y:109},P.girl);return {walk,duration:walk.duration+.35};
  }
  if(type==='japan_give_umbrella'){
    const walk=route(P.girl,P.entrance);return {walk,duration:walk.duration+.65};
  }
  if(type==='japan_refold')return {duration:3.5};
  if(type==='japan_paper_flight')return {duration:4.8,player:before.visual?.player||{x:226,y:166}};
  return {duration:1.1};
}
function along(walk,seconds){
  const distance=clamp(seconds/walk.duration)*walk.distance;let left=distance,index=0;
  while(index<walk.lengths.length-1&&left>walk.lengths[index])left-=walk.lengths[index++];
  const a=walk.path[index],b=walk.path[index+1],t=clamp(left/(walk.lengths[index]||1));
  return {x:lerp(a[0],b[0],t),y:lerp(a[1],b[1],t),distance,walking:seconds>0&&seconds<walk.duration,facing:b[0]<a[0]?'left':'right'};
}
const actor=(kind,p,options={},id=kind)=>({id:`japan:motion:${id}`,kind,...p,visualOptions:options});
export function sampleJapanMotion(event){
  if(!event?.type?.startsWith('japan_'))return {actors:[],hiddenKinds:[],hidePlayer:false,fade:0};
  const {type,elapsed:e,duration,motion:m}=event,t=clamp(e/duration),actors=[],hiddenKinds=[];
  if(type==='japan_girl_approach'||type==='japan_give_umbrella'){
    hiddenKinds.push('japan_girl');const giving=type==='japan_give_umbrella',delay=giving?.6:0;
    const p=along(m.walk,Math.max(0,e-delay));
    actors.push(actor('japan_girl',p,{...p,frame:giving&&e<delay?3:0,umbrella:giving&&e>=delay}));
  }
  if(type==='japan_refold'){
    hiddenKinds.push('japan_girl');
    actors.push(actor('japan_girl',P.shelterGirl,{frame:t<.4?7:t<.77?8:9}));
    actors.push(actor('japan_umbrella',{x:P.shelterGirl.x+10,y:P.shelterGirl.y+1}));
  }
  if(type==='japan_paper_flight'){
    const grow=smooth(e/.95),fly=smooth((e-1.5)/(duration-2));
    const from={x:m.player.x+11,y:m.player.y+2};
    const x=lerp(from.x,P.door.x,fly),y=lerp(from.y,P.door.y-8,fly)-Math.sin(fly*Math.PI)*36;
    const scale=lerp(.15,1,grow),opacity=1-smooth((e-duration+.5)/.5);
    actors.push(actor('giant_paper_bird',{x,y},{scale,flying:fly>0,flap:fly>0&&Math.floor(e*5)%2===1,facing:'left',opacity}));
    const board=smooth((e-.9)/.6);
    actors.push(actor('japan_rider',{x:lerp(m.player.x,x,board),y:lerp(m.player.y,y-10,board)},
      {facing:'left',walking:board>0&&board<1,phase:board*Math.PI*2,flying:fly>0,opacity}));
  }
  const fade=type==='japan_entry'||type==='japan_return'?1-smooth(t):type==='japan_paper_flight'?smooth((e-duration+.45)/.45):0;
  return {actors,hiddenKinds,hidePlayer:type==='japan_paper_flight',fade};
}
