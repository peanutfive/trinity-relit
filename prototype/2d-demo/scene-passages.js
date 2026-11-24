// Only chapter exits with a painted, deliberate interaction have an F target.
export function passageHotspots(state, layout, room) {
  if (!layout?.interactionExitDirs?.length || !room) return [];
  const exits = room.exits(state);
  return layout.interactionExitDirs.flatMap(direction => {
    const exit = exits[direction], anchor = layout.exitAnchors?.[direction];
    if (!exit || !anchor || layout.hiddenExitDirs?.includes(direction)) return [];
    if (typeof exit !== 'string' && (!exit.to || exit.when === false)) return [];
    if (typeof exit.when === 'function' && !exit.when(state)) return [];
    const [x, y] = anchor, visual = layout.passageVisuals?.[direction] || {};
    return [{
      id: `${state.room}:passage:${direction}`, kind: 'passage', x, y, radius: 30, baked: true,
      label: {u:'上行', d:'下行', in:'进入', out:'返回'}[direction] || '通行',
      actions: [{label:'通行', command:direction}],
      pointerShape: {kind:'ellipse', x, y:y-12, rx:10, ry:17}, ...visual,
    }];
  });
}
