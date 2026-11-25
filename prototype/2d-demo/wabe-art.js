// Presentation-only Wabe props. The engine owns the selected symbol and items.
import { vertexShadowView, vertexGnomonView } from './islet-shadow.js';
const atlas = new Image();
atlas.src = new URL('./assets/wabe-props.png', import.meta.url).href;
const regions = {
  dial:[35,16,860,552], pointer:[981,50,450,490],
  splinter:[35,588,725,411], ring:[800,548,712,434],
};
let ringMotion = null, mountMotion = null;
const TAU = Math.PI*2;
const glyphs=['♂\uFE0E','♇','☿','♆','♎\uFE0E','α','?'];
function stamp(ctx,key,x,y,w,h) {
  if(!atlas.complete||!atlas.naturalWidth)return false;
  const [sx,sy,sw,sh]=regions[key];
  ctx.drawImage(atlas,sx,sy,sw,sh,x-w/2,y-h,w,h);
  return true;
}
export function resetWabeArt(){ringMotion=null;mountMotion=null;}
export function animateVertexMount(before,after,time){
  if(before.room!=='vertex'||after.room!=='vertex'){mountMotion=null;return;}
  const was=vertexGnomonView(before),now=vertexGnomonView(after);
  if(was.controls!==now.controls)mountMotion={since:time,rising:now.controls};
}
function drawLever(ctx,raised,height){
  if(height<=0)return;
  const tip=raised?[184,124]:[177,146];
  const x=192+(tip[0]-192)*height,y=150+(tip[1]-150)*height;
  ctx.save();
  ctx.fillStyle='#594a31';ctx.beginPath();ctx.ellipse(192,151,5,2.7,0,0,TAU);ctx.fill();
  ctx.lineCap='round';ctx.lineWidth=2.6;ctx.strokeStyle='#443923';
  ctx.beginPath();ctx.moveTo(192,150);ctx.lineTo(x,y);ctx.stroke();
  ctx.lineWidth=.9;ctx.strokeStyle='#be9a5b';ctx.stroke();
  ctx.fillStyle='#665339';ctx.beginPath();ctx.ellipse(x,y,2.3,1.8,-.3,0,TAU);ctx.fill();
  ctx.restore();
}
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
  if(kind==='sundial_lever')return true;
  // These immovable features are part of the painted background.
  if(kind==='stairs'||kind==='log')return true;
  // Small dial details are painted together in the same perspective as its rim.
  if(['vertex:fixed-gnomon','vertex:dial-gnomon','vertex:hole'].includes(object.id))return true;
  if(kind==='sundial'){
    const vertex=state.room==='vertex';
    if(!stamp(ctx,'dial',vertex?245:x,vertex?173:y+9,vertex?116:44,vertex?76:30))return false;
    if(!vertex)stamp(ctx,'pointer',x,y,24,20);
    return true;
  }
  if(kind==='ring'&&state.room==='vertex'){
    if(!atlas.complete||!atlas.naturalWidth)return false;
    const shadow=vertexShadowView(state);
    const gnomon=vertexGnomonView(state);
    const progress=mountMotion?Math.min(1,Math.max(0,(time-mountMotion.since)/.65)):1;
    const height=progress<1?(mountMotion.rising?progress:1-progress):Number(gnomon.controls);
    drawLever(ctx,shadow.leverUp,height);
    const cx=245,cy=132,angle=ringAngle(gnomon.controls?shadow.symbol:state.sundialSymbol,time);
    ctx.save();ctx.translate(cx,cy);ctx.scale(1,.66);ctx.rotate(angle);
    ctx.drawImage(atlas,...regions.ring,-56,-56,112,112);ctx.restore();
    if(progress<1){
      ctx.save();ctx.strokeStyle='#ffedaa';ctx.globalAlpha=.85*Math.sin(progress*Math.PI);
      ctx.lineWidth=1.8;ctx.shadowColor='#f7dc83';ctx.shadowBlur=3;
      const arc=-Math.PI+progress*TAU;ctx.beginPath();ctx.ellipse(cx,cy,52,32,0,arc,arc+.7);ctx.stroke();ctx.restore();
    }
    if(gnomon.controls){
      const shadowAngle = -Math.PI/2 - shadow.dialIndex*TAU/7;
      const tipX=cx+Math.cos(shadowAngle)*39, tipY=cy+Math.sin(shadowAngle)*23;
      ctx.save();ctx.fillStyle='rgba(33,32,39,.68)';
      ctx.beginPath();ctx.moveTo(cx-3,cy+3);ctx.lineTo(tipX,tipY);
      ctx.lineTo(cx+3,cy+4);ctx.closePath();ctx.fill();ctx.restore();
    }
    ctx.save();ctx.font='9px Georgia,serif';ctx.textAlign='center';ctx.textBaseline='middle';
    for(let i=0;i<7;i++){
      const a=-Math.PI/2-i*TAU/7;
      const gx=cx+Math.cos(a)*38,gy=cy+Math.sin(a)*22;
      ctx.fillStyle=gnomon.controls && i+1===shadow.symbol?'#ffd890':'#d6ba85';
      ctx.lineWidth=1.5;ctx.strokeStyle='#514126';ctx.strokeText(glyphs[i],gx,gy);
      ctx.fillText(glyphs[i],gx,gy);
    }
    ctx.restore();
    if(gnomon.controls){
      ctx.save();ctx.translate(cx,cy);ctx.scale(1,.66);ctx.rotate(angle);
      ctx.beginPath();ctx.moveTo(-2.8,-48);ctx.lineTo(0,-40);ctx.lineTo(2.8,-48);ctx.closePath();
      ctx.fillStyle='#f4ce80';ctx.fill();ctx.strokeStyle='#59452a';ctx.lineWidth=.8;ctx.stroke();ctx.restore();
    }
    ctx.save();ctx.fillStyle='#a39064';ctx.font='3.5px Georgia,serif';ctx.textAlign='center';
    ctx.translate(cx,173);
    if(state.flipped)ctx.scale(-1,1);
    ctx.fillText('TEMPUS EDAX RERUM',0,0);ctx.restore();
    if(gnomon.controls)stamp(ctx,'pointer',cx,cy+13,40,34);
    else {
      ctx.save();
      ctx.fillStyle='#ac9369';ctx.beginPath();ctx.ellipse(cx,cy,5.1,2.8,0,0,TAU);ctx.fill();
      ctx.fillStyle='#30291f';ctx.beginPath();ctx.ellipse(cx,cy-.5,4,2,0,0,TAU);ctx.fill();
      ctx.strokeStyle='#8e7956';ctx.lineWidth=.6;ctx.beginPath();
      ctx.ellipse(cx,cy,3,1,0,0,Math.PI);ctx.stroke();ctx.restore();
    }
    if(gnomon.onDial){
      ctx.save();ctx.translate(cx+18,cy+15);ctx.rotate(-.3);
      stamp(ctx,'pointer',0,0,23,9);ctx.restore();
    }
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
