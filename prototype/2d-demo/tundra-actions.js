import {ROOMS} from '../js/data/tundra.js';
import {ITEMS} from '../js/data/items.js';
import {TUNDRA_LAYOUT} from './tundra-layout.js';
import {TUNDRA_POINTS as P} from './tundra-landmarks-layout.js';
export const TUNDRA_ROOMS=Object.freeze(Object.keys(ROOMS));
const a=(label,command)=>({label,command});
const ellipse=(x,y,rx,ry,priority=1)=>({kind:'ellipse',x,y,rx,ry,priority});

// Read-only projection. Discovery lives in the existing 2D knowledge save;
// seeing the fissure never changes ownership, chapter flags or animal rules.
export function getTundraHotspots(state,{observed=new Set()}={}){
  const layout=TUNDRA_LAYOUT[state.room],room=ROOMS[state.room];if(!layout||!room)return [];
  const objects=[],exits=room.exits(state);
  for(const direction of layout.interactionExitDirs||[]){
    if(layout.hiddenExitDirs?.includes(direction))continue;
    const value=exits[direction],target=typeof value==='string'?value:value?.to,anchor=layout.exitAnchors?.[direction];
    if(!target||!anchor||typeof value?.when==='function'&&!value.when(state))continue;
    const visual=layout.passageVisuals?.[direction]||{};
    objects.push({id:`${state.room}:passage:${direction}`,kind:'passage',baked:true,x:anchor[0],y:anchor[1],radius:30,
      label:visual.label||({u:'上行',d:'下行',out:'返回'}[direction]||'通行'),actions:[a('通行',direction)],
      pointerShape:visual.pointerShape||ellipse(anchor[0],anchor[1]-12,10,17),...visual});
  }
  const seenFissure=observed.has('cliff_edge:fissure');
  if(state.room==='cliff_edge')objects.push({id:'cliff_edge:fissure',kind:'tundra_fissure',label:'岩缝',baked:true,
    ...P.fissure,radius:35,actions:[a('观察裂缝',state.inRoom('lemming')?'examine fissure':'look')],
    ...(state.inRoom('lemming')?{eventId:'look_in_fissure'}:{}),
    pointerOnly:seenFissure&&state.inRoom('lemming'),pointerShape:P.fissure.pointerShape||ellipse(P.fissure.x,P.fissure.y-5,16,9)});
  const [bx,by]=layout.looseAnchor||layout.spawn;
  state.roomItems().filter(id=>ITEMS[id]).forEach((id,index)=>{
    const item=ITEMS[id],noun=item.aliases?.[0]||id;
    const nativeMouse=id==='lemming'&&state.room==='cliff_edge';
    const point=nativeMouse?P.lemming:{x:bx+(index%3-1)*9,y:by+Math.floor(index/3)*7};
    const drawAt=point.drawAt||point;
    objects.push({id:`tundra:item:${id}`,kind:id==='lemming'?'tundra_lemming':id,label:item.cn,...point,radius:30,itemId:id,
      depthY:drawAt.y,visualOptions:{drawAt},visual:!nativeMouse||seenFissure||observed.has(`tundra:item:${id}`),
      pointerShape:ellipse(drawAt.x,drawAt.y-3,id==='lemming'?7:6,5,3),
      actions:[a('查看',`examine ${noun}`),...(!item.fixed?[a('拿取',`take ${noun}`)]:[])]});
  });
  return objects;
}
export function getTundraInventoryActions(id,state){
  if(!ROOMS[state.room]||!state.has(id)||!ITEMS[id])return [];
  const item=ITEMS[id],noun=item.aliases?.[0]||id;
  return [a('查看',`examine ${noun}`),...(!item.fixed?[a('放下',`drop ${noun}`)]:[])];
}
