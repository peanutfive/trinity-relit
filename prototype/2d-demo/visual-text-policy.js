// Display adaptation only. Original descriptions and inspect/event prose remain
// in the chapter modules; suppress exact, reviewed presence statements only
// when their corresponding object is genuinely rendered in this scene.
const rule=(id,rooms,kinds,en,cn)=>({id,rooms:rooms.split('|'),kinds:kinds.split('|'),paragraphs:[en,cn]});
export const VISUAL_PRESENCE_RULES=Object.freeze([
  rule('underground-radio-presence','underground_2','walkie_talkie','A walkie-talkie is here.','这里有一部对讲机。'),
  rule('underground-lantern-presence','underground_3','lantern','The lantern is here.','灯笼在这里。'),
  {...rule('underground-cylinder-guidance','underground_3','ug_cylinder','A metal cylinder is here; the lantern can be taken from it.','这里有一个金属圆筒；可以从里面取出灯笼。'),sentence:true},
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
]},{id:'ice-unmade-passage',room:'ice_cavern',sentences:[
  'A dark passage leads deeper.','一条黑暗的通道通向更深处。',
]}]);
export function filterVisualPresence(text,{room,objects=[],source='event'}={}){
  if(source!=='room'&&source!=='item-annotation')return {text,removed:[]};
  const visible=new Set(objects.filter(o=>o.visual!==false).map(o=>o.kind));
  const matches=VISUAL_PRESENCE_RULES.filter(r=>(r.rooms.includes(room)||(source==='item-annotation'&&r.id==='ball-in-flowers'))&&r.kinds.some(kind=>visible.has(kind)));
  const remove=new Set(matches.flatMap(r=>r.paragraphs)),removed=[];
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
