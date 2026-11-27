// The portable item has one location throughout. Before the log falls apart
// its location is internal, so generic inventory and light queries cannot see it.
const roomId='south_bog';
export const BOG_LOG_INTERIOR='bog_rotten_log';
const rules='bog_log_rules';
const scored='bog_splinter_scored';
const logNouns=['log','rotten log','splintered log','圆木','朽木','腐木','木头'];
const heapNouns=['heap','heap of damp corruption','腐木堆','朽木堆','碎屑堆'];
const pieceNouns=['splinter','shard','big splinter','木片','碎片','发光木片'];
const glow='Its edges flicker with the eerie phosphorescence of decay.\n\n木头的边缘闪烁着腐朽的幽微磷光。';
const remaining="All that's left of the log is a heap of damp corruption.\n\n圆木只剩一堆潮湿的腐屑。";

function flag(state,key) {
  return state.hasFlag?.(key) ?? state.flags?.has?.(key) ?? state.flags?.includes?.(key) ?? false;
}

export function bogLogView(state) {
  const location=state.itemLoc?.splinter;
  const intact=location===BOG_LOG_INTERIOR;
  return {intact,crumbled:!intact,looseSplinter:location===roomId};
}

export function initializeBogLog(state) {
  if (flag(state,rules)) return;
  if (state.itemAt('splinter')===roomId) state.moveItem('splinter',BOG_LOG_INTERIOR);
  state.setFlag(rules);
}

export function restoreBogLog(state,saved) {
  const visited=state.visited.has(roomId);
  const recorded=Object.hasOwn(saved.itemLoc ?? {},'splinter');
  // The shared engine backfills missing keys with starting locations. Do not
  // resurrect an omitted object after the player has already reached the bog.
  if (!recorded && (flag(state,rules) || visited)) delete state.itemLoc.splinter;
  if (flag(state,rules)) return;
  if (!visited && state.itemAt('splinter')===roomId) {
    initializeBogLog(state);
    return;
  }
  // Old revisited bog saves cannot distinguish an untouched loose splinter
  // from one put back on the ground. Keep its accessibility and prior score.
  state.setFlag(scored);
  state.setFlag(rules);
}

const moveLog='The log crumbles into a heap of damp corruption when you try to move it. Only a big splinter of wood remains.\n\n你试着搬动圆木，它便碎成一堆潮湿的腐屑，只留下一块大木片。';
const fullHands="You're holding too much already.\n\n你拿不下更多东西了。";

function takeSplinter(s,engine) {
  if (s.carryCount()>=8) { engine.print(fullHands);return; }
  s.take('splinter');
  engine.print('You pick up the splinter.\n\n你捡起了木片。');
  if (!flag(s,scored)) {
    s.setFlag(scored);s.addScore(1);
    engine.print('[Your score just went up by 1 point. The total is now '+s.score+' out of 100.]\n\n[你的得分增加了 1 分，现在是 '+s.score+' 分，满分 100 分。]');
  }
}

function description(state) {
  let english='The ground is damp and squishy underfoot, especially along the stream that wanders west and southeast between the black trees.';
  let chinese='脚下的泥地潮湿松软，尤其是那条蜿蜒穿过黑树林、流向西方和东南方的小溪两岸。';
  const view=bogLogView(state);
  if (view.intact) {
    english+='\n\nA splintered log lies rotting in the mist at your feet.\n\nIts edges flicker with the eerie phosphorescence of decay.';
    chinese+='\n\n一根裂开的圆木在你脚下的雾气中腐烂着。\n\n它的边缘闪烁着幽微的磷光。';
  } else if (view.looseSplinter) {
    english+="\n\nThere's a splinter (providing light) here.";
    chinese+='\n\n这里有一块木片，正发着光。';
  }
  return english+'\n\n'+chinese;
}

const initial=s=>bogLogView(s).intact;
const loose=s=>bogLogView(s).looseSplinter;

export function withBogLog(room) {
  const old=(room.events||[]).filter(event=>!['examine_log','examine_splinter'].includes(event.id));
  return {...room,desc:description,events:[
    {id:'examine_log',match:{verb:['examine'],noun:logNouns},when:initial,text:glow},
    {id:'touch_bog_log',match:{verb:['touch'],noun:logNouns},when:initial,
      text:'The log feels old and squishy.\n\n圆木摸起来陈腐而绵软。'},
    {id:'search_bog_log',match:{verb:['search'],noun:logNouns},when:initial,
      text:'The log is rotten with decay.\n\n木头已经朽烂了。'},
    {id:'move_bog_log',match:{verb:['move','take','push','pull'],noun:logNouns},when:initial,
      act(s){s.placeItem('splinter',roomId);},text:moveLog},
    {id:'examine_bog_heap',match:{verb:['examine'],noun:heapNouns},when:s=>!initial(s),
      text:"You don't see anything unusual about the heap of damp corruption.\n\n这堆潮湿的腐屑看上去没什么特别。"},
    {id:'handle_bog_heap',match:{verb:['take','touch','move','push','pull'],noun:heapNouns},when:s=>!initial(s),
      text:'It crumbles uselessly.\n\n它一碰就碎了。'},
    {id:'examine_splinter',match:{verb:['examine'],noun:pieceNouns},when:s=>loose(s)||s.has('splinter'),
      text:'The splinter is about a foot long. Its edges flicker with the eerie phosphorescence of decay.\n\n木片大约一英尺长，边缘闪烁着腐朽的幽微磷光。'},
    {id:'touch_bog_splinter',match:{verb:['touch'],noun:pieceNouns},when:s=>loose(s)||s.has('splinter'),
      text:'The splinter feels old and squishy.\n\n木片摸起来陈腐而绵软。'},
    {id:'take_splinter_from_bog_heap',match:{verb:['take'],noun:pieceNouns,noun2:[...logNouns,...heapNouns]},when:loose,
      text:"The splinter isn't in the heap of damp corruption.\n\n木片不在那堆潮湿的腐屑里。"},
    {id:'take_bog_splinter',match:{verb:['take'],noun:pieceNouns},when:loose,act:takeSplinter,text:''},
    {id:'hold_bog_splinter',match:{verb:['take'],noun:pieceNouns},when:s=>s.carrying('splinter'),
      text:"You're already holding the splinter.\n\n木片已经在你手里了。"},
    {id:'drop_bog_splinter',match:{verb:['drop'],noun:pieceNouns},when:s=>s.carrying('splinter'),
      act(s){s.drop('splinter');},text:'You put down the splinter.\n\n你放下了木片。'},
    ...old
  ]};
}

export function freeBogAction(state,command) {
  if (state.room!==roomId || !['simple','compound'].includes(command?.type)) return null;
  const {noun}=command;
  const view=bogLogView(state);
  if (pieceNouns.includes(noun) && ['drop','put'].includes(command.verb) && !state.has('splinter')) {
    return "You're not holding that.\n\n你手里没有那件东西。";
  }
  if (command.type==='compound' && command.verb!=='take') return null;
  if (logNouns.includes(noun) && !view.intact) return remaining;
  if (heapNouns.includes(noun) && view.intact) return "You can't see any heap here.\n\n这里看不到腐木堆。";
  if (pieceNouns.includes(noun) && !view.looseSplinter && !state.has('splinter')) {
    return "You can't see any splinter here.\n\n这里看不到木片。";
  }
  return null;
}

// Only terms absent from the shared bilingual parser require adaptation.
export function parseBogAction(input) {
  const text=input.trim().toLowerCase();
  const en=text.match(/^(touch|feel|move) (?:the )?(.+)$/);
  const cn=text.match(/^(摸一摸|摸摸|触摸|轻触|摸|搬动|移动|搬一搬|搬)(.+)$/);
  const noun=en?.[2]||cn?.[2];
  if (![...logNouns,...heapNouns,...pieceNouns].includes(noun)) return null;
  const verb=en ? (en[1]==='move'?'move':'touch') : (/^(?:移动|搬)/.test(cn[1])?'move':'touch');
  return {type:'simple',verb,noun};
}
