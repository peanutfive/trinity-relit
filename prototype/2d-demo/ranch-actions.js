import { RANCH_PERIMETER_LAYOUT } from './ranch-perimeter-layout.js';
import { RANCH_RESERVOIR_LAYOUT } from './ranch-reservoir-layout.js';
import { ROOMS } from '../js/data/ranch.js';
import { groundItems } from './loose-items.js';
import { passageHotspots } from './scene-passages.js';

export function getRanchHotspots(state) {
  const layout = RANCH_PERIMETER_LAYOUT[state.room] || RANCH_RESERVOIR_LAYOUT[state.room];
  if (!layout) return [];
  return [...passageHotspots(state, layout, ROOMS[state.room]), ...groundItems(state, layout.looseAnchor)];
}
