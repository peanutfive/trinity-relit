// The raw RGBA atlas is preserved; these measured source rectangles are sampled
// directly by Canvas. Flight/heat affect presentation only, never game turns.
import {paintCharacter} from './character.js';
const sheet=new Image();sheet.src=new URL('./assets/cliff-props-v1.png',import.meta.url).href;
export const CLIFF_PROP_REGIONS=Object.freeze({
  hive:[31,0,612,809],beeA:[710,20,490,433],beeB:[710,455,475,350],metal:[1295,296,588,500],
});
function stamp(c,key,x,y,width,height,flip=false){
  if(!sheet.complete||!sheet.naturalWidth)return false;
  c.save();c.translate(x,y);if(flip)c.scale(-1,1);
  c.drawImage(sheet,...CLIFF_PROP_REGIONS[key],-width/2,-height,width,height);c.restore();return true;
}
export function renderCliffSprite(c,o,state,time=0){
  if(!o.kind?.startsWith('cliff_'))return false;
  if(o.kind==='cliff_traveller'){
    const v=o.visualOptions||{};paintCharacter(c,o.x,o.y,'#bca071',v.facing||'up',(v.distance||0)/6,false,{moving:v.walking,blend:v.walking?1:0,action:'idle'});return true;
  }
  if(o.kind==='cliff_hive'){
    const p=o.visualOptions?.drawAt||{x:340,y:91};
    return stamp(c,'hive',p.x,p.y,34,44);
  }
  if(o.kind==='cliff_bees'){
    for(let i=0;i<7;i++){
      const t=time*(1.2+i*.07)+i*2.3,x=340+Math.cos(t)* (12+i*2.8),y=91+Math.sin(t*1.4)*(8+i*.6);
      stamp(c,Math.sin(time*22+i)>0?'beeA':'beeB',x,y,3.2,2.6,Math.sin(t)>0);
    }return true;
  }
  if(o.kind==='cliff_metal'){
    c.save();c.fillStyle='rgba(28,24,20,.24)';c.beginPath();c.ellipse(o.x,o.y,8,2,0,0,Math.PI*2);c.fill();
    const ok=stamp(c,'metal',o.x,o.y,18,14);c.restore();return ok;
  }
  return true;
}
export const cliffArtStatus=()=>sheet.complete&&sheet.naturalWidth?'loaded':'loading';
