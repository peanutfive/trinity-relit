// Display adaptation only. Original descriptions and inspect/event prose remain
// in the chapter modules; suppress exact, reviewed presence statements only
// when their corresponding object is genuinely rendered in this scene.
const rule=(id,rooms,kinds,en,cn)=>({id,rooms:rooms.split('|'),kinds:kinds.split('|'),paragraphs:[en,cn]});
export const VISUAL_PRESENCE_RULES=Object.freeze([
  {when:context=>!context.lanternLit,...rule('underwater-lantern-phrase','underwater','passage',
    'Suspended particles of muck swirl in the beam of the lantern.','悬浮的污泥颗粒在灯笼光束里旋转。'),sentence:true},
  {...rule('bedroom-mattress-mark','bedroom','ranch_floor_mark',
    'Only a rectangular area in the corner, lighter than the floor around it, belies the former presence of a mattress.',
    '只有角落里一块比周围地板颜色浅的矩形区域，表明这里曾放过床垫。'),sentence:true},
  rule('spare-room-hanging-map','spare_room','ranch_wall_map','A large map is hanging on the wall.','墙上挂着一幅大地图。'),
  rule('windmill-binoculars-presence','windmill','binoculars',
    "Somebody has left a nice pair of binoculars at the landing's edge.",'有人把一副不错的双筒望远镜留在了木台边缘。'),
  {...rule('tundra-fissure-presence','cliff_edge','tundra_fissure','A fissure is here.','这里有一道裂缝。'),sentence:true},
  rule('tundra-hidden-mouse-presence','cliff_edge','tundra_fissure','A lemming is in the fissure.','裂缝里有一只旅鼠。'),
  rule('chasm-legacy-presence','chasms_brink','completion_oak|completion_toadstool',
    "An oak tree stands at the chasm's brink. A giant toadstool towers like a golf tee from the depths of the chasm. Only thirty feet separate you from its flattened summit.",
    '一棵橡树矗立在深渊边缘。一株巨大的毒菌如同高尔夫球座般从深渊深处耸起。你与它平坦的顶部之间只隔着三十英尺。'),
  {...rule('giant-boy-presence','promontory','completion_boy',
    "A boy sits nearby, listening to a pair of headphones and idly blowing soap bubbles. There's a dish full of soapy water by his side.",
    '一个男孩坐在附近，戴着耳机听音乐，百无聊赖地吹着肥皂泡。他身旁放着一碟肥皂水。'),sentence:true},
  rule('herb-mushroom-presence','herb_garden','completion_mushroom|tundra_gate',
    'Another giant toadstool grows here.','这里还生长着另一株巨大的毒菌。'),
  rule('underground-radio-presence','underground_2','walkie_talkie','A walkie-talkie is here.','这里有一部对讲机。'),
  rule('underground-lantern-presence','underground_3','lantern','A lantern is lying in the dirt at your feet.','你脚边的泥地上躺着一盏灯笼。'),
  rule('underground-returned-lantern','underground_3','lantern',"There's a lantern here.",'地上有一盏灯笼。'),
  rule('underground-glowing-lantern','underground_3','lantern',"There's a lantern (providing light) here.",'地上有一盏亮着的灯笼。'),
  rule('ball-in-flowers','flower_walk','ball','You can see a soccer ball half-hidden among the blossoms.','你可以看到一个足球半隐在花丛中。'),
  rule('ruby-at-feet','broad_walk','ruby','The ruby at your feet is bigger than a walnut, with finely cut facets that sparkle with crimson fire.','你脚边的红宝石比核桃还大，精细切割的刻面闪烁着绯红的火光。'),
  rule('unattended-pram','black_lion_gate','pram','A careless nanny has left her perambulator unattended.','一位粗心的保姆把她的婴儿车留在了无人看管的地方。'),
  rule('printed-notice','lancaster_walk','sign','A printed notice is stuck into the grass.','一块印刷的告示牌插在草地上。'),
  rule('parked-pram','lancaster_walk','pram',"There's a perambulator here.",'这里有一辆婴儿车。'),
  rule('umbrella-in-tree','lancaster_gate','umbrella','An umbrella is wedged in the branches overhead.','一把雨伞卡在头顶的树枝间。'),
  rule('ball-on-ground','lancaster_gate','ball',"There's a soccer ball here.",'这里有一个足球。'),
  rule('park-sundial','the_wabe','sundial','A shaft of golden sunlight falls across a handsome antique sundial, erected at the exact center of the clearing.','一束金色阳光落在一座精美的古董日晷上，它矗立在空地的正中央。'),
  rule('loose-gnomon','the_wabe','gnomon','The sundial stands at the center of the clearing. The gnomon lies on its face.','日晷矗立在空地中央。指针躺在表盘上。'),
  rule('meadow-sundial','meadow','sundial','A shaft of golden sunlight falls across a handsome antique sundial, erected at the exact center of the clearing.','一束金色阳光落在一座精美的古董日晷上，它矗立在空地的正中央。'),
  {...rule('boy-dish-presence','inverness_terrace','dish',"There's a dish full of soapy water by his side.",'他身旁放着一碟肥皂水。'),sentence:true},
  rule('bog-exposed-splinter','south_bog','splinter',"There's a splinter (providing light) here.",'这里有一块木片，正发着光。'),
  rule('bog-log','south_bog','log','A splintered log lies rotting in the mist at your feet.','一根裂开的圆木在你脚下的雾气中腐烂着。'),
  {...rule('shelter-spade','shelter','spade','A spade is here.','这里有一把铲子。'),sentence:true},
  rule('shelter-girl','shelter','japan_girl','The girl is here with the umbrella.','女孩在这里，拿着那把雨伞。'),
  rule('crater-hot-metal','crater','cliff_metal','A lump of hot metal lies here.','一块灼热的金属块躺在这里。'),
  {...rule('cliff-hive-presence','under_cliff','cliff_hive','A swarm of bees has staked out this formation for itself by building an enormous hive under the arch.','一群蜜蜂在拱形岩壁下筑起了巨大的蜂巢，将这处岩层据为己有。'),sentence:true},
]);
// Existing chapter wording that discloses a puzzle action, rather than an
// observation. Hide it in the 2D room introduction; keep event/inspect output.
export const VISUAL_GUIDANCE_RULES=Object.freeze([{id:'shelter-gift-guidance',room:'shelter',sentences:[
  'A girl may take your umbrella or paper here.','一位女孩可能会在这里收下你的雨伞或纸。',
]},{id:'orbit-clue-guidance',room:'orbit_satellite',sentences:[
  "You arrived inside the soap bubble; remember the magpie's clue about the crescent moon.",'你是乘肥皂泡来的；记得喜鹊关于新月之光的提示。',
]},{id:'ice-unmade-passage',room:'ice_cavern',sentences:[
  'A dark passage leads deeper.','一条黑暗的通道通向更深处。',
 ]},{id:'pacific-box-answer',room:'bottom_scaffold',sentences:[
  'A box is here; open it and push the switch—you have seven minutes. Then push the button.',
  '这里有一个箱子；打开它并按下开关——你有七分钟。然后按下按钮。',
  'The box is open. A switch and a button are inside.','箱子开着。里面有一个开关和一个按钮。',
  'The switch is on. You have seven minutes before you must push the button.','开关已按下。你必须在七分钟内按下按钮。',
 ]},{id:'pacific-unsupported-dolphin-answer',room:'west_beach',sentences:[
  'A fin or dolphin may follow you. Coconuts and an islet are visible. Point at the coconut when the tide is right; the dolphin may toss it to your feet.',
  '一只鳍或海豚可能会跟着你。可见椰子和一座小岛。潮水合适时指向椰子；海豚可能会把它抛到你脚边。',
 ]},{id:'pacific-mesa-location-debt',room:'mesa',sentences:[
  'You are on a mesa—a small island in the middle of an ocean. A scaffold rises to the south; the white door behind you leads back to the Wabe.',
  '你在台地上——大洋中的一座小岛。南面矗立着脚手架；身后的白门通向 Wabe。',
 ]},{id:'tundra-entry-answer',room:'tundra_1',sentences:[
  'When the sundial pointed to Libra, the white door brought you here.','当日晷指向天秤座时，白门将你带到了这里。',
 ]},{id:'tundra-ice-wall-debt',room:'tundra_6',sentences:[
  'The frozen earth slopes north to meet a gray wall of ice.','冰冻的大地向北倾斜，与一道灰色的冰墙相接。',
 ]},{id:'tundra-enclosure-debt',room:'platform',sentences:[
  'A metal enclosure holds the Soviet nuclear device.','一个金属围栏里放着苏联核装置。',
]}]);
export function filterVisualPresence(text,{room,objects=[],source='event',lanternLit=false}={}){
  if(source!=='room'&&source!=='item-annotation')return {text,removed:[]};
  const visible=new Set(objects.filter(o=>o.visual!==false).map(o=>o.kind));
  const matches=VISUAL_PRESENCE_RULES.filter(r=>(!r.when||r.when({lanternLit}))&&(r.rooms.includes(room)||(source==='item-annotation'&&r.id==='ball-in-flowers'))&&r.kinds.some(kind=>visible.has(kind)));
  const remove=new Set(matches.flatMap(r=>r.paragraphs)),removed=[];
  if(room==='kitchen' && source==='room' && objects.some(o=>o.visual!==false && o.visualOptions?.onShelf)){
    const intro=String(text).replace(/(an open cupboard) with [^.\n]+? in it(?= are the only evidence)/,'$1')
      .replace(/拆开的炉管和放着[^。\n]+?的橱柜(?=是这间房)/,'拆开的炉管和一个敞开的橱柜');
    if(intro!==text){removed.push('kitchen-shelf-contents');text=intro;}
  }
  const parts=String(text).split(/\n+/).map(p=>p.trim()).filter(Boolean);
  for(const r of VISUAL_GUIDANCE_RULES.filter(r=>r.room===room))for(let i=0;i<parts.length;i++)for(const sentence of r.sentences)if(parts[i].includes(sentence)){
    parts[i]=parts[i].replace(sentence,'').trim();if(!removed.includes(r.id))removed.push(r.id);
  }
  const rewritten=parts.map(p=>{for(const r of matches.filter(r=>r.sentence))for(const sentence of r.paragraphs)if(p.includes(sentence)){p=p.replace(sentence,'').trim();if(!removed.includes(r.id))removed.push(r.id);}return p;}).filter(Boolean);
  const kept=rewritten.filter(p=>{
    if(!remove.has(p))return true;
    for(const r of matches)if(r.paragraphs.includes(p)&&!removed.includes(r.id))removed.push(r.id);
    return false;
  });
  return {text:kept.join('\n\n'),removed};
}
