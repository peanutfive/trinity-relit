import {ROOMS as underground} from '../js/data/underground.js';
import {initializeUndergroundItems, withUndergroundLantern} from './lantern-story.js';
import {completeProjectedReturn,projectedDoorView} from './islet-shadow.js';
import {projectedShadowText} from './projected-doors.js';

const east = 'underground_3';
const west = 'underground_1';
const spent = 'ossuary_door_spent';
const door = ['door','white door','mushroom door','白门','门','蘑菇门'];
const returnDirs = ['e','in','out'];
const closed = 'The white door is closed.\n\n白门关着。';
const gone = 'The white door you saw here before is gone now.\n\n你先前在这里见过的白门已经消失了。';
const fade = 'The white door fades away into the texture of the toadstool.\n\n白门渐渐隐入毒菌的纹理，消失了。';
const landslide = 'The landslide blocks your path.\n\n塌方的碎石挡住了去路。';
const flag = (s,id) => s.hasFlag?.(id) ?? s.flags?.has?.(id) ?? s.flags?.includes?.(id) ?? false;

export function undergroundDoorView(s) {
  const view=projectedDoorView(s,'ossuary');
  // Older chapters did not model an interior clock. They keep their original
  // exit until the player uses it. New entries share the sundial outside.
  const insideGone=view.gone;
  const insideClosed=!insideGone && flag(s,'underground_projected_entry')
    && (flag(s,'ossuary_door_closed_away') || !view.aligned);
  return {...view,insideGone,insideClosed,insideOpen:!insideGone && !insideClosed};
}

function enterEvent(dir) {
  return {id:'enter_underground_door_'+dir,match:{verb:['enter'],noun:door},
    async act(s,eng){await eng._handleDirection(dir);},text:''};
}

const inspectDoor = open => open
  ? 'The open white door is of stately residential design.\n\n敞开的白门带着庄重的宅邸风格。'
  : 'The closed white door is of stately residential design.\n\n紧闭的白门带着庄重的宅邸风格。';
const blocked = (room,fail) => ({to:room,when:()=>false,fail});

function doorEvents(room,dir,isOpen) {
  return [enterEvent(dir),{
    id:room+'_examine_door',match:{verb:['examine'],noun:door},text:s=>inspectDoor(isOpen(s)),
  },{
    id:room+'_open_door',match:{verb:['open'],noun:door},text:s=>isOpen(s)
      ?"It's already open.\n\n门已经开着了。":"The white door won't budge.\n\n白门纹丝不动。",
  },{
    id:room+'_close_door',match:{verb:['close'],noun:door},text:s=>isOpen(s)
      ?"That's odd. The white door won't budge.\n\n真奇怪，白门纹丝不动。":"It's already closed.\n\n门已经关着了。",
  }];
}

export function withOssuaryDoor(room) {
  return {...room,
    desc(s) {
      const view=undergroundDoorView(s);
      const en='Naked slopes veer upward on every side, forming a natural hollow that is filled to a depth of several inches with human bones. The only exit is a dark opening to the south.';
      const cn='光秃秃的斜坡从四周升起，围成一处天然洼地，里面积着好几英寸厚的人骨。唯一的出路是南边一个漆黑的洞口。';
      const mushroom='A giant toadstool is flourishing in the rich fertilizer.';
      const cnMushroom='一株巨大的毒菌在肥沃的土壤中长得十分茂盛。';
      const stem=view.gone?'':view.open?' The white door in its stem is wide open.':' The white door in its stem is closed.';
      const cnStem=view.gone?'':view.open?'菌柄上的白门敞开着。':'菌柄上的白门关着。';
      return [en+'\n\n'+cn,mushroom+stem+'\n\n'+cnMushroom+cnStem,projectedShadowText(s,'ossuary',true)].filter(Boolean).join('\n\n');
    },
    exits(s) {
      const view=undergroundDoorView(s);
      return {...room.exits(s), in:view.open?{
        to:east,
        text:"You explore the door's edge with a timid foot.\n\n你小心地伸出脚，探了探门的边缘。",
        act(state) {
          state.chapter='underground';
          state.setFlag('chapter_underground_entered');
          state.setFlag('wabe_to_underground_used');
          state.setFlag('underground_projected_entry');
          initializeUndergroundItems(state);
        },
      }:blocked('ossuary',view.gone?gone:closed)};
    },
    onEnter(s,eng) {
      room.onEnter?.(s,eng);
      if (s.hasFlag('ossuary_door_fading')) {
        s.clearFlag('ossuary_door_fading');
        eng.print(fade);
      }
    },
    events:[...room.events, ...doorEvents('ossuary','in',s=>undergroundDoorView(s).open),{
      id:'ossuary_examine_shadow',match:{verb:['examine'],noun:['shadow','shadow tip','影子','影尖']},text:s=>projectedShadowText(s,'ossuary'),
    },{
      id:'ossuary_examine_toadstool',match:{verb:['examine'],noun:['toadstool','mushroom','stem','毒菌','蘑菇','菌柄']},
      text:'The toadstool must be at least twelve feet from base to crown.\n\n这株毒菌从根部到菌盖，少说也有十二英尺高。',
    }],
  };
}

const litRooms=withUndergroundLantern(underground);
const exitToOssuary={
  to:'ossuary',text:'You slip through the white door.\n\n你穿过白门。',
  act(s) {
    s.chapter='wabe';
    s.setFlag('chapter_wabe_entered');
    completeProjectedReturn(s);
    if (!s.hasFlag(spent)) {
      s.setFlag(spent);
      s.setFlag('ossuary_door_fading');
    }
  },
};

export const ROOMS={...litRooms,
  [west]:{...litRooms[west],exits() {
    return {e:'underground_2',out:'underground_2',w:blocked(west,landslide),in:blocked(west,landslide)};
  }},
  [east]:{...litRooms[east],
    desc(s) {
      const {insideOpen,insideClosed}=undergroundDoorView(s);
      const light=insideOpen?"You're in a narrow underground chamber, illuminated by an open door in the east wall.\n\n你站在狭窄的地下洞室里，东墙上一扇敞开的门透进了光。\n\n"
        :insideClosed?'The white door in the east wall is closed.\n\n东墙上的白门关着。\n\n':'';
      return light+litRooms[east].desc(s);
    },
    onEnter(s){initializeUndergroundItems(s);},
    exits(s){
      const {insideOpen,insideGone}=undergroundDoorView(s);
      if(!insideOpen){
        const barrier=blocked(east,insideGone?gone:closed);
        return {w:'underground_2',in:'underground_2',e:barrier,out:barrier};
      }
      return {w:'underground_2',e:exitToOssuary,in:exitToOssuary,out:exitToOssuary};
    },
    events:[...litRooms[east].events,...doorEvents('east_chamber','e',()=>true),{
      id:'east_chamber_exit_door',match:{verb:['exit'],noun:door},text:"You're not in the white door.\n\n你并不在白门里。",
    }],
  },
};

export function undergroundCrossingChapter(s,dir) {
  if (s.room==='ossuary' && dir==='in' && undergroundDoorView(s).open) return 'underground';
  if (s.room===east && returnDirs.includes(dir) && undergroundDoorView(s).insideOpen) return 'wabe';
  return null;
}

export function freeUndergroundAction(s,cmd) {
  const dir=cmd?.dir;
  if (s.room===east) {
    const {insideOpen,insideGone}=undergroundDoorView(s);
    if (insideOpen && returnDirs.includes(dir)) return {dir};
    if (!insideOpen) {
      if(dir==='e'||dir==='out')return {text:insideGone?gone:closed};
      if(door.includes(cmd?.noun)&&['enter','examine','open','close','exit'].includes(cmd.verb))return {text:gone};
    }
  }
  if (s.room===west && (dir==='w' || dir==='in')) return {text:landslide};
  if (s.room!=='ossuary') return null;
  const view=undergroundDoorView(s);
  if (view.gone && (dir==='in' || (door.includes(cmd?.noun)
    && ['examine','open','enter','close'].includes(cmd.verb)))) return {text:gone};
  if (dir==='in' && !view.open) return {text:closed};
  return null;
}

export function fadeUndergroundDoor(s,eng,before,moves) {
  if(s.chapter!=='underground' || !s.hasFlag('underground_projected_entry') || s.hasFlag(spent)
    || s.hasFlag('ossuary_door_closed_away') || !before.leverUp) return;
  const distance=(4*13+7-(before.sector*13+before.phase)+169)%169;
  if(distance<1 || distance>moves) return;
  if(s.room!==east){
    s.setFlag('ossuary_door_closed_away');
    return;
  }
  s.setFlag(spent);
  eng.print('The door swings shut with a faint creak. You stare in wonder as the door shimmers and fades from view.\n\n门在轻微的吱呀声中合拢。你惊讶地看着它闪烁了几下，消失在眼前。');
}
