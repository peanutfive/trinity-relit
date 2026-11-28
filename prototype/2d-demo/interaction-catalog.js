import { getRanchHotspots } from './ranch-actions.js';
import { shackRouteHotspots, positionDesertBook, positionBookmark } from './shack-route-actions.js';
import { carriedItemActions } from './loose-items.js';
import { positionLooseRuby } from './roadrunner-layout.js';
import {positionDroppedSkeletonKey} from './ossuary-key-layout.js';
import {getOrbitHotspots,getOrbitInventoryActions} from './orbit-actions.js';
import {getPacificHotspots,getPacificInventoryActions} from './pacific-actions.js';
import {getPacificPassages} from './pacific-passages.js';
import {getTundraHotspots,getTundraInventoryActions} from './tundra-actions.js';
import {getRiverFerryHotspots,getIsletHotspots,getIsletInventoryActions} from './islet-actions.js';
import {ferryView} from './ferry-state.js';
import { getHotspots as getPrologueHotspots, getInventoryActions as getPrologueInventoryActions } from './prologue-actions.js';
import { getWabeHotspots, getWabeInventoryActions } from './wabe-actions.js';
import { getJapanHotspots, getJapanInventoryActions } from './japan-actions.js';
import {getUndergroundHotspots,getUndergroundInventoryActions} from './underground-actions.js';
import { applyTerrainHotspotAdjustments } from './terrain.js';

// A visual action catalog only. State mutation remains inside engine commands.
export function getHotspots(state,options={}) {
  if(state.room==='the_river' && ferryView(state).onboard)return getRiverFerryHotspots(state);
  const objects=state.chapter==='wabe'?[...getWabeHotspots(state),...getRiverFerryHotspots(state)]
    :state.chapter==='japan'?getJapanHotspots(state)
      :state.chapter==='underground'?getUndergroundHotspots(state)
      :state.chapter==='orbit'?getOrbitHotspots(state)
      :state.chapter==='pacific'?[...getPacificHotspots(state),...getPacificPassages(state)]
      :state.chapter==='ranch'?getRanchHotspots(state)
      :state.chapter==='tundra'?getTundraHotspots(state,options)
      :state.chapter==='desert'?[...getIsletHotspots(state,options).map(o=>positionDesertBook(state,o)),...shackRouteHotspots(state)]
      :state.chapter==='islet'?getIsletHotspots(state)
      :state.chapter==='prologue'?getPrologueHotspots(state):[];
  return applyTerrainHotspotAdjustments(state.room,objects).map(object=>{
    if(object.itemId==='key_barrow')return positionDroppedSkeletonKey(state,object);
    return positionLooseRuby(state,positionBookmark(state,object));
  });
}

export function getInventoryActions(id, state) {
  if (state.chapter === 'wabe') return getWabeInventoryActions(id, state);
  if(state.chapter==='underground')return getUndergroundInventoryActions(id,state);
  if (state.chapter === 'japan') return getJapanInventoryActions(id, state);
  if(state.chapter==='orbit')return getOrbitInventoryActions(id,state);
  if(state.chapter==='pacific')return getPacificInventoryActions(id,state);
  if(state.chapter==='ranch')return carriedItemActions(id,state);
  if(state.chapter==='tundra')return getTundraInventoryActions(id,state);
  if(['islet','desert'].includes(state.chapter))return getIsletInventoryActions(id,state);
  if (state.chapter === 'prologue') return getPrologueInventoryActions(id, state);
  return [];
}
