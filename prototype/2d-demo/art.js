import { SCENES, BACKGROUND_ATLAS } from './scene-manifest.js';
import { paintCharacter } from './character.js';
// The atlas has three independent landscape paintings, stacked vertically.
const backgrounds = new Map();
for(const scene of Object.values(SCENES)){
  if(!backgrounds.has(scene.background.image)){
    const image=new Image();image.src=new URL(scene.background.image,import.meta.url).href;
    backgrounds.set(scene.background.image,image);
  }
}
const dust = Array.from({length:22},(_,i)=>({x:(i*79+31)%480,y:(i*47+19)%288,phase:i*2.1}));
function box(c,x,y,w,h,color){c.fillStyle=color;c.fillRect(Math.round(x),Math.round(y),w,h);}
export function drawScene(c,room,time,effects=true){
  c.imageSmoothingEnabled=true;
  const background=SCENES[room]?.background;const atlas=backgrounds.get(background?.image);
  if(atlas?.complete&&atlas.naturalWidth){const h=atlas.naturalHeight/background.panels;c.drawImage(atlas,0,background.panelIndex*h,atlas.naturalWidth,h,0,0,480,288);}
  else{box(c,0,0,480,288,'#52664a');box(c,216,0,48,288,'#c6b38b');if(room!=='broad_walk')box(c,room==='flower_walk'?0:240,143,240,40,'#c6b38b');}
  // Very restrained atmospheric movement; keep the interactive ground crisp.
  c.save();c.globalCompositeOperation='screen';
  for(const p of effects ? dust : []){const x=p.x+Math.sin(time*.17+p.phase)*4,y=(p.y-time*1.7+2880)%288;c.fillStyle=`rgba(255,225,159,${.14+.15*(1+Math.sin(time+p.phase))/2})`;c.beginPath();c.arc(x,y,.4+.25*Math.sin(p.phase),0,Math.PI*2);c.fill();}
  c.restore();
  const shade=c.createRadialGradient(242,130,85,240,140,285);shade.addColorStop(0,'#14252100');shade.addColorStop(.7,'#14252108');shade.addColorStop(1,'#07191563');c.fillStyle=shade;c.fillRect(0,0,480,288);
}
export function drawActor(c,x,y,color='#b99b6b',facing='down',walk=0,elder=false,animation={}) {
  paintCharacter(c,x,y,color,facing,walk,elder,animation);
}
// Repaint only traced foreground silhouettes over actors standing behind them.
export function drawOcclusion(c,room,footY){
  const scene=SCENES[room],background=scene?.background,atlas=backgrounds.get(background?.image);
  if(!atlas?.complete||!atlas.naturalWidth)return;
  for(const cover of scene.occluders||[]){
    if(footY>=cover.depthY)continue;
    c.save();c.beginPath();cover.points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.clip();
    const h=atlas.naturalHeight/background.panels;c.drawImage(atlas,0,background.panelIndex*h,atlas.naturalWidth,h,0,0,480,288);c.restore();
  }
}
export function drawProp(c,o,time){
  const {x,y,kind}=o;
  if(kind==='woman')drawActor(c,x,y,'#777489','down',0,true,{time,moving:false,blend:0,action:'idle'});
  if(kind==='birds')for(let i=0;i<5;i++){const xx=x+(i*17)%36-18,yy=y+(i*11)%22-11;c.fillStyle='#15251b42';c.beginPath();c.ellipse(xx+2,yy+3,4,1.3,0,0,7);c.fill();box(c,xx,yy,5,3,'#99a4a7');box(c,xx+1,yy,3,2,'#c5c5b9');box(c,xx+4,yy-2,2,3,'#617f82');box(c,xx+6,yy-1,2,1,'#bb9c68');box(c,xx+1,yy+3,1,1,'#bb7f66');}
  if(kind==='ball'){c.fillStyle='#29352750';c.beginPath();c.ellipse(x+1,y+3,5,1.6,0,0,7);c.fill();box(c,x-4,y-5,8,7,'#d4cdb0');box(c,x-3,y-6,5,1,'#f3e8c8');box(c,x-2,y-3,3,3,'#3a4240');box(c,x+2,y-4,2,2,'#737a6a');box(c,x-4,y-2,2,2,'#7c8371');box(c,x-2,y+1,4,1,'#9d9b81');}
  if(kind==='sign'){box(c,x-1,y-10,2,10,'#61533c');box(c,x-7,y-19,15,10,'#9a8157');box(c,x-6,y-18,13,7,'#c1ab79');box(c,x-4,y-16,9,1,'#7a714f');box(c,x-4,y-14,6,1,'#7a714f');}
}
export function artStatus(){return [...backgrounds.values()].every(image=>image.complete&&image.naturalWidth)?'loaded':'loading';}
