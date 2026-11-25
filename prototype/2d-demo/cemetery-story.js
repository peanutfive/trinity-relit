import { ROOMS as WABE } from '../js/data/wabe.js';
import { withVertexShadow, withVertexMoor } from './vertex-story.js';
import { withFerryShore } from './ferry-shore.js';
import { CORPSE, MOUTH, CRYPT_OPEN, CRYPT_INSPECTED, MOUTH_INSPECTED, cemeteryItemLocation, cemeteryView } from './cemetery-state.js';

const crypt = ['crypt','coffin','石棺','棺材'];
const lid = ['lid','cover','棺盖','盖子'];
const corpse = ['corpse','body','cadaver','遗体','尸体'];
const mouth = ['mouth','jaw','嘴','嘴巴','口中','嘴里'];
const items = {
  shroud:{name:'burial shroud',cn:'裹尸布',nouns:['burial shroud','shroud','裹尸布']},
  bandage:{name:'bandage',cn:'绷带',nouns:['bandage','strip','绷带','布条']},
  silver_coin:{name:'silver coin',cn:'银币',nouns:['silver coin','silver_coin','银币']},
};
const packed = "You're holding too much already.\n\n你拿不下更多东西了。";
const closed = 'The crypt is closed.\n\n石棺封着。';
const alreadyOpen = "It's already open.\n\n石棺已经打开了。";

function visibleInCemetery(s,id) {
  if (s.has(id) || s.inRoom(id)) return true;
  const location=cemeteryItemLocation(s,id);
  const view=cemeteryView(s);
  return location===CORPSE ? view.open : location===MOUTH && view.mouthOpen;
}

function notSeen(id) {
  const noun=id==='shroud'?'shroud':items[id].name;
  return "You can't see any "+noun+' here.\n\n你在这里看不到'+items[id].cn+'。';
}

function corpseDescription(s) {
  const {shroudOnBody,bandageOnBody} = cemeteryView(s);
  const body = shroudOnBody ? ' body is wrapped in a gray burial shroud' : ', unclothed body is badly decomposed';
  const jaw = bandageOnBody ? 'held shut with a bandage wrapped around its head' : 'hanging wide open';
  return 'The solemn dignity of the crypt makes you suspect that the remains may be those of some great missionary or explorer. The shrunken'+body+', and its wrinkled mouth is '+jaw+'. A pair of boots, one red and one green, completes the ghastly wardrobe.\n\n'
    +'石棺庄严肃穆，让你猜想这里安息着一位伟大的传教士或探险家。干瘪的遗体'+(shroudOnBody?'裹着一块灰色裹尸布':'已经腐朽，身上没有衣物')+'，皱缩的嘴'+(bandageOnBody?'被一条绕过头顶的绷带牢牢缚住':'大张着')+'。脚上一红一绿的两只靴子配成了这身阴森的装束。';
}

function openWithSpade(s, eng) {
  if (s.hasFlag(CRYPT_OPEN)) return eng.print(alreadyOpen);
  if (!s.carrying('spade')) return eng.print("You're not holding a spade.\n\n你手里没有铲子。");
  s.setFlag(CRYPT_OPEN);
  for (const id of Object.keys(items)) {
    if (s.itemAt(id) == null) s.placeItem(id,cemeteryItemLocation(s,id));
  }
  s.addScore(3);
  eng.print("You slide the end of the spade under the lid's edge and lean on it with all your strength.\n\nCRACK! You feel a puff of foul-smelling air as a section of the crypt's lid breaks away.\n\n你把铲尖插到棺盖边缘下面，用全身的力气压下去。咔嚓！棺盖崩掉一块，一股腐臭的空气扑面而来。");
}

function inspectMouth(s, eng) {
  const {open,mouthOpen,coinInMouth} = cemeteryView(s);
  if (!open) return eng.print("[You don't need to refer to your mouth to complete this story.]\n\n[完成这个故事无需特意查看你自己的嘴。]");
  s.setFlag(CRYPT_INSPECTED);
  if (!mouthOpen) return eng.print('The closed mouth is blue and wrinkled.\n\n紧闭的嘴唇泛着青色，满是皱纹。');
  if (coinInMouth) {
    s.setFlag(MOUTH_INSPECTED);
    eng.print('The open mouth is blue and wrinkled. Inside it you can see a silver coin.\n\n张开的嘴唇泛着青色，满是皱纹。你看见嘴里有一枚银币。');
  } else eng.print('The open mouth is blue and wrinkled.\n\n张开的嘴唇泛着青色，满是皱纹。');
}

function takeFromCrypt(s, eng, id) {
  const view = cemeteryView(s);
  if (!view.open || (id === 'silver_coin' && !view.mouthOpen)) {
    return eng.print(notSeen(id));
  }
  if (s.carryCount() >= 8) return eng.print(packed);
  s.take(id);
  if (id === 'bandage') {
    eng.print('As you pull the bandage off the corpse its mouth drops wide open.\n\n你从遗体上取下绷带，它的嘴一下子张开了。');
    return;
  }
  const scored = 'cemetery_scored_'+id;
  const first = !s.hasFlag(scored);
  if (first) { s.setFlag(scored); s.addScore(1); }
  if (id === 'silver_coin') eng.print('You take the silver coin out of the mouth.\n\n你从嘴里取出了银币。');
  else eng.print(first
    ? 'You remove the burial shroud from the corpse, revealing its decomposed body.\n\n你取下裹尸布，露出已经腐朽的遗体。'
    : 'You take the burial shroud off the corpse.\n\n你从遗体上取下了裹尸布。');
}

const inside = nouns => nouns.flatMap(noun=>['in '+noun,'in the '+noun,'inside '+noun,'inside the '+noun]);
const cryptEvents = [
  {id:'cemetery_open_crypt_spade',match:{verb:['open'],noun:[...crypt,...lid],noun2:['spade','铲子','铲']},act:openWithSpade,text:''},
  {id:'cemetery_open_crypt',match:{verb:['open'],noun:[...crypt,...lid]},text:s=>s.hasFlag(CRYPT_OPEN)?alreadyOpen:"Beads of sweat stand out on your forehead as you strain against the lid. But it'll take more leverage than you've got to budge it.\n\n你用力抬起棺盖，额头沁出汗珠。要撬动它，还得有更大的力臂。"},
  {id:'cemetery_close_crypt',match:{verb:['close'],noun:crypt},text:s=>s.hasFlag(CRYPT_OPEN)?"You can't do that now. You broke the lid.\n\n棺盖已经被你撬破了，合不上了。":"It's already closed.\n\n棺盖本来就封着。"},
  {id:'cemetery_examine_crypt',match:{verb:['examine'],noun:crypt},text:s=>{
    const open = s.hasFlag(CRYPT_OPEN);
    return 'The granite crypt must be hundreds of years old. '+(open?'Its lid is broken off, leaving a jagged opening.':"It's sealed shut with a heavy lid.")+'\n\nA name is engraved across the bottom of the crypt.\n\n这具花岗岩石棺想必已有几百年历史。'+(open?'棺盖已经破开，留下一个参差不齐的缺口。':'沉重的棺盖将它封得严严实实。')+'棺身底部刻着一个名字。';
  }},
  {id:'cemetery_examine_lid',match:{verb:['examine'],noun:lid},text:s=>s.hasFlag(CRYPT_OPEN)?'The broken lid is a formidable slab of granite.\n\n断裂的棺盖是一块厚重的花岗岩。':'The lid is a formidable slab of granite.\n\n棺盖是一块厚重的花岗岩。'},
  {id:'cemetery_look_in_crypt',match:{verb:['look','examine'],noun:[...inside(crypt),'棺内','石棺里']},act(s,eng){
    if (!s.hasFlag(CRYPT_OPEN)) return eng.print(closed);
    s.setFlag(CRYPT_INSPECTED);
    eng.print('You see a corpse in the crypt.\n\n你看见石棺中躺着一具遗体。');
  },text:''},
  {id:'cemetery_examine_corpse',match:{verb:['examine'],noun:corpse},act(s,eng){
    if (!s.hasFlag(CRYPT_OPEN)) return eng.print("You can't see any corpse here.\n\n你在这里看不到遗体。");
    s.setFlag(CRYPT_INSPECTED);
    eng.print(corpseDescription(s));
  },text:''},
  {id:'cemetery_examine_mouth',match:{verb:['look','examine'],noun:[...mouth,...inside(mouth)]},act:inspectMouth,text:''},
  ...Object.entries(items).map(([id,item])=>({
    id:'cemetery_take_'+id,match:{verb:id==='silver_coin'?['take']:['take','remove'],noun:item.nouns},
    when:s=>cemeteryItemLocation(s,id)===(id==='silver_coin'?MOUTH:CORPSE),
    act:(s,eng)=>takeFromCrypt(s,eng,id),text:'',
  })),
  ...['shroud','bandage'].map(id=>({
    id:'cemetery_rewrap_'+id,match:{verb:['put'],noun:items[id].nouns,noun2:corpse},
    when:s=>s.hasFlag(CRYPT_OPEN) && s.has(id),act(s,eng){
      if (s.wearing(id)) eng.print('[taking off the '+items[id].name+' first]\n\n[你先取下了'+items[id].cn+'。]');
      s.placeItem(id,CORPSE);
      if (id==='bandage') {
        s.clearFlag(MOUTH_INSPECTED);
        eng.print("You awkwardly wrap the bandage around the corpse's head and jaw, as before.\n\n你笨拙地把绷带照原样绕回遗体的头顶和下颌。");
      } else {
        s.setFlag('cemetery_scored_shroud');
        eng.print('You awkwardly wrap the burial shroud around the corpse, as before.\n\n你笨拙地把裹尸布照原样裹回遗体上。');
      }
    },text:'',
  })),
  {id:'cemetery_return_silver_coin',match:{verb:['put'],noun:items.silver_coin.nouns,noun2:mouth},
    when:s=>s.hasFlag(CRYPT_OPEN) && s.has('silver_coin'),act(s,eng){
      if (!cemeteryView(s).mouthOpen) return eng.print("The mouth isn't open.\n\n嘴还闭着。");
      s.placeItem('silver_coin',MOUTH);
      s.setFlag('cemetery_scored_silver_coin');
      s.setFlag(MOUTH_INSPECTED);
      eng.print('You put the silver coin in the mouth.\n\n你把银币放回了嘴里。');
    },text:''},
  ...Object.entries(items).flatMap(([id,item])=>[
    {id:'cemetery_unseen_'+id,match:{verb:['take','examine','read','wear','remove'],noun:item.nouns},
      when:s=>!visibleInCemetery(s,id),text:notSeen(id)},
    {id:'cemetery_not_holding_'+id,match:{verb:['put'],noun:item.nouns,noun2:id==='silver_coin'?mouth:corpse},
      when:s=>!s.has(id),text:s=>visibleInCemetery(s,id)
        ?"You're not holding a "+item.name+'.\n\n你手里没有'+item.cn+'。'
        :"You're not holding that.\n\n你手里没有那个东西。"},
  ]),
];

function garmentDescription(s,id) {
  const attached = s.room==='cemetery' && cemeteryItemLocation(s,id)===CORPSE && s.hasFlag(CRYPT_OPEN);
  if (id==='shroud') return 'The burial shroud'+(s.wearing(id)?" you're wearing":'')+' is gray and tattered.'+
    (attached?" It's wrapped loosely around the corpse.":'')+'\n\n'+(s.wearing(id)?'你穿着的':'这块')+'裹尸布灰扑扑的，已经破烂不堪。'+(attached?'它松松地裹在遗体上。':'');
  return "It's a broad strip of gray cloth"+(attached?", wrapped over the top of the corpse's head and under its chin":s.wearing(id)?', wrapped around your head':'')+'.\n\n这是一条宽宽的灰布'+(attached?'，从遗体的头顶绕过下巴。':s.wearing(id)?'，缠在你的头上。':'。');
}

const garments = ['shroud','bandage'].flatMap(id=>{
  const {name,cn,nouns} = items[id];
  const available = s=>s.has(id)||s.inRoom(id)||(s.room==='cemetery' && s.hasFlag(CRYPT_OPEN) && cemeteryItemLocation(s,id)===CORPSE);
  return [
    {id:'inspect_'+id,match:{verb:['examine'],noun:nouns},when:available,text:s=>garmentDescription(s,id)},
    {id:'wear_'+id,match:{verb:['wear'],noun:nouns},when:available,act(s,eng){
      if (s.wearing(id)) return eng.print("You're already wearing the "+name+'.\n\n你已经穿戴着'+cn+'了。');
      if (!s.carrying(id)) return eng.print("You're not holding the "+name+'.\n\n你手里没有'+cn+'。');
      s.wear(id);eng.print('You put on the '+name+'.\n\n你'+(id==='shroud'?'披上裹尸布。':'把绷带缠在头上。'));
    },text:''},
    {id:'remove_'+id,match:{verb:['remove'],noun:nouns},when:s=>s.has(id),act(s,eng){
      if (!s.wearing(id)) return eng.print("You're already holding the "+name+'.\n\n你手里已经拿着'+cn+'了。');
      s.take(id);eng.print('You take off the '+name+'.\n\n你'+(id==='shroud'?'脱下裹尸布。':'解下了头上的绷带。'));
    },text:''},
    {id:'drop_'+id,match:{verb:['drop'],noun:nouns},when:s=>s.has(id),act(s,eng){
      const worn=s.wearing(id);
      s.drop(id);eng.print((worn?'[taking off the '+name+' first]\n\n':'')+'You drop the '+name+'.\n\n'+(worn?'你先取下了'+cn+'。':'')+'你放下了'+cn+'。');
    },text:''},
  ];
});

const portableEvents = [...garments,...Object.entries(items).map(([id,item])=>({
  id:'already_holding_'+id,match:{verb:['take'],noun:item.nouns},when:s=>s.carrying(id) || s.wearing(id),
  text:s=>s.wearing(id)
    ?"You're already wearing the "+item.name+'.\n\n你已经穿戴着'+item.cn+'了。'
    :"You're already holding the "+item.name+'.\n\n你手里已经拿着'+item.cn+'了。',
})),{
  id:'inspect_cemetery_silver_coin',match:{verb:['examine','read'],noun:items.silver_coin.nouns},
  when:s=>s.has('silver_coin') || s.inRoom('silver_coin') || (s.room==='cemetery' && cemeteryView(s).mouthOpen && cemeteryView(s).coinInMouth),
  text:'The words NOT TRANSFERABLE are engraved on the silver coin.\n\n银币上刻着「不得转让」。',
}];

export function withCemeteryItems(rooms) {
  return Object.fromEntries(Object.entries(rooms).map(([id,room])=>[id,{...room,events:[...(room.events||[]),...portableEvents]}]));
}

export const ROOMS = withCemeteryItems({...WABE, vertex:withVertexShadow(WABE.vertex), moor:withVertexMoor(WABE.moor), the_river:withFerryShore(WABE.the_river), cemetery:{
  ...WABE.cemetery,
  desc() {
    return 'Gloomy statues lie toppled among the tombstones, their broken limbs and heads scattered like the carnage of a ghastly battle.\n\n阴沉的雕像倒在墓碑之间，断裂的手足和头颅散落一地，仿佛刚经历了一场惨烈的战斗。';
  },
  events:[...cryptEvents,...WABE.cemetery.events],
}});
