// Original illustrated chart, not a room grid. Artwork never defines exits.
// These positions remain stable as exploration reveals more names. The river
// and higher/lower locations cannot be unfolded into a Euclidean road map.
export const MAP_SIZE=Object.freeze({width:1080,height:680});
const gardens={
  palace_gate:[186,570,'gate'],broad_walk:[186,322,'statue'],flower_walk:[730,570,'flower'],
  the_wabe:[463,470,'sundial'],round_pond:[463,333,'pond'],black_lion_gate:[186,115,'gate'],
  inverness_terrace:[463,115,'bench'],lancaster_gate:[730,115,'gate'],lancaster_walk:[730,322,'tree'],
  long_water:[907,322,'water'],wading:[940,476,'water'],
};
const wilds={
  meadow:[200,315,'sundial'],summit:[200,156,'hill'],south_bog:[385,345,'bog'],north_bog:[385,180,'bog'],
  bottom_of_stairs:[575,305,'stairs'],vertex:[600,210,'sundial'],forest_clearing:[385,495,'tree'],trellises:[575,495,'arch'],
  arboretum:[720,610,'tree'],top_of_arbor:[735,425,'arch'],north_arbor:[865,430,'tree'],south_arbor:[865,625,'tree'],
  arborvitaes_n:[825,525,'tree'],arborvitaes_s:[555,610,'tree'],chasms_brink:[570,145,'hill'],waterfall:[240,475,'water'],
  ice_cavern:[680,105,'hill'],under_cliff:[755,145,'hill'],bluff:[840,140,'hill'],cemetery:[955,395,'arch'],
  barrow:[955,475,'hill'],ossuary:[955,560,'arch'],promontory:[370,85,'hill'],cottage:[940,110,'house'],
  herb_garden:[1035,110,'flower'],moor:[925,305,'bog'],the_bend:[760,305,'water'],the_river:[805,375,'water'],
  craters_edge:[875,212,'hill'],crater:[965,252,'hill'],
};
const japan={playground:[365,340,'hill'],shelter:[730,340,'house']};
const underground={underground_1:[220,340,'arch'],underground_2:[540,340,'place'],underground_3:[860,340,'house']};
const orbit={orbit_satellite:[380,282,'satellite'],orbit_space:[720,205,'orbit']};
// The mesa is a separate Wabe viewpoint in the current chapter adapter. Keep
// it off the island; the two scaffold levels are stacked, never a flat road.
const pacific={mesa:[140,170,'hill'],scaffold:[600,245,'house'],bottom_scaffold:[600,390,'stairs'],north_beach:[600,100,'water'],south_beach:[600,560,'water'],west_beach:[330,350,'water'],east_beach:[870,350,'water']};
const tundra={tundra_6:[180,180,'hill'],tundra_5:[450,180,'hill'],tundra_4:[720,180,'hill'],tundra_3:[180,350,'place'],under_platform:[450,350,'stairs'],tundra_2:[720,350,'place'],tundra_1:[180,520,'gate'],tundra_8:[450,520,'place'],tundra_7:[720,520,'place'],platform:[965,350,'house'],cliff_edge:[965,170,'hill']};
const islet={islet:[525,458,'island'],sand_bar:[556,212,'water']};
// The sand track runs west–east. The foothills form a separate north–south
// chain: two of their east exits return by going south from the desert.
// The paved road is charted on its own meridian; only visited places are drawn.
const desert={
  desert_1:[154,156,'dune'], desert_2:[229,192,'dune'], desert_3:[304,225,'dune'],
  desert_4:[380,259,'dune'], desert_5:[455,296,'dune'], shallow_crater:[540,337,'basin'],
  desert_6:[658,321,'dune'], desert_7:[758,300,'dune'], desert_8:[858,272,'dune'],
  desert_9:[963,245,'dune'],
  foothills_1:[165,329,'hill'], foothills_2:[205,423,'hill'], foothills_3:[241,540,'hill'],
  paved_road_1:[66,584,'lane'], paved_road_2:[66,501,'lane'], paved_road_3:[66,418,'lane'],
  paved_road_4:[66,335,'lane'], paved_road_5:[66,231,'lane'], paved_road_6:[66,123,'lane'],
};
const authored={prologue:gardens,wabe:wilds,japan,underground,orbit,pacific,tundra,islet,desert};

/** Only already discovered nodes are returned. No name/count/edge disclosure. */
export function illustratedMapNodes(model){
  const positions=authored[model.chapter]||{};
  return model.nodes.map(node=>{
    const entry=positions[node.id];
    return {...node,x:entry?.[0]??node.x/(model.width||960)*MAP_SIZE.width,
      y:entry?.[1]??node.y/(model.height||570)*MAP_SIZE.height,icon:entry?.[2]||'place'};
  });
}

const vectors={n:[0,-1],ne:[1,-1],e:[1,0],se:[1,1],s:[0,1],sw:[-1,1],w:[-1,0],nw:[-1,-1]};
/** A connection is a road only if both source directions agree with the chart.
 * All Wabe connections are schematic: Klein-bottle and vertical passages must
 * never acquire a misleading physical road simply from their drawing positions.
 */
export function chartConnection(edge,nodes,chapter,edges=[]){
  const byId=new Map(nodes.map(node=>[node.id,node]));
  const from=byId.get(edge.from),to=byId.get(edge.to),v=vectors[edge.direction];
  if(!from||!to)return null;
  const align=(a,b,direction)=>{
    const directionVector=vectors[direction];if(!directionVector)return false;
    const dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy)*Math.hypot(...directionVector);
    return length>0&&(dx*directionVector[0]+dy*directionVector[1])/length>.83;
  };
  const reverse=edges.filter(other=>other.from===edge.to&&other.to===edge.from);
  const chartedGround=chapter==='prologue'||(['islet','desert'].includes(chapter)&&authored[chapter][from.id]&&authored[chapter][to.id]);
  const road=chartedGround&&!from.unknownVisual&&!to.unknownVisual&&v&&align(from,to,edge.direction)&&reverse.length>0&&reverse.every(other=>align(to,from,other.direction));
  return {from,to,road:!!road,schematic:!road};
}

// Draw the park's approaches along the shore, never across the water. Each
// curve belongs to an existing pair; looking it up does not create a new edge.
const gardenCurves={
  'inverness_terrace|round_pond':'M 463 115 C 366 153 339 199 342 254 C 345 304 389 328 463 333',
  'black_lion_gate|round_pond':'M 186 115 C 254 158 321 196 342 254 C 354 302 389 328 463 333',
  'lancaster_gate|round_pond':'M 730 115 C 650 145 591 196 589 250 C 586 301 538 329 463 333',
  'inverness_terrace|lancaster_walk':'M 463 115 C 552 150 620 184 635 248 Q 649 298 730 322',
  'broad_walk|inverness_terrace':'M 186 322 Q 278 256 342 194 Q 400 143 463 115',
};
export function chartRoadPath(from,to,chapter){
  if(chapter==='orbit'){
    // Two authored floating viewpoints, not compass-aligned ground locations.
    // Reversed aliases share a single arc; the model retains their directions.
    const [left,right]=[from,to].sort((a,b)=>a.x-b.x);
    return `M ${left.x} ${left.y} C ${left.x+90} ${left.y-95} ${right.x-100} ${right.y-60} ${right.x} ${right.y}`;
  }
  if(chapter==='prologue'){
    const curve=gardenCurves[[from.id,to.id].sort().join('|')];if(curve)return curve;
  }
  return `M ${from.x} ${from.y} Q ${(from.x+to.x)/2} ${(from.y+to.y)/2-6} ${to.x} ${to.y}`;
}
