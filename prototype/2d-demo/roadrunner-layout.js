import { roadrunnerView } from './roadrunner-story.js';
import { nearbyDrop } from './ranch-floor-items.js';
import { findPath, isSegmentWalkable } from './world.js';

export const TOWER_BOX={x:185,y:171,width:34,height:14,perch:[178,161],gem:[190,161],stand:[193,179],sand:[164,179]};
const islandPerch=[374,52];
const birdId='companion:roadrunner';
const inHand=location=>['inventory','pocket','worn'].includes(location);
const inspect={label:'观察',command:'examine roadrunner'};
const gemActions=[{label:'观察',command:'examine ruby'},{label:'拿取',command:'take ruby'}];
const ellipse=(x,y,rx,ry)=>({kind:'ellipse',x,y,rx,ry,priority:4});

const legacyRestingSpots=new WeakMap();
function rememberedFeet(state,layout){
  const x=state.cnt('runner_foot_x_'+state.room), y=state.cnt('runner_foot_y_'+state.room);
  if(x && y)return [x,y];
  if(!legacyRestingSpots.has(layout)){
    const [sx,sy]=layout.spawn;
    legacyRestingSpots.set(layout,settleNear(layout,{x:sx,y:sy},[]));
  }
  return legacyRestingSpots.get(layout);
}
export function companionHotspots(state,layout,{heldItem=null}={}){
  const bird=roadrunnerView(state),objects=[];
  if(bird.visible){
    const perch=bird.perched;
    const [x,y]=perch ? [335,163] : rememberedFeet(state,layout);
    const [px,py]=perch?islandPerch:[x,y];
    objects.push({id:birdId,kind:'companion_bird',label:'走鹃',x,y,radius:18,drawAt:[px,py],
      pointerShape:ellipse(px,py-9,13,9),depthY:perch?152:py,visualOptions:{carrying:perch && bird.rubyInBeak},
      actions:[inspect]});
    if(perch && bird.rubyInBeak)objects.push({id:'islet:beak-ruby',kind:'beak_ruby',itemId:'ruby',label:'红宝石',
      x:338,y:163,radius:18,baked:true,pointerOnly:true,pointerShape:{...ellipse(px+9,py-14,3,3),priority:5},actions:gemActions});
  }
  if(state.room==='base_of_tower' && bird.rubyOnBox){
    const [x,y]=TOWER_BOX.stand,[gx,gy]=TOWER_BOX.gem;
    objects.push({id:'base_of_tower:box-ruby',kind:'tower_ruby',itemId:'ruby',label:'红宝石',
      x,y,drawAt:[gx,gy],depthY:TOWER_BOX.y+1,radius:14,pointerShape:ellipse(gx,gy-2,5,4),actions:gemActions});
  }else if(state.room==='base_of_tower' && heldItem==='ruby' && state.carrying('ruby')){
    const [x,y]=TOWER_BOX.stand;
    objects.push({id:'base_of_tower:box-lid',kind:'ruby_box_lid',label:'箱盖',x,y,radius:14,baked:true,
      pointerShape:ellipse(TOWER_BOX.x,161,17,5),actions:[{label:'放在箱盖上',command:'put ruby on box'}]});
  }
  return objects;
}

// Choose the bird's feet once on arrival. Ordinary pixel movement and reloads
// keep them fixed. Leave both the traveller and the neighbouring passage clear.
function settleNear(scene,player,hotspots){
  const busy=hotspots.filter(o=>o.id!==birdId && Number.isFinite(o.x));
  const doors=Object.values(scene.exitAnchors||{});
  const offsets=[[25,9],[-25,9],[30,0],[-30,0],[31,15],[-31,15],[24,-7],[-24,-7],[9,22],[-9,22],[0,19],[0,-22]];
  const reachable=offsets.map(([dx,dy])=>[Math.round(player.x+dx),Math.round(player.y+dy)])
    .filter(p=>isSegmentWalkable(scene,player,p));
  function clearance([x,y]){
    const clearance=Math.min(40,...doors.map(([ex,ey])=>Math.hypot(x-ex,y-ey)),
      ...busy.map(o=>Math.hypot(x-o.x,y-o.y)));
    // Two clear footprints may still draw one silhouette over the other.
    const overlaps=Math.abs(x-player.x)<21 && y<player.y+18 && y>player.y-43;
    return overlaps ? clearance-60 : clearance;
  }
  reachable.sort((a,b)=>clearance(b)-clearance(a));
  return reachable[0] || scene.spawn;
}
export function recordCompanionArrival(before,state,scene,player,entrance,objects){
  const old=roadrunnerView(before),now=roadrunnerView(state);
  if(!old.alreadyCrossed && now.alreadyCrossed)
    return {kind:'door',room:'islet',path:[islandPerch,[396,61],[405,88],[395,113],[375,139],[362,151]]};
  if(!now.joined || !now.visible || old.joined && old.birdRoom===now.birdRoom)return null;
  const meeting=!old.joined;
  const at=settleNear(scene,player,objects);
  state.setCnt('runner_foot_x_'+state.room,at[0]);
  state.setCnt('runner_foot_y_'+state.room,at[1]);
  const start=meeting?TOWER_BOX.sand:(scene.exitAnchors?.[entrance]||[player.x,player.y]);
  let path=findPath(scene,start,at);
  // When a change of viewpoint leaves the marked anchor outside the walk
  // mesh, enter at the same proven walkable landing as the player.
  if(!path.length && !meeting)path=findPath(scene,player,at);
  if(!path.length)return null;
  if(meeting && now.rubyOnBox)return {kind:'drop',room:state.room,dropAt:TOWER_BOX.gem,path:[TOWER_BOX.perch,...path]};
  return {kind:'follow',room:state.room,path};
}

export function rememberRubyDrop(before,state,scene){
  if(!inHand(before.itemLoc.ruby) || !state.inRoom('ruby') || state.room==='underwater')return;
  const occupied=before.visual.hotspots.filter(o=>o.itemId && before.itemLoc[o.itemId]===state.room);
  const p=nearbyDrop(before.visual.player,scene,occupied) || before.visual.player;
  state.setCnt('ruby_floor_x_'+state.room,Math.round(p.x));
  state.setCnt('ruby_floor_y_'+state.room,Math.round(p.y));
}
export function positionLooseRuby(state,o){
  if(o.itemId!=='ruby' || !state.inRoom('ruby') || state.room==='underwater')return o;
  const x=state.cnt('ruby_floor_x_'+state.room),y=state.cnt('ruby_floor_y_'+state.room);
  if(!x||!y)return o;
  return {...o,x,y,drawAt:[x,y],depthY:y,radius:16,pointerShape:ellipse(x,y-2,5,4)};
}
