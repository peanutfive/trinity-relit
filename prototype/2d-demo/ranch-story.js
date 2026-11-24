import { ROOMS as RANCH } from '../js/data/ranch.js';

const optics = 'binoculars';
const strain = 'windmill_strain';
const breath = 'reservoir_breath';
const scored = 'scored_binoculars';
const broken = 'binoculars_broken';
const outsideDoor = 'ne_yard_outside_door_open';
const outsideDoorNouns = ['door', 'outside door', '门', '外门'];

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

export const RANCH_STORY_ROOMS = {
  ...RANCH,
  ne_yard: {
    ...RANCH.ne_yard,
    desc(s) {
      const text = RANCH.ne_yard.desc(s);
      return s.hasFlag(outsideDoor)
        ? text.replace('a closed outside door', 'an open outside door').replace('一扇关闭的外门', '一扇敞开的外门')
        : text;
    },
    exits(s) {
      const original = RANCH.ne_yard.exits(s);
      if (s.hasFlag(outsideDoor)) return original;
      const closedDoor = { to:'ne_yard', when:() => false, fail:'The outside door is closed.\n\n外门关着。' };
      return { ...original, w:closedDoor, in:closedDoor };
    },
    events: [
      {
        id:'ne_yard_examine_outside_door', match:{verb:['examine'],noun:outsideDoorNouns},
        text:s => s.hasFlag(outsideDoor)
          ? 'It looks as if the outside door is open.\n\n外门开着。'
          : 'It looks as if the outside door is closed.\n\n外门关着。',
      },
      {
        id:'ne_yard_open_outside_door', match:{verb:['open'],noun:outsideDoorNouns},
        act(s, eng) {
          if (s.hasFlag(outsideDoor)) eng.print("It's already open.\n\n门已经开着了。");
          else {
            s.setFlag(outsideDoor);
            eng.print('You open the outside door.\n\n你打开了外门。');
          }
        }, text:'',
      },
      {
        id:'ne_yard_close_outside_door', match:{verb:['close'],noun:outsideDoorNouns},
        act(s, eng) {
          if (!s.hasFlag(outsideDoor)) eng.print("It's already closed.\n\n门已经关着了。");
          else {
            s.clearFlag(outsideDoor);
            eng.print('You close the outside door.\n\n你关上了外门。');
          }
        }, text:'',
      },
    ],
  },
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
