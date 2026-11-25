// The brass arrow and the tip of its shadow are separate readings. Thirteen
// sectors (seven marks and six intervening gaps) each take thirteen moves.
const COUNT = 'vertex_shadow_tick';
const known = state => Object.hasOwn(state.counters ?? {},COUNT);
const flag = (state,key) => state.hasFlag?.(key) ?? state.flags?.has?.(key) ?? state.flags?.includes?.(key) ?? false;
const tick = state => state.counters?.[COUNT] ?? 6;

export function initializeShadow(state) {
  if (known(state)) return;
  state.setCnt(COUNT,6);
  state.setFlag('vertex_lever_up');
}

export function restoreShadow(state) {
  if (known(state)) return;
  // Before the shadow existed, a one-way crossing could autosave directly
  // on either island shore. Never require a decision at an unreachable dial.
  if (state.chapter === 'islet') state.setFlag('legacy_islet_crater');
  if (state.chapter !== 'prologue') initializeShadow(state);
}

export function vertexShadowView(state) {
  const value=tick(state);
  const sector=Math.floor(value/13), phase=value%13;
  const symbol=Math.floor(sector/2)+1;
  const centered=sector%2===0 && (phase===5 || phase===6);
  const offset=(value-5+169)%169;
  const dialIndex=centered ? symbol-1 : (offset<156 ? offset/26 : 6+(offset-156)/13);
  return {sector,phase,symbol,dialIndex,leverUp:!known(state)||flag(state,'vertex_lever_up'),centered};
}

export function isletDoorView(state) {
  const {sector,centered} = vertexShadowView(state);
  const aligned = sector===12 && centered;
  const legacy = flag(state,'legacy_islet_crater') || (flag(state,'ferry_paid') || flag(state,'wabe_to_islet_used')) && !flag(state,'river_ferry_crossed');
  return {open:legacy || aligned,aligned,near:sector===12 && !aligned,legacy};
}

export function setShadowSymbol(state, symbol) {
  initializeShadow(state);
  state.setCnt(COUNT,(symbol-1)*26+5);
  state.sundialSymbol=symbol;
}

export function advanceShadow(state, moves) {
  if (!known(state) || !flag(state,'vertex_lever_up') || state.chapter === 'prologue' || state.chapter === 'desert' || state.chapter === 'ranch') return;
  state.setCnt(COUNT,(tick(state)+moves)%169);
}
