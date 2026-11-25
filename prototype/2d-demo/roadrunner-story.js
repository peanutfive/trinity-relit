import {isletDoorView} from './islet-shadow.js';

export const TOWER_RUBY_BOX = 'tower_ruby_box';
const beak = 'roadrunner_beak';
const version = 'roadrunner_story';
const crossed = 'roadrunner_entered_white_door';
const joined = 'roadrunner_at_your_side';
const scoreFlag = 'tower_ruby_scored';
const birdFocus = 'binoculars_focused_on_roadrunner';
const location = 'roadrunner_room';

// The indices are saved, so append new locations without renumbering these.
const grounds = [null, 'base_of_tower', 'shallow_crater', 'nw_ranch', 'ne_ranch',
  'front_yard', 'se_ranch', 'sw_ranch', 'south_reservoir', 'north_reservoir',
  'under_windmill', 'front_deck', 'ne_yard', 'se_yard', 'sw_yard', 'back_yard',
  'hallway', 'kitchen', 'bedroom', 'spare_room', 'bathroom', 'nw_room'];
const indoors = new Set(['hallway','kitchen','bedroom','spare_room','bathroom','nw_room']);
const outerDoors = ['ne_yard_outside_door_open','front_deck_left_door_open','front_deck_right_door_open',
  'back_yard_screen_door_open','hallway_outer_door_open'];
const birdNouns = ['roadrunner','bird','走鹃','鸟'];
const opticsNouns = ['binoculars','pair of binoculars','望远镜','双筒望远镜'];
const gems = ['ruby','gem','红宝石','宝石'];
const boxNouns = ['box','the box','箱子','箱盖'];
const pocketNouns = ['pocket','your pocket','口袋','衣袋'];
const birdText = 'The roadrunner resembles a gray pheasant, lean and streamlined, with bright eyes and a long tail splashed with color.';
const birdCn = '走鹃看起来像一只灰雉，体形瘦长，双眼明亮，长长的尾巴上点缀着彩色羽毛。';
const pocketFirst = "You'll have to take it out of your pocket first.\n\n得先把它从口袋里拿出来。";
const missingRuby = "You can't see any ruby here.\n\n这里看不到红宝石。";
const missingBird = "You can't see any roadrunner here.\n\n这里看不到走鹃。";
const notHeld = "You're not holding a ruby.\n\n你手里没有红宝石。";
const flag = (s,k) => s.hasFlag?.(k) ?? s.flags?.has?.(k) ?? s.flags?.includes?.(k) ?? false;

function followsHere(s,previousBirdRoom) {
  return grounds.includes(s.room) && (!indoors.has(s.room) || indoors.has(previousBirdRoom)
    || outerDoors.some(door=>flag(s,door)));
}
function onNormalIsland(s) {
  return s.room==='islet' && flag(s,'river_ferry_crossed') && !isletDoorView(s).legacy;
}
export function roadrunnerView(s) {
  const alreadyCrossed=flag(s,crossed), together=flag(s,joined);
  let birdRoom=null;
  if(together) birdRoom=grounds[s.counters?.[location]] ?? null;
  else if(alreadyCrossed) birdRoom='base_of_tower';
  else if(flag(s,'river_ferry_crossed') && !isletDoorView(s).legacy) birdRoom='islet';
  const perched=birdRoom==='islet' && s.room==='islet';
  return {alreadyCrossed,joined:together,birdRoom,perched,visible:perched || (together && birdRoom===s.room),
    rubyOnBox:s.itemLoc?.ruby===TOWER_RUBY_BOX,rubyInBeak:s.itemLoc?.ruby===beak};
}

export function initializeRoadrunner(s) {
  s.setFlag(version);
}
function offerGem(s) {
  if(s.itemAt('ruby')==null || s.itemAt('ruby')===beak) s.placeItem('ruby',TOWER_RUBY_BOX);
}
function meetAtTower(s) {
  s.setFlag(joined);
  s.setCnt(location,grounds.indexOf('base_of_tower'));
  offerGem(s);
}
export function restoreRoadrunner(s) {
  if(s.hasFlag(version)) return;
  initializeRoadrunner(s);
  if(s.itemAt('ruby') && ![beak,TOWER_RUBY_BOX].includes(s.itemAt('ruby'))) s.setFlag(scoreFlag);
  if(!s.hasFlag('river_ferry_crossed') || isletDoorView(s).legacy) return;
  if(onNormalIsland(s)) {
    if(s.itemAt('ruby')==null) s.placeItem('ruby',beak);
    if(isletDoorView(s).open) s.setFlag(crossed);
    return;
  }
  if(!s.hasFlag('islet_done') || !s.visited.has('islet') || !s.visited.has('shack')) return;
  s.setFlag(crossed);
  if(s.itemAt('ruby')==null) s.placeItem('ruby',beak);
  if(!s.visited.has('base_of_tower') || !s.visited.has('tower_landing')) return;
  meetAtTower(s);
  // These three stops have only one ground approach. Preserve the last
  // knowable ground in an old save, without putting the bird in the water.
  const waitingGround={edge_reservoir:'south_reservoir',reservoir:'south_reservoir',underwater:'south_reservoir',
    windmill:'under_windmill'}[s.room];
  if(waitingGround) s.setCnt(location,grounds.indexOf(waitingGround));
  else if(followsHere(s,null)) s.setCnt(location,grounds.indexOf(s.room));
}

export function birdAtOpenDoor(s) {
  return !s.hasFlag(crossed) && onNormalIsland(s) && isletDoorView(s).open;
}
export function advanceRoadrunner(s,e,openOnIsland) {
  if(!s.hasFlag(crossed)) {
    if(onNormalIsland(s) && s.itemAt('ruby')==null) s.placeItem('ruby',beak);
    if(openOnIsland || birdAtOpenDoor(s)) {
      s.setFlag(crossed);
      e.print("The roadrunner gives you a curt nod of acknowledgement. Then it flutters off the toadstool, prances through the open door and disappears.\n\n走鹃朝你轻轻点了点头，扑着翅膀飞下菌盖，轻快地穿过敞开的门，消失了。");
    }
    return;
  }
  if(!s.hasFlag(joined)) {
    if(s.room!=='base_of_tower') return;
    meetAtTower(s);
    if(s.itemAt('ruby')===TOWER_RUBY_BOX) {
      e.print("A familiar roadrunner is eyeing you from its perch on the box's lid. The ruby in its beak gleams in the early dawn.\n\n那只眼熟的走鹃蹲在箱盖上打量着你，喙里的红宝石在晨光中闪闪发亮。");
      e.print("With a skillful toss, the roadrunner deposits the ruby on the box. Then it leaps off and scampers eagerly around your feet. If you didn't know better, you'd swear it was glad to see you.\n\n走鹃灵巧地一甩，把红宝石放在箱盖上，随即跳下来，兴冲冲地绕着你的脚打转。要不是觉得这想法离奇，你几乎要相信它见到你很高兴。");
    }
    return;
  }
  if(followsHere(s,grounds[s.cnt(location)])) s.setCnt(location,grounds.indexOf(s.room));
}

export function roadrunnerWait(s) {
  return (s.chapter==='desert' || s.chapter==='ranch') && roadrunnerView(s).visible;
}
function throughBinoculars(cmd) {
  return cmd?.verb==='examine' && ['with','through'].includes(cmd.prep) && opticsNouns.includes(cmd.noun2);
}
// The existing south-shore room events own the scenery observations. Only an
// actual refocus, not walking away or taking the glasses off, changes the target.
export function recordSceneryFocus(s,cmd) {
  if(s.room==='south_reservoir' && (s.carrying('binoculars') || s.wearing('binoculars'))
    && throughBinoculars(cmd) && ['windmill','风车','reservoir','蓄水池'].includes(cmd.noun)) s.clearFlag(birdFocus);
}
export function roadrunnerAction(s,cmd) {
  if(!cmd || !['desert','ranch','islet'].includes(s.chapter)) return null;
  if(throughBinoculars(cmd) && birdNouns.includes(cmd.noun)) return 'focusBird';
  if(cmd.verb==='examine' && birdNouns.includes(cmd.noun)) return 'bird';
  if(cmd.verb==='look' && ['in ruby','in the ruby'].includes(cmd.noun)) return 'gem';
  if(!gems.includes(cmd.noun)) return null;
  if(cmd.verb==='examine') return 'gem';
  if(cmd.verb==='drop') return 'drop';
  if(cmd.verb==='put') {
    if(cmd.prep==='on' && boxNouns.includes(cmd.noun2) && s.room==='base_of_tower') return 'replace';
    if(cmd.prep==='in' && pocketNouns.includes(cmd.noun2)) return 'pocket';
  }
  if(cmd.verb!=='take') return null;
  if(s.room==='kitchen' && s.itemAt('ruby')==='cupboard') return null;
  if(cmd.type==='compound' && !(cmd.prep==='from' && (boxNouns.includes(cmd.noun2)||pocketNouns.includes(cmd.noun2)))) return null;
  return 'take';
}
export function missingRoadrunnerTarget(s,action,cmd) {
  if(!action) return null;
  const v=roadrunnerView(s);
  if(action==='focusBird' && !s.has('binoculars') && !s.inRoom('binoculars'))
    return v.visible ? "You can't see any binoculars here.\n\n这里看不到望远镜。" : "Those things aren't here.\n\n那两样东西都不在这里。";
  if(action==='bird' || action==='focusBird') return v.visible ? null : ['bird','鸟'].includes(cmd.noun)
    ? "You can't see any bird here.\n\n这里看不到鸟。" : missingBird;
  const loc=s.itemAt('ruby');
  if(cmd.prep==='from' && boxNouns.includes(cmd.noun2) && s.room!=='base_of_tower')
    return "You can't see any box here.\n\n这里看不到箱子。";
  const canSee=s.has('ruby') || s.inRoom('ruby') || (s.room==='base_of_tower' && v.rubyOnBox)
    || (v.perched && v.rubyInBeak) || (s.room==='kitchen' && loc==='cupboard');
  if(action==='drop' && !s.has('ruby')) return canSee ? notHeld : "You're not holding that.\n\n你手里没有那样东西。";
  return canSee ? null : missingRuby;
}
export function performRoadrunnerAction(s,e,action,cmd) {
  if(action==='focusBird') {
    if(!s.carrying('binoculars') && !s.wearing('binoculars'))
      return e.print("You'd have to be holding the pair of binoculars to do that.\n\n得先把那副望远镜拿在手里，才能这么做。");
    if(!s.hasFlag(birdFocus)) {
      e.print('You focus the binoculars on the roadrunner.\n\n你把望远镜对准走鹃，调好焦距。');
      s.setFlag(birdFocus);
    }
    return e.print('It appears much closer now.\n\n走鹃看起来近了许多。');
  }
  if(action==='bird') {
    const v=roadrunnerView(s);
    return e.print(v.perched && v.rubyInBeak
      ? birdText+" It's holding a ruby in its beak.\n\n"+birdCn+'它的喙里衔着一颗红宝石。'
      : birdText+'\n\n'+birdCn);
  }
  if(s.inPocket('ruby') && action!=='take' && action!=='pocket') return e.print(pocketFirst);
  if(action==='gem') return e.print('Its finely cut edges sparkle with crimson fire.\n\n精细切割的棱边闪烁着绯红的火光。');
  if(action==='take') {
    const source=s.itemAt('ruby');
    if(cmd.prep==='from' && pocketNouns.includes(cmd.noun2) && source!=='pocket')
      return e.print("The ruby isn't in your pocket.\n\n红宝石不在你的口袋里。");
    if(cmd.prep==='from' && boxNouns.includes(cmd.noun2) && source!==TOWER_RUBY_BOX)
      return e.print("The ruby isn't on the box.\n\n红宝石不在箱盖上。");
    if(source===beak) return e.print("You can't reach the ruby. The toadstool is too high.\n\n毒菌太高了，你够不着那颗红宝石。");
    if(s.carrying('ruby')) return e.print("You're already holding the ruby.\n\n你手里已经拿着红宝石了。");
    if(s.carryCount()>=8) return e.print("You're holding too much already.\n\n你拿不下更多东西了。");
    s.take('ruby');
    if(source===TOWER_RUBY_BOX) {
      e.print('You take the ruby off the box.\n\n你从箱盖上拿起了红宝石。');
      if(!s.hasFlag(scoreFlag)) {s.setFlag(scoreFlag);s.addScore(1);}
    } else if(source==='pocket') e.print('You take the ruby out of your pocket.\n\n你从口袋里取出红宝石。');
    else e.print('Taken.\n\n你拿起了红宝石。');
    return;
  }
  if(action==='pocket' && s.inPocket('ruby')) return e.print('The ruby is already in your pocket.\n\n红宝石已经在你口袋里了。');
  if(!s.carrying('ruby')) return e.print(notHeld);
  if(action==='replace') {
    s.placeItem('ruby',TOWER_RUBY_BOX);
    return e.print('You put the ruby on the box.\n\n你把红宝石放到箱盖上。');
  }
  if(action==='pocket') {
    s.toPocket('ruby');
    return e.print('You put the ruby in your pocket.\n\n你把红宝石放进口袋。');
  }
  s.drop('ruby');
  e.print('Dropped.\n\n你放下了红宝石。');
}
