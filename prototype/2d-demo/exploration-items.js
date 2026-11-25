import { ITEMS as textItems } from '../js/data/items.js';

export const PAPERBACK_ID = 'paperback';
export const BOOKMARK_ID = 'slip';
const openFlag = 'paperback_open';
const scoreFlag = 'paperback_bookmark_scored';
const bookmarkRules = 'paperback_bookmark_rules';
const tooMuch = "You're holding too much already.\n\n你拿不下更多东西了。";
const pocketFirst = "You'll have to take it out of your pocket first.\n\n得先把它从口袋里拿出来。";
const missingBook = "You can't see any book here.\n\n这里看不到书。";
const missingCard = "You can't see any bookmark here.\n\n这里看不到书签。";
const notHeld = "You're not holding that.\n\n你手里没有那个东西。";
const bookNotHeld = "You're not holding a book.\n\n你手里没有书。";
const cardNotHeld = "You're not holding a slip of cardboard.\n\n你手里没有硬纸片。";
const readPages = 'You flip through the book, but nothing catches your eye.\n\n你翻了翻书，没有什么引起你的注意。';
const dropped = 'Dropped.\n\n你放下了书。';
const paperback = {
  cn:'平装书',
  aliases:['book','paperback','paperback book','cheap paperback','cover','book cover','书','平装书','书封','封面'],
  start:'shack',
  desc:"It's a cheap paperback called DESERT ISLAND DECAMERON.\n\n这是一本廉价平装书，书名叫《荒岛十日谈》。",
};
const bookmark = {
  ...textItems[BOOKMARK_ID],cn:'硬纸书签',
  aliases:['bookmark','slip of cardboard',...textItems[BOOKMARK_ID].aliases,'书签','夹页','硬纸书签','纸卡'],
  start:PAPERBACK_ID,
  desc(state) {
    return state?.carrying?.(BOOKMARK_ID)
      ? 'The slip of cardboard seems to have been used as a bookmark. A stanza of poetry is typed on one side. The other side is covered with some kind of diagram.\n\n这张硬纸片像是用来夹书的。一面打着一节诗，另一面画着某种图样。'
      : 'The slip of cardboard seems to have been used as a bookmark. A stanza of poetry is typed on the side you can see.\n\n这张硬纸片像是用来夹书的，朝上的一面打着一节诗。';
  },
};
export const ITEMS = {...textItems, [PAPERBACK_ID]:paperback,[BOOKMARK_ID]:bookmark};

function flag(s,name) {
  return s.hasFlag?.(name) ?? s.flags?.has?.(name) ?? s.flags?.includes?.(name) ?? false;
}
export function paperbackView(s) {
  return {open:flag(s,openFlag),cardInBook:s.itemLoc?.[BOOKMARK_ID]===PAPERBACK_ID,
    bookLocation:s.itemLoc?.[PAPERBACK_ID],cardLocation:s.itemLoc?.[BOOKMARK_ID]};
}

export function restorePaperback(s,saved) {
  if(flag(s,bookmarkRules)) return;
  // Older 2D versions already knew the slip ID. Respect any actual old
  // possession (including the player-operated cupboard) without changing score.
  if(['inventory','worn','pocket','cupboard'].includes(saved.itemLoc?.[BOOKMARK_ID])) {
    s.setFlag(scoreFlag);
    s.setFlag(bookmarkRules);
  }
}

const bookVerbs=new Set(['examine','take','drop','open','close','read']);
const cardVerbs=new Set(['examine','read','take','drop','turn']);
const pocketNouns=['pocket','your pocket','口袋','衣袋'];
export function paperbackAction(cmd,s) {
  if(!cmd) return null;
  if(cmd.type==='simple' && cmd.verb==='look' && /^in (?:the )?(?:book|paperback)$/.test(cmd.noun))
    return {itemId:PAPERBACK_ID,verb:'read'};
  const isBook=paperback.aliases.includes(cmd.noun);
  if(!isBook && !bookmark.aliases.includes(cmd.noun)) return null;
  const itemId=isBook?PAPERBACK_ID:BOOKMARK_ID;
  const accessCupboard=!isBook && s?.room==='kitchen' && s.itemLoc?.[BOOKMARK_ID]==='cupboard';
  if(cmd.type==='simple' && (isBook?bookVerbs:cardVerbs).has(cmd.verb)) {
    if(accessCupboard && cmd.verb==='take') return null;
    return {itemId,verb:cmd.verb};
  }
  if(cmd.type!=='compound') return null;
  if(cmd.verb==='put' && cmd.prep==='in' && pocketNouns.includes(cmd.noun2)) return {itemId,verb:'pocket'};
  if(!isBook && paperback.aliases.includes(cmd.noun2)) {
    if(cmd.verb==='put' && cmd.prep==='in') return {itemId,verb:'insert'};
    if(cmd.verb==='take' && cmd.prep==='from') return {itemId,verb:'takeFromBook'};
  }
  return null;
}

export function unavailablePaperback(s,action) {
  const bookHere=s.has(PAPERBACK_ID)||s.inRoom(PAPERBACK_ID);
  if(action.itemId===PAPERBACK_ID) return bookHere ? null : action.verb==='drop' ? notHeld : missingBook;
  const {verb}=action;
  if((verb==='insert'||verb==='takeFromBook') && !bookHere) return missingBook;
  const inReach=s.has(BOOKMARK_ID)||s.inRoom(BOOKMARK_ID)||
    (s.itemAt(BOOKMARK_ID)===PAPERBACK_ID && bookHere)||
    (s.room==='kitchen' && s.itemAt(BOOKMARK_ID)==='cupboard');
  if(inReach) return null;
  return ['insert','drop','pocket'].includes(verb)?notHeld:missingCard;
}

function openBook(s,engine) {
  s.setFlag(openFlag);
  if(s.itemAt(BOOKMARK_ID)===PAPERBACK_ID) {
    s.drop(BOOKMARK_ID);
    engine.print('A slip of cardboard falls out of the book as you open it.\n\n你打开书，一张硬纸片从书页间落了下来。');
  } else engine.print('You open the book.\n\n你打开了书。');
}

function handleBook(s,e,verb) {
  if(s.inPocket(PAPERBACK_ID) && verb!=='take') return e.print(pocketFirst);
  switch(verb) {
    case 'examine': return e.print(paperback.desc);
    case 'read':
      if(!s.carrying(PAPERBACK_ID)) return e.print("You'd have to be holding the book to do that.\n\n得先把书拿在手里，才能翻阅。");
      if(!s.hasFlag(openFlag)) openBook(s,e);
      return e.print(readPages);
    case 'open':
      if(s.hasFlag(openFlag)) return e.print("It's already open.\n\n书已经打开了。");
      return openBook(s,e);
    case 'close':
      if(!s.hasFlag(openFlag)) return e.print("It's already closed.\n\n书已经合上了。");
      s.clearFlag(openFlag);
      return e.print('You close the book.\n\n你合上了书。');
    case 'drop':
      if(!s.has(PAPERBACK_ID)) return e.print(bookNotHeld);
      if(s.inPocket(PAPERBACK_ID)) return e.print(pocketFirst);
      s.drop(PAPERBACK_ID);
      s.setFlag('paperback_moved');
      return e.print(dropped);
    case 'take': {
      if(s.carrying(PAPERBACK_ID)) return e.print("You're already holding the book.\n\n你手里已经拿着书了。");
      if(s.carryCount()>=8) return e.print(tooMuch);
      const pocket=s.inPocket(PAPERBACK_ID);
      s.take(PAPERBACK_ID);
      s.setFlag('paperback_moved');
      return e.print(pocket?'You take the book out of your pocket.\n\n你从口袋里拿出书。':'Taken.\n\n你拿起了书。');
    }
  }
}

function takeBookmark(s,e,fromBook) {
  const inside=s.itemAt(BOOKMARK_ID)===PAPERBACK_ID;
  if(fromBook && !inside) return e.print("The slip of cardboard isn't on the book.\n\n那张硬纸片不在书里。");
  if(inside && !s.hasFlag(openFlag)) return e.print("You can't reach into the book. It's closed.\n\n你没法把手伸进书里。书合着呢。");
  if(s.carrying(BOOKMARK_ID)) return e.print("You're already holding the slip of cardboard.\n\n你手里已经拿着那张硬纸片了。");
  if(s.carryCount()>=8) return e.print(tooMuch);
  const pocket=s.inPocket(BOOKMARK_ID);
  s.take(BOOKMARK_ID);
  if(inside) e.print('You take the slip of cardboard out of the book.\n\n你从书里抽出那张硬纸片。');
  else if(pocket) e.print('You take the slip of cardboard out of your pocket.\n\n你从口袋里拿出那张硬纸片。');
  else e.print('Taken.\n\n你拾起了硬纸片。');
  if(!s.hasFlag(scoreFlag)) {
    s.setFlag(scoreFlag);
    s.addScore(1);
    e.print('[Your score just went up by 1 point. The total is now '+s.score+' out of 100.]\n\n[你的得分增加了 1 分，现在是 '+s.score+' 分，满分 100 分。]');
  }
}

function handleCard(s,e,verb) {
  switch(verb) {
    case 'read':
    case 'examine': return e.print(s.inPocket(BOOKMARK_ID)?pocketFirst:bookmark.desc(s));
    case 'turn':
      return e.print(s.carrying(BOOKMARK_ID)
        ? 'You turn the slip of cardboard over in your hands.\n\n你把手里的硬纸片翻了个面。'
        : "You'd have to be holding the slip of cardboard to do that.\n\n你得把硬纸片拿在手里，才能翻过来。");
    case 'take':
    case 'takeFromBook': return takeBookmark(s,e,verb==='takeFromBook');
    case 'drop':
      if(s.inPocket(BOOKMARK_ID)) return e.print(pocketFirst);
      if(!s.carrying(BOOKMARK_ID)) return e.print(cardNotHeld);
      s.drop(BOOKMARK_ID);
      return e.print('Dropped.\n\n你放下了硬纸片。');
    case 'insert':
      if(s.inPocket(BOOKMARK_ID)||s.inPocket(PAPERBACK_ID)) return e.print(pocketFirst);
      if(s.itemAt(BOOKMARK_ID)===PAPERBACK_ID) return e.print('The slip of cardboard is already on the book.\n\n那张硬纸片已经夹在书里了。');
      if(!s.carrying(BOOKMARK_ID)) return e.print(cardNotHeld);
      if(!s.hasFlag(openFlag)) return e.print('The book is closed.\n\n书合着呢。');
      s.moveItem(BOOKMARK_ID,PAPERBACK_ID);
      return e.print('The slip of cardboard slips between the pages.\n\n那张硬纸片滑进了书页之间。');
  }
}

export function handlePaperback(s,e,action) {
  s.setFlag(bookmarkRules);
  const {itemId,verb}=action;
  if(verb==='pocket') {
    const book=itemId===PAPERBACK_ID;
    if(s.inPocket(itemId)) return e.print(book?'The book is already in your pocket.\n\n书已经在你口袋里了。':'The slip of cardboard is already in your pocket.\n\n硬纸片已经在你口袋里了。');
    if(!s.carrying(itemId)) return e.print(book?bookNotHeld:cardNotHeld);
    s.toPocket(itemId);
    return e.print(book?'You put the book in your pocket.\n\n你把书收进口袋。':'You put the slip of cardboard in your pocket.\n\n你把硬纸片收进口袋。');
  }
  if(itemId===PAPERBACK_ID) return handleBook(s,e,verb);
  return handleCard(s,e,verb);
}
