import { paintHeroSprite } from './hero-sprites.js';
export { heroArtStatus } from './hero-sprites.js';
// Small deterministic pose model shared by the four directional renderers.
// Positions are logical canvas pixels. Gait is distance-driven by the controller.
const clamp = value => Math.max(0, Math.min(1, value));
export function characterPose(phase = 0, animation = {}) {
  const suppliedBlend = animation.blend ?? (animation.moving ? 1 : 0);
  const amount = Number.isFinite(suppliedBlend) ? clamp(suppliedBlend) : 0;
  const walking = Boolean(animation.moving);
  const time = Number.isFinite(animation.time) ? animation.time : 0;
  const safePhase = Number.isFinite(phase) ? phase : 0;
  const gait = Math.sin(safePhase), opposite = Math.sin(safePhase + Math.PI);
  const suppliedProgress = animation.actionProgress ?? 0;
  const progress = Number.isFinite(suppliedProgress) ? clamp(suppliedProgress) : 0;
  const gesture = Math.sin(progress * Math.PI);
  const pickup = animation.action === 'pickup' ? gesture : 0;
  const inspect = animation.action === 'inspect' ? gesture : 0;
  return {
    stride: gait * amount,
    leftLift: Math.max(0, gait) * 1.65 * amount,
    rightLift: Math.max(0, opposite) * 1.65 * amount,
    bob: Math.abs(Math.sin(safePhase * 2)) * .55 * amount,
    breathe: Math.sin(time * 1.9) * .18 * (1 - amount),
    coat: Math.sin(safePhase - .55) * .8 * amount,
    pickup,
    inspect,
    crouch: pickup * 3.8,
    weightShift: gait * .32 * amount,
    inertia: gait * (.22 * amount + (walking ? 0 : .95 * amount * (1 - amount))),
    settling: !walking && amount > .001,
    moving: walking && amount > .02,
  };
}

// Ground coordinates stay independent of breathing, head bob and crouching.
// Lift fades with the controller's distance-driven blend; clock time cannot
// invent another step after movement has stopped against a wall.
export function characterGrounding(facing = 'down', phase = 0, animation = {}) {
  const pose = characterPose(phase, animation), side = facing === 'left' || facing === 'right';
  const mirror = facing === 'left' ? -1 : 1;
  const feet = side
    ? [{ x: (-.8 - pose.stride * 3 + .5) * mirror, lift: pose.rightLift },
      { x: (.9 + pose.stride * 3 + .5) * mirror, lift: pose.leftLift }]
    : [{ x: -2.4 + pose.stride * .55 + .5, lift: pose.leftLift },
      { x: 1.8 - pose.stride * .55 + .5, lift: pose.rightLift }];
  return { pose, feet: feet.map(foot => ({ ...foot, y: 1.3, weight: 1 - Math.min(1, foot.lift / 1.65) })),
    cast: { x: 3.3, y: 2.3, rx: 8.2, ry: 2.4, rotation: .27 } };
}
function mix(a,b,amount) {
  const rgb = value => /^#[0-9a-f]{6}$/i.test(value) ? value.slice(1).match(/../g).map(part => parseInt(part,16)) : [188,160,113];
  const base=rgb(a),other=rgb(b);
  return '#'+base.map((channel,i)=>Math.round(channel+(other[i]-channel)*amount).toString(16).padStart(2,'0')).join('');
}
export function characterLighting(facing = 'down', coat = '#bca071') {
  return { // Upper-left warm sun is fixed in world space, never mirror-flipped.
    localLightX: facing === 'left' ? 1 : -1,
    light: mix(coat,'#eddaab',.38), mid: coat,
    shade: mix(coat,'#40584d',.37), crease: mix(coat,'#4b5142',.45),
    reflected: mix(coat,'#a6b5a0',.16),
  };
}
function groundShadow(c,grounding) {
  const cast=grounding.cast;
  c.fillStyle='#1c302619';c.beginPath();c.ellipse(cast.x,cast.y,cast.rx+1,cast.ry+.6,cast.rotation,0,Math.PI*2);c.fill();
  c.fillStyle='#1a2e2524';c.beginPath();c.ellipse(cast.x-.6,cast.y-.3,cast.rx-1,cast.ry,cast.rotation,0,Math.PI*2);c.fill();
  for(const foot of grounding.feet){
    c.fillStyle=`rgba(20,35,28,${.07+foot.weight*.23})`;
    c.beginPath();c.ellipse(foot.x,foot.y,1.65+foot.weight*.6,.45+foot.weight*.18,0,0,Math.PI*2);c.fill();
  }
}

const snap = value => Math.round(value * 2) / 2;
function pixel(c,x,y,w,h,color) {
  c.fillStyle=color;c.fillRect(snap(x),snap(y),w,h);
}
function shape(c,points,color) {
  c.fillStyle=color;c.beginPath();
  points.forEach(([x,y],i)=>i?c.lineTo(snap(x),snap(y)):c.moveTo(snap(x),snap(y)));
  c.closePath();c.fill();
}
function limb(c,a,b,width,color) {
  const dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy)||1;
  const nx=dy/length*width/2,ny=-dx/length*width/2;
  shape(c,[[a[0]-nx,a[1]-ny],[a[0]+nx,a[1]+ny],[b[0]+nx,b[1]+ny],[b[0]-nx,b[1]-ny]],color);
}
const palette={skin:'#c49b75',skinLight:'#e2bc8c',skinShade:'#967255',trouser:'#4b5155',trouserShade:'#323b42',boot:'#3a3029',bootLight:'#72604b',shirt:'#e4d8bc',hair:'#59402b',hat:'#a49168',hatShade:'#6e6248',hatLight:'#c9b388'};

export function paintCharacter(c,x,y,color='#bca071',facing='down',phase=0,elder=false,animation={}) {
  const ground=characterGrounding(facing,phase,animation),pose=ground.pose,side=facing==='left'||facing==='right';
  const coat=elder?'#777489':color,light=characterLighting(facing,coat);
  c.save();c.translate(snap(x),snap(y));c.imageSmoothingEnabled=false;
  if(!animation.airborne)groundShadow(c,ground);
  if(!elder&&paintHeroSprite(c,facing,phase,pose,animation)){c.restore();return;}
  if(side){if(facing==='left')c.scale(-1,1);paintSide(c,pose,coat,elder,light);}else paintFront(c,pose,coat,facing==='up',elder,light);
  c.restore();
}
function leg(c,x,hipY,travel,lift,front) {
  const knee=[x+travel*.42,hipY*.5-lift*.45],ankle=[x+travel,-lift];
  limb(c,[x,hipY],knee,2.5,front?palette.trouser:palette.trouserShade);
  limb(c,knee,ankle,2.2,front?palette.trouser:palette.trouserShade);
  pixel(c,ankle[0]-.9,ankle[1]-.1,3.5,1.6,palette.boot);
  pixel(c,ankle[0]-.1,ankle[1]-.1,2.7,.5,front?palette.bootLight:'#4f4437');
  pixel(c,ankle[0]-1,ankle[1]+1.1,3.6,.45,'#424735');
  limb(c,[x-.55,hipY+1],[knee[0]-.55,knee[1]],.5,front?'#7a8177':'#4f6058');
}
function arm(c,x,y,travel,gesture,front,coat,side=false) {
  const elbow=[x+(side?travel*.7:travel*.18),y+4+(side?0:travel*.35)-gesture*1.7];
  const hand=[x+(side?travel:travel*.3)+gesture*(side?3:1.2),y+8+(side?0:travel*.65)-gesture*6.8];
  limb(c,[x,y],elbow,2.2,front?coat:'#76694f');
  limb(c,elbow,[hand[0],hand[1]-1],1.8,front?coat:'#857454');
  pixel(c,hand[0]-.8,hand[1]-.7,1.8,2.4,front?palette.skinLight:palette.skin);
}
function paintSide(c,p,coat,elder,light) {
  const hip=-10+p.crouch*.25;
  // Opposite limbs are intentionally occluded by the coat in profile.
  leg(c,-.8,hip,-p.stride*3,p.rightLift,false);
  arm(c,-1,-24+p.crouch,-p.stride*2.8,0,false,coat,true);
  leg(c,.9,hip,p.stride*3,p.leftLift,true);
  c.save();c.translate(p.pickup*2.2+p.weightShift+p.inertia,-p.bob+p.breathe+p.crouch);
  shape(c,[[-3,-26],[1.5,-26],[3,-23],[3,-16],[4+p.coat,-10],[-3+p.coat*.4,-10],[-3.5,-18]],light.shade);
  shape(c,[[-2.5,-25],[1,-25],[2,-22],[1.5,-17],[3+p.coat,-10.5],[-2.5+p.coat*.4,-10.5],[-2.5,-19]],coat);
  const litX=light.localLightX<0?-2.5:1.1,shadeX=light.localLightX<0?1.1:-2.5;
  shape(c,[[litX,-24.7],[litX+1.5,-23],[litX+1.5,-18],[litX+2,-11],[litX,-11]],light.light);
  shape(c,[[shadeX,-23],[shadeX+1.4,-21],[shadeX+1.2,-16],[shadeX+2,-10.7],[shadeX,-10.7]],light.shade);
  pixel(c,-.6,-21,.6,8,light.reflected);pixel(c,.5,-15,.6,3,light.crease);
  pixel(c,-1.5,-24,3,.7,light.light);
  pixel(c,-1.5,-13,2,1,light.crease);pixel(c,-1,-25,2.5,1.5,palette.shirt);
  // Face, ear and brim produce a distinct side silhouette.
  pixel(c,-2,-32,5,7,palette.skin);
  shape(c,[[0,-31],[2.5,-31],[2.5,-29],[4,-28.5],[4,-27.5],[2.5,-27.5],[2.5,-25],[0,-25]],light.localLightX>0?palette.skinLight:palette.skin);
  pixel(c,light.localLightX<0?-1.6:1,-30.8,1.4,2.6,palette.skinLight);
  pixel(c,1,-26,1.4,1,palette.skinShade);
  pixel(c,1.7,-29.5,1,.7,'#39362d');pixel(c,-1.5,-29,1.3,2,palette.skinShade);
  pixel(c,-3,-32,3,5,elder?'#b9b8ae':palette.hair);
  if(!elder){pixel(c,-3,-34,6,3,palette.hatShade);pixel(c,-2.5,-35,4.5,2.5,palette.hat);pixel(c,-4,-32,9,1,palette.hatShade);pixel(c,light.localLightX<0?-2.5:0,-35,2.5,.7,palette.hatLight);pixel(c,-2.5,-31,5,.6,'#796b50');pixel(c,-2.5,-32.5,5,.5,'#4e4636');}
  else{pixel(c,-3,-33,6,2,'#cdccc1');pixel(c,-4,-31,2,3,'#a8a89f');}
  arm(c,0,-23,p.stride*3.1,p.inspect*.9+p.pickup*.35,true,coat,true);
  // A coat hem displaced opposite the leading foot suggests cloth lag.
  pixel(c,-2+p.coat*.5,-10.5,4.5,1,light.crease);
  pixel(c,light.localLightX<0?-2:1,-12,1.2,.6,light.reflected);
  c.restore();
}
function paintFront(c,p,coat,back,elder,light) {
  const hip=-10+p.crouch*.22;
  // Front/back steps change foot depth and lift rather than stretching trousers.
  leg(c,-2.4,hip,p.stride*.55,p.leftLift,true);
  leg(c,1.8,hip,-p.stride*.55,p.rightLift,false);
  c.save();c.translate(p.pickup*.8+p.weightShift+p.inertia*.6,-p.bob+p.breathe+p.crouch);
  const shoulder=-25;
  arm(c,-5,shoulder+1,-p.stride*2.1,0,false,coat);
  arm(c,4.3,shoulder+1,p.stride*2.1,p.inspect*.8,true,coat);
  shape(c,[[-4,-26],[3.5,-26],[4.8,-23],[4,-17],[5+p.coat*.6,-10.5],[1,-10],[0,-11],[-1,-10],[-5+p.coat*.6,-10.5],[-4.2,-17],[-5,-23]],light.shade);
  shape(c,[[-3.5,-25.5],[3,-25.5],[4,-23],[3.5,-17],[4.2+p.coat*.6,-11],[.5,-10.7],[0,-13],[-.7,-10.7],[-4.3+p.coat*.6,-11],[-3.5,-18],[-4,-23]],coat);
  shape(c,[[-3.5,-25],[-.5,-25],[-1.6,-20],[-1.2,-14],[-2.2,-11],[-4,-11],[-3.5,-18]],light.light);
  shape(c,[[2,-24],[3,-23],[3.2,-18],[4.2+p.coat*.6,-11],[1.6,-11],[1.2,-17]],light.shade);
  pixel(c,-3,-24,5,.55,light.light);pixel(c,1.5,-22,.5,8,light.reflected);
  pixel(c,-2.5,-15,.5,3,light.crease);pixel(c,3,-14,.6,3,light.crease);
  if(back){
    pixel(c,-.5,-24,.5,11,light.crease);pixel(c,-3,-24,6,.5,light.light);
    shape(c,[[-2,-23],[1,-23],[.5,-19],[-1.5,-20]],light.reflected);
    shape(c,[[-3.5,-31],[3,-31],[3,-26],[1.5,-25],[-2,-25],[-3.5,-27]],elder?'#bcbcb0':palette.hair);
    pixel(c,-3,-28,5,1,elder?'#d2d1c4':'#6e5135');pixel(c,2,-30,.7,4,elder?'#999f94':'#483f2f');
  }else{
    shape(c,[[-2.5,-25],[2,-25],[1,-22],[0,-21],[-1,-22]],palette.shirt);
    pixel(c,0,-21,.7,9,'#e2d1a6');pixel(c,.6,-18,.5,.7,'#6f6147');pixel(c,.6,-14,.5,.7,'#6f6147');
    pixel(c,-3,-32,6,7,palette.skin);pixel(c,-2.5,-31,3,5.5,palette.skinLight);
    pixel(c,1.5,-30,1,4.5,palette.skinShade);pixel(c,-2.5,-31,5,1,'#ab8b64');
    pixel(c,-3,-30,1.3,3,elder?'#a7a89e':palette.hair);pixel(c,2,-30,1,3,palette.skinShade);
    pixel(c,-1.8,-28.5,.7,.7,'#3b382e');pixel(c,1,-28.5,.7,.7,'#3b382e');pixel(c,-.2,-27.5,.7,1,palette.skinShade);pixel(c,-.7,-25.7,1.5,.5,'#a47c59');
  }
  if(!elder){pixel(c,-3.5,-34,7,3,palette.hatShade);pixel(c,-2.7,-35,5.5,2.5,palette.hat);pixel(c,-5,-32,10,1,palette.hatShade);pixel(c,-2.5,-35,3,.7,palette.hatLight);pixel(c,-3,-31,6,.65,'#9a815d');pixel(c,-3.5,-32.5,7,.5,'#554b37');}
  else{pixel(c,-3,-33,6,2,'#cfcdc0');pixel(c,-4,-31.5,1.5,4,'#b1b2a6');}
  // Raised inspecting hand crosses the coat rather than waving beside it.
  if(p.inspect>.1&&!back){const raise=p.inspect;limb(c,[4,-21],[3-raise*2,-17-raise*3],1.8,coat);pixel(c,2-raise*2,-18-raise*3,1.8,2,palette.skinLight);}
  c.restore();
}
