const story = './assets/story-sprites-cutout.png';
const detail = './assets/story-detail.png';
const poses = './assets/companion-roadrunner-poses-v1.png';
const box = './assets/companion-roadrunner-box-v1.png';
export const ROADRUNNER_ART = [story, detail, poses, box];

const clamp = t => Math.max(0, Math.min(1, t));
const smooth = t => t * t * (3 - 2 * t);
const point = p => Array.isArray(p) ? {x:p[0], y:p[1]} : p;
const usable = p => Number.isFinite(p?.x) && Number.isFinite(p?.y);
const distance = (a,b) => Math.hypot(a.x-b.x, a.y-b.y);
const facing = (a,b,previous) => Math.abs(b.x-a.x) < .05 ? previous : b.x < a.x ? 'left' : 'right';

// Sample by distance along the supplied walkable path. Corners and intermediate
// waypoints stay intact. Nothing here chooses a shortcut across the scenery.
function track(points, length, progress, initialFacing) {
  const travelled = length * clamp(progress);
  let remaining = travelled, direction = initialFacing;
  for (let i=1; i<points.length; i++) {
    const a=points[i-1], b=points[i], span=distance(a,b);
    if (!span) continue;
    direction=facing(a,b,direction);
    if (remaining <= span || i===points.length-1) {
      const t=clamp(remaining/span);
      return {x:a.x+(b.x-a.x)*t, y:a.y+(b.y-a.y)*t, facing:direction, travelled, segment:i, t};
    }
    remaining-=span;
  }
  return {...points[0], facing:direction, travelled, segment:0, t:0};
}

// Time is in seconds. For 'drop', path[0] is on the lid, path[1] on the
// adjoining sand, and dropAt is the permanent ruby's lower edge on the lid.
export function sampleRoadrunnerBeat(kind, elapsed, options={}) {
  const points=(options.path || []).map(point).filter(usable);
  const terminal={bird:null, ruby:null, hideGroundRuby:false, done:true, duration:0};
  if (!points.length) return terminal;
  const start=points[0], gem=point(options.dropAt), drops=kind==='drop';
  const atDoor=kind==='door', initialFacing=options.facing || (drops && usable(gem) ? facing(start,gem,'right') : 'right');
  const lead=drops ? 1.03 : atDoor ? .26 : .07;
  const length=points.reduce((sum,p,i)=>sum+(i ? distance(points[i-1],p) : 0),0);
  const travel=length/(atDoor ? 105 : 77);
  const duration=lead+travel+(atDoor ? .13 : .12);
  const t=options.skip || options.reducedMotion ? duration : Math.max(0,elapsed || 0);
  const progress=travel ? smooth(clamp((t-lead)/travel)) : 1;
  const position=track(points,length,progress,initialFacing);
  if (t>=duration) return {...terminal,duration,bird:atDoor ? null : {...position,pose:'idle'}};
  const result={bird:null,ruby:null,hideGroundRuby:false,done:false,duration};
  if (drops && t<lead) {
    const bend=t<.54 ? smooth(clamp((t-.17)/.3)) : 1-smooth(clamp((t-.73)/.28));
    result.bird={...start,facing:initialFacing,pose:'offer',bend,carrying:t<.49};
    result.hideGroundRuby=t<.77;
    if (usable(gem) && t>=.49 && t<.77) {
      const u=clamp((t-.49)/.28), side=initialFacing==='left'?-1:1;
      const beakX=start.x+side*11.5, beakY=start.y-3.3;
      result.ruby={x:beakX+(gem.x-beakX)*u, y:beakY+(gem.y-beakY)*u*u, groundY:gem.y};
    }
    return result;
  }
  const moving=length>0 && t>lead && t<lead+travel;
  const firstHop=drops && moving && position.segment===1;
  const descending=atDoor && moving;
  result.bird={...position,carrying:atDoor,pose:moving ? 'run' : 'idle',stride:position.travelled};
  if (firstHop || descending) {
    result.bird.pose=descending ? 'flutter' : 'hop';
    result.bird.lift=(firstHop ? 3.8 : 1.8)*Math.sin(Math.PI*(firstHop ? position.t : progress));
  }
  if (atDoor && t>=lead+travel) result.bird.opacity=1-smooth(clamp((t-lead-travel)/.13));
  return result;
}

const images=new Map();
function imageFor(src) {
  if (typeof Image==='undefined') return null;
  let image=images.get(src);
  if (!image) {
    image=new Image();
    image.src=new URL(src,import.meta.url).href;
    images.set(src,image);
  }
  return image.complete && image.naturalWidth ? image : null;
}
// Each anchor was measured at the weight-bearing toes, not the silhouette's
// geometric center. Changing the pose no longer skates the stationary foot.
const idleFrames = [
  {source:poses,box:[0,0,216,156],foot:[124,148],scale:.139},
  {source:poses,box:[216,0,216,156],foot:[110,148],scale:.139},
  {source:poses,box:[432,0,216,156],foot:[112,148],scale:.139},
];
const running = [
  {source:story,box:[488,385,270,165],foot:[150,158],scale:.106},
  {source:story,box:[765,385,255,165],foot:[132,158],scale:.106},
];
const flight={source:detail,box:[780,545,750,460],foot:[430,425],scale:.04};
const rubyRegion=[80,588,109,105];
function stamp(ctx,frame,resolve) {
  const image=resolve(frame.source);
  if (!image) return false;
  const [fx,fy]=frame.foot, [, , w,h]=frame.box, s=frame.scale;
  ctx.drawImage(image,...frame.box,-fx*s,-fy*s,w*s,h*s);
  return true;
}
function jewel(ctx,x,y,width,resolve) {
  const image=resolve(story);
  if (!image) return false;
  ctx.drawImage(image,...rubyRegion,x-width/2,y-width*.91,width,width*.91);
  return true;
}
function shadow(ctx,x,y,rx,ry,alpha) {
  ctx.fillStyle='rgba(41,28,19,'+alpha+')';
  ctx.beginPath();ctx.ellipse(x,y,rx,ry,-.04,0,Math.PI*2);ctx.fill();
}

export function drawTowerBox(ctx,resolve=imageFor) {
  const image=resolve(box);
  if (!image) return false;
  ctx.drawImage(image,168,157,34,14);
  return true;
}
export function drawRoadrunnerRuby(ctx,ruby,resolve=imageFor) {
  if (!ruby) return false;
  ctx.save();
  if (Number.isFinite(ruby.groundY)) shadow(ctx,ruby.x,ruby.groundY,2.1,.5,.21);
  const painted=jewel(ctx,ruby.x,ruby.y,ruby.width || 4.1,resolve);
  ctx.restore();
  return painted;
}

export function drawRoadrunner(ctx,bird,time=0,reducedMotion=false,resolve=imageFor) {
  if (!usable(bird)) return false;
  const pose=bird.pose || 'idle', lift=bird.lift || 0;
  const idleClock=reducedMotion ? 0 : (time + (bird.phase || 0)) % 8.7;
  const scratch=pose==='idle' && !bird.carrying && idleClock>7.48 && idleClock<8.33;
  let frame=idleFrames[0];
  if (pose==='run') frame=running[Math.floor((bird.stride || 0)/6.3)%2];
  else if (pose==='flutter') frame=flight;
  else if (pose==='hop') frame=running[1];
  else if (pose==='offer' && bird.bend>.5) frame=idleFrames[1];
  else if (scratch) frame=idleClock>7.68 && idleClock<8.1 ? idleFrames[2] : idleFrames[1];
  ctx.save();
  ctx.globalAlpha*=bird.opacity ?? 1;
  ctx.translate(bird.x,bird.y);
  if (bird.facing==='left') ctx.scale(-1,1);
  if (pose!=='flutter') shadow(ctx,0,.4,lift ? 3.7 : 4.5,lift ? .7 : 1.05,lift ? .15 : .25);
  ctx.translate(0,-lift);
  if (pose==='offer') ctx.rotate(.055*(bird.bend || 0));
  const painted=stamp(ctx,frame,resolve);
  if (bird.carrying && pose!=='flutter') {
    const dipped=frame===idleFrames[1];
    jewel(ctx,dipped ? 11.5 : 9,dipped ? -3.3 : -12.5,3.5,resolve);
  }
  // The pupil occupies less than one logical pixel; briefly cover just the
  // eye with the lid colour while standing, without moving the head or feet.
  if (frame===idleFrames[0] && idleClock>3.21 && idleClock<3.34) {
    ctx.fillStyle='#957244';ctx.fillRect(4.05,-15.25,.82,.42);
  }
  ctx.restore();
  return painted;
}

const lensBuffers=new WeakMap();
function lensBuffer(canvas,width,height) {
  let buffer=lensBuffers.get(canvas);
  if (!buffer || buffer.canvas.width<width || buffer.canvas.height<height) {
    const surface=canvas.ownerDocument?.createElement('canvas') || new OffscreenCanvas(width,height);
    surface.width=width;
    surface.height=height;
    buffer=surface.getContext('2d');
    lensBuffers.set(canvas,buffer);
  }
  return buffer;
}

// Sample the completed world frame before darkening it. The crop uses backing
// pixels; all destination geometry still uses the game's 480 × 288 space.
export function drawBirdThroughOptics(ctx,elapsed,duration,_propImage,feet) {
  if (!usable(feet) || !(elapsed>0 && elapsed<duration)) return false;
  const canvas=ctx.canvas, sx=canvas.width/480, sy=canvas.height/288;
  if (!sx || !sy) return false;
  const strength=smooth(clamp(Math.min(elapsed/.22,(duration-elapsed)/.28)));
  const span=50+12*(1-strength);
  const pw=Math.ceil(span*sx), ph=Math.ceil(span*sy);
  const sample=lensBuffer(canvas,Math.ceil(62*sx),Math.ceil(62*sy));
  const x=Math.round((feet.x-2-span/2)*sx), y=Math.round((feet.y-9-span/2)*sy);
  const left=Math.max(0,x), top=Math.max(0,y);
  const width=Math.min(canvas.width,x+pw)-left, height=Math.min(canvas.height,y+ph)-top;
  if (width<=0 || height<=0) return false;
  // An animal near the screen edge stays centered. Beyond the painting the
  // scope falls into shadow instead of wrapping to unrelated terrain.
  sample.fillStyle='#161611';
  sample.fillRect(0,0,pw,ph);
  sample.drawImage(canvas,left,top,width,height,left-x,top-y,width,height);

  const cx=240, cy=142, radius=101+4*strength;
  ctx.save();
  ctx.globalAlpha*=strength;
  ctx.fillStyle='rgba(12,14,12,.975)';
  ctx.fillRect(0,0,480,288);
  ctx.save();
  ctx.beginPath();ctx.arc(cx,cy,radius,0,Math.PI*2);ctx.clip();
  ctx.imageSmoothingEnabled=true;
  ctx.drawImage(sample.canvas,0,0,pw,ph,cx-radius,cy-radius,radius*2,radius*2);
  const glass=ctx.createRadialGradient(cx-2,cy-3,radius*.58,cx,cy,radius);
  glass.addColorStop(0,'rgba(23,31,26,0)');
  glass.addColorStop(.66,'rgba(22,29,24,.16)');
  glass.addColorStop(1,'rgba(12,16,14,.71)');
  ctx.fillStyle=glass;ctx.fillRect(cx-radius,cy-radius,radius*2,radius*2);
  ctx.restore();

  const rim=ctx.createLinearGradient(cx-radius,cy-radius,cx+radius,cy+radius);
  rim.addColorStop(0,'#926f45');rim.addColorStop(.27,'#493b2c');
  rim.addColorStop(.58,'#27251f');rim.addColorStop(1,'#665139');
  ctx.strokeStyle=rim;ctx.lineWidth=2.8;
  ctx.beginPath();ctx.arc(cx,cy,radius+1.2,0,Math.PI*2);ctx.stroke();
  ctx.restore();
  return true;
}
