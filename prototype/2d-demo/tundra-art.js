// Original RGBA atlas, sampled directly. Time is the paused visual clock;
// these tiny idle motions never move or grant the shared lemming item.
const makeImage=()=>{
  if(typeof Image!=='function')return null;
  const image=new Image();image.src=new URL('./assets/tundra-props-v1.png',import.meta.url).href;return image;
};
const sheet=makeImage(),ready=()=>Boolean(sheet?.complete&&sheet.naturalWidth);
export const TUNDRA_LEMMING_FRAMES=Object.freeze([
  {pose:'rest',source:[12,174,490,405],foot:[262,550]},
  {pose:'sniff',source:[560,174,491,405],foot:[814,550]},
  {pose:'turn',source:[1120,174,472,405],foot:[1360,550]},
  {pose:'groom',source:[1660,174,483,405],foot:[1900,550]},
]);
export const TUNDRA_LEMMING_SCALE=8/470;
export function tundraLemmingMotion(time=0){
  const phase=(Number.isFinite(time)?Math.max(0,time):0)%12;
  const frame=phase<6?0:phase<8?1:phase<10?2:3;
  return{phase,frame,pose:TUNDRA_LEMMING_FRAMES[frame].pose};
}
export function renderTundraSprite(c,object,state={},time=0){
  if(!['tundra_lemming','lemming'].includes(object.kind))return false;
  if(!ready())return false;
  const raw=object.visualOptions?.drawAt||object,p=Array.isArray(raw)?{x:raw[0],y:raw[1]}:raw;
  const frame=TUNDRA_LEMMING_FRAMES[tundraLemmingMotion(time).frame],s=TUNDRA_LEMMING_SCALE;
  const[sx,sy,sw,sh]=frame.source;
  c.save();c.imageSmoothingEnabled=true;c.fillStyle='rgba(24,36,36,.20)';
  c.beginPath();c.ellipse(p.x,p.y,3.1,1.0,0,0,Math.PI*2);c.fill();
  c.drawImage(sheet,sx,sy,sw,sh,p.x+(sx-frame.foot[0])*s,p.y+(sy-frame.foot[1])*s,sw*s,sh*s);
  c.restore();return true;
}
export const tundraArtStatus=()=>ready()?'loaded':'loading';
