// Every ladder has a reachable standing point and a separate painted target.
// This lets a player tap the rungs without walking out onto the drop.
function passage(label, points) {
  return { label, navigationHint:label, radius:19, pointerShape:{kind:'polygon',priority:3,points} };
}

// These close views use the door jamb and ladder rungs as scale references.
// Anchor scaling at the boots to keep touch targets on the same floor.
export function shackRouteCharacterScale(room,y) {
  if (!Object.hasOwn(SHACK_ROUTE_LAYOUT,room)) return 1;
  const depth=Math.max(0,Math.min(1,(y-125)/145));
  return 1.72+depth*.42;
}

export const SHACK_ROUTE_LAYOUT = {
  shack: {
    chapter:'desert',objectId:507,image:'./assets/desert-shack-v1.webp',
    spawn:[232,198],looseAnchor:[255,221],
    walkablePolygons:[[[0,222],[26,192],[69,155],[85,138],[396,136],
      [415,154],[453,190],[480,221],[480,288],[0,288]]],
    sourceArrivals:{
      islet:{x:392,y:181,face:'left',entrance:'door'},
      tower_platform:{x:94,y:182,face:'right',entrance:'w'},
    },
    exitAnchors:{w:[57,172]},
    interactionExitDirs:['w'],propOnlyExitDirs:['w'],
    passageVisuals:{w:passage('走出棚屋',[[25,97],[65,82],[65,153],[25,188]])},
    eastDoor:{at:[421,172],points:[[416,84],[455,97],[455,188],[417,156]]},
    book:{at:[326,156],sides:[[326,156],[385,156]],x:355,y:145},
  },
  tower_platform: {
    chapter:'desert',objectId:158,image:'./assets/desert-shack-platform-v1.webp',
    spawn:[249,151],looseAnchor:[255,153],
    walkablePolygons:[[[133,155],[248,132],[327,116],[357,113],[377,124],
      [414,136],[419,142],[201,181],[135,164]]],
    sourceArrivals:{
      shack:{x:347,y:137,face:'left',entrance:'e'},
      tower_landing:{x:203,y:159,face:'right',entrance:'d'},
    },
    exitAnchors:{e:[389,135],d:[170,164]},
    lowerRung:[165,235],
    interactionExitDirs:['e','d'],propOnlyExitDirs:['e','d'],
    passageVisuals:{
      e:passage('走进棚屋',[[375,36],[415,41],[415,133],[375,123]]),
      d:passage('下梯',[[151,157],[182,160],[178,287],[150,287]]),
    },
  },
  tower_landing: {
    chapter:'desert',objectId:247,image:'./assets/desert-ladder-landing-v1.webp',
    spawn:[285,197],looseAnchor:[278,194],
    walkablePolygons:[[[132,193],[158,186],[158,179],[279,156],[357,149],[385,156],
      [450,168],[439,242],[438,288],[337,288],[205,226],[134,202]]],
    sourceArrivals:{
      tower_platform:{x:355,y:182,face:'left',entrance:'u'},
      base_of_tower:{x:198,y:200,face:'right',entrance:'d'},
    },
    exitAnchors:{u:[395,170],d:[152,197]},
    lowerRung:[150,261],
    interactionExitDirs:['u','d'],propOnlyExitDirs:['u','d'],
    passageVisuals:{
      u:passage('上梯',[[423,0],[451,0],[412,176],[379,170]]),
      d:passage('下梯',[[135,184],[176,193],[171,287],[130,287]]),
    },
  },
  base_of_tower: {
    chapter:'desert',objectId:146,image:'./assets/desert-ladder-foot-v1.webp',
    spawn:[238,202],looseAnchor:[240,207],
    obstacles:[{x:171,y:165,w:28,h:6}],
    walkablePolygons:[[[44,150],[90,145],[144,143],[176,151],[187,164],[227,175],
      [265,186],[309,202],[348,215],[388,228],[416,245],[462,259],[480,266],
      [480,288],[349,288],[302,263],[258,246],[225,225],[190,210],[155,198],
      [109,184],[68,170],[46,161]]],
    sourceArrivals:{
      tower_landing:{x:152,y:178,face:'down',entrance:'u'},
      shallow_crater:{x:382,y:250,face:'left',entrance:'se'},
    },
    exitAnchors:{u:[119,164],se:[438,275]},exitApproaches:{se:[1,.6]},
    interactionExitDirs:['u'],propOnlyExitDirs:['u'],
    passageVisuals:{u:passage('上梯',[[104,0],[133,0],[134,162],[104,166]])},
  },
};
