import { getHotspots as getPrologueHotspots, getInventoryActions as getPrologueInventoryActions } from './prologue-actions.js';
import { getWabeHotspots, getWabeInventoryActions } from './wabe-actions.js';
import { applyTerrainHotspotAdjustments } from './terrain.js';

// A visual action catalog only. State mutation remains inside engine commands.
export function getHotspots(state) {
  const objects=state.chapter==='wabe'?getWabeHotspots(state):state.chapter==='prologue'?getPrologueHotspots(state):[];
  return applyTerrainHotspotAdjustments(state.room,objects);
}

export function getInventoryActions(id, state) {
  if (state.chapter === 'wabe') return getWabeInventoryActions(id, state);
  if (state.chapter === 'prologue') return getPrologueInventoryActions(id, state);
  return [];
}
