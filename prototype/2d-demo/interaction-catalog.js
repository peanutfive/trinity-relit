import { getHotspots as getPrologueHotspots, getInventoryActions as getPrologueInventoryActions } from './prologue-actions.js';
import { getWabeHotspots, getWabeInventoryActions } from './wabe-actions.js';

// A visual action catalog only. State mutation remains inside engine commands.
export function getHotspots(state) {
  if (state.chapter === 'wabe') return getWabeHotspots(state);
  if (state.chapter === 'prologue') return getPrologueHotspots(state);
  return [];
}

export function getInventoryActions(id, state) {
  if (state.chapter === 'wabe') return getWabeInventoryActions(id, state);
  if (state.chapter === 'prologue') return getPrologueInventoryActions(id, state);
  return [];
}
