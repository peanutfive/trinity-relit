import { RANCH_EAST_YARDS_LAYOUT } from './ranch-east-yards-layout.js';
import { RANCH_DECK_LAYOUT } from './ranch-deck-layout.js';
import { ITEMS } from '../js/data/items.js';
import { RANCH_WATER_LAYOUT } from './ranch-water-layout.js';
import { RANCH_WINDMILL_LANDING_LAYOUT } from './ranch-windmill-landing-layout.js';
import { RANCH_PERIMETER_LAYOUT } from './ranch-perimeter-layout.js';
import { RANCH_RESERVOIR_LAYOUT } from './ranch-reservoir-layout.js';
import { ROOMS, reservoirBottomLit, windmillBinocularsLocation } from './ranch-story.js';
import { groundItems } from './loose-items.js';
import { passageHotspots } from './scene-passages.js';

const layouts = {...RANCH_PERIMETER_LAYOUT,...RANCH_RESERVOIR_LAYOUT,
  ...RANCH_WINDMILL_LANDING_LAYOUT,...RANCH_WATER_LAYOUT,...RANCH_DECK_LAYOUT,...RANCH_EAST_YARDS_LAYOUT};

const ROOM_ITEM_SLOTS={splinter:[293,154],paper_bird:[276,182],umbrella:[247,133],bag:[333,190],ball:[348,145]};
function reserveSiltSlot(id){
  // All item IDs have a stable index in the chapter's inventory catalogue.
  const index=Object.keys(ITEMS).indexOf(id);
  return [110+(index%5)*25,133+Math.floor(index/5)*11];
}
export function getRanchHotspots(state) {
  const layout = layouts[state.room];
  if (!layout) return [];
  const objects = passageHotspots(state,layout,ROOMS[state.room]);
  if(layout.doorPlacement){
    const {id,approach,pointerShape}=layout.doorPlacement;
    const open=state.hasFlag('ne_yard_outside_door_open');
    objects.push({id,kind:'ranch_outside_door',baked:true,label:'外门',x:approach[0],y:approach[1],
      radius:18,pointerShape,physicalHint:open?'合上门':'推开门',
      actions:[{label:open?'关门':'开门',command:open?'close outside door':'open outside door'}]});
  }
  if (state.room === 'underwater' && !reservoirBottomLit(state)) return objects;
  const placement = layout.binocularsPlacement;
  if (placement && windmillBinocularsLocation(state) === state.room) {
    const [x,y] = placement.at;
    objects.push({id:'ranch:item:binoculars',kind:'binoculars',itemId:'binoculars',label:'望远镜',x,y,
      radius:25,pointerShape:{...placement.pointerShape,priority:4},
      physicalHint:state.room === 'windmill' ? '伸手' : '拾取',
      actions:[{label:'拿取',command:'take binoculars'}]});
  }
  if (state.room === 'south_reservoir' && state.has('binoculars')) {
    objects.push({id:'south_reservoir:view-windmill',kind:'ranch_view',baked:true,
      label:'远处的风车',x:377,y:118,radius:32,
      pointerShape:{kind:'polygon',points:[[363,117],[390,91],[394,99],[374,128]]},physicalHint:'举镜远望',
      actions:[{label:'举起望远镜',command:'look at windmill through binoculars'}]});
  }
  const loose=groundItems(state,layout.looseAnchor,placement?['binoculars']:[]);
  if(state.room==='underwater'){
    // Keep each fallen silhouette on its own patch of silt, including the
    // paper bird's wings. Picking up a neighbour must not move the light.
    for(const object of loose){
      const slot=ROOM_ITEM_SLOTS[object.itemId] ?? reserveSiltSlot(object.itemId);
      object.x=slot[0];object.y=slot[1];
      object.pointerShape={...object.pointerShape,x:object.x,y:object.y-3};
    }
  }
  return [...objects,...loose];
}

// The surface and bottom share depth controls wherever the swimmer is.
// The landing spans the painted concrete lip and is reachable along its width.
export function positionWaterTarget(object,player) {
  if (object.actorRelative) return {...object,x:player.x,y:player.y,
    pointerShape:{...object.pointerShape,x:player.x,y:player.y-5}};
  if (object.shoreline) return {...object,x:Math.max(object.shoreline[0],Math.min(object.shoreline[1],player.x))};
  return object;
}
