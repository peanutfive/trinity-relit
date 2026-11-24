export const CRYPT_OPEN = 'cemetery_crypt_open';
export const CRYPT_INSPECTED = 'cemetery_crypt_inspected';
export const MOUTH_INSPECTED = 'cemetery_mouth_inspected';
export const CORPSE = 'cemetery_corpse';
export const MOUTH = 'cemetery_mouth';

function flagged(state, flag) {
  return state.hasFlag?.(flag) ?? state.flags?.has?.(flag) ?? state.flags?.includes?.(flag) ?? false;
}

// Existing saves may already own, have dropped, or have paid with one of these.
// Only a missing item location inherits its original place inside the crypt.
export function cemeteryItemLocation(state, id) {
  const saved = state.itemAt?.(id) ?? state.itemLoc?.[id];
  if (saved != null) return saved;
  if (id === 'silver_coin') return flagged(state, 'ferry_paid') ? 'destroyed' : MOUTH;
  if (id === 'shroud' || id === 'bandage') return CORPSE;
}

export function cemeteryView(state) {
  const open = flagged(state, CRYPT_OPEN);
  const shroudOnBody = open && cemeteryItemLocation(state, 'shroud') === CORPSE;
  const bandageOnBody = open && cemeteryItemLocation(state, 'bandage') === CORPSE;
  const mouthOpen = open && !bandageOnBody;
  const coinInMouth = open && cemeteryItemLocation(state, 'silver_coin') === MOUTH;
  return {open, inspected:open && flagged(state, CRYPT_INSPECTED), shroudOnBody, bandageOnBody, mouthOpen,
    coinInMouth, coinSeen:mouthOpen && coinInMouth && flagged(state, MOUTH_INSPECTED)};
}
