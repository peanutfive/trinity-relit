import { ITEMS } from '../js/data/items.js';
import { LOGICAL_SIZE, isSegmentWalkable } from './world.js';

const interiors = new Set(['kitchen', 'se_room', 'nw_room', 'spare_room', 'bedroom', 'bathroom', 'hallway', 'icehouse']);
const possessions = new Set(['inventory', 'pocket', 'worn']);
const catalogue = Object.keys(ITEMS);
const direction = { up: [0,-1], down: [0,1], left: [-1,0], right: [1,0] };

// Older saves have item locations but no coordinates. Reserve one stable spot
// per item in the original display area of each room.
function legacyFloorPoint(id, [baseX, baseY]) {
  const index = catalogue.indexOf(id);
  return { x: baseX + (index % 7 - 3) * 18, y: baseY + (Math.floor(index / 7) - 2) * 16 };
}

export function indoorFloorPoint(state, id, anchor) {
  if (!interiors.has(state.room)) return null;
  const key = `ranch_floor_${state.room}_${id}`;
  const x = state.cnt(key + '_x'), y = state.cnt(key + '_y');
  if (x > 0 && x < LOGICAL_SIZE.width && y > 0 && y < LOGICAL_SIZE.height) return { x, y };
  return legacyFloorPoint(id, anchor);
}

function nearbyDrop(player, scene, occupied) {
  const [dx, dy] = direction[player.face] || direction.down;
  const exits = Object.values(scene.exitAnchors || {});
  // Start in front of the player, then try both sides and finally behind them.
  for (const radius of [19, 34, 51, 69]) {
    for (const turn of [0, 1, -1, 2, -2, 3, -3, 4]) {
      const angle = turn * Math.PI / 4;
      const x = Math.round(player.x + radius * (dx * Math.cos(angle) - dy * Math.sin(angle)));
      const y = Math.round(player.y + radius * (dx * Math.sin(angle) + dy * Math.cos(angle)));
      if (occupied.some(other => Math.hypot(x - other.x, y - other.y) < 17)) continue;
      if (exits.some(([ex, ey]) => Math.hypot(x - ex, y - ey) < 21)) continue;
      if (isSegmentWalkable(scene, player, { x, y })) return { x, y };
    }
  }
  return null;
}

export function rememberIndoorDrops(before, state, scene) {
  if (state.chapter !== 'ranch' || !interiors.has(state.room) || before.room !== state.room) return;
  const dropped = state.roomItems().filter(id => Object.hasOwn(ITEMS, id) && possessions.has(before.itemLoc[id]));
  if (!dropped.length) return;
  const occupied = before.visual.hotspots.filter(object =>
    before.itemLoc[object.itemId] === state.room && state.inRoom(object.itemId));
  for (const id of dropped) {
    const key = `ranch_floor_${state.room}_${id}`;
    let point = nearbyDrop(before.visual.player, scene, occupied);
    if (!point) {
      const oldSpots = catalogue.map(candidate => legacyFloorPoint(candidate, scene.looseAnchor));
      point = oldSpots.find(p => occupied.every(other => Math.hypot(p.x - other.x, p.y - other.y) >= 15))
        || legacyFloorPoint(id, scene.looseAnchor);
    }
    state.setCnt(key + '_x', point.x);
    state.setCnt(key + '_y', point.y);
    occupied.push(point);
  }
}
