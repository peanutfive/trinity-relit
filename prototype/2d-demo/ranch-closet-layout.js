const polygon=(points,priority)=>({kind:'polygon',points,priority});

// The camera turns to face the exit inside the closet. Compass directions
// still belong to the original rooms; approach vectors follow the painting.
export const RANCH_CLOSET_LAYOUT = {
  assembly_room:{
    chapter:'ranch',objectId:442,image:'./assets/ranch-inner-room-v1.webp',
    spawn:[236,160],looseAnchor:[244,174],pathResolution:.25,
    actorPerspective:{backY:85,frontY:255,backScale:1.45,frontScale:1.74},
    walkablePolygons:[
      [[46,84],[427,84],[465,260],[16,260]],
      [[216,71],[257,71],[257,90],[216,90]],
      [[23,157],[40,140],[48,146],[46,167],[23,171]],
      [[433,152],[457,173],[457,196],[435,181]],
      [[215,253],[263,253],[264,288],[215,288]],
    ],
    obstacles:[],hiddenExitDirs:['in','out'],omitSelfExitDirs:['n','e'],
    exitAnchors:{w:[32,160],e:[447,178],n:[238,83],s:[239,273]},
    exitSpans:{s:[[225,273],[251,273]]},exitApproaches:{w:[-1,0],e:[1,0]},
    sourceArrivals:{
      front_deck:{x:405,y:178,face:'left',entrance:'e'},
      nw_room:{x:73,y:161,face:'right',entrance:'w'},
      se_room:{x:239,y:233,face:'up',entrance:'s'},
      closet:{x:237,y:119,face:'down',entrance:'n'},
    },
    doorPlacements:[{
      id:'assembly_room:closet-door',flag:'closet_door_closed',noun:'closet door',label:'壁橱门',dir:'n',
      closedOverlay:'ranch-inner-room-closet-shut',at:[238,83],approach:[237,99],openLeafApproach:[207,116],
      pointerShape:polygon([[217,20],[259,20],[259,84],[217,84]],3),
      openingShape:polygon([[219,23],[257,23],[257,84],[219,84]],4),
      openLeafShape:polygon([[194,34],[217,22],[217,85],[194,104]],5),
      closedObstacles:[{x:216,y:78,w:44,h:7}],
      openObstacles:[{x:192,y:100,w:7,h:4},{x:199,y:94,w:8,h:5},{x:207,y:87,w:9,h:6}],openLeafDepthY:104,
    },{
      id:'assembly_room:front-door',flag:'front_deck_right_door_open',noun:'front door',label:'前门',dir:'e',
      openOverlay:'ranch-inner-room-front-open',at:[447,178],approach:[425,179],openLeafApproach:[426,203],
      pointerShape:polygon([[444,96],[461,118],[461,201],[442,178]],3),
      openingShape:polygon([[447,111],[459,123],[459,190],[448,176]],4),
      openLeafShape:polygon([[416,109],[444,100],[445,172],[416,189]],5),openLeafDepthY:189,
      openObstacles:[{x:416,y:185,w:8,h:4},{x:424,y:180,w:9,h:5},{x:433,y:174,w:11,h:5}],
      closedObstacles:[{x:440,y:169,w:7,h:8},{x:447,y:177,w:7,h:8},{x:454,y:185,w:7,h:9}],
    }],
    snakeAt:[262,120],preloadArt:['./assets/ranch-closet-snake-v1.png'],
    windowCenters:[125,354],
  },
  closet:{
    chapter:'ranch',objectId:352,image:'./assets/ranch-closet-v1.webp',
    spawn:[238,178],looseAnchor:[236,178],pathResolution:.25,actorScale:1.42,
    northAtBottom:true,exitLabelAnchors:{s:[239,87]},
    walkablePolygons:[[[198,154],[278,154],[294,200],[179,200]],
      [[221,148],[258,148],[260,161],[220,161]]],
    obstacles:[],hiddenExitDirs:['in','out'],omitSelfExitDirs:['s'],
    exitAnchors:{s:[239,156]},exitApproaches:{s:[0,-1]},exitRadii:{s:5},exitSpans:{s:[[228,156],[248,156]]},
    sourceArrivals:{assembly_room:{x:239,y:181,face:'down',entrance:'s'}},
    doorPlacement:{
      id:'closet:door',flag:'closet_door_closed',noun:'closet door',label:'壁橱门',dir:'s',
      closedOverlay:'ranch-closet-door-shut',at:[239,156],approach:[237,168],openLeafApproach:[258,165],
      pointerShape:polygon([[216,95],[262,95],[262,155],[216,155]],3),
      openingShape:polygon([[221,99],[254,99],[254,154],[221,154]],4),
      openLeafShape:polygon([[255,99],[262,96],[262,155],[255,154]],5),
      closedObstacles:[{x:217,y:149,w:45,h:7}],
    },
    snakeAt:[232,129],snakeWidth:17,preloadArt:['./assets/ranch-closet-snake-v1.png'],
  },
};
