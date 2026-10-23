// World coordinates are ground/contact anchors. Art offsets never change physics.
// Sitting people additionally align their hips to the furniture's seat surface.
const layouts = {
  bird_food_seller: {
    width: 18, height: 28.5, yOffset: 6,
    seatOffset: -11, // art feet to hips; broad-walk seat is y≈161
    hit: { x: 0, y: -8.25, rx: 10, ry: 14.25 },
  },
  inverness_boy: {
    width: 18, height: 21, yOffset: 0,
    hit: { x: 0, y: -10.5, rx: 10, ry: 11.5 },
    cuePoints: { dish: [-6.5, -1.5], wand: [1.5, -16], snap: [4, -18] },
  },
  lancaster_umbrella_woman: {
    width: 18, height: 33, yOffset: 0,
    hit: { x: 0, y: -16.5, rx: 11, ry: 17.5 },
    cuePoints: { umbrella: [-5, -14] },
  },
};
export function actorIdentity(object = {}) {
  if (object.actorId) return object.actorId;
  if (object.kind === 'boy' || object.kind === 'teenager') return 'inverness_boy';
  if (object.kind === 'umbrella_woman' || object.id === 'lancaster_gate:woman') return 'lancaster_umbrella_woman';
  if (['woman', 'bird_woman', 'old_woman'].includes(object.kind)) return 'bird_food_seller';
  return null;
}
export function actorLayout(object) {
  const layout = layouts[actorIdentity(object)];
  if (!layout) return null;
  // Return a copy: UI hit testing must not mutate the renderer's calibration.
  return { ...layout, hit: { ...layout.hit },
    ...(layout.cuePoints ? { cuePoints: Object.fromEntries(Object.entries(layout.cuePoints).map(([key,value]) => [key,[...value]])) } : {}) };
}

export function boyPoseFrame(options = {}) {
  const pose = options.startled ? 'startled' : options.pose || options.action || 'dip';
  return { dip: 0, blow: 1, admire: 2, snap: 2, startled: 3 }[pose] ?? 0;
}

export function umbrellaWomanPoseFrame(options = {}) {
  const action=options.action||options.pose||'hold';
  if(action==='kick')return 3;
  if(action==='wipe')return 2;
  if(options.walking||action==='leave')return 4+Math.floor(Math.max(0,Math.min(.999,options.progress||0))*8)%2;
  if(options.umbrella===false||['released','look_up','circle','empty'].includes(action))return 1;
  return 0;
}
export function actorHitShape(object) {
  const layout = actorLayout(object);
  return layout ? { x: object.x + layout.hit.x, y: object.y + layout.hit.y,
    rx: layout.hit.rx, ry: layout.hit.ry } : null;
}
