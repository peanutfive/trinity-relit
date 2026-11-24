import { ROOMS } from '../js/data/pacific.js';
import { PACIFIC_LAYOUT } from './pacific-layout.js';
import { passageHotspots } from './scene-passages.js';

export function getPacificPassages(state) {
  return passageHotspots(state, PACIFIC_LAYOUT[state.room], ROOMS[state.room]);
}
