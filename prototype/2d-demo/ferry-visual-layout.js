import { ISLET_POINTS } from './islet-layout.js';

const riverBerth = ISLET_POINTS.river.drawAt;
const sandBerth = ISLET_POINTS.sand_bar.ferry.drawAt;
const stop = (at, scale = 1, opacity = 1) => ({ ...at, scale, opacity });

const river = {
  0: stop({x:421,y:61}, .33, .57),
  1: stop({x:409,y:106}, .65, .86),
  2: stop(riverBerth),
  3: stop(riverBerth),
  4: stop(riverBerth),
  5: stop({x:412,y:101}, .58, .71),
};
const sand = {
  7: stop({x:326,y:45}, .35, .59),
  8: stop({x:335,y:95}, .70, .86),
  9: stop(sandBerth),
  10: stop({x:344,y:97}, .63, .72),
};

// Coordinates below are relative to the ferry atlas's common waterline.
// Draw and pointer use the same turn snapshot; idle rocking never moves a target.
function shape(layout, points, priority){
  return {kind:'polygon',priority,points:points.map(([x,y])=>
    [layout.x+x*layout.scale,layout.y+y*layout.scale])};
}
const hull = [[-43,-20],[-30,-25],[0,-29],[28,-26],[42,-20],[37,-9],[29,-3],[13,0],[-19,0],[-33,-5]];
const boatman = [[12,-42],[15,-51],[20,-52],[25,-46],[26,-39],[29,-32],[26,-23],[17,-22],[10,-28]];

export const FERRY_ABOARD_POINTS = {
  hull:{kind:'polygon',priority:2,points:[[22,120],[64,112],[194,103],[351,105],[430,109],
    [451,117],[454,132],[441,156],[408,178],[351,191],[214,198],[81,189],[44,166]]},
  oarsman:{kind:'polygon',priority:5,points:[[357,93],[370,78],[376,60],[387,53],[400,57],
    [411,72],[419,99],[428,126],[430,149],[412,157],[362,157],[356,144],[372,112]]},
  player:{x:242,y:157,scale:2.95},
};

export function ferryShoreGeometry(room, view) {
  let layout;
  const oldTrip = view?.legacyPaid || view?.legacyUnpaid;
  if(room==='islet' && oldTrip){
    layout=stop(ISLET_POINTS.islet.ferry.drawAt);
  } else if(room==='the_river' || room==='sand_bar'){
    if(view?.legacyPaid || room==='sand_bar' && view?.legacyUnpaid)layout=stop(room==='the_river'?riverBerth:sandBerth);
    else if(view?.visible)layout=(room==='the_river'?river:sand)[view.phase];
  }
  if(!layout)return null;
  return {...layout,phase:oldTrip?null:view?.phase,room,
    hull:shape(layout,hull,2),oarsman:shape(layout,boatman,4)};
}
