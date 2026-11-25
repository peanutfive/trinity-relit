import { FERRY_BOAT_ART } from './ferry-art-assets.js';

const shore='./assets/river-ending-shore-v1.webp';
const beckon='./assets/river-ending-beckon-v1.webp';
const traveller='./assets/river-ending-traveller-v1.webp';
const sources=[shore,FERRY_BOAT_ART,beckon,traveller];
const plates=new Map();
let attempted=false;
function load(src) {
  const old=plates.get(src);
  if(old && !old.failed)return old.promise;
  if(typeof Image==='undefined')return Promise.resolve(false);
  const image=new Image(),entry={image,loaded:false,failed:false};
  entry.promise=new Promise(resolve=>{
    const expired=setTimeout(()=>{entry.failed=true;resolve(false);},3500);
    image.onload=()=>{clearTimeout(expired);entry.loaded=true;entry.failed=false;resolve(true);};
    image.onerror=()=>{clearTimeout(expired);entry.failed=true;resolve(false);};
    image.src=new URL(src,import.meta.url).href;
  });
  plates.set(src,entry);
  return entry.promise;
}
export async function warmRiverEndingArt() {
  attempted=true;
  return (await Promise.all(sources.map(load))).every(Boolean);
}
const plate=src=>plates.get(src)?.loaded ? plates.get(src).image : null;
const limit=value=>Math.max(0,Math.min(1,value));
const ease=value=>{const t=limit(value);return t*t*(3-2*t);};
const mix=(a,b,t)=>a+(b-a)*t;
const positions={
  mist:{x:338,y:49,size:.051,alpha:.075},
  river:{x:263,y:44,size:.177,alpha:.89},
  shore:{x:147,y:37,size:.36,alpha:1},
};
function between(a,b,t){
  return {x:mix(a.x,b.x,t),y:mix(a.y,b.y,t),size:mix(a.size,b.size,t),alpha:mix(a.alpha,b.alpha,t)};
}
function paintShore(c){
  const image=plate(shore);
  if(image){c.drawImage(image,0,0,480,288);return;}
  const water=c.createLinearGradient(0,0,0,184);
  water.addColorStop(0,'#829493');water.addColorStop(.36,'#526766');water.addColorStop(1,'#253a3c');
  c.fillStyle=water;c.fillRect(0,0,480,288);
  const sand=c.createLinearGradient(0,108,0,288);
  sand.addColorStop(0,'#5e584b');sand.addColorStop(1,'#807967');
  c.fillStyle=sand;c.beginPath();c.moveTo(0,79);c.bezierCurveTo(108,123,257,158,480,167);
  c.lineTo(480,288);c.lineTo(0,288);c.fill();
}
let poseMix;
function boatImage(c,phase,gesture){
  const rowing=plate(FERRY_BOAT_ART), hand=plate(beckon);
  if(hand && (gesture>=1 || !rowing)){c.drawImage(hand,0,0,526,357);return;}
  if(rowing){
    if(gesture>0 && hand){
      if(!poseMix){
        const surface=c.canvas.ownerDocument?.createElement('canvas') || new OffscreenCanvas(526,357);
        surface.width=526;surface.height=357;poseMix=surface.getContext('2d');
      }
      // Blend on transparency so the vacated rowing-arm pixels disappear.
      // Blending the second silhouette onto an opaque hull leaves a third hand.
      poseMix.clearRect(0,0,526,357);poseMix.save();
      poseMix.globalAlpha=1-gesture;
      poseMix.drawImage(rowing,10,184,526,357,0,0,526,357);
      poseMix.globalCompositeOperation='lighter';poseMix.globalAlpha=gesture;
      poseMix.drawImage(hand,0,0,526,357);poseMix.restore();
      c.drawImage(poseMix.canvas,0,0);
    }else{
      c.drawImage(rowing,10+phase*544,184,526,357,0,0,526,357);
    }
    return;
  }
  c.fillStyle='#262c29';c.beginPath();c.moveTo(12,179);c.quadraticCurveTo(238,244,501,153);
  c.quadraticCurveTo(467,303,206,305);c.quadraticCurveTo(45,310,12,179);c.fill();
  c.fillStyle='#252924';c.beginPath();c.moveTo(323,202);c.quadraticCurveTo(324,95,355,47);
  c.quadraticCurveTo(380,19,399,63);c.lineTo(453,209);c.closePath();c.fill();
}
function paintBoat(c,p,frame,gesture){
  c.save();c.globalAlpha*=p.alpha;c.translate(p.x,p.y);c.scale(p.size,p.size);
  boatImage(c,frame,gesture);c.restore();
}
// Restore the near gunwale over the boarded passenger only. The silhouette
// is traced in the same 526 × 357 crop as the far-to-near dory.
function paintGunwale(c,p){
  c.save();c.translate(p.x,p.y);c.scale(p.size,p.size);
  c.beginPath();c.moveTo(10,179);c.lineTo(32,201);c.lineTo(71,222);c.lineTo(124,236);
  c.lineTo(185,243);c.lineTo(252,244);c.lineTo(318,239);c.lineTo(380,228);
  c.lineTo(430,214);c.lineTo(487,184);c.lineTo(504,163);
  c.lineTo(523,357);c.lineTo(0,357);c.closePath();c.clip();
  boatImage(c,0,1);c.restore();
}
const figures=[
  {clip:[53,6,79,226],foot:[38,222]},
  {clip:[197,8,129,224],foot:[36,220]},
  {clip:[393,5,133,227],foot:[37,223]},
  {clip:[568,27,120,203],foot:[78,197]},
];
function passenger(c,index,x,y){
  const image=plate(traveller),frame=figures[index],s=.275;
  if(!image){
    c.save();c.translate(x,y);c.fillStyle='#574c39';c.beginPath();c.ellipse(0,index===3?-31:-43,4,5,0,0,Math.PI*2);c.fill();
    c.fillStyle='#766044';c.fillRect(-5,index===3?-26:-37,10,index===3?18:27);
    c.fillStyle='#403e34';c.fillRect(-3,-10,6,10);c.restore();return;
  }
  c.drawImage(image,...frame.clip,x-frame.foot[0]*s,y-frame.foot[1]*s,frame.clip[2]*s,frame.clip[3]*s);
}
function boarding(c,p,t){
  const reach=ease((t-.99)/.37),stand=ease((t-1.35)/.47);
  const aboard=ease((t-1.81)/.61),offered=ease((t-2.42)/.3);
  const sit=ease((t-2.97)/.37);
  const beamX=p.x+149*p.size,deckY=p.y+248*p.size;
  const x=mix(mix(beamX-23,beamX-10,stand),beamX-4,aboard);
  const y=mix(mix(deckY+20,deckY+6,stand),deckY,aboard)-2.2*Math.sin(Math.PI*aboard);
  c.save();c.globalAlpha*=reach;
  if(t<1.81)passenger(c,stand>.17 && stand<.93?1:0,x,y);
  else if(t<2.42)passenger(c,1,x,y);
  else if(t<2.97)passenger(c,2,x,y);
  else passenger(c,3,mix(x,beamX+12,sit),mix(y,deckY+2.3,sit));
  if(t>=1.81)paintGunwale(c,p);
  if(offered>0 && t<2.97){
    const handX=p.x+204*p.size,handY=p.y+126*p.size;
    c.globalAlpha*=Math.sin(Math.PI*limit((t-2.42)/.55));
    c.fillStyle='#dbdccc';c.beginPath();c.ellipse(handX,handY,1.4,.85,-.25,0,Math.PI*2);c.fill();
  }
  c.restore();
}

// Phase and elapsed are presentation inputs. Repainting a still or restoring
// the ending menu never advances the boat or consumes an item.
export function drawRiverEnding(c,phase,elapsed=0,reducedMotion=false){
  if(!attempted)void warmRiverEndingArt();
  const t=reducedMotion?60:Math.max(0,elapsed || 0);
  c.save();c.imageSmoothingEnabled=true;
  paintShore(c);
  if(phase>=1){
    const arrival=phase===1 ? ease(t/2.35) : ease(t/1.03);
    const p=phase===1?between(positions.mist,positions.river,arrival):between(positions.river,positions.shore,arrival);
    const stroke=arrival<1?[0,1,2,3,2,1][Math.floor(t*5)%6]:0;
    const gesture=phase>=2?ease((t-.91)/.38)*(1-ease((t-2.97)/.4)):0;
    paintBoat(c,p,stroke,gesture);
    if(phase>=2 && t>.99)boarding(c,p,t);
  }
  c.restore();
}
