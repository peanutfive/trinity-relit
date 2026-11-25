import { ferryView, startFerry } from './ferry-state.js';
import { leaveFerry, payFare, waitForFerry } from './ferry-voyage.js';

const dory = ['dory','boat','平底船','渡船','船'];
const oarsman = ['oarsman','boatman','ferryman','船夫','摆渡人'];
const boatNouns = [...dory,'in dory','in the dory','in boat','in the boat'];
const visible = state => ferryView(state).visible;

function board(state, engine) {
  const {phase,onboard,docked} = ferryView(state);
  if (onboard) return engine.print("You're already in the dory.\n\n你已经在船上了。");
  if (!docked) return engine.print("You couldn't do that from where you're standing.\n\n你站在这里够不到船。");
  if (state.room === 'sand_bar') return engine.print('The oarsman shakes his head (a bit sadly, perhaps), and pushes you away from the dory.\n\n船夫摇了摇头，似乎有些难过，把你从船边推开。');
  engine.print(phase === 2 ? 'The dory tips alarmingly as you climb aboard.\n\n你爬上平底船，船身猛地一歪。'
    : 'The dory tips alarmingly as you climb aboard; one of the shades is nearly thrown out.\n\n你爬上平底船，船身猛地一歪，差点把一个幽魂掀出去。');
  if (!state.wearing('shroud')) {
    if (state.hasFlag('river_ferry_shorts_seen')) return engine.print('The oarsman recognizes your vacation shorts and kicks you off his dory again.\n\n船夫认出了你的度假短裤，又一次将你踢下了船。');
    state.setFlag('river_ferry_shorts_seen');
    return engine.print('The oarsman stares at your London vacation shorts with barely concealed outrage. He makes a broad gesture with his oar, inviting you to debark at your earliest convenience; a well-placed kick sends you on your way.\n\n船夫盯着你这条在伦敦度假时穿的短裤，几乎掩饰不住怒意。他大幅挥桨，请你尽快下船，随后一脚把你送上了岸。');
  }
  state.setFlag('river_ferry_onboard');
  state.setCnt('river_ferry_board_turn',state.turns);
  state.setCnt('river_ferry_patience',2);
  engine.print("The oarsman glances at the burial shroud you're wearing with silent approval, and stretches out his skeletal hand expectantly.\n\n船夫扫了一眼你披着的裹尸布，默许地点点头，期待地伸出一只枯骨般的手。");
}

const fareItems = [
  {id:'silver_coin',name:'silver coin',cn:'银币'},
  {id:'credit_card',name:'credit card',cn:'信用卡'},
  {id:'spade',name:'spade',cn:'铲子'},
];

function offer(item, showing) {
  return async (state, engine) => {
    const {id,name,cn} = item;
    if (state.inPocket(id)) {
      state.take(id);
      engine.print('[taking the '+name+' out of your pocket first]\n\n[你先从口袋里取出了'+cn+']');
    }
    if (!state.carrying(id)) {
      return engine.print(state.inRoom(id) ? "You're not holding a "+name+'.\n\n你手里没有'+cn+'。'
        : "You're not holding that.\n\n你手里没有那个东西。");
    }
    if (!ferryView(state).onboard) return engine.print("You'd have to get in the dory to do that.\n\n你得先上船，才能把东西递过去。");
    if (id === 'silver_coin') return payFare(state, engine, showing);
    const action = showing ? 'confiscates' : 'accepts';
    if (id === 'credit_card') {
      state.destroy(id);
      return engine.print('The oarsman '+action+' the credit card and checks it against a list of delinquent accounts. He shakes his head solemnly, rips the card in half and throws the pieces in the river.\n\n船夫收下信用卡，对照欠款名单查了一遍。他郑重地摇摇头，把卡撕成两半，扔进河里。');
    }
    state.drop(id);
    engine.print('The oarsman '+action+' the '+name+', glances at it briefly and tosses it onto the shore.\n\n船夫收下'+cn+'，瞟了一眼，随手扔回岸上。');
  };
}

export const ferryObservations = [
  {id:'river_examine_dory',match:{verb:['examine','look'],noun:boatNouns},when:visible,
    text:'The dory is quite large, and of ancient design.\n\n这艘平底船很大，式样古老。'},
  {id:'river_examine_oarsman',match:{verb:['examine'],noun:oarsman},when:visible,
    act(state,engine) {
      state.setFlag('river_oarsman_recognized');
      engine.print("The oarsman's face and form are concealed under a hooded cloak. His bent posture suggests great age, but he handles his vessel with a firm, confident hand that commands respect.\n\n船夫的面容和身形都藏在带兜帽的斗篷下。看他佝偻的身姿，想必已上了年纪，可他操起船来依然沉稳自若，令人肃然起敬。");
    },text:''},
];

export const ferryEvents = [
  ...ferryObservations,
  {id:'river_board_dory',match:{verb:['enter','ride'],noun:dory},when:visible,act:board,text:''},
  {id:'river_leave_dory',match:{verb:['exit'],noun:dory},when:visible,act(state,engine) {
    if (ferryView(state).onboard) leaveFerry(state,engine);
    else engine.print("You're not in the dory.\n\n你没有在船上。");
  },text:''},
  ...fareItems.flatMap(item => ['give','show'].map(verb => ({
    id:'river_'+verb+'_'+item.id,match:{verb:[verb],noun:[item.id,item.name,item.cn],noun2:oarsman},
    when:visible,act:offer(item,verb==='show'),text:'',
  }))),
];

// The interpreter rejects invisible nouns before spending a move.
export function unseenFerryTarget(command) {
  if (oarsman.includes(command.noun) || oarsman.includes(command.noun2)) return 'oarsman';
  if (boatNouns.includes(command.noun)) return 'dory';
}

const WATER = 'The water is unnaturally dark and still; ribbons of mist coil across its surface like ghostly fingers, obscuring what lies beyond.';
const PATHS = "Footpaths wander north, west and northwest. Turning south, you see a magnificent hedge growing in an unbroken wall to the river's edge.";
export function withFerryShore(room) {
  return {
    ...room,
    desc(state) {
      const aboard = ferryView(state).onboard;
      return (aboard ? "You're in a dory beside a great river." : "You're on a lifeless strip of sand beside a great river.")+' '+WATER+'\n\n'+PATHS+'\n\n'
        +(aboard?'你身在大河边的一艘平底船上。':'你站在大河边一片毫无生气的沙地上。')+'河水黑得出奇，静得出奇。缕缕雾气像鬼魅的手指，蜷曲在水面上，遮住了彼岸。\n\n小路分别蜿蜒向北、西和西北。往南看去，一道高大的树篱绵延至河边，中间没有缺口。';
    },
    exits(state) {
      const routes = room.exits(state);
      if (ferryView(state).onboard) return {};
      if (ferryView(state).legacyPaid) routes.in = {to:'islet'};
      else delete routes.in;
      return routes;
    },
    onEnter(state, engine) {
      if (startFerry(state)) engine.print('As you peer across the river you notice a lone vessel gliding out of the fog.\n\n你向河对岸望去，发现一艘孤零零的船正从雾中滑出。');
    },
    onWait:waitForFerry,
    events:[...ferryEvents,...room.events],
  };
}
