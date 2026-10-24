import {PIGEON_FLOCK,pigeonGroundPose} from './pigeon-motion.js';
export {pigeonGroundPose} from './pigeon-motion.js';
const image=new Image();image.src=new URL('./assets/pigeon-poses-v3.png',import.meta.url).href;
const frames=[
 {box:[0,133,377,300],foot:[235,421]}, {box:[395,155,350,278],foot:[593,419]},
 {box:[756,183,377,249],foot:[965,416]}, {box:[1166,236,368,196],foot:[1365,417]},
 {box:[17,707,380,218],foot:[235,901]}, {box:[424,542,378,370],foot:[615,889]},
 {box:[784,494,415,414],foot:[1002,889]}, {box:[1197,653,339,303],foot:[1380,893]},
];

function stamp(ctx,x,y,frame,flip,rotation=0){
 const f=frames[frame], [sx,sy,sw,sh]=f.box,[fx,fy]=f.foot,scale=8/274;
 ctx.save();ctx.translate(x,y);if(flip)ctx.scale(-1,1);ctx.rotate(rotation);ctx.imageSmoothingEnabled=true;
 ctx.drawImage(image,sx,sy,sw,sh,(sx-fx)*scale,(sy-fy)*scale,sw*scale,sh*scale);ctx.restore();
}
export function renderPigeon(ctx,object,state,time=0){
 if(!['birds','pigeons','pigeon'].includes(object.kind)||!image.complete||!image.naturalWidth)return false;
 const o=object.visualOptions||object;
 const fed=state?.hasFlag?.('birds_fed')??(state?.flags instanceof Set?state.flags.has('birds_fed'):(state?.flags||[]).includes('birds_fed'));
 if(object.kind!=='pigeon'){
  for(let i=0;i<5;i++){const p=pigeonGroundPose(time,i,fed);const x=object.x+PIGEON_FLOCK[i][0]+p.x,y=object.y+PIGEON_FLOCK[i][1]+p.y;
   ctx.save();ctx.fillStyle='#17251d29';ctx.beginPath();ctx.ellipse(x+1,y+.5,3.5,1,0,0,Math.PI*2);ctx.fill();ctx.restore();stamp(ctx,x,y,p.frame,p.flip);}
 }else{
  const flying=o.flying??Math.abs(o.flap||0)>.1;
  const frame=flying?[5,6,7,5][Math.floor(time*10+(o.phase||0))%4]:o.peck!==undefined?(Math.floor(time*5+(o.phase||0))%2?3:4):0;
  stamp(ctx,object.x,object.y,frame,Boolean(o.flip),o.rotation||0);
 }
 return true;
}
export const pigeonArtStatus=()=>image.complete&&image.naturalWidth?'loaded':'loading';
