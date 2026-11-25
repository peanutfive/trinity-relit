// The park clock records 15-second cycles. At Long Water the watch jumps to
// 3:59:45 and stops, while the room's events continue to spend ordinary moves.
const gardenEnding = 'prologue_terminal_garden';
const lakeEnding = 'prologue_terminal_water';
const lakeRooms = new Set(['long_water', 'wading']);

const gardenIntro = 'The east wind falls silent, and a new star flashes to life over the doomed city.\n\n东风沉寂了，一颗新星在这座注定毁灭的城市上空闪耀。';
const lakeIntro = "The missile's nose nudges into the white door. Then a searing glare envelops the Long Water, and you discover what it feels like to be vaporized in extreme slow motion.\n\n导弹的尖端轻触白门。炽烈的光芒随即笼罩长水湖，你终于体会到以极慢速度被汽化是什么滋味。";

function hasFlag(state, flag) {
  return state.hasFlag?.(flag) ?? state.flags?.has?.(flag) ?? state.flags?.includes?.(flag) ?? false;
}

function onGardenClock(state) {
  return state.chapter === 'prologue' && !lakeRooms.has(state.room)
    && hasFlag(state, 'prologue_clock_initialized') && !hasFlag(state, 'prologue_time_frozen');
}

export function restoreGardenMoves(state) {
  if (!state.dead && onGardenClock(state) && !hasFlag(state, 'prologue_clock_estimated')) {
    const seconds = state.counters.prologue_seconds;
    if (Number.isSafeInteger(seconds) && seconds >= 0 && seconds % 15 === 0) state.turns = seconds / 15;
  }
}

export function beginPrologueTurn(state) {
  if (state.chapter !== 'prologue' || state.dead) return null;
  return {
    turns:state.turns, seconds:onGardenClock(state) ? state.cnt('prologue_seconds') : null,
    gardenPhase:state.cnt('doom_phase'), waterPhase:state.cnt('long_water_phase')
  };
}

export function finishPrologueTurn(state, start) {
  if (!start || state.chapter !== 'prologue') return;
  const clockRunning = start.seconds !== null && onGardenClock(state);
  const cycles = clockRunning ? (state.cnt('prologue_seconds') - start.seconds) / 15 : 0;
  if (!state.dead) {
    // The first cycle was already charged by GameEngine. A park event can
    // interrupt a WAIT on any of its four cycles.
    if (cycles > 1) state.turns += cycles - 1;
    return;
  }
  let ending;
  if (clockRunning && start.gardenPhase === 8 && state.cnt('doom_phase') === 9) ending = gardenEnding;
  if (lakeRooms.has(state.room) && start.waterPhase < 7 && state.cnt('long_water_phase') === 7) ending = lakeEnding;
  if (ending) {
    state.setFlag(ending);
    state.turns = start.turns + cycles;
  }
}

export function prologueEndingTransition(before, after) {
  if (before.chapter !== 'prologue' || after.chapter !== 'prologue') return null;
  if (hasFlag(after, gardenEnding) && !lakeRooms.has(after.room)) return {cause:'garden-clock',intro:gardenIntro};
  if (hasFlag(after, lakeEnding) && lakeRooms.has(after.room)) return {cause:'long-water',intro:lakeIntro};
  return null;
}
