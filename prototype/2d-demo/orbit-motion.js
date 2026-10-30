// A visual replay of an already committed room change. There is no gravity,
// floor route, propulsion rule or additional game turn in this sampler.
const clamp = n => Math.max(0, Math.min(1, n));
const smooth = n => { n = clamp(n); return n * n * (3 - 2 * n); };
const lerp = (a, b, t) => a + (b - a) * t;
const rooms = new Set(['orbit_satellite', 'orbit_space']);
const directions = Object.freeze({
  n: [0, -1], ne: [1, -1], e: [1, 0], se: [1, 1],
  s: [0, 1], sw: [-1, 1], w: [-1, 0], nw: [-1, -1],
});
const aliases = Object.freeze({
  north: 'n', northeast: 'ne', east: 'e', southeast: 'se', south: 's',
  southwest: 'sw', west: 'w', northwest: 'nw', up: 'u', down: 'd',
  '北': 'n', '东北': 'ne', '东': 'e', '东南': 'se', '南': 's',
  '西南': 'sw', '西': 'w', '西北': 'nw', '上': 'u', '下': 'd',
});
function inputDirection(input) {
  const word = String(input || '').trim().toLowerCase().replace(/^go\s+/, '');
  return aliases[word] || word;
}
function edge(from, vector) {
  const [dx, dy] = vector;
  const tx = dx > 0 ? (504 - from.x) / dx : dx < 0 ? (-24 - from.x) / dx : Infinity;
  const ty = dy > 0 ? (316 - from.y) / dy : dy < 0 ? (-20 - from.y) / dy : Infinity;
  const t = Math.max(0, Math.min(tx, ty));
  return {x: from.x + dx * t, y: from.y + dy * t};
}
function facing(from, to, fallback) {
  const dx = to.x - from.x, dy = to.y - from.y;
  return Math.abs(dx) + Math.abs(dy) < .01 ? fallback
    : Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
}
export function createOrbitPassage(before, after, input = '') {
  if (!rooms.has(before?.room)) return null;
  const returning = before.room === 'orbit_satellite' && after?.room === 'waterfall';
  if (!returning && (!rooms.has(after?.room) || before.room === after.room)) return null;
  const p = before.visual?.player;
  const from = {x: Number.isFinite(p?.x) ? p.x : 220, y: Number.isFinite(p?.y) ? p.y : 180};
  const dir = inputDirection(input);
  // Vertical/in/out aliases are depth changes in space, never staircases.
  const to = returning ? {x: 90, y: 155} : directions[dir] ? edge(from, directions[dir])
    : {x: from.x + 38, y: from.y + (dir === 'u' ? -32 : 24)};
  const distance = Math.hypot(to.x - from.x, to.y - from.y);
  const duration = returning ? 1.2 : Math.max(.7, Math.min(1.4, .45 + distance / 180));
  return {type: returning ? 'orbit_return' : 'orbit_drift', from, to, distance, duration,
    facing: facing(from, to, p?.facing || p?.face || 'right')};
}
export function sampleOrbitPassage(motion, elapsed = 0) {
  const e = Number.isFinite(elapsed) ? Math.max(0, elapsed) : 0;
  const t = clamp(e / motion.duration), returning = motion.type === 'orbit_return';
  const travel = returning ? smooth((e - .18) / .84) : smooth(t);
  const burst = returning ? smooth((e - .08) / .38) : 0;
  return {
    actor: {id: 'orbit:traveller', kind: 'orbit_rider',
      x: lerp(motion.from.x, motion.to.x, travel), y: lerp(motion.from.y, motion.to.y, travel),
      visualOptions: {facing: motion.facing, fade: returning ? 1 - smooth((e - .88) / .32) : 1, burst}},
    fade: smooth((e - motion.duration + .28) / .28),
  };
}
