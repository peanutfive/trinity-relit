import { initializeShadow, setShadowSymbol, vertexShadowView, vertexGnomonView, moorDoorHidden, VERTEX_SOCKET, VERTEX_DIAL } from './islet-shadow.js';

const names=['','first','second','third','fourth','fifth','sixth','seventh'];
const digits='〇一二三四五六七';
const numberCn = n => '第'+digits[n]+'个符号';

const hole=['hole','threaded hole','螺孔','孔'];
const needle=['gnomon','指针','日晷指针'];
const dial=['dial','sundial','日晷','表盘'];
const noLever="You can't see any lever here.\n\n这里看不到拉杆。";
const noGnomon="You can't see any gnomon here.\n\n这里看不到指针。";
const threadCN=thread=>thread==='left'?'左旋':'右旋';
const readableNeedle=s=>s.has('gnomon') || s.inRoom('gnomon') || vertexGnomonView(s).onDial;
const needGnomon=s=>readableNeedle(s) || vertexGnomonView(s).installed
  ? "You're not holding a gnomon.\n\n你手里没有指针。" : "You're not holding that.\n\n你手里没有那个东西。";

function readGroundShadow(s) {
  const {sector}=vertexShadowView(s);
  const directions=s.flipped?['east','northeast','north','northwest','west']:['west','northwest','north','northeast','east'];
  const cn={east:'东',northeast:'东北',north:'北',northwest:'西北',west:'西'};
  const toward=directions[sector<3?0:sector<5?1:sector<8?2:sector<10?3:4];
  return 'The long shadow stretches '+toward+' across the ground below.\n\n长长的影子在下方的地面上向'+cn[toward]+'延伸。';
}

function readHole(s) {
  if (vertexGnomonView(s).installed) return "You can't see that here.\n\n这里看不到它。";
  const thread=vertexGnomonView(s).holeThread;
  return 'The hole has a '+thread+'-handed thread, and is set in the center of the dial.\n\n表盘中央有一个'+threadCN(thread)+'螺纹孔。';
}

function readDial(s) {
  if(vertexGnomonView(s).controls) return readVertexShadow(s);
  const motto=s.flipped?'MURER XADE SUPMET':'TEMPUS EDAX RERUM';
  const base='The perimeter of the sundial is inscribed with seven curious symbols and a compass rose, with the legend "'+motto+'" emblazoned across the bottom. A threaded hole is set into the center of the dial.';
  const cn='日晷的盘沿刻着七个奇特的符号和一朵罗盘玫瑰，底部刻着“'+motto+'”。表盘中央有一个螺纹孔。';
  return vertexGnomonView(s).onDial ? base+' You also see a gnomon lying on top.\n\n'+cn+'盘面上还躺着一枚指针。' : base+'\n\n'+cn;
}

function install(s,engine) {
  if(!s.carrying('gnomon')) return engine.print(needGnomon(s));
  const {holeThread,boltThread}=vertexGnomonView(s);
  if(holeThread!==boltThread) return engine.print("You twist and push the gnomon into the hole on the sundial, but it doesn't seem to fit very well. A quick glance shows the reason why. The thread on the bolt doesn't match the thread in the dial's hole.\n\n你把指针按进日晷的小孔，边推边拧，却怎么也装不进去。仔细一看，底部螺栓的螺纹和孔里的螺纹对不上。");
  s.moveItem('gnomon',VERTEX_SOCKET);
  s.clearFlag('vertex_legacy_controls');
  s.setFlag('vertex_lever_up');
  engine.print('You screw the gnomon into the hole on the sundial.\n\n你把指针拧进了日晷上的螺孔。');
  engine.print('A long metal lever silently rises out of the floor. As it clicks to a stop, the ring around the sundial emits a brilliant twinkle of light.\n\n一根长长的金属拉杆从地板上无声地升起。它咔嗒一声停住，日晷周围的铜环闪过一道耀眼的光。');
  if(!s.hasFlag('vertex_gnomon_scored')){
    s.setFlag('vertex_gnomon_scored');
    s.addScore(5);
    engine.print('[Your score just went up by 5 points. The total is now '+s.score+' out of 100.]\n\n[你的得分增加了 5 分，现在是 '+s.score+' 分，满分 100 分。]');
  }
}

function unscrew(s,engine) {
  if(!vertexGnomonView(s).installed) return engine.print(readableNeedle(s)?"You can't unscrew the gnomon.\n\n这枚指针没有拧在表盘上。":noGnomon);
  const up=vertexShadowView(s).leverUp;
  s.moveItem('gnomon',VERTEX_DIAL);
  s.setFlag('vertex_lever_up');
  engine.print('You can feel the gnomon getting more and more wobbly as you unscrew it. A final twist, and it falls with a clatter onto the face of the sundial.\n\n你边拧边感觉指针越来越松。最后转一下，它当啷一声掉在日晷盘面上。');
  engine.print(up?'The brass ring twinkles again as the lever silently retracts into the floor.\n\n铜环又闪了一下，拉杆悄无声息地缩回地板。':'The brass ring twinkles again as the lever straightens itself and silently retracts into the floor.\n\n铜环又闪了一下，拉杆立直，悄无声息地缩回地板。');
}

function takeFromDial(s,engine) {
  if(s.carryCount()>=8) return engine.print("You're holding too much already.\n\n你拿不下更多东西了。");
  s.take('gnomon');
  engine.print('You take the gnomon off the sundial.\n\n你从盘面拿起指针。');
}
export function readVertexShadow(s) {
  if (!vertexGnomonView(s).controls) return readGroundShadow(s);
  const {symbol,sector,phase,centered,leverUp}=vertexShadowView(s);
  const mark='the '+names[symbol]+' symbol';
  const moving='The shadow appears to be drifting slowly ';
  const still='The shadow rests ';
  let en,cn;
  if(sector%2) {
    en=(leverUp ? moving : still)+'between the '+names[symbol]+' and '+names[symbol+1]+' symbols.';
    cn='影尖'+(leverUp?'正缓缓移过':'停在')+numberCn(symbol)+'与'+numberCn(symbol+1)+'之间。';
  } else if(leverUp) {
    en=moving+(centered?'across ':phase<5?'towards ':'away from ')+mark+'.';
    cn=centered?'影尖正缓缓掠过'+numberCn(symbol)+'。':phase<5?'影尖正缓缓移向'+numberCn(symbol)+'。':'影尖正缓缓移离'+numberCn(symbol)+'。';
  } else {
    en=still+(centered?'exactly on ':phase<5?'a bit before ':'a little after ')+mark+'.';
    cn=centered?'影尖恰好落在'+numberCn(symbol)+'上。':'影尖停在'+numberCn(symbol)+(phase<5?'前面一点。':'后面一点。');
  }
  return en+'\n\n'+cn;
}

function turn(state,engine,target) {
  initializeShadow(state);
  const symbol=target ?? state.sundialSymbol%7+1;
  if(!vertexGnomonView(state).controls) {
    if(target) return engine.print('The brass ring has no visible markings to use as a reference.\n\n铜环上没有能用来对准符号的标记。');
    setShadowSymbol(state,symbol);
    if(state.hasFlag('vertex_ring_turned')) return engine.print('The sun races across the sky as you casually spin the brass ring.\n\n你随手转动铜环，太阳飞快地掠过天空。');
    state.setFlag('vertex_ring_turned');
    return engine.print("You grasp the edges of the brass ring and begin to turn it.\n\nAn ominous vibration makes the platform tremble. Then a motion catches your eye.\n\nTHE SUN IS MOVING! It's arcing across the sky like a time-lapse movie, smooth and terribly silent.\n\nYou let go of the ring with a cry. The sun instantly stops, and the strange vibration with it.\n\n你抓住铜环边缘，开始转动。平台随之一阵不祥的震颤，有什么东西在动。太阳！它像延时电影里那样划过天际，平稳得出奇，四下一片死寂。你惊叫着松开手。太阳立刻停住了，震颤也随之停息。");
  }
  state.setFlag('vertex_ring_turned');
  const reading=vertexShadowView(state);
  // An approaching shadow already has the next mark's name, but the ring
  // only accepts that mark as its current stop once the shadow reaches it.
  if (target && reading.symbol===target && (reading.sector%2===1 || reading.phase>=5)) {
    state.sundialSymbol=target;
    return engine.print('The arrow on the ring is already pointing to the '+names[symbol]+' symbol.\n\n环上的箭头已经指着'+numberCn(symbol)+'了。');
  }
  setShadowSymbol(state,symbol);
  engine.print("The sun sweeps across the sky as you rotate the brass ring. It clicks into place at the dial's "+names[symbol]+' symbol.\n\n你转动黄铜环，太阳掠过天空。铜环咔嗒一声，在'+numberCn(symbol)+'处停稳。');
}

function moveLever(state,engine,up) {
  initializeShadow(state);
  if(!vertexGnomonView(state).controls) return engine.print(noLever);
  if (vertexShadowView(state).leverUp===up) return engine.print('The lever is moved '+(up?'up':'down')+' as far as it can go.\n\n拉杆已经'+(up?'升到顶':'压到底')+'了。');
  if(up) state.setFlag('vertex_lever_up');
  else state.clearFlag('vertex_lever_up');
  engine.print(up?'As you raise the lever you hear a loud, mechanical groan below your feet. The floor lurches and begins to vibrate again; you feel a momentary dizziness, and a brief gust of wind. Then all is still.\n\n你抬起拉杆，脚下响起一阵沉重的机械呻吟。地板猛地一晃，又开始振动。一阵风掠过，你只觉眼前一晕，随后四周重归寂静。':'As you lower the lever you hear a loud, mechanical groan below your feet. The floor lurches and stops vibrating; you feel a momentary dizziness, and a brief gust of wind. Then everything is quiet.\n\n你压下拉杆，脚下响起一阵沉重的机械呻吟。地板猛地一晃，振动停了。一阵风掠过，你只觉眼前一晕，随后一切归于平静。');
}

export function withVertexShadow(room) {
  const ring=['ring','brass ring','符号环','铜环'];
  const lever=['lever','metal lever','拉杆','长杆'];
  const events=[
    {id:'examine_sundial_vertex',match:{verb:['examine'],noun:dial},text:readDial},
    {id:'vertex_read_shadow',match:{verb:['examine'],noun:['shadow','shadow tip','影子','影尖']},text:readVertexShadow},
    {id:'vertex_examine_hole',match:{verb:['examine'],noun:hole},text:readHole},
    {id:'vertex_install_gnomon',match:{verb:['put','insert'],noun:needle,noun2:hole},act:install,text:''},
    {id:'vertex_rest_gnomon',match:{verb:['put'],noun:needle,noun2:dial},act(s,e){
      if(!s.carrying('gnomon')) return e.print(needGnomon(s));
      s.moveItem('gnomon',VERTEX_DIAL);
      e.print('You put the gnomon on the sundial.\n\n你把指针放在日晷的盘面上。');
    },text:''},
    {id:'vertex_unscrew_gnomon',match:{verb:['unscrew'],noun:needle},act:unscrew,text:''},
    {id:'vertex_wobble_gnomon',match:{verb:['take'],noun:needle},when:s=>vertexGnomonView(s).installed,
      text:'The gnomon on the dial wobbles loosely when you try to move it.\n\n你试着挪动指针，它只是在盘上晃了晃。'},
    {id:'vertex_lift_gnomon',match:{verb:['take'],noun:needle},when:s=>vertexGnomonView(s).onDial,act:takeFromDial,text:''},
    {id:'vertex_read_gnomon',match:{verb:['examine'],noun:needle},text:s=>{
      if(vertexGnomonView(s).installed) return "It's a triangular piece of metal, about a quarter-inch thick and four inches long, screwed into the center of the sundial.\n\n这是一片三角形金属，约四分之一英寸厚、四英寸长，拧在日晷中央。";
      return readableNeedle(s)?"It's a triangular piece of metal, about a quarter-inch thick and four inches long. A long bolt is welded to the bottom.\n\n这是一片三角形金属，约四分之一英寸厚、四英寸长。底部焊着一根长螺栓。":noGnomon;
    }},
    {id:'vertex_read_bolt',match:{verb:['examine'],noun:['bolt','thread','螺栓']},text:s=>{
      if(!readableNeedle(s)) return "You can't see that here.\n\n这里看不到它。";
      const thread=vertexGnomonView(s).boltThread;
      return 'The bolt has a '+thread+'-handed thread, and is firmly attached to the gnomon.\n\n螺栓上是'+threadCN(thread)+'螺纹，牢牢连着指针。';
    }},
    {id:'vertex_unmarked_ring',match:{verb:['examine'],noun:ring},when:s=>!vertexGnomonView(s).controls,
      text:"The brass ring fits perfectly around the dial's perimeter.\n\n黄铜环正好套在表盘边缘。"},
    {id:'vertex_retracted_lever',match:{verb:['examine'],noun:lever},when:s=>!vertexGnomonView(s).controls,text:noLever},
    {id:'examine_ring',match:{verb:['examine'],noun:ring},text:s=>"The brass ring fits perfectly around the dial's perimeter. It's inscribed with an arrow, which is pointing to the "+names[vertexShadowView(s).symbol]+' symbol on the dial.\n\n黄铜环正好套在表盘边缘，环上刻着一个箭头，指向盘上的'+numberCn(vertexShadowView(s).symbol)+'。'},
    {id:'vertex_examine_lever',match:{verb:['examine'],noun:lever},text:s=>vertexShadowView(s).leverUp?'The lever is about five feet long, and stands vertically out of the platform.\n\n这根拉杆约五英尺长，直直地从平台上竖起。':'The lever is about five feet long, and stands at a sharp angle to the platform.\n\n这根拉杆约五英尺长，斜斜地立在平台上。'},
    ...['pull','push'].map(verb=>({id:'vertex_'+verb+'_lever',match:{verb:[verb],noun:lever},act:(s,e)=>moveLever(s,e,verb==='pull'),text:''})),
    ...names.slice(1).map((name,i)=>({id:'vertex_ring_to_'+name,match:{verb:['turn'],noun:ring,noun2:[name+' symbol',numberCn(i+1)]},act:(s,e)=>turn(s,e,i+1),text:''})),
    {id:'turn_ring',match:{verb:['turn'],noun:ring},act:(s,e)=>turn(s,e),text:''},
  ];
  return {...room,
    desc:()=>'The temperature on this tiny platform is well below freezing. But it isn\'t just the cold that makes your teeth chatter when you look down that narrow stairway, thousands of feet high.\n\n这座小平台上冷得结冰。你低头望向高悬数千英尺的窄阶，两排牙齿直打战，也不全是因为冷。',
    events:[...events,...room.events.filter(e=>!['turn_ring','examine_ring','examine_gnomon_vertex','examine_sundial_vertex'].includes(e.id))],
  };
}

export function withVertexMoor(room) {
  return {...room,exits(s){
    const exits=room.exits(s);
    if(!moorDoorHidden(s)) return exits;
    const {in:missingDoor,...paths}=exits;
    return paths;
  },events:[{id:'moor_absent_door_after_gnomon',when:moorDoorHidden,
    match:{verb:['examine','open','enter'],noun:['door','white door','门','白门']},
    text:"You can't see any door here.\n\n这里看不到门。"},...room.events]};
}
