import { ITEMS } from '../js/data/items.js';
import { JAPAN_POINTS as P } from './japan-route-layout.js';

export const JAPAN_SLICE_ROOMS = Object.freeze(['playground', 'shelter']);
const supported = new Set(JAPAN_SLICE_ROOMS);
const action = (label, command) => ({ label, command });
function object(id, x, y, label, kind, actions, extra = {}) {
  return { id, x, y, label, kind, radius: 37, actions, ...extra };
}

// Only query existing state. Commands, including wait and chapter transitions,
// are still committed by the original chapter through GameEngine.
export function getJapanHotspots(state) {
  if (!supported.has(state.room)) return [];
  const objects = [];
  if (state.room === 'playground') {
    objects.push(object('playground:children', P.children.x, P.children.y, '孩子们', 'japan_children',
      [action('等候片刻', 'wait')], {radius: 43,
        pointerShape: {kind: 'ellipse', x: P.children.x, y: P.children.y-9, rx: 13, ry: 13, priority: 1}}));
    objects.push(object('playground:white-door', P.door.x, P.door.y, '白门', 'japan_door',
      [action('观察此处', 'look'), action('穿过白门', 'enter door')], {
        pointerShape: {kind: 'ellipse', x: P.door.x, y: P.door.y-21, rx: 11, ry: 23, priority: 1},
      }));
    objects.push(object('playground:shelter-entry', P.entrance.x, P.entrance.y, '避难所', 'passage',
      [action('进入避难所', 'e')], {baked: true, visualOptions: {prop: 'shelter_entry'},
        pointerShape: {kind: 'polygon', points: [[430,125],[459,125],[459,166],[430,166]], priority: 1},
      }));
    if (state.hasFlag('girl_found_playground') && !state.hasFlag('umbrella_given_to_girl')) {
      const actions = [action('观察此处', 'look')];
      if (state.has('umbrella')) actions.push(action('递出雨伞', 'give umbrella to girl'));
      objects.push(object('playground:girl', P.girl.x, P.girl.y, '女孩', 'japan_girl', actions,
        {pointerShape:{kind:'ellipse',x:P.girl.x,y:P.girl.y-11,rx:5,ry:12,priority:1}}));
    }
  }
  if (state.room === 'shelter' && state.hasFlag('umbrella_given_to_girl')) {
    const actions = [action('观察此处', 'look')];
    if (state.has('paper_bird') && state.hasFlag('bird_unfolded'))
      actions.push(action('递出纸', 'give paper to girl'));
    objects.push(object('shelter:girl', P.shelterGirl.x, P.shelterGirl.y, '女孩', 'japan_girl', actions,
      {visualOptions: {umbrella: true},pointerShape:{kind:'ellipse',x:P.shelterGirl.x,y:P.shelterGirl.y-11,rx:5,ry:12,priority:1}}));
  }

  state.roomItems().filter(id => ITEMS[id]).forEach((id, index) => {
    const item = ITEMS[id], noun = item.aliases?.[0] || id;
    const [x, y] = id === 'spade' && state.room === 'shelter'
      ? [305, 203] : [170 + (index % 5) * 31, 218 + Math.floor(index / 5) * 14];
    const actions = [action('查看', `examine ${noun}`)];
    if (!item.fixed) actions.push(action('拿取', `take ${noun}`));
    objects.push(object(`japan:item:${id}`, x, y, item.cn, id, actions, {itemId: id,
      ...(id==='spade'?{pointerShape:{kind:'ellipse',x:x+4,y:y-12,rx:10,ry:13,priority:2}}:{}),
      eventId: id === 'spade' && state.room === 'shelter' ? 'take_spade_shelter' : undefined}));
  });
  return objects;
}

export function getJapanInventoryActions(id, state) {
  if (!supported.has(state.room) || !ITEMS[id] || !state.has(id)) return [];
  const item = ITEMS[id], noun = item.aliases?.[0] || id;
  const actions = [action('查看', `examine ${noun}`)];
  if (id === 'paper_bird' && state.room === 'playground') actions.push(action('使用纸鸟', 'ride bird'));
  if (!item.fixed) actions.push(action('放下', `drop ${noun}`));
  return actions;
}
