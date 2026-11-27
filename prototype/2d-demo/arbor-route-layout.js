import {OSSUARY_TOADSTOOL_ART} from './ossuary-toadstool-art.js';
import {ARBOR_LIGHT_ART} from './arbor-light-art.js';

// Foot-level traces measured against the delivered paintings. Compass names
// belong to the chapter graph; approach vectors follow the visible local road.
const strip=(points,width)=>{const left=[],right=[];points.forEach(([x,y],i)=>{const a=points[Math.max(0,i-1)],b=points[Math.min(points.length-1,i+1)],d=Math.hypot(b[0]-a[0],b[1]-a[1])||1,nx=-(b[1]-a[1])/d,ny=(b[0]-a[0])/d;left.push([x+nx*width/2,y+ny*width/2]);right.push([x-nx*width/2,y-ny*width/2]);});return [...left,...right.reverse()];};
export const ARBOR_ROUTE_LAYOUT={
  trellises:{chapter:'wabe',objectId:317,image:ARBOR_LIGHT_ART.trellises,spawn:[240,158],
    walkablePolygons:[strip([[0,146],[120,146],[240,151],[360,146],[480,146]],33),strip([[240,0],[240,82],[240,151]],31),strip([[30,0],[75,58],[151,117],[240,151],[325,117],[394,60],[448,0]],30),strip([[8,288],[99,228],[174,184],[240,151],[324,189],[406,240],[480,288]],35),[[190,130],[273,127],[291,161],[255,182],[194,179]]],
    exitAnchors:{n:[240,16],ne:[436,16],e:[464,146],se:[457,273],sw:[28,275],w:[16,146],nw:[42,16]},exitApproaches:{n:[0,-1],ne:[.7,-1],e:[1,0],se:[1,.6],sw:[-1,.65],w:[-1,0],nw:[-.7,-1]},showUnmadeExits:true},
  arboretum:{chapter:'wabe',objectId:462,image:ARBOR_LIGHT_ART.arboretum,preloadArt:[ARBOR_LIGHT_ART.crystal],spawn:[240,184],
    walkablePolygons:[
      strip([[0,172],[94,174],[163,168],[205,174],[240,182],[296,174],[380,176],[480,170]],25),
      strip([[240,182],[216,168],[230,154],[211,131],[223,113],[238,107],[246,99]],28),
      strip([[189,171],[148,179],[109,198],[92,219],[104,246],[139,264],[187,272],[236,263],[249,257]],26),
    ],
    obstacles:[{x:233,y:161,w:14,h:7}],
    exitAnchors:{n:[238,107],s:[239,261],e:[464,171],w:[16,172]},
    exitApproaches:{n:[.7,-1],s:[1,-.2],e:[1,0],w:[-1,0]},
    exitPointerPolygons:{n:[[224,80],[250,80],[254,108],[220,113]],s:[[219,231],[257,231],[262,254],[251,266],[216,266]]}},
  top_of_arbor:{chapter:'wabe',objectId:408,image:ARBOR_LIGHT_ART.top_of_arbor,spawn:[251,136],
    walkablePolygons:[strip([[230,0],[235,25],[248,60],[225,93],[237,115],[267,145],[256,165],[235,186],[229,201],[231,217],[260,249],[284,277],[289,288]],36),[[247,125],[276,125],[293,133],[294,147],[258,160],[243,153]]],
    exitAnchors:{n:[234,16],s:[278,275]},exitApproaches:{n:[-.4,-1],s:[.25,1]},occluders:[]},
  north_arbor:{chapter:'wabe',objectId:4,image:ARBOR_LIGHT_ART.north_arbor,spawn:[245,171],
    walkablePolygons:[strip([[220,288],[251,255],[271,218],[269,198],[245,172],[228,146],[226,128],[246,111],[255,92]],29),[[196,131],[229,113],[269,117],[287,134],[278,164],[249,176],[210,163]]],exitAnchors:{u:[231,275],d:[254,99]},exitApproaches:{u:[-.7,1],d:[.35,-1]},hiddenExitDirs:['in','out']},
  south_arbor:{chapter:'wabe',objectId:430,image:ARBOR_LIGHT_ART.south_arbor,spawn:[248,174],
    walkablePolygons:[strip([[246,0],[236,38],[257,85],[272,112],[262,142],[240,181],[220,202],[211,223],[203,250],[218,267],[267,266],[279,260]],28),[[210,150],[248,138],[276,150],[285,174],[271,200],[232,213],[200,195],[194,173]]],exitAnchors:{u:[242,16],d:[267,266]},exitApproaches:{u:[.1,-1],d:[1,0]},hiddenExitDirs:['in','out'],exitPointerPolygons:{d:[[242,238],[282,233],[293,257],[278,273],[241,273]]}},
  arborvitaes_n:{chapter:'wabe',objectId:418,image:'./assets/arborvitaes-n-v1.png',spawn:[230,181],
    walkablePolygons:[strip([[0,173],[140,180],[270,184]],32),strip([[270,184],[250,150],[185,115],[130,70],[85,0]],31),[[249,168],[278,166],[287,182],[277,197],[254,194],[243,182]]],exitAnchors:{nw:[95,16],w:[16,174]},exitApproaches:{nw:[-.5,-1],w:[-1,0]}},
  arborvitaes_s:{chapter:'wabe',objectId:580,image:'./assets/arborvitaes-s-v1.png',spawn:[260,176],
    walkablePolygons:[strip([[480,173],[365,177],[240,176],[218,161],[220,132],[261,95],[304,60],[320,0]],31)],exitAnchors:{ne:[316,16],e:[464,174]},exitApproaches:{ne:[.2,-1],e:[1,0]}},
  waterfall:{chapter:'wabe',objectId:472,preloadArt:[OSSUARY_TOADSTOOL_ART],image:'./assets/waterfall-v2.webp',spawn:[330,185],
    sourceArrivals:{ice_cavern:{x:148,y:80,face:'right',entrance:'w'}},
    walkablePolygons:[[[116,70],[139,68],[167,69],[190,74],[214,80],[244,89],[270,98],[292,105],[311,117],[324,128],[331,144],[324,166],[315,179],[299,180],[285,168],[279,154],[274,141],[263,132],[244,122],[216,111],[193,104],[167,97],[142,92],[116,89]],
      strip([[350,0],[360,90],[345,150],[330,185],[350,220],[400,288]],35),strip([[300,170],[345,160],[405,151],[480,145]],38),[[285,158],[315,139],[353,138],[388,157],[376,190],[337,205],[303,195]]],
    exitAnchors:{w:[124,80],ne:[352,16],e:[464,146],se:[391,275],in:[350,170]},exitApproaches:{w:[-1,0],ne:[0,-1],e:[1,0],se:[.6,1],in:[0,-1]},interactionExitDirs:['in'],omitSelfExitDirs:['in']},
  south_bog:{chapter:'wabe',objectId:319,exitLabelAnchors:{e:[434,187]},showUnmadeExits:true,image:'./assets/south-bog-v2.png',spawn:[240,184],
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
