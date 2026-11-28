import {nearbyDrop} from './ranch-floor-items.js';
import {SKELETON_KEY} from './ossuary-key.js';

export function rememberSkeletonKeyDrop(before,state,scene){
  if(!['inventory','pocket','worn'].includes(before.itemLoc[SKELETON_KEY]) || !state.inRoom(SKELETON_KEY))return;
  const player=before.visual.player;
  const occupied=before.visual.hotspots.filter(object=>object.itemId && state.inRoom(object.itemId));
  const point=nearbyDrop(player,scene,occupied)||player;
  state.setCnt('skeleton_key_x_'+state.room,Math.round(point.x));
  state.setCnt('skeleton_key_y_'+state.room,Math.round(point.y));
}

export function positionDroppedSkeletonKey(state,object){
  if(object.itemId!==SKELETON_KEY || !state.inRoom(SKELETON_KEY))return object;
  const x=state.cnt('skeleton_key_x_'+state.room),y=state.cnt('skeleton_key_y_'+state.room);
  if(!x||!y)return object;
  return {...object,x,y,depthY:y,drawAt:[x,y],visualOptions:{...object.visualOptions,drawAt:{x,y}},
    radius:18,pointerShape:{kind:'ellipse',x,y:y-4,rx:9,ry:7,priority:3}};
}
