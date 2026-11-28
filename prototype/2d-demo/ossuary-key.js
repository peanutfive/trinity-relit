const room='ossuary';
export const SKELETON_KEY='key_barrow';
const fingers='ossuary_fingers';
const searched='ossuary_bones_searched';
const rules='ossuary_key_rules';
const scored='ossuary_key_scored';
const bones=['bones','bone','skeletons','skeleton','human bones','骸骨','骨堆','骨头','骨'];
const keyNames=['skeleton key','key','钥匙','骸骨钥匙','骷髅钥匙'];
const flag=(s,n)=>s.hasFlag?.(n) ?? s.flags?.has?.(n) ?? s.flags?.includes?.(n) ?? false;
const pocketFirst="You'll have to take it out of your pocket first.\n\n你得先把它从口袋里拿出来。";
export const skeletonKeyDescription='Its slender form reminds you of a crooked finger.\n\n它纤细的形状让你想起一根弯曲的手指。';

export function ossuaryKeyView(state) {
  const handExposed=flag(state,searched);
  return {handExposed,inFingers:handExposed && state.itemLoc?.[SKELETON_KEY]===fingers};
}

export function initializeOssuaryKey(state) {
  if(!flag(state,rules) && state.itemAt(SKELETON_KEY)===room)state.moveItem(SKELETON_KEY,fingers);
  state.setFlag(rules);
}

export function restoreOssuaryKey(state,saved) {
  const visited=state.visited.has(room);
  if(!Object.hasOwn(saved.itemLoc ?? {},SKELETON_KEY) && (visited || flag(state,rules)))
    delete state.itemLoc[SKELETON_KEY];
  if(flag(state,rules))return;
  if(!visited && state.itemAt(SKELETON_KEY)===room){
    initializeOssuaryKey(state);
    return;
  }
  // Older saves exposed a loose key on entry. It may already have been put
  // back there, pocketed or carried elsewhere. Keep its location and score.
  if(state.itemAt(SKELETON_KEY)!==fingers)state.setFlag(scored);
  state.setFlag(rules);
}

function searchBones(s,eng) {
  if(!flag(s,searched) && s.itemAt(SKELETON_KEY)===fingers){
    s.setFlag(searched);
    eng.print('As you sift dispiritedly through the bones, a skeleton key, still clutched in a long-dead hand, catches your eye.\n\n你意兴阑珊地拨开骸骨，看见一把骸骨钥匙，仍攥在一只死去多年的手里。');
  }else{
    s.setFlag(searched);
    eng.print('Further sifting through the bones reveals nothing unusual.\n\n你又翻找了一阵，没有发现别的异样。');
  }
}

export function withOssuaryBones(base) {
  return {...base,events:[
    {id:'examine_bones',match:{verb:['examine'],noun:bones},
      text:'The bones are bleached white from years in the sun. They range from bits of rib and skull to complete skeletons.\n\n骸骨在常年的日晒下褪成白色。其间有零散的肋骨与颅骨碎片，也有完整的骨架。'},
    {id:'ossuary_touch_bones',match:{verb:['touch','feel'],noun:bones},text:'The bones feel dry and brittle.\n\n骸骨摸起来又干又脆。'},
    {id:'ossuary_search_bones',match:{verb:['search','take'],noun:bones},act:searchBones,text:''},
    ...base.events.filter(event=>event.id!=='examine_bones'),
  ]};
}

export function parseOssuaryBones(roomId,input) {
  if(roomId!==room)return null;
  if(/^(?:look (?:in|under)|sift through|search|take) (?:the )?(?:bones|bone pile|pile of bones|skeletons)$|^(?:翻找|翻动|搜寻|搜索)(?:骨堆|骸骨|骨头)$/.test(input))
    return {type:'simple',verb:'search',noun:'bones'};
  if(/^(?:touch|feel) (?:the )?bones$|^(?:摸|触摸)(?:骨堆|骸骨|骨头)$/.test(input))
    return {type:'simple',verb:'touch',noun:'bones'};
  return null;
}

export function freeMissingSkeletonKey(s,cmd) {
  if(s.room!==room || !keyNames.includes(cmd?.noun))return null;
  const visible=ossuaryKeyView(s).inFingers || s.has(SKELETON_KEY) || s.inRoom(SKELETON_KEY);
  if(!visible && ['take','examine','touch','search'].includes(cmd.verb))
    return cmd.noun==='key'?"You can't see any key here.\n\n这里看不到钥匙。":"You can't see any skeleton key here.\n\n这里看不到骸骨钥匙。";
  if(cmd.verb==='drop' && !s.has(SKELETON_KEY))
    return visible?"You're not holding a skeleton key.\n\n你手里没有骸骨钥匙。":"You're not holding that.\n\n你没有拿着它。";
  return null;
}

export function handleSkeletonKey(s,eng,cmd) {
  if(!keyNames.includes(cmd?.noun))return false;
  const inFingers=s.room===room && ossuaryKeyView(s).inFingers;
  if(!inFingers && !s.has(SKELETON_KEY) && !s.inRoom(SKELETON_KEY))return false;
  const pocket=s.inPocket(SKELETON_KEY);
  if(cmd.noun2){
    if(s.room===room && cmd.verb==='take' && bones.includes(cmd.noun2)){
      eng.print("The skeleton key isn't on the bones.\n\n骸骨钥匙并不在那堆骨头上。");
      return true;
    }
    if(cmd.verb==='put' && s.carrying(SKELETON_KEY) && ['pocket','your pocket','口袋'].includes(cmd.noun2)){
      s.toPocket(SKELETON_KEY);
      eng.print('You put the skeleton key in your pocket.\n\n你把骸骨钥匙放进了口袋。');
      return true;
    }
    if(s.room===room && cmd.verb==='put' && bones.includes(cmd.noun2) && s.carrying(SKELETON_KEY)){
      s.drop(SKELETON_KEY);
      eng.print('Dropped.\n\n你放下了钥匙。');
      return true;
    }
    return false;
  }
  if(cmd.verb==='examine')eng.print(pocket?pocketFirst:skeletonKeyDescription);
  else if(cmd.verb==='drop'){
    if(pocket)eng.print(pocketFirst);
    else if(s.has(SKELETON_KEY)){s.drop(SKELETON_KEY);eng.print('You drop the skeleton key.\n\n你放下了骸骨钥匙。');}
    else return false;
  } else if(cmd.verb==='take'){
    if(s.carrying(SKELETON_KEY))eng.print("You're already holding the skeleton key.\n\n你已经拿着骸骨钥匙了。");
    else if(s.carryCount()>=8)eng.print("You're holding too much already.\n\n你已经拿不下更多东西了。");
    else{
      s.take(SKELETON_KEY);
      if(inFingers)eng.print('You gently pry the skeleton key out from between the fingers.\n\n你轻轻掰开指骨，取出了骸骨钥匙。');
      else eng.print(pocket?'You take the skeleton key out of your pocket.\n\n你从口袋里取出了骸骨钥匙。':'You take the skeleton key.\n\n你拿起了骸骨钥匙。');
      if(inFingers && !flag(s,scored)){
        s.setFlag(scored);s.addScore(1);
        eng.print('[Your score just went up by 1 point. The total is now '+s.score+' out of 100.]\n\n[你的得分增加了 1 分，现在是 '+s.score+' 分，满分 100 分。]');
      }
    }
  } else return false;
  return true;
}
