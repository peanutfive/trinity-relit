// Foot-level traces measured against the delivered paintings. Compass names
// belong to the chapter graph; approach vectors follow the visible local road.
const strip=(points,width)=>{const left=[],right=[];points.forEach(([x,y],i)=>{const a=points[Math.max(0,i-1)],b=points[Math.min(points.length-1,i+1)],d=Math.hypot(b[0]-a[0],b[1]-a[1])||1,nx=-(b[1]-a[1])/d,ny=(b[0]-a[0])/d;left.push([x+nx*width/2,y+ny*width/2]);right.push([x-nx*width/2,y-ny*width/2]);});return [...left,...right.reverse()];};
export const ARBOR_ROUTE_LAYOUT={
  trellises:{chapter:'wabe',objectId:317,image:'./assets/trellises-v2.png',spawn:[240,158],
    walkablePolygons:[strip([[0,146],[120,146],[240,151],[360,146],[480,146]],33),strip([[240,0],[240,82],[240,151]],31),strip([[30,0],[75,58],[151,117],[240,151],[325,117],[394,60],[448,0]],30),strip([[8,288],[99,228],[174,184],[240,151],[324,189],[406,240],[480,288]],35),strip([[268,147],[289,117],[299,83],[320,50],[345,26]],27),[[190,130],[273,127],[291,161],[255,182],[194,179]]],
    exitAnchors:{n:[240,16],ne:[436,16],e:[464,146],se:[457,273],sw:[28,275],w:[16,146],nw:[42,16],u:[340,33]},exitApproaches:{n:[0,-1],ne:[.7,-1],e:[1,0],se:[1,.6],sw:[-1,.65],w:[-1,0],nw:[-.7,-1],u:[.7,-1]},interactionExitDirs:['u'],showUnmadeExits:true},
  arboretum:{chapter:'wabe',objectId:462,image:'./assets/arboretum-v1.png',spawn:[240,185],walkablePolygons:[strip([[0,185],[120,185],[240,185],[360,185],[480,185]],37)],exitAnchors:{e:[464,185],w:[16,185]},exitApproaches:{e:[1,0],w:[-1,0]}},
  top_of_arbor:{chapter:'wabe',objectId:408,image:'./assets/arbor-top-v1.png',spawn:[248,135],
    walkablePolygons:[strip([[237,0],[229,18],[244,49],[245,68],[231,90],[232,110],[248,134],[248,151],[238,179],[244,210],[270,242],[281,288]],27),strip([[248,134],[221,139],[183,149],[164,165],[146,181],[89,199]],29),[[185,116],[278,109],[309,116],[331,126],[327,149],[300,159],[260,170],[208,163],[183,149]]],
    exitAnchors:{n:[234,16],s:[278,275],d:[97,197]},exitApproaches:{n:[-.4,-1],s:[.25,1],d:[-1,.4]},interactionExitDirs:['d'],occluders:[]},
  north_arbor:{chapter:'wabe',objectId:4,image:'./assets/arbor-north-v1.png',spawn:[245,171],
    walkablePolygons:[strip([[220,288],[251,255],[271,218],[269,198],[245,172],[238,145]],29),[[196,131],[229,113],[269,117],[287,134],[278,164],[249,176],[210,163]]],exitAnchors:{s:[231,275]},exitApproaches:{s:[-.7,1]}},
  south_arbor:{chapter:'wabe',objectId:430,image:'./assets/arbor-south-v1.png',spawn:[248,174],
    walkablePolygons:[strip([[246,0],[236,38],[257,85],[272,112],[262,142],[240,181]],28),[[210,150],[248,138],[276,150],[285,174],[271,200],[232,213],[200,195],[194,173]]],exitAnchors:{n:[242,16]},exitApproaches:{n:[.1,-1]}},
  arborvitaes_n:{chapter:'wabe',objectId:418,image:'./assets/arborvitaes-n-v1.png',spawn:[230,181],
    walkablePolygons:[strip([[0,173],[140,180],[270,184]],32),strip([[270,184],[250,150],[185,115],[130,70],[85,0]],31),[[249,168],[278,166],[287,182],[277,197],[254,194],[243,182]]],exitAnchors:{nw:[95,16],w:[16,174]},exitApproaches:{nw:[-.5,-1],w:[-1,0]}},
  arborvitaes_s:{chapter:'wabe',objectId:580,image:'./assets/arborvitaes-s-v1.png',spawn:[260,176],
    walkablePolygons:[strip([[480,173],[365,177],[240,176],[218,161],[220,132],[261,95],[304,60],[320,0]],31)],exitAnchors:{ne:[316,16],e:[464,174]},exitApproaches:{ne:[.2,-1],e:[1,0]}},
  waterfall:{chapter:'wabe',objectId:472,image:'./assets/waterfall-v1.png',spawn:[330,185],
    walkablePolygons:[strip([[350,0],[360,90],[345,150],[330,185],[350,220],[400,288]],35),strip([[300,170],[345,160],[405,151],[480,145]],38),[[285,158],[315,139],[353,138],[388,157],[376,190],[337,205],[303,195]]],
    exitAnchors:{ne:[352,16],e:[464,146],se:[391,275],in:[350,170]},exitApproaches:{ne:[0,-1],e:[1,0],se:[.6,1],in:[0,-1]},interactionExitDirs:['in']},
  south_bog:{chapter:'wabe',objectId:319,showUnmadeExits:true,image:'./assets/south-bog-v2.png',spawn:[240,184],
    walkablePolygons:[strip([[240,0],[242,80],[240,150],[237,221],[237,288]],32),strip([[0,135],[120,142],[240,150],[350,164],[420,153],[480,146]],32),strip([[425,0],[363,70],[302,116],[240,150],[307,201],[360,241],[430,288]],32)],
    exitAnchors:{n:[240,16],ne:[413,16],e:[464,148],se:[418,275],s:[237,275],w:[16,135]},exitApproaches:{n:[0,-1],ne:[.7,-1],e:[1,-.1],se:[1,.7],s:[0,1],w:[-1,0]}},
  north_bog:{chapter:'wabe',objectId:42,image:'./assets/north-bog-v2.png',spawn:[240,165],
    walkablePolygons:[strip([[230,0],[235,82],[240,165],[240,227],[240,288]],33),strip([[240,165],[360,140],[480,120]],33),strip([[240,165],[360,215],[480,235]],33),strip([[240,165],[151,213],[70,258],[0,288]],34)],
    exitAnchors:{n:[231,16],e:[464,123],se:[464,232],s:[240,275],sw:[27,275]},exitApproaches:{n:[0,-1],e:[1,-.15],se:[1,.2],s:[0,1],sw:[-1,.5]},showUnmadeExits:true},
  forest_clearing:{chapter:'wabe',objectId:426,image:'./assets/forest-clearing-v2.png',spawn:[240,156],
    walkablePolygons:[strip([[249,0],[247,100],[240,145]],32),strip([[65,0],[120,70],[180,100],[240,145],[317,110],[360,70],[425,0]],32),strip([[240,150],[350,167],[480,141]],34),[[170,127],[217,110],[275,119],[316,145],[309,180],[260,196],[210,194],[173,171]]],exitAnchors:{n:[249,16],ne:[413,16],e:[464,144],nw:[77,16]},exitApproaches:{n:[0,-1],ne:[.7,-1],e:[1,-.2],nw:[-.7,-1]}},
};
for(const scene of Object.values(ARBOR_ROUTE_LAYOUT))Object.assign(scene,{pathResolution:.25,blockedPolygons:[],obstacles:scene.obstacles||[],occluders:scene.occluders||[]});

// Its narrow S bend exposed a sub-quarter-pixel foot contact in live play.
ARBOR_ROUTE_LAYOUT.south_arbor.pathResolution=.1;
