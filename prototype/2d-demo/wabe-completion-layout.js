// Greybox first; these foot-level traces follow the delivered PNGs, whose road
// mouths differ from the initial art plan. Water, beds and cliff are solid.
const strip=(points,width)=>{const left=[],right=[];points.forEach(([x,y],i)=>{const a=points[Math.max(0,i-1)],b=points[Math.min(points.length-1,i+1)],d=Math.hypot(b[0]-a[0],b[1]-a[1])||1,nx=-(b[1]-a[1])/d,ny=(b[0]-a[0])/d;left.push([x+nx*width/2,y+ny*width/2]);right.push([x-nx*width/2,y-ny*width/2]);});return [...left,...right.reverse()];};
export const WABE_COMPLETION_LAYOUT={
  chasms_brink:{chapter:'wabe',objectId:306,image:'./assets/wabe-chasm-v2.png',spawn:[240,185],
    walkablePolygons:[strip([[40,0],[60,62],[85,100],[110,125],[160,150]],33),strip([[430,0],[408,60],[384,105],[344,143],[300,169]],34),strip([[0,150],[100,155],[240,175],[360,164],[480,150]],36),strip([[20,288],[80,248],[133,211],[175,187]],38),strip([[440,288],[390,246],[340,210],[300,185]],38),[[108,137],[170,132],[240,139],[287,130],[353,135],[364,173],[325,196],[270,207],[211,201],[155,190],[99,166]]],
    exitAnchors:{nw:[44,16],ne:[426,16],w:[16,150],e:[464,152],sw:[39,275],se:[425,275],in:[260,148]},exitApproaches:{nw:[-.3,-1],ne:[.3,-1],w:[-1,0],e:[1,-.1],sw:[-1,.65],se:[.9,1],in:[0,-1]},
    hiddenExitDirs:[],omitSelfExitDirs:['in'],interactionExitDirs:['in'],showUnmadeExits:true},
  promontory:{chapter:'wabe',objectId:370,image:'./assets/wabe-promontory-v1.png',spawn:[290,188],
    walkablePolygons:[[[136,78],[198,65],[267,70],[322,90],[349,120],[373,169],[357,192],[323,207],[282,203],[258,220],[254,253],[253,288],[211,288],[213,241],[210,216],[168,199],[122,188],[86,164],[85,137],[102,109]],strip([[320,193],[370,214],[422,244],[480,273]],35)],
    obstacles:[{x:151,y:160,w:68,h:23},{x:219,y:165,w:37,h:16},{x:111,y:173,w:43,h:12}],
    exitAnchors:{s:[234,275],se:[464,265]},exitApproaches:{s:[0,1],se:[1,.6]}},
  herb_garden:{chapter:'wabe',objectId:417,image:'./assets/wabe-herbs-v1.png',spawn:[230,205],
    obstacles:[{x:349,y:149,w:32,h:12}],
    walkablePolygons:[strip([[0,160],[60,160],[114,180],[180,192],[300,201],[398,204]],32),[[113,77],[146,65],[244,69],[330,82],[400,90],[442,116],[442,179],[414,217],[280,221],[180,205],[103,183],[101,145],[114,110]]],
    blockedPolygons:[[[143,71],[231,72],[226,105],[140,101]],[[251,75],[329,81],[321,114],[241,108]],[[137,112],[217,119],[211,144],[127,137]],[[241,119],[319,126],[316,149],[231,142]],[[127,144],[205,151],[200,176],[113,170]],[[230,153],[268,158],[262,182],[218,177]],[[286,158],[340,163],[342,190],[278,183]]],
    occluders:[{depthY:280,points:[[29,172],[36,168],[43,177],[56,177],[64,184],[75,181],[87,190],[101,189],[115,198],[129,196],[143,205],[158,203],[174,213],[189,210],[204,217],[220,216],[235,225],[254,222],[273,230],[293,228],[313,236],[334,233],[354,243],[375,240],[397,248],[418,246],[441,254],[463,251],[480,258],[480,288],[29,288]]},{depthY:175,points:[[77,140],[95,132],[99,136],[99,164],[78,173]]},{depthY:152,points:[[34,113],[51,122],[55,127],[54,152],[34,144]]}],
    exitAnchors:{w:[16,160],in:[365,155]},exitApproaches:{w:[-1,0],in:[0,-1]},hiddenExitDirs:['in'],interactionExitDirs:['in'],showUnmadeExits:true},
  the_river:{chapter:'wabe',objectId:565,image:'./assets/wabe-river-v2.png',spawn:[265,172],
    walkablePolygons:[strip([[273,0],[275,63],[267,103],[244,143],[265,172]],34),strip([[35,0],[81,65],[119,106],[155,132],[212,155]],33),strip([[0,146],[120,146],[212,156],[280,163],[326,165]],35),[[177,127],[232,122],[300,134],[330,151],[336,174],[309,188],[267,190],[218,178],[170,166]]],
    exitAnchors:{n:[273,16],nw:[46,16],w:[16,146],in:[324,165]},exitApproaches:{n:[0,-1],nw:[-.7,-1],w:[-1,0],in:[1,0]},hiddenExitDirs:['in'],interactionExitDirs:['in'],showUnmadeExits:true},
};
for(const scene of Object.values(WABE_COMPLETION_LAYOUT))Object.assign(scene,{footprint:{rx:6,ry:3},pathResolution:.25,blockedPolygons:scene.blockedPolygons||[],obstacles:scene.obstacles||[],occluders:scene.occluders||[]});
