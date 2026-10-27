// Ground traces for the remaining approved background panels, in 480×288 space.
// Room direction/target truth stays in chapter data; these are local approach
// points on visible paths, never extra connections between rooms.
import { INVERNESS_TERRAIN, INVERNESS_ACTORS } from './inverness-layout.js';
const foot = { rx: 6, ry: 3 };
const polygon = (...points) => points;
const terrain = {
  the_wabe: {
    spawn:[240,242],
    walkablePolygons:[
      polygon([210,97],[280,99],[335,112],[365,140],[370,172],[348,201],[298,219],[220,224],[166,214],[123,190],[108,159],[125,129],[164,111]),
      polygon([225,0],[256,0],[261,112],[222,112]),
      polygon([215,211],[263,211],[270,288],[205,288]),
      polygon([60,81],[128,112],[149,131],[126,153],[93,126],[44,105]),
      polygon([332,119],[373,93],[399,72],[419,91],[382,127],[357,146]),
      polygon([128,187],[157,205],[134,220],[112,226],[86,247],[60,231],[95,206]),
      polygon([341,190],[375,211],[420,246],[394,260],[353,226],[327,211]),
    ],
    blockedPolygons:[polygon([210,140],[241,130],[275,143],[278,160],[244,176],[210,162])],
    exitAnchors:{n:[241,16],nw:[103,119],ne:[379,111],sw:[96,224],se:[385,236]},
  },
  black_lion_gate:{
    spawn:[230,196],
    walkablePolygons:[
      polygon([105,0],[156,0],[160,105],[183,162],[174,202],[157,288],[91,288],[96,213],[85,166],[91,123]),
      polygon([0,140],[99,143],[168,165],[480,179],[480,234],[255,214],[151,198],[50,180],[0,178]),
    ],blockedPolygons:[],
    exitAnchors:{s:[126,275],e:[465,207],se:[277,199]},
  },
  inverness_terrace:INVERNESS_TERRAIN,
  lancaster_gate:{
    spawn:[233,219],
    walkablePolygons:[
      polygon([221,0],[258,0],[258,57],[256,96],[259,125],[275,168],[290,225],[309,288],[147,288],[162,233],[171,197],[185,153],[197,111],[206,66]),
      polygon([0,145],[92,162],[174,185],[200,173],[204,202],[132,195],[78,177],[0,167]),
    ],blockedPolygons:[],
    exitAnchors:{s:[240,275],w:[156,183],sw:[203,212]},
  },
  lancaster_walk:{
    spawn:[236,241],
    walkablePolygons:[
      polygon([222,0],[254,0],[254,82],[262,158],[279,210],[278,288],[190,288],[205,212],[211,157],[216,75]),
      polygon([0,167],[209,167],[258,169],[480,169],[480,225],[280,225],[208,222],[0,214]),
    ],blockedPolygons:[],
    exitAnchors:{n:[239,16],s:[235,275],w:[16,192],nw:[233,90],sw:[213,240],e:[465,194]},
  },
  long_water:{
    spawn:[179,226],
    walkablePolygons:[polygon([210,88],[250,88],[238,123],[223,174],[217,222],[210,288],[75,288],[109,232],[150,180],[176,144],[197,109])],
    blockedPolygons:[polygon([255,70],[480,70],[480,288],[221,288],[226,236],[230,178],[240,122])],
    exitAnchors:{e:[202,247],in:[202,247],n:[198,225],ne:[198,225],se:[198,225],s:[198,225],sw:[198,225],w:[198,225],nw:[198,225]},
  },
  wading:{
    spawn:[180,238],
    // This room is intentionally knee-deep water. Only the visible shallow
    // lower basin/riverbed is traversable; the blue water above it remains deep.
    walkablePolygons:[
      polygon([0,76],[60,87],[61,130],[46,178],[40,236],[32,288],[0,288]),
      polygon([78,162],[123,167],[174,188],[219,206],[274,226],[336,248],[377,288],[32,288],[42,226],[59,184]),
    ],blockedPolygons:[polygon([149,16],[480,16],[480,210],[345,210],[239,175],[161,140],[120,114])],
    exitAnchors:{w:[76,245]},
  },
  meadow:{
    spawn:[235,228],
    walkablePolygons:[
      polygon([179,97],[268,96],[326,116],[389,143],[391,183],[355,218],[288,238],[207,235],[140,215],[83,184],[95,149],[145,115]),
      polygon([222,0],[265,0],[269,111],[219,112]),
      polygon([214,225],[274,225],[284,288],[207,288]),
    ],blockedPolygons:[polygon([191,138],[210,122],[258,119],[288,135],[294,161],[277,183],[232,190],[198,173])],
    exitAnchors:{n:[244,16],s:[245,275],w:[111,176],e:[360,179]},
  },
  summit:{
    spawn:[249,235],
    walkablePolygons:[
      polygon([206,288],[288,288],[292,239],[285,207],[276,180],[267,156],[252,145],[234,151],[236,177],[234,202],[223,230]),
      polygon([159,90],[229,76],[301,80],[344,98],[362,127],[353,151],[317,171],[273,167],[252,144],[216,148],[183,157],[155,142],[143,114]),
      polygon([335,91],[359,75],[369,34],[371,0],[402,0],[405,42],[399,81],[386,108],[388,140],[407,158],[424,178],[441,203],[465,214],[480,218],[480,248],[444,244],[421,225],[403,200],[382,184],[364,165],[348,143]),
    ],blockedPolygons:[],
    exitAnchors:{s:[245,275],e:[462,230],ne:[388,63]},
  },
  south_bog:{
    spawn:[303,253],
    walkablePolygons:[polygon([232,0],[271,0],[267,49],[255,76],[242,106],[248,133],[266,156],[277,179],[283,210],[306,237],[337,266],[352,288],[292,288],[277,258],[254,235],[239,211],[227,185],[214,164],[202,142],[204,111],[216,78],[223,46])],
    blockedPolygons:[
      polygon([16,95],[115,88],[177,111],[180,153],[117,174],[17,150]),
      polygon([345,194],[468,185],[480,276],[370,288],[337,250]),
      polygon([287,105],[355,93],[417,108],[431,139],[413,174],[342,168],[281,141]),
    ],exitAnchors:{n:[251,16],e:[266,177],se:[331,271],s:[292,239]},
    exitLabelAnchors:{e:[266,130]},
  },
  north_bog:{
    spawn:[252,245],
    walkablePolygons:[polygon([216,0],[251,0],[255,42],[245,82],[252,116],[255,145],[248,178],[252,207],[268,244],[287,288],[227,288],[215,250],[213,218],[215,185],[221,151],[225,121],[224,92],[212,61])],
    blockedPolygons:[
      polygon([37,131],[158,120],[195,159],[190,212],[143,257],[47,268]),
      polygon([309,123],[422,113],[469,148],[468,210],[371,239],[300,205]),
    ],exitAnchors:{s:[256,271],se:[240,202]},
  },
  bottom_of_stairs:{
    spawn:[240,257],
    walkablePolygons:[
      polygon([219,0],[264,0],[271,53],[274,95],[280,130],[284,173],[299,203],[315,222],[290,244],[183,243],[176,221],[194,200],[206,168],[210,123],[216,80]),
      polygon([0,216],[104,212],[183,224],[304,218],[402,210],[480,215],[480,251],[350,248],[298,265],[285,288],[203,288],[199,266],[125,254],[0,248]),
    ],blockedPolygons:[],
    exitAnchors:{s:[241,275],sw:[149,242],w:[16,232],e:[464,232],nw:[206,212],u:[241,28]},
  },
  vertex:{
    spawn:[240,235],
    walkablePolygons:[polygon([118,99],[186,88],[278,87],[341,98],[389,126],[389,159],[363,184],[321,203],[300,228],[299,288],[164,288],[165,232],[145,212],[109,185],[89,153],[95,124])],
    blockedPolygons:[polygon([176,120],[194,108],[226,101],[265,103],[293,117],[300,139],[290,157],[252,172],[211,165],[179,145])],
    exitAnchors:{d:[233,275]},
  },
  forest_clearing:{
    spawn:[242,245],
    walkablePolygons:[
      polygon([188,99],[276,96],[339,111],[385,139],[389,183],[364,215],[300,239],[222,241],[159,228],[113,204],[93,176],[102,146],[135,119]),
      polygon([218,227],[274,227],[281,288],[209,288]),
      polygon([360,137],[389,106],[409,82],[480,66],[480,102],[428,117],[404,141],[391,173]),
    ],blockedPolygons:[],
    exitAnchors:{n:[246,111],ne:[410,105],e:[372,164]},
  },
  trellises:{
    spawn:[240,249],
    walkablePolygons:[
      polygon([219,0],[264,0],[266,54],[264,94],[274,133],[283,171],[287,215],[280,288],[202,288],[210,230],[209,190],[216,149],[213,108],[217,64]),
      polygon([0,176],[121,167],[208,165],[283,169],[388,172],[480,179],[480,220],[378,219],[287,232],[211,224],[122,217],[0,214]),
      polygon([266,178],[278,137],[287,108],[298,72],[310,71],[317,115],[310,144],[297,179],[286,196]),
    ],blockedPolygons:[],
    exitAnchors:{n:[240,16],w:[16,195],nw:[232,104],ne:[301,103]},
    exitApproaches:{ne:[.2,-1]},
  },
};
export const REMAINING_TERRAIN_ROOMS = Object.freeze(Object.keys(terrain));
export const TERRAIN_HOTSPOT_ADJUSTMENTS = Object.freeze({
  // Park on the broad upper terrace rather than sealing the narrow southern bend.
  inverness_terrace:{
    'pram:inverness_terrace':INVERNESS_ACTORS.pram,
    'inverness_terrace:boy':INVERNESS_ACTORS.boy,'inverness_terrace:headphones':INVERNESS_ACTORS.headphones,'inverness_terrace:dish':INVERNESS_ACTORS.dish,
  },
  lancaster_gate:{'lancaster_gate:tree':{radius:56},'lancaster_gate:umbrella-tree':{radius:94,
    pointerShape:{kind:'ellipse',x:325,y:119.5,rx:18,ry:14,priority:2}},'item:umbrella':{x:264,y:210}},
  lancaster_walk:{'lancaster_walk:sculpture':{radius:105}},
  long_water:{'long_water:statue':{radius:108},'long_water:missile':{radius:112},'long_water:door':{radius:145},'pram:long_water':{x:175,y:232}},
  wading:{'wading:door':{x:278,y:225,radius:42}},
  south_bog:{'south_bog:log':{radius:56}},
  vertex:{
    'vertex:sundial':{radius:60,pointerShape:{kind:'ellipse',x:245,y:132,rx:37,ry:24,priority:1}},
    'vertex:ring':{pointerShape:{kind:'annulus',x:245,y:132,rx:56,ry:37,innerRx:37,innerRy:24,priority:2}},
    'vertex:fixed-gnomon':{pointerShape:{kind:'polygon',points:[[232,110],[263,141],[232,138]],priority:3}},
  },
});
const looseAnchors={the_wabe:[242,208],black_lion_gate:[231,194],inverness_terrace:[205,239],lancaster_gate:[234,221],lancaster_walk:[236,237],long_water:[159,230],wading:[180,238],meadow:[239,222],summit:[249,235],south_bog:[305,251],north_bog:[248,243],bottom_of_stairs:[240,254],vertex:[241,208],forest_clearing:[240,223],trellises:[240,245]};

// Use this in the interaction catalog after generating the original affordances.
// Only visual position/range changes: event IDs, item IDs and commands stay intact.
export function applyTerrainHotspotAdjustments(roomId, objects) {
  const rules=TERRAIN_HOTSPOT_ADJUSTMENTS[roomId]||{};
  let looseIndex=0;
  return objects.map(object=>{
    const result={...object,...rules[object.id]};
    const loose=object.id?.startsWith('item:')||object.id?.startsWith('wabe:item:');
    const preserve=object.id==='item:gnomon'&&roomId==='the_wabe'
      ||object.itemId==='splinter'&&roomId==='south_bog'
      ||object.itemId==='umbrella'&&roomId==='lancaster_gate';
    if(loose&&!preserve&&looseAnchors[roomId]){
      const [x,y]=looseAnchors[roomId];const index=looseIndex++;
      result.x=x+(index%3-1)*11;result.y=y+Math.floor(index/3)*8;
    }
    return result;
  });
}
const copyPolygons=polygons=>polygons.map(points=>points.map(point=>[...point]));
export function applyRemainingTerrain(scenes) {
  const updated=[];
  for(const [id,spec]of Object.entries(terrain)){
    const scene=scenes[id];if(!scene)continue;
    scene.footprint={...foot};scene.spawn=[...spec.spawn];
    scene.walkablePolygons=copyPolygons(spec.walkablePolygons);
    scene.blockedPolygons=copyPolygons(spec.blockedPolygons);
    // Baked steps/platform bases are represented by the traced polygon instead
    // of retaining a second, misaligned legacy bounding rectangle.
    scene.obstacles=[];
    scene.exitAnchors={...scene.exitAnchors,...Object.fromEntries(Object.entries(spec.exitAnchors).map(([dir,point])=>[dir,[...point]]))};
    if(spec.exitApproaches)scene.exitApproaches=Object.fromEntries(Object.entries(spec.exitApproaches).map(([dir,vector])=>[dir,[...vector]]));
    if(spec.exitLabelAnchors)scene.exitLabelAnchors=Object.fromEntries(Object.entries(spec.exitLabelAnchors).map(([dir,point])=>[dir,[...point]]));
    scene.terrain={status:'basic-ground-trace',sourceImage:scene.background?.image,panelIndex:scene.background?.panelIndex,
      hotspotAdjustments:{...(TERRAIN_HOTSPOT_ADJUSTMENTS[id]||{})}};
    for(const exit of scene.exits||[]){const position=scene.exitAnchors[exit.dir];if(position)[exit.x,exit.y]=position;}
    updated.push(id);
  }
  // If called after an existing manifest has populated visual exits, refresh
  // destination spawn coordinates without ever touching direction or target.
  for(const scene of Object.values(scenes))for(const exit of scene.exits||[]){
    if(scenes[exit.target])exit.spawn=[...scenes[exit.target].spawn];
  }
  return {updated,hotspotAdjustments:TERRAIN_HOTSPOT_ADJUSTMENTS};
}
