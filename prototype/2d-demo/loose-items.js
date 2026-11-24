import { ITEMS } from '../js/data/items.js';

const action = (label, command) => ({ label, command });

export function groundItems(state, [baseX, baseY], exclude = []) {
  return state.roomItems().filter(id => ITEMS[id] && !exclude.includes(id)).map((id, index) => {
    const item = ITEMS[id], noun = item.aliases?.[0] || id;
    const x = baseX + (index % 3 - 1) * 9, y = baseY + Math.floor(index / 3) * 7;
    return {
      id: `${state.chapter}:item:${id}`, kind: id, label: item.cn, itemId: id, x, y, radius: 35,
      pointerShape: {kind:'ellipse', x, y:y-3, rx:6, ry:5, priority:3},
      actions: [action('查看', `examine ${noun}`), ...(!item.fixed ? [action('拿取', `take ${noun}`)] : [])],
    };
  });
}

export function carriedItemActions(id, state) {
  const item = ITEMS[id];
  if (!item || !state.has(id)) return [];
  const noun = item.aliases?.[0] || id;
  return [action('查看', `examine ${noun}`), ...(!item.fixed ? [action('放下', `drop ${noun}`)] : [])];
}
