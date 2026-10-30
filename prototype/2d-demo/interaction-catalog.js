import {getOrbitHotspots,getOrbitInventoryActions} from './orbit-actions.js';
import { getHotspots as getPrologueHotspots, getInventoryActions as getPrologueInventoryActions } from './prologue-actions.js';
import { getWabeHotspots, getWabeInventoryActions } from './wabe-actions.js';
import { getJapanHotspots, getJapanInventoryActions } from './japan-actions.js';
import {getUndergroundHotspots,getUndergroundInventoryActions} from './underground-actions.js';
import { applyTerrainHotspotAdjustments } from './terrain.js';

// A visual action catalog only. State mutation remains inside engine commands.
export function getHotspots(state) {
  const objects=state.chapter==='wabe'?getWabeHotspots(state)
    :state.chapter==='japan'?getJapanHotspots(state)
      :state.chapter==='underground'?getUndergroundHotspots(state)
      :state.chapter==='orbit'?getOrbitHotspots(state)
      :state.chapter==='prologue'?getPrologueHotspots(state):[];
  return applyTerrainHotspotAdjustments(state.room,objects);
}

export function getInventoryActions(id, state) {
  if (state.chapter === 'wabe') return getWabeInventoryActions(id, state);
  if(state.chapter==='underground')return getUndergroundInventoryActions(id,state);
  if (state.chapter === 'japan') return getJapanInventoryActions(id, state);
  if(state.chapter==='orbit')return getOrbitInventoryActions(id,state);
  if (state.chapter === 'prologue') return getPrologueInventoryActions(id, state);
  return [];
}
