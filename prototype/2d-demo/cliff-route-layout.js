// Ground traced from the delivered 1619x971 paintings, not prompt coordinates.
// The optional ice branch follows the existing adapted chapter; original-rule
// differences remain documented in CLIFF_PRODUCTION.md, never patched here.
const strip=(points,width)=>{
  const left=[],right=[];
  points.forEach(([x,y],i)=>{
    const a=points[Math.max(0,i-1)],b=points[Math.min(points.length-1,i+1)],d=Math.hypot(b[0]-a[0],b[1]-a[1])||1;
    const nx=-(b[1]-a[1])/d,ny=(b[0]-a[0])/d;
    left.push([x+nx*width/2,y+ny*width/2]);right.push([x-nx*width/2,y-ny*width/2]);
  });return [...left,...right.reverse()];
};
export const CLIFF_POINTS=Object.freeze({
  hive:{x:326,y:161},hiveArt:{x:340,y:91},bees:{x:366,y:155},
  cave:{x:237,y:115},icicles:{x:252,y:145},iceExit:{x:48,y:136},
  rim:{x:283,y:202},descent:{x:326,y:151},ascent:{x:67,y:45},metal:{x:286,y:220},
});
export const CLIFF_ROUTE_LAYOUT={
  bottom_of_stairs:{chapter:'wabe',objectId:575,image:'./assets/bottom-of-stairs-v2.png',spawn:[237,217],
    walkablePolygons:[strip([[0,175],[130,176],[237,181],[350,180],[480,177]],34),
      strip([[237,0],[237,91],[237,181],[232,236],[231,288]],32),
      // The painted stair flight widens toward its base. Its apron is a broad
      // continuous surface, not the thin seam between two route strips.
      [[225,0],[249,0],[250,57],[257,106],[268,151],[275,178],[262,195],[219,195],[203,175],[208,142],[219,84]],
      [[207,166],[277,166],[280,193],[260,212],[210,205],[196,189]],
      strip([[30,288],[129,230],[237,181],[335,196],[403,221],[480,241]],30),
      strip([[33,0],[47,39],[48,70],[47,89],[67,115],[89,132],[118,147],[170,163],[237,181]],28),
      strip([[237,181],[335,160],[380,140],[409,118],[441,86],[451,62],[447,36],[448,0]],28)],
    blockedPolygons:[],obstacles:[],
    occluders:[{depthY:167,points:[[276,139],[301,128],[319,140],[322,156],[311,167],[278,164]]}],
    exitAnchors:{ne:[448,16],e:[464,178],se:[464,237],s:[231,275],sw:[51,275],w:[16,175],nw:[38,16],u:[237,25]},
    exitApproaches:{ne:[0,-1],e:[1,0],se:[1,.3],s:[0,1],sw:[-1,.6],w:[-1,0],nw:[0,-1],u:[0,-1]},showUnmadeExits:true},
  under_cliff:{chapter:'wabe',objectId:400,image:'./assets/under-cliff-v1.png',spawn:[241,187],
    walkablePolygons:[strip([[0,153],[124,171],[241,186],[365,170],[480,148]],34),
      strip([[0,288],[101,228],[241,186],[353,227],[480,288]],33),
      strip([[235,288],[230,241],[241,186],[248,147],[237,96]],32),
      [[194,170],[266,161],[303,188],[270,210],[219,218],[189,196]]],
    blockedPolygons:[],obstacles:[],
    occluders:[{depthY:166,points:[[290,151],[296,137],[311,126],[332,127],[342,148],[337,161],[316,170]]}],
    exitAnchors:{e:[464,152],se:[455,272],s:[235,275],sw:[24,273],w:[16,157],in:[237,105]},
    exitApproaches:{e:[1,0],se:[1,.65],s:[0,1],sw:[-1,.65],w:[-1,0],in:[0,-1]},
    interactionExitDirs:['in'],showUnmadeExits:true},
  ice_cavern:{chapter:'wabe',objectId:449,image:'./assets/ice-cavern-v1.png',spawn:[134,187],
    walkablePolygons:[[[89,169],[142,149],[197,130],[293,130],[365,148],[410,183],[401,233],[333,259],[225,264],[154,245],[110,216]],
      strip([[35,119],[64,145],[95,168],[134,187]],30)],
    blockedPolygons:[],obstacles:[],
    occluders:[{depthY:263,points:[[304,239],[331,224],[344,200],[365,207],[381,227],[405,234],[409,267],[480,288],[300,288]]}],
    exitAnchors:{out:[46,132]},exitApproaches:{out:[-1,-.6]},interactionExitDirs:['out']},
  craters_edge:{chapter:'wabe',objectId:441,image:'./assets/craters-edge-v1.png',spawn:[225,223],
    walkablePolygons:[strip([[0,115],[85,119],[120,157],[170,187],[223,219],[249,288]],31),
      strip([[0,232],[72,202],[125,168],[140,109],[94,57],[39,0]],28),
      strip([[176,189],[224,212],[285,205],[310,175],[330,143],[345,119]],25)],
    blockedPolygons:[],obstacles:[],
    occluders:[{depthY:207,points:[[297,189],[302,174],[319,171],[327,183],[332,203],[318,213]]}],
    exitAnchors:{s:[247,275],sw:[16,226],w:[16,116],nw:[49,16],d:[340,129]},
    exitApproaches:{s:[.2,1],sw:[-1,.5],w:[-1,0],nw:[-.7,-1],d:[.5,-1]},
    interactionExitDirs:['d'],showUnmadeExits:true},
  crater:{chapter:'wabe',objectId:145,image:'./assets/crater-v1.png',spawn:[184,214],
    walkablePolygons:[[[150,147],[204,141],[258,140],[318,157],[370,179],[386,214],[358,250],[284,267],[201,264],[144,239],[124,200]],
      strip([[178,230],[132,192],[110,151],[99,112],[102,85],[75,49],[54,18]],30)],
    blockedPolygons:[],obstacles:[{x:278,y:215,w:17,h:8}],
    occluders:[{depthY:273,points:[[0,231],[44,224],[78,238],[128,261],[171,288],[0,288]]}],
    exitAnchors:{u:[57,25]},exitApproaches:{u:[-.5,-1]},interactionExitDirs:['u']},
};
// The legacy 2px line samples can skip tiny corner gaps that a real animation
// step hits. Newly traced terrain validates shortcuts at quarter-pixel spacing.
for(const scene of Object.values(CLIFF_ROUTE_LAYOUT))scene.pathResolution=.25;
