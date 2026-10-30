import { LOGICAL_SIZE } from './scene-manifest.js';

const EPSILON = 1e-7;
// navigationScene() can return a fresh wrapper for the same ground geometry.
// Key by every collision input rather than wrapper identity, and bound retained
// rooms/contact assemblies so moving actors cannot grow the cache indefinitely.
const navigationCache = new Map();
const MAX_GEOMETRIES = 24, MAX_SEARCHES = 8, MAX_SEGMENTS = 4096;
const neighbourOffsets = [[0,-1],[1,0],[0,1],[-1,0],[1,-1],[1,1],[-1,1],[-1,-1]];
const footPerimeter = Array.from({length:16}, (_,index) => {
  const angle = index / 16 * Math.PI * 2;
  return [Math.cos(angle),Math.sin(angle)];
});
const point = value => Array.isArray(value) ? { x: value[0], y: value[1] } : value;

const exitVectors={n:[0,-1],ne:[1,-1],e:[1,0],se:[1,1],s:[0,1],sw:[-1,1],w:[-1,0],nw:[-1,-1],u:[0,-1],d:[0,1],in:[1,0],out:[-1,0]};
// A player can reach the screen limit during the short arrival cooldown.
// Once it expires, continued outward input must still cross that edge, even
// though collision no longer permits another visible pixel of movement.
export function leavingBoundaryExit(exit,from,intent){
  if(exit.interactionOnly||(exit.x>28&&exit.x<452&&exit.y>28&&exit.y<260))return false;
  const v=exit.approach||exitVectors[exit.dir],length=Math.hypot(intent.x,intent.y);
  if(!v||length<.001||Math.hypot(from.x-exit.x,from.y-exit.y)>=exit.radius)return false;
  return (intent.x*v[0]+intent.y*v[1])/(length*Math.hypot(...v))>=.85
    &&(from.x-exit.x)*v[0]+(from.y-exit.y)*v[1]>=-1;
}
export function approachingExit(exit,from,to){
  if(exit.interactionOnly)return false;
  const dx=to.x-from.x,dy=to.y-from.y;
  const distance=Math.hypot(dx,dy),vector=exit.approach||exitVectors[exit.dir];
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
function boundedPolygons(polygons) {
  return (polygons || []).map(polygon => {
    // Keep the compiled geometry independent of later in-place scene edits.
    const points = polygon.map(vertex => [...vertex]);
    return {points, minX:Math.min(...points.map(p=>p[0])), maxX:Math.max(...points.map(p=>p[0])),
      minY:Math.min(...points.map(p=>p[1])), maxY:Math.max(...points.map(p=>p[1]))};
  });
}
function containsGround(polygons, x, y) {
  for (const polygon of polygons) {
    if (x < polygon.minX-EPSILON || x > polygon.maxX+EPSILON || y < polygon.minY-EPSILON || y > polygon.maxY+EPSILON) continue;
    if (pointInPolygon(x,y,polygon.points)) return true;
  }
  return false;
}
function blockedFoot(scene, x, y, footprint = scene.footprint, geometry) {
  if (!Number.isFinite(x) || !Number.isFinite(y) || x < 12 || x > LOGICAL_SIZE.width - 12 || y < 12 || y > LOGICAL_SIZE.height - 12) return true;
  if (!scene.walkablePolygons?.length) return scene.obstacles.some(object => x > object.x - 7 && x < object.x + object.w + 7 && y > object.y - 4 && y < object.y + object.h + 5);
  const { rx = 6, ry = 3 } = footprint || {};
  const onGround = geometry ? (px,py) => containsGround(geometry.walkable,px,py)
    : (px,py) => scene.walkablePolygons.some(polygon => pointInPolygon(px,py,polygon));
  if (!onGround(x,y)) return true;
  // Test the perimeter against the UNION of walkable areas. Shared seams between
  // path pieces remain passable, while neither foot can extend over a flowerbed.
  for (const [px,py] of footPerimeter) {
    if (!onGround(x+px*rx,y+py*ry)) return true;
  }
  if (geometry) {
    for (const polygon of geometry.blocked) {
      if (x+rx < polygon.minX-EPSILON || x-rx > polygon.maxX+EPSILON || y+ry < polygon.minY-EPSILON || y-ry > polygon.maxY+EPSILON) continue;
      if (ellipseTouchesPolygon(x,y,rx,ry,polygon.points)) return true;
    }
  } else if ((scene.blockedPolygons || []).some(polygon => ellipseTouchesPolygon(x, y, rx, ry, polygon))) return true;
  return scene.obstacles.some(object => {
    const nx = Math.max(object.x, Math.min(x, object.x + object.w));
    const ny = Math.max(object.y, Math.min(y, object.y + object.h));
    return ((nx - x) / rx) ** 2 + ((ny - y) / ry) ** 2 <= 1;
  });
}

function blockedAt(scene, x, y, geometry) {
  // A carried or pushed assembly has several ground contacts. Use the same
  // ground mesh and pathfinder for every contact instead of sliding its centre
  // along a valid road while its wheels or the person cut across a flowerbed.
  if (scene.contactOffsets?.length) return scene.contactOffsets.some(contact =>
    blockedFoot(scene, x + contact.x, y + contact.y, contact.footprint, geometry));
  return blockedFoot(scene, x, y, scene.footprint, geometry);
}
export function isBlocked(scene, x, y) {
  return blockedAt(scene,x,y);
}

export function isSegmentWalkable(scene, fromValue, toValue) {
  const from = point(fromValue), to = point(toValue);
  if (!from || !to) return false;
  return segmentWalkable(scene,from,to);
}
function segmentWalkable(scene, from, to, geometry) {
  const resolution=scene.pathResolution||2;
  const steps = Math.max(1, Math.ceil(Math.hypot(to.x - from.x, to.y - from.y) / resolution));
  for (let index = 0; index <= steps; index++) {
    const progress = index / steps;
    if (blockedAt(scene, from.x + (to.x - from.x) * progress, from.y + (to.y - from.y) * progress, geometry)) return false;
  }
  return true;
}

function gridFor(scene, step) {
  const signature = JSON.stringify([step,scene.pathResolution, scene.walkablePolygons, scene.blockedPolygons, scene.footprint, scene.obstacles, scene.contactOffsets]);
  const cached = navigationCache.get(signature);
  if (cached) {
    navigationCache.delete(signature); navigationCache.set(signature, cached);
    return cached;
  }
  const geometry = {walkable:boundedPolygons(scene.walkablePolygons),blocked:boundedPolygons(scene.blockedPolygons)};
  const nodes = [], byKey = new Map();
  for (let y = 12; y <= LOGICAL_SIZE.height - 12; y += step) for (let x = 12; x <= LOGICAL_SIZE.width - 12; x += step) {
    if (blockedAt(scene, x, y, geometry)) continue;
    const node = { x, y, index: nodes.length };
    nodes.push(node); byKey.set(`${x},${y}`, node);
  }
  const edges = new Int32Array(nodes.length * neighbourOffsets.length).fill(-2);
  const grid = { nodes, byKey, step, edges, geometry, searches: new Map(), segments: new Map() };
  navigationCache.set(signature, grid);
  if (navigationCache.size > MAX_GEOMETRIES) navigationCache.delete(navigationCache.keys().next().value);
  return grid;
}
function closest(nodes, target, accept) {
  if (accept) {
    // Validate in distance order. Row-order scanning used to continuously test
    // far-away provisional candidates, hundreds of long segments per click.
    const ordered = nodes.map((node,index) => ({node,index,distance:(node.x-target.x)**2+(node.y-target.y)**2}));
    ordered.sort((a,b) => a.distance-b.distance || a.index-b.index);
    for (const candidate of ordered) if (accept(candidate.node)) return candidate.node;
    return null;
  }
  let best = null, distance = Infinity;
  for (const node of nodes) {
    const d = (node.x - target.x) ** 2 + (node.y - target.y) ** 2;
    if (d < distance) { best = node; distance = d; }
  }
  return best;
}
function remember(cache, key, value, limit) {
  cache.delete(key); cache.set(key, value);
  if (cache.size > limit) cache.delete(cache.keys().next().value);
  return value;
}
function visible(scene, grid, from, to) {
  const key = `${from.x},${from.y}>${to.x},${to.y}`;
  if (grid.segments.has(key)) return remember(grid.segments, key, grid.segments.get(key), MAX_SEGMENTS);
  return remember(grid.segments, key, segmentWalkable(scene, from, to, grid.geometry), MAX_SEGMENTS);
}
function neighbour(scene, grid, node, direction) {
  const index = node.index * neighbourOffsets.length + direction;
  if (grid.edges[index] === -2) {
    const [dx,dy] = neighbourOffsets[direction];
    const next = grid.byKey.get(`${node.x + dx * grid.step},${node.y + dy * grid.step}`);
    // Keep the original directional continuous test, including its resolution.
    // Node endpoints alone cannot detect a thin obstacle between grid samples.
    grid.edges[index] = next && segmentWalkable(scene, node, next, grid.geometry) ? next.index : -1;
  }
  return grid.edges[index];
}
function heapPush(heap, value) {
  let index = heap.length; heap.push(value);
  while (index) {
    const parent = (index - 1) >> 1;
    if (heap[parent].score <= value.score) break;
    heap[index] = heap[parent]; index = parent;
  }
  heap[index] = value;
}
function heapPop(heap) {
  const first = heap[0], last = heap.pop();
  if (heap.length) {
    let index = 0;
    while (index * 2 + 1 < heap.length) {
      let child = index * 2 + 1;
      if (child + 1 < heap.length && heap[child + 1].score < heap[child].score) child++;
      if (last.score <= heap[child].score) break;
      heap[index] = heap[child]; index = child;
    }
    heap[index] = last;
  }
  return first;
}
function search(scene, grid, start, target) {
  const desired = closest(grid.nodes, target);
  if (!desired) return null;
  const key = `${start.index}:${desired.index}`;
  const cached = grid.searches.get(key) || grid.searches.get(`${start.index}:component`);
  if (cached) {
    remember(grid.searches, key, cached, MAX_SEARCHES);
    return {...cached, goal: cached.complete ? closest(cached.nodes, target) : desired};
  }
  // A normal click has a reachable nearest grid point. Search toward it instead
  // of flooding every foot-safe pixel in the room before the first step starts.
  // If it is on another island, exhausting this search still visits ONLY the
  // start component; snapping then uses that component's closest safe point.
  const parents = new Int32Array(grid.nodes.length).fill(-2);
  const costs = new Float64Array(grid.nodes.length).fill(Infinity);
  const closed = new Uint8Array(grid.nodes.length), nodes = [], heap = [];
  const heuristic = node => Math.hypot(node.x - desired.x, node.y - desired.y);
  parents[start.index] = -1; costs[start.index] = 0;
  heapPush(heap, {index:start.index, score:heuristic(start), cost:0});
  while (heap.length) {
    const current = heapPop(heap), node = grid.nodes[current.index];
    if (closed[node.index] || current.cost !== costs[node.index]) continue;
    closed[node.index] = 1; nodes.push(node);
    if (node.index === desired.index) {
      return remember(grid.searches, key, {nodes, parents, goal:desired, complete:false}, MAX_SEARCHES);
    }
    for (let direction = 0; direction < neighbourOffsets.length; direction++) {
      const nextIndex = neighbour(scene, grid, node, direction);
      if (nextIndex < 0 || closed[nextIndex]) continue;
      const next = grid.nodes[nextIndex], cost = costs[node.index] + Math.hypot(next.x-node.x,next.y-node.y);
      if (cost >= costs[nextIndex]) continue;
      costs[nextIndex] = cost; parents[nextIndex] = node.index;
      heapPush(heap, {index:nextIndex, score:cost+heuristic(next), cost});
    }
  }
  const result = {nodes, parents, goal:closest(nodes,target), complete:true};
  return remember(grid.searches, `${start.index}:component`, result, MAX_SEARCHES);
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
    const start = closest(nodes, from, node => visible(scene, grid, from, node));
    if (!start) return null;
    const result = search(scene, grid, start, target);
    return result?.goal ? {x:result.goal.x,y:result.goal.y} : null;
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
  const start = closest(grid.nodes, from, node => visible(scene, grid, from, node));
  if (!start) return [];
  const component = search(scene, grid, start, target);
  const goal = component?.goal;
  if (!goal) return [];
  const raw = [];
  for (let index = goal.index; index >= 0; index = component.parents[index]) {
    const node = grid.nodes[index]; raw.push({ x: node.x, y: node.y });
  }
  raw.reverse(); raw.unshift({ x: from.x, y: from.y });
  if (visible(scene, grid, raw.at(-1), target)) raw.push({ x: target.x, y: target.y });
  else if (!options.nearest) return [];
  const path = [raw[0]];
  for (let index = 0; index < raw.length - 1;) {
    let next = raw.length - 1;
    while (next > index + 1 && !visible(scene, grid, raw[index], raw[next])) next--;
    path.push(raw[next]); index = next;
  }
  return path.map(node => [node.x, node.y]);
}
