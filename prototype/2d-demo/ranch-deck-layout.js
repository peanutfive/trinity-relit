import { across, along } from './desert-trails-layout.js';

export const RANCH_DECK_LAYOUT = {
  front_deck: {
    chapter:'ranch', objectId:6, image:'./assets/ranch-front-deck-v1.png',
    spawn:[176,135], looseAnchor:[174,165],
    footprint:{rx:6,ry:3}, pathResolution:0.25,
    walkablePolygons:[
      // Wood floor up against the east side of the house.
      [[123,36],[238,36],[230,226],[65,227],[86,195],[90,161],[92,134],[94,105],[111,82],[120,54]],
      // Recess at the near (left) door. Its closed leaf occupies the sill.
      [[60,228],[81,194],[91,192],[90,211],[73,230]],
      [[92,105],[92,96],[107,76],[116,72],[124,80],[107,106]],
      // Two sand paths meet the ends of the deck. The stone wall sits beyond them.
      along([[0,173,214],[15,171,215],[29,165,217],[42,159,218]]),
      along([[220,132,193],[235,135,190],[249,131,185],[266,126,183],[288,123,180]]),
      // Plank edges across the wall gap, then the continuing dirt ramp approach.
      across([[224,94,135],[238,99,137],[272,107,144],[309,116,151],[341,124,158],
        [366,127,161],[378,130,164],[407,128,168],[443,128,170],[480,128,173]]),
    ],
    obstacles:[], blockedPolygons:[], occluders:[],
    exitAnchors:{e:[370,146],n:[194,16],s:[155,273],sw:[78,212],nw:[103,91]},
    exitApproaches:{sw:[-1,0.4],nw:[-1,-0.25]},
    omitSelfExitDirs:['sw','nw'],
    sourceArrivals:{
      front_yard:{x:267,y:125,face:'left',entrance:'e'},
      ne_yard:{x:190,y:54,face:'down',entrance:'n'},
      se_yard:{x:157,y:226,face:'up',entrance:'s'},
      se_room:{x:117,y:204,face:'right',entrance:'sw'},
      assembly_room:{x:144,y:96,face:'right',entrance:'nw'},
    },
    interactionExitDirs:['e'],
    hiddenExitDirs:['ne','se','w','d','in'],
    showUnmadeExits:true,
    doorPlacements:[{
      id:'front_deck:left-door',flag:'front_deck_left_door_open',noun:'left door',label:'左门',dir:'sw',
      openOverlay:'ranch-front-deck-left-open',at:[78,212],approach:[96,211],openLeafApproach:[99,222],
      pointerShape:{kind:'polygon',points:[[63,173],[85,159],[85,196],[64,227]],priority:3},
      openingShape:{kind:'polygon',points:[[72,172],[84,164],[84,197],[72,211]],priority:4},
      openLeafShape:{kind:'polygon',points:[[65,175],[72,170],[72,211],[65,224]],priority:5},
      closedObstacles:[{x:63,y:221,w:7,h:5},{x:69,y:213,w:6,h:7},{x:74,y:205,w:6,h:8},{x:79,y:195,w:7,h:10}],
    },{
      id:'front_deck:right-door',flag:'front_deck_right_door_open',noun:'right door',label:'右门',dir:'nw',
      openOverlay:'ranch-front-deck-right-open',at:[103,91],approach:[118,92],openLeafApproach:[117,78],
      pointerShape:{kind:'polygon',points:[[93,56],[111,43],[111,75],[93,102]],priority:3},
      openingShape:{kind:'polygon',points:[[94,57],[106,49],[106,84],[94,100]],priority:4},
      openLeafShape:{kind:'polygon',points:[[106,49],[111,45],[111,78],[106,84]],priority:5},
      closedObstacles:[{x:92,y:96,w:5,h:6},{x:97,y:89,w:5,h:7},{x:102,y:81,w:5,h:8},{x:107,y:75,w:5,h:6}],
    }],
    passageVisuals:{e:{label:'下坡',navigationHint:'回前院',radius:28,pointerShape:{
      kind:'polygon',points:[[235,98],[371,128],[377,160],[235,141]],priority:3,
    }}},
  },
};
