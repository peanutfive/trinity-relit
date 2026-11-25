import { isletDoorView } from './islet-shadow.js';
import { shackDoorOpen } from './shack-story.js';

export const ISLET_OPEN_ART = './assets/islet-door-aligned-v1.png';
export const ISLET_NEAR_ART = './assets/islet-shadow-near-v1.png';
export const SHACK_CLOSED_ART = './assets/desert-shack-door-shut-v1.png';

export function doorwayLayer(room, state) {
  if (room === 'shack' && !shackDoorOpen(state)) return SHACK_CLOSED_ART;
  if (room !== 'islet') return null;
  const door = isletDoorView(state);
  if (door.legacy) return null;
  if (door.open) return ISLET_OPEN_ART;
  return door.near ? ISLET_NEAR_ART : null;
}
