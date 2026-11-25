const closetId='closet';
const assembly='assembly_room';
const shut='closet_door_closed';
const front='front_deck_right_door_open';
const awake='ranch_snake_awake';
const bitten='ranch_snake_bitten';
const grace='ranch_snake_warning_turn';
const struck='ranch_snake_bite_turn';
const fromCloset='ranch_snake_returning_from_closet';
const closetNouns=['closet door','壁橱门'];
const frontNouns=['front door','前门'];
const doorNouns=['door','门'];
const animal=['snake','rattlesnake','蛇','响尾蛇'];
const closedText='The closet door is closed.\n\n壁橱门关着。';
const closedFront='The front door is closed.\n\n前门关着。';
const dark="It's too dark to see.\n\n四周太暗，看不清。";
const atDoor="The rattlesnake lurks just outside the open door. It looks as if it's about to strike!\n\n响尾蛇就在敞开的门外，眼看就要扑过来了！";
const alert="The rattlesnake rears its wedge-shaped head. It looks as if it's about to strike!\n\n响尾蛇昂起楔形的头，眼看就要扑过来了！";
const retreat='You beat a hasty retreat from the rattlesnake.\n\n你赶紧避开响尾蛇，退了出去。';
const snakeBehind='Luckily, the rattlesnake is on the other side of the closet door.\n\n幸好，响尾蛇在壁橱门另一边。';
function flag(s,key) {
  return s.hasFlag?.(key) ?? s.flags?.has?.(key) ?? s.flags?.includes?.(key) ?? false;
}
function illuminatesCloset(s,id) {
  const loc=s.itemLoc?.[id];
  return loc==='inventory'||loc===closetId;
}
export function closetView(s) {
  const doorOpen=!flag(s,shut),frontOpen=flag(s,front);
  const lit=doorOpen || illuminatesCloset(s,'splinter') || (flag(s,'lantern_on') && illuminatesCloset(s,'lantern'));
  let snake='absent';
  if(flag(s,bitten)) snake='bitten';
  else if(flag(s,awake)) {
    if(s.room===assembly) snake='warning';
    if(s.room===closetId && doorOpen) snake='atDoor';
  }
  return {doorOpen,frontOpen,lit,snake};
}

// These refusals are parser/visibility responses in the original. A boundary
// label or an unrecognized direction must never spend the player's escape turn.
export function closetFreeResponse(s,cmd) {
  if(!cmd || (s.room!==assembly && s.room!==closetId)) return null;
  const {doorOpen,frontOpen,lit}=closetView(s);
  if(cmd.type==='direction') {
    if(s.room===closetId) {
      if(cmd.dir==='s'||cmd.dir==='out') return doorOpen?null:closedText;
      if(cmd.dir==='in') return "You're in the closet as far as you can go.\n\n壁橱里已经没有更深处可去了。";
      return "There's no exit that way.\n\n那边没有出口。";
    }
    if(cmd.dir==='in') return '[Which way do you want to go in?]\n\n[你想往哪个方向进去？]';
    if(cmd.dir==='out') return '[Which way do you want to go out?]\n\n[你想往哪个方向出去？]';
    if(cmd.dir==='e') return frontOpen?null:closedFront;
    if(cmd.dir==='n') return doorOpen?null:closedText;
    if(cmd.dir!=='w' && cmd.dir!=='s') return "There's no exit that way.\n\n那边没有出口。";
  }
  if(s.room===closetId) {
    if(!lit && (cmd.cmd==='look'||cmd.verb==='examine'||cmd.verb==='read')) return dark;
    if(frontNouns.includes(cmd.noun)) return "You can't see any front door here.\n\n这里看不到前门。";
    if(!doorOpen && animal.includes(cmd.noun)) return snakeBehind;
  }
  if(s.hasFlag(bitten) && animal.includes(cmd.noun)) return "The rattlesnake isn't here anymore.\n\n响尾蛇已经游走了。";
  return null;
}

function warn(s,eng,inside) {
  s.setCnt(grace,s.turns);
  if(inside) return eng.print(atDoor);
  const initial=!s.hasFlag(awake);
  s.setFlag(awake);
  if(initial) {
    eng.print('You turn to face an urgent noise behind you. Your heart skips a beat. Two tiny eyes, bright with hunger, black with menace, are glaring at you from only a few feet away.\n\n背后骤然响起一阵响动。你转过身，心跳漏了一拍。几英尺外，一双小眼睛正盯着你，黑亮的眼里满是饥饿与敌意。');
    eng.print("You hear the noise again. It's like a pebble in an empty can.\n\n那声音又来了，像一颗小石子在空罐里摇响。");
  }
  eng.print(initial?alert:"The rattlesnake flicks its tongue in and out. It looks as if it's about to strike!\n\n响尾蛇不断吞吐着舌头，眼看就要扑过来了！");
}

function bite(s,eng) {
  s.setFlag(bitten);
  s.setCnt(struck,s.turns);
  eng.print('The rattlesnake strikes your ankle like lightning, recoils in an instant and slithers out of sight.\n\n响尾蛇闪电般咬中你的脚踝，随即缩身，游出了视线。');
  eng.print("Sobbing with pain and shock, you peer at the tender wound. It's already beginning to swell.\n\n你又疼又惊，抽泣着低头看伤口。那里已经开始肿起来了。");
}
function finishBite(s,eng) {
  if(!s.hasFlag(bitten) || s.cnt(struck)>=s.turns) return false;
  const outside=s.room==='front_deck';
  eng.die('The throbbing fire in your ankle overcomes you. Moaning with despair, you sink helplessly to the '+(outside?'ground':'floor')+'.\n\n脚踝一阵阵灼痛，你再也支撑不住，绝望地呻吟着倒在了地上。');
  return true;
}
// The only places a player can arrive in their single intervening turn after
// the bite are the two encounter rooms and these three adjacent rooms.
export function afterClosetBite(room,id) {
  return {...room,onTurn(s,eng) {
    if(s.room!==id) return;
    if(!finishBite(s,eng)) room.onTurn?.(s,eng);
  }};
}
function encounterTurn(s,eng) {
  if(finishBite(s,eng) || s.hasFlag(bitten)) return;
  if(!s.hasFlag(awake)) {
    if(s.room===assembly) warn(s,eng,false);
    return;
  }
  if(s.room===closetId && s.hasFlag(shut)) return;
  if(s.cnt(grace)!==s.turns) bite(s,eng);
}

function mutateDoor(s,e,open) {
  if(open===!s.hasFlag(shut)) return e.print(open?"It's already open.\n\n门已经开着了。":"It's already closed.\n\n门已经关着了。");
  if(open) {
    s.clearFlag(shut);
    e.print('You open the closet door.\n\n你打开了壁橱门。');
    if(s.room===closetId && s.hasFlag(awake) && !s.hasFlag(bitten)) warn(s,e,true);
  } else {
    s.setFlag(shut);
    e.print('You close the closet door.\n\n你关上了壁橱门。');
    if(s.room===closetId && !closetView(s).lit) e.print("It's completely dark.\n\n四周一片漆黑。");
  }
}

function doorEvents(id) {
  const noun=id===closetId?[...closetNouns,...doorNouns]:closetNouns;
  return [
    {id:id+'_inspect_closet_door',match:{verb:['examine'],noun},text:s=>s.hasFlag(shut)
      ?'It looks as if the closet door is closed.\n\n壁橱门关着。':'It looks as if the closet door is open.\n\n壁橱门开着。'},
    ...['open','close'].map(verb=>({id:id+'_'+verb+'_closet_door',match:{verb:[verb],noun},act:(s,e)=>mutateDoor(s,e,verb==='open'),text:''})),
    {id:id+'_inspect_rattlesnake',match:{verb:['examine'],noun:animal},when:s=>s.hasFlag(awake)&&!s.hasFlag(bitten),
      text:'All you can see are those tiny black eyes, glaring.\n\n你只能看见那双乌黑的小眼睛，正死死地盯着你。'},
  ];
}
function block(s,id,target,door,fail) {
  const result={to:id,when:()=>false,fail};
  if(s.hasFlag(door+'_crossed')) result.rememberedTo=target;
  return result;
}
function leaveOuter(target) {
  return {to:target,act(st,eng){
    if(st.hasFlag(awake)&&!st.hasFlag(bitten)) eng.print(retreat);
    if(target===closetId) st.setFlag(shut+'_crossed');
  }};
}

const windows=['window','windows','窗','窗户','窗子'];
const windowEvents=[
  {id:'assembly_examine_window',match:{verb:['examine'],noun:windows},
    text:'The windows are closed and sealed with tape.\n\n两扇窗都关着，边缘用胶带封住了。'},
  {id:'assembly_look_through_window',match:{verb:['look'],noun:['through window','through the window','through windows','through the windows']},
    text:"Little can be seen from where you're standing.\n\n从你站的地方往外看，看不清什么。"},
  {id:'assembly_open_window',match:{verb:['open'],noun:windows},
    text:'The tape on the windows prevents this.\n\n窗上的胶带封得严实，窗户打不开。'},
  {id:'assembly_examine_tape',match:{verb:['examine'],noun:['tape','胶带','封条']},
    text:"You don't see anything unusual about the tape.\n\n这胶带看起来没什么特别。"},
];

export function closetRooms(outer,inner) {
  return {
    [assembly]:{...outer,
      exits(s) {
        return {...outer.exits(s),
          n:s.hasFlag(shut)?block(s,assembly,closetId,shut,closedText):leaveOuter(closetId),
          e:s.hasFlag(front)?leaveOuter('front_deck'):block(s,assembly,'front_deck',front,closedFront),
          w:leaveOuter('nw_room'),s:leaveOuter('se_room')};
      },
      onEnter(s,e) {
        if(s.hasFlag(bitten)) return;
        if(s.hasFlag(fromCloset)) {s.clearFlag(fromCloset); return;}
        warn(s,e,false);
      },
      onTurn(s,e){if(s.room!==assembly) return;encounterTurn(s,e);},
      events:[...doorEvents(assembly),...windowEvents,...outer.events],
    },
    [closetId]:{...inner,
      desc(s){return closetView(s).lit ? inner.desc(s) : dark;},
      exits(s) {
        const back=s.hasFlag(shut)?block(s,closetId,assembly,shut,closedText):{to:assembly,act(st){
          if(st.hasFlag(awake)&&!st.hasFlag(bitten)) st.setFlag(fromCloset);
        }};
        return {...inner.exits(s),s:back,out:back};
      },
      onEnter(s,e){if(s.hasFlag(awake)&&!s.hasFlag(bitten)&&!s.hasFlag(shut)) warn(s,e,true);},
      onWait(s){if(s.hasFlag(shut) && !s.hasFlag(bitten)) s.turns+=3;},
      onTurn(s,e){if(s.room!==closetId) return;encounterTurn(s,e);},
      events:doorEvents(closetId),
    },
  };
}
