import { SHACK_ROUTE_LAYOUT } from './shack-route-layout.js';

const levels=['tower_platform','tower_landing','base_of_tower'];
const clamp=value=>Math.max(0,Math.min(1,value));

export function towerClimb(before,after) {
  const from=levels.indexOf(before.room),to=levels.indexOf(after.room);
  if (from<0 || to<0 || Math.abs(from-to)!==1) return null;
  const down=to>from,upper=down?before:after,lower=down?after:before;
  const layout=SHACK_ROUTE_LAYOUT[upper.room],top=layout.exitAnchors.d;
  const upperPlayer=upper.visual?.player,lowerPlayer=lower.visual?.player;
  if (!upperPlayer || !lowerPlayer) return null;
  return {down,upper:upper.room,lower:lower.room,upperPlayer,lowerPlayer,
    top,bottom:layout.lowerRung,duration:1.65};
}

export function towerClimbFrame(motion,elapsed) {
  const t=clamp(elapsed/motion.duration),height=motion.down?t:1-t;
  const atLowerEnd=height>=.83, onRungs=height>.24 && !atLowerEnd;
  let {x,y,face}=atLowerEnd?motion.lowerPlayer:motion.upperPlayer;
  if (!atLowerEnd) {
    const a=onRungs?motion.top:[x,y],b=onRungs?motion.bottom:motion.top;
    const part=onRungs?(height-.24)/.59:height/.24;
    x=a[0]+(b[0]-a[0])*part;
    y=a[1]+(b[1]-a[1])*part;
    if (onRungs) face='up';
    else if(Math.abs(a[0]-b[0])>1)face=(b[0]>a[0])===motion.down?'right':'left';
  }
  return {room:atLowerEnd?motion.lower:motion.upper,fade:clamp(1-Math.abs(height-.83)/.12),
    actor:{id:'desert:ladder-traveller',kind:'ladder_traveller',x,y,
      visualOptions:{room:atLowerEnd?motion.lower:motion.upper,facing:face,onRungs,moving:!atLowerEnd,phase:t*19}}};
}
