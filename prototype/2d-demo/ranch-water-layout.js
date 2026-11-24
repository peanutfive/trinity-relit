// Depth changes follow the swimmer. Only the concrete landing has a fixed
// exit on the surface. Its aliases are one physical place on the painting.
const walls = ['n','ne','e','se','sw','w','nw'];
const depthAction = (label) => ({label,navigationHint:label,actorRelative:true,radius:19,
  pointerShape:{kind:'ellipse',rx:11,ry:8,priority:0}});
const basin = [[8,8],[472,8],[472,195],[374,205],[338,211],[133,211],[101,206],[8,195]];
export const RANCH_WATER_LAYOUT = {
  reservoir:{
    objectId:457,spawn:[275,160],looseAnchor:[240,157],walkablePolygons:[basin],
    exitAnchors:{s:[236,203],d:[275,160]},hiddenExitDirs:[...walls,'in','u','out'],
    interactionExitDirs:['s','d'],propOnlyExitDirs:['d','s'],
    passageVisuals:{d:depthAction('下潜'),s:{label:'攀上岸沿',navigationHint:'上岸',radius:21,shoreline:[112,363],
      pointerShape:{kind:'polygon',points:[[101,209],[375,209],[375,235],[101,235]],priority:3}}},
    sourceArrivals:{windmill:{x:333,y:141,face:'left'},edge_reservoir:{x:235,y:176,face:'up',entrance:'s'}},
  },
  underwater:{
    objectId:242,spawn:[270,158],looseAnchor:[282,177],
    walkablePolygons:[[[12,51],[469,51],[469,268],[12,268]]],
    exitAnchors:{u:[258,143]},hiddenExitDirs:[...walls,'s','d','in','out'],
    interactionExitDirs:['u'],propOnlyExitDirs:['u'],passageVisuals:{u:depthAction('浮上水面')},
    binocularsPlacement:{at:[320,165],pointerShape:{kind:'ellipse',x:320,y:161,rx:9,ry:6,priority:4}},
  },
};
for(const [id,layout] of Object.entries(RANCH_WATER_LAYOUT)){
  Object.assign(layout,{chapter:'ranch',image:`./assets/ranch-reservoir-${id}-v1.png`,
    footprint:{rx:6,ry:3},pathResolution:.25,obstacles:[],occluders:[]});
}
