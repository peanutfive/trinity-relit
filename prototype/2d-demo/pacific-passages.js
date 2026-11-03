import {ROOMS} from '../js/data/pacific.js';
import {PACIFIC_LAYOUT} from './pacific-layout.js';

// Stairways, shed doors and the mushroom portal need an intentional F press.
// This catalog reads the existing exits; it cannot add a route or run its act.
export function getPacificPassages(state){
  const layout=PACIFIC_LAYOUT[state.room],room=ROOMS[state.room];
  if(!layout||!room)return [];
  const exits=room.exits(state);
  return (layout.interactionExitDirs||[]).flatMap(direction=>{
    if(layout.hiddenExitDirs?.includes(direction))return [];
    const value=exits[direction],target=typeof value==='string'?value:value?.to;
    const anchor=layout.exitAnchors?.[direction];
    if(!target||!anchor||typeof value?.when==='function'&&!value.when(state))return [];
    const visual=layout.passageVisuals?.[direction]||{};
    return [{id:`${state.room}:passage:${direction}`,kind:'passage',x:anchor[0],y:anchor[1],
      radius:30,baked:true,label:visual.label||({u:'上行',d:'下行',in:'进入',out:'返回'}[direction]||'通行'),
      actions:[{label:'通行',command:direction}],
      pointerShape:visual.pointerShape||{kind:'ellipse',x:anchor[0],y:anchor[1]-12,rx:10,ry:17},
      ...visual}];
  });
}
