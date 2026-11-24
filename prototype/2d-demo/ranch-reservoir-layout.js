import { across, along } from './desert-trails-layout.js';

// Coordinates follow the two banks of the dirt paths in each 480 × 288 plate.
// Matching stairs share a single F hotspot per scene; water and ladder stops
// can be approached on foot without introducing chapter commands.
export const RANCH_RESERVOIR_LAYOUT = {
  north_reservoir: {
    objectId:292, spawn:[211,102], looseAnchor:[214,98],
    walkablePolygons: [
      across([[0,78,99],[43,82,102],[80,83,103],[121,86,110],[150,88,114],
        [183,91,113],[213,92,116],[252,94,115],[292,94,116],[325,94,118],
        [349,96,122],[375,102,137],[392,117,151]]),
      along([[99,118,159],[111,110,150],[125,94,130],[141,77,110],[160,64,96],
        [179,55,83],[201,45,72],[226,32,61],[246,23,51],[270,10,41],[288,4,34]]),
      along([[111,350,380],[126,361,399],[142,380,414],[161,393,427],
        [185,407,441],[207,419,454],[231,429,466],[253,439,478],[275,449,488],[288,455,492]]),
    ],
    exitAnchors:{w:[16,89],sw:[23,275],se:[464,275]},
    exitApproaches:{w:[-1,0],sw:[-0.6,1],se:[0.6,1]},
    sourceArrivals:{
      ne_ranch:{x:59,y:92,face:'right',entrance:'w'},
      front_yard:{x:45,y:229,face:'up',entrance:'sw'},
      under_windmill:{x:448,y:231,face:'up',entrance:'se'},
    },
    hiddenExitDirs:['s'],
    blockedPolygons:[
      [[43,288],[114,161],[159,128],[345,128],[385,163],[452,288]],
    ],
  },
  south_reservoir: {
    objectId:559, spawn:[213,157], looseAnchor:[157,160],
    walkablePolygons:[
      across([[0,153,182],[50,155,180],[91,152,181],[125,152,180],[167,154,177],
        [199,149,174],[222,145,172],[251,144,169],[277,142,164],[307,134,157],
        [334,122,148],[356,112,141],[377,102,128],[397,88,113]]),
      along([[0,7,34],[29,22,44],[54,32,59],[78,44,69],[102,58,82],[119,72,96],
        [138,86,108],[153,95,128],[169,107,147]]),
      along([[0,450,478],[21,438,468],[49,421,451],[74,407,434],[95,385,417],
        [113,365,399],[126,338,379],[141,310,358]]),
      [[213,154],[214,132],[217,123],[252,123],[256,149],[257,160]],
    ],
    exitAnchors:{w:[16,167],nw:[29,20],ne:[455,18],u:[235,132],n:[235,132]},
    exitApproaches:{w:[-1,0],nw:[-0.6,-1],ne:[0.6,-1]},
    sourceArrivals:{
      se_ranch:{x:58,y:168,face:'right',entrance:'w'},
      front_yard:{x:55,y:77,face:'down',entrance:'nw'},
      under_windmill:{x:428,y:62,face:'down',entrance:'ne'},
      edge_reservoir:{x:236,y:166,face:'down',entrance:'u'},
    },
    hiddenExitDirs:['n'], interactionExitDirs:['u'],
    passageVisuals:{u:{label:'上台阶',radius:26,pointerShape:{
      kind:'polygon',points:[[217,103],[252,103],[256,136],[213,136]],priority:3,
    }}},
    blockedPolygons:[
      [[79,0],[410,0],[383,57],[330,96],[256,106],[254,119],[217,119],[215,108],
        [144,106],[100,62]],
    ],
  },
  under_windmill: {
    objectId:300, spawn:[223,151], looseAnchor:[220,165],
    walkablePolygons:[
      across([[0,-9,4],[25,1,20],[45,13,30],[69,23,40],[97,32,56],[121,39,65],
        [145,49,76],[165,59,85],[187,72,98],[205,85,113],[217,98,127]]),
      along([[91,180,206],[104,188,219],[121,198,235],[139,201,248],[157,199,252],
        [174,194,253],[189,182,238],[206,163,213],[222,133,188],[241,98,152],
        [259,70,121],[275,49,94],[288,31,80]]),
      [[210,137],[238,132],[254,139],[273,148],[297,148],[307,172],
        [282,186],[255,191],[220,190]],
    ],
    exitAnchors:{nw:[36,18],sw:[69,275],u:[269,164]},
    exitApproaches:{nw:[-1,-0.6],sw:[-1,0.6]},
    sourceArrivals:{
      north_reservoir:{x:104,y:49,face:'right',entrance:'nw'},
      south_reservoir:{x:110,y:247,face:'right',entrance:'sw'},
    },
    hiddenExitDirs:['w'], omitSelfExitDirs:['u'], showUnmadeExits:true,
    blockedPolygons:[
      [[0,1],[33,26],[78,46],[151,74],[173,140],[154,192],[91,232],[0,288]],
      [[243,153],[250,152],[251,162],[244,164]],[[303,155],[311,152],[317,165],[311,170]],
      [[255,132],[278,132],[296,138],[300,148],[292,150],[257,143]],
    ],
    occluders:[
      {depthY:162,points:[[264,71],[269,71],[251,157],[247,163],[242,162]]},
      {depthY:167,points:[[292,71],[298,69],[318,164],[315,168],[310,167]]},
      {depthY:148,points:[[250,119],[305,125],[306,129],[250,123]]},
    ],
  },
  edge_reservoir: {
    objectId:336, spawn:[234,163], looseAnchor:[233,159],
    walkablePolygons:[
      [[98,125],[143,126],[207,126],[260,125],[307,124],[362,123],[357,142],[337,158],
        [313,172],[278,183],[254,204],[250,212],[215,212],[204,202],[190,191],[157,181],
        [131,170],[112,154],[101,143]],
    ],
    exitAnchors:{d:[234,205],s:[234,205],n:[236,134]},
    sourceArrivals:{south_reservoir:{x:252,y:182,face:'up',entrance:'d'}},
    hiddenExitDirs:['s','in','ne','e','se','sw','w','nw'], interactionExitDirs:['d'], showUnmadeExits:true,
    passageVisuals:{d:{label:'下台阶',radius:26,pointerShape:{
      kind:'polygon',points:[[211,202],[256,202],[263,255],[205,255]],priority:3,
    }}},
    blockedPolygons:[
      [[0,0],[480,0],[480,114],[367,112],[356,121],[273,123],[201,124],[103,121],[92,114],[0,114]],
    ],
  },
};

for (const [id, scene] of Object.entries(RANCH_RESERVOIR_LAYOUT)) {
  Object.assign(scene, {
    chapter:'ranch', image:`./assets/ranch-reservoir-${id}-v1.png`,
    footprint:{rx:6,ry:3}, pathResolution:0.25, obstacles:[], occluders:scene.occluders || [],
  });
}
