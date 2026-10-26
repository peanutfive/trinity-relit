import {PRAM_GEOMETRY,PUSHER_GEOMETRY,PRAM_ART_FRAMES,PUSHER_ART_FRAMES,pusherFrameFor,pramFacing} from './pram-art-layout.js';

// Keeping image creation optional lets the geometry/motion checks run in Node.
function loadImage(path){
  if(typeof globalThis.Image!=='function')return null;
  const image=new globalThis.Image();image.src=new URL(path,import.meta.url).href;return image;
}
const pramImage=loadImage('./assets/pram-views-v1.png');
const pusherImage=loadImage('./assets/pram-pusher-v1.png');
const loaded=image=>Boolean(image?.complete&&image.naturalWidth>0);
const has=(state,flag)=>state?.hasFlag?.(flag)??(state?.flags instanceof Set?state.flags.has(flag):(state?.flags||[]).includes(flag));
const facingOf=(options,object,state)=>options.facing==='down'||options.facing==='right'?options.facing:pramFacing(object.room||state?.room);

function shadow(ctx,x,y,rx,ry){
  ctx.save();ctx.fillStyle='#17231c35';ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fill();ctx.restore();
}
function wheelSpokes(ctx,frame,x,y,phase){
  // Leave the painted tyre/rim intact. The dark interior and the fine brass
  // spokes rotate around a fixed axle; rolling never translates the wheel.
  for(const [sx,sy,radius,aspect] of frame.wheels.slice(0,2)){
    const cx=x+(sx-frame.foot[0])*frame.scale,cy=y+(sy-frame.foot[1])*frame.scale,r=radius*frame.scale*.78;
    ctx.save();ctx.translate(cx,cy);ctx.scale(aspect,1);
    ctx.fillStyle='#1d221e';ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.fill();
    ctx.rotate(phase);ctx.strokeStyle='#b59654';ctx.lineWidth=.24;
    ctx.beginPath();for(let spoke=0;spoke<8;spoke++){
      const angle=spoke*Math.PI/4;ctx.moveTo(Math.cos(angle)*.45,Math.sin(angle)*.45);ctx.lineTo(Math.cos(angle)*r,Math.sin(angle)*r);
    }ctx.stroke();
    ctx.fillStyle='#d0ad68';ctx.beginPath();ctx.arc(0,0,.5,0,Math.PI*2);ctx.fill();ctx.restore();
  }
}

export function renderPramArt(ctx,object,state,time=0){
  if(!['pram','perambulator','carriage'].includes(object.kind)||!loaded(pramImage))return false;
  const options=object.visualOptions||object;
  // Occupied/sailing/damaged scenes keep their existing composite until their
  // dedicated pose set is made; this atlas represents the ordinary push cart.
  if(options.legacyPram||options.broken||has(state,'pram_broken')||options.rider||options.sail)return false;
  const facing=facingOf(options,object,state),open=options.open??has(state,'pram_open');
  const frame=PRAM_ART_FRAMES[facing][open?'open':'closed'],[sx,sy,sw,sh]=frame.source,[fx,fy]=frame.foot;
  shadow(ctx,object.x-1,object.y-.4,facing==='right'?13:8.2,facing==='right'?1.7:2);
  ctx.save();ctx.imageSmoothingEnabled=true;
  ctx.drawImage(pramImage,sx,sy,sw,sh,object.x+(sx-fx)*frame.scale,object.y+(sy-fy)*frame.scale,sw*frame.scale,sh*frame.scale);
  // Radians are derived from mileage by the planner. No wall-clock animation
  // is used here, including when the cart is parked or the game is paused.
  wheelSpokes(ctx,frame,object.x,object.y,Number.isFinite(options.wheelPhase)?options.wheelPhase:0);
  ctx.restore();return true;
}

export function renderPusherArt(ctx,object,state,time=0){
  if(object.kind!=='pusher'||!loaded(pusherImage))return false;
  const options=object.visualOptions||object,facing=facingOf(options,object,state),frame=PUSHER_ART_FRAMES[facing][pusherFrameFor(options)];
  const [sx,sy,sw,sh]=frame.source,scale=35/(frame.foot[1]-frame.head),grip=PUSHER_GEOMETRY[facing].grip;
  shadow(ctx,object.x,object.y+.25,3.3,1.05);
  ctx.save();ctx.imageSmoothingEnabled=true;ctx.translate(object.x+grip[0],object.y+grip[1]);
  if(frame.flip)ctx.scale(-1,1);
  // Align each painted pair of hands to the same handle contact. The slight
  // sole lift (<0.7 logical px) comes from the short stepping pose itself.
  ctx.drawImage(pusherImage,sx,sy,sw,sh,(sx-frame.grip[0])*scale,(sy-frame.grip[1])*scale,sw*scale,sh*scale);
  ctx.restore();return true;
}

export const pramArtStatus=()=>loaded(pramImage)&&loaded(pusherImage)?'loaded':'loading';
export {PRAM_GEOMETRY,PUSHER_GEOMETRY};
