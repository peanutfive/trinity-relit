import { ITEMS } from '../js/data/items.js';
import {JAPAN_POINTS as P} from './japan-route-layout.js';

// Wabe slices: these are affordances for the current runtime, not new rules
// or a claim that the existing chapter's topology/text has been independently verified.
export const WABE_SLICE_ROOMS = Object.freeze([
  'meadow', 'summit', 'south_bog', 'north_bog',
  'bottom_of_stairs', 'vertex', 'forest_clearing', 'trellises',
  'the_bend', 'moor',
]);
const supported = new Set(WABE_SLICE_ROOMS);
const action = (label, command) => ({ label, command });
function object(id, x, y, label, kind, eventId, actions, itemId) {
  return { id, x, y, label, kind, eventId, itemId, radius: 37, actions };
}

function looseItemPosition(id, room, index) {
  if (id === 'splinter' && room === 'south_bog') return [294, 180];
  return [165 + (index % 5) * 37, 216 + Math.floor(index / 5) * 14];
}

export function getWabeHotspots(state) {
  const room = state.room;
  if (!supported.has(room)) return [];
  const objects = [];
  if (room === 'meadow') objects.push(object(
    'meadow:sundial', 245, 148, '日晷', 'sundial', 'examine_sundial_meadow',
    [action('查看日晷', 'examine sundial')],
  ));
  if (room === 'south_bog') objects.push(object(
    'south_bog:log', 312, 177, '腐烂的圆木', 'log', 'examine_log',
    [action('查看圆木', 'examine log')],
  ));
  if (room === 'bottom_of_stairs') objects.push(object(
    'bottom_of_stairs:stairs', 245, 112, '崖壁石阶', 'stairs', undefined,
    [action('查看此处', 'look'), action('登上石阶', 'u')],
  ));
  if (room === 'moor') {
    objects.push(object('moor:mushroom-gate', P.gate.x, P.gate.y, '蘑菇门', 'mushroom_gate', undefined,
      [action('观察此处', 'look'), action('穿过蘑菇门', 'in')]));
    Object.assign(objects.at(-1), {visualOptions: {open: state.sundialSymbol === 1}, pointerShape: {
      kind: 'ellipse', x: P.gate.x, y: P.gate.y-29, rx: 28, ry: 32, priority: 1,
    }});
  }
  if (room === 'vertex') {
    objects.push(
      object('vertex:sundial', 245, 140, '日晷', 'sundial', 'examine_sundial_vertex',
        [action('查看日晷', 'examine sundial')], 'sundial'),
      object('vertex:ring', 285, 175, '符号环', 'ring', 'examine_ring',
        [action('查看符号环', 'examine ring'), action('转动符号环', 'turn ring')], 'ring'),
      // This fixed pointer is not the portable prologue gnomon. Never offer taking it.
      object('vertex:fixed-gnomon', 218, 173, '嵌入表盘的指针', 'gnomon', 'examine_gnomon_vertex',
        [action('查看指针与影子', 'examine gnomon')]),
      object('vertex:stairs', 200, 232, '下行石阶', 'stairs', undefined,
        [action('走下石阶', 'd')]),
    );
  }

  // Include dropped items in any room of the slice. Fixed sundial/ring props are
  // already represented above and must not appear twice as generic loose objects.
  const represented = new Set(objects.map(object => object.itemId).filter(Boolean));
  const looseItems = state.roomItems().filter(id => ITEMS[id] && !represented.has(id));
  looseItems.forEach((id, index) => {
    const item = ITEMS[id];
    const noun = item.aliases?.[0] || id;
    const actions = [action('查看', `examine ${noun}`)];
    if (!item.fixed) actions.push(action(id === 'splinter' ? '拾起木片' : '拿取', `take ${noun}`));
    const [x, y] = looseItemPosition(id, room, index);
    objects.push(object(`wabe:item:${id}`, x, y, item.cn, id,
      id === 'splinter' && room === 'south_bog' ? 'examine_splinter' : undefined, actions, id));
  });
  return objects;
}

export function getWabeInventoryActions(id, state) {
  if (!supported.has(state.room) || !ITEMS[id] || !state.has(id)) return [];
  const item = ITEMS[id];
  const noun = item.aliases?.[0] || id;
  const actions = [action('查看', `examine ${noun}`)];
  if (!item.fixed) actions.push(action('放下', `drop ${noun}`));
  // No chapter portals, symbol shortcuts, or future puzzle uses are invented here.
  return actions;
}
