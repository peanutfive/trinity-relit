// The eastern light in the cavern leads back to the water curtain. Saves
// from the older cliff entrance still return to the approach they used.
const found = 'waterfall_opening_found';
const falls = ['waterfall','water','瀑布','水幕','水帘','水'];
const opening = ['opening','开口','洞口'];
const waterDescription = 'The water falls in a white curtain from the overhanging cliffs.\n\n水从悬崖上垂落，织成一道白色水帘。';
const first = 'Careful inspection reveals an opening in the cliff behind the waterfall.\n\n你仔细端详水帘后方，在岩壁上发现了一处开口。';
const again = "There's an opening in the cliff behind the waterfall.\n\n瀑布后面的岩壁上有一处开口。";
const unseen = "You can't see that here.\n\n你在这里看不到那个东西。";

export function parseWaterfallObservation(text) {
  if (/^(?:look behind (?:the )?(?:waterfall|water)|(?:细看|观察|察看|查看|检查)(?:瀑布|水幕|水帘)(?:背后|后方|后面))$/.test(text))
    return {type:'simple',verb:'search',noun:'waterfall'};
  if (/^(?:look through (?:the )?waterfall|透过水帘看)$/.test(text))
    return {type:'simple',verb:'look_through',noun:'waterfall'};
  if (/^look through (?:the )?opening$/.test(text))
    return {type:'simple',verb:'examine',noun:'opening'};
  if (/^(?:touch (?:the )?(?:waterfall|water)|(?:摸|触摸)(?:瀑布|水幕|水))$/.test(text))
    return {type:'simple',verb:'touch',noun:'waterfall'};
  return null;
}

export function freeWaterfallObservation(s, command) {
  if (!command) return null;
  if (s.room === 'under_cliff' && command.dir === 'in') return "You can't go that way.\n\n你不能往那个方向走。";
  if (s.room !== 'waterfall') return null;
  if (command.verb === 'examine' && falls.includes(command.noun)) return waterDescription;
  if (s.hasFlag(found)) return null;
  if (command.dir === 'w') return 'The waterfall blocks your path.\n\n水幕挡住了去路。';
  if (opening.includes(command.noun)) return unseen;
  return null;
}

export function withWaterfallDiscovery(room) {
  return {...room,
    exits(s) {
      const exits = room.exits(s);
      if (s.hasFlag(found)) exits.w = {
        to:'ice_cavern',
        text:'You edge around the curtain of water.\n\n你侧身绕过了水帘。',
      };
      return exits;
    },
    events:[
      {id:'waterfall_look_through',match:{verb:['look_through'],noun:falls},text:waterDescription},
      {id:'waterfall_enter_stream',match:{verb:['enter'],noun:falls},
        text:'One touch of the frigid water changes your mind.\n\n你刚碰到冰冷的水，就打消了这个念头。'},
      {id:'waterfall_touch_stream',match:{verb:['touch'],noun:falls},text:'The water is very cold.\n\n水冰凉刺骨。'},
      {id:'inspect_waterfall_back',match:{verb:['search'],noun:falls},act(s,e) {
        e.print(s.hasFlag(found) ? again : first);
        s.setFlag(found);
      },text:''},
      {id:'waterfall_examine_opening',match:{verb:['examine'],noun:opening},when:s=>s.hasFlag(found),
        text:"Little can be seen from where you're standing.\n\n从你站的地方看不清里面。"},
      {id:'waterfall_enter_opening',match:{verb:['enter'],noun:opening},when:s=>s.hasFlag(found),
        async act(s,e) { await e._handleDirection('w'); },text:''},
      ...room.events,
    ],
  };
}

export function withCliffWall(room) {
  return {...room,exits(s) {
    const {in: obsolete, ...paths} = room.exits(s);
    return paths;
  }};
}

export function withWaterfallCavern(room) {
  const fromOldCliffSave = s => s.room === 'ice_cavern' && !s.hasFlag(found);
  const outside = {
    to:'waterfall',
    text:'You edge your way around the waterfall.\n\n你侧身绕过瀑布，回到了岸边。',
  };
  return {...room,
    desc:s=>!fromOldCliffSave(s)
      ? "You're in a vast underground cavern, cold enough to see your breath. Icicles on the ceiling glitter in the light shining in through an opening in the east wall. Beyond it, a curtain of water fills the cavern with its splashing roar.\n\n地下洞穴十分宽广，冷得连呼出的气都看得见。光从东壁的开口照进来，映得洞顶的冰锥闪闪发亮。开口外垂着一道水帘，飞溅的水声响彻洞穴。"
      : room.desc(s),
    exits:s=>!fromOldCliffSave(s) ? {e:outside,out:outside} : room.exits(s),
  };
}
