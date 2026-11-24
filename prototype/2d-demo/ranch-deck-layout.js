import { across, along } from './desert-trails-layout.js';

export const RANCH_DECK_LAYOUT = {
  front_deck: {
    chapter:'ranch', objectId:6, image:'./assets/ranch-front-deck-v1.png',
    spawn:[176,135], looseAnchor:[174,165],
    footprint:{rx:6,ry:3}, pathResolution:0.25,
    walkablePolygons:[
      // Wood floor up against the east side of the house.
      [[123,36],[238,36],[230,226],[65,227],[86,195],[90,161],[92,134],[94,105],[111,82],[120,54]],
      // Two sand paths meet the ends of the deck. The stone wall sits beyond them.
      along([[0,173,214],[15,171,215],[29,165,217],[42,159,218]]),
      along([[220,132,193],[235,135,190],[249,131,185],[266,126,183],[288,123,180]]),
      // Plank edges across the wall gap, then the continuing dirt ramp approach.
      across([[224,94,135],[238,99,137],[272,107,144],[309,116,151],[341,124,158],
        [366,127,161],[378,130,164],[407,128,168],[443,128,170],[480,128,173]]),
    ],
    obstacles:[], blockedPolygons:[], occluders:[],
    exitAnchors:{e:[370,146],n:[194,16],s:[155,273]},
    sourceArrivals:{
      front_yard:{x:267,y:125,face:'left',entrance:'e'},
      ne_yard:{x:190,y:54,face:'down',entrance:'n'},
      se_yard:{x:157,y:226,face:'up',entrance:'s'},
    },
    interactionExitDirs:['e'],
    hiddenExitDirs:['ne','se','sw','w','nw','d','in'],
    showUnmadeExits:true,
    passageVisuals:{e:{label:'下坡',navigationHint:'回前院',radius:28,pointerShape:{
      kind:'polygon',points:[[235,98],[371,128],[377,160],[235,141]],priority:3,
    }}},
  },
};
