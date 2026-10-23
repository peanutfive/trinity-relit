import { ROOMS as PROLOGUE_ROOMS } from '../js/data/prologue.js';
import { ROOMS as WABE_ROOMS } from '../js/data/wabe.js';
import { GameState } from '../js/engine.js';
import { ITEMS } from '../js/data/items.js';
import { getHotspots } from './interaction-catalog.js';
export const SCENE_SCHEMA_VERSION = 2;
export const LOGICAL_SIZE = { width: 480, height: 288 };
export const BACKGROUND_ATLAS = './assets/gardens-hd2d.png';
const base = './assets/gardens-hd2d.png';
const extraA = './assets/gardens-extra-a.png';
const extraB = './assets/gardens-extra-b.png';
const wabeA = './assets/wabe-a.png';
const wabeB = './assets/wabe-b.png';
const DEFAULT_ROOMS = { ...PROLOGUE_ROOMS, ...WABE_ROOMS };
const sceneSpecs = {
  palace_gate: [base,0,3,236,[238,218]],
  broad_walk: [base,1,3,354,[240,250]],
  flower_walk: [base,2,3,250,[32,162]],
  the_wabe: [extraA,0,4,79,[240,225]],
  round_pond: [extraA,1,4,144,[230,230]],
  black_lion_gate: [extraA,2,4,355,[240,215]],
  inverness_terrace: [extraA,3,4,531,[235,215]],
  lancaster_gate: [extraB,0,4,179,[240,215]],
  lancaster_walk: [extraB,1,4,371,[240,220]],
  long_water: [extraB,2,4,121,[205,220]],
  wading: [extraB,3,4,438,[220,220]],
  meadow: [wabeA,0,4,576,[235,225]],
  summit: [wabeA,1,4,323,[240,225]],
  south_bog: [wabeA,2,4,319,[230,225]],
  north_bog: [wabeA,3,4,42,[240,225]],
  bottom_of_stairs: [wabeB,0,4,575,[240,225]],
  vertex: [wabeB,1,4,316,[240,235]],
  forest_clearing: [wabeB,2,4,426,[240,225]],
  trellises: [wabeB,3,4,317,[240,225]],
};
const anchors = {
  n:[240,16],ne:[449,29],e:[465,162],se:[449,259],s:[240,275],sw:[29,259],w:[16,162],nw:[29,29],
  u:[240,25],d:[240,259],in:[450,145],out:[25,145],
};
const labels = {n:'北',ne:'东北',e:'东',se:'东南',s:'南',sw:'西南',w:'西',nw:'西北',u:'上',d:'下',in:'进入',out:'出去'};
const objectIds={palace_gate:236,broad_walk:354,flower_walk:250,the_wabe:79,round_pond:144,black_lion_gate:355,inverness_terrace:531,lancaster_gate:179,lancaster_walk:371,long_water:121,wading:438,meadow:576,summit:323,south_bog:319,north_bog:42,bottom_of_stairs:575,vertex:316,forest_clearing:426,trellises:317};
export const SCENES = Object.fromEntries(Object.entries(sceneSpecs).map(([id,[image,panelIndex,panels,,spawn]]) => [id, {
  roomId:id, label:DEFAULT_ROOMS[id].cn, chapter:Object.hasOwn(WABE_ROOMS,id)?'wabe':'prologue', spawn,
  background:{image,panelIndex,panels,layout:panels===3?'vertical-three-panel-concept':'vertical-four-panel-concept'},
  evidence:{runtimeReferencesChecked:true,originalObjectId:objectIds[id],originalBranchesVerified:false,finalArtApproved:false},
  obstacles:[], objects:[], exits:[],
}]));
SCENES.broad_walk.obstacles=[{x:339,y:140,w:48,h:24},{x:108,y:147,w:65,h:15}];
SCENES.vertex.obstacles=[{x:211,y:143,w:68,h:16}];
// Only geometry is stored here. Conditions and destination truth stay in the engine.
export function sceneExits(roomId,state,rooms=DEFAULT_ROOMS) {
  const room=rooms[roomId];
  const exits=typeof room?.exits==='function'?room.exits(state):room?.exits||{};
  return Object.entries(exits).flatMap(([dir,value])=>{
    const target=typeof value==='string'?value:value?.to;
    if(!anchors[dir]||!SCENES[target])return [];
    const [x,y]=anchors[dir];
    const locked=typeof value==='object'&&value.when?!value.when(state):false;
    return [{dir,x,y,target,radius:17,label:`${labels[dir]} · ${rooms[target]?.cn||target}`,locked,spawn:SCENES[target].spawn}];
  });
}
for(const [id,scene] of Object.entries(SCENES)){
  const state=new GameState();state.room=id;state.chapter=scene.chapter;
  state.itemLoc=Object.fromEntries(Object.entries(ITEMS).filter(([,item])=>item.start).map(([key,item])=>[key,item.start]));
  scene.objects=getHotspots(state);
  scene.exits=sceneExits(id,state);
}
