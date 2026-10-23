import { drawStoryProp } from './prologue-art.js';
export { drawStoryProp, drawPortrait, setStorySpriteRenderer } from './prologue-art.js';

// A read-only presentation director. The engine has already committed each event.
// Updating/skipping an animation never mutates game state or submits a command.
const clamp = value => Math.max(0,Math.min(1,value));
const smooth = value => { const t=clamp(value);return t*t*(3-2*t); };
const lerp = (a,b,t) => a+(b-a)*t;
const has = (state,flag) => state?.hasFlag?.(flag)
  ?? (state?.flags instanceof Set ? state.flags.has(flag) : (state?.flags || []).includes(flag));
const item = (state,id) => state?.itemAt?.(id) ?? state?.itemLoc?.[id];
const count = (state,id) => state?.cnt?.(id) ?? state?.counters?.[id] ?? 0;
const defaults = {
  broad_walk:{woman:{x:143,y:166},birds:{x:185,y:185},ruby:{x:211,y:185}},
  the_wabe:{sundial:{x:242,y:166},gnomon:{x:242,y:136}},
  round_pond:{paper_bird:{x:311,y:176},boats:{x:330,y:140}},
  black_lion_gate:{pram:{x:275,y:190}},
  inverness_terrace:{pram:{x:275,y:190},boy:{x:167,y:184}},
  lancaster_gate:{pram:{x:263,y:197},tree:{x:326,y:138},umbrella:{x:326,y:93},umbrella_woman:{x:290,y:181},ball:{x:326,y:88}},
  lancaster_walk:{pram:{x:279,y:192},notice:{x:334,y:181}},
  flower_walk:{pram:{x:270,y:174}},
  long_water:{pram:{x:216,y:211},door:{x:345,y:169},white_door:{x:345,y:169},missile:{x:335,y:67}},
  wading:{door:{x:343,y:164},white_door:{x:343,y:164},missile:{x:335,y:67}},
};
function visualOf(state) { return state?.visual || state?._visual || {}; }
function point(state,room,kinds,fallback) {
  const visual=visualOf(state),list=visual.hotspots || visual.objects || [];
  const wanted=Array.isArray(kinds)?kinds:[kinds];
  if(!visual.room||visual.room===room){
    const match=list.find(o=>wanted.includes(o.kind)||wanted.includes(o.itemId));
    if(match)return {x:match.x,y:match.y};
  }
  for(const kind of wanted)if(defaults[room]?.[kind])return {...defaults[room][kind]};
  return fallback || {x:240,y:180};
}
function playerOf(state) {
  const p=visualOf(state).player;return p&&Number.isFinite(p.x)&&Number.isFinite(p.y)?{x:p.x,y:p.y}:{x:240,y:190};
}
function eventAnchors(before,after,room) {
  const source=after.room===room?after:before;
  return {player:playerOf(source),woman:point(source,room,['woman','bird_woman']),birds:point(source,room,['birds','pigeons']),ruby:point(source,room,['ruby','gem'],{x:playerOf(source).x+8,y:playerOf(source).y}),sundial:point(source,room,'sundial'),gnomon:point(source,room,'gnomon'),paper:point(source,room,'paper_bird'),pram:point(source,room,['pram','perambulator']),tree:point(source,room,'tree'),umbrella:point(source,room,['umbrella_tree','umbrella']),umbrellaWoman:point(source,room,'umbrella_woman'),boy:point(source,room,['boy','teenager']),door:point(source,room,['door','white_door']),missile:point(source,room,'missile')};
}
function pramRoom(state) {
  if(has(state,'pram_broken'))return 'long_water';
  for(const [flag,room] of [['pram_at_flower','flower_walk'],['pram_at_walk','lancaster_walk'],['pram_at_lancaster','lancaster_gate'],['pram_at_inverness','inverness_terrace']])if(has(state,flag))return room;
  return 'black_lion_gate';
}
const length = {birds_arrive:1.25,crumbs_purchase:.7,feed_birds:2.5,ruby_reveal:1.1,ruby_snatch:2.25,wind_reversal:2.1,gnomon_unscrew:1.2,paper_approach:1,paper_unfold:1.1,umbrella_gust:2.8,umbrella_dislodged:1.9,pram_push:1.05,pram_open:.65,pram_board:.7,pram_runaway:3.1,pram_tumble:1.3,umbrella_travel:1.3,boy_startled:1.4,bubble_cycle:.9,missile_reveal:1.1,door_reveal:1.4,wade:.9,door_cross:1.2,doomsday:1,death:1.7};

export function createNarrativeDirector() {
  let queue=[],active=null,lastRoom=null,latest=null,history=[],leafOffset=0,windChanged=false;
  const triggered=new Set();
  function add(type,before,after,options={}) {
    const room=options.room||after.room||before.room;
    const id=options.id||type;
    if(triggered.has(id))return false;
    triggered.add(id);
    const event={id,type,room,fromRoom:before.room,toRoom:after.room,elapsed:0,duration:length[type]||1,busy:options.busy!==false,anchors:eventAnchors(before,after,room),...options};
    queue.push(event);if(!active)active=queue.shift();return true;
  }
  function onCommand(before={},after={},command='') {
    if(!latest)windChanged=has(before,'wind_changed');
    latest=after;lastRoom=after.room;
    const added=[];
    const push=(type,options={})=>{if(add(type,before,after,options))added.push(type);};
    const gained=flag=>!has(before,flag)&&has(after,flag);
    if(gained('seen_bird_woman'))push('birds_arrive');
    if(gained('bag_bought'))push('crumbs_purchase');
    if(gained('birds_fed'))push('feed_birds');
    else if(gained('ruby_visible'))push('ruby_reveal');
    if(gained('ruby_snatched'))push('ruby_snatch');
    if(gained('wind_changed'))push('wind_reversal');
    if(gained('gnomon_unscrewed'))push('gnomon_unscrew');
    if((gained('seen_paper_bird')&&after.visual?.paperIdentified!==false)
      || (before.visual?.paperIdentified===false&&after.visual?.paperIdentified===true))push('paper_approach',{busy:false});
    if(gained('bird_unfolded'))push('paper_unfold');
    if(gained('umbrella_woman_done'))push('umbrella_gust');
    // These are the actual source flags/locations, not invented convenience flags.
    if(gained('ball_in_tree')&&item(before,'umbrella')==='lancaster_gate_tree'&&item(after,'umbrella')==='lancaster_gate')push('umbrella_dislodged');
    const beforePram=pramRoom(before),afterPram=pramRoom(after);
    if(gained('pram_broken'))push('pram_runaway');
    else if(beforePram!==afterPram)push('pram_push',{id:`pram_push:${afterPram}`,direction:afterPram==='lancaster_walk'||afterPram==='flower_walk'?'s':'e'});
    if(gained('pram_open'))push('pram_open');
    if(gained('in_pram'))push('pram_board');
    if(gained('boy_scared'))push('boy_startled');
    else if(after.room==='inverness_terrace'&&!has(after,'boy_scared')&&count(after,'boy_cycle')!==count(before,'boy_cycle'))push('bubble_cycle',{id:`bubble_cycle:${after.turns??count(after,'boy_cycle')}`,busy:false,phase:count(after,'boy_cycle')%3});
    const opensUmbrella=/(?:open\s+(?:the\s+)?umbrella|撑伞|打开雨伞)/i.test(String(command));
    if(opensUmbrella&&!gained('pram_broken')){
      if(has(before,'in_pram')&&!has(after,'in_pram'))push('pram_tumble',{id:`pram_tumble:${after.turns}`,room:after.room});
      else if(before.room!==after.room)push('umbrella_travel',{id:`umbrella_travel:${after.turns}`});
    }
    if(gained('missile_visible'))push('missile_reveal');
    if(gained('white_door_visible'))push('door_reveal');
    if(after.room==='wading'){
      if(before.room!=='wading')push('wade',{id:`wade:${after.turns}`});
      // Repeated ravens are absent from both sampled original routes; no visual loop.
    }
    if(gained('prologue_done')||(before.chapter==='prologue'&&after.chapter==='wabe'))push('door_cross',{room:before.room==='wading'?'wading':after.room});
    if(count(after,'doom_phase')>count(before,'doom_phase'))push('doomsday',{id:`doomsday:${count(after,'doom_phase')}`,busy:false,phase:count(after,'doom_phase')});
    if(!before.dead&&after.dead)push('death');
    return added;
  }
  function finish(skipped=false) {
    if(!active)return;
    if(active.type==='wind_reversal')windChanged=true;
    history.push({id:active.id,type:active.type,skipped});history=history.slice(-64);
    active=queue.shift()||null;
  }
  function update(dt) {
    let remaining=Math.max(0,Number.isFinite(dt)?dt:0);
    const reversal=active?.type==='wind_reversal'?active.elapsed/active.duration:null;
    leafOffset+=windSpeed(windChanged,reversal)*12*remaining;
    while(active&&remaining>0){const step=Math.min(remaining,active.duration-active.elapsed);active.elapsed+=step;remaining-=step;if(active.elapsed>=active.duration-.00001)finish();else break;}
  }
  function skip() { while(active)finish(true); }
  function getState(state=latest||{}) {
    const type=active?.type||null;
    const hiddenKinds=[];
    if(['birds_arrive','feed_birds'].includes(type))hiddenKinds.push('birds','pigeons');
    if(type==='gnomon_unscrew')hiddenKinds.push('gnomon');
    if(type==='missile_reveal')hiddenKinds.push('missile');
    if(['feed_birds','ruby_reveal','ruby_snatch'].includes(type))hiddenKinds.push('ruby','gem');
    if(type==='umbrella_gust'||type==='umbrella_dislodged')hiddenKinds.push('umbrella','umbrella_tree');
    if(type==='umbrella_dislodged')hiddenKinds.push('ball');
    if(['pram_push','pram_runaway','pram_open','pram_board','pram_tumble'].includes(type))hiddenKinds.push('pram','perambulator');
    if(type==='paper_approach')hiddenKinds.push('paper_bird');
    if(type==='door_reveal')hiddenKinds.push('door','white_door');
    if(type==='boy_startled')hiddenKinds.push('boy','teenager','dish');
    const sceneRoom=active?.room||state.room||lastRoom;
    // Available commands can disappear without the people leaving the scene.
    // Return these actors to the caller's shared depth/collision pass; draw()
    // must never paint them above foreground objects after that pass has ended.
    const persistentActors=[];
    if(state.room==='broad_walk'&&has(state,'birds_fed')){
      persistentActors.push({id:'broad_walk:woman',room:'broad_walk',kind:'woman',actorId:'bird_food_seller',x:143,y:166,label:'卖鸟食的老妇人',visual:true,visualOnly:true,radius:0,actions:[],visualOptions:{pose:'seated'}});
      if(!['feed_birds','birds_arrive'].includes(type))persistentActors.push({id:'broad_walk:birds',room:'broad_walk',kind:'birds',x:185,y:185,label:'鸽子',visual:true,visualOnly:true,radius:0,actions:[]});
    }
    return {currentEvent:type,eventId:active?.id||null,elapsed:active?.elapsed||0,duration:active?.duration||0,busy:Boolean(active?.busy||queue.some(event=>event.busy)),sceneRoom,hidePlayer:['pram_runaway','pram_board','pram_tumble','umbrella_travel','door_cross'].includes(type),hiddenKinds,persistentActors,queued:queue.map(event=>event.type),triggered:[...triggered],history:history.map(entry=>({...entry})),grading:null,sourceReview:{ravens:{status:'pending',visualEnabled:false},door_cross:{status:'partially_verified',visualSequence:'roadrunner_and_short_fade',unverifiedExtrasDisabled:true}}};
  }
  function draw(c,room,state=latest||{},clock=0) {
    drawLeaves(c,clock,leafOffset,latest?windChanged:has(state,'wind_changed'),active?.type==='wind_reversal'?active.elapsed/active.duration:null);
    if(!active||active.room!==room)return;
    c.save();renderEvent(c,active,state,clock);c.restore();
  }
  return {onCommand,update,draw,skip,getState};
}

function windSpeed(changed,reversal) {
  return reversal!==null&&reversal!==undefined
    ? (reversal<.48?-Math.pow(1-reversal/.48,2):smooth((reversal-.6)/.4))
    : (changed?1:-1);
}
function drawLeaves(c,time,offset,changed,reversal) {
  const speed=windSpeed(changed,reversal);
  c.save();c.globalAlpha=.45;
  for(let i=0;i<11;i++){
    const phase=i*1.79,x=((i*61+offset)%520+520)%520-20;
    const y=38+(i*29)%220+Math.sin(time*.8+phase)*3*Math.abs(speed);
    c.save();c.translate(x,y);c.rotate(Math.sin(time+phase)*.3*speed);
    c.fillStyle=i%3===0?'#a58f56':'#8a9a5d';c.beginPath();c.ellipse(0,0,2.3,.7,.2,0,Math.PI*2);c.fill();c.restore();
  }
  c.restore();
}
function arc(c,x,y,rx,ry,alpha=1) {
  c.save();c.globalAlpha*=alpha;c.strokeStyle='#dce4c5';c.lineWidth=.55;c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);c.stroke();c.restore();
}
function particle(c,x,y,color,r=.7){c.fillStyle=color;c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fill();}
function renderEvent(c,event,state,time) {
  const t=event.elapsed/event.duration,a=event.anchors;
  const prop=(kind,x,y,options={})=>drawStoryProp(c,{kind,x,y,visualOptions:options},state,time);
  switch(event.type){
    case 'birds_arrive': {
      for(let i=0;i<8;i++){const p=smooth(clamp(t*1.3-i*.035));const x=lerp(40+i*43,a.birds.x+(i*17)%34-17,p),y=lerp(35+(i*23)%60,a.birds.y+(i*11)%20-10,p)-Math.sin(p*Math.PI)*24;prop('pigeon',x,y,{flap:Math.sin(time*14+i)*Math.sin(p*Math.PI),flip:i%2===0});}
      break;
    }
    case 'crumbs_purchase': {
      for(let i=0;i<5;i++){const p=smooth(t);particle(c,lerp(a.woman.x+8,a.player.x,i*.04+p*.8),lerp(a.woman.y-16,a.player.y-12,p)-Math.sin(p*Math.PI)*3,'#c9b289',.65);}
      break;
    }
    case 'feed_birds': {
      for(let i=0;i<19;i++){const p=clamp(t*2.4-i*.018),x=a.birds.x+Math.cos(i*2.4)*(5+i*.75),y=a.birds.y+Math.sin(i*2.4)*(3+i*.4);if(p>0)particle(c,lerp(a.player.x,x,p),lerp(a.player.y-17,y,p)-Math.sin(p*Math.PI)*8,'#cbbb8c',.55);}
      for(let i=0;i<7;i++){const p=smooth(t*2),x=lerp(a.birds.x+(i-3)*11,a.birds.x+Math.cos(i)*11,p),y=lerp(a.birds.y+((i%3)-1)*12,a.birds.y+Math.sin(i)*7,p);prop('pigeon',x,y,{peck:Math.max(0,Math.sin(time*4+i)),flip:i%2===0});}
      if(t>.56){c.save();c.globalAlpha=smooth((t-.56)/.25);prop('ruby',a.ruby.x,a.ruby.y);c.restore();}
      break;
    }
    case 'ruby_reveal': {c.save();c.globalAlpha=smooth(t);prop('ruby',a.ruby.x,a.ruby.y);c.restore();break;}
    case 'ruby_snatch': {
      const grab=.4;
      if(t<grab)prop('ruby',a.ruby.x,a.ruby.y);
      const x=t<grab?lerp(-25,a.ruby.x-14,smooth(t/grab)):lerp(a.ruby.x-14,510,smooth((t-grab)/(1-grab)));
      const y=a.ruby.y+Math.sin(t*16)*4+(t>grab?Math.sin((t-grab)*10)*5:0);
      prop('roadrunner',x,y,{ruby:t>=grab});
      break;
    }
    case 'wind_reversal': break; // Ambient leaves perform the stop and reversal.
    case 'gnomon_unscrew': {
      const origin={x:a.sundial.x,y:a.sundial.y-30};c.save();c.translate(origin.x,origin.y);c.rotate(Math.sin(t*24)*(1-t)*.24+t*.12);prop('gnomon',0,t>.65?Math.sin((t-.65)/.35*Math.PI)*-3:0);c.restore();break;
    }
    case 'paper_approach': {const p=smooth(t);prop('paper_bird',a.paper.x+lerp(35,0,p),a.paper.y+Math.sin(t*4)*.8);arc(c,a.paper.x+lerp(35,0,p),a.paper.y+3,11,2,.2*(1-t));break;}
    case 'paper_unfold': {c.save();c.globalAlpha=Math.min(1,t*5,(1-t)*5);prop('paper_bird',a.player.x,a.player.y-35,{unfold:smooth(t)});c.restore();break;}
    case 'umbrella_gust': {
      const p=smooth(clamp(t/.4)),x=lerp(a.umbrellaWoman.x+10,a.umbrella.x,p),y=lerp(a.umbrellaWoman.y-10,a.umbrella.y,p)-Math.sin(p*Math.PI)*20;
      prop('umbrella',x,y,{rotation:Math.sin(p*Math.PI)*.55});
      const walk=smooth(clamp((t-.45)/.55));prop('umbrella_woman',a.umbrellaWoman.x+Math.sin(t*12)*(t<.55?6:0),a.umbrellaWoman.y+walk*100,{umbrella:false});break;
    }
    case 'umbrella_dislodged': {
      const ballTarget={x:a.tree.x,y:a.tree.y-50};
      if(t<.45){const p=smooth(t/.45);prop('ball',lerp(a.player.x,ballTarget.x,p),lerp(a.player.y-9,ballTarget.y,p)-Math.sin(p*Math.PI)*33);}else prop('ball',ballTarget.x,ballTarget.y);
      const fall=clamp((t-.35)/.6),uy=lerp(a.umbrella.y,a.tree.y+30,fall*fall);
      prop('umbrella',a.umbrella.x+Math.sin(t*19)*(1-fall)*3,uy,{rotation:Math.sin(t*14)*(1-fall)*.3});break;
    }
    case 'pram_push': {
      const p=smooth(t),start=event.direction==='s'?{x:a.pram.x,y:-16}:{x:-30,y:a.pram.y};
      prop('pram',lerp(start.x,a.pram.x,p),lerp(start.y,a.pram.y,p),{rolling:true,broken:false});break;
    }
    case 'pram_open': {prop('pram',a.pram.x,a.pram.y,{open:t>.45,broken:false});break;}
    case 'pram_board': {prop('pram',a.pram.x,a.pram.y,{open:true,broken:false,rider:t>.35});break;}
    case 'pram_runaway': {
      const crash=.73,p=smooth(clamp(t/crash));
      const x=lerp(-30,a.pram.x,p),y=lerp(a.pram.y-22,a.pram.y,p)+Math.sin(p*29)*2*(1-p);
      prop('pram',x,y,{rolling:t<crash,open:true,rider:t<crash,sail:t<crash,broken:t>=crash});
      if(t>=crash){const q=(t-crash)/(1-crash);for(let i=0;i<19;i++){const angle=Math.PI*(.08+i/19*.84);particle(c,x+Math.cos(angle)*q*33,y-Math.sin(angle)*Math.sin(q*Math.PI)*25+q*8,i%2?'#b5c9bd':'#e1e4c6',.6);}for(let i=0;i<3;i++)arc(c,x+4,y+4,q*(18+i*7),q*(3+i),.55*(1-q));}
      break;
    }
    case 'pram_tumble': {prop('pram',a.pram.x+Math.sin(t*Math.PI)*-17,a.pram.y,{open:true,rider:t<.3,broken:false,sail:t<.4});break;}
    case 'umbrella_travel': {prop('umbrella',lerp(-20,a.player.x,smooth(t)),a.player.y-15-Math.sin(t*Math.PI)*8,{open:t<.7,rotation:.25});break;}
    case 'boy_startled': {const p=smooth(t);c.save();c.globalAlpha=1-smooth((t-.75)/.25);prop('boy',a.boy.x-60*p,a.boy.y-15*p);c.restore();for(let i=0;i<9;i++){const q=clamp(t*2);particle(c,a.boy.x+15+Math.cos(i)*q*17,a.boy.y-Math.sin(q*Math.PI)*8+i%3,'#bdcdbb',.45);}arc(c,a.boy.x+32+t*21,a.boy.y-30-t*70,5+t*2,5+t*2,.35*(1-t));break;}
    case 'bubble_cycle': {if(event.phase===1)arc(c,a.boy.x+23+t*11,a.boy.y-30-t*15,3+t*3,3+t*3,.35);else if(event.phase===2)for(let i=0;i<7;i++){const angle=i*Math.PI*2/7;particle(c,a.boy.x+30+Math.cos(angle)*t*10,a.boy.y-39+Math.sin(angle)*t*10,'#d6dfc08c',.35);}break;}
    case 'missile_reveal': {c.save();c.globalAlpha=smooth(t);prop('missile',a.missile.x,a.missile.y+t*.7);c.restore();break;}
    case 'door_reveal': {prop('white_door',a.door.x,a.door.y,{reveal:smooth(t)});for(let i=0;i<4;i++)arc(c,a.door.x,a.door.y+4,lerp(2,22+i*6,t),lerp(.5,3+i,t),.25*(1-t));break;}
    case 'wade': {for(let i=0;i<3;i++)arc(c,a.player.x,a.player.y+2,8+t*(17+i*5),1+t*(3+i),.3*(1-t));break;}
    case 'door_cross': {
      // Only the ruby-carrying roadrunner is confirmed by original-route evidence.
      // Keep the rest a brief scene transition, without shell collapse/desaturation.
      if(t<.76){const p=smooth(t/.76);prop('roadrunner',lerp(190,a.door.x,p),lerp(190,a.door.y-11,p)-Math.sin(p*Math.PI)*10,{flying:true});}
      const fade=smooth((t-.62)/.38);c.fillStyle=`rgba(237,235,215,${fade*.55})`;c.fillRect(0,0,480,288);break;
    }
    case 'doomsday': {const pulse=Math.sin(t*Math.PI)*Math.min(.12,event.phase*.015);c.fillStyle=`rgba(84,101,97,${pulse})`;c.fillRect(0,0,480,288);break;}
    case 'death': {const p=smooth(t);c.fillStyle=`rgba(230,229,207,${Math.sin(p*Math.PI)*.6})`;c.fillRect(0,0,480,288);c.fillStyle=`rgba(18,29,26,${p*.45})`;c.fillRect(0,0,480,288);break;}
  }
}
