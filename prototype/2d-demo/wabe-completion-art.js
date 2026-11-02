// Original generated RGBA atlases are sampled directly, with measured source
// regions and common ground anchors. Supplied game-clock time freezes on pause.
const image = file => {
  if (typeof Image !== 'function') return null;
  const sheet = new Image(); sheet.src = new URL(file, import.meta.url).href; return sheet;
};
const boy = image('./assets/wabe-giant-boy-v2.png');
const props = image('./assets/wabe-completion-props-v1.png');
const clove = image('./assets/wabe-garlic-clove-v1.png');
const ready = sheet => Boolean(sheet?.complete && sheet.naturalWidth);
export const COMPLETION_BOY_SCALE = 130 / 450;
export const COMPLETION_BOY_FRAMES = Object.freeze([
  {pose:'rest',source:[65,151,488,466],foot:[312,607]},
  {pose:'dip',source:[612,162,494,459],foot:[865,611]},
  {pose:'lift',source:[1156,150,476,469],foot:[1391,609]},
  {pose:'blow',source:[1697,145,467,473],foot:[1923,608]},
]);
export const COMPLETION_PROP_REGIONS = Object.freeze({
  dish:[9,156,1025,527],mushroom:[1430,23,738,675],
});
export const COMPLETION_GARLIC_REGION = Object.freeze([135,45,1295,930]);
const point = p => Array.isArray(p) ? {x:p[0],y:p[1]} : p;
const ease = value => value * value * (3 - 2 * value);
const clamp = value => Math.max(0,Math.min(1,value));
const stages = Object.freeze([
  {at:0,end:3.2,frame:0,previous:0},
  {at:3.2,end:5.5,frame:1,previous:0},
  {at:5.5,end:6.8,frame:2,previous:1},
  {at:6.8,end:9.7,frame:3,previous:2},
  {at:9.7,end:12,frame:0,previous:3},
]);

// Read-only evidence for rendering, render_game_to_text and pause checks. No
// bubble here is a GameState item; the current chapter remains its sole owner.
export function completionBoyMotion(time = 0) {
  const clock = Number.isFinite(time) ? Math.max(0,time) : 0;
  const phase = clock % 12;
  const stage = stages.find(value => phase < value.end) || stages[0];
  const blend = stage.previous === stage.frame ? 1 : ease(clamp((phase-stage.at)/.36));
  const wand = [
    {x:11,y:-48},{x:-44,y:-2},{x:16,y:-96},{x:17,y:-97},
  ];
  const from = wand[stage.previous], to = wand[stage.frame];
  const bubbles = [7.25,7.95,8.65].map((birth,index) => {
    const age = phase-birth,life = 2.95;
    if (age < 0 || age >= life) return null;
    const growth = clamp(age/.48), travel = Math.max(0,age-.48);
    return {
      x:17+growth*3+travel*(15+index*1.6),
      y:-97-travel*(9+index*.6)+Math.sin(travel*2.3+index)*travel*.9,
      radius:(2.2+index*.7)*ease(growth),
      alpha:clamp((life-age)/.5),attached:age<.48,
    };
  }).filter(Boolean);
  return {
    phase,pose:COMPLETION_BOY_FRAMES[stage.frame].pose,frame:stage.frame,
    previous:stage.previous,blend,
    wand:{x:from.x+(to.x-from.x)*blend,y:from.y+(to.y-from.y)*blend},
    mouth:{x:17,y:-97},bubbles,
  };
}

function shadow(c,x,y,rx,ry,opacity=.18) {
  c.save(); c.fillStyle=`rgba(17,32,25,${opacity})`;
  c.beginPath(); c.ellipse(x,y,rx,ry,0,0,Math.PI*2); c.fill(); c.restore();
}
function characterFrame(c,index,x,y,alpha) {
  if (!ready(boy) || alpha <= 0) return;
  const {source,foot} = COMPLETION_BOY_FRAMES[index],scale = COMPLETION_BOY_SCALE;
  const [sx,sy,sw,sh] = source;
  c.save(); c.globalAlpha *= alpha; c.imageSmoothingEnabled = true;
  c.drawImage(boy,...source,x+(sx-foot[0])*scale,y+(sy-foot[1])*scale,sw*scale,sh*scale);
  c.restore();
}
let poseSurface;
function poseBuffer() {
  if (poseSurface) return poseSurface;
  const surface = typeof OffscreenCanvas === 'function'
    ? new OffscreenCanvas(240,176)
    : typeof document !== 'undefined' ? document.createElement('canvas') : null;
  if (!surface) return null;
  surface.width=240;surface.height=176;
  const context=surface.getContext('2d');
  if (!context) return null;
  poseSurface={surface,context};return poseSurface;
}
function mixedCharacter(c,motion,x,y) {
  const buffer=poseBuffer();
  if (!buffer) {
    // Non-browser consumers without a raster surface use an opaque pose. A
    // source-over crossfade would incorrectly reveal scenery through the body.
    characterFrame(c,motion.blend<.5?motion.previous:motion.frame,x,y,1);return;
  }
  const b=buffer.context;
  b.save();b.setTransform(1,0,0,1,0,0);b.clearRect(0,0,240,176);b.globalAlpha=1;
  b.globalCompositeOperation='source-over';
  characterFrame(b,motion.previous,90,145,1-motion.blend);
  b.globalCompositeOperation='lighter';
  characterFrame(b,motion.frame,90,145,motion.blend);
  b.restore();
  // Blend in transparent isolation, then composite the completed body once.
  c.drawImage(buffer.surface,x-90,y-145);
}
function stamp(c,key,x,y,width) {
  if (!ready(props)) return false;
  const [sx,sy,sw,sh] = COMPLETION_PROP_REGIONS[key],scale=width/sw;
  c.save(); c.translate(x-width/2,y-sh*scale); c.scale(scale,scale);
  // The independently generated props have clear alpha but their source
  // rectangles overlap at empty corners. These sampling masks omit the other
  // prop without changing or flattening the original generated PNG.
  if (key === 'mushroom') {
    c.beginPath(); c.moveTo(0,0); c.lineTo(sw,0); c.lineTo(sw,sh);
    c.lineTo(60,sh); c.lineTo(60,347); c.lineTo(0,347); c.closePath(); c.clip();
  }
  c.imageSmoothingEnabled = true;
  c.drawImage(props,sx,sy,sw,sh,0,0,sw,sh); c.restore(); return true;
}
function bubble(c,p,origin) {
  if (p.radius < .05 || p.alpha <= 0) return;
  const x=origin.x+p.x,y=origin.y+p.y,r=p.radius;
  c.save(); c.globalAlpha *= p.alpha; c.lineWidth=.48;
  const film=c.createLinearGradient(x-r,y-r,x+r,y+r);
  film.addColorStop(0,'#e9e5c5');film.addColorStop(.35,'#b2d9c1');
  film.addColorStop(.68,'#b8a5c8');film.addColorStop(1,'#e4d29c');
  c.strokeStyle=film;c.fillStyle='rgba(197,221,207,.09)';
  c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fill();c.stroke();
  c.strokeStyle='rgba(250,246,219,.7)';c.lineWidth=.55;
  c.beginPath();c.arc(x-r*.12,y-r*.1,r*.72,Math.PI*1.06,Math.PI*1.43);c.stroke();
  c.restore();
}

export function renderCompletionSprite(c,object,state,time=0) {
  const v=object.visualOptions||{},p=point(v.drawAt)||object;
  if (object.kind === 'completion_boy') {
    if (!ready(boy)) return false;
    const motion=completionBoyMotion(time);
    shadow(c,p.x+11,p.y-3,51,7,.16);
    if (motion.previous !== motion.frame && motion.blend < 1) {
      mixedCharacter(c,motion,p.x,p.y);
    } else characterFrame(c,motion.frame,p.x,p.y,1);
    motion.bubbles.forEach(value=>bubble(c,value,p));
    return true;
  }
  if (object.kind === 'completion_dish') {
    shadow(c,p.x,p.y,21,3,.17); return stamp(c,'dish',p.x,p.y,47);
  }
  if (object.kind === 'completion_mushroom') {
    shadow(c,p.x,p.y,20,4,.15); return stamp(c,'mushroom',p.x,p.y,77);
  }
  if (object.kind === 'garlic') {
    if (!ready(clove)) return false;
    shadow(c,p.x,p.y,4,1,.2);
    const [sx,sy,sw,sh]=COMPLETION_GARLIC_REGION,width=11,height=width*sh/sw;
    c.drawImage(clove,sx,sy,sw,sh,p.x-width/2,p.y-height,width,height);return true;
  }
  return [
    'completion_oak','completion_chasm','completion_toadstool',
    'completion_headphones','completion_herbs','completion_thyme','completion_river',
  ].includes(object.kind);
}
export const completionArtStatus = () => ready(boy) && ready(props) && ready(clove) ? 'loaded' : 'loading';
