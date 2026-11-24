import { across, along } from './desert-trails-layout.js';

export const RANCH_HOUSE_ACCESS_LAYOUT = {
  bedroom:{
    objectId:214, spawn:[241,161], looseAnchor:[251,175],
    walkablePolygons:[
      [[54,54],[410,54],[424,139],[434,155],[445,158],[456,260],[22,260],[32,158],[46,151]],
      [[29,141],[49,135],[60,154],[42,169],[29,166]],
      [[412,145],[440,146],[447,155],[445,166],[416,168]],
    ],
    exitAnchors:{e:[435,155],w:[39,157]}, exitApproaches:{e:[1,0.12],w:[-1,0.06]},
    hiddenExitDirs:['in','out'], omitSelfExitDirs:['e'],
    sourceArrivals:{
      ne_yard:{x:395,y:158,face:'left',entrance:'e'},
      spare_room:{x:78,y:156,face:'right',entrance:'w'},
    },
    doorPlacement:{
      id:'bedroom:outside-door',flag:'ne_yard_outside_door_open',noun:'outside door',label:'外门',dir:'e',
      openOverlay:'ranch-bedroom-door-open',at:[435,155],approach:[416,158],openLeafApproach:[419,177],
      pointerShape:{kind:'polygon',points:[[422,107],[444,118],[446,160],[422,150]],priority:3},
      openingShape:{kind:'polygon',points:[[426,112],[436,117],[436,154],[426,150]],priority:4},
      openLeafShape:{kind:'polygon',points:[[437,118],[443,121],[444,160],[437,154]],priority:5},
      closedObstacles:[{x:423,y:146,w:8,h:5},{x:431,y:150,w:8,h:5},{x:439,y:154,w:7,h:5}],
    },
    floorMarkPlacement:{
      id:'bedroom:mattress-mark',approach:[137,110],
      pointerShape:{kind:'polygon',points:[[71,58],[176,59],[174,109],[67,111]],priority:2},
    },
  },
  sw_yard:{
    objectId:37, spawn:[220,131], looseAnchor:[226,163],
    walkablePolygons:[
      [[43,79],[75,84],[97,84],[113,73],[153,70],[179,67],[224,67],[267,76],[338,75],
        [401,74],[480,68],[480,205],[426,207],[373,209],[327,211],[267,212],[199,211],
        [160,207],[123,198],[97,187],[66,170],[47,145],[37,126]],
      along([[24,183,217],[50,183,218],[75,176,225],[91,175,228]]),
      across([[0,269,297],[39,237,270],[69,213,244],[89,196,225],[104,183,212],
        [128,169,194],[147,152,183]]),
      [[77,202],[95,187],[119,190],[130,202],[114,220],[101,227]],
    ],
    blockedPolygons:[[[72,200],[79,198],[83,204],[77,210],[72,207]],[[118,217],[126,214],[134,218],[129,227],[120,225]]],
    exitAnchors:{n:[201,51],e:[465,92],sw:[99,211]},exitApproaches:{sw:[-1,0.86]},
    hiddenExitDirs:['in','out','ne','se','s','w','nw'],omitSelfExitDirs:['sw'],
    sourceArrivals:{
      se_yard:{x:425,y:99,face:'left',entrance:'e'},
      hallway:{x:201,y:91,face:'down',entrance:'n'},
      sw_ranch:{x:136,y:174,face:'right',entrance:'sw'},
    },
    doorPlacement:{
      id:'sw_yard:iron-gate',flag:'sw_yard_iron_gate_open',noun:'iron gate',label:'铁门',dir:'sw',
      openOverlay:'ranch-sw_yard-gate-open',at:[99,211],approach:[115,187],openLeafApproach:[109,178],
      pointerShape:{kind:'polygon',points:[[79,177],[117,193],[118,220],[80,206]],priority:3},
      openingShape:{kind:'polygon',points:[[81,179],[116,195],[116,216],[81,202]],priority:4},
      openLeafShape:{kind:'polygon',points:[[75,168],[99,149],[99,172],[75,197]],priority:5},
      closedObstacles:[{x:78,y:201,w:9,h:5},{x:87,y:205,w:9,h:5},{x:96,y:209,w:9,h:5},{x:105,y:213,w:12,h:6}],
      openObstacles:[{x:76,y:189,w:5,h:6},{x:81,y:183,w:5,h:6},{x:86,y:178,w:5,h:5},{x:91,y:173,w:5,h:5},{x:96,y:169,w:3,h:4}],
    },
  },
  hallway:{
    objectId:240, spawn:[230,157],looseAnchor:[234,164],
    walkablePolygons:[
      along([[0,176,297],[29,174,299],[63,168,300],[98,162,303],[133,155,305],
        [155,149,307],[190,145,318],[222,147,325],[258,146,326],[288,142,333]]),
      [[131,149],[146,145],[163,144],[161,201],[128,197]],
      [[296,154],[311,148],[329,174],[328,193],[303,194]],
    ],
    exitAnchors:{n:[237,17],s:[236,273],w:[139,176],e:[319,178]},showUnmadeExits:true,
    exitSpans:{n:[[187,17],[285,17]],s:[[158,273],[314,273]]},
    hiddenExitDirs:['d','in','out'], omitSelfExitDirs:['e'],interactionExitDirs:['w'],
    passageVisuals:{w:{label:'下楼',navigationHint:'下楼',radius:23,pointerShape:{
      kind:'polygon',points:[[78,164],[144,144],[145,195],[79,199]],priority:3,
    }}},
    sourceArrivals:{
      back_yard:{x:237,y:61,face:'down',entrance:'n'},
      sw_yard:{x:235,y:235,face:'up',entrance:'s'},
      kitchen:{x:277,y:174,face:'left',entrance:'e'},
      icehouse:{x:178,y:177,face:'right',entrance:'w'},
    },
    doorPlacement:{
      id:'hallway:outer-door',flag:'hallway_outer_door_open',noun:'outer door',label:'外门',dir:'e',
      openOverlay:'ranch-hallway-door-open',at:[319,178],approach:[300,171],openLeafApproach:[291,165],
      pointerShape:{kind:'polygon',points:[[309,113],[329,145],[329,191],[309,159]],priority:3},
      openingShape:{kind:'polygon',points:[[313,124],[327,143],[327,185],[313,167]],priority:4},
      openLeafShape:{kind:'polygon',points:[[303,132],[311,120],[311,167],[303,180]],priority:5},
      closedObstacles:[{x:308,y:153,w:6,h:10},{x:312,y:162,w:6,h:10},{x:317,y:171,w:6,h:10},{x:322,y:181,w:6,h:9}],
    },
  },
  back_yard:{
    objectId:297,spawn:[236,142],looseAnchor:[229,154],
    walkablePolygons:[
      [[59,80],[117,52],[143,45],[189,42],[258,41],[320,43],[371,43],[382,76],
        [394,122],[411,165],[419,198],[305,204],[308,221],[157,221],[157,204],
        [26,202],[31,161],[39,124],[47,96]],
      [[62,67],[111,39],[119,46],[119,58],[77,84],[64,84]],
      [[386,146],[406,144],[415,154],[422,178],[398,179]],
      along([[199,163,305],[218,164,308],[247,161,310],[276,159,312],[288,158,313]]),
    ],
    exitAnchors:{nw:[92,59],e:[409,163],s:[235,272]},exitApproaches:{nw:[-0.78,-1],e:[1,0.22]},
    exitSpans:{s:[[174,272],[298,272]]},hiddenExitDirs:['n','ne','se','sw','w','in','out'],omitSelfExitDirs:['nw','e'],
    sourceArrivals:{
      nw_ranch:{x:120,y:92,face:'down',entrance:'nw'},
      spare_room:{x:368,y:158,face:'left',entrance:'e'},
      hallway:{x:236,y:231,face:'up',entrance:'s'},
    },
    doorPlacements:[
      {
        id:'back_yard:iron-gate',flag:'back_yard_iron_gate_open',noun:'iron gate',label:'铁门',dir:'nw',
        openOverlay:'ranch-back_yard-gate-open',at:[92,59],approach:[105,76],openLeafApproach:[122,90],
        pointerShape:{kind:'polygon',points:[[69,36],[111,17],[111,52],[69,72]],priority:3},
        openingShape:{kind:'polygon',points:[[71,40],[107,23],[107,52],[71,69]],priority:4},
        openLeafShape:{kind:'polygon',points:[[110,23],[131,42],[131,82],[110,55]],priority:5},
        closedObstacles:[{x:69,y:67,w:8,h:5},{x:77,y:63,w:8,h:5},{x:85,y:59,w:8,h:5},
          {x:93,y:55,w:8,h:5},{x:101,y:51,w:10,h:5}],
        openObstacles:[{x:110,y:52,w:4,h:6},{x:114,y:57,w:4,h:6},{x:118,y:63,w:4,h:6},
          {x:122,y:68,w:4,h:6},{x:126,y:74,w:4,h:6},{x:130,y:79,w:2,h:3}],
      },
      {
        id:'back_yard:screen-door',flag:'back_yard_screen_door_open',noun:'screen door',label:'纱门',dir:'e',
        openOverlay:'ranch-back_yard-screen-open',at:[409,163],approach:[390,163],openLeafApproach:[380,142],
        pointerShape:{kind:'polygon',points:[[399,109],[417,125],[418,179],[398,152]],priority:3},
        openingShape:{kind:'polygon',points:[[402,114],[416,132],[416,175],[402,156]],priority:4},
        openLeafShape:{kind:'polygon',points:[[389,125],[400,111],[400,155],[389,172]],priority:5},
        closedObstacles:[{x:398,y:148,w:6,h:8},{x:403,y:155,w:6,h:8},{x:408,y:162,w:6,h:8},{x:413,y:169,w:6,h:8}],
      },
    ],
  },
  spare_room:{
    objectId:12,spawn:[233,156],looseAnchor:[234,173],
    walkablePolygons:[
      [[60,55],[405,55],[411,117],[415,147],[433,148],[443,250],
        [36,250],[43,178],[60,167]],
      [[201,66],[205,54],[205,0],[250,0],[250,53],[256,66]],
      [[204,245],[257,245],[255,260],[254,288],[207,288],[207,259]],
      [[40,152],[57,147],[69,160],[63,177],[41,184]],
      [[407,131],[429,129],[435,144],[435,157],[410,163]],
    ],
    exitAnchors:{n:[228,45],s:[230,270],e:[423,146],w:[52,170]},
    exitApproaches:{e:[1,-0.09],w:[-1,0.22]},showUnmadeExits:true,hiddenExitDirs:['in','out'],omitSelfExitDirs:['w'],
    sourceArrivals:{
      bedroom:{x:383,y:148,face:'left',entrance:'e'},
      back_yard:{x:93,y:163,face:'right',entrance:'w'},
      bathroom:{x:228,y:83,face:'down',entrance:'n'},
      nw_room:{x:231,y:230,face:'up',entrance:'s'},
    },
    doorPlacement:{
      id:'spare_room:screen-door',flag:'back_yard_screen_door_open',noun:'screen door',label:'纱门',dir:'w',
      openOverlay:'ranch-spare_room-screen-open',at:[52,170],approach:[71,164],openLeafApproach:[80,158],
      pointerShape:{kind:'polygon',points:[[42,129],[60,118],[61,167],[42,179]],priority:3},
      openingShape:{kind:'polygon',points:[[43,134],[56,126],[56,165],[43,175]],priority:4},
      openLeafShape:{kind:'polygon',points:[[57,125],[70,132],[70,175],[57,167]],priority:5},
      closedObstacles:[{x:41,y:176,w:7,h:5},{x:47,y:172,w:7,h:5},{x:53,y:168,w:7,h:5},{x:58,y:164,w:5,h:5}],
    },
    wallMapPlacement:{
      id:'spare_room:wall-map',approach:[322,65],
      pointerShape:{kind:'polygon',points:[[295,16],[349,16],[348,48],[296,49]],priority:2},
    },
  },
};

for (const [id,layout] of Object.entries(RANCH_HOUSE_ACCESS_LAYOUT)) {
  layout.chapter = 'ranch';
  layout.image = './assets/ranch-' + id + '-v1.png';
  layout.footprint = {rx:6,ry:3};
  layout.pathResolution = 0.25;
  layout.obstacles = [];
}
