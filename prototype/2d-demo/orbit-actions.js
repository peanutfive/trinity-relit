import {ITEMS} from '../js/data/items.js';
export const ORBIT_ROOMS=Object.freeze(['orbit_satellite','orbit_space']);
const action=(label,command)=>({label,command});
export function getOrbitHotspots(s){
  if(!ORBIT_ROOMS.includes(s.room))return [];
  const membrane={id:`${s.room}:membrane`,kind:'orbit_membrane',label:'身边的泡膜',x:240,y:160,radius:60,pointerOnly:true,baked:true,
    actions:[action('观察泡膜','examine bubble'),...(s.room==='orbit_satellite'&&s.has('axe')?[action('尝试手中斧头','break bubble with axe')]:[])],
    pointerShape:{kind:'annulus',x:240,y:140,rx:30,ry:32,innerRx:24,innerRy:26,priority:3}};
  const objects=[membrane];
  if(s.room==='orbit_satellite'){
    objects.push({id:'orbit:white-door',kind:'passage',label:'白门',x:90,y:155,radius:40,visualOptions:{prop:'japan_door'},actions:[action('穿过白门','out')],pointerShape:{kind:'ellipse',x:90,y:134,rx:14,ry:25,priority:1}});
    // This event has a side effect only in the existing magnet-carrying state.
    // Never claim that viewing the hull normally awards or reveals a magnet.
    objects.push({id:'orbit:hull',kind:'orbit_hull',label:'卫星外壳',x:305,y:130,radius:78,baked:true,eventId:'examine_satellite',actions:[action('观察卫星',s.has('lump')?'examine satellite':'look')],pointerShape:{kind:'ellipse',x:365,y:76,rx:42,ry:34,priority:1}});
  }else objects.push({id:'orbit:distant-satellite',kind:'passage',label:'远处的卫星',x:350,y:100,radius:150,baked:true,actions:[action('靠近卫星','d')],pointerShape:{kind:'ellipse',x:350,y:60,rx:28,ry:26,priority:1}});
  s.roomItems().filter(id=>ITEMS[id]&&id!=='soap_bubble').forEach((id,i)=>objects.push({id:`orbit:item:${id}`,kind:id==='axe'?'arbor_axe':id,itemId:id,label:ITEMS[id].cn,x:220+i*15,y:190,radius:37,actions:[action('查看',`examine ${ITEMS[id].aliases?.[0]||id}`),...(!ITEMS[id].fixed?[action('拿取',`take ${ITEMS[id].aliases?.[0]||id}`)]:[])]}));
  return objects;
}
export function getOrbitInventoryActions(id,s){
  if(!ORBIT_ROOMS.includes(s.room)||!s.has(id)||!ITEMS[id])return [];
  return [action('查看',`examine ${ITEMS[id].aliases?.[0]||id}`),...(!ITEMS[id].fixed&&id!=='soap_bubble'?[action('放下',`drop ${ITEMS[id].aliases?.[0]||id}`)]:[])];
}
