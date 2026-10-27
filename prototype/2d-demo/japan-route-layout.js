// Foot-level meshes retraced from the delivered 1619×971 paintings, not the
// commission blueprints. Coordinates use the 480×288 game viewport.
const strip=(points,width)=>{
  const left=[],right=[];
  points.forEach(([x,y],i)=>{
    const a=points[Math.max(0,i-1)],b=points[Math.min(points.length-1,i+1)];
    const d=Math.hypot(b[0]-a[0],b[1]-a[1])||1,nx=-(b[1]-a[1])/d,ny=(b[0]-a[0])/d;
    left.push([x+nx*width/2,y+ny*width/2]);right.push([x-nx*width/2,y-ny*width/2]);
  });return [...left,...right.reverse()];
};
export const JAPAN_POINTS=Object.freeze({
  gate:{x:351,y:110},door:{x:78,y:153},entrance:{x:444,y:151},
  girl:{x:260,y:166},shelterGirl:{x:255,y:158},children:{x:240,y:85},teachers:{x:240,y:244},
});
export const JAPAN_ROUTE_LAYOUT={
  the_bend:{chapter:'wabe',objectId:557,image:'./assets/wabe-bend-v1.png',spawn:[233,139],
    walkablePolygons:[strip([[0,130],[110,129],[231,131],[355,132],[480,130]],31),
      strip([[239,0],[236,72],[233,139],[255,220],[244,288]],32),
      strip([[39,0],[119,77],[233,139],[327,87],[438,0]],29),
      strip([[0,260],[117,210],[233,139]],32)],
    blockedPolygons:[],obstacles:[],occluders:[],
    exitAnchors:{n:[239,16],ne:[425,16],e:[464,130],s:[245,275],sw:[20,251],w:[16,130],nw:[53,16]},
    exitApproaches:{n:[0,-1],ne:[1,-.7],e:[1,0],s:[0,1],sw:[-1,.5],w:[-1,0],nw:[-1,-1]},showUnmadeExits:true},
  moor:{chapter:'wabe',objectId:471,image:'./assets/wabe-moor-v1.png',spawn:[238,130],
    walkablePolygons:[strip([[0,121],[111,117],[185,114],[238,130],[296,103],[351,110]],29),
      strip([[250,0],[244,73],[238,130],[282,167],[326,207]],30),
      strip([[40,0],[140,77],[238,130]],29),
      [[314,204],[319,198],[330,198],[337,204],[334,213],[321,215],[314,211]]],
    blockedPolygons:[],obstacles:[],occluders:[],exitAnchors:{n:[250,16],nw:[57,16],w:[16,121],in:[351,110]},
    exitApproaches:{n:[0,-1],nw:[-1,-.7],w:[-1,0],in:[1,0]},showUnmadeExits:true},
  playground:{chapter:'japan',objectId:127,image:'./assets/japan-playground-v2.png',spawn:[226,166],
    walkablePolygons:[[[134,115],[308,114],[330,179],[292,209],[145,211],[117,176]],
      strip([[240,0],[240,116],[239,198],[240,288]],30),strip([[0,150],[140,151],[238,160],[331,150],[459,150]],30)],
    blockedPolygons:[],obstacles:[],occluders:[],
    exitAnchors:{n:[240,16],s:[240,275],e:[444,151],in:[444,151],out:[78,153]},
    exitApproaches:{n:[0,-1],s:[0,1],e:[1,0],in:[1,0],out:[-1,0]}},
  shelter:{chapter:'japan',objectId:36,image:'./assets/japan-shelter-v1.png',spawn:[116,170],
    walkablePolygons:[[[78,107],[436,107],[465,174],[465,228],[28,232],[28,177]],[[20,129],[80,129],[80,184],[20,184]]],
    blockedPolygons:[],obstacles:[],occluders:[{depthY:245,points:[[0,208],[33,215],[64,237],[369,235],[406,216],[480,199],[480,288],[0,288]]}],
    exitAnchors:{w:[30,166],out:[30,166]},exitApproaches:{w:[-1,0],out:[-1,0]}},
};
