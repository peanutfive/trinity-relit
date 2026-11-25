import {prologueEndingTransition} from './prologue-ending-story.js';

// These endings use the original terminal River, separate from the
// navigable Wabe shore. Reading these pages never boards a boat or spends a coin.
export const RANCH_RIVER_ENDING = 'ranch_terminal_river';
const bitten = 'ranch_snake_bitten';
const biteTurn = 'ranch_snake_bite_turn';
const rooms = new Set(['assembly_room', 'closet', 'front_deck', 'nw_room', 'se_room']);

const shore = "You're on a lifeless strip of sand beside a great river. The water is unnaturally dark and still; ribbons of mist coil across its surface like ghostly fingers, obscuring what lies beyond.\n\n你站在大河边一片毫无生气的沙地上。河水黑得出奇，静得出奇。缕缕雾气像鬼魅的手指，蜷曲在水面上，遮住了彼岸。";
const boat = 'As you peer across the river you notice a lone vessel gliding out of the fog. You can make out a dark oarsman at the stern.\n\n你向河对岸望去，发现一艘孤零零的船正从雾中滑出。你依稀看见船尾立着一个黑黢黢的船夫。';
const finalLight = ' You jam your hands over your eyes in the awful glare; never see the fireball closing in at many times the speed of sound; and never feel the stellar heat that annihilates much of the state of New Mexico.';
const finalLightCn = '可怕的强光刺得你双手捂住眼睛。你没有看到以数倍音速逼近的火球，也没有感受到那吞噬了新墨西哥州大半土地的恒星般的炽热。';

function hasFlag(state, name) {
  return state.hasFlag?.(name) ?? state.flags?.has?.(name) ?? state.flags?.includes?.(name) ?? false;
}

export function ranchCollapseDue(state) {
  return !state.dead && state.chapter === 'ranch' && rooms.has(state.room)
    && hasFlag(state, bitten) && (state.counters?.[biteTurn] ?? 0) < state.turns;
}

function sceneIntro(room) {
  let en = 'Minutes later, the windows are filled with light of startling intensity!';
  let cn = '几分钟后，窗户里满是强得惊人的光！';
  if (room === 'front_deck') {
    en = 'Minutes later, the desert around you disappears in a flash of startling brilliance!';
    cn = '几分钟后，一道极其耀眼的闪光吞没了你周围的沙漠！';
  } else if (room === 'closet') {
    en = 'Minutes later, the cracks in the north wall are filled with light of startling intensity!';
    cn = '几分钟后，北墙的裂缝里满是强得惊人的光！';
  }
  return en + finalLight + '\n\n' + cn + finalLightCn;
}

function finalPassage(state) {
  const hasCoin = ['inventory','pocket','worn'].includes(state.itemLoc?.silver_coin);
  const fare = hasCoin ? 'your silver coin' : "a silver coin you didn't know you had";
  const fareCn = hasCoin ? '自己的银币' : '一枚连自己都不知道带在身上的银币';
  return 'The oarsman guides his dory to a soundless landing. Something in the way he crooks his skeletal finger compels you to board. You surrender '
    + fare + ', take a seat and wait patiently for your first glimpse of the opposite shore.\n\n'
    + '船夫把平底船悄无声息地靠了岸。他弯起枯骨般的手指招了招，你不由自主地登上船。你交出'
    + fareCn + '，坐下来，耐心地等着对岸第一次映入眼帘。';
}

function rankFor(score) {
  if (score < 15 || score >= 100) return {en:'TOURIST',cn:'游客'};
  if (score < 50) return {en:'EXPLORER',cn:'探索者'};
  return {en:'HISTORIAN',cn:'历史学家'};
}

export function riverEndingResult(before, after) {
  if (!before || !after || before.dead || !after.dead) return null;
  let transition=prologueEndingTransition(before,after);
  if (!transition && before.chapter==='ranch' && after.chapter==='ranch'
    && hasFlag(before,bitten) && hasFlag(after,RANCH_RIVER_ENDING) && rooms.has(after.room)) {
    transition={cause:'ranch',intro:sceneIntro(after.room)};
  }
  if (!transition) return null;
  const score = after.score, turns = transition.cause==='ranch' ? before.turns : after.turns;
  const maxScore = 100, rank = rankFor(score);
  const pointWord = score === 1 ? 'point' : 'points';
  const moveWord = turns === 1 ? 'move' : 'moves';
  const summary = '[Your score is ' + score + ' ' + pointWord + ' out of 100, in ' + turns + ' ' + moveWord
    + '. This gives you the rank of ' + rank.en + '.]\n\n[你在 ' + turns + ' 回合中获得了 '
    + score + ' 分，满分 100 分。你获得了「' + rank.cn + '」的称号。]';
  return {...transition, pages:[shore, boat, finalPassage(after)], score, turns, maxScore, rank, summary};
}

export function riverEndingLead(output, result) {
  const lines=output.filter(line=>!line.trimStart().startsWith('你死了。'));
  if (result.cause==='ranch') return [...lines,result.intro];
  // The shared park finale already starts an abbreviated River scene. The
  // lake refusal can also contain the scene change in the same text entry.
  const firstSentence=result.intro.split('\n\n')[0];
  const body=[];
  for (const line of lines) {
    const index=line.indexOf(firstSentence);
    if (index>=0) {
      const preceding=line.slice(0,index).trimEnd();
      if (preceding) body.push(preceding);
      break;
    }
    if (line.trimStart().startsWith(shore.split('. ')[0])) break;
    body.push(line);
  }
  return [...body,result.intro];
}
