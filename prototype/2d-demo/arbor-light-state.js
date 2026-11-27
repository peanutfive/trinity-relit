// The lantern only illuminates once it is actually lit. A light left upstairs
// stays there when the player walks away and lights the room on their return.
export function arborLight(state) {
  const visible = id => ['inventory', 'worn', 'top_of_arbor'].includes(state.itemLoc?.[id]);
  const lanternOn = state.hasFlag?.('lantern_on') ?? state.flags?.has?.('lantern_on') ?? state.flags?.includes?.('lantern_on');
  if (lanternOn && visible('lantern')) return 'lantern';
  return visible('splinter') ? 'splinter' : null;
}
