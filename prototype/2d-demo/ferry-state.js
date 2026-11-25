const flag = (state, key) => state.hasFlag?.(key) ?? state.flags?.has?.(key) ?? state.flags?.includes?.(key) ?? false;
const count = (state, key) => state.cnt?.(key) ?? state.counters?.[key] ?? 0;

export function ferryView(state) {
  const started = flag(state, 'river_ferry_started');
  const phase = count(state, 'river_ferry_phase');
  const crossed = flag(state, 'river_ferry_crossed');
  const legacyPaid = flag(state, 'ferry_paid') && !crossed;
  const legacyUnpaid = !crossed && !legacyPaid && flag(state, 'wabe_to_islet_used');
  const river = state.room === 'the_river';
  const sandBar = state.room === 'sand_bar';
  const onboard = river && flag(state, 'river_ferry_onboard');
  const fixedBerth = (legacyPaid && river) || ((legacyUnpaid || legacyPaid) && (sandBar || state.room === 'islet'));
  const visible = fixedBerth || (started && ((river && phase <= 5) || (sandBar && phase >= 7 && phase <= 10)));
  const docked = fixedBerth || (visible && (river ? phase >= 2 && phase <= 4 : phase === 9));
  return {phase, started, visible, docked, onboard, fixedBerth, legacyPaid, legacyUnpaid, crossed};
}

export function startFerry(state) {
  if (state.hasFlag('river_ferry_started')) return false;
  state.setFlag('river_ferry_started');
  state.setCnt('river_ferry_phase', state.room === 'sand_bar' ? 9 : 0);
  state.setCnt('river_ferry_start_turn', state.turns);
  return true;
}
