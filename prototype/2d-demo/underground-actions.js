import {ITEMS} from '../js/data/items.js';
import {UG_POINTS as P} from './underground-points.js';
export const UG_WABE_ROOMS=Object.freeze(['bluff','cottage','cemetery','barrow','ossuary']);
export const UG_ROOMS=Object.freeze(['underground_1','underground_2','underground_3']);
const supported=new Set([...UG_WABE_ROOMS,...UG_ROOMS]);
const a=(label,command)=>({label,command});
const prop=(id,p,label,kind,actions,extra={})=>({id,...p,label,kind,radius:38,actions,...extra});
const ellipse=(x,y,rx,ry)=>({kind:'ellipse',x,y,rx,ry,priority:1});
export function getUndergroundHotspots(s){
  if(!supported.has(s.room))return [];
  const objects=[];
  if(s.room==='cottage')objects.push(
    prop('cottage:map',P.map,'墙上地图','ug_map',[a('观察地图','examine map')],{baked:true,eventId:'examine_map',radius:48,pointerShape:ellipse(242,49,30,28)}),
    prop('cottage:cauldron',P.cauldron,'大锅','ug_cauldron',[a('观察大锅','examine cauldron')],{baked:true,eventId:'examine_cauldron',pointerShape:ellipse(239,140,34,33)}),
    prop('cottage:cage',P.cage,'鸟笼','ug_cage',[a('观察鸟笼','examine birdcage')],{baked:true,eventId:'examine_birdcage',radius:48,pointerShape:ellipse(321,43,13,20)})
  );
  if(s.room==='cemetery')objects.push(prop('cemetery:crypt',{x:240,y:95},'墓穴入口','passage',[a('进入墓穴','n')],{baked:true,pointerShape:ellipse(240,62,22,29)}));
  if(s.room==='barrow')objects.push(prop('barrow:door',P.barrowDoor,'石门','ug_barrow_door',[
    a('观察门洞','examine door'),a('穿过门洞','in'),...(s.has('key_barrow')?[a('试用钥匙','put key in hole')]:[])
  ],{baked:true,eventId:'examine_door_barrow',pointerShape:ellipse(240,65,30,36)}),
  prop('barrow:keyhole',{x:277,y:112},'小孔','ug_hole',[a('观察小孔','examine hole'),...(s.has('key_barrow')?[a('试用钥匙','put key in hole')]:[])],{baked:true,eventId:'examine_hole_barrow',pointerShape:{...ellipse(277,68,3,4),priority:2}}));
  if(s.room==='ossuary')objects.push(
    prop('ossuary:bones',P.bones,'骸骨','ug_bones',[a('观察骸骨','examine bones')],{baked:true,eventId:'examine_bones',radius:48,pointerShape:ellipse(133,73,52,22)}),
    prop('ossuary:mushroom',P.mushroom,'蘑菇门','mushroom_gate',[a('观察此处','look'),a('穿过蘑菇门','in')],{visualOptions:{open:s.sundialSymbol===2},pointerShape:ellipse(350,101,28,32)})
  );
  if(s.room==='underground_1')objects.push(
    prop('underground_1:white-door',P.whiteDoor,'白门','passage',[a('返回纳骨堂','w')],{visualOptions:{prop:'japan_door'},pointerShape:ellipse(P.whiteDoor.x,P.whiteDoor.y-21,11,23)}),
    prop('underground_1:crevice',P.crevice,'裂缝','ug_crevice',[a('观察裂缝','examine crevice')],{baked:true,eventId:'examine_crevice',pointerShape:ellipse(240,231,48,20)}),
    prop('underground_1:landslide',P.landslide,'碎石','ug_landslide',[a('观察碎石','examine landslide')],{baked:true,eventId:'examine_landslide',radius:48,pointerShape:ellipse(345,105,45,27)})
  );
  if(s.room==='underground_3')objects.push(prop('underground_3:cylinder',P.cylinder,'金属圆筒','ug_cylinder',[a('观察圆筒','examine cylinder')],{baked:true,eventId:'examine_cylinder',pointerShape:ellipse(350,145,22,22)}));
  const dropped={bluff:[240,185],cottage:[170,210],cemetery:[260,218],barrow:[240,220],ossuary:[242,200],underground_1:[180,165],underground_2:[180,189],underground_3:[190,205]}[s.room];
  s.roomItems().filter(id=>ITEMS[id]).forEach((id,i)=>{
    const item=ITEMS[id],noun=item.aliases?.[0]||id;
    const p=s.room==='underground_2'&&id==='lantern'?{x:180,y:189}:s.room==='underground_2'&&id==='splinter'?{x:235,y:189}:id==='soap_bubble'&&s.room==='cottage'?P.bubble:id==='walkie_talkie'&&s.room==='underground_2'?P.walkie:id==='lantern'&&s.room==='underground_3'?P.lantern:{x:dropped[0]+(i%3)*9,y:dropped[1]+Math.floor(i/3)*6};
    const actions=[a('查看',`examine ${noun}`)];if(!item.fixed)actions.push(a('拿取',`take ${noun}`));
    objects.push(prop(`ug:item:${id}`,p,item.cn,id,actions,{itemId:id,visualOptions:id==='lantern'&&s.room==='underground_3'?{drawAt:{x:350,y:128}}:{},pointerShape:ellipse(p.x,id==='lantern'&&s.room==='underground_3'?120:p.y-6,id==='soap_bubble'?9:7,id==='lantern'?10:7)}));
  });
  return objects;
}
export function getUndergroundInventoryActions(id,s){
  if(!supported.has(s.room)||!s.has(id)||!ITEMS[id])return [];
  const actions=[a('查看',`examine ${ITEMS[id].aliases?.[0]||id}`)];
  if(id==='lantern'&&['underground_2','underground_3'].includes(s.room)&&!s.hasFlag('lantern_on'))actions.push(a('点亮灯笼','turn lantern'));
  if(!ITEMS[id].fixed)actions.push(a('放下',`drop ${ITEMS[id].aliases?.[0]||id}`));
  return actions;
}
