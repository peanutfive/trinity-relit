import {ITEMS} from '../js/data/items.js';
import {ARBOR_POINTS as P, ARBOR_LOOSE_ANCHORS} from './arbor-points.js';

export const ARBOR_WABE_ROOMS = Object.freeze([
  'trellises', 'arboretum', 'top_of_arbor', 'north_arbor', 'south_arbor',
  'arborvitaes_n', 'arborvitaes_s', 'waterfall',
]);
const supported = new Set(ARBOR_WABE_ROOMS);
const action = (label, command) => ({label, command});
const ellipse = (x, y, rx, ry, priority = 1) => ({kind: 'ellipse', x, y, rx, ry, priority});
const prop = (id, point, label, kind, actions, extra = {}) => ({
  id, ...point, label, kind, radius: 37, actions, ...extra,
});

// Read-only affordances for the current chapter. Traversal, flipping, item
// ownership and the Mercury/bubble conditions remain the original engine's job.
export function getArborHotspots(state) {
  if (!supported.has(state.room)) return [];
  const objects = [];
  if (state.room === 'trellises') objects.push(prop(
    'trellises:ascent', P.trellisesUp, '向上的藤蔓小径', 'passage',
    [action('登上藤架', 'u')],
    {baked: true, radius: 30, pointerShape: ellipse(341, 28, 18, 22)},
  ));
  if(state.room==='top_of_arbor')objects.push(prop('top_of_arbor:descent',{x:113,y:190},'向下的藤蔓小径','passage',[action('走下藤架','d')],{baked:true,radius:37,pointerShape:ellipse(133,171,24,18)}));
  if (state.room === 'waterfall') objects.push(
    prop('waterfall:water', P.waterfall, '瀑布', 'arbor_waterfall',
      [action('观察瀑布', 'examine waterfall')],
      {baked: true, eventId: 'examine_waterfall', radius: 48,
        pointerShape: ellipse(139, 63, 57, 55)}),
    prop('waterfall:mushroom', P.mushroom, '蘑菇门', 'mushroom_gate',
      [action('观察此处', 'look'), action('穿过蘑菇门', 'in')],
      {visualOptions: {open: state.sundialSymbol === 3},
        pointerShape: ellipse(P.mushroom.x, P.mushroom.y - 29, 28, 32)}),
  );

  const [baseX, baseY] = ARBOR_LOOSE_ANCHORS[state.room];
  state.roomItems().filter(id => ITEMS[id]).forEach((id, index) => {
    const item = ITEMS[id], noun = item.aliases?.[0] || id;
    const treeAxe = id === 'axe' && state.room === 'top_of_arbor';
    const point = treeAxe ? P.axe : {
      x: baseX + (index % 3 - 1) * 11,
      y: baseY + Math.floor(index / 3) * 8,
    };
    const actions = [action('查看', `examine ${noun}`)];
    if (!item.fixed) actions.push(action('拿取', `take ${noun}`));
    objects.push(prop(`arbor:item:${id}`, point, item.cn,
      id === 'axe' ? 'arbor_axe' : id, actions, {
        itemId: id,
        visualOptions: treeAxe ? {drawAt: P.axeArt} : {},
        pointerShape: treeAxe
          ? ellipse(P.axeArt.x, P.axeArt.y - 12, 12, 18, 2)
          : ellipse(point.x, point.y - 6, id === 'soap_bubble' ? 9 : 7, 8, 2),
      }));
  });
  return objects;
}

export function getArborInventoryActions(id, state) {
  if (!supported.has(state.room) || !state.has(id) || !ITEMS[id]) return [];
  const item = ITEMS[id], noun = item.aliases?.[0] || id;
  const actions = [action('查看', `examine ${noun}`)];
  if (!item.fixed) actions.push(action('放下', `drop ${noun}`));
  return actions;
}
