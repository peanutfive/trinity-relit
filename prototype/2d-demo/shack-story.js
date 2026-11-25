import { ROOMS as DESERT } from '../js/data/desert.js';

export function shackDoorOpen(state) {
  return !(state.hasFlag?.('shack_door_shut') ?? state.flags?.has?.('shack_door_shut') ?? state.flags?.includes?.('shack_door_shut'));
}

const whiteDoor = ['door','white door','门','白门'];
const shut = 'The white door is closed.\n\n白门关着。';
const refuses = "The white door won't budge.\n\n白门纹丝不动。";

export function approachShackDoor(state, engine) {
  if (!shackDoorOpen(state)) return engine.print(shut);
  state.setFlag('shack_door_shut');
  engine.print('BANG! The door slams shut at your approach.\n\n砰！你刚一走近，门就猛地关上了。');
}

export const DESERT_ROOMS = {
  ...DESERT,
  shack:{
    name:'Shack',cn:'金属棚屋',
    desc(state) {
      const door=shackDoorOpen(state);
      return "You're in a metal shack, barely twelve feet square. The oak floor is littered with discarded bits of rope, pulleys and other hardware. A dark light bulb hangs from the ceiling. You can see an exit in the west wall.\n\n你身处一间边长仅十二英尺的金属棚屋。橡木地板上散落着碎绳、滑轮和零星的五金件。天花板上垂着一只熄灭的灯泡。西墙上有个出口。\n\n"+
        (door?'An open white door is set into the east wall.\n\n东墙上嵌着一扇敞开的白门。':'A closed white door is set into the east wall.\n\n东墙上嵌着一扇关闭的白门。');
    },
    exits:()=>({w:'tower_platform'}),
    events:[
      {id:'shack_inspect_door',match:{verb:['examine'],noun:whiteDoor},text:s=>shackDoorOpen(s)?'The open white door is of stately residential design.\n\n这扇敞开的白门庄重气派，像是大宅的正门。':'The closed white door is of stately residential design.\n\n这扇关着的白门庄重气派，像是大宅的正门。'},
      {id:'shack_enter_door',match:{verb:['enter'],noun:whiteDoor},act:approachShackDoor,text:''},
      {id:'shack_open_door',match:{verb:['open'],noun:whiteDoor},act(s,eng){if(shackDoorOpen(s))approachShackDoor(s,eng);else eng.print(refuses);},text:''},
    ],
  },
  tower_platform:{
    name:'Tower Platform',cn:'塔顶平台',
    desc:()=>'This narrow platform opens east into a metal shack. A ladder is sticking up over the platform\'s edge.\n\n狭窄的平台向东通往一间金属棚屋。一架梯子从平台边缘探出头来。',
    exits:()=>({e:'shack',d:'tower_landing'}),events:[],
  },
  tower_landing:{
    name:'Tower Landing',cn:'塔梯中段',
    desc:()=>'A spiderweb of steel rises from the desert floor below, tapering up to the platform fifty feet overhead. Thick ropes and cables dangle around the ladder that continues downward.\n\n钢架像蛛网一般从沙地升起，越往上越窄，一直延伸到头顶五十英尺高的平台。粗绳和缆线悬在梯子旁，梯子继续向下。',
    exits:()=>({u:'tower_platform',d:'base_of_tower'}),events:[],
  },
  base_of_tower:{
    name:'Base of Tower',cn:'塔底',
    desc:()=>'A steel tower rises overhead, black against the cloudy sky. Your eyes follow the tapered frame up the ladder, past dangling ropes and cables, to the platform at its summit.\n\n钢塔高耸，在阴云下勾出黑色的轮廓。你的目光沿着逐渐变窄的塔架和梯子，越过垂下的绳缆，一直望到塔顶的平台。',
    exits:()=>({u:'tower_landing',se:'shallow_crater'}),events:[],
  },
  shallow_crater:{...DESERT.shallow_crater,exits:s=>({...DESERT.shallow_crater.exits(s),nw:'base_of_tower'})},
};

export const ROOMS = DESERT_ROOMS;
