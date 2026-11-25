import { ITEMS as textItems } from '../js/data/items.js';

export const PAPERBACK_ID = 'paperback';
const paperback = {
  cn:'平装书',
  aliases:['book','paperback','paperback book','cheap paperback','cover','book cover','书','平装书','书封','封面'],
  start:'shack',
  desc:"It's a cheap paperback called DESERT ISLAND DECAMERON.\n\n这是一本廉价平装书，书名叫《荒岛十日谈》。",
};

export const ITEMS = {...textItems, [PAPERBACK_ID]:paperback};

export function paperbackAction(command) {
  return command?.type === 'simple' && ['examine','take','drop'].includes(command.verb)
    && paperback.aliases.includes(command.noun);
}

export function unavailablePaperback(state, verb) {
  if (state.has(PAPERBACK_ID) || state.inRoom(PAPERBACK_ID)) return null;
  return verb === 'drop' ? "You're not holding that.\n\n你手里没有那个东西。" : "You can't see any book here.\n\n这里看不到书。";
}

export function handlePaperback(state,engine,verb) {
  if (verb==='examine') return engine.print(paperback.desc);
  if (verb==='drop') {
    if (!state.has(PAPERBACK_ID)) return engine.print("You're not holding a book.\n\n你手里没有书。");
    state.drop(PAPERBACK_ID);
    state.setFlag('paperback_moved');
    return engine.print('Dropped.\n\n你放下了书。');
  }
  if (state.carrying(PAPERBACK_ID)) return engine.print("You're already holding the book.\n\n你手里已经拿着书了。");
  if (state.carryCount()>=8) return engine.print("You're holding too much already.\n\n你拿不下更多东西了。");
  state.take(PAPERBACK_ID);
  state.setFlag('paperback_moved');
  engine.print('Taken.\n\n你拿起了书。');
}
