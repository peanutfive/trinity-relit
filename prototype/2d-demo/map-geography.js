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
  arboretum:[755,505,'tree'],top_of_arbor:[750,405,'arch'],north_arbor:[860,420,'tree'],south_arbor:[850,585,'tree'],
  arborvitaes_n:[825,480,'tree'],arborvitaes_s:[665,550,'tree'],chasms_brink:[570,145,'hill'],waterfall:[240,475,'water'],
  ice_cavern:[680,105,'hill'],under_cliff:[755,145,'hill'],bluff:[840,140,'hill'],cemetery:[915,185,'arch'],
  barrow:[950,270,'hill'],ossuary:[955,350,'arch'],promontory:[370,85,'hill'],cottage:[100,225,'house'],
  herb_garden:[100,315,'flower'],moor:[925,305,'bog'],the_bend:[760,305,'water'],the_river:[805,375,'water'],
  craters_edge:[875,212,'hill'],crater:[965,252,'hill'],
};
const japan={playground:[365,340,'hill'],shelter:[730,340,'house']};
const authored={prologue:gardens,wabe:wilds,japan};

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
  const road=chapter==='prologue'&&v&&align(from,to,edge.direction)&&reverse.length>0&&reverse.every(other=>align(to,from,other.direction));
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
  if(chapter==='prologue'){
    const curve=gardenCurves[[from.id,to.id].sort().join('|')];if(curve)return curve;
  }
  return `M ${from.x} ${from.y} Q ${(from.x+to.x)/2} ${(from.y+to.y)/2-6} ${to.x} ${to.y}`;
}
