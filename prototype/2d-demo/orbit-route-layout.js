// Current adapted chapter allows direction-based drifting. This rectangle is
// navigable space, not walkable ground; the renderer uses an airborne pose.
const common={chapter:'orbit',walkablePolygons:[[[0,0],[480,0],[480,288],[0,288]]],blockedPolygons:[],obstacles:[],occluders:[],pathResolution:.5,
  exitAnchors:{n:[240,16],ne:[455,25],e:[464,155],se:[455,270],s:[240,275],sw:[25,270],w:[16,155],nw:[25,25],out:[90,155]},
};
export const ORBIT_ROUTE_LAYOUT={
  orbit_satellite:{...common,mapLabel:'近地轨道·卫星',objectId:124,image:'./assets/orbit-satellite-v1.png',spawn:[220,180],hiddenExitDirs:['u','d','in'],interactionExitDirs:['out'],obstacles:[{x:326,y:48,w:80,h:64}],occluders:[{depthY:112,points:[[333,47],[358,40],[383,45],[401,58],[408,80],[402,97],[382,112],[356,106],[335,93],[325,70]]}]},
  orbit_space:{...common,mapLabel:'近地轨道·远空',objectId:425,image:'./assets/orbit-space-v2.png',spawn:[240,160],hiddenExitDirs:['u','d','out']},
};
