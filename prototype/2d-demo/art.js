import {undergroundDoorView} from './underground-story.js';
import {drawProjectedShadow} from './projected-shadow-art.js';
import { SCENES, BACKGROUND_ATLAS } from './scene-manifest.js';
import { paintCharacter } from './character.js';
import { ranchDoorOpen, ranchDoors } from './ranch-actions.js';
import { doorwayLayer } from './shack-route-art.js';
import { ROADRUNNER_ART } from './roadrunner-art.js';
import { roadrunnerView } from './roadrunner-story.js';
// The atlas has three independent landscape paintings, stacked vertically.
const backgrounds = new Map(), pending = new Map();
const sceneArtError = message => Object.assign(new Error(message), { name: 'SceneArtError' });
function flagActive(state,flag){
  const flags = state?.flags;
  return flags instanceof Set ? flags.has(flag) : flags?.includes(flag);
}
export function currentPlate(background, state) {
  const variant = background?.variant;
  if (!variant || (variant.unlessFlag && flagActive(state,variant.unlessFlag))) return background;
  if(variant.projectedTunnelDoor && state){
    const {insideGone,insideClosed}=undergroundDoorView(state);
    if(insideGone)return variant;
    if(insideClosed)return variant.closed;
  }
  const outside=variant.itemOutside;
  if (state?.itemLoc && outside && state.itemLoc[outside.id]!==outside.location) return variant;
  if (variant.anyFlags?.some(flag=>flagActive(state,flag)) || flagActive(state,variant.flag)) return variant;
  return background;
}
const backgroundSource = (background, state) => currentPlate(background,state)?.image;
// Background plates are large. Load the current room only; retain its source
// scene during a crossing until the destination painting is decoded.
function loadPlate(src){
  if(pending.has(src))return pending.get(src);
  const image=new Image();backgrounds.set(src,image);
  const promise=new Promise((resolve,reject)=>{
    image.onload=()=>resolve(image);
    image.onerror=()=>{pending.delete(src);backgrounds.delete(src);reject(sceneArtError('场景画面加载失败，请重试。'));};
    image.src=new URL(src,import.meta.url).href;
  });pending.set(src,promise);return promise;
}
const doorImage=door=>`./assets/${door.closedOverlay || door.openOverlay}-v1.png`;
export function ensureSceneArt(room,state){
  const scene=SCENES[room],src=backgroundSource(scene?.background,state);
  if(!src)return Promise.reject(sceneArtError('场景画面尚未制作。'));
  const base=loadPlate(src),doors=ranchDoors(scene);
  // Door commands and restored saves must show the matching plate from their first frame.
  const companion=room==='islet' || room==='base_of_tower' || state && scene.chapter==='ranch' && roadrunnerView(state).visible
    || room==='shallow_crater' && state && roadrunnerView(state).joined;
  const extras=[...doors.map(doorImage),...(scene.preloadArt||[]),...(companion?ROADRUNNER_ART:[])];
  return extras.length?Promise.all([base,...extras.map(loadPlate)]).then(([image])=>image):base;
}
export function propImage(src){
  if(!backgrounds.has(src) && typeof Image!=='undefined')loadPlate(src).catch(()=>{});
  const image=backgrounds.get(src);
  return image?.complete && image.naturalWidth ? image : null;
}
export function requestedSceneArt(){return [...backgrounds.keys()];}
const dust = Array.from({length:22},(_,i)=>({x:(i*79+31)%480,y:(i*47+19)%288,phase:i*2.1}));
function box(c,x,y,w,h,color){c.fillStyle=color;c.fillRect(Math.round(x),Math.round(y),w,h);}
function shadeSceneEdges(c) {
  const gradient=c.createRadialGradient(242,130,85,240,140,285);
  gradient.addColorStop(0,'#14252100');
  gradient.addColorStop(.7,'#14252108');
  gradient.addColorStop(1,'#07191563');
  c.fillStyle=gradient;
  c.fillRect(0,0,480,288);
}
function drawDoorwayLayer(c, room, state) {
  const src = doorwayLayer(room, state);
  const image = src && backgrounds.get(src);
  if (image?.complete && image.naturalWidth) c.drawImage(image, 0, 0, 480, 288);
}
export function drawScene(c,room,time,effects=true,state={}){
  c.imageSmoothingEnabled=true;
  const background=SCENES[room]?.background;const atlas=backgrounds.get(backgroundSource(background,state));
  if(!atlas)ensureSceneArt(room,state).catch(()=>{});
  if(atlas?.complete&&atlas.naturalWidth){const h=atlas.naturalHeight/background.panels;c.save();c.drawImage(atlas,0,background.panelIndex*h,atlas.naturalWidth,h,0,0,480,288);c.restore();}
  else{box(c,0,0,480,288,'#52664a');box(c,216,0,48,288,'#c6b38b');if(room!=='broad_walk')box(c,room==='flower_walk'?0:240,143,240,40,'#c6b38b');}
  drawDoorwayLayer(c,room,state);
  drawProjectedShadow(c,room,state,time,effects);
  for(const door of ranchDoors(SCENES[room])){
    if(ranchDoorOpen(state,door) === Boolean(door.closedOverlay))continue;
    const layer=backgrounds.get(doorImage(door));
    if(layer?.complete && layer.naturalWidth)c.drawImage(layer,0,0,480,288);
  }
  // Very restrained atmospheric movement; keep the interactive ground crisp.
  c.save();c.globalCompositeOperation='screen';
  const polar=SCENES[room]?.chapter==='tundra';
  for(const p of effects && SCENES[room]?.chapter!=='orbit' ? dust : []){const x=polar?(p.x+time*8+4800)%480:p.x+Math.sin(time*.17+p.phase)*4,y=polar?(p.y+Math.sin(time*.2+p.phase)*2+2880)%288:(p.y-time*1.7+2880)%288;c.fillStyle=`rgba(${polar?'210,224,225':'255,225,159'},${.14+.15*(1+Math.sin(time+p.phase))/2})`;c.beginPath();c.arc(x,y,.4+.25*Math.sin(p.phase),0,Math.PI*2);c.fill();}
  c.restore();
  shadeSceneEdges(c);
}
export function drawActor(c,x,y,color='#b99b6b',facing='down',walk=0,elder=false,animation={}) {
  paintCharacter(c,x,y,color,facing,walk,elder,animation);
}
// Open ironwork must occlude at its bars, never across its ground-filled holes.
// Decode the small leaf region once at source resolution; keep original art untouched.
const ironMasks = new WeakMap();
function ironMask(cover, atlas, background) {
  let entry=ironMasks.get(cover);if(entry)return entry;
  const xs=cover.points.map(p=>p[0]),ys=cover.points.map(p=>p[1]);
  const x=Math.floor(Math.min(...xs)),y=Math.floor(Math.min(...ys));
  const w=Math.ceil(Math.max(...xs))-x,h=Math.ceil(Math.max(...ys))-y;
  const scale=atlas.naturalWidth/480,panelHeight=atlas.naturalHeight/background.panels;
  const canvas=document.createElement('canvas');canvas.width=Math.ceil(w*scale);canvas.height=Math.ceil(h*scale);
  const context=canvas.getContext('2d',{willReadFrequently:true});
  context.drawImage(atlas,x*scale,background.panelIndex*panelHeight+y/288*panelHeight,w*scale,h/288*panelHeight,0,0,canvas.width,canvas.height);
  const pixels=context.getImageData(0,0,canvas.width,canvas.height);
  for(let i=0;i<pixels.data.length;i+=4){
    const luma=.2126*pixels.data[i]+.7152*pixels.data[i+1]+.0722*pixels.data[i+2];
    pixels.data[i+3]=Math.round(255*Math.max(0,Math.min(1,(115-luma)/30)));
  }
  context.putImageData(pixels,0,0);entry={canvas,x,y,w,h};ironMasks.set(cover,entry);return entry;
}
function clipOutline(c,points) {
  c.beginPath();
  points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));
  c.closePath();
  c.clip();
}
// Repaint only traced foreground silhouettes over actors standing behind them.
export function drawOcclusion(c,room,footY,state){
  const scene=SCENES[room],background=scene?.background,atlas=backgrounds.get(backgroundSource(background,state));
  if(!atlas?.complete||!atlas.naturalWidth)return;
  for(const cover of currentPlate(background,state)?.occluders ?? scene.occluders ?? []){
    if(footY>=cover.depthY)continue;
    c.save();clipOutline(c,cover.points);
    if(cover.material==='iron-bars'){const mask=ironMask(cover,atlas,background);c.globalAlpha*=.72;c.drawImage(mask.canvas,mask.x,mask.y,mask.w,mask.h);}
    else{
      const h=atlas.naturalHeight/background.panels;
      c.drawImage(atlas,0,background.panelIndex*h,atlas.naturalWidth,h,0,0,480,288);
      drawDoorwayLayer(c,room,state);
    }
    c.restore();
  }
  for(const door of ranchDoors(scene)){
    if(door.openLeafDepthY==null || footY>=door.openLeafDepthY || !ranchDoorOpen(state,door))continue;
    const leaf=door.closedOverlay ? atlas : backgrounds.get(doorImage(door));
    if(!leaf?.complete || !leaf.naturalWidth)continue;
    c.save();
    clipOutline(c,door.openLeafShape.points);
    c.drawImage(leaf,0,0,480,288);
    shadeSceneEdges(c);
    c.restore();
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
