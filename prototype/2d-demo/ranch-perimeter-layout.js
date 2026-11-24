import { across, along } from './desert-trails-layout.js';

// Coordinates are feet on the 480 × 288 background. Chapter rules supply the
// destinations. Reserved scenery has no exit sensor.
export const RANCH_PERIMETER_LAYOUT = {
  nw_ranch: {
    spawn: [161, 121], looseAnchor: [151, 153],
    walkablePolygons: [
      along([[94,148,203],[108,136,212],[121,132,201],[138,124,181],
        [159,117,169],[187,117,166],[212,118,169],[242,123,174],[270,125,175],[288,124,177]]),
      across([[153,99,132],[176,90,126],[196,83,119],[217,77,112],
        [249,73,105],[277,72,102],[318,74,102],[370,75,101],[424,75,102],[480,75,100]]),
      across([[0,9,27],[29,28,47],[62,49,69],[95,68,91],[129,90,114],[155,98,127]]),
      [[157,119],[176,108],[198,96],[224,95],[243,102],[244,114],[237,122],
        [219,133],[208,140],[198,146],[183,150],[166,144],[157,136]],
      [[206,128],[226,115],[245,117],[245,129],[222,144],[211,145]],
    ],
    exitAnchors: { e:[464,88], s:[150,275], nw:[18,29], se:[230,130] },
    exitApproaches: { nw:[-1,-0.6], se:[0.8,1] },
    hiddenExitDirs: ['n','in'], omitSelfExitDirs:['se'],
    sourceArrivals: {
      ne_ranch:{x:424,y:88,face:'left',entrance:'e'},
      sw_ranch:{x:148,y:237,face:'up',entrance:'s'},
      shallow_crater:{x:82,y:71,face:'right',entrance:'nw'},
      back_yard:{x:200,y:110,face:'left',entrance:'se'},
    },
    blockedPolygons: [
      [[186,288],[187,213],[184,178],[188,160],[197,148],[209,139],[216,140],[217,148],
        [206,153],[199,162],[193,178],[195,214],[198,288]],
      [[247,117],[270,109],[329,106],[480,108],[480,132],[329,130],[269,132],[249,137]],
    ],
    occluders: [
      {depthY:132,points:[[248,114],[275,106],[330,103],[480,106],[480,128],[332,127],[274,128],[249,135]]},
    ],
    doorPlacement:{
      id:'nw_ranch:iron-gate',flag:'back_yard_iron_gate_open',noun:'iron gate',label:'铁门',dir:'se',
      openOverlay:'ranch-nw_ranch-gate-open',at:[230,130],approach:[216,126],openLeafApproach:[229,106],
      pointerShape:{kind:'polygon',points:[[213,127],[246,109],[247,130],[214,150]],priority:3},
      openingShape:{kind:'polygon',points:[[216,128],[242,114],[242,132],[216,147]],priority:4},
      openLeafShape:{kind:'polygon',points:[[245,114],[262,133],[262,155],[245,132]],priority:5},
      closedObstacles:[{x:212,y:139,w:9,h:6},{x:221,y:133,w:9,h:6},{x:230,y:128,w:9,h:6},{x:239,y:123,w:8,h:6}],
      openObstacles:[{x:245,y:130,w:3,h:5},{x:248,y:134,w:3,h:5},{x:251,y:138,w:3,h:5},
        {x:254,y:142,w:3,h:5},{x:257,y:146,w:3,h:5},{x:260,y:151,w:2,h:4}],
    },
    reservedFeatures: [
      {kind:'unresolved',dirs:['n'],target:'behind_shed'},
    ],
  },
  ne_ranch: {
    spawn: [245,127], looseAnchor: [255,165],
    walkablePolygons: [
      across([[0,76,100],[56,76,101],[105,76,105],[150,79,109],[184,84,119],
        [203,87,129],[217,91,140],[236,96,152],[253,105,151],[270,108,141]]),
      along([[113,217,266],[130,210,275],[145,222,278],[165,231,282],[191,233,282],
        [220,232,281],[242,230,279],[266,226,276],[288,223,273]]),
      across([[248,104,121],[271,99,114],[309,93,107],[355,90,104],[410,90,103],[480,89,102]]),
    ],
    exitAnchors: { w:[16,88], s:[249,275], e:[461,96] },
    hiddenExitDirs: ['se','sw','in'],
    sourceArrivals: {
      nw_ranch:{x:57,y:88,face:'right',entrance:'w'},
      front_yard:{x:255,y:236,face:'up',entrance:'s'},
      north_reservoir:{x:422,y:97,face:'left',entrance:'e'},
    },
    blockedPolygons: [
      [[0,106],[104,111],[150,116],[183,129],[202,147],[214,172],[214,210],
        [197,288],[186,288],[204,210],[204,175],[194,152],[179,137],[148,126],[103,119],[0,115]],
      [[293,288],[299,194],[317,163],[375,126],[480,125],[480,288]],
    ],
    occluders: [
      {depthY:126,points:[[0,103],[104,107],[150,113],[150,125],[104,117],[0,114]]},
      {depthY:138,points:[[150,113],[179,124],[187,130],[185,141],[178,135],[150,125]]},
    ],
    reservedFeatures: [],
  },
  front_yard: {
    spawn: [218,145], looseAnchor: [215,145],
    walkablePolygons: [
      along([[0,192,228],[23,185,222],[48,181,221],[68,181,228],[88,183,231],[109,189,238],
        [129,194,243],[146,196,247],[163,195,248],[182,191,247],[201,186,242],[224,180,235],
        [247,174,231],[271,168,229],[288,165,229]]),
      across([[211,61,92],[239,57,80],[266,49,67],[301,39,57],[346,30,45],[384,22,35],
        [421,8,24],[450,-3,11],[473,-7,1]]),
      across([[225,160,182],[251,166,188],[278,171,191],[309,183,204],[348,200,221],
        [389,217,239],[428,235,255],[456,250,274],[480,265,288]]),
      [[105,98],[135,104],[159,111],[182,113],[201,116],[201,134],[174,129],[151,124],[128,118],[105,113]],
    ],
    exitAnchors: { n:[209,16], s:[199,275], ne:[431,14], se:[462,267], w:[151,117] },
    exitApproaches: { ne:[1,-0.55], se:[1,0.6] },
    hiddenExitDirs: ['e','sw','nw','u','in'],
    interactionExitDirs: ['w'],
    passageVisuals: {w: {label:'上坡',navigationHint:'上坡',radius:24,pointerShape:{
      kind:'polygon',points:[[106,97],[146,105],[178,112],[182,128],[147,123],[106,113]],priority:3,
    }}},
    sourceArrivals: {
      ne_ranch:{x:201,y:56,face:'down',entrance:'n'},
      se_ranch:{x:206,y:236,face:'up',entrance:'s'},
      north_reservoir:{x:308,y:46,face:'left',entrance:'ne'},
      south_reservoir:{x:425,y:245,face:'left',entrance:'se'},
      front_deck:{x:183,y:124,face:'right',entrance:'w'},
    },
    blockedPolygons: [
      [[139,0],[147,0],[147,52],[156,103],[149,105],[141,62]],
      [[150,127],[162,129],[162,174],[156,208],[130,288],[119,288],[146,205],[153,175]],
      [[327,164],[330,80],[360,54],[480,37],[480,202],[397,196]],
    ],
    occluders: [],
    reservedFeatures: [],
  },
  se_ranch: {
    spawn: [244,131], looseAnchor: [144,154],
    walkablePolygons: [
      along([[0,255,290],[32,258,294],[57,256,296],[80,254,294],[94,247,291],
        [108,231,285],[123,209,277],[136,201,256],[146,193,238]]),
      across([[0,148,179],[63,148,177],[110,146,177],[146,141,175],[170,136,172],[190,130,168],
        [212,120,161],[232,111,153],[253,105,142],[274,104,129]]),
      across([[264,118,135],[287,123,139],[320,128,141],[362,130,142],[419,130,141],[480,130,142]]),
      [[245,118],[230,101],[217,88],[207,78],[197,70],[184,77],
        [195,94],[208,111],[230,132]],
    ],
    exitAnchors: { w:[16,163], n:[275,16], e:[460,136], nw:[207,89] },
    exitApproaches: {nw:[-0.8,-1]},
    hiddenExitDirs: ['ne','in'],
    sourceArrivals: {
      sw_ranch:{x:56,y:163,face:'right',entrance:'w'},
      front_yard:{x:276,y:56,face:'down',entrance:'n'},
      south_reservoir:{x:419,y:136,face:'left',entrance:'e'},
      se_yard:{x:230,y:119,face:'down',entrance:'nw'},
    },
    blockedPolygons: [
      [[0,115],[125,114],[156,111],[185,101],[194,103],[193,115],[158,123],[120,126],[0,127]],
      [[217,72],[227,63],[231,35],[232,0],[239,0],[237,46],[231,72],[223,89],[215,90]],
      [[168,79],[176,83],[193,99],[194,109],[186,106],[167,88]],
      [[323,101],[355,0],[480,0],[480,115]],
    ],
    occluders: [],
    reservedFeatures: [],
  },
  sw_ranch: {
    spawn: [164,149], looseAnchor: [166,154],
    walkablePolygons: [
      along([[0,145,182],[24,138,177],[47,135,174],[71,134,172],[98,131,171],
        [121,130,175],[140,132,189],[156,137,206],[171,147,211],[183,164,206]]),
      across([[153,151,175],[170,148,185],[194,151,193],[216,160,198],[244,168,202],
        [275,172,205],[321,173,205],[365,174,204],[408,173,205],[449,172,205],[480,172,206]]),
      across([[160,145,161],[179,135,153],[201,123,140],[221,114,130],[239,107,119],[245,107,115]]),
      [[213,119],[240,98],[249,97],[260,106],[239,126],[218,130]],
    ],
    exitAnchors: { n:[160,16], e:[464,188], ne:[242,112] },
    exitApproaches:{ne:[1,-0.68]}, hiddenExitDirs: ['in'], omitSelfExitDirs:['ne'],
    sourceArrivals: {
      nw_ranch:{x:155,y:55,face:'down',entrance:'n'},
      se_ranch:{x:423,y:189,face:'left',entrance:'e'},
      sw_yard:{x:209,y:128,face:'left',entrance:'ne'},
    },
    blockedPolygons: [
      [[196,0],[210,0],[200,35],[203,52],[218,77],[227,80],[228,103],[218,99],[207,84],[195,59],[192,36]],
      [[259,106],[302,114],[372,117],[442,116],[480,114],[480,133],[376,139],[304,134],[260,124]],
    ],
    occluders: [],
    doorPlacement:{
      id:'sw_ranch:iron-gate',flag:'sw_yard_iron_gate_open',noun:'iron gate',label:'铁门',dir:'ne',
      openOverlay:'ranch-sw_ranch-gate-open',at:[242,112],approach:[225,121],openLeafApproach:[216,121],
      pointerShape:{kind:'polygon',points:[[223,83],[261,99],[261,122],[223,106]],priority:3},
      openingShape:{kind:'polygon',points:[[227,85],[257,99],[257,119],[227,106]],priority:4},
      openLeafShape:{kind:'polygon',points:[[222,81],[243,61],[243,82],[222,106]],priority:5},
      closedObstacles:[{x:222,y:102,w:8,h:5},{x:230,y:106,w:8,h:5},{x:238,y:110,w:8,h:5},{x:246,y:114,w:8,h:5},{x:254,y:118,w:7,h:5}],
      openObstacles:[{x:223,y:100,w:4,h:4},{x:227,y:95,w:4,h:5},{x:231,y:90,w:4,h:5},
        {x:235,y:85,w:4,h:5},{x:239,y:80,w:4,h:5}],
    },
    reservedFeatures: [],
  },
};

for (const [id, scene] of Object.entries(RANCH_PERIMETER_LAYOUT)) {
  Object.assign(scene, {
    chapter: 'ranch', image: `./assets/ranch-perimeter-${id}-v1.png`,
    footprint: {rx:6, ry:3}, pathResolution: 0.25, obstacles: [],
  });
}
