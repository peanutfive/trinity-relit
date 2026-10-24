import {BODY_POSES,bodyFrameFor} from './umbrella-motion.js';
const sheet=new Image();sheet.src=new URL('./assets/umbrella-motion-v3.png',import.meta.url).href;
const props={
  closed:{source:[552,702,83,316],grip:[599,734],scale:.076},
  half:{source:[766,754,310,258],grip:[927,883],scale:.077},
  open:{source:[1117,711,401,303],grip:[1303,869],scale:.077},
};
function ready(){return sheet.complete&&sheet.naturalWidth>0;}
function prop(ctx,x,y,options){
  const amount=options.openness??(options.open?1:0),key=amount<.16?'closed':amount<.72?'half':'open',p=props[key];
  const [sx,sy,sw,sh]=p.source,[ax,ay]=p.grip;
  ctx.save();ctx.translate(x,y);ctx.rotate(options.rotation||0);ctx.imageSmoothingEnabled=true;
  const widthScale=key==='half'?.65+.35*Math.min(1,amount/.72):1;
  ctx.scale(widthScale,1);ctx.drawImage(sheet,sx,sy,sw,sh,(sx-ax)*p.scale,(sy-ay)*p.scale,sw*p.scale,sh*p.scale);ctx.restore();
}
export function renderUmbrellaMotion(ctx,object,state,time=0){
  if(!ready())return false;
  const o=object.visualOptions||object;
  if(object.kind==='umbrella'||object.kind==='umbrella_tree'){
    // Ordinary world coordinates retain the old ground/hook-bottom anchor.
    const inTree=(state?.itemAt?.('umbrella')??state?.itemLoc?.umbrella)==='lancaster_gate_tree';
    if(inTree&&!o.gripAnchor&&!o.detached){prop(ctx,object.x,object.y,{...o,openness:1});return true;}
    prop(ctx,object.x,object.y+(o.gripAnchor?0:o.open?-10:-22),o);return true;
  }
  if(object.actorId!=='lancaster_umbrella_woman'&&object.kind!=='umbrella_woman')return false;
  const frame=Number.isInteger(o.bodyFrame)?o.bodyFrame:bodyFrameFor(o.action||'prepare');
  if(o.walking||o.action==='leave')return false; // existing painted walk A/B
  const p=BODY_POSES[frame],[sx,sy,sw,sh]=p.source,[fx,fy]=p.foot;
  const scale=33/(fy-p.head);
  ctx.save();ctx.imageSmoothingEnabled=true;ctx.drawImage(sheet,sx,sy,sw,sh,object.x+(sx-fx)*scale,object.y+(sy-fy)*scale,sw*scale,sh*scale);ctx.restore();
  if(o.umbrella!==false&&!o.separateUmbrella){const g=o.grip||p.grip;prop(ctx,object.x+g[0],object.y+g[1],{openness:o.openness??0,rotation:o.tilt||0});}
  return true;
}
export const umbrellaMotionArtStatus=()=>ready()?'loaded':'loading';
