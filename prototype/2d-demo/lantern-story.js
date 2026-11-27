// Release 12 tracks the switch and the light separately. An exhausted lamp
// still clicks on and its switch stays on until the player turns it off.
const chargeCounter = 'lantern_charge';
const litFlag = 'lantern_on';
const switchFlag = 'lantern_switch_on';
const scoreFlag = 'scored_lantern_underground';
const middleFlag = 'lantern_dropped_middle';
const firstRoom = 'underground_3';
const hand = ['inventory', 'worn', 'pocket'];
const warnings = new Map([
  [9, "The lantern's light is getting dimmer.\n\n灯笼的光渐渐暗了下来。"],
  [4, "The lantern's light is quite dim now.\n\n灯笼的光现在很微弱了。"],
  [0, "The lantern's light flickers and goes out.\n\n灯光闪了闪，熄灭了。"],
]);

const hasFlag = (state, key) => state.hasFlag?.(key) ?? state.flags?.has?.(key) ?? state.flags?.includes?.(key) ?? false;
export function lanternView(state) {
  const lit = hasFlag(state, litFlag);
  return {
    location: state.itemLoc?.lantern,
    lit,
    switchOn: lit || hasFlag(state, switchFlag),
    remaining: state.counters?.[chargeCounter] ?? 30,
  };
}

export function lanternSwitchCommand(state) {
  return lanternView(state).switchOn ? 'turn off lantern' : 'turn on lantern';
}

function updateMiddle(state) {
  if (state.itemAt('lantern') === 'underground_2' && state.hasFlag(litFlag))
    state.setFlag(middleFlag);
  else state.clearFlag(middleFlag);
}

export function restoreLantern(state) {
  // Older saves have a position and a light flag, but never measured charge.
  // Start their charge once, preserving even an explicit zero on later loads.
  if (state.counters[chargeCounter] === undefined) {
    state.setCnt(chargeCounter, 30);
    if (state.itemAt('lantern') && state.itemAt('lantern') !== firstRoom) state.setFlag(scoreFlag);
  }
  if (state.hasFlag(litFlag)) state.setFlag(switchFlag);
}

const lamp = /^(?:(?:the |a )?(?:waterproof )?(?:lantern|lamp|torch)|防水灯笼|灯笼|提灯|灯)$/;
const lampSwitch = /^(?:(?:the )?(?:(?:lantern|lamp)'s )?switch|(?:灯笼)?开关)$/;

export function parseLanternCommand(text) {
  const toggle = text.match(/^(?:turn|switch) (on|off) (.+)$|^(?:turn|switch) (.+) (on|off)$/);
  if (toggle && (lamp.test(toggle[2] || toggle[3]) || lampSwitch.test(toggle[2] || toggle[3])))
    return {type:'simple', verb:'lantern_'+(toggle[1] || toggle[4]), noun:'lantern'};
  const cn = text.match(/^(打开|点亮|开启|开|点|关掉|关闭|关|熄灭|熄)(?:这盏)?(?:防水)?(?:灯笼|提灯|灯)(?:的?开关)?$/);
  if (cn) return {type:'simple',verb:['打开','点亮','开启','开','点'].includes(cn[1])?'lantern_on':'lantern_off',noun:'lantern'};
  return null;
}

function available(state) {
  const loc = state.itemAt('lantern');
  return hand.includes(loc) || loc === state.room || (loc === 'cupboard' && state.room === 'kitchen');
}

export function lanternAction(state, cmd) {
  if (!cmd || cmd.type !== 'simple') return null;
  if (lampSwitch.test(cmd.noun)) {
    // A switch named without a lamp in another room belongs to that room.
    if (!available(state)) return null;
    if (cmd.verb === 'examine') return 'switch';
    if (cmd.verb === 'turn') return 'toggle';
  }
  if (!lamp.test(cmd.noun)) return null;
  const {verb} = cmd;
  if (state.room === 'underwater' && ['take','examine'].includes(verb)) return null;
  if (state.room === 'kitchen' && state.itemAt('lantern') === 'cupboard' && verb === 'take') return null;
  if (verb === 'turn') return 'toggle'; // Compatibility with the old 2D F shortcut.
  if (verb === 'lantern_on') return 'on';
  if (verb === 'lantern_off') return 'off';
  return ['take','drop','examine','open'].includes(verb) ? verb : null;
}

export function freeLanternAction(state, action) {
  if (!action) return null;
  if (action === 'drop' && !state.has('lantern')) return available(state)
    ? "You're not holding a lantern.\n\n你手里没有灯笼。"
    : "You're not holding that.\n\n你手里没有那个东西。";
  return available(state) ? null : "You can't see any lantern here.\n\n你在这里看不见灯笼。";
}

function inspect(state) {
  const {switchOn, lit, remaining} = lanternView(state);
  let beam = '', cnBeam = '';
  if (lit) {
    const level = remaining < 5 ? ['almost out','快要熄灭了'] : remaining < 10 ? ['very dim','很微弱'] : ['rather dim','有些暗淡'];
    beam = '; the beam is '+level[0];
    cnBeam = '，光束'+level[1];
  }
  return "The waterproof lantern is more than a foot long. Its switch is turned "+(switchOn ? 'on' : 'off')+beam+'.\n\n这盏防水灯笼有一英尺多长。开关'+(switchOn?'开着':'关着')+cnBeam+'。';
}

export function handleLantern(state, eng, action) {
  const view = lanternView(state);
  let output;
  switch (action === 'toggle' ? (view.switchOn ? 'off' : 'on') : action) {
    case 'switch':
      output = "The lantern's switch is turned "+(view.switchOn?'on':'off')+'.\n\n灯笼的开关'+(view.switchOn?'开着。':'关着。');
      break;
    case 'examine': output = inspect(state); break;
    case 'open': output = "The lantern is hermetically sealed. It can't be opened.\n\n灯笼是密封的，打不开。"; break;
    case 'on':
      if (view.switchOn) output = "The lantern's switch is already turned on.\n\n灯笼的开关已经开着了。";
      else {
        state.setFlag(switchFlag);
        if (view.remaining > 0) {
          state.setFlag(litFlag);
          output = 'CLICK. The lantern emits a warm, yellow beam.\n\n咔嗒。灯笼射出一道暖黄的光。';
        } else output = "CLICK. The lantern doesn't respond.\n\n咔嗒。灯笼没有反应。";
      }
      break;
    case 'off':
      if (!view.switchOn) output = "The lantern's switch is already off.\n\n灯笼的开关已经关上了。";
      else {
        state.clearFlag(switchFlag);
        state.clearFlag(litFlag);
        output = "You turn off the lantern's switch.\n\n你关上了灯笼的开关。";
      }
      break;
    case 'take':
      if (state.carrying('lantern') || state.wearing('lantern'))
        output = "You're already holding the lantern.\n\n你已经拿着灯笼了。";
      else if (state.carryCount() >= 8)
        output = "You're holding too much already.\n\n你拿不下更多东西了。";
      else {
        state.take('lantern');
        if (!state.hasFlag(scoreFlag)) { state.setFlag(scoreFlag); state.addScore(1); }
        output = 'You pick up the lantern.\n\n你拾起了灯笼。';
      }
      break;
    case 'drop':
      state.drop('lantern');
      output = 'You put down the lantern.\n\n你放下了灯笼。';
      break;
    default: return false;
  }
  updateMiddle(state);
  eng.print(output);
  return true;
}

export function lanternWaitMoves(state) {
  if (!state.hasFlag(litFlag) || !['underground_1','underground_2','underground_3','ossuary'].includes(state.room)) return 1;
  const {remaining} = lanternView(state);
  if (available(state)) {
    for (let n=1; n<=4; n++) if (warnings.has(remaining-n)) return n;
  }
  return 4;
}

export function burnLantern(state, eng, moves) {
  if (!state.hasFlag(litFlag)) return;
  const remaining = lanternView(state).remaining;
  const after = Math.max(0, remaining - moves);
  state.setCnt(chargeCounter, after);
  if (available(state)) for (const [charge, text] of warnings) if (after <= charge && charge < remaining) eng.print(text);
  if (after === 0) {
    state.clearFlag(litFlag);
    state.clearFlag(middleFlag);
  }
}

export function withUndergroundLantern(rooms) {
  const first = rooms.underground_1, last = rooms.underground_3;
  return {...rooms,
    underground_1:{...first, onEnter(s) {
      if (s.hasFlag('underground_items_placed')) return;
      s.setFlag('underground_items_placed');
      if (s.itemAt('lantern') == null) s.placeItem('lantern',firstRoom);
      if (s.itemAt('walkie_talkie') == null) s.placeItem('walkie_talkie','underground_2');
    }},
    underground_3:{...last, desc(s) {
      const walls = 'The walls and ceiling are gouged with deep spiral ruts; they look as if they\'ve been routed out with heavy machinery.\n\n墙壁和穹顶上刻着很深的螺旋纹，像是用重型机械凿出来的。';
      if (!s.inRoom('lantern')) return walls;
      if (!s.hasFlag(scoreFlag)) return walls+'\n\nA lantern is lying in the dirt at your feet.\n\n你脚边的泥地上躺着一盏灯笼。';
      return walls+(s.hasFlag(litFlag)?"\n\nThere's a lantern (providing light) here.\n\n地上有一盏亮着的灯笼。":"\n\nThere's a lantern here.\n\n地上有一盏灯笼。");
    }, events:last.events.filter(e=>e.id==='examine_cylinder').map(e=>({...e,
      text:'Warnings indicate the presence of radioactivity.\n\n警告标志表明这里存在放射性。',
    }))},
  };
}
