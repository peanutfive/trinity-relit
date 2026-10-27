import {GIRL_SCALE,GIRL_FRAMES,JAPAN_GROUPS,JAPAN_PROPS} from './japan-art-layout.js';
import {renderUmbrellaMotion} from './umbrella-motion-art.js';
import {paintCharacter} from './character.js';
const actors=new Image(),props=new Image();
actors.src=new URL('./assets/japan-actors-v1.png',import.meta.url).href;
props.src=new URL('./assets/japan-props-v1.png',import.meta.url).href;
const ready=sheet=>sheet.complete&&sheet.naturalWidth>0;
function stamp(c,sheet,p,x,y,scale,flip=false){
  if(!ready(sheet))return false;
  const [sx,sy,sw,sh]=p.source,[fx,fy]=p.foot;
  c.save();c.translate(x,y);if(flip)c.scale(-1,1);c.imageSmoothingEnabled=true;
  c.drawImage(sheet,sx,sy,sw,sh,(sx-fx)*scale,(sy-fy)*scale,sw*scale,sh*scale);c.restore();return true;
}
function shadow(c,x,y,rx=4,alpha=.22){c.save();c.fillStyle=`rgba(20,24,23,${alpha})`;c.beginPath();c.ellipse(x,y+.6,rx,1.2,0,0,Math.PI*2);c.fill();c.restore();}
export function renderJapanSprite(c,object,state,time=0){
  const {kind,x,y}=object,o=object.visualOptions||{},flip=o.facing==='left';
  if(kind==='japan_umbrella'){
    c.save();c.translate(x,y-15);c.scale(.65,.65);renderUmbrellaMotion(c,{kind:'umbrella',x:0,y:0,visualOptions:{gripAnchor:true,openness:0}},state,time);c.restore();return true;
  }
  if(kind==='japan_rider'){
    c.save();c.globalAlpha*=o.opacity??1;paintCharacter(c,x,y,'#bca071',o.facing||'left',o.phase||0,false,{moving:!!o.walking,airborne:!!o.flying});c.restore();return true;
  }
  if(kind==='japan_girl'){
    let frame=o.frame??(o.umbrella?4:0);
    if(o.walking)frame=(o.umbrella?5:1)+Math.floor((o.distance||time*28)/7)%2;
    shadow(c,x,y);const drawn=stamp(c,actors,GIRL_FRAMES[frame],x,y,GIRL_SCALE,flip);
    if(o.umbrella&&![7,8,9].includes(frame)){
      // A separate folded prop attached to the child's measured hand anchor.
      c.save();c.translate(x+(flip?-1.7:1.7),y-12.7);c.scale(flip?-.65:.65,.65);
      renderUmbrellaMotion(c,{kind:'umbrella',x:0,y:0,visualOptions:{gripAnchor:true,openness:0}},state,time);c.restore();
    }
    return drawn;
  }
  if(JAPAN_GROUPS[kind]){shadow(c,x,y,8,.15);const p=JAPAN_GROUPS[kind];return stamp(c,actors,p,x,y,p.scale,flip);}
  let key=kind;
  if(kind==='mushroom_gate')key=o.open?'mushroom_open':'mushroom_closed';
  if(kind==='paper_bird'&&state.chapter==='japan')key=state.hasFlag?.('bird_unfolded')?'paper_sheet':'paper_crane';
  if(kind==='giant_paper_bird')key=o.flap?'giant_paper_bird_flap':'giant_paper_bird';
  const p=JAPAN_PROPS[key];if(!p)return false;
  const scale=(o.scale??1)*p.height/p.source[3];
  if(!o.flying)shadow(c,x,y,kind==='mushroom_gate'?15:kind==='japan_door'?8:5);
  c.save();c.globalAlpha*=o.opacity??1;const drawn=stamp(c,props,p,x,y,scale,flip);c.restore();return drawn;
}
export const japanArtStatus=()=>ready(actors)&&ready(props)?'loaded':'loading';
