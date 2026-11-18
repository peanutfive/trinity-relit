// Ground traces follow the final PNGs, not the initial generation coordinates.
// High ledges and ladders require F; a direction alias does not create a bridge.
export const TUNDRA_POINTS=Object.freeze({
  fissure:{x:306,y:157,drawAt:{x:315,y:129},pointerShape:{kind:'ellipse',x:315,y:126,rx:12,ry:8,priority:1}},
  lemming:{x:313,y:145},
});
const strip=(points,width)=>{const a=[],b=[];points.forEach(([x,y],i)=>{const p=points[Math.max(0,i-1)],q=points[Math.min(points.length-1,i+1)],d=Math.hypot(q[0]-p[0],q[1]-p[1])||1,nx=-(q[1]-p[1])/d,ny=(q[0]-p[0])/d;a.push([x+nx*width/2,y+ny*width/2]);b.push([x-nx*width/2,y-ny*width/2]);});return[...a,...b.reverse()];};
export const TUNDRA_LANDMARKS_LAYOUT={
  under_platform:{chapter:'tundra',objectId:488,image:'./assets/tundra-under-platform-v1.png',spawn:[238,167],
    walkablePolygons:[[[115,138],[174,118],[228,114],[275,128],[314,142],[361,134],[409,139],[416,164],[353,191],[309,209],[266,214],[226,207],[182,195],[147,178]],strip([[36,0],[75,55],[127,104],[190,142]],32),strip([[206,0],[203,60],[204,100],[224,141]],34),strip([[307,0],[299,54],[281,95],[270,137]],32),strip([[375,158],[429,146],[480,146]],38),strip([[284,196],[335,225],[388,258],[446,288]],35),strip([[238,193],[237,234],[234,288]],41),strip([[191,185],[128,217],[66,254],[20,288]],36),strip([[153,154],[84,148],[0,146]],37)],
    blockedPolygons:[[[340,99],[352,98],[376,118],[377,130],[362,136],[344,125]]],
    exitAnchors:{n:[206,16],ne:[307,16],e:[464,146],se:[424,275],s:[234,275],sw:[36,275],w:[16,146],nw:[47,16],u:[350,153]},
    exitApproaches:{n:[0,-1],ne:[0,-1],e:[1,0],se:[1,.55],s:[0,1],sw:[-.8,.6],w:[-1,0],nw:[-.5,-1],u:[.3,-1]},interactionExitDirs:['u'],
    passageVisuals:{u:{label:'铁梯',pointerShape:{kind:'polygon',points:[[355,6],[371,6],[371,130],[355,130]]}}}},
  platform:{chapter:'tundra',objectId:199,image:'./assets/tundra-platform-v1.png',spawn:[245,158],
    walkablePolygons:[[[0,189],[100,170],[167,157],[236,139],[295,123],[328,104],[341,88],[358,88],[384,103],[397,112],[393,132],[378,153],[300,173],[231,191],[175,207],[114,224],[0,248]]],
    occluders:[{depthY:227,points:[[0,202],[48,192],[94,183],[132,176],[133,179],[96,186],[49,195],[0,205]]},{depthY:194,points:[[232,155],[238,153],[300,142],[371,126],[373,129],[301,145],[235,158]]},{depthY:233,points:[[28,198],[32,197],[33,229],[29,231]]},{depthY:216,points:[[93,185],[97,184],[97,212],[94,214]]},{depthY:190,points:[[232,155],[236,154],[237,187],[233,190]]},{depthY:176,points:[[294,142],[298,141],[299,173],[295,176]]},{depthY:164,points:[[348,132],[352,131],[353,160],[350,164]]}],
    exitAnchors:{n:[365,119],d:[176,192]},exitApproaches:{n:[0,-1],d:[0,1]},interactionExitDirs:['n','d'],
    passageVisuals:{n:{label:'北侧眺望处',pointerShape:{kind:'polygon',points:[[345,89],[366,85],[397,106],[394,130],[370,142],[349,129]]}},d:{label:'下行铁梯',pointerShape:{kind:'polygon',points:[[145,169],[199,163],[202,212],[155,225]]}}}},
  cliff_edge:{chapter:'tundra',objectId:43,image:'./assets/tundra-cliff-v1.png',spawn:[235,197],
    walkablePolygons:[[[136,130],[163,121],[201,123],[227,131],[250,129],[279,135],[305,135],[329,141],[362,150],[389,169],[368,187],[340,207],[309,222],[279,232],[266,260],[265,288],[185,288],[183,263],[166,247],[146,231],[123,220],[104,199],[87,188],[92,171],[111,153]]],
    exitAnchors:{s:[235,275]},exitApproaches:{s:[0,1]}},
};
for(const scene of Object.values(TUNDRA_LANDMARKS_LAYOUT))Object.assign(scene,{footprint:{rx:6,ry:3},pathResolution:.25,blockedPolygons:scene.blockedPolygons||[],obstacles:scene.obstacles||[],occluders:scene.occluders||[]});
