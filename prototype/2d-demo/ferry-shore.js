const dory = ['dory','boat','平底船','渡船','船'];
const oarsman = ['oarsman','boatman','船夫','摆渡人'];
const silver = ['silver coin','silver_coin','银币'];

function offerSilverFromShore(state, engine) {
  if (state.inPocket('silver_coin')) {
    state.take('silver_coin');
    engine.print('[taking the silver coin out of your pocket first]\n\n[你先从口袋里取出了银币]');
  }
  if (state.carrying('silver_coin')) {
    engine.print("You'd have to get in the dory to do that.\n\n你得先上船，才能把银币递过去。");
  } else if (state.inRoom('silver_coin')) {
    engine.print("You're not holding a silver coin.\n\n你手里没有银币。");
  } else {
    engine.print("You're not holding that.\n\n你手里没有那个东西。");
  }
}

export function withFerryShore(room) {
  function boatInView(state) {
    if (state.room !== 'the_river') return false;
    const route = room.exits(state).in;
    return route?.to === 'islet' && (!route.when || route.when(state));
  }
  const events = [
    {
      id:'river_examine_dory',match:{verb:['examine','look'],noun:[...dory,'in dory','in the dory','in boat','in the boat']},
      when:boatInView,
      text:'The dory is quite large, and of ancient design.\n\n这艘平底船很大，式样古老。',
    },
    {
      id:'river_examine_oarsman',match:{verb:['examine'],noun:oarsman},when:boatInView,
      act(state,engine) {
        state.setFlag('river_oarsman_recognized');
        engine.print("The oarsman's face and form are concealed under a hooded cloak. His bent posture suggests great age, but he handles his vessel with a firm, confident hand that commands respect.\n\n船夫的面容和身形都藏在带兜帽的斗篷下。看他佝偻的身姿，想必已上了年纪，可他操起船来依然沉稳自若，令人肃然起敬。");
      },text:'',
    },
    {
      id:'river_offer_silver_coin',match:{verb:['give','show'],noun:silver,noun2:oarsman},when:boatInView,
      act:offerSilverFromShore,text:'',
    },
  ];
  return {...room,events:[...events,...room.events]};
}
