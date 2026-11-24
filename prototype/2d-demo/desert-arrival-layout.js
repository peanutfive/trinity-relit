import {along, DESERT_TRAILS_LAYOUT} from './desert-trails-layout.js';
import {DESERT_ROAD_LAYOUT} from './desert-road-layout.js';

// The saddles lie above the basin. The ranch trail follows a separate cut
// through its southeastern rim and reaches the bottom of the picture.
export const DESERT_ARRIVAL_LAYOUT = {
  ...DESERT_TRAILS_LAYOUT,
  ...DESERT_ROAD_LAYOUT,
  shallow_crater: {
    chapter: 'desert', objectId: 456, image: './assets/desert-shallow-crater-v2.png',
    spawn: [232,169], looseAnchor: [238,177],
    sourceArrivals: {
      islet: {x:222,y:174,face:'right',entrance:'door'},
      sand_bar: {x:222,y:174,face:'right',entrance:'door'},
      nw_ranch: {x:388,y:252,face:'left',entrance:'se'},
    },
    walkablePolygons: [[[0,137],[19,136],[35,137],[50,146],[78,152],[108,155],[138,148],
      [177,126],[219,119],[271,110],[307,114],[351,122],[385,131],[414,130],[437,124],[461,121],[480,118],
      [480,132],[460,133],[448,138],[430,152],[412,164],[425,173],[408,191],[375,201],[349,211],
      [340,224],[291,237],[248,237],[211,230],[172,226],[131,217],[113,203],[79,196],[56,180],[32,166],[16,154],[0,149]],
      along([[193,273,305],[205,281,328],[214,305,352],[222,329,365],[233,346,376],
        [244,360,392],[254,372,408],[267,384,430],[278,393,449],[288,400,466]]),
    ],
    exitAnchors: { w:[16,144], e:[464,126], se:[422,275] },
    exitApproaches: { se:[1,0.6] },
  },
  desert_5: {
    chapter: 'desert', image: './assets/desert-west-v1.png',
    spawn: [231,161], looseAnchor: [235,173],
    walkablePolygons: [[[0,165],[38,157],[80,152],[125,144],[160,141],[205,136],[250,130],
      [285,127],[327,121],[369,118],[420,111],[480,111],[480,161],[445,164],[408,175],
      [371,191],[348,201],[323,217],[300,215],[276,234],[240,243],[212,245],[179,249],
      [133,244],[96,242],[90,222],[65,211],[23,211],[0,216]]],
    exitAnchors: { w: [16,184], e: [464,136] }, showUnmadeExits: true,
  },
  desert_6: {
    chapter: 'desert', image: './assets/desert-east-v1.png',
    spawn: [243,164], looseAnchor: [243,175],
    walkablePolygons: [[[0,137],[43,137],[95,141],[140,141],[181,146],[218,149],[255,149],[292,154],
      [335,153],[371,157],[409,159],[450,160],[480,160],[480,196],[446,195],[402,192],
      [362,192],[327,194],[284,190],[251,186],[211,185],[177,182],[138,183],[93,178],[52,177],[0,169]]],
    exitAnchors: { w: [16,154], e: [464,177] }, showUnmadeExits: true,
  },
};

for (const layout of Object.values(DESERT_ARRIVAL_LAYOUT)) {
  Object.assign(layout, {
    footprint: { rx: 6, ry: 3 }, pathResolution: 0.25,
    exitApproaches: { e: [1,0], w: [-1,0], ...layout.exitApproaches }, blockedPolygons: [], obstacles: [], occluders: [],
  });
}
