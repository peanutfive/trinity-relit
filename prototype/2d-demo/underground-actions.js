import {undergroundDoorView} from './underground-story.js';
import {lanternSwitchCommand} from './lantern-story.js';
import {ITEMS} from '../js/data/items.js';
import {cemeteryView} from './cemetery-state.js';
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
  if(s.room==='cemetery'){
    const view=cemeteryView(s);
    objects.push(prop('cemetery:crypt',{x:240,y:95},'古墓入口','passage',[a('进入古墓','n')],{baked:true,pointerShape:ellipse(240,62,22,29)}));
    const actions=view.open ? [a('近看','look in crypt')] : [a('观察','examine crypt'),a('推开','open crypt')];
    if(!view.open && s.has('spade'))actions.push(a('用铲子','open crypt with spade'));
    objects.push(prop('cemetery:stone-crypt',{x:197,y:151},'石棺','cemetery_tomb',actions,{
      depthY:140,radius:24,pointerShape:{kind:'polygon',priority:3,points:[[149,120],[175,110],[205,114],[211,130],[192,140],[155,138]]},
    }));
  }
  if(s.room==='barrow')objects.push(prop('barrow:door',P.barrowDoor,'石门','ug_barrow_door',[
    a('观察门洞','examine door'),a('穿过门洞','in'),...(s.has('key_barrow')?[a('试用钥匙','put key in hole')]:[])
  ],{baked:true,eventId:'examine_door_barrow',pointerShape:ellipse(240,65,30,36)}),
  prop('barrow:keyhole',{x:277,y:112},'小孔','ug_hole',[a('观察小孔','examine hole'),...(s.has('key_barrow')?[a('试用钥匙','put key in hole')]:[])],{baked:true,eventId:'examine_hole_barrow',pointerShape:{...ellipse(277,68,3,4),priority:2}}));
  if(s.room==='ossuary'){
    const {gone,open}=undergroundDoorView(s);
    const actions=gone?[a('观察巨菌','examine toadstool')]:[a('观察此处','look'),a('穿过蘑菇门','in')];
    objects.push(
      prop('ossuary:bones',P.bones,'骸骨','ug_bones',[a('观察骸骨','examine bones')],{baked:true,eventId:'examine_bones',radius:48,pointerShape:ellipse(133,73,52,22)}),
      prop('ossuary:mushroom',P.mushroom,gone?'巨菌':'蘑菇门','mushroom_gate',actions,
        {visualOptions:{open,gone},pointerShape:ellipse(350,101,28,32)}),
    );
  }
  if(s.room==='underground_3'){
    const {insideOpen,insideClosed}=undergroundDoorView(s);
    const doorShape={baked:true,radius:20,pointerShape:ellipse(407,98,12,23)};
    if(insideOpen)objects.push(prop('underground_3:white-door',P.whiteDoor,'白门','passage',[a('返回纳骨堂','e')],doorShape));
    if(insideClosed)objects.push(prop('underground_3:closed-white-door',P.whiteDoor,'白门','door',[a('观察白门','look')],doorShape));
  }
  if(s.room==='underground_1')objects.push(
    prop('underground_1:crevice',P.crevice,'裂缝','ug_crevice',[a('观察裂缝','examine crevice')],{baked:true,eventId:'examine_crevice',pointerShape:ellipse(240,231,48,20)}),
    prop('underground_1:landslide',P.landslide,'塌方','ug_landslide',[a('观察塌方','examine landslide')],{baked:true,eventId:'examine_landslide',radius:33,pointerShape:ellipse(31,110,29,25)})
  );
  if(s.room==='underground_3')objects.push(prop('underground_3:cylinder',P.cylinder,'金属圆筒','ug_cylinder',[a('观察圆筒','examine cylinder')],{baked:true,eventId:'examine_cylinder',pointerShape:ellipse(350,145,22,22)}));
  const dropped={bluff:[240,185],cottage:[170,210],cemetery:[260,218],barrow:[240,220],ossuary:[242,200],underground_1:[180,165],underground_2:[180,189],underground_3:[190,205]}[s.room];
  s.roomItems().filter(id=>ITEMS[id]).forEach((id,i)=>{
    const item=ITEMS[id],noun=item.aliases?.[0]||id;
    const p=s.room==='underground_2'&&id==='lantern'?{x:180,y:189}:s.room==='underground_2'&&id==='splinter'?{x:235,y:189}:id==='soap_bubble'&&s.room==='cottage'?P.bubble:id==='walkie_talkie'&&s.room==='underground_2'?P.walkie:id==='lantern'&&s.room==='underground_3'?P.lantern:{x:dropped[0]+(i%3)*9,y:dropped[1]+Math.floor(i/3)*6};
    const actions=[a('查看',`examine ${noun}`)];if(!item.fixed)actions.push(a('拿取',`take ${noun}`));
    const lamp=id==='lantern';
    const shape=lamp?ellipse(p.x-1,p.y-9,8,11):ellipse(p.x,p.y-6,id==='soap_bubble'?9:7,7);
    objects.push(prop(`ug:item:${id}`,p,item.cn,id,actions,{
      itemId:id, pointerShape:shape, ...(lamp?{radius:27}:{}),
    }));
  });
  return objects;
}
export function getUndergroundInventoryActions(id,s){
  if(!supported.has(s.room)||!s.has(id)||!ITEMS[id])return [];
  const actions=[a('查看',`examine ${ITEMS[id].aliases?.[0]||id}`)];
  if(id==='lantern'){
    const cmd=lanternSwitchCommand(s);
    actions.push(a(cmd==='turn off lantern'?'关灯':'开灯',cmd));
  }
  if(!ITEMS[id].fixed)actions.push(a('放下',`drop ${ITEMS[id].aliases?.[0]||id}`));
  return actions;
}
