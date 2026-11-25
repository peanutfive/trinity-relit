import { passageHotspots } from './scene-passages.js';
import { SHACK_ROUTE_LAYOUT } from './shack-route-layout.js';
import { DESERT_ROOMS, shackDoorOpen } from './shack-story.js';
import { nearbyDrop } from './ranch-floor-items.js';

export function shackRouteHotspots(state) {
  const layout=SHACK_ROUTE_LAYOUT[state.room];
  if (!layout) return [];
  const objects=passageHotspots(state,layout,DESERT_ROOMS[state.room]);
  if (state.room!=='shack') return objects;
  const door=layout.eastDoor;
  objects.push({
    id:'shack:white-door',kind:'shack_door',label:'白门',x:door.at[0],y:door.at[1],
    radius:21,baked:true,pointerShape:{kind:'polygon',points:door.points,priority:3},
    physicalHint:shackDoorOpen(state)?'走向门口':'推门',
    actions:[{label:'互动',command:shackDoorOpen(state)?'e':'open door'}],
  });
  return objects;
}

export function positionDesertBook(state,object) {
  if (object?.itemId!=='paperback' || state.chapter!=='desert') return object;
  const corner=SHACK_ROUTE_LAYOUT.shack.book;
  const untouched=state.room==='shack' && !state.hasFlag('paperback_moved');
  const x=untouched?corner.x:state.cnt('desert_book_x') || object.x;
  const y=untouched?corner.y:state.cnt('desert_book_y') || object.y;
  return {...object,id:state.room==='shack'?'shack:paperback':object.id,
    x:untouched?corner.at[0]:x,y:untouched?corner.at[1]:y,drawAt:[x,y],depthY:y,
    radius:17,inspectionHint:'看书封',
    pointerShape:{kind:'ellipse',x,y:y-3,rx:7,ry:5,priority:4}};
}

export function rememberDesertBookDrop(before,state,scene) {
  if (state.chapter!=='desert' || !state.inRoom('paperback')
      || !['inventory','pocket','worn'].includes(before.itemLoc.paperback)) return;
  const occupied=before.visual.hotspots.filter(item=>before.itemLoc[item.itemId]===state.room);
  const point=nearbyDrop(before.visual.player,scene,occupied) || before.visual.player;
  state.setCnt('desert_book_x',Math.round(point.x));
  state.setCnt('desert_book_y',Math.round(point.y));
}
