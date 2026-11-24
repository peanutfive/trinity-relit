// The ladder projects below the deck in the painting. Only the board surface
// supports the player's feet; the climb uses the landing end of the ladder.
export const RANCH_WINDMILL_LANDING_LAYOUT = {
  windmill: {
    chapter:'ranch', objectId:540, image:'./assets/ranch-windmill-landing-v1.png',
    spawn:[235,112], looseAnchor:[227,106],
    footprint:{rx:6,ry:3}, pathResolution:0.25,
    walkablePolygons:[
      [[158,83],[186,79],[216,74],[241,70],[264,67],[289,64],
        [300,87],[310,108],[324,132],[303,136],[278,140],[247,146],
        [212,152],[182,158],[176,140],[170,122],[163,100]],
    ],
    blockedPolygons:[[[240,67],[260,64],[265,70],[264,75],[254,79],[243,78],[240,74]]],
    obstacles:[],
    occluders:[
      {depthY:143,points:[[289,134],[293,133],[296,144],[292,145]]},
      {depthY:139,points:[[308,129],[312,129],[315,140],[311,140]]},
    ],
    exitAnchors:{d:[299,132],out:[299,132]},
    sourceArrivals:{under_windmill:{x:273,y:117,face:'left',entrance:'d'}},
    interactionExitDirs:['d'], hiddenExitDirs:['out'],
    passageVisuals:{d:{label:'下木梯',navigationHint:'下梯',radius:24,pointerShape:{
      kind:'polygon',points:[[288,133],[311,130],[331,229],[307,235]],priority:3,
    }}},
    // Placement for a separately rendered story item when its location is
    // supplied by the chapter. The background leaves this board empty.
    binocularsPlacement:{
      at:[174,112], approach:[192,116],
      pointerShape:{kind:'ellipse',x:174,y:110,rx:6,ry:4},
    },
  },
};
