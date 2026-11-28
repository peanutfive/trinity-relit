import {arborLight} from './arbor-light-state.js';
import {waterfallDoorView} from './islet-shadow.js';
import {FALLS_STEPS} from './waterfall-stair-points.js';
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
  if (state.room === 'top_of_arbor' && !arborLight(state)) return [];
  if (state.room === 'arboretum') objects.push(prop(
    'arboretum:sculpture', P.crystalStand, '水晶雕塑', 'arbor_crystal',
    [action('观察雕塑', 'examine sculpture')],
    {baked: true, pointerShape: ellipse(P.crystal.x, P.crystal.y - 24, 15, 25)},
  ));
  if (state.room === 'waterfall') {
    const gate=waterfallDoorView(state);
    objects.push(
    prop('waterfall:steps',FALLS_STEPS,'石阶','cliff_stone_steps',
      [action('观察石阶','examine steps'),action('上石阶','n')],
      {baked:true,eventId:'waterfall_examine_steps',radius:23,pointerShape:{kind:'polygon',priority:2,
        points:[[172,15],[194,14],[221,40],[237,58],[239,73],[228,86],[216,83],[223,66],[216,54],[202,38],[183,22]]}}),
    prop('waterfall:water', P.waterfall, '瀑布', 'arbor_waterfall',
      [action('观察瀑布', 'examine waterfall')],
      {baked: true, eventId: 'examine_waterfall', radius: 48,
        pointerShape:{kind:'polygon',points:[[90,3],[123,3],[128,32],[127,63],[134,81],[124,95],[89,97],[77,85],[86,59],[90,31]]}}),
    prop('waterfall:spray', {x:124,y:80}, state.hasFlag('waterfall_opening_found')?'岩壁开口':'水幕边缘', 'waterfall_spray',
      state.hasFlag('waterfall_opening_found')?[action('绕过水帘','w')]:[action('细看水幕后方','search waterfall')],
      {baked:true,radius:23,pointerShape:ellipse(126,80,10,10,3)}),
    prop('waterfall:mushroom', P.mushroom, gate.gone?'巨菌':'蘑菇门', 'mushroom_gate',
      gate.gone?[action('观察巨菌','examine toadstool')]:[action('观察此处', 'look'), action('穿过蘑菇门', 'in')],
      {visualOptions: gate,
        pointerShape: ellipse(P.mushroom.x, P.mushroom.y - 29, 28, 32)}),
  );
  }

  const [baseX, baseY] = ARBOR_LOOSE_ANCHORS[state.room];
  state.roomItems().filter(id => ITEMS[id]).forEach((id, index) => {
    const item = ITEMS[id], noun = item.aliases?.[0] || id;
    const treeAxe = id === 'axe' && state.room === 'top_of_arbor' && !state.hasFlag('arbor_axe_moved');
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
