import { propImage } from './art.js';
import { paintCharacter } from './character.js';
import { shackRouteCharacterScale } from './shack-route-layout.js';
import { cemeteryShroudAtlas } from './cemetery-art.js';
import { FERRY_ABOARD_ART, FERRY_PASSENGER_ART, FERRY_BOAT_ART } from './ferry-art-assets.js';
import { FERRY_ABOARD_POINTS } from './ferry-visual-layout.js';

// The dory and rower share a waterline. Only the head, arms and oar change
// pose; anchoring below the hull instead of below the oar keeps the boat still.
const scale = 86 / 492;
const frames = [0, 1, 2, 3].map(index => ({
  left: 544 * index + 10,
  top: 184,
  width: 526,
  height: 357,
}));
let requested = false, sheet;
let fallingCard=null;
export function resetBookmarkMotion(){fallingCard=null;}

export function animateBookmark(before,after,time){
  fallingCard=null;
  if(before.room!==after.room || before.itemLoc.slip!=='paperback' || after.itemLoc.slip!==after.room)return;
  const book=before.visual.hotspots.find(o=>o.itemId==='paperback' && before.itemLoc.paperback===before.room);
  const [x,y]=book?.drawAt||[book?.x??before.visual.player.x,book?.y??before.visual.player.y];
  fallingCard={room:after.room,x,y:y-(book?5:16),time};
}

function loadSheet() {
  requested = true;
  sheet = propImage(FERRY_BOAT_ART);
  return Boolean(sheet);
}

function passenger(ctx,slot,x,y,height,opacity=1,flip=false) {
  const atlas=propImage(FERRY_PASSENGER_ART);
  if(!atlas)return;
  const w=atlas.naturalWidth/3, h=atlas.naturalHeight, drawWidth=height*w/h;
  ctx.save();
  ctx.globalAlpha*=opacity;
  ctx.translate(x,y);
  if(flip)ctx.scale(-1,1);
  ctx.drawImage(atlas,slot*w,0,w,h,-drawWidth/2,-height,drawWidth,height);
  ctx.restore();
}

function passengersOnShore(ctx,layout,time) {
  if(layout.room!=='the_river')return;
  if(layout.phase===2){
    passenger(ctx,0,302,150,25,.86);
    passenger(ctx,1,317,155,27,.87);
    ctx.save();
    ctx.strokeStyle='rgba(210,190,149,.35)';
    ctx.lineWidth=.6;
    for(let n=0;n<2;n++){
      const t=(time*.43+n*.5)%1;
      ctx.beginPath();
      ctx.ellipse(316,155-t*3,3+t*6,1+t*.7,-.14,t*3,t*3+3.8);
      ctx.stroke();
    }
    ctx.restore();
  } else if(layout.phase===3){
    passenger(ctx,1,320,154,27,.87);
  }
}

function passengersInBoat(ctx,layout) {
  if(layout.room!=='the_river' || layout.phase<3 || layout.phase>5)return;
  // The near gunwale crops the seated figures at the level of the bottom boards.
  ctx.save();
  ctx.beginPath();ctx.rect(-42,-49,82,36);ctx.clip();
  passenger(ctx,2,-24,-10,23,.9);
  if(layout.phase>=4){
    passenger(ctx,2,-9,-9,24,.91);
    passenger(ctx,2,2,-12,21,.88);
  }
  ctx.restore();
}

export function renderIsletSprite(ctx, object, state, time = 0) {
  if(object.kind==='ladder_traveller'){
    const visual=object.visualOptions;
    paintCharacter(ctx,object.x,object.y,'#bca071',visual.facing,visual.phase,false,
      {airborne:visual.onRungs,moving:visual.moving,blend:visual.moving?1:0,time,sceneScale:shackRouteCharacterScale(visual.room,object.y),
        costumeAtlas:state.itemLoc?.shroud==='worn'?cemeteryShroudAtlas():undefined});
    return true;
  }
  if(object.kind==='paperback' || object.kind==='slip'){
    const card=object.kind==='slip';
    const open=!card && (state.hasFlag?.('paperback_open') ?? state.flags?.includes?.('paperback_open'));
    const cover=propImage(card?'./assets/desert-shack-verse-card-v1.png':
      open?'./assets/desert-shack-paperback-open-v1.png':'./assets/desert-shack-paperback-v1.png');
    const [x,y]=object.drawAt || [object.x,object.y];
    if (cover) {
      if(!card){ctx.fillStyle='rgba(30,22,16,.32)';ctx.beginPath();ctx.ellipse(x,y-2,5,1.8,0,0,Math.PI*2);ctx.fill();}
      if(card){
        const t=fallingCard?.room===state.room && time>=fallingCard.time
          ?Math.min(1,(time-fallingCard.time)/.8):1;
        if(t<1){
          const ease=t*(2-t);
          ctx.save();
          ctx.translate(fallingCard.x+(x-fallingCard.x)*ease+Math.sin(t*Math.PI*2)*2,
            fallingCard.y+(y-fallingCard.y)*t*t-Math.sin(t*Math.PI)*5);
          ctx.rotate(Math.sin(t*Math.PI*2)*.42);
          ctx.drawImage(cover,-4,-5,8,5);ctx.restore();
        }else ctx.drawImage(cover,x-4,y-5,8,5);
      }
      else if(open)ctx.drawImage(cover,x-10,y-9,16,9);
      else ctx.drawImage(cover,x-5.5,y-9,11,9);
    }
    return true;
  }
  // The cap, door and oarsman's smaller pointer region have their own hotspots.
  if (object.kind === 'islet_gate' || object.kind === 'islet_oarsman') return true;
  if (object.kind !== 'islet_ferry') return false;
  if (!loadSheet()) return true;

  // The moored ferry rests for most of the cycle. The boatman occasionally
  // dips, draws and lifts his blade to hold it near the bank.
  const layout=object.visualOptions?.ferryVisual;
  if(!layout)return true;
  const travelling=layout.scale<.99;
  const beat=travelling?time%2.1:time%8;
  const pose=travelling?Math.floor(beat/2.1*4):beat<5.8?0:beat<6.45?1:beat<7.15?2:3;
  const frame = frames[pose];
  const bob = Math.sin(time * 1.15) * 0.42;
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  passengersOnShore(ctx,layout,time);
  ctx.translate(layout.x,layout.y);
  ctx.scale(layout.scale,layout.scale);
  ctx.globalAlpha*=layout.opacity;
  ctx.fillStyle = 'rgba(15,31,32,.25)';
  ctx.beginPath();
  ctx.ellipse(0,0,36,2.2,-.025,0,Math.PI*2);
  ctx.fill();
  if(travelling){
    ctx.lineWidth=.7;
    ctx.strokeStyle='rgba(168,184,171,.45)';
    for(let n=0;n<2;n++){
      const t=(time*.34+n*.5)%1;
      ctx.beginPath();
      ctx.ellipse(0,1+t*1.5,37+t*10,2+t*1.9,-.04,.02,2.9);
      ctx.stroke();
    }
  }
  ctx.translate(0,bob);
  ctx.drawImage(sheet, frame.left, frame.top, frame.width, frame.height,
    -(266 - 10) * scale, -(488 - frame.top) * scale,
    frame.width * scale, frame.height * scale);
  passengersInBoat(ctx,layout);
  ctx.restore();
  return true;
}

export function isletArtStatus() {
  if (!requested) return 'idle';
  return sheet ? 'loaded' : 'loading';
}

export function renderFerryAboard(ctx, view, time = 0) {
  const plate=propImage(FERRY_ABOARD_ART);
  if(!plate)return false;
  ctx.save();
  ctx.imageSmoothingEnabled=true;
  ctx.drawImage(plate,0,0,480,288);
  if(view.phase>=3)passenger(ctx,2,109,174,67,.93);
  if(view.phase>=4){
    passenger(ctx,2,178,178,73,.96,true);
    passenger(ctx,2,304,173,65,.91);
  }
  const player=FERRY_ABOARD_POINTS.player;
  ctx.translate(player.x,player.y);
  ctx.scale(player.scale,player.scale);
  paintCharacter(ctx,0,0,'#bca071','right',0,false,{
    time, costumeAtlas:view.shrouded?cemeteryShroudAtlas():null,
  });
  ctx.restore();
  // The nearest edge of the painted gunwale passes in front of the seated
  // riders' hems. Reuse its sloping timber edge in the same camera registration.
  if(view.phase>=3){
    ctx.save();
    ctx.beginPath();ctx.moveTo(24,126);
    for(const [x,y] of [[57,148],[91,158],[128,164],[181,168],[228,169],[278,168],
      [326,165],[372,161],[407,153],[433,144],[450,130],[454,211],[24,211]])ctx.lineTo(x,y);
    ctx.closePath();ctx.clip();ctx.drawImage(plate,0,0,480,288);ctx.restore();
  }
  return true;
}
