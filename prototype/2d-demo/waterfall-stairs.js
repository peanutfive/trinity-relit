const ends = {
  waterfall:{
    dir:'n', alias:'u', other:'cemetery',
    description:'A flight of stone steps has been hewn into the face of the north cliff.\n\n一段石阶凿在北侧崖壁上。',
    walking:'You carefully ascend the stone steps.\n\n你小心地沿着石阶往上走。',
  },
  cemetery:{
    dir:'s', alias:'d', other:'waterfall',
    description:'Sudden drops fall away on every side but south, where a flight of stone steps descends the cliff.\n\n四周都是断崖，只有南边有一段石阶沿崖而下。',
    walking:'You carefully descend the stone steps.\n\n你小心地沿着石阶往下走。',
  },
};
const stairNouns=['steps','stone steps','stairs','stone stairs','石阶','台阶','石梯'];

// Only the two ends of these steps share this vocabulary. Other stairways
// retain their own actions, including the stairs below the sundial.
export function parseFallsSteps(room, input) {
  if (!Object.hasOwn(ends,room)) return null;
  const english=input.match(/^(climb(?: up| down)?|(?:go|walk) (?:up|down)|ascend|descend|x) (?:the )?(?:stone )?(?:steps|stairs)$/);
  const chinese=input.match(/^(爬上|登上|走上|上|爬下|走下|下)(?:石阶|台阶|石梯)$/);
  if (!english && !chinese) return null;
  const action=(english||chinese)[1];
  const verb=action==='x'?'examine':/down|descend|下/.test(action)?'descend':'climb';
  return {type:'simple',verb,noun:'steps'};
}

export function freeFallsDirection(room, dir) {
  if ((room==='waterfall' && dir==='d') || (room==='cemetery' && dir==='u'))
    return "You can't go that way.\n\n你不能往那个方向走。";
  if (room==='cottage' && dir==='s')return "There's no exit that way.\n\n那个方向没有出口。";
  if (room==='cottage' && dir==='out')return '[Which way do you want to go out?]\n\n[你想往哪个方向出去？]';
  return null;
}

export function withFallsSteps(room,id) {
  const end=ends[id];
  const traverse={to:end.other,text:end.walking};
  const up=id==='waterfall';
  return {...room,
    desc:s=>room.desc(s)+'\n\n'+end.description,
    exits:s=>({...room.exits(s),[end.dir]:traverse,[end.alias]:traverse}),
    events:[
      {id:id+'_examine_steps',match:{verb:['examine'],noun:stairNouns},
        text:'The stone steps are carved into the face of the cliff.\n\n石阶是从崖壁上凿出来的。'},
      {id:id+'_travel_steps',match:{verb:[up?'climb':'descend'],noun:stairNouns},
        async act(s,eng){await eng._handleDirection(end.dir);},text:''},
      {id:id+'_wrong_end_steps',match:{verb:[up?'descend':'climb'],noun:stairNouns},
        text:up?"You're already at the bottom of the stone steps.\n\n你已经在石阶底端了。"
          :"You're already at the top of the stone steps.\n\n你已经在石阶顶端了。"},
      {id:id+'_enter_steps',match:{verb:['enter'],noun:stairNouns},text:"That's impossible.\n\n这办不到。"},
      ...room.events,
    ],
  };
}

export function withCottageDoors(room) {
  return {...room,exits(s){
    const {e,w}=room.exits(s);
    return {e,w};
  }};
}
