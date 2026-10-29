// Sample original generated PNG; keep movable objects out of painted backgrounds.
import {renderJapanSprite} from './japan-art.js';
const sheet=new Image();sheet.src=new URL('./assets/ug-props-v1.png',import.meta.url).href;
export const UG_PROP_REGIONS={lantern:[54,7,350,755],lit:[545,7,350,755],walkie_talkie:[1000,0,360,764],soap_bubble:[1396,175,574,565]};
const flag=(s,id)=>s.hasFlag?.(id)??(s.flags instanceof Set?s.flags.has(id):(s.flags||[]).includes(id));
const at=(s,id)=>s.itemAt?.(id)??s.itemLoc?.[id];
const held=(s,id)=>['inventory','worn','pocket'].includes(at(s,id));
function stamp(c,key,x,y,h,w){if(!sheet.complete||!sheet.naturalWidth)return false;const r=UG_PROP_REGIONS[key];c.drawImage(sheet,...r,x-w/2,y-h,w,h);return true;}
export function undergroundLighting(s){return {lantern:flag(s,'lantern_on')&&(held(s,'lantern')||at(s,'lantern')===s.room),splinter:held(s,'splinter')};}
export function renderUndergroundSprite(c,o,s,time=0){
  const p=o.visualOptions?.drawAt||o;
  if(o.kind==='passage'&&o.visualOptions?.prop==='japan_door')return renderJapanSprite(c,{...o,kind:'japan_door'},s,time);
  if(o.kind==='lantern')return stamp(c,flag(s,'lantern_on')?'lit':'lantern',p.x,p.y,19,9);
  if(o.kind==='walkie_talkie')return stamp(c,'walkie_talkie',p.x,p.y,17,8);
  if(o.kind==='soap_bubble')return stamp(c,'soap_bubble',p.x,p.y-3-Math.sin(time*.9)*1.2,19,19);
  return false;
}
export function drawUndergroundAtmosphere(c,room,s,player,time=0,objects=[]){
  if(room==='cottage'){
    c.save();for(let i=0;i<6;i++){const t=(time*.15+i/6)%1;c.fillStyle=`rgba(214,208,177,${(1-t)*.11})`;c.beginPath();c.ellipse(240+Math.sin(time+i)*7,121-t*55,4+t*7,3+t*9,0,0,Math.PI*2);c.fill();}c.restore();
  }
  if(!room.startsWith('underground_'))return;
  const light=undergroundLighting(s);c.save();
  const lamp=objects.find(o=>o.itemId==='lantern'),local=light.lantern&&at(s,'lantern')===room;
  const x=local&&lamp?lamp.x:player.x,y=local&&lamp?lamp.y-9:player.y-11;
  const shade=c.createRadialGradient(x,y,20,x,y,235);
  shade.addColorStop(0,'rgba(2,8,10,0)');shade.addColorStop(1,`rgba(2,8,10,${s.dead ? .78 : light.lantern ? .22 : .42})`);c.fillStyle=shade;c.fillRect(0,0,480,288);
  if(light.lantern||light.splinter){
    c.globalCompositeOperation='screen';const glow=c.createRadialGradient(x,y,0,x,y,light.lantern?72:42);
    glow.addColorStop(0,light.lantern?'rgba(238,177,67,.18)':'rgba(128,205,136,.13)');glow.addColorStop(1,'rgba(0,0,0,0)');c.fillStyle=glow;c.fillRect(0,0,480,288);
  }c.restore();
}
export const undergroundArtStatus=()=>sheet.complete&&sheet.naturalWidth?'loaded':'loading';
