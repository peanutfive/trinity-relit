import { ITEMS } from '../js/data/items.js';

// Read-only mirror of the original prologue's pram location helper.
export function pramRoom(state) {
  if (state.hasFlag('pram_broken')) return 'long_water';
  if (state.hasFlag('pram_at_flower')) return 'flower_walk';
  if (state.hasFlag('pram_at_walk')) return 'lancaster_walk';
  if (state.hasFlag('pram_at_lancaster')) return 'lancaster_gate';
  if (state.hasFlag('pram_at_inverness')) return 'inverness_terrace';
  return 'black_lion_gate';
}

const action = (label, command) => ({ label, command });
function hotspot(id, x, y, label, kind, eventId, actions, itemId) {
  return { id, x, y, label, kind, eventId, itemId, radius: 37, actions };
}
const supportedRooms = new Set(['palace_gate', 'broad_walk', 'flower_walk', 'the_wabe', 'round_pond', 'black_lion_gate', 'inverness_terrace', 'lancaster_gate', 'lancaster_walk', 'long_water', 'wading']);

function pramActions(state) {
  const room = state.room;
  const actions = [];
  if (room === 'black_lion_gate') actions.push(action('查看婴儿车', 'examine pram'));
  if (['black_lion_gate', 'lancaster_walk'].includes(room) && !state.hasFlag('pram_open')) actions.push(action('打开婴儿车', 'open pram'));
  if (room === 'lancaster_walk') {
    if (state.hasFlag('in_pram')) actions.push(action('爬出婴儿车', 'exit pram'));
    else actions.push(action('坐进婴儿车', 'enter pram'));
  }
  if (!state.hasFlag('in_pram') && ['black_lion_gate', 'inverness_terrace', 'lancaster_gate', 'lancaster_walk'].includes(room)) actions.push(action('推动婴儿车', 'push pram'));
  if (!actions.length) actions.push(action('环顾此处', 'look'));
  return actions;
}

function itemPosition(id, room, index) {
  if (id === 'ball' && room === 'flower_walk') return [307, 139];
  if (id === 'gnomon' && room === 'the_wabe') return [252, 166];
  if (id === 'paper_bird' && room === 'round_pond') return [300, 176];
  if (id === 'umbrella' && room === 'lancaster_gate') return [315, 195];
  return [170 + (index % 5) * 35, 220 + Math.floor(index / 5) * 14];
}

function looseItemActions(id, state) {
  const noun = ITEMS[id]?.aliases?.[0] || id;
  const actions = [action('查看', `examine ${noun}`)];
  if (!ITEMS[id]?.fixed) actions.push(action(id === 'gnomon' ? '拿取指针' : id === 'paper_bird' ? '拾起纸鸟' : id === 'ball' ? '拾起足球' : id === 'umbrella' ? '拾起雨伞' : '拿取', `take ${noun}`));
  if (id === 'gnomon' && state.room === 'the_wabe' && !state.hasFlag('gnomon_unscrewed')) actions.push(action('旋下指针', 'unscrew gnomon'));
  return actions;
}

// Build affordances from current state only. These functions do not set flags,
// move items, call room descriptions, or execute events to discover visibility.
export function getHotspots(state) {
  const room = state.room;
  if (!supportedRooms.has(room)) return [];
  const result = [];
  const add = (id, x, y, label, kind, eventId, actions, itemId) => result.push(hotspot(id, x, y, label, kind, eventId, actions, itemId));
  if (room === 'palace_gate') {
    add('palace_gate:self', 183, 244, '自己', 'sign', 'examine_self', [action('查看自己', 'examine self')]);
    add('palace_gate:sky', 315, 120, '天空', 'sky', 'examine_sky_pg', [action('仰望天空', 'examine sky')]);
  }
  if (room === 'broad_walk') {
    add('broad_walk:statue', 362, 164, '维多利亚女王雕像', 'statue', 'examine_statue', [action('查看雕像', 'examine statue')]);
    if (!state.hasFlag('birds_fed')) {
      const womanActions = [action('查看老妇人', 'examine woman')];
      if (!state.hasFlag('bag_bought')) womanActions.push(action('购买面包屑', 'buy crumbs'));
      add('broad_walk:woman', 143, 166, '卖鸟食的老妇人', 'woman', 'examine_woman_bw', womanActions);
      const birdActions = [action('查看鸽子', 'examine pigeons')];
      if (state.has('bag')) birdActions.push(action('喂鸟', 'feed birds'));
      add('broad_walk:birds', 185, 185, '鸽子', 'birds', 'examine_pigeons_bw', birdActions);
      Object.assign(result.at(-1),{pointerShape:{kind:'ellipse',x:185,y:185,rx:32,ry:24,priority:1}});
    }
    if (state.hasFlag('ruby_visible') && !state.hasFlag('ruby_snatched')) add('broad_walk:ruby', 205, 192, '红宝石', 'ruby', 'take_ruby', [action('尝试拿取红宝石', 'take ruby')], 'ruby');
  }
  if (room === 'flower_walk') {
    add('flower_walk:memorial',338,90,'阿尔伯特纪念碑','memorial','examine_memorial',[action('查看纪念碑','examine memorial')]);
    Object.assign(result.at(-1),{baked:true,radius:125,pointerShape:{kind:'ellipse',x:338,y:55,rx:22,ry:45,priority:1}});
  }
  if (room === 'the_wabe') add('the_wabe:sundial', 245, 148, '日晷', 'sundial', 'examine_sundial', [action('查看日晷', 'examine sundial')]);
  if (room === 'round_pond') {
    add('round_pond:pond', 165, 155, '圆池塘', 'pond', 'examine_pond', [action('查看池塘', 'examine pond')]);
    add('round_pond:boats', 315, 190, '玩具船', 'boats', 'examine_boats', [action('查看玩具船', 'examine boats')]);
  }
  if (room === 'inverness_terrace' && !state.hasFlag('boy_scared')) {
    add('inverness_terrace:boy', 300, 145, '吹泡泡的男孩', 'boy', 'examine_boy', [action('查看男孩', 'examine boy')]);
    add('inverness_terrace:headphones', 300, 132, '耳机', 'headphones', 'examine_headphones', [action('查看耳机', 'examine headphones')]);
    add('inverness_terrace:dish', 293.5, 143.5, '肥皂水碟子', 'dish', 'examine_dish', [action('查看碟子', 'examine dish'), action('尝试拿碟子', 'take dish')]);
  }
  if (room === 'lancaster_gate') {
    const treeActions = [action('查看老树', 'examine tree')];
    if (!state.hasFlag('umbrella_woman_done')) treeActions.push(action('等候片刻', 'wait'));
    if (state.has('ball') && state.itemAt('umbrella') === 'lancaster_gate_tree' && state.hasFlag('umbrella_woman_done')) treeActions.push(action('把足球扔向树', 'throw ball at tree'));
    add('lancaster_gate:tree', 300, 145, '弯曲的老树', 'tree', 'examine_tree_lg', treeActions);
    if (!state.hasFlag('umbrella_woman_done')) {
      const womanActions = [];
      if (state.hasFlag('umbrella_woman_seen')) {
        womanActions.push(action('帮助老妇人', 'help woman'), action('替她拿着雨伞', 'hold umbrella'));
      }
      womanActions.push(action('等候片刻', 'wait'));
      add('lancaster_gate:woman', 194, 159, '撑伞的老妇人', 'woman', state.hasFlag('umbrella_woman_seen') ? 'help_umbrella_woman' : undefined, womanActions);
    }
    if (state.hasFlag('umbrella_woman_done') && state.itemAt('umbrella') === 'lancaster_gate_tree') {
      const actions = [action('查看雨伞', 'examine umbrella'), action('尝试拿雨伞', 'take umbrella')];
      if (state.has('ball')) actions.push(action('把足球扔向雨伞', 'throw ball at umbrella'));
      add('lancaster_gate:umbrella-tree', 325, 120, '树上的雨伞', 'umbrella', 'examine_umbrella_tree', actions, 'umbrella');
    }
  }
  if (room === 'lancaster_walk') {
    add('lancaster_walk:notice', 315, 170, '草坪告示牌', 'sign', 'examine_notice', [action('阅读告示', 'read notice'), action('尝试向东走', 'e')]);
    add('lancaster_walk:sculpture', 392, 105, '骑马雕塑', 'sculpture', 'examine_sculpture', [action('查看雕塑', 'examine sculpture')]);
  }
  if (room === 'long_water') {
    add('long_water:water',202,247,'湖水','water_edge','wade_long_water',[action('涉入湖水','enter water')]);
    Object.assign(result.at(-1),{baked:true,pointerShape:{kind:'ellipse',x:219,y:247,rx:12,ry:22,priority:1}});
    add('long_water:statue', 92, 148, '湖畔雕像', 'statue', 'examine_statue_lw', [action('查看雕像', 'examine statue'), action('等候片刻', 'wait')]);
    if (state.hasFlag('missile_visible')) add('long_water:missile', 280, 95, '空中的导弹', 'missile', 'examine_missile', [action('查看导弹', 'examine missile')]);
    if (state.hasFlag('white_door_visible')) add('long_water:door', 320, 145, '白门', 'door', 'examine_door_lw', [action('查看白门', 'examine door'), action('尝试穿门','enter door')]);
  }
  if (room === 'wading'&&state.hasFlag('white_door_visible')) add('wading:door', 300, 145, '白门', 'door', 'examine_door_w', [action('查看白门', 'examine door'), action('穿过白门', 'enter door')]);

  if (pramRoom(state) === room) {
    const eventId = { black_lion_gate: 'examine_pram_blg', inverness_terrace: 'push_pram_it', lancaster_gate: 'push_pram_lg', lancaster_walk: 'enter_pram_lw' }[room];
    add(`pram:${room}`, 240, 195, state.hasFlag('pram_broken') ? '损坏的婴儿车' : '婴儿车', 'pram', eventId, pramActions(state));
  }
  const loose = state.roomItems();
  loose.forEach((id, index) => {
    if (!ITEMS[id]) return;
    const [x, y] = itemPosition(id, room, index);
    const eventId = id === 'ball' && room === 'flower_walk' ? 'examine_ball'
      : id === 'gnomon' && room === 'the_wabe' ? 'examine_gnomon'
      : id === 'paper_bird' && room === 'round_pond' ? 'take_paper_bird'
      : id === 'umbrella' && room === 'lancaster_gate' ? 'take_umbrella_ground' : undefined;
    add(`item:${id}`, x, y, ITEMS[id].cn, id, eventId, looseItemActions(id, state), id);
  });
  return result;
}

// Only expose special uses for rooms where the original event is implemented.
// In particular, "drop bag" at Broad Walk feeds birds: do not label it "put down".
export function getInventoryActions(id, state) {
  if (!ITEMS[id] || !state.has(id)) return [];
  const noun = ITEMS[id].aliases?.[0] || id;
  const actions = [action('查看', `examine ${noun}`)];
  const feedWouldMatch = id === 'bag' && state.room === 'broad_walk' && !state.hasFlag('birds_fed');
  if (feedWouldMatch) actions.push(action('喂鸟', 'feed birds'));
  else actions.push(action('放下', `drop ${noun}`));
  if (id === 'coin' && state.room === 'broad_walk' && !state.hasFlag('bag_bought') && !state.hasFlag('birds_fed')) actions.push(action('购买面包屑', 'buy crumbs'));
  if (id === 'paper_bird' && state.room === 'round_pond') {
    if (!state.hasFlag('bird_unfolded')) actions.push(action('展开纸鸟', 'open paper bird'));
    else actions.push(action('阅读纸上的字', 'read paper bird'));
  }
  if (id === 'umbrella' && ['lancaster_gate', 'lancaster_walk'].includes(state.room)) actions.push(action('撑开雨伞', 'open umbrella'));
  if (id === 'ball' && state.room === 'lancaster_gate' && state.itemAt('umbrella') === 'lancaster_gate_tree' && state.hasFlag('umbrella_woman_done')) actions.push(action('把足球扔向树', 'throw ball at tree'));
  return actions;
}
