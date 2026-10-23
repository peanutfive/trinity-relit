import { LOGICAL_SIZE } from './scene-manifest.js';

const EPSILON = 1e-7;
const navigationCache = new WeakMap();
const point = value => Array.isArray(value) ? { x: value[0], y: value[1] } : value;

const exitVectors={n:[0,-1],ne:[1,-1],e:[1,0],se:[1,1],s:[0,1],sw:[-1,1],w:[-1,0],nw:[-1,-1],u:[0,-1],d:[0,1],in:[1,0],out:[-1,0]};
export function approachingExit(exit,from,to){
  const dx=to.x-from.x,dy=to.y-from.y;
  const distance=Math.hypot(dx,dy),vector=exitVectors[exit.dir];
  if(distance<.001||!vector)return false;
  // A northward walk must not activate a diagonal junction lying on that road.
  // Pointer navigation already records its explicitly selected exit separately.
  if((dx*vector[0]+dy*vector[1])/(distance*Math.hypot(...vector))<.85)return false;
  const before=Math.hypot(from.x-exit.x,from.y-exit.y),after=Math.hypot(to.x-exit.x,to.y-exit.y);
  if(after>=exit.radius)return false;
  if(after<before-.001)return true;
  // Legacy saves may be centred on a sensor. Only an outward step can leave
  // from there; walking back into the room must not bounce the player away.
  return before<=1;
}

export function pointInPolygon(x, y, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [ax, ay] = polygon[j], [bx, by] = polygon[i];
    const cross = (x - ax) * (by - ay) - (y - ay) * (bx - ax);
    if (Math.abs(cross) < EPSILON && x >= Math.min(ax, bx) - EPSILON && x <= Math.max(ax, bx) + EPSILON && y >= Math.min(ay, by) - EPSILON && y <= Math.max(ay, by) + EPSILON) return true;
    if ((ay > y) !== (by > y) && x < (bx - ax) * (y - ay) / (by - ay) + ax) inside = !inside;
  }
  return inside;
}

function ellipseTouchesPolygon(x, y, rx, ry, polygon) {
  if (pointInPolygon(x, y, polygon)) return true;
  for (let index = 0; index < polygon.length; index++) {
    const a = polygon[index], b = polygon[(index + 1) % polygon.length];
    const ax = (a[0] - x) / rx, ay = (a[1] - y) / ry;
    const bx = (b[0] - x) / rx, by = (b[1] - y) / ry;
    const dx = bx - ax, dy = by - ay;
    const t = Math.max(0, Math.min(1, -(ax * dx + ay * dy) / (dx * dx + dy * dy || 1)));
    if ((ax + dx * t) ** 2 + (ay + dy * t) ** 2 <= 1) return true;
  }
  return false;
}

// The foot ellipse, rather than the character's whole sprite, contacts the ground.
// Uncalibrated scenes retain their previous rectangular collision behavior.
export function isBlocked(scene, x, y) {
  if (!Number.isFinite(x) || !Number.isFinite(y) || x < 12 || x > LOGICAL_SIZE.width - 12 || y < 12 || y > LOGICAL_SIZE.height - 12) return true;
  if (!scene.walkablePolygons?.length) return scene.obstacles.some(object => x > object.x - 7 && x < object.x + object.w + 7 && y > object.y - 4 && y < object.y + object.h + 5);
  const { rx = 6, ry = 3 } = scene.footprint || {};
  if (!scene.walkablePolygons.some(polygon => pointInPolygon(x, y, polygon))) return true;
  // Test the perimeter against the UNION of walkable areas. Shared seams between
  // path pieces remain passable, while neither foot can extend over a flowerbed.
  for (let index = 0; index < 16; index++) {
    const angle = index / 16 * Math.PI * 2;
    const px = x + Math.cos(angle) * rx, py = y + Math.sin(angle) * ry;
    if (!scene.walkablePolygons.some(polygon => pointInPolygon(px, py, polygon))) return true;
  }
  if ((scene.blockedPolygons || []).some(polygon => ellipseTouchesPolygon(x, y, rx, ry, polygon))) return true;
  return scene.obstacles.some(object => {
    const nx = Math.max(object.x, Math.min(x, object.x + object.w));
    const ny = Math.max(object.y, Math.min(y, object.y + object.h));
    return ((nx - x) / rx) ** 2 + ((ny - y) / ry) ** 2 <= 1;
  });
}

export function isSegmentWalkable(scene, fromValue, toValue) {
  const from = point(fromValue), to = point(toValue);
  if (!from || !to) return false;
  const steps = Math.max(1, Math.ceil(Math.hypot(to.x - from.x, to.y - from.y) / 2));
  for (let index = 0; index <= steps; index++) {
    const progress = index / steps;
    if (isBlocked(scene, from.x + (to.x - from.x) * progress, from.y + (to.y - from.y) * progress)) return false;
  }
  return true;
}

function gridFor(scene, step) {
  const signature = JSON.stringify([step, scene.walkablePolygons, scene.blockedPolygons, scene.footprint, scene.obstacles]);
  const cached = navigationCache.get(scene);
  if (cached?.signature === signature) return cached;
  const nodes = [], byKey = new Map();
  for (let y = 12; y <= LOGICAL_SIZE.height - 12; y += step) for (let x = 12; x <= LOGICAL_SIZE.width - 12; x += step) {
    if (isBlocked(scene, x, y)) continue;
    const node = { x, y, index: nodes.length };
    nodes.push(node); byKey.set(`${x},${y}`, node);
  }
  const grid = { signature, nodes, byKey, step };
  navigationCache.set(scene, grid);
  return grid;
}
function closest(nodes, target, accept = () => true) {
  let best = null, distance = Infinity;
  for (const node of nodes) {
    const d = (node.x - target.x) ** 2 + (node.y - target.y) ** 2;
    if (d < distance && accept(node)) { best = node; distance = d; }
  }
  return best;
}
function connected(scene, grid, start) {
  const queue = [start], parents = new Map([[start.index, null]]);
  const offsets = [[0, -1], [1, 0], [0, 1], [-1, 0], [1, -1], [1, 1], [-1, 1], [-1, -1]];
  for (let index = 0; index < queue.length; index++) {
    const node = queue[index];
    for (const [dx, dy] of offsets) {
      const next = grid.byKey.get(`${node.x + dx * grid.step},${node.y + dy * grid.step}`);
      if (!next || parents.has(next.index) || !isSegmentWalkable(scene, node, next)) continue;
      parents.set(next.index, node.index); queue.push(next);
    }
  }
  return { nodes: queue, parents };
}

// Accepts nearestWalkable(scene, {x,y}, options) or (scene, x, y, options).
// With options.from, return a point in that actor's reachable component.
export function nearestWalkable(scene, value, yOrOptions = {}, extraOptions = {}) {
  const target = typeof value === 'number' ? { x: value, y: yOrOptions } : point(value);
  const options = typeof value === 'number' ? extraOptions : yOrOptions;
  if (!target || !Number.isFinite(target.x) || !Number.isFinite(target.y)) return null;
  const grid = gridFor(scene, options.step || 4);
  let nodes = grid.nodes;
  if (options.from) {
    const from = point(options.from);
    const start = closest(nodes, from, node => isSegmentWalkable(scene, from, node));
    if (!start) return null;
    nodes = connected(scene, grid, start).nodes;
  }
  const chosen = closest(nodes, target);
  return chosen ? { x: chosen.x, y: chosen.y } : null;
}

// Return ground-safe waypoints, including a safe start and the closest reachable
// destination (options.nearest permits a blocked target to snap to the bank). Every shortcut is tested continuously; no diagonal corner cutting.
export function findPath(scene, fromValue, toValue, options = {}) {
  let from = point(fromValue);
  const target = point(toValue);
  if (!from || !target || ![from.x, from.y, target.x, target.y].every(Number.isFinite)) return [];
  if (isBlocked(scene, from.x, from.y)) from = nearestWalkable(scene, from, options);
  if (!from) return [];
  if (isBlocked(scene, target.x, target.y) && !options.nearest) return [];
  if (isSegmentWalkable(scene, from, target)) return [[from.x, from.y], [target.x, target.y]];
  const grid = gridFor(scene, options.step || 4);
  const start = closest(grid.nodes, from, node => isSegmentWalkable(scene, from, node));
  if (!start) return [];
  const component = connected(scene, grid, start);
  const goal = closest(component.nodes, target);
  if (!goal) return [];
  const raw = [];
  for (let index = goal.index; index !== null; index = component.parents.get(index)) {
    const node = grid.nodes[index]; raw.push({ x: node.x, y: node.y });
  }
  raw.reverse(); raw.unshift({ x: from.x, y: from.y });
  if (isSegmentWalkable(scene, raw.at(-1), target)) raw.push({ x: target.x, y: target.y });
  else if (!options.nearest) return [];
  const path = [raw[0]];
  for (let index = 0; index < raw.length - 1;) {
    let next = raw.length - 1;
    while (next > index + 1 && !isSegmentWalkable(scene, raw[index], raw[next])) next--;
    path.push(raw[next]); index = next;
  }
  return path.map(node => [node.x, node.y]);
}
