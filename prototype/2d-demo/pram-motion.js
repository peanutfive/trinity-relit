import { SCENES } from './scene-manifest.js';
import { findPath, isBlocked, isSegmentWalkable } from './world.js';
import { PRAM_GEOMETRY, PUSHER_GEOMETRY, pramFacing } from './pram-art-layout.js';
export { pramFacing } from './pram-art-layout.js';

const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const speed = 60, ramp = .4;

export function pramPusherOffset(facing) {
  const cart = PRAM_GEOMETRY[facing].grip, person = PUSHER_GEOMETRY[facing].grip;
  return { x: cart[0] - person[0], y: cart[1] - person[1] };
}

export function createPramPushMotion({fromRoom, room, target}) {
  const scene = SCENES[room], entrance = scene?.exits.find(exit => exit.target === fromRoom);
  if (!entrance || !target) throw new Error(`No painted pram entrance: ${fromRoom} → ${room}`);
  const facing = pramFacing(room), offset = pramPusherOffset(facing);
  const entry = {x:entrance.x, y:entrance.y};
  const contacts = [{x:0,y:0,footprint:{rx:6,ry:3}},
    {...offset,footprint:{rx:6,ry:3}},
    ...(PRAM_GEOMETRY[facing].wheelContacts || []).map(([x,y])=>({x,y,footprint:{rx:1.5,ry:.8}}))];
  const assembly = {...scene, contactOffsets:contacts};
  // At a screen edge the person is still arriving from the previous room.
  // Follow the actual entrance until both contacts fit on the playable mesh;
  // never invent a horizontal slide at the destination's height.
  const approach = facing === 'right' ? {x:entry.x+40,y:entry.y} : {x:entry.x,y:entry.y+40};
  const initial = findPath(scene, entry, approach, {step:2});
  if (!initial.length) throw new Error(`Blocked pram entrance: ${room}`);
  let gateway = null, prefix = [];
  for (let index=0; index<initial.length-1 && !gateway; index++) {
    const a=initial[index], b=initial[index+1], steps=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1]));
    if (!prefix.length) prefix.push(a);
    for(let step=0;step<=steps;step++) {
      const p={x:a[0]+(b[0]-a[0])*step/steps,y:a[1]+(b[1]-a[1])*step/steps};
      if(!isBlocked(assembly,p.x,p.y)){gateway=p;prefix.push([p.x,p.y]);break;}
    }
    if(!gateway)prefix.push(b);
  }
  if (!gateway) throw new Error(`No grounded pram assembly at entrance: ${room}`);
  const remaining=findPath(assembly,gateway,target,{step:2});
  if(!remaining.length) throw new Error(`No grounded pram route: ${room}`);
  // The entrance prefix is the only place a contact may be off screen. Any
  // visible part still has to follow the original ground, not a cinematic arc.
  for(let i=1;i<prefix.length;i++)if(!isSegmentWalkable(scene,prefix[i-1],prefix[i]))throw new Error(`Unsafe pram entry: ${room}`);
  const path=[...prefix,...remaining.slice(1)].filter((p,index,array)=>!index||Math.hypot(p[0]-array[index-1][0],p[1]-array[index-1][1])>.001);
  const lengths=path.slice(1).map((p,i)=>Math.hypot(p[0]-path[i][0],p[1]-path[i][1]));
  const distance=lengths.reduce((a,b)=>a+b,0), duration=distance/speed+ramp;
  return {room,fromRoom,facing,entry,path,lengths,distance,duration,offset,
    landing:{x:target.x+offset.x,y:target.y+offset.y,face:facing}};
}

export function samplePramPushMotion(plan, elapsed) {
  const t=clamp(elapsed,0,plan.duration), end=plan.duration;
  // Integrate a constant-speed middle with a short acceleration and brake.
  // Duration follows mileage, so a long path cannot finish in one second.
  const travelled=t<ramp ? speed*t*t/(2*ramp) : t>end-ramp
    ? plan.distance-speed*(end-t)**2/(2*ramp) : speed*(t-ramp/2);
  const distance=clamp(travelled,0,plan.distance);
  let remaining=distance, index=0;
  while(index<plan.lengths.length-1&&remaining>plan.lengths[index])remaining-=plan.lengths[index++];
  const a=plan.path[index], b=plan.path[index+1], fraction=clamp(remaining/(plan.lengths[index]||1),0,1);
  const x=a[0]+(b[0]-a[0])*fraction,y=a[1]+(b[1]-a[1])*fraction;
  const moving=t>0&&t<end, progress=clamp(t/end,0,1);
  const wheelPhase=distance/(PRAM_GEOMETRY[plan.facing].wheelRadius||3.6), phase=distance/25*Math.PI*2;
  return {distance,progress,
    pram:{id:`${plan.room}:moving-pram`,room:plan.room,kind:'pram',x,y,
      visualOptions:{facing:plan.facing,rolling:moving,wheelPhase,broken:false}},
    pusher:{id:`${plan.room}:pusher`,room:plan.room,kind:'pusher',x:x+plan.offset.x,y:y+plan.offset.y,
      visualOptions:{facing:plan.facing,moving,phase,progress}}};
}
