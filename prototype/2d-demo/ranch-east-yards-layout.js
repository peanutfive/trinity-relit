import { across, along } from './desert-trails-layout.js';

// The closed/open western door in the northeast yard is one vertical object.
// The wall remains solid around its sill. Its interior is a separate location.
export const RANCH_EAST_YARDS_LAYOUT = {
  ne_yard:{
    chapter:'ranch', objectId:139, image:'./assets/ranch-ne_yard-v1.png',
    spawn:[220,144], looseAnchor:[235,145],
    walkablePolygons:[
      [[115,61],[156,64],[209,68],[245,67],[286,74],[318,72],[346,68],[390,63],
        [401,104],[410,154],[415,193],[422,237],[431,288],[252,288],[253,208],
        [65,208],[79,180],[102,159],[112,146]],
      [[65,206],[255,206],[254,288],[41,288]],
    ],
    exitAnchors:{s:[184,272]}, hiddenExitDirs:['u','w','in','n','ne','e','se','sw','nw'],
    sourceArrivals:{front_deck:{x:183,y:228,face:'up',entrance:'s'}},
    doorPlacement:{
      id:'ne_yard:outside-door',at:[98,175],approach:[107,166],
      pointerShape:{kind:'polygon',points:[[79,132],[101,117],[102,160],[79,179]],priority:3},
    },
  },
  se_yard:{
    chapter:'ranch', objectId:477, image:'./assets/ranch-se_yard-v1.png',
    spawn:[231,144], looseAnchor:[231,146],
    walkablePolygons:[
      // Yard proper. The north and west strips meet it on dust, and the
      // southeast opening passes between the two feet of the iron gate.
      [[107,73],[161,65],[198,67],[227,72],[266,68],[279,57],[303,55],
        [332,74],[361,98],[383,139],[389,160],[384,184],[379,194],
        [359,210],[328,214],[286,221],[246,226],[196,225],[142,219],
        [105,214],[67,205],[49,194],[43,165],[69,152],[81,125],[99,110]],
      along([[0,130,259],[32,118,259],[54,109,259],[62,154,211],[79,152,214]]),
      across([[0,128,158],[35,126,157],[62,125,159],[90,115,161],[137,100,167]]),
      across([[324,160,184],[341,167,196],[356,178,207],[375,188,219],[393,203,235],
        [411,221,251],[431,236,267],[452,249,286],[480,266,303]]),
    ],
    // The swung-in leaf stands behind the post, leaving the mouth free.
    blockedPolygons:[[[308,183],[311,181],[341,202],[342,207],[338,208],[307,186]]],
    occluders:[
      {depthY:194,material:'iron-bars',points:[[307,151],[323,163],[325,194],[307,185]]},
      {depthY:210,material:'iron-bars',points:[[323,163],[341,177],[342,210],[323,195]]},
    ],
    exitAnchors:{n:[181,16],se:[375,200],w:[16,144]},
    exitApproaches:{se:[1,0.85]}, hiddenExitDirs:['u','out','ne','e','s','sw','nw','in'],
    showUnmadeExits:true,
    sourceArrivals:{
      front_deck:{x:184,y:85,face:'down',entrance:'n'},
      se_ranch:{x:340,y:179,face:'left',entrance:'se'},
    },
  },
};

for (const layout of Object.values(RANCH_EAST_YARDS_LAYOUT)) {
  layout.footprint = {rx:6,ry:3};
  layout.pathResolution = 0.25;
  layout.obstacles = [];
}
