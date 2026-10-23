import { findPath, isBlocked } from './world.js';

const opposite={n:'s',ne:'sw',e:'w',se:'nw',s:'n',sw:'ne',w:'e',nw:'se',u:'d',d:'u',in:'out',out:'in'};
const edges={n:[240,12],ne:[468,12],e:[468,162],se:[468,276],s:[240,276],sw:[12,276],w:[12,162],nw:[12,12],u:[240,12],d:[240,276],in:[468,162],out:[12,162]};

function atDistance(path,distance){
  for(let index=1;index<path.length;index++){
    const from=path[index-1],to=path[index],length=Math.hypot(to[0]-from[0],to[1]-from[1]);
    if(distance<=length){const t=length?distance/length:0;return {x:from[0]+(to[0]-from[0])*t,y:from[1]+(to[1]-from[1])*t,next:to};}
    distance-=length;
  }
  const last=path.at(-1);return {x:last[0],y:last[1],next:last};
}

// Normal room travel arrives just inside the matching destination entrance.
// A reverse connection outranks a compass assumption: Trinity's graph is not a
// rectangular grid. For one-way links choose the incoming visual edge only;
// this never creates a return exit or changes the original map.
export function roomArrival(scene,{fromRoom,direction,exits=[]}={}){
  if(!opposite[direction])return null; // Narrative transport keeps its authored landing.
  const returns=exits.filter(exit=>exit.target===fromRoom);
  const entrance=returns.find(exit=>exit.dir===opposite[direction])||returns[0];
  const anchor=entrance?[entrance.x,entrance.y]:edges[opposite[direction]];
  const forward=findPath(scene,scene.spawn,anchor,{nearest:true});
  if(!forward.length)return null;
  const path=[...forward].reverse(),total=path.slice(1).reduce((sum,node,index)=>sum+Math.hypot(node[0]-path[index][0],node[1]-path[index][1]),0);
  let distance=Math.min(32,total),landing=atDistance(path,distance);
  // A newly arrived foot must clear all exit sensors, including neighbouring
  // internal junctions, before manual movement is allowed to trigger one again.
  while(distance+4<=total&&exits.some(exit=>Math.hypot(landing.x-exit.x,landing.y-exit.y)<exit.radius+8)){
    distance+=4;landing=atDistance(path,distance);
  }
  if(isBlocked(scene,landing.x,landing.y))return null;
  const ahead=atDistance(path,Math.min(total,distance+12));
  let dx=ahead.x-landing.x,dy=ahead.y-landing.y;
  if(Math.hypot(dx,dy)<.001&&path.length>1){
    const end=path.at(-1),previous=path.at(-2);dx=end[0]-previous[0];dy=end[1]-previous[1];
  }
  const face=Math.abs(dx)>Math.abs(dy)?(dx>=0?'right':'left'):(dy>=0?'down':'up');
  return {x:landing.x,y:landing.y,face,entrance:entrance?.dir||opposite[direction],fromRoom,matched:Boolean(entrance)};
}
