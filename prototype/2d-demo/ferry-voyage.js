import { ferryView } from './ferry-state.js';

export const REAPPEAR = 'The dory reappears out of the mist.\n\n那艘平底船又从雾里现了身。';
const LANDING = 'The oarsman guides his dory to a soundless landing.';
const DISEMBARK = 'One by one, the shades slink out of the vessel and drift across the sand like leaves on a breath of wind';
const disembarkCn = '幽魂一个个溜下船，飘过沙地，像被微风吹落的叶片。';
const passengers = 'The ghostly shades begin to converge on the dory. One by one, they step into the vessel, hand the oarsman a silver coin, and take a seat.\n\n幽魂向平底船聚拢。他们依次踏进船里，递给船夫一枚银币，坐了下来。';
const crowded = 'The last of the shades seats itself in the crowded dory.\n\n最后一个幽魂在挤满乘客的船里坐下。';

const riverBeats = {
  0:REAPPEAR,
  2:LANDING+'\n\nA puff of wind ripples the water.\n\nEddies of sand swirl across the shore and coalesce into ghostly figures of dust and vapor. Before you can think or move, you find yourself amid a gathering of human shades, pale and gaunt, silent as death.\n\n船夫驾着平底船悄然靠岸。一阵微风吹皱了水面。\n\n岸上的沙粒打着旋，在尘雾中凝成幢幢鬼影。还来不及反应，你已身处一群苍白消瘦、死一般沉寂的幽魂之间。',
  3:passengers, 4:crowded,
  5:'With practiced skill, the oarsman pushes his crowded dory away from the shore.\n\n船夫熟练地一撑，把这艘满载的小船推离河岸。',
  6:'You watch as the dory and its passengers glide across the river, vanishing at last into obscurity.\n\n你望着小船载着乘客滑过河面，最终消失在雾里。',
};
const sandBeats = {
  7:REAPPEAR,
  9:LANDING+'\n\n'+DISEMBARK+'.\n\n船夫驾着平底船悄然靠岸。'+disembarkCn,
  10:'With practiced skill, the oarsman pushes his empty dory away from the shore.\n\n船夫熟练地一撑，把空船推离沙岸。',
  11:'You watch as the dory and its navigator glide across the river, vanishing at last into obscurity.\n\n你望着船夫驾着小船滑过河面，最终消失在雾里。',
};

function announcePhase(state, engine, phase) {
  const river = state.room === 'the_river';
  if (!river && state.room !== 'sand_bar') return;
  if (phase === (river ? 1 : 8)) {
    const recognized = state.hasFlag('river_oarsman_recognized');
    state.setFlag('river_oarsman_recognized');
    engine.print(recognized ? 'The dory draws closer to the shore.\n\n平底船朝岸边驶近了。'
      : 'The dory draws closer to the shore. You can make out a dark oarsman at the stern.\n\n平底船朝岸边驶近了。你看清船尾有个黑衣船夫。');
  } else {
    const text = (river ? riverBeats : sandBeats)[phase];
    if (text) engine.print(text);
  }
}

// The original WAIT stops at the first local boat event or after four moves.
// LOOK and other ordinary actions still take a single move each.
export function waitForFerry(state) {
  const {started, onboard, fixedBerth} = ferryView(state);
  if (!started || onboard || fixedBerth) return;
  const river = state.room === 'the_river';
  const beats = river ? riverBeats : sandBeats;
  for (let extra=0; extra<3; extra++) {
    const next = (state.cnt('river_ferry_phase') + 1) % 12;
    if (next === (river ? 1 : 8) || beats[next]) break;
    state.setCnt('river_ferry_phase', next);
    state.turns++;
  }
}

export function leaveFerry(state, engine) {
  state.clearFlag('river_ferry_onboard');
  engine.print('You clamber out of the dory.\n\n你爬出了平底船。');
}

export function advanceFerry(state, engine) {
  if (!state.hasFlag('river_ferry_started') || state.cnt('river_ferry_start_turn') === state.turns || ferryView(state).fixedBerth) return;
  if (state.hasFlag('river_ferry_onboard')) {
    if (state.cnt('river_ferry_board_turn') === state.turns) return;
    if (state.cnt('river_ferry_patience') === 3) {
      state.setCnt('river_ferry_patience',2);
      return;
    }
    if (state.cnt('river_ferry_patience') === 2) {
      state.setCnt('river_ferry_patience', 1);
      engine.print('The oarsman stretches out his palm with growing impatience.\n\n船夫又伸出手掌，越发不耐烦了。');
      return;
    }
    state.clearFlag('river_ferry_onboard');
    engine.print('The oarsman points you in the direction of the shore. A swift kick encourages you to visit it quickly.\n\n船夫朝岸上一指，飞起一脚，催你赶紧过去。');
  }
  const next = (state.cnt('river_ferry_phase') + 1) % 12;
  state.setCnt('river_ferry_phase', next);
  announcePhase(state, engine, next);
}

export async function payFare(state, engine, showing) {
  if (!await engine.activateChapter('islet') || !engine.rooms.sand_bar) return;
  engine.print((showing ? 'The oarsman confiscates the silver coin' : 'The oarsman accepts the silver coin')+' and nods at you solemnly.\n\n船夫'+(showing?'收走':'接过')+'银币，向你郑重地点了点头。');
  const phase = state.cnt('river_ferry_phase');
  if (phase < 4) announcePhase(state, engine, phase + 1);
  state.destroy('silver_coin');
  state.clearFlag('river_ferry_onboard');
  state.setFlag('ferry_paid');
  state.setFlag('river_ferry_crossed');
  state.setCnt('river_ferry_phase',9);
  engine.print('The oarsman pushes away from the beach.\n\nPlanes of mist close in around the dory, drawing it deeper into the gloom. The only sound is the rhythmic slurp of the oar as it plies the dark, oily water.\n\n船夫将船撑离了沙滩。层层薄雾将船围住，把它引向更深的幽暗。只有桨划过漆黑油亮的水面，传来一声又一声的水响。');
  engine.print("A vague outline emerges beyond the helm. It slowly resolves into a spit of sand, damp and cheerless in the surrounding murk.\n\nThe oarsman swings the dory around and lands it with barely a jolt. "+DISEMBARK+". Something in the oarsman's gaze compels you to follow them.\n\n船头前浮出模糊的轮廓，渐渐显出一片沙洲，在雾气中阴冷潮湿。船夫掉转船头，船身几乎没有一颠就靠了岸。"+disembarkCn+'船夫的目光让你不由自主地跟上了他们。');
  await engine.transitionChapter({to:'islet',roomCandidates:['sand_bar']});
}
