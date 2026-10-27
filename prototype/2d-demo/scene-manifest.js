import { ROOMS as PROLOGUE_ROOMS } from '../js/data/prologue.js';
import { ROOMS as WABE_ROOMS } from '../js/data/wabe.js';
import { ROOMS as JAPAN_ROOMS } from '../js/data/japan.js';
import { JAPAN_ROUTE_LAYOUT } from './japan-route-layout.js';
import { GameState } from '../js/engine.js';
import { ITEMS } from '../js/data/items.js';
import { getHotspots } from './interaction-catalog.js';
import { applyRemainingTerrain } from './terrain.js';
export const SCENE_SCHEMA_VERSION = 2;
export const LOGICAL_SIZE = { width: 480, height: 288 };
export const BACKGROUND_ATLAS = './assets/gardens-hd2d.png';
const base = './assets/gardens-hd2d.png';
const extraA = './assets/gardens-extra-a.png';
const extraB = './assets/gardens-extra-b.png';
const wabeA = './assets/wabe-a.png';
const wabeB = './assets/wabe-b.png';
const DEFAULT_ROOMS = { ...PROLOGUE_ROOMS, ...WABE_ROOMS, ...JAPAN_ROOMS };
const sceneSpecs = {
  palace_gate: [base,0,3,236,[238,218]],
  broad_walk: [base,1,3,354,[240,250]],
  flower_walk: [base,2,3,250,[32,162]],
  the_wabe: [extraA,0,4,79,[240,225]],
  round_pond: [extraA,1,4,144,[235,242]],
  black_lion_gate: [extraA,2,4,355,[240,215]],
  inverness_terrace: ['./assets/inverness-terrace-v2.png',0,1,531,[235,101]],
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
  background:{image,panelIndex,panels,layout:panels===1?'single-scene':panels===3?'vertical-three-panel-concept':'vertical-four-panel-concept'},
  evidence:{runtimeReferencesChecked:true,originalObjectId:objectIds[id],originalBranchesVerified:false,finalArtApproved:false},
  obstacles:[], objects:[], exits:[],
}]));
for(const [id,layout] of Object.entries(JAPAN_ROUTE_LAYOUT))SCENES[id]={
  ...layout,roomId:id,label:DEFAULT_ROOMS[id].cn,
  background:{image:layout.image,panelIndex:0,panels:1,layout:'single-scene'},
  evidence:{runtimeReferencesChecked:true,originalObjectId:layout.objectId,originalBranchesVerified:false,finalArtApproved:false},
  footprint:{rx:6,ry:3},objects:[],exits:[],
};
// One painted entrance can have several original command aliases. Keep every
// command in the catalog without drawing duplicate doors or auto-entering one.
Object.assign(SCENES.moor,{interactionExitDirs:['in']});
Object.assign(SCENES.playground,{interactionExitDirs:['in','out'],exitLabels:{n:'北 · 孩子们',s:'南 · 老师们',e:'东 · 避难所'}});
Object.assign(SCENES.shelter,{interactionExitDirs:['out'],hiddenExitDirs:['d','in']});
// Ground meshes traced against the current background panels, in 480×288 space.
// The first four detailed meshes are complemented by terrain.js below.
const foot = { rx: 6, ry: 3 };
function roadStrip(points){
  const left=[],right=[];
  const normal=(a,b)=>{const length=Math.hypot(b[0]-a[0],b[1]-a[1]);return [-(b[1]-a[1])/length,(b[0]-a[0])/length];};
  points.forEach(([x,y,r],index)=>{
    const a=normal(points[Math.max(0,index-1)],points[index?index:1]),b=normal(points[index===points.length-1?index-1:index],points[Math.min(points.length-1,index+1)]);
    const length=Math.hypot(a[0]+b[0],a[1]+b[1]),nx=(a[0]+b[0])/length,ny=(a[1]+b[1])/length;
    const reach=r/Math.max(.6,nx*a[0]+ny*a[1]);
    left.push([x+nx*reach,y+ny*reach]);right.push([x-nx*reach,y-ny*reach]);
  });
  const cap=([x,y,r])=>Array.from({length:12},(_,index)=>{const angle=index/12*Math.PI*2;return [x+Math.cos(angle)*r,y+Math.sin(angle)*r];});
  return [[...left,...right.reverse()],cap(points[0]),cap(points.at(-1))];
}
Object.assign(SCENES.palace_gate, {
  footprint: { ...foot },
  // Solid silhouettes only: the open iron gates contain visible ground between bars.
  occluders: [
    { depthY:232, points:[[164,117],[168,116],[169,112],[171,112],[172,117],[176,120],[175,132],[172,136],[172,141],[179,142],[179,147],[183,147],[183,151],[187,151],[185,157],[183,160],[183,210],[186,217],[185,232],[156,232],[156,219],[159,214],[159,161],[155,160],[153,154],[157,148],[161,147],[161,143],[168,141],[168,136],[164,132]] },
    { depthY:232, points:[[304,118],[308,116],[309,112],[311,112],[312,117],[316,120],[315,132],[312,136],[312,141],[319,142],[319,147],[323,148],[324,155],[322,160],[321,211],[324,219],[323,232],[294,232],[293,218],[297,211],[297,161],[293,159],[292,153],[296,148],[299,147],[299,143],[307,141],[307,136],[304,132]] },
    { material:'iron-bars', depthY:218, points:[[188,160],[215,140],[216,210],[188,218]] },
    { material:'iron-bars', depthY:218, points:[[270,140],[295,160],[295,218],[270,210]] },
  ],
  walkablePolygons: [
    [[224,0],[270,0],[274,132],[290,196],[309,288],[145,288],[185,222],[207,174],[216,110]],
    [[253,143],[480,143],[480,176],[302,178],[268,190],[247,173]],
  ],
  // Pillars occupy their ground-level bases. Their tall upper silhouettes only
  // occlude actors; they must not wall off the eastbound path behind the gate.
  obstacles: [{ x: 156, y: 216, w: 31, h: 16 }, { x: 293, y: 216, w: 32, h: 16 }],
  exitAnchors: { n:[248,16], e:[465,158], ne:[251,88] },
});
Object.assign(SCENES.broad_walk, {
  footprint: { ...foot },
  // The bench's open space under its seat stays transparent to actors.
  occluders: [
    { role:'bench-back', depthY:165, points:[[103,144],[104,142],[106,142],[107,144],[171,144],[172,142],[174,142],[175,144],[175,156],[172,157],[171,156],[107,156],[106,158],[103,157]] },
    { depthY:172, points:[[102,159],[105,159],[106,160],[172,160],[175,158],[177,160],[178,161],[176,163],[101,163],[100,161]] },
    { depthY:172, points:[[100,154],[102,153],[104,154],[105,157],[104,160],[101,160],[101,158],[100,157]] },
    { depthY:172, points:[[175,155],[179,154],[181,155],[181,157],[178,157],[177,160],[175,159]] },
    { depthY:172, points:[[103,161],[107,162],[107,167],[109,169],[109,171],[103,171],[102,173],[99,173],[100,169],[100,165]] },
    { depthY:172, points:[[133,163],[137,163],[137,168],[139,170],[139,172],[133,172],[132,170]] },
    { depthY:172, points:[[169,162],[173,162],[173,168],[174,170],[177,171],[177,173],[169,173],[168,170]] },
  ],
  walkablePolygons: [
    [[219,0],[263,0],[270,96],[283,190],[299,288],[173,288],[195,183],[207,88]],
    [[104,171],[207,166],[225,190],[196,203],[109,197]],
    [[269,178],[398,178],[413,206],[338,213],[279,210]],
  ],
  obstacles: [{ x: 339, y: 140, w: 48, h: 34 }, { x: 108, y: 147, w: 65, h: 15 }],
  exitAnchors: { n:[240,16], s:[240,275], e:[291,198], ne:[246,68], se:[267,246] },
});
Object.assign(SCENES.flower_walk, {
  footprint: { ...foot },
  // Use the near bed's dense foliage; sparse flower stalks above stay outside the mask.
  occluders: [
    { depthY:234, points:[[280,222],[278,214],[279,208],[285,207],[287,202],[293,202],[297,200],[303,202],[308,199],[314,200],[320,197],[327,201],[333,199],[340,202],[346,199],[353,201],[359,198],[365,201],[372,201],[379,203],[386,202],[393,204],[400,204],[407,208],[413,207],[419,210],[425,211],[430,217],[431,222],[435,225],[435,230],[280,230]] },
  ],
  walkablePolygons: [
    [[229,0],[271,0],[276,140],[281,205],[285,288],[215,288],[222,200],[227,117]],
    [[0,145],[240,145],[276,140],[280,179],[0,179]],
    [[265,132],[432,132],[443,182],[270,182]],
  ],
  blockedPolygons: [
    [[280,85],[427,85],[433,126],[277,126]],
    [[278,187],[430,187],[435,235],[278,235]],
  ],
  exitAnchors: { w:[16,162], n:[250,16], nw:[246,92] },
});
Object.assign(SCENES.round_pond, {
  footprint: { ...foot },
  // Flower bowl and stone pedestal at the southern path's left edge.
  occluders: [
    { depthY:270, points:[[194,211],[198,212],[201,210],[204,213],[208,211],[211,215],[214,216],[215,220],[218,221],[217,225],[214,228],[214,232],[211,234],[210,237],[214,238],[215,242],[213,246],[213,261],[215,263],[214,270],[192,270],[191,266],[193,262],[193,246],[191,243],[191,239],[196,237],[198,234],[195,232],[194,228],[190,227],[190,222],[188,220],[191,216],[190,214]] },
  ],
  walkablePolygons: [
    // Broad bank path sweeps around the left and lower edge of the pond.
    [[15,89],[65,76],[100,91],[103,118],[132,145],[175,166],[238,184],[310,195],[379,198],[480,196],[480,224],[379,226],[302,223],[233,212],[172,196],[121,175],[87,152],[56,148],[0,180],[0,151],[45,121],[56,103],[0,82]],
    // Upper approach and narrow path behind the left-hand shore.
    [[214,0],[264,0],[264,39],[233,44],[194,53],[152,66],[121,82],[108,101],[86,88],[115,62],[155,45],[201,35],[218,33]],
    ...roadStrip([[100,160,12],[90,140,12],[76,120,12],[80,99,10],[100,87,10],[122,75,9],[150,63,8],[180,52,8],[211,43,7],[240,35,7]]),
    // A real narrow footpath runs BEHIND the northern stone bank toward the
    // upper-right branch. Keep it above the water polygon, not across the pond.
    [[228,29],[272,29],[315,30],[355,31],[394,33],[414,29],[420,17],[429,11],[438,19],[435,35],[427,45],[417,44],[395,47],[355,45],[315,44],[272,43],[236,43]],
    [[0,51],[59,65],[101,85],[91,111],[48,92],[0,80]],
    // The southern continuation is the only lower-screen opening.
    [[214,200],[270,204],[275,288],[207,288],[212,248]],
  ],
  blockedPolygons: [
    // Water and its planted/railed rim are never walkable in this room.
    [[219,49],[480,43],[480,190],[387,193],[300,187],[220,173],[158,148],[127,125],[126,98],[151,75]],
  ],
  obstacles: [],
  exitAnchors: { w:[16,162], n:[240,16], nw:[16,67], ne:[425,22], e:[465,211], s:[240,275] },
});
SCENES.vertex.obstacles=[{x:211,y:143,w:68,h:16}];
// Only geometry is stored here. Conditions and destination truth stay in the engine.
export function sceneExits(roomId,state,rooms=DEFAULT_ROOMS) {
  const room=rooms[roomId];
  const exits=typeof room?.exits==='function'?room.exits(state):room?.exits||{};
  return Object.entries(exits).flatMap(([dir,value])=>{
    const target=typeof value==='string'?value:value?.to;
    if(!anchors[dir]||!SCENES[target]||SCENES[roomId].hiddenExitDirs?.includes(dir))return [];
    const [x,y]=SCENES[roomId].exitAnchors?.[dir]||anchors[dir];
    const locked=typeof value==='object'&&value.when?!value.when(state):false;
    const approach=SCENES[roomId].exitApproaches?.[dir];
    return [{dir,x,y,target,radius:17,label:SCENES[roomId].exitLabels?.[dir]||`${labels[dir]} · ${rooms[target]?.cn||target}`,locked,spawn:SCENES[target].spawn,interactionOnly:!!SCENES[roomId].interactionExitDirs?.includes(dir),...(approach?{approach:[...approach]}:{})}];
  });
}
// Production boundaries remain visible roads, rather than fake traversable
// exits. They never submit a command, change the graph or advance a turn.
export function sceneBoundaries(roomId,state,rooms=DEFAULT_ROOMS){
  const scene=SCENES[roomId];if(!scene?.showUnmadeExits)return [];
  const room=rooms[roomId],exits=typeof room.exits==='function'?room.exits(state):room.exits||{};
  return Object.entries(exits).flatMap(([dir,value])=>{
    const target=typeof value==='string'?value:value?.to,anchor=scene.exitAnchors?.[dir];
    return target&&!SCENES[target]&&anchor?[{dir,target,x:anchor[0],y:anchor[1]}]:[];
  });
}
applyRemainingTerrain(SCENES);
for(const [id,scene] of Object.entries(SCENES)){
  const state=new GameState();state.room=id;state.chapter=scene.chapter;
  state.itemLoc=Object.fromEntries(Object.entries(ITEMS).filter(([,item])=>item.start).map(([key,item])=>[key,item.start]));
  scene.objects=getHotspots(state);
  scene.exits=sceneExits(id,state);
}
