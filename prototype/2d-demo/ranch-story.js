import { ROOMS as RANCH } from '../js/data/ranch.js';
import { ITEMS } from '../js/data/items.js';

const optics = 'binoculars';
const strain = 'windmill_strain';
const breath = 'reservoir_breath';
const scored = 'scored_binoculars';
const broken = 'binoculars_broken';

function itemLocation(state, id) {
  return typeof state.itemAt === 'function' ? state.itemAt(id) : state.itemLoc?.[id];
}

function flagSet(state, flag) {
  return typeof state.hasFlag === 'function' ? state.hasFlag(flag) : state.flags?.includes(flag);
}

export function windmillBinocularsLocation(state) {
  const recorded = itemLocation(state, optics);
  if (recorded) return recorded;
  return flagSet(state, broken) ? 'underwater' : 'windmill';
}

// These predicates also work on immutable visual snapshots; drawing never seeds items.
function illuminatesBottom(state, id) {
  const location = itemLocation(state, id);
  return location === 'inventory' || location === 'underwater';
}

export function reservoirLanternLit(state) {
  // In the 2D inventory this flag means the lamp is actually producing light.
  return Boolean(flagSet(state, 'lantern_on') && illuminatesBottom(state, 'lantern'));
}

export function reservoirBottomLit(state) {
  return illuminatesBottom(state, 'splinter') || reservoirLanternLit(state);
}

export function restoreWindmillState(s) {
  if (!s.itemAt(optics)) s.placeItem(optics, windmillBinocularsLocation(s));
  // A legacy save can already own or have relocated the only pair of binoculars.
  if (!['windmill', 'underwater', 'destroyed'].includes(s.itemAt(optics))) s.setFlag(scored);
  if (s.room === 'underwater' && !s.cnt(breath)) s.setCnt(breath, 3);
}

const boardWarnings = [
  "The landing creaks under your weight. It isn't in very good shape.\n\n木台承受着你的重量，吱呀作响。它已经不太结实了。",
  "The landing emits a wooden moan of discomfort.\n\n脚下的木板发出一声沉闷的呻吟。",
  "The landing is sagging dangerously. It's not going to last much longer!\n\n木板危险地向下弯去。它撑不了多久了！",
];
const darkRefusal = "It's too dark and murky to see.\n\n水里又黑又浑，什么也看不清。";
const breathWarning = "You can't hold your breath much longer.\n\n你快憋不住气了。";
const takeOptics = 'You pick up the pair of binoculars.\n\n你拾起了那副望远镜。';
const sink = 'You sink below the surface.\n\n你沉入水下。';

function collapse(s, eng) {
  restoreWindmillState(s);
  // The loose contents of the landing and the player's hands fall together.
  // Pockets and worn objects survive the fall in place.
  for (const { id, loc } of s.inventoryList()) {
    if (loc === 'inventory') s.moveItem(id, 'underwater');
  }
  for (const id of s.roomItems()) s.moveItem(id, 'underwater');
  s.setFlag(broken);
  s.setCnt(strain, 4);
  s.setCnt(breath, 0);
  eng.print('CRACK! The landing tips wildly under your feet. You manage a brief, hysterical shriek...\n\n咔嚓！脚下的木台猛然倾翻。你只来得及惊叫一声……');
  eng.print('... and your mouth fills with water.\n\n……水便灌进了嘴里。');
  eng.moveTo('reservoir');
}

function tickBreath(s, eng) {
  const remaining = s.cnt(breath);
  if (!remaining) return;
  s.setCnt(breath, remaining - 1);
  if (remaining === 2) eng.print(breathWarning);
  if (remaining !== 1) return;
  if (s.room === 'underwater') {
    eng.print('You claw your way to the surface as your breath gives out.\n\n憋到最后一口气时，你拼命划回了水面。');
    eng.moveTo('reservoir');
  } else {
    eng.print('With an involuntary gasp, you begin to breathe normally.\n\n你不由得吸了一口气，恢复了正常呼吸。');
  }
}

function waitForBreath(s) {
  // Original WAIT advances to the next interruption, unlike LOOK or TAKE.
  if (s.cnt(breath) > 2) s.setCnt(breath, 2);
}

const holdBreath = {
  id: 'reservoir_hold_breath', match: { verb: ['hold'], noun: ['breath', 'my breath'] },
  act(s, eng) {
    if (s.cnt(breath)) {
      eng.print("You're already holding your breath.\n\n你已经屏住呼吸了。");
    } else {
      s.setCnt(breath, 4);
      eng.print('You take a deep breath.\n\n你深深吸了一口气。');
    }
    if (s.room === 'underwater' && !reservoirBottomLit(s)) tickBreath(s, eng);
  }, text: '',
};

const opticActions = [
  {
    id: 'ranch_examine_binoculars', match: { verb: ['examine'], noun: [optics] },
    when: s => s.has(optics) || s.inRoom(optics),
    text: 'The binoculars are of standard Army issue, with a strap for wearing.\n\n这是一副制式军用双筒望远镜，带有一根挂带。',
  },
  {
    id: 'ranch_wear_binoculars', match: { verb: ['wear'], noun: [optics] },
    when: s => s.has(optics) || s.inRoom(optics),
    act(s, eng) {
      if (s.wearing(optics)) eng.print("You're already wearing the pair of binoculars.\n\n你已经戴着这副望远镜了。");
      else if (!s.has(optics)) eng.print("You're not holding the pair of binoculars.\n\n你手里没拿着那副望远镜。");
      else {
        s.wear(optics);
        eng.print('You put on the pair of binoculars.\n\n你把望远镜挂在了脖子上。');
      }
    }, text: '',
  },
  {
    id: 'ranch_remove_binoculars', match: { verb: ['remove'], noun: [optics] },
    when: s => s.has(optics),
    act(s, eng) {
      if (!s.wearing(optics)) eng.print("You're already holding the pair of binoculars.\n\n望远镜已经拿在你手里了。");
      else {
        s.take(optics);
        eng.print('You take off the pair of binoculars.\n\n你摘下了望远镜。');
      }
    }, text: '',
  },
];

function recoverBinoculars(s) {
  s.take(optics);
  if (!s.hasFlag(scored)) {
    s.addScore(1);
    s.setFlag(scored);
  }
}

function inspectFromSouth(target, cn) {
  return {
    id: 'ranch_focus_' + target,
    match: { verb: ['examine'], noun: [target, cn], noun2: [optics] },
    when: s => s.has(optics) || s.inRoom(optics),
    text(s) {
      if (!s.has(optics)) return "You'd have to be holding the pair of binoculars to do that.\n\n得先把那副望远镜拿在手里，才能这么做。";
      return 'You focus the binoculars on the ' + target + '.\n\nIt appears much closer now.\n\n你用望远镜对准' + cn + '调好焦距。眼前的景物一下子近了许多。';
    },
  };
}

const dropInWater = [
  {
    id: 'reservoir_sink_binoculars', match: { verb: ['drop'], noun: [optics] },
    when: s => s.has(optics),
    act(s, eng) {
      if (s.wearing(optics)) eng.print('[taking off the pair of binoculars first]\n\n[你先摘下了望远镜]');
      s.moveItem(optics, 'underwater');
      if (s.room === 'reservoir') eng.print('The pair of binoculars disappears beneath the dark water.\n\n那副望远镜没入了幽暗的水中。');
      else {
        eng.print('The pair of binoculars sinks to the bottom.\n\n那副望远镜沉到了水底。');
        if (!reservoirBottomLit(s)) tickBreath(s, eng);
      }
    }, text: '',
  },
  {
    id: 'reservoir_sink_splinter', match: { verb: ['drop'], noun: ['splinter'] },
    when: s => s.carrying('splinter'),
    act(s) { s.moveItem('splinter', 'underwater'); },
    text: s => s.room === 'reservoir'
      ? 'The splinter disappears beneath the dark water.\n\n木片没入了幽暗的水中。'
      : 'The splinter sinks to the bottom.\n\n木片沉到了水底。',
  },
];

const climbUp = 'The ladder squeaks and complains as you ascend.\n\n你沿梯向上爬，梯子吱呀作响。';
const climbDown = 'The ladder groans under your weight.\n\n梯子在你的重量下发出呻吟。';
const shore = { to: 'edge_reservoir', text: 'You climb out of the reservoir.\n\n你爬出了蓄水池。' };
const surface = {
  to: 'reservoir', text: 'You rise to the surface, gasping for air.\n\n你浮上水面，大口喘气。',
  act(s) { s.setCnt(breath, 0); },
};
const dive = {
  to: 'underwater',
  act(s, eng) {
    if (!s.cnt(breath)) {
      eng.print('[holding your breath first]\n\n[你先屏住了呼吸]');
      s.setCnt(breath, 4);
    }
    s.setFlag('reservoir_diving');
    eng.print(sink);
  },
};

const outsideDoor = {flag:'ne_yard_outside_door_open', name:'outside door', cn:'外门', nouns:['outside door','door','外门','门']};
const southGate = {flag:'sw_yard_iron_gate_open',name:'iron gate',cn:'铁门',nouns:['iron gate','gate','铁门','大门']};
const northGate = {...southGate,flag:'back_yard_iron_gate_open'};
const screenDoor = {flag:'back_yard_screen_door_open',name:'screen door',cn:'纱门',nouns:['screen door','door','纱门','门']};
const hallDoor = {flag:'hallway_outer_door_open',name:'outer door',cn:'外门',nouns:['outer door','door','外门','门']};

function doorEvents(roomId, door) {
  const {flag, name, cn, nouns} = door;
  const key = roomId + '_' + name.replaceAll(' ', '_');
  return [
    {
      id:key+'_examine', match:{verb:['examine'],noun:nouns},
      text:s => s.hasFlag(flag)
        ? `It looks as if the ${name} is open.\n\n${cn}开着。`
        : `It looks as if the ${name} is closed.\n\n${cn}关着。`,
    },
    {
      id:key+'_open', match:{verb:['open'],noun:nouns},
      act(s, eng) {
        if (s.hasFlag(flag)) eng.print("It's already open.\n\n门已经开着了。");
        else {
          s.setFlag(flag);
          eng.print(`You open the ${name}.\n\n你打开了${cn}。`);
        }
      }, text:'',
    },
    {
      id:key+'_close', match:{verb:['close'],noun:nouns},
      act(s, eng) {
        if (!s.hasFlag(flag)) eng.print("It's already closed.\n\n门已经关着了。");
        else {
          s.clearFlag(flag);
          eng.print(`You close the ${name}.\n\n你关上了${cn}。`);
        }
      }, text:'',
    },
  ];
}

// Exits, narration and both sides' commands read the same physical door flag.
// Each direction still uses the original room's destination when open.
function roomWithDoors(roomId, passages, observations=[], roomNote='', describe=RANCH[roomId].desc) {
  const room = RANCH[roomId];
  return {
    ...room,
    desc(s) {
      let text = describe(s);
      for (const [door] of passages) {
        if (s.hasFlag(door.flag)) {
          text = text.replace('a closed '+door.name, 'an open '+door.name)
            .replace('A closed '+door.name, 'An open '+door.name)
            .replace('关闭的'+door.cn, '敞开的'+door.cn);
        }
      }
      return roomNote ? text + '\n\n' + roomNote : text;
    },
    exits(s) {
      const exits = {...room.exits(s)};
      for (const [door, dirs] of passages) {
        if (s.hasFlag(door.flag)) continue;
        const closed = {to:roomId, when:() => false, fail:`The ${door.name} is closed.\n\n${door.cn}关着。`};
        const crossed = s.hasFlag(door.flag + '_crossed');
        for (const dir of dirs) {
          const route = exits[dir];
          const target = typeof route === 'string' ? route : route?.to;
          exits[dir] = crossed && target && target !== roomId ? {...closed,rememberedTo:target} : closed;
        }
      }
      return exits;
    },
    events:[...observations,...passages.flatMap(([door]) => doorEvents(roomId,door)),...(room.events || [])],
  };
}

// Ordinary portable objects use their existing inventory IDs and one real location.
// A missing location in a pre-kitchen save is different from a relocated item.
const cupboard = 'cupboard';
const knifeScore = 'scored_steak_knife';
export const CUPBOARD_ITEM_NAMES = {
  knife:'steak knife', splinter:'splinter', paper_bird:'paper bird', watch:'wristwatch',
  binoculars:'pair of binoculars', lantern:'lantern', credit_card:'credit card',
  coin:'seven-sided coin', small_coin:'small coin', silver_coin:'silver coin', ball:'soccer ball',
  umbrella:'umbrella', gnomon:'gnomon', bag:'bag of crumbs', ruby:'ruby', axe:'axe', icicle:'icicle',
  garlic:'clove of garlic', cage:'birdcage', key_barrow:'skeleton key', coconut:'coconut',
  emerald:'emerald', spade:'spade', shroud:'burial shroud', bandage:'bandage',
  walkie_talkie:'walkie-talkie', screwdriver:'screwdriver', key_padlock:'steel key', slip:'slip of cardboard',
};
const cupboardIds = Object.keys(CUPBOARD_ITEM_NAMES);
const cupboardNouns = ['cupboard','橱柜','柜子'];
const utensilNouns = ['knife','steak knife'];
const cnItem = id => id==='knife' ? '牛排刀' : ITEMS[id].cn;
const itemName = (s,id) => id==='paper_bird' && s.hasFlag('bird_unfolded') ? 'piece of paper' : CUPBOARD_ITEM_NAMES[id];
const withArticle = name => (/^[aeiou]/.test(name)?'an ':'a ')+name;
export function restoreKitchenState(s) {
  const location = s.itemAt('knife');
  if (location == null) s.placeItem('knife',cupboard);
  else if (location !== cupboard) s.setFlag(knifeScore);
}

function inCupboard(s,id) {
  const location = s.itemAt(id);
  return location===cupboard || (location==null && id==='knife');
}
export function cupboardContents(s) {
  return cupboardIds.filter(id => inCupboard(s,id))
    .sort((a,b) => s.cnt('cupboard_order_'+b)-s.cnt('cupboard_order_'+a));
}

// The display can place a returned object on a free shelf spot without making
// its neighbours jump. Older saves with contents but no slot counters work too.
export function cupboardSlots(s) {
  const slots=new Map(),occupied=new Set();
  const contents=cupboardContents(s);
  for(const id of contents){
    const stored=s.cnt('cupboard_slot_'+id);
    const slot=stored>0 && stored<=cupboardIds.length ? stored-1 : id==='knife'?0:null;
    if(slot!==null && !occupied.has(slot)){
      slots.set(id,slot);
      occupied.add(slot);
    }
  }
  for(const id of contents){
    if(slots.has(id))continue;
    let slot=0;
    while(occupied.has(slot))slot++;
    slots.set(id,slot);
    occupied.add(slot);
  }
  return slots;
}

function cupboardList(s,ids) {
  const names = ids.map(id => {
    const name = itemName(s,id);
    const adjective = id==='splinter' || (id==='lantern' && s.hasFlag('lantern_on')) ? ' (providing light)' : '';
    return withArticle(name) + adjective;
  });
  return {
    en:names.length>1 ? names.slice(0,-1).join(', ')+' and '+names.at(-1) : names[0],
    cn:ids.map(id => cnItem(id) + (id==='splinter' || (id==='lantern' && s.hasFlag('lantern_on')) ? '（发着光）' : '')).join('、'),
  };
}

function kitchenDescription(s) {
  const ids = cupboardContents(s), list = cupboardList(s,ids);
  const contents = ids.length ? ' with '+list.en+' in it' : '';
  const room = 'Disconnected stove pipes and an open cupboard'+contents+" are the only evidence of this room's identity.";
  const cn = '拆开的炉管和'+(ids.length ? '放着'+list.cn+'的' : '一个敞开的')+'橱柜是这间房用途仅存的线索。';
  return room+' A closed outer door in the west wall leads out to a hallway. Other exits lead north and east.\n\n'
    +cn+'西墙上一扇关闭的外门通往走廊。其他出口通往北面和东面。';
}

function inspectCupboard(s,inside) {
  const ids = cupboardContents(s);
  if (!ids.length) return inside ? 'You see nothing unusual in the cupboard.\n\n柜子里面没有什么特别的东西。'
    : 'You see nothing interesting on the cupboard.\n\n橱柜上没有什么值得一看的东西。';
  const list = cupboardList(s,ids);
  return 'You see '+list.en+(inside?' in':' on')+' the cupboard.\n\n你看到橱柜'+(inside?'里':'上')+'放着'+list.cn+'。';
}

function cupboardItemEvents(id) {
  const noun = [id,CUPBOARD_ITEM_NAMES[id]];
  return [
    {
      id:'cupboard_store_'+id,match:{verb:['put'],noun,noun2:cupboardNouns},
      act(s,eng) {
        if (s.inPocket(id)) return eng.print("You'll have to take it out of your pocket first.\n\n得先把它从口袋里拿出来。");
        const en = itemName(s,id), cn = cnItem(id);
        if (!s.has(id)) {
          if (s.inRoom(id) || inCupboard(s,id)) return eng.print("You're not holding "+withArticle(en)+".\n\n你手里没有拿着"+cn+"。");
          return eng.print("You're not holding that.\n\n你手里没有拿着它。");
        }
        if (s.wearing(id)) eng.print('[taking off the '+en+' first]\n\n[你先脱下了'+cn+']');
        const used=new Set(cupboardSlots(s).values());
        let slot=0;
        while(used.has(slot))slot++;
        s.moveItem(id,cupboard);
        s.setCnt('cupboard_slot_'+id,slot+1);
        s.inc('cupboard_order');
        s.setCnt('cupboard_order_'+id,s.cnt('cupboard_order'));
        eng.print('You put the '+en+' in the cupboard.\n\n你把'+cn+'放进了橱柜。');
      },text:'',
    },
    {
      id:'cupboard_retrieve_'+id,match:{verb:['take'],noun},
      when:s => inCupboard(s,id),
      act(s,eng) {
        if (s.carryCount()>=8) return eng.print("You're holding too much already.\n\n你拿不下更多东西了。");
        s.take(id);
        if (id==='knife' && !s.hasFlag(knifeScore)) {
          s.setFlag(knifeScore);
          s.addScore(1);
        }
        eng.print('You take the '+itemName(s,id)+' out of the cupboard.\n\n你从橱柜里取出了'+cnItem(id)+'。');
      },text:'',
    },
    {
      id:'cupboard_missing_'+id,match:{verb:['take'],noun,noun2:cupboardNouns},
      when:s => s.inRoom(id),
      text:s => 'The '+itemName(s,id)+" isn't on the cupboard.\n\n"+cnItem(id)+'不在橱柜上。',
    },
    {
      id:'cupboard_inspect_'+id,match:{verb:['examine'],noun},when:s => inCupboard(s,id),
      text:s => id==='knife' ? 'The blade is still reasonably sharp.\n\n刀刃还算锋利。'
        : typeof ITEMS[id].desc==='function' ? ITEMS[id].desc(s) : ITEMS[id].desc,
    },
  ];
}
const kitchenEvents = [
  {id:'cupboard_inside',match:{verb:['look'],noun:['in cupboard','in the cupboard']},text:s=>inspectCupboard(s,true)},
  {id:'cupboard_examine',match:{verb:['examine','search'],noun:cupboardNouns},text:s=>inspectCupboard(s,false)},
  {id:'cupboard_open_shelf',match:{verb:['open','close'],noun:cupboardNouns},text:"It's an open cupboard, with no doors.\n\n这是个敞开的橱柜，没有柜门。"},
  {id:'cupboard_fixed',match:{verb:['take'],noun:cupboardNouns},text:'The cupboard is firmly attached to the wall.\n\n橱柜牢牢固定在墙上。'},
  {id:'kitchen_inspect_pipes',match:{verb:['examine'],noun:['pipes','stove pipes','炉管']},text:'You see nothing extraordinary in the stove pipes.\n\n炉管里没有什么特别的东西。'},
  {id:'kitchen_fixed_pipes',match:{verb:['take'],noun:['pipes','stove pipes','炉管']},text:'The stove pipes are firmly attached to the wall.\n\n炉管牢牢固定在墙上。'},
  {id:'kitchen_knife_held',match:{verb:['take'],noun:utensilNouns},when:s=>s.carrying('knife'),
    text:"You're already holding the steak knife.\n\n你已经拿着那把牛排刀了。"},
  ...cupboardIds.flatMap(cupboardItemEvents),
];

const stairNouns=['stairs','stairway','staircase','楼梯','台阶'];
const downToIcehouse={to:'icehouse',text:'You descend the stairway.\n\n你沿楼梯走了下去。'};
const upToHallway={to:'hallway',text:'You trudge up the stairway.\n\n你一步步爬上楼梯。'};
const hallway = roomWithDoors('hallway', [[hallDoor,['e']]], [{
  id:'hallway_inspect_stairs',match:{verb:['examine'],noun:stairNouns},
  text:'The stairway leads down into the icehouse.\n\n这段楼梯向下通往冰库。',
}]);

export const RANCH_STORY_ROOMS = {
  ...RANCH,
  ne_yard:roomWithDoors('ne_yard', [[outsideDoor,['w','in']]]),
  bedroom:roomWithDoors('bedroom', [[outsideDoor,['e']]], [{
    id:'bedroom_inspect_corner', match:{verb:['examine'],noun:['corner','area','角落','印迹','痕迹']},
    text:'Only a rectangular area in the corner, lighter than the floor around it, belies the former presence of a mattress.\n\n只有角落里一块比周围地板颜色浅的矩形区域，表明这里曾放过床垫。',
  }]),
  sw_yard:roomWithDoors('sw_yard', [[southGate,['sw','out']]]),
  sw_ranch:roomWithDoors('sw_ranch', [[southGate,['ne','in']]]),
  hallway:{...hallway,exits(s){return {...hallway.exits(s),w:downToIcehouse,d:downToIcehouse};}},
  icehouse:{
    ...RANCH.icehouse,
    exits(){return {e:upToHallway,u:upToHallway,out:upToHallway};},
    events:[
      {id:'icehouse_touch_wall',match:{verb:['touch'],noun:['wall','walls','墙','墙壁']},
        text:'The walls of this underground chamber are cool and clammy to your touch.\n\n这间地下室的墙壁摸起来冰凉潮湿。'},
      {id:'icehouse_examine_wall',match:{verb:['examine'],noun:['wall','walls','墙','墙壁']},
        text:"[You don't need to refer to the wall to complete this story.]\n\n[完成这个故事无需特意查看墙壁。]"},
      {id:'icehouse_inspect_stairway',match:{verb:['examine'],noun:stairNouns},
        text:'The stairway leads up to the hallway.\n\n这段楼梯向上通往走廊。'},
    ],
  },
  kitchen:{...roomWithDoors('kitchen',[[hallDoor,['w']]],kitchenEvents,'',kitchenDescription),onEnter:restoreKitchenState},
  bathroom:{
    ...RANCH.bathroom, events:[
      {id:'bathroom_inspect_sink',match:{verb:['examine','look'],noun:['sink','basin','in sink','in the sink','in basin','in the basin','洗手池','水池']},
        text:'The porcelain is stained with big, disgusting patches of brown and green mildew.\n\n瓷面布满棕绿色的大片霉斑，令人作呕。'},
      {id:'bathroom_fixed_sink',match:{verb:['take'],noun:['sink','basin','洗手池','水池']},
        text:'The sink is firmly attached to the wall.\n\n洗手池牢牢固定在墙上。'},
    ],
  },
  back_yard:roomWithDoors('back_yard', [[screenDoor,['e']],[northGate,['nw','out']]]),
  spare_room:roomWithDoors('spare_room', [[screenDoor,['w']]], [
    {
      id:'spare_room_inspect_map', match:{verb:['examine'],noun:['map','wall map','地图','挂图']},
      text:'[This is the map included in your TRINITY package.]\n\n[这就是《Trinity》原版盒装附带的地图。]',
    },
    {
      id:'spare_room_take_map', match:{verb:['take'],noun:['map','wall map','地图','挂图']},
      text:'The map is firmly attached to the wall.\n\n这张地图牢牢固定在墙上。',
    },
  ], 'A large map is hanging on the wall.\n\n墙上挂着一幅大地图。'),
  nw_ranch:roomWithDoors('nw_ranch', [[northGate,['se','in']]]),
  south_reservoir: {
    ...RANCH.south_reservoir,
    onTurn(s, eng) {
      if (s.room !== 'south_reservoir') return;
      tickBreath(s, eng);
    },
    events: [inspectFromSouth('windmill', '风车'), inspectFromSouth('reservoir', '蓄水池'), ...opticActions],
  },
  north_reservoir: { ...RANCH.north_reservoir, events: opticActions },
  under_windmill: {
    ...RANCH.under_windmill,
    onEnter: restoreWindmillState,
    onTurn(s, eng) {
      if (s.room !== 'under_windmill') return;
      tickBreath(s, eng);
    },
    exits(s) {
      const exits = RANCH.under_windmill.exits(s);
      return s.hasFlag(broken) ? exits : { ...exits, u: { to: 'windmill', text: climbUp } };
    },
    events: opticActions,
  },
  windmill: {
    ...RANCH.windmill,
    desc(s) {
      const base = RANCH.windmill.desc(s);
      if (windmillBinocularsLocation(s) !== 'windmill') return base;
      return base + "\n\nSomebody has left a nice pair of binoculars at the landing's edge.\n\n有人把一副不错的双筒望远镜留在了木台边缘。";
    },
    onEnter: restoreWindmillState,
    onTurn(s, eng) {
      if (s.room !== 'windmill') return;
      tickBreath(s, eng);
      s.inc(strain);
      const warning = boardWarnings[s.cnt(strain) - 1];
      if (warning) eng.print(warning);
      else collapse(s, eng);
    },
    exits() {
      const down = { to: 'under_windmill', text: climbDown };
      return { d: down, out: down };
    },
    events: [
      {
        id: 'windmill_reach_binoculars', match: { verb: ['take'], noun: [optics, 'all', '全部'] },
        when: s => windmillBinocularsLocation(s) === 'windmill',
        act(s, eng) {
          eng.print('A loud, plaintive CREAK makes you draw your hand back in alarm. You hold your breath as the landing sways uncertainly for a moment, back and forth. Then all is still.\n\n木板发出刺耳的吱呀声，吓得你缩回了手。你屏住呼吸，任由木台来回晃动，直到四周重归寂静。');
          eng.print('Slowly, carefully, you stretch your arm towards the pair of binoculars...\n\n你慢慢地、小心翼翼地向那副望远镜伸出手……');
          collapse(s, eng);
        }, text: '',
      },
      ...opticActions, holdBreath,
    ],
  },
  edge_reservoir: {
    ...RANCH.edge_reservoir,
    onTurn(s, eng) {
      if (s.room !== 'edge_reservoir') return;
      tickBreath(s, eng);
    },
    exits(s) {
      const enter = { to: 'reservoir', text: 'SPLASH!\n\n扑通！' };
      return { ...RANCH.edge_reservoir.exits(s), n: enter, in: enter };
    },
    events: opticActions,
  },
  reservoir: {
    ...RANCH.reservoir,
    onEnter: restoreWindmillState,
    exits(s) { return { ...RANCH.reservoir.exits(s), s: shore, u: shore, out: shore, d: dive, in: dive }; },
    onWait: waitForBreath,
    onTurn(s, eng) {
      if (s.room !== 'reservoir') return;
      // An object dropped by the generic inventory action sinks as well.
      for (const id of s.roomItems()) s.moveItem(id, 'underwater');
      tickBreath(s, eng);
    },
    events: [...dropInWater, ...opticActions, holdBreath],
  },
  underwater: {
    ...RANCH.underwater,
    desc(s) {
      if (reservoirBottomLit(s)) return RANCH.underwater.desc(s);
      return s.hasFlag('reservoir_diving') ? "It's completely dark.\n\n四周一片漆黑。" : darkRefusal;
    },
    onEnter: restoreWindmillState,
    exits(s) { return { ...RANCH.underwater.exits(s), u: surface, out: surface }; },
    onWait(s, eng) {
      waitForBreath(s);
      if (!reservoirBottomLit(s)) tickBreath(s, eng);
    },
    onTurn(s, eng) {
      if (s.room !== 'underwater') return;
      // The landing turn of the dive counts even in darkness. Looking or
      // blindly reaching in the dark, however, uses no breath in the original.
      if (reservoirBottomLit(s) || s.hasFlag('reservoir_diving')) tickBreath(s, eng);
      s.clearFlag('reservoir_diving');
    },
    events: [
      {
        id: 'reservoir_dark_search', match: { verb: ['take', 'examine', 'search'] },
        when: s => !reservoirBottomLit(s), text: darkRefusal,
      },
      {
        id: 'reservoir_take_binoculars', match: { verb: ['take'], noun: [optics] },
        when: s => windmillBinocularsLocation(s) === 'underwater',
        act: recoverBinoculars, text: takeOptics,
      },
      ...dropInWater, ...opticActions, holdBreath,
    ],
  },
};

export { RANCH_STORY_ROOMS as ROOMS };
