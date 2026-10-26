// Measured from the unmodified generated RGBA atlases. All public grips,
// wheel centres and radii below are in logical world pixels, relative to feet.
const rightScale=26.5/420,downScale=31/479;
export const pramFacing=room=>['lancaster_walk','flower_walk'].includes(room)?'down':'right';
const world=(point,foot,scale)=>point.map((v,i)=>(v-foot[i])*scale);
function cart(height,scale,foot,grip,wheels){
  const projected=wheels.map(([x,y,r,aspect=1])=>({center:world([x,y],foot,scale),radius:r*scale,aspect}));
  return Object.freeze({height,scale,grip:Object.freeze(world(grip,foot,scale)),
    wheelRadius:projected[0].radius,wheels:Object.freeze(projected),
    wheelCenters:Object.freeze(projected.map(w=>w.center)),
    wheelContacts:Object.freeze(projected.map(w=>[w.center[0],w.center[1]+w.radius]))});
}
export const PRAM_GEOMETRY=Object.freeze({
  right:cart(26.5,rightScale,[512,464],[205,143],[[391,375,80],[608,381,79]]),
  down:cart(31,downScale,[454,980],[460,514],[[335,887,84,.39],[519,891,88,.35],[405,846,66,.3],[584,823,79,.27]]),
});
export const PUSHER_GEOMETRY=Object.freeze({
  right:Object.freeze({height:35,grip:Object.freeze([94*35/427,-249*35/427])}),
  down:Object.freeze({height:35,grip:Object.freeze([0,-244.5*35/453])}),
});
export const PRAM_ART_FRAMES=Object.freeze({
  right:Object.freeze({
    closed:{source:[178,40,513,427],foot:[512,464],scale:rightScale,wheels:[[391,375,80,1],[608,381,79,1]]},
    open:{source:[830,41,534,427],foot:[1164,464],scale:rightScale,wheels:[[1043,376,80,1],[1265,381,79,1]]},
  }),
  down:Object.freeze({
    closed:{source:[300,497,310,487],foot:[454,980],scale:downScale,wheels:[[335,887,84,.39],[519,891,88,.35],[405,846,66,.3],[584,823,79,.27]]},
    open:{source:[956,497,305,487],foot:[1107,980],scale:downScale,wheels:[[990,887,84,.39],[1177,891,88,.35],[1063,846,66,.3],[1236,823,79,.27]]},
  }),
});
export const PUSHER_ART_FRAMES=Object.freeze({
  right:Object.freeze([
    {source:[265,18,202,436],head:22,foot:[348,449],grip:[442,200]},
    {source:[635,18,264,434],head:22,foot:[766,447],grip:[858,201]},
    {source:[1076,19,281,433],head:23,foot:[1217,447],grip:[1309,202]},
  ]),
  down:Object.freeze([
    {source:[242,501,194,461],head:505,foot:[339,958],grip:[339,713.5]},
    {source:[670,501,195,480],head:505,foot:[768,976],grip:[769,713.5]},
    {source:[1106,501,193,480],head:505,foot:[1205,976],grip:[1209.5,713.5],flip:true},
  ]),
});
export function pusherFrameFor(options={}){
  if(Number.isInteger(options.pushFrame))return Math.max(0,Math.min(2,options.pushFrame));
  if(!options.moving)return 0;
  // The motion planner supplies travelled-distance phase in radians.
  const phase=(((options.phase||0)/(Math.PI*2))%1+1)%1;
  return [0,1,0,2][Math.floor(phase*4)];
}
