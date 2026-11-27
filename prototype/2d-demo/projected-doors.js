// The room description, door and F target all read the same shadow clock.
import {projectedDoorView, vertexShadowView, waterfallDoorView} from './islet-shadow.js';

const names=['door','white door','mushroom door','白门','门','蘑菇门'];
const shadows=['shadow','shadow tip','影子','影尖'];
const missing="You can't see any at the moment.\n\n此刻你看不到那道影子。";
const gone='The white door you saw here before is gone now.\n\n你先前在这里见过的白门已经消失了。';
const closed='The white door is closed.\n\n白门关着。';
const targetSector = room => room==='waterfall'?2:4;

function direction(state,room,leaving=false) {
  if(room==='waterfall' && !leaving)return ['northward','向北'];
  if(room==='ossuary' && leaving)return state.flipped?['westward','向西']:['eastward','向东'];
  return state.flipped?['northwestward','向西北']:['northeastward','向东北'];
}

export function projectedShadowText(state,room,full=false) {
  const {sector,phase,centered,leverUp}=vertexShadowView(state);
  if(sector!==targetSector(room))return full?'':missing;
  const {gone}=projectedDoorView(state,room);
  const [dir,cnDir]=direction(state,room);
  let en,cn;
  if(!leverUp) {
    if(!centered){en='Its sharp point rests near the toadstool.';cn='影尖落在毒菌旁边。';}
    else if(gone){en='Its sharp point rests exactly on the toadstool.';cn='影尖恰好落在毒菌上。';}
    else {en='Its sharp point rests exactly on the open door in the toadstool.';cn='影尖恰好落在菌柄那扇敞开的门上。';}
  } else if(phase===4) {
    en='Its sharp point is almost touching the toadstool.';cn='影尖快要碰到毒菌了。';
  } else if(centered) {
    en='Its sharp point is sweeping across the '+(gone?'toadstool.':'open door in the toadstool.');
    cn=gone?'影尖正掠过毒菌。':'影尖正掠过菌柄上敞开的白门。';
  } else {
    en='Its sharp point is sweeping '+dir+', '+(phase<5?'towards':'away from')+' the toadstool.';
    cn='影尖'+cnDir+'扫去，'+(phase<5?'正朝毒菌移近。':'渐渐离开了毒菌。');
  }
  if(full){
    en=(leverUp?'A triangular shadow inches across the ground. ':'A triangular shadow lies across the ground. ')+en;
    cn=(leverUp?'一道三角形的影子缓缓掠过地面。':'地上横着一道三角形的影子。')+cn;
  }
  return en+'\n\n'+cn;
}

export function withWaterfallDoor(room) {
  // Read the ordinary footpaths independently of the old text game's dial rule.
  const footpaths=room.exits({sundialSymbol:0});
  return {...room,
    desc(s) {
      const view=waterfallDoorView(s);
      const terrain='A curtain of water tumbles off the western cliffs into a deep, rocky pool. From there, a mountain stream wanders off into the forest. Footpaths follow the stream east, past a giant toadstool.';
      const cn='一道水帘从西侧悬崖倾泻而下，落入岩石环绕的深潭。山溪从潭中流入森林，步道沿溪向东延伸，经过一株巨大的毒菌。';
      const door=view.gone?'':view.open?' The white door in its stem is wide open.':' The white door in its stem is closed.';
      const cnDoor=view.gone?'':view.open?'菌柄上的白门敞开着。':'菌柄上的白门关着。';
      return [terrain+door+'\n\n'+cn+cnDoor,projectedShadowText(s,'waterfall',true)].filter(Boolean).join('\n\n');
    },
    exits(s) {
      const view=waterfallDoorView(s);
      // The 2D orbit slice retains its bubble prerequisite. The door's
      // apparent position and open state do not depend on the player's bag.
      const blocked={to:'waterfall',when:()=>false};
      if(!view.open)return {...footpaths,in:{...blocked,fail:view.gone?gone:closed}};
      const hasBubble=typeof s.has==='function'?s.has('soap_bubble'):['inventory','pocket','worn'].includes(s.itemLoc?.soap_bubble);
      if(!hasBubble)return {...footpaths,in:{...blocked,fail:'You need the soap bubble to pass through this door.\n\n你需要肥皂泡才能通过这道门。'}};
      return {...footpaths,in:{to:'orbit_satellite',text:'You squeeze the film through the white door.\n\n你裹着薄膜挤过白门。',act(state){
        state.chapter='orbit';state.setFlag('chapter_orbit_entered');state.setFlag('wabe_to_orbit_used');
      }}};
    },
    events:[{id:'waterfall_enter_door',match:{verb:['enter'],noun:names},act:async(s,e)=>e._handleDirection('in'),text:''},
      {id:'waterfall_examine_door',match:{verb:['examine'],noun:names},text:s=>waterfallDoorView(s).open
        ?'The open white door is of stately residential design.\n\n敞开的白门带着庄重的宅邸风格。'
        :'The closed white door is of stately residential design.\n\n紧闭的白门带着庄重的宅邸风格。'},
      {id:'waterfall_try_door',match:{verb:['open'],noun:names},text:s=>waterfallDoorView(s).open
        ?"It's already open.\n\n门已经开着了。":"The white door won't budge.\n\n白门纹丝不动。"},
      {id:'waterfall_stem',match:{verb:['examine'],noun:['toadstool','stem','mushroom','毒菌','蘑菇','菌柄']},text:'The toadstool must be at least twelve feet from base to crown.\n\n这株毒菌从根部到菌盖，少说也有十二英尺高。'},
      {id:'waterfall_shadow',match:{verb:['examine'],noun:shadows},text:s=>projectedShadowText(s,'waterfall')},...room.events],
  };
}

export function freeProjectedAction(state,command) {
  const room=state.room;
  if(room!=='ossuary' && room!=='waterfall')return null;
  if(command?.verb==='examine' && shadows.includes(command.noun) && vertexShadowView(state).sector!==targetSector(room))return missing;
  if(room!=='waterfall')return null;
  const view=waterfallDoorView(state);
  if(view.gone && command?.dir==='in')return '[Which way do you want to go in?]\n\n[你想往哪个方向进去？]';
  if(view.gone && names.includes(command?.noun))return gone;
  if(command?.dir==='in' && !view.open)return closed;
  return null;
}

// A normal WAIT is four game moves. Local shadow messages interrupt the
// remaining wait, including the approach and the moment it goes out of view.
export function projectedWaitMoves(state) {
  const room=state.room;
  if(!['ossuary','waterfall','underground_3'].includes(room))return null;
  const {sector,phase,leverUp}=vertexShadowView(state);
  if(!leverUp)return 4;
  if(room==='underground_3' && !state.hasFlag('underground_projected_entry'))return null;
  for(let n=1;n<=4;n++){
    const tick=(sector*13+phase+n)%169;
    if(room==='underground_3'){
      if(tick===4*13+7 && !state.hasFlag('ossuary_door_spent') && !state.hasFlag('ossuary_door_closed_away'))return n;
    } else {
      const local=targetSector(room)*13;
      if([0,5,6,7,11,13].includes(tick-local))return n;
    }
  }
  return 4;
}

export function reportProjectedMotion(state,eng,before,moves) {
  const room=state.room;
  if(!before.leverUp || !['ossuary','waterfall'].includes(room))return;
  const local=targetSector(room)*13, view=projectedDoorView(state,room);
  for(let n=1;n<=moves;n++) {
    const tick=(before.sector*13+before.phase+n)%169;
    if(tick<local || tick>local+13)continue;
    if(tick===local)eng.print('The edge of a shadow inches into view.\n\n一道影子的边缘缓缓移入视野。');
    else if(tick===local+5) {
      eng.print('The tip of the shadow touches the toadstool.\n\n影尖触到了毒菌。');
      if(!view.gone)eng.print('With a faint creak, the white door in the toadstool swings open.\n\n伴着轻微的吱呀声，菌柄上的白门打开了。');
    } else if(tick===local+6) {
      eng.print(view.gone?'The shadow creeps across the toadstool.\n\n影子缓缓掠过毒菌。':"The shadow creeps across the toadstool's open door.\n\n影子徐徐掠过菌柄上敞开的白门。");
    } else if(tick===local+7) {
      eng.print(view.gone?'The shadow inches away from the toadstool.\n\n影子慢慢从毒菌上移开。':'The shadow inches away from the toadstool, and the door in the stem swings shut with a faint creak.\n\n影子慢慢移开，菌柄上的门在轻微的吱呀声中合拢。');
    } else if(tick===local+11) {
      const [dir,cnDir]=direction(state,room);
      eng.print("The shadow creeps "+dir+". It's almost out of sight.\n\n影子缓缓"+cnDir+"移去，就快看不见了。");
    } else if(tick===local+13) {
      const [dir,cnDir]=direction(state,room,true);
      eng.print('The edge of the shadow disappears '+dir+'.\n\n影子的边缘消失在'+cnDir.slice(1)+'方。');
    }
  }
}
