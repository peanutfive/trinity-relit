
// The same renderer is used by world objects and transient story actors.
// An atlas renderer may return true after drawing; unsupported kinds fall back here.
let spriteRenderer = null;
export function setStorySpriteRenderer(renderer) {
  spriteRenderer = typeof renderer === 'function' ? renderer : null;
}
const has = (state, flag) => state?.hasFlag?.(flag)
  ?? (state?.flags instanceof Set ? state.flags.has(flag) : (state?.flags || []).includes(flag));
const at = (state, item) => state?.itemAt?.(item) ?? state?.itemLoc?.[item];
const px = (c,x,y,w,h,color) => { c.fillStyle=color;c.fillRect(Math.round(x*2)/2,Math.round(y*2)/2,w,h); };
function polygon(c,points,color) {
  c.fillStyle=color;c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fill();
}
function line(c,points,color,width=.7) {
  c.strokeStyle=color;c.lineWidth=width;c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.stroke();
}
function ellipse(c,x,y,rx,ry,color) {
  c.fillStyle=color;c.beginPath();c.ellipse(x,y,Math.max(.01,rx),Math.max(.01,ry),0,0,Math.PI*2);c.fill();
}
function shadow(c,x,y,rx=9,ry=2,alpha=.25) { ellipse(c,x+2,y+1,rx,ry,`rgba(17,34,28,${alpha})`); }
function glint(c,x,y,strength=.5) {
  c.save();c.globalAlpha*=strength;c.strokeStyle='#fff1cb';c.lineWidth=.5;
  c.beginPath();c.moveTo(x-2,y);c.lineTo(x+2,y);c.moveTo(x,y-2);c.lineTo(x,y+2);c.stroke();c.restore();
}

function pigeon(c,x,y,time,options={}) {
  const flap=options.flap || 0, peck=options.peck || 0;
  c.save();c.translate(x,y);if(options.flip)c.scale(-1,1);
  shadow(c,0,2,4,1,.18);
  polygon(c,[[-4,-2],[0,-4],[4,-3],[5,0],[2,2],[-3,1]],'#8a989b');
  polygon(c,[[-4,-2],[1,-3],[2,0],[-3,0]],'#b6c0ba');
  polygon(c,[[-3,0],[-6,2],[-3,2]],'#5c6d73');
  if(flap){const h=flap*5;polygon(c,[[-1,-2],[-5,-h-3],[0,-4]],'#b9c3ba');line(c,[[-4,-h-2],[-2,-2]],'#687b81');}
  const hx=3+peck,hy=-4+peck*3;
  ellipse(c,hx,hy,1.8,2,'#566e71');px(c,hx-.5,hy-1,1,1,'#b1bba6');px(c,hx+1.5,hy,2,.7,'#b7a477');
  px(c,hx+.5,hy-.6,.5,.5,'#202c28');
  line(c,[[-1,1],[-1,3],[0,3]],'#a27d69',.55);line(c,[[2,1],[2,3],[3,3]],'#a27d69',.55);
  c.restore();
}
function roadrunner(c,x,y,time,options={}) {
  const gait=Math.sin(time*19), flap=options.flying?Math.sin(time*15):0;
  c.save();c.translate(x,y);if(options.flip)c.scale(-1,1);
  shadow(c,0,2,9,1.8,.22);
  polygon(c,[[-5,-8],[-14,-9],[-19,-12],[-16,-7],[-6,-3]],'#675e4d');
  line(c,[[-18,-11],[-7,-6]],'#b8b093',.65);
  polygon(c,[[-7,-8],[0,-11],[6,-9],[5,-3],[-3,-2],[-8,-5]],'#8e8d74');
  polygon(c,[[-5,-7],[1,-9],[4,-7],[0,-4]],'#b8b39a');
  if(options.flying)polygon(c,[[-2,-8],[-11,-13-flap*5],[1,-11],[9,-13+flap*5],[5,-6]],'#9f9d85');
  polygon(c,[[3,-8],[5,-16],[8,-17],[10,-14],[8,-9]],'#a4aa8a');
  polygon(c,[[5,-16],[5,-20],[7,-18],[8,-21],[9,-17],[11,-16]],'#797a62');
  polygon(c,[[9,-15],[16,-13],[10,-12]],'#b99c6a');px(c,8,-15,1,1,'#252d27');
  line(c,[[-2,-3],[-2+gait*3,2],[gait*4,2]],'#74674e',.8);
  line(c,[[3,-4],[3-gait*3,1],[6-gait*4,1]],'#8c7b5a',.8);
  if(options.ruby!==false)drawRuby(c,14,-10,time,.5);
  c.restore();
}
function drawRuby(c,x,y,time,scale=1) {
  c.save();c.translate(x,y);c.scale(scale,scale);
  shadow(c,0,1,4,1.1,.2);
  polygon(c,[[-4,-4],[-1,-7],[3,-6],[5,-3],[1,1],[-3,-1]],'#67272c');
  polygon(c,[[-4,-4],[-1,-7],[1,-3],[-3,-1]],'#c7544d');
  polygon(c,[[-1,-7],[3,-6],[1,-3]],'#f39b77');
  polygon(c,[[1,-3],[5,-3],[1,1]],'#b5373b');
  line(c,[[-1,-7],[1,-3],[1,1]],'#e77b66',.5);
  glint(c,-1,-5,.4+.25*Math.sin(time*2.5));c.restore();
}
function paper(c,x,y,time,opened=false,unfold=0) {
  c.save();c.translate(x,y);shadow(c,0,2,8,1.4,.18);
  const u=Math.max(opened?1:0,unfold);
  if(u>.03){const w=5+u*8,h=4+u*3;
    polygon(c,[[-w,-h-5],[w,-h-4],[w-1,2],[-w+1,1]],'#d5cdb0');
    polygon(c,[[-w+1,-h-4],[w-1,-h-3],[w-2,0],[-w+2,0]],'#ece3c7');
    line(c,[[-w+2,-h/2-2],[w-2,-h/2-1]],'#b7b095',.45);
    line(c,[[0,-h-4],[-.5,1]],'#c9bfa2',.5);
    if(u>.8){for(let i=0;i<3;i++)line(c,[[-w+4,-h+2+i*2.1],[w-4,-h+2+i*2.1]],'#878a78',.35);}
  }else{
    polygon(c,[[-9,-4],[-3,-7],[0,-2],[7,-6],[4,0],[0,1],[-4,0]],'#d6d9c9');
    polygon(c,[[-8,-4],[-1,-4],[0,-11],[3,-8],[1,-1]],'#f0ecd6');
    polygon(c,[[0,-3],[8,-7],[5,-1]],'#ece6cd');line(c,[[-6,-4],[0,-2],[4,-1]],'#afb7a5',.5);
  }
  c.restore();
}
function umbrella(c,x,y,time,options={}) {
  const open=options.open || false;
  c.save();c.translate(x,y);c.rotate(options.rotation||0);
  if(open){
    polygon(c,[[-17,-14],[-12,-23],[-5,-28],[3,-29],[12,-25],[19,-17],[16,-13],[9,-15],[3,-13],[-4,-15],[-10,-13]],'#655f64');
    polygon(c,[[-15,-16],[-10,-23],[-4,-27],[2,-28],[-3,-15],[-9,-16]],'#979087');
    polygon(c,[[2,-28],[10,-24],[16,-18],[10,-16],[4,-15]],'#7e7776');
    line(c,[[-16,-14],[2,-28],[18,-16]],'#b6a993',.6);line(c,[[2,-28],[3,-14]],'#b0a38e',.5);
    line(c,[[2,-28],[2,-4],[4,-1],[7,-3]],'#bcab83',.8);
  }else{
    line(c,[[0,-24],[0,-1],[2,1],[4,-1]],'#bdab82',.85);
    polygon(c,[[0,-22],[-3,-18],[-3,-6],[-1,-3],[2,-6],[2,-18]],'#66666b');
    polygon(c,[[-2,-18],[0,-22],[.5,-5],[-1,-4]],'#98948b');
    line(c,[[0,-24],[1,-26],[4,-26],[5,-24]],'#c8b48b',1.2);
    px(c,4,-26,.7,.7,'#333b33');
  }
  c.restore();
}
function pram(c,x,y,time,state,options={}) {
  const broken=options.broken??has(state,'pram_broken'),open=options.open??has(state,'pram_open');
  c.save();c.translate(x,y);shadow(c,1,2,18,3,.24);
  const roll=options.rolling?time*12:0;
  for(const wx of [-11,11]){
    const wy=broken&&wx===11?3:0;
    ellipse(c,wx,wy,5.4,5.4,'#363c38');ellipse(c,wx,wy,4.2,4.2,'#98998a');ellipse(c,wx,wy,2.9,2.9,'#3e4d46');
    for(let i=0;i<4;i++){const a=roll+i*Math.PI/2;line(c,[[wx,wy],[wx+Math.cos(a)*3.7,wy+Math.sin(a)*3.7]],'#a7ac9b',.55);}
    ellipse(c,wx,wy,1,1,'#c4bda4');
  }
  line(c,[[-12,-1],[-6,-12],[9,-12],[12,-1]],'#949784',1);
  polygon(c,[[-16,-17],[13,-17],[10,-6],[-10,-6]],'#3d4a42');
  polygon(c,[[-14,-16],[11,-16],[8,-8],[-9,-8]],'#748075');
  line(c,[[-14,-16],[10,-16]],'#b2b09a',.8);
  line(c,[[-15,-15],[-21,-23],[-27,-23]],'#999c87',1.2);
  if(!open&&!broken){polygon(c,[[-14,-18],[-10,-28],[-3,-33],[5,-32],[12,-25],[13,-17]],'#4a5750');polygon(c,[[-11,-20],[-7,-28],[-1,-31],[4,-30],[7,-26],[4,-19]],'#7a8779');line(c,[[-9,-27],[1,-30],[10,-24]],'#a3aa94',.65);}
  if(open&&!broken){polygon(c,[[5,-18],[7,-24],[13,-26],[16,-22],[15,-17]],'#5e6e60');line(c,[[6,-19],[12,-24],[15,-19]],'#919d88',.6);}
  if(options.rider||has(state,'in_pram')){ellipse(c,-2,-23,3.1,4,'#d5b58a');px(c,-5,-28,7,2,'#8e805e');polygon(c,[[-7,-18],[-4,-22],[1,-22],[6,-17]],'#bda371');}
  if(broken){line(c,[[-13,-8],[-18,-14],[-23,-12]],'#6a6855',1.2);line(c,[[4,-8],[16,-13],[21,-10]],'#9d9278',1);px(c,-17,-4,3,1,'#b2a68b');}
  if(options.sail)umbrella(c,0,-21,time,{open:true,rotation:.14});
  c.restore();
}
function sundial(c,x,y,state,options={}) {
  shadow(c,x,y,17,3.5,.24);
  polygon(c,[[x-12,y-6],[x+10,y-6],[x+13,y],[x-15,y]],'#969b88');
  polygon(c,[[x-7,y-27],[x+7,y-27],[x+5,y-5],[x-6,y-5]],'#8e9682');
  polygon(c,[[x-7,y-27],[x-2,y-27],[x-1,y-5],[x-6,y-5]],'#c3c3a3');
  ellipse(c,x,y-29,18,6,'#746d50');ellipse(c,x,y-30,17,5.4,'#b4a675');ellipse(c,x,y-30.4,13.6,4,'#d0bd83');
  for(let i=0;i<7;i++){const a=i*Math.PI*2/7;line(c,[[x+Math.cos(a)*11,y-30+Math.sin(a)*2.7],[x+Math.cos(a)*14,y-30+Math.sin(a)*3.8]],'#6e674b',.6);}
  if(options.gnomon!==false&&at(state,'gnomon')==='the_wabe'){
    const fallen=has(state,'gnomon_unscrewed');
    polygon(c,fallen?[[x-5,y-30],[x+5,y-29],[x+3,y-31]]:[[x-5,y-30],[x+4,y-30],[x+2,y-40]],'#83794e');
    line(c,fallen?[[x-4,y-30],[x+3,y-30]]:[[x+2,y-40],[x+4,y-30]],'#e0ce8a',.6);
  }
}
function seatedWoman(c,x,y,time,options={}) {
  const breath=Math.sin(time*1.6)*.15;
  shadow(c,x,y,10,2.2,.23);
  // Folded skirt, shoes and a coat that gathers at the knees.
  px(c,x-6,y-3,4,3,'#413b35');px(c,x+3,y-3,4,3,'#413b35');
  polygon(c,[[x-8,y-14],[x+7,y-14],[x+10,y-3],[x-10,y-3]],'#666575');
  polygon(c,[[x-6,y-13],[x-1,y-12],[x-2,y-4],[x-7,y-4]],'#92909a');
  c.save();c.translate(x,y+breath);
  polygon(c,[[-6,-29],[4,-29],[8,-23],[7,-13],[-8,-13],[-9,-22]],'#777988');
  polygon(c,[[-6,-27],[-1,-26],[-2,-15],[-7,-15]],'#9da0a6');
  line(c,[[-5,-27],[-1,-20],[3,-28]],'#c2c1b0',1.2);
  ellipse(c,-1,-34,4.4,5,'#c8aa8b');polygon(c,[[-5,-35],[-4,-39],[2,-40],[5,-36],[4,-33],[2,-36],[-3,-36]],'#b7b9ae');
  px(c,-4,-34,.7,.7,'#41433b');px(c,.5,-34,.7,.7,'#41433b');line(c,[[-3,-31],[0,-30],[2,-31]],'#947b64',.5);
  line(c,[[-5,-35],[1,-35]],'#9b9e92',.55);line(c,[[2,-35],[4,-34]],'#9b9e92',.55);
  polygon(c,[[-8,-23],[-5,-22],[-4,-17],[0,-16],[-1,-14],[-7,-16]],'#878994');
  polygon(c,[[5,-23],[8,-21],[7,-16],[2,-15],[1,-17],[5,-18]],'#5e6671');
  px(c,-2,-16,4,2,'#d3b698');
  polygon(c,[[6,-14],[7,-21],[12,-20],[13,-13]],'#a59471');line(c,[[8,-20],[9,-16],[12,-15]],'#dac7a0',.6);
  if(options.pigeon!==false)pigeon(c,5,-29,time,{flip:true});
  c.restore();
}
// This is a different person from the Broad Walk crumb seller: a standing
// East Asian visitor whose left cheek/scalp injuries are described by the source.
function umbrellaWoman(c,x,y,time,options={}) {
  const breath=Math.sin(time*1.5)*.12;
  c.save();c.translate(x,y+breath);shadow(c,0,0,7,1.8,.22);
  px(c,-4,-2,3,2,'#3f3b35');px(c,1,-2,4,2,'#3f3b35');
  polygon(c,[[-4,-16],[4,-16],[5,-3],[-5,-3]],'#626763');
  polygon(c,[[-5,-26],[3,-26],[6,-21],[5,-10],[-5,-10],[-6,-21]],'#929185');
  polygon(c,[[-4,-25],[-1,-24],[-1,-11],[-4,-11]],'#b9b4a0');
  line(c,[[1,-24],[2,-12]],'#727669',.6);
  polygon(c,[[-5,-24],[-7,-18],[-4,-13],[-2,-15],[-4,-19]],'#8b8c80');
  polygon(c,[[4,-24],[7,-18],[9,-19],[10,-17],[6,-15],[3,-19]],'#797e75');
  px(c,-3,-15,2,2,'#c9a88c');px(c,8,-19,2,2,'#c9a88c');
  polygon(c,[[-3.5,-32],[1,-34],[4,-31],[3.5,-27],[1,-25],[-2,-26],[-3.5,-29]],'#c9ac8b');
  polygon(c,[[-4,-31],[-4,-34],[-1,-36],[3,-35],[5,-32],[3,-30],[1,-33],[-2,-33]],'#7a8178');
  ellipse(c,-4,-33,1.6,2,'#777e76');
  line(c,[[-2.7,-30],[-.8,-30]],'#55594b',.55);line(c,[[1,-30],[2.8,-29.7]],'#55594b',.55);
  line(c,[[.1,-29],[0,-27.7],[1,-27.3]],'#9d8468',.5);
  line(c,[[-1.1,-26.6],[1.5,-26.6]],'#9d7d64',.4);
  polygon(c,[[-3.2,-32],[-1.8,-31],[-2.1,-29],[-1.2,-28],[-2,-26.7],[-3.3,-28.2]],'#a87468');
  if(options.umbrella!==false)umbrella(c,10,-9,time,{open:false});
  c.restore();
}

// Canonical identities keep the two old women distinct even when a generic
// hotspot kind is supplied by a room. Explicit IDs win over a room fallback.
export function resolveStoryActor(hotspot,state={}) {
  const kind=hotspot?.kind||hotspot?.itemId||hotspot?.id;
  const id=String(hotspot?.actorId||hotspot?.id||'');
  if(kind==='umbrella_woman'||id.includes('umbrella_woman')||id.includes('lancaster_umbrella'))return {kind:'umbrella_woman',actorId:'lancaster_umbrella_woman'};
  if(['woman','bird_woman','old_woman'].includes(kind)){
    const explicitSeller=kind==='bird_woman'||id.includes('broad_walk')||id.includes('bird_food');
    const umbrellaVisitor=!explicitSeller&&(hotspot?.room||state?.room)==='lancaster_gate';
    return umbrellaVisitor?{kind:'umbrella_woman',actorId:'lancaster_umbrella_woman'}:{kind:'woman',actorId:'bird_food_seller'};
  }
  return {kind};
}

function boy(c,x,y,time,state) {
  const phase=(state?.counters?.boy_cycle||0)%3;
  shadow(c,x,y,9,2,.2);
  px(c,x-5,y-2,4,2,'#48453e');px(c,x+3,y-2,4,2,'#48453e');
  line(c,[[x-3,y-10],[x-3,y-2]],'#626a69',2.8);line(c,[[x+3,y-10],[x+4,y-2]],'#697474',2.8);
  polygon(c,[[x-6,y-23],[x+5,y-23],[x+6,y-11],[x-5,y-11]],'#6e8c88');
  polygon(c,[[x-5,y-22],[x,y-22],[x,y-12],[x-4,y-12]],'#9caea0');
  ellipse(c,x,y-28,3.4,4.2,'#d5b18c');px(c,x-3,y-32,6,2,'#63513d');
  c.strokeStyle='#444e4b';c.lineWidth=1.2;c.beginPath();c.arc(x,y-28,4,Math.PI,0);c.stroke();px(c,x-4.5,y-29,1.7,4,'#343f3d');px(c,x+3,y-29,1.7,4,'#343f3d');
  const hy=phase===0?-7:-25;line(c,[[x+5,y-22],[x+8,y+hy],[x+12,y+hy]],'#b7a48a',1.9);
  line(c,[[x+12,y+hy],[x+16,y+hy-2]],'#b2b099',.6);ellipse(c,x+17,y+hy-2,1.8,1.8,'#a3c1b966');
  ellipse(c,x+16,y-1,6,2,'#929b8b');ellipse(c,x+16,y-1.2,4.7,1.2,'#b5c6b4');
  if(phase===1){const drift=(time*.16)%1;const bx=x+22+drift*12,by=y-29-drift*16;c.strokeStyle='#dce6c588';c.lineWidth=.55;c.beginPath();c.arc(bx,by,3+drift*4,0,Math.PI*2);c.stroke();glint(c,bx-1,by-2,.3);}
}
function whiteDoor(c,x,y,time,options={}) {
  const reveal=options.reveal??1,bob=Math.sin(time*.75)*.8;
  c.save();c.translate(x,y+bob);c.globalAlpha*=reveal;
  const glow=c.createRadialGradient(0,-24,5,0,-24,35);glow.addColorStop(0,'#fff6d23d');glow.addColorStop(1,'#e7eacb00');c.fillStyle=glow;c.fillRect(-38,-63,76,76);
  ellipse(c,1,3,17,2.5,'#dfdfbe20');
  polygon(c,[[-12,-47],[12,-47],[12,0],[-12,0]],'#c6cbb8');polygon(c,[[-10.5,-45.5],[10.5,-45.5],[10.5,-1],[-10.5,-1]],'#f4f1dd');
  for(const yy of [-42,-23]){line(c,[[-7,yy],[7,yy],[7,yy+15],[-7,yy+15],[-7,yy]],'#bfc5b1',.6);line(c,[[-6,yy+1],[6,yy+1]],'#fffbe6',.5);}
  ellipse(c,7,-23,1,1,'#aa9b66');line(c,[[-12,-47],[12,-47],[12,0]],'#ffffef',.9);
  c.restore();
}
function boat(c,x,y,time,options={}) {
  const bob=Math.sin(time*1.1)*.65;
  c.save();c.translate(x,y+bob);ellipse(c,0,3,15,2.1,'#b6c6b32b');
  polygon(c,[[-14,-2],[-6,4],[8,3],[16,-3]],'#8a795a');polygon(c,[[-12,-2],[-5,1],[8,1],[14,-3]],'#b9a37a');line(c,[[-2,-2],[-2,-23]],'#7e7053',.7);
  polygon(c,[[-1,-22],[-1,-4],[12,-4]],'#ebe4c6');polygon(c,[[-3,-19],[-11,-5],[-3,-5]],'#cacdb4');line(c,[[-1,-22],[12,-4]],'#d7d0b3',.5);
  c.restore();
}
function notice(c,x,y,options={}) {
  shadow(c,x,y,8,1.5,.18);px(c,x-1,y-15,2,15,'#695b41');
  polygon(c,[[x-11,y-31],[x+12,y-30],[x+12,y-15],[x-11,y-16]],'#796b4c');
  polygon(c,[[x-10,y-30],[x+11,y-29],[x+11,y-16],[x-10,y-17]],'#d4c8a2');
  for(let i=0;i<3;i++)line(c,[[x-7,y-26+i*3],[x+7-(i%2)*3,y-26+i*3]],'#827f63',.5);
}

export function drawStoryProp(c,hotspot,state={},time=0) {
  if(!hotspot||hotspot.baked||hotspot.visual===false)return;
  const identity=resolveStoryActor(hotspot,state);
  if(identity.actorId)hotspot={...hotspot,...identity};
  const x=hotspot.x||0,y=hotspot.y||0,kind=identity.kind;
  const options=hotspot.visualOptions||hotspot;
  c.save();if(Number.isFinite(hotspot.opacity))c.globalAlpha*=hotspot.opacity;
  if(spriteRenderer?.(c,hotspot,state,time)===true){c.restore();return;}
  if(kind==='woman'||kind==='bird_woman'||kind==='old_woman')seatedWoman(c,x,y,time,options);
  else if(kind==='umbrella_woman')umbrellaWoman(c,x,y,time,options);
  else if(kind==='boy'||kind==='teenager')boy(c,x,y,time,state);
  else if(kind==='birds'||kind==='pigeons'){for(let i=0;i<5;i++)pigeon(c,x+(i*17)%36-18,y+(i*11)%22-11,time,{peck:has(state,'birds_fed')?Math.max(0,Math.sin(time*2+i)):0,flip:i%2===0});}
  else if(kind==='pigeon')pigeon(c,x,y,time,options);
  else if(kind==='roadrunner'||kind==='large_bird'||kind==='ruby_bird')roadrunner(c,x,y,time,options);
  else if(kind==='ruby'||kind==='gem')drawRuby(c,x,y,time);
  else if(kind==='paper_bird'||kind==='paper')paper(c,x,y,time,options.unfold===undefined&&has(state,'bird_unfolded'),options.unfold||0);
  else if(kind==='umbrella'||kind==='umbrella_tree')umbrella(c,x,y,time,{...options,open:options.open??has(state,'umbrella_open')});
  else if(kind==='pram'||kind==='perambulator'||kind==='carriage')pram(c,x,y,time,state,options);
  else if(kind==='sundial'||kind==='dial')sundial(c,x,y,state,options);
  else if(kind==='gnomon'){shadow(c,x,y,5,1,.14);polygon(c,[[x-6,y-2],[x+6,y-1],[x+3,y-8]],'#847b55');line(c,[[x+3,y-8],[x+6,y-1]],'#d2c18a',.7);}
  else if(kind==='door'||kind==='white_door')whiteDoor(c,x,y,time,options);
  else if(kind==='boat'||kind==='boats'||kind==='toy_boat')boat(c,x,y,time,options);
  else if(kind==='sign'||kind==='notice'||kind==='notice_board')notice(c,x,y,options);
  else if(kind==='ball'){shadow(c,x,y,4,1,.2);ellipse(c,x,y-3,4,4,'#d8d0b2');polygon(c,[[x-1,y-6],[x+2,y-4],[x+1,y-1],[x-2,y-2]],'#454b40');line(c,[[x-4,y-3],[x-1,y-6],[x+2,y-4],[x+4,y-4]],'#7b806e',.6);}
  else if(kind==='duck'||kind==='swan'){ellipse(c,x,y+1,8,1.8,'#c8d4c144');ellipse(c,x,y-2,6,3.3,kind==='swan'?'#dddcc7':'#8b9276');line(c,[[x+4,y-3],[x+5,y-10],[x+8,y-11]],kind==='swan'?'#e5e1ca':'#607c66',2.1);px(c,x+8,y-12,2.5,1,'#bd9c61');}
  else if(kind==='dish'){ellipse(c,x,y,6,2,'#7b8a7e');ellipse(c,x,y-.5,4.8,1.3,'#b7c8b7');}
  else if(kind==='missile'){c.save();c.translate(x,y);c.rotate(.32);polygon(c,[[-2,-25],[1,-29],[4,-25],[4,-7],[2,-3],[-2,-7]],'#a5b0a4');polygon(c,[[-1,-24],[1,-27],[1,-5],[-1,-8]],'#e4e4ce');polygon(c,[[-2,-10],[-6,-5],[-2,-6]],'#727e74');polygon(c,[[4,-10],[7,-5],[4,-6]],'#798578');c.restore();}
  else if(kind==='crow'||kind==='raven'){c.save();c.translate(x,y);const flap=Math.sin(time*7);polygon(c,[[-3,-2],[-13,-6-flap*4],[-6,-1],[0,1],[6,-1],[13,-6+flap*4],[3,-2]],'#303b36');ellipse(c,2,-3,2.5,2,'#3a4339');line(c,[[4,-3],[7,-2]],'#8a876d',.7);c.restore();}
  c.restore();
}

// Optional small portrait for a dialogue box; coordinates/size are caller-owned.
export function drawPortrait(c,id,x=0,y=0,width=64,height=76) {
  c.save();c.translate(x,y);c.scale(width/64,height/76);
  const umbrellaVisitor=id==='umbrella_woman'||id==='lancaster_umbrella_woman';
  const elder=id==='woman'||id==='bird_woman'||id==='bird_food_seller'||umbrellaVisitor;
  const background=c.createLinearGradient(0,0,64,76);background.addColorStop(0,'#4d6254');background.addColorStop(1,'#263d35');c.fillStyle=background;c.fillRect(0,0,64,76);
  polygon(c,[[6,76],[10,59],[20,50],[45,50],[56,62],[61,76]],elder?'#747b82':'#9f8e68');
  polygon(c,[[27,42],[39,42],[41,56],[31,62],[24,53]],'#ad8d70');
  ellipse(c,31,32,16,22,'#bc9f81');polygon(c,[[19,20],[29,13],[40,16],[43,29],[40,46],[32,52],[23,47],[18,34]],'#d5b99a');
  if(umbrellaVisitor){polygon(c,[[14,29],[12,20],[17,12],[28,8],[41,12],[47,20],[46,30],[41,22],[37,16],[26,14],[19,22]],'#777e74');ellipse(c,13,24,4,6,'#70786e');polygon(c,[[17,24],[23,25],[22,31],[25,36],[22,42],[24,48],[19,45],[16,35]],'#ad766a');line(c,[[19,28],[21,34],[19,39]],'#935f5a',.7);}
  else if(elder){polygon(c,[[14,30],[13,19],[18,10],[30,6],[43,11],[49,22],[46,36],[41,27],[39,16],[28,14],[19,21]],'#b3b5a8');line(c,[[18,14],[29,10],[39,13]],'#d3d0bc',1);}
  else{polygon(c,[[15,24],[16,14],[27,8],[41,12],[47,22],[42,27],[38,17],[24,16],[19,27]],'#66503b');}
  line(c,[[21,29],[26,28]],'#6c6555',1);line(c,[[35,28],[41,29]],'#6c6555',1);px(c,23,30,1.5,1,'#3f4439');px(c,37,30,1.5,1,'#3f4439');line(c,[[31,31],[29,39],[33,40]],'#9f8167',.8);line(c,[[26,45],[32,46],[37,44]],'#9f7d64',.8);
  if(elder){for(let i=0;i<3;i++){line(c,[[18,31+i*3],[22,32+i*3]],'#a08a71',.45);line(c,[[40,32+i*3],[44,31+i*3]],'#a18b73',.45);}line(c,[[21,40],[23,44]],'#a18b73',.55);}
  c.strokeStyle='#b9a474';c.lineWidth=.6;c.strokeRect(.5,.5,63,75);c.restore();
}
