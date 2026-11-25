import { initializeShadow, setShadowSymbol, vertexShadowView } from './islet-shadow.js';

const names=['','first','second','third','fourth','fifth','sixth','seventh'];
const digits='〇一二三四五六七';
const numberCn = n => '第'+digits[n]+'个符号';

export function readVertexShadow(s) {
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
  if (vertexShadowView(state).leverUp===up) return engine.print('The lever is moved '+(up?'up':'down')+' as far as it can go.\n\n拉杆已经'+(up?'升到顶':'压到底')+'了。');
  if(up) state.setFlag('vertex_lever_up');
  else state.clearFlag('vertex_lever_up');
  engine.print(up?'As you raise the lever you hear a loud, mechanical groan below your feet. The floor lurches and begins to vibrate again; you feel a momentary dizziness, and a brief gust of wind. Then all is still.\n\n你抬起拉杆，脚下响起一阵沉重的机械呻吟。地板猛地一晃，又开始振动。一阵风掠过，你只觉眼前一晕，随后四周重归寂静。':'As you lower the lever you hear a loud, mechanical groan below your feet. The floor lurches and stops vibrating; you feel a momentary dizziness, and a brief gust of wind. Then everything is quiet.\n\n你压下拉杆，脚下响起一阵沉重的机械呻吟。地板猛地一晃，振动停了。一阵风掠过，你只觉眼前一晕，随后一切归于平静。');
}

export function withVertexShadow(room) {
  const ring=['ring','brass ring','符号环','铜环'];
  const lever=['lever','metal lever','拉杆','长杆'];
  const events=[
    {id:'examine_sundial_vertex',match:{verb:['examine'],noun:['sundial','dial','日晷']},text:readVertexShadow},
    {id:'vertex_read_shadow',match:{verb:['examine'],noun:['shadow','shadow tip','影子','影尖']},text:readVertexShadow},
    {id:'vertex_read_gnomon',match:{verb:['examine'],noun:['gnomon','指针']},text:"It's a triangular piece of metal, about a quarter-inch thick and four inches long, screwed into the center of the sundial.\n\n这是一片三角形金属，约四分之一英寸厚、四英寸长，用螺钉固定在日晷中央。"},
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
