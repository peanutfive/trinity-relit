// Coordinates are in the 480 × 288 game canvas. The hull is drawn on water,
// while keyboard reach and click-to-walk both target the neighbouring sand.
export const ISLET_POINTS = {
  river: { x: 324, y: 165, drawAt: { x: 385, y: 164 } },
  islet: {
    ferry: { x: 128, y: 185, drawAt: { x: 73, y: 191 } },
    gate: { x: 355, y: 163, pointerShape: { kind: 'ellipse', x: 363, y: 135, rx: 14, ry: 20, priority: 2 } },
  },
  sand_bar: {
    ferry: { x: 261, y: 149, drawAt: { x: 342, y: 151 } },
    gate: { x: 154, y: 216, pointerShape: { kind: 'ellipse', x: 144, y: 197, rx: 12, ry: 17, priority: 2 } },
  },
};

export const ISLET_LAYOUT = {
  islet: {
    chapter: 'islet', objectId: 5, image: './assets/islet-islet-v1.png',
    spawn: [230, 162], looseAnchor: [225, 180],
    sourceArrivals: { the_river: { x: 137, y: 184, face: 'right', entrance: 'ferry' } },
    occluders: [{depthY: 151, points: [[309,86],[312,78],[325,65],[345,55],[366,49],[383,48],
      [399,53],[416,63],[430,77],[443,94],[446,102],[440,107],[424,108],[399,104],
      [399,121],[405,141],[394,148],[378,153],[349,150],[341,142],[347,122],[352,103],[329,97],[315,93]]}],
    walkablePolygons: [[[224,0],[250,0],[249,51],[253,89],[265,103],[293,112],[309,123],[320,141],
      [341,149],[373,148],[397,152],[411,163],[399,177],[379,183],[360,190],[345,199],
      [318,201],[298,211],[262,221],[233,223],[211,222],[184,213],[164,205],[125,204],
      [113,196],[117,176],[112,155],[106,146],[115,138],[151,127],[181,117],[208,106],
      [221,92],[227,68],[229,43]]],
    exitAnchors: { n: [238,16] }, exitApproaches: { n: [0,-1] },
  },
  sand_bar: {
    chapter: 'islet', objectId: 501, image: './assets/islet-sand-bar-v1.png',
    spawn: [220, 183], looseAnchor: [224, 197],
    occluders: [{depthY: 210, points: [[94,159],[103,151],[123,140],[142,134],[157,135],[169,139],
      [180,148],[184,154],[182,161],[175,166],[158,170],[155,182],[157,199],[156,207],
      [145,209],[122,208],[121,203],[126,180],[126,173],[109,171],[98,167]]}],
    walkablePolygons: [[[153,288],[169,268],[178,251],[166,235],[144,226],[117,219],
      [120,212],[150,210],[160,204],[163,188],[161,178],[183,167],[180,147],[159,138],
      [151,131],[166,119],[189,108],[202,97],[215,81],[220,69],[233,59],[245,63],
      [245,71],[231,85],[222,99],[216,115],[224,127],[252,135],[282,138],[276,147],
      [267,154],[275,163],[299,173],[315,183],[315,190],[292,198],[274,207],[254,217],
      [245,229],[251,247],[262,266],[275,288]]],
    exitAnchors: { s: [212,275], out: [261,149] },
    exitApproaches: { s: [0,1] }, interactionExitDirs: ['out'], propOnlyExitDirs: ['out'],
  },
};

for (const layout of Object.values(ISLET_LAYOUT)) {
  Object.assign(layout, { footprint: { rx: 6, ry: 3 }, pathResolution: 0.25, blockedPolygons: [], obstacles: [] });
}
