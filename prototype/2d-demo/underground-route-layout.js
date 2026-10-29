// Delivered paintings were inspected before tracing these foot-level floors.
const strip=(points,width)=>{
  const left=[],right=[];points.forEach(([x,y],i)=>{
    const a=points[Math.max(0,i-1)],b=points[Math.min(points.length-1,i+1)],d=Math.hypot(b[0]-a[0],b[1]-a[1])||1;
    const nx=-(b[1]-a[1])/d,ny=(b[0]-a[0])/d;left.push([x+nx*width/2,y+ny*width/2]);right.push([x-nx*width/2,y-ny*width/2]);
  });return [...left,...right.reverse()];
};
export const UG_ROUTE_LAYOUT={
  bluff:{chapter:'wabe',objectId:213,image:'./assets/bluff-v1.png',spawn:[240,180],
    walkablePolygons:[strip([[30,288],[102,224],[181,189],[240,180],[340,168],[420,145],[480,132]],33),strip([[240,180],[342,211],[444,288]],35)],
    blockedPolygons:[],obstacles:[],occluders:[],exitAnchors:{se:[431,275],sw:[45,275],e:[464,132],in:[464,132]},exitApproaches:{se:[1,.8],sw:[-1,.8],e:[1,-.3],in:[1,-.3]},hiddenExitDirs:['in'],showUnmadeExits:true},
  cottage:{chapter:'wabe',objectId:327,image:'./assets/cottage-v1.png',spawn:[241,221],
    walkablePolygons:[[[15,128],[85,126],[143,122],[202,116],[283,116],[310,128],[415,128],[465,129],[480,157],[467,179],[421,194],[382,238],[296,244],[273,288],[210,288],[190,244],[103,242],[81,208],[13,170]],strip([[0,135],[50,147],[160,186],[300,188],[430,153],[480,135]],30)],
    blockedPolygons:[],obstacles:[{x:207,y:146,w:66,h:29}],
    occluders:[{depthY:173,points:[[204,136],[211,109],[228,102],[252,102],[270,111],[277,144],[268,162],[249,172],[224,173],[205,158]]}],
    exitAnchors:{w:[16,135],out:[16,135],e:[464,135],s:[241,275]},exitApproaches:{w:[-1,-.2],out:[-1,-.2],e:[1,-.2],s:[0,1]},hiddenExitDirs:['out'],showUnmadeExits:true},
  cemetery:{chapter:'wabe',objectId:414,image:'./assets/cemetery-v1.png',spawn:[260,219],
    walkablePolygons:[strip([[242,288],[274,240],[254,204],[222,164],[193,135],[222,110],[238,75]],34)],
    blockedPolygons:[],obstacles:[],occluders:[],exitAnchors:{n:[238,85],in:[238,85],s:[249,275]},exitApproaches:{n:[.4,-1],in:[.4,-1],s:[-.5,1]},hiddenExitDirs:['in'],interactionExitDirs:['n']},
  barrow:{chapter:'wabe',objectId:353,image:'./assets/barrow-v1.png',spawn:[240,211],
    walkablePolygons:[[[226,92],[257,92],[272,109],[313,130],[352,156],[363,188],[327,214],[298,237],[281,288],[199,288],[191,246],[161,221],[125,195],[119,167],[160,134],[209,111]]],
    blockedPolygons:[],obstacles:[],occluders:[],exitAnchors:{s:[240,275],out:[240,275],in:[240,103]},exitApproaches:{s:[0,1],out:[0,1],in:[0,-1]},hiddenExitDirs:['out'],interactionExitDirs:['in']},
  ossuary:{chapter:'wabe',objectId:522,image:'./assets/ossuary-v2.png',spawn:[244,185],
    walkablePolygons:[strip([[240,288],[238,235],[240,195],[235,157],[292,123],[350,130],[375,133]],35),[[109,151],[151,140],[189,129],[224,135],[252,157],[251,192],[201,191],[162,180],[124,173]]],
    blockedPolygons:[],obstacles:[],occluders:[],exitAnchors:{out:[240,275],in:[350,130]},exitApproaches:{out:[0,1],in:[1,0]},interactionExitDirs:['in']},
  underground_1:{mapLabel:'地下·裂隙',chapter:'underground',objectId:30,image:'./assets/ug-entry-v1.png',spawn:[88,164],
    walkablePolygons:[[[14,130],[65,140],[102,149],[167,147],[247,148],[314,148],[396,147],[467,130],[480,159],[469,180],[391,183],[310,181],[235,181],[168,178],[90,179],[12,173]]],
    blockedPolygons:[],obstacles:[],occluders:[],exitAnchors:{w:[28,145],e:[464,145],out:[464,145]},exitApproaches:{w:[-1,-.3],e:[1,-.3],out:[1,-.3]},hiddenExitDirs:['out'],interactionExitDirs:['w']},
  underground_2:{mapLabel:'地下·电缆通道',chapter:'underground',objectId:87,image:'./assets/ug-middle-v1.png',spawn:[92,171],
    walkablePolygons:[[[15,110],[51,123],[82,148],[136,156],[220,155],[308,155],[394,147],[435,116],[466,109],[480,128],[465,157],[420,183],[360,204],[291,212],[220,212],[141,202],[72,185],[12,145]]],
    blockedPolygons:[],obstacles:[],occluders:[],exitAnchors:{w:[24,126],in:[24,126],e:[458,126]},exitApproaches:{w:[-.6,-1],in:[-.6,-1],e:[.6,-1]},hiddenExitDirs:['in']},
  underground_3:{mapLabel:'地下·圆筒室',chapter:'underground',objectId:131,image:'./assets/ug-inner-v1.png',spawn:[100,165],
    walkablePolygons:[[[12,122],[51,142],[96,137],[124,119],[215,112],[276,117],[331,126],[377,137],[405,177],[378,213],[301,248],[217,263],[147,248],[105,216],[59,197],[12,159]]],
    blockedPolygons:[],obstacles:[{x:328,y:159,w:42,h:12}],occluders:[],exitAnchors:{w:[24,141]},exitApproaches:{w:[-1,-.2]},hiddenExitDirs:['e','in']},
};
for(const scene of Object.values(UG_ROUTE_LAYOUT))scene.pathResolution=.5;
