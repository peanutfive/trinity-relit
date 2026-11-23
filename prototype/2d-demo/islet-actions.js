import { ITEMS } from '../js/data/items.js';
import { ROOMS as WABE_ROOMS } from '../js/data/wabe.js';
import { ISLET_LAYOUT, ISLET_POINTS } from './islet-layout.js';
import { DESERT_ARRIVAL_LAYOUT } from './desert-arrival-layout.js';

const action = (label, command) => ({ label, command });
const ellipse = (x, y, rx, ry, priority) => ({ kind: 'ellipse', x, y, rx, ry, priority });

function ferryObjects(state, mooring, passage) {
  const { room } = state;
  const river = room === 'the_river';
  const paid = state.hasFlag('ferry_paid');
  const hasCoin = state.has('silver_coin');
  const fare = !river && hasCoin && !paid ? [action('递交银币', 'give silver coin to oarsman')] : [];
  const { drawAt } = mooring;
  let navigationHint = '登船';
  if (river && !paid && !hasCoin) navigationHint = '前往小岛 · 单程';
  if (room === 'sand_bar' && !paid) navigationHint = '尝试登船';

  return [
    {
      id: `${room}:ferry`, kind: 'islet_ferry', label: '渡船', ...mooring, radius: 35,
      depthY: drawAt.y, visualOptions: { drawAt }, navigationHint,
      pointerShape: ellipse(drawAt.x, drawAt.y - 10, 43, 13, 2),
      ...(river ? { eventId: 'examine_river' } : {}),
      actions: [action('观察', river ? 'examine river' : 'look'), ...(passage ? [action('乘船', passage)] : []), ...fare],
    },
    {
      id: `${room}:oarsman`, kind: 'islet_oarsman', label: '船夫', ...mooring, radius: 35,
      baked: true, pointerOnly: true, pointerShape: ellipse(drawAt.x + 18, drawAt.y - 32, 9, 20, 4),
      actions: [action('观察', 'look'), ...fare],
    },
  ];
}

export function getRiverFerryHotspots(state) {
  if (state.room !== 'the_river' || WABE_ROOMS.the_river.exits(state).in?.to !== 'islet') return [];
  return ferryObjects(state, ISLET_POINTS.river, 'in');
}

export function getIsletHotspots(state) {
  const { room, chapter } = state;
  const layout = ISLET_LAYOUT[room] || DESERT_ARRIVAL_LAYOUT[room];
  if (!layout) return [];
  const objects = [];
  if (chapter === 'islet') {
    const points = ISLET_POINTS[room];
    const onIslet = room === 'islet';
    objects.push({
      id: `${room}:gate`, kind: 'islet_gate', label: '毒菌白门', ...points.gate, radius: 35,
      baked: true, navigationHint: '进入沙漠 · 单程',
      eventId: onIslet ? 'enter_door_to_desert' : 'enter_door_to_desert_sb',
      ...(onIslet ? { itemId: 'toadstool_islet' } : {}),
      actions: [action('观察', onIslet ? 'examine toadstool' : 'look'), action('进入', 'enter door')],
    });
    objects.push(...ferryObjects(state, points.ferry, onIslet ? null : 'out'));
  }

  const [baseX, baseY] = layout.looseAnchor;
  const looseItems = state.roomItems().filter(id => ITEMS[id] && id !== 'toadstool_islet');
  looseItems.forEach((id, index) => {
    const item = ITEMS[id], noun = item.aliases?.[0] || id;
    const x = baseX + (index % 3 - 1) * 9, y = baseY + Math.floor(index / 3) * 7;
    objects.push({
      id: `${chapter}:item:${id}`, kind: id, label: item.cn, itemId: id, x, y, radius: 35,
      pointerShape: ellipse(x, y - 3, 6, 5, 3),
      actions: [action('查看', `examine ${noun}`), ...(!item.fixed ? [action('拿取', `take ${noun}`)] : [])],
    });
  });
  return objects;
}

export function getIsletInventoryActions(id, state) {
  if ((!ISLET_LAYOUT[state.room] && !DESERT_ARRIVAL_LAYOUT[state.room]) || !state.has(id) || !ITEMS[id]) return [];
  const item = ITEMS[id], noun = item.aliases?.[0] || id;
  return [action('查看', `examine ${noun}`), ...(!item.fixed ? [action('放下', `drop ${noun}`)] : [])];
}
