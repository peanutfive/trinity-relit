import {arborLight} from './arbor-light-state.js';

const top='top_of_arbor', garden='arboretum', entrySide='arbor_entry_side';
const sculpture=['sculpture','sparkling sculpture','bottle','crystal','crystalline bottle','雕塑','水晶','水晶瓶'];
const base=['inscription','words','base','date','dates','铭文','底座','题字'];
const dark="It's too dark to see.\n\n太黑了，看不见。";
export const unlitArbor="It's completely dark.\n\n四周一片漆黑。";
const ascent='The floor twists alarmingly as you continue your ascent.\n\n你继续往上走，脚下的地面竟扭转起来，令人心惊。';
const descent='The floor twists alarmingly as you descend.\n\n你往下走时，脚下的地面竟扭转起来，令人心惊。';
const paths='Dark, leafy tunnels curve down to the north and south.\n\n两条幽暗的枝叶隧道分别向北、向南弯下去。';
const seen='arbor_sculpture_examined';

function inscription(state) {
  const letters=state.flipped ? '5291-9481 NIELK XILEF' : 'FELIX KLEIN 1849-1925';
  return ['The words '+letters+' are inscribed on the base.','底座上刻着「'+letters+'」。'];
}

function describeSculpture(state) {
  const [inscribed,cn]=inscription(state);
  return "The sparkling sculpture looks like a crystalline bottle, eight feet high, with a polished surface that twists in impossible curves. It's hard to tell where the outside of the sculpture ends and the inside begins.\n\n"
    +inscribed+'\n\n这座闪闪发光的雕塑看上去像一个八英尺高的水晶瓶。光洁的瓶身盘绕出不可思议的曲线，叫人分不清外壁在哪里结束，内壁又从哪里开始。\n\n'+cn;
}

function describeGarden(state) {
  const [inscribed,cn]=inscription(state);
  return 'A spectacular pergola of arborvitaes arches over your head like a great green Ferris wheel. Its tangled surfaces are peculiarly twisted, making it difficult to tell where the inside ends and the outside begins.\n\n'
    +'Steep, leafy tunnels curve up into the pergola to the north and south. Other paths lead east and west, into the surrounding hedge.\n\n'
    +'An abstract sparkling sculpture stands between the tunnels. '+inscribed+'\n\n'
    +'崖柏织成的凉亭像一座巨大的绿色摩天轮，拱立在你头顶。纠结的表面扭成奇异的形状，内外很难分辨。\n\n陡峭的枝叶隧道从南北两侧盘入凉亭。另有两条小径通向东西两边的树篱。\n\n两条隧道之间立着一座闪闪发光的抽象雕塑。'+cn;
}

function describeTop(state) {
  const light=arborLight(state);
  if (!light) return unlitArbor;
  const lamp=light==='lantern';
  const en=lamp?'faltering glow of the lantern':'flickering light of the splinter';
  const cn=lamp?'灯笼忽明忽暗的光':'木片闪烁的微光';
  const [routes,cnRoutes]=paths.split('\n\n');
  let item='',cnItem='';
  if(state.itemLoc?.axe===top) {
    const moved=state.hasFlag?.('arbor_axe_moved') ?? state.flags?.includes?.('arbor_axe_moved');
    item=moved?"\n\nThere's an axe here.":'\n\nAn arborvitae is cleaved by a silver axe.';
    cnItem=moved?'\n\n这里有一把斧头。':'\n\n一把银斧嵌在一株崖柏上。';
  }
  return 'The tangled vines and tendrils seem to writhe malignantly in the '+en+'. The air is pungent with the odor of arborvitaes.\n\n'
    +routes+item+'\n\n在'+cn+'里，纠缠的藤条和卷须仿佛在恶狠狠地扭动。空气里满是刺鼻的崖柏气味。\n\n'+cnRoutes+cnItem;
}

function fromGarden(dir) {
  const north=dir==='n';
  return {to:north?'north_arbor':'south_arbor',act:s=>s.setCnt(entrySide,north?1:2),
    text:north?'You ascend the north side of the pergola.\n\n你沿凉亭北侧往上走。':'You ascend the south side of the pergola.\n\n你沿凉亭南侧往上走。'};
}

function slope(room,side) {
  const up={to:top,text:ascent};
  const down={to:garden,text:descent,act(state){
    // A mid-ascent save from the former shortcut contains no entry side.
    // Keep its saved handedness until the next complete trip through the arbor.
    const entered=state.cnt(entrySide);
    if (entered && entered!==side) state.flipped=!state.flipped;
    state.setCnt(entrySide,0);
  }};
  return {...room,
    desc:()=>'The "floor" of the pergola curves up and around in an inexplicable way that makes your eyes cross. It seems as if you\'d be standing on your head if you went much higher. Little daylight makes its way through the thick walls of arborvitae.\n\n凉亭的「地板」朝上盘旋，弯得让人眼花。要是再爬高一点，你似乎就得头朝下站着了。日光几乎透不进厚厚的崖柏树墙。',
    exits:()=>({u:up,d:down,in:up,out:down})};
}

export function withArborRooms(rooms) {
  return {...rooms,
    trellises:{...rooms.trellises,
      desc:()=>'A fortresslike wall of arborvitae stretches east and west through the forest. The only breach is an identical pair of arched trellises.\n\nA mountain stream trickles between the trees. Paths wander from its banks in many directions.\n\n一道堡垒般的崖柏墙横贯林间，唯一的缺口是两座一模一样的拱形棚架。\n\n一条山溪从树间淌过，小径从两岸伸向四面八方。',
      exits(s){const {u,...ground}=rooms.trellises.exits(s);return ground;}},
    arboretum:{...rooms.arboretum,desc:describeGarden,
      exits:()=>({n:fromGarden('n'),s:fromGarden('s'),e:'arborvitaes_n',w:'arborvitaes_s'}),
      events:[{id:'observe_arbor_sculpture',match:{verb:['examine'],noun:sculpture},text:describeSculpture},
        {id:'read_arbor_inscription',match:{verb:['read'],noun:[...sculpture,...base]},text:s=>inscription(s).join('\n\n')},
        ...(rooms.arboretum.events||[])]},
    north_arbor:slope(rooms.north_arbor,1),
    south_arbor:slope(rooms.south_arbor,2),
    top_of_arbor:{...rooms.top_of_arbor,desc:describeTop,exits:()=>({n:'north_arbor',s:'south_arbor'}),
      onEnter(s,eng){eng.print('Your sense of direction is very confused.\n\n你完全分不清方向了。');}}
  };
}

const whichWay={
  d:'[Which way do you want to go down?]\n\n[你想往哪边下去？]',
  out:'[Which way do you want to go out?]\n\n[你想往哪边出去？]',
  in:'[Which way do you want to go in?]\n\n[你想往哪边进去？]'
};

export function freeArborAction(state, command, items) {
  if (!command || state.chapter!=='wabe') return null;
  const {room}=state, dir=command.dir, noun=command.noun;
  if (room===garden) {
    if(command.verb==='examine' && sculpture.includes(noun) && !state.hasFlag(seen)) {
      state.setFlag(seen);
      return {text:describeSculpture(state),save:true};
    }
    if (dir==='u') return {text:'[Which way do you want to go up, north or south?]\n\n[你想从北边还是南边上去？]'};
    if (dir==='in') return {text:'[Which way do you want to go in, north or south?]\n\n[你想从北边还是南边进去？]'};
    if (dir==='out') return {text:whichWay.out};
    if (['ne','nw','se','sw'].includes(dir)) return {text:'The hedge blocks your path.\n\n树篱挡住了去路。'};
  }
  if (room==='trellises' && dir==='u') return {text:"You can't go that way.\n\n你不能往那个方向走。"};
  if ((room==='north_arbor'||room==='south_arbor') && dir) {
    if (dir==='n'||dir==='s') return {text:'You can only go up or down from here.\n\n在这里只能向上或向下走。'};
    if (!['u','d','in','out'].includes(dir)) return {text:'Arborvitaes block your path.\n\n崖柏挡住了去路。'};
  }
  if (room!==top) return null;
  const lit=arborLight(state);
  if (['d','in','out'].includes(dir)) return {text:whichWay[dir]};
  if (dir==='u') return {text:"There's no exit that way.\n\n那边没有出口。"};
  if(dir && dir!=='n' && dir!=='s') return {text:lit?'Arborvitaes block your path.\n\n崖柏挡住了去路。':'Something bushy blocks your path.\n\n一丛灌木似的东西挡住了去路。'};
  if (!lit && (command.cmd==='look' || ['examine','read','look','search'].includes(command.verb))) return {text:dark};
  if (!lit && command.verb==='take') {
    const held=Object.keys(state.itemLoc).some(id=>state.has(id) && (id===noun || items[id]?.aliases?.includes(noun)));
    if (!held) return {text:dark};
  }
  if (lit && ['examine','take','read'].includes(command.verb) && sculpture.includes(noun)) {
    const label=({'雕塑':'sculpture','水晶':'crystal','水晶瓶':'crystalline bottle'})[noun] || noun;
    const cn=label==='crystal'?'水晶':label.includes('bottle')?'瓶子':'雕塑';
    return {text:"You can't see any "+label+' here.\n\n你在这里看不到'+cn+'。'};
  }
  return null;
}
