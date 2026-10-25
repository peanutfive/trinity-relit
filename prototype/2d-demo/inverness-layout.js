// Five exits were laid out before commissioning the single-room background.
// These ground edges are then traced against the DELIVERED painting, rather
// than assuming the image generator preserved blueprint coordinates exactly.
export const INVERNESS_ACTORS = Object.freeze({
  pram:Object.freeze({x:270,y:86}),boy:Object.freeze({x:300,y:135}),
  headphones:Object.freeze({x:300,y:122}),dish:Object.freeze({x:293.5,y:133.5}),
});
export const INVERNESS_TERRAIN = {
  spawn: [235, 101],
  walkablePolygons: [
    // Terrace: fence, tree roots and bench stay above its upper edge.
    [[0,81],[85,84],[150,83],[215,84],[310,82],[375,82],[480,79],[480,107],[353,110],[337,112],[300,109],[219,108],[160,106],[110,108],[96,116],[76,112],[0,106]],
    // Left curve around the flowerbed to the visible Y junction.
    [[79,100],[103,103],[99,120],[97,139],[99,153],[108,170],[124,183],[151,194],[147,215],[124,205],[103,198],[89,187],[77,171],[72,154],[72,136],[76,115]],
    // Separate southwest branch, reaching the actual left-edge opening.
    [[112,178],[130,198],[100,215],[72,233],[45,252],[16,270],[0,273],[0,235],[32,225],[63,207],[88,191]],
    // South branch: no southwest sensor halfway along this road.
    [[103,180],[150,193],[184,207],[207,224],[224,244],[236,266],[241,288],[213,288],[213,270],[204,251],[190,236],[170,222],[143,212],[115,202],[100,201]],
    // Right curve continues all the way to the lower-right opening.
    [[330,100],[355,103],[355,128],[361,145],[374,159],[406,174],[430,190],[449,211],[463,238],[480,270],[480,288],[452,288],[445,267],[432,240],[417,218],[400,201],[374,185],[351,168],[338,151],[332,131]],
  ],
  blockedPolygons: [],
  exitAnchors: { w:[16,95], e:[464,95], sw:[16,251], s:[230,275], se:[464,275] },
  // Compass commands name graph connections. A curved path's local outward
  // tangent determines which physical step exits the painting.
  exitApproaches: { w:[-1,0], e:[1,0], sw:[-1,.7], s:[.3,1], se:[.3,1] },
};
