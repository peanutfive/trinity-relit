import { isletDoorView } from './islet-shadow.js';
import { groundItems, carriedItemActions } from './loose-items.js';
import { ferryView } from './ferry-state.js';
import { ferryShoreGeometry, FERRY_ABOARD_POINTS } from './ferry-visual-layout.js';
import { ISLET_LAYOUT, ISLET_POINTS } from './islet-layout.js';
import { DESERT_ARRIVAL_LAYOUT } from './desert-arrival-layout.js';

const action = (label, command) => ({ label, command });
const examineBoat = action('观察渡船', 'examine dory');
const examineOarsman = action('观察船夫', 'examine oarsman');
const offerCoin = {itemId:'silver_coin', ...action('递交银币', 'give silver coin to oarsman')};

function ferryObjects(state, mooring) {
  const view = ferryView(state);
  const river = state.room === 'the_river';
  const hull = {id:state.room+':ferry', kind:'islet_ferry', label:'渡船', ...mooring, radius:35};
  const rower = {id:state.room+':oarsman', kind:'islet_oarsman', label:'船夫', ...mooring, radius:24, baked:true};
  const coin = state.has('silver_coin') ? [offerCoin] : [];

  if (view.onboard) {
    const possessions = [
      ['credit_card','递出信用卡','give credit card to oarsman'],
      ['spade','递出铲子','give spade to oarsman'],
    ];
    const offers = possessions.filter(([id]) => state.has(id))
      .map(([itemId,label,command]) => ({itemId,label,command}));
    return [
      {...hull, pointerShape:FERRY_ABOARD_POINTS.hull, navigationHint:'离艇', actions:[action('离艇','exit dory')]},
      {...rower, pointerShape:FERRY_ABOARD_POINTS.oarsman, inspectionHint:'观察船夫', actions:[examineOarsman,...coin,...offers]},
    ];
  }
  const picture = ferryShoreGeometry(state.room,view);
  if (!picture) return [];
  const oldFare = !river && view.legacyUnpaid;
  let travel = view.docked ? action('登艇','enter dory') : action('候船','wait');
  if (view.fixedBerth) {
    travel = view.legacyPaid && state.room !== 'islet' ? action('登艇',river ? 'in' : 'out') : null;
  }
  return [
    {...hull, depthY:picture.y, visualOptions:{ferryVisual:picture}, navigationHint:'登艇',
      pointerShape:picture.hull, actions:[examineBoat,...(travel ? [travel] : []),...(oldFare ? coin : [])]},
    {...rower, y:river ? mooring.y-12 : mooring.y+12,
      pointerShape:picture.oarsman, actions:[examineOarsman,...(river || oldFare ? coin : [])]},
  ];
}

export function getRiverFerryHotspots(state) {
  return state.room === 'the_river' ? ferryObjects(state,ISLET_POINTS.river) : [];
}

export function getIsletHotspots(state) {
  const { room, chapter } = state;
  const layout = ISLET_LAYOUT[room] || DESERT_ARRIVAL_LAYOUT[room];
  if (!layout) return [];
  const objects = [];
  if (chapter === 'islet') {
    const points = ISLET_POINTS[room];
    const onIslet = room === 'islet';
    if (onIslet) objects.push({
      id:'islet:crown',kind:'islet_crown',label:'菌盖',...points.crown,radius:35,
      pointerOnly:true,baked:true,actions:[action('观察毒菌','examine toadstool')],
    });
    const door = onIslet && isletDoorView(state);
    if (door && !door.legacy && (door.near || door.aligned)) objects.push({
      id:'islet:shadow',kind:'islet_shadow',label:'影尖',x:326,y:166,radius:19,baked:true,
      pointerShape:{kind:'polygon',priority:3,points:door.aligned
        ? [[333,153],[362,146],[366,149],[340,157]]
        : [[312,163],[336,155],[340,158],[319,167]]},
      actions:[action('查看影尖','examine shadow')],
    });
    if (onIslet || ferryView(state).fixedBerth) objects.push({
      id: `${room}:gate`, kind: 'islet_gate', label: '毒菌白门', ...points.gate, radius: 35,
      baked: true, navigationHint: door && !door.open ? '试着推门' : '穿过白门',
      eventId: onIslet ? 'enter_door_to_desert' : 'enter_door_to_desert_sb',
      ...(onIslet ? { itemId: 'toadstool_islet' } : {}),
      actions: [action('观察', onIslet ? (door.legacy?'examine toadstool':'examine door') : 'look'), action('进入', 'enter door')],
    });
    objects.push(...ferryObjects(state,points.ferry));
    if (!onIslet) {
      objects.push({
        id:'sand_bar:water',kind:'sandbar_water',label:'河水',x:242,y:214,radius:21,baked:true,
        pointerShape:{kind:'ellipse',x:294,y:239,rx:17,ry:8,priority:1},
        eventId:'sandbar_examine_ground',actions:[action('观察河水','examine river'),action('等候','wait')],
      },{
        id:'sand_bar:sand',kind:'sandbar_sand',label:'沙纹',x:225,y:233,radius:15,baked:true,
        pointerShape:{kind:'ellipse',x:225,y:239,rx:10,ry:4,priority:1},
        eventId:'sandbar_examine_ground',actions:[action('察看沙地','examine sand')],
      });
    }
  }

  return [...objects, ...groundItems(state, layout.looseAnchor, ['toadstool_islet'])];
}

export function getIsletInventoryActions(id, state) {
  return ISLET_LAYOUT[state.room] || DESERT_ARRIVAL_LAYOUT[state.room] ? carriedItemActions(id, state) : [];
}
