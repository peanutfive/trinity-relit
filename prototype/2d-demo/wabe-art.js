// Presentation-only Wabe props. The engine owns the selected symbol and items.
import { vertexShadowView } from './islet-shadow.js';
const atlas = new Image();
atlas.src = new URL('./assets/wabe-props.png', import.meta.url).href;
const regions = {
  dial:[35,16,860,552], pointer:[981,50,450,490],
  splinter:[35,588,725,411], ring:[800,548,712,434],
};
let ringMotion = null;
const TAU = Math.PI*2;
const glyphs=['♂\uFE0E','♇','☿','♆','♎\uFE0E','α','?'];
function stamp(ctx,key,x,y,w,h) {
  if(!atlas.complete||!atlas.naturalWidth)return false;
  const [sx,sy,sw,sh]=regions[key];
  ctx.drawImage(atlas,sx,sy,sw,sh,x-w/2,y-h,w,h);
  return true;
}
export function resetWabeArt(){ringMotion=null;}
function ringAngle(symbol,time) {
  const target=-(symbol-1)*TAU/7;
  if(!ringMotion)ringMotion={symbol,from:target,to:target,since:time};
  const progress=Math.min(1,Math.max(0,(time-ringMotion.since)/.45));
  const angle=ringMotion.from+(ringMotion.to-ringMotion.from)*(1-Math.pow(1-progress,3));
  if(symbol!==ringMotion.symbol){
    let next=target;while(next>angle+.01)next-=TAU;
    ringMotion={symbol,from:angle,to:next,since:time};return angle;
  }
  return angle;
}
export function renderWabeSprite(ctx,object,state,time) {
  if(state.chapter!=='wabe' && !(state.chapter==='ranch' && object.kind==='splinter'))return false;
  const {kind,x,y}=object;
  if(kind==='sundial_lever'){
    const raised=vertexShadowView(state).leverUp;
    const tip=raised?[184,124]:[177,146];
    ctx.save();
    ctx.fillStyle='#594a31';ctx.beginPath();ctx.ellipse(192,151,5,2.7,0,0,TAU);ctx.fill();
    ctx.lineCap='round';ctx.lineWidth=2.6;ctx.strokeStyle='#443923';
    ctx.beginPath();ctx.moveTo(192,150);ctx.lineTo(...tip);ctx.stroke();
    ctx.lineWidth=.9;ctx.strokeStyle='#be9a5b';ctx.stroke();
    ctx.fillStyle='#665339';ctx.beginPath();ctx.ellipse(...tip,2.3,1.8,-.3,0,TAU);ctx.fill();
    ctx.restore();
    return true;
  }
  // These immovable features are part of the painted background.
  if(kind==='stairs'||kind==='log')return true;
  if(state.room==='vertex'&&kind==='gnomon'&&object.id==='vertex:fixed-gnomon')return true;
  if(kind==='sundial'){
    const vertex=state.room==='vertex';
    if(!stamp(ctx,'dial',vertex?245:x,vertex?173:y+9,vertex?116:44,vertex?76:30))return false;
    if(!vertex)stamp(ctx,'pointer',x,y,24,20);
    return true;
  }
  if(kind==='ring'&&state.room==='vertex'){
    if(!atlas.complete||!atlas.naturalWidth)return false;
    const shadow=vertexShadowView(state);
    const cx=245,cy=132,angle=ringAngle(shadow.symbol,time);
    ctx.save();ctx.translate(cx,cy);ctx.scale(1,.66);ctx.rotate(angle);
    ctx.drawImage(atlas,...regions.ring,-56,-56,112,112);ctx.restore();
    const shadowAngle = -Math.PI/2 + angle + shadow.dialIndex*TAU/7;
    const tipX=cx+Math.cos(shadowAngle)*44, tipY=cy+Math.sin(shadowAngle)*24;
    ctx.save();ctx.fillStyle='rgba(33,32,39,.68)';
    ctx.beginPath();ctx.moveTo(cx-3,cy+3);ctx.lineTo(tipX,tipY);
    ctx.lineTo(cx+3,cy+4);ctx.closePath();ctx.fill();ctx.restore();
    ctx.save();ctx.font='9px Georgia,serif';ctx.textAlign='center';ctx.textBaseline='middle';
    for(let i=0;i<7;i++){
      const a=-Math.PI/2+i*TAU/7+angle;
      const gx=cx+Math.cos(a)*44,gy=cy+Math.sin(a)*24;
      ctx.fillStyle=i+1===shadow.symbol?'#ffdfa0':'#bca66f';
      ctx.shadowColor='#513b20';ctx.shadowBlur=1;
      ctx.fillText(glyphs[i],gx,gy);
    }
    ctx.restore();
    ctx.save();ctx.fillStyle='#a39064';ctx.font='3.5px Georgia,serif';ctx.textAlign='center';
    ctx.fillText('TEMPUS EDAX RERUM',cx,173);ctx.restore();
    stamp(ctx,'pointer',cx,cy+13,40,34);
    return true;
  }
  if(kind==='splinter'){
    if(!atlas.complete||!atlas.naturalWidth)return false;
    ctx.save();ctx.shadowColor='#c1d996';ctx.shadowBlur=2+Math.sin(time*2)*.5;
    const width=object.visualOptions?.onShelf?12:23;
    stamp(ctx,'splinter',x,y,width,width*16/23);ctx.restore();return true;
  }
  return false;
}
export function wabeArtStatus(){return atlas.complete&&atlas.naturalWidth?'loaded':'loading';}
