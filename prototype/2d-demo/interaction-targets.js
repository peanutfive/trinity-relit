import { actorHitShape } from './actor-layout.js';
import { pointInPolygon } from './world.js';

const directions = { up: [0, -1], right: [1, 0], down: [0, 1], left: [-1, 0] };
// Measured in world pixels, with a little pointer tolerance around the artwork.
// Interaction reach is independent: a small sprite must not create a large,
// invisible clickable patch, and a distant landmark can still be observed.
const silhouettes = {
  ball: [7, 7, -5], ruby: [6, 6, -4], gem: [6, 6, -4],
  paper_boat: [10, 6, -3.5], paper_bird: [11, 8, -5.5], paper: [11, 8, -5.5],
  gnomon: [9, 7, -5], bag: [9, 8, -6], splinter: [14, 10, -8],
  headphones: [3.5, 3.5, 0], dish: [5, 3, -1.5],
  sign: [10, 19, -17], umbrella: [9, 16, -13], umbrella_tree: [19, 14, -.5],
  pram: [24, 19, -13], door: [15, 25, -23],
};

export function isInteractive(object) {
  return object?.visual !== false && !object?.visualOnly && object?.radius > 0
    && object.actions?.some(action => typeof action.command === 'string' && action.command.length > 0);
}

export function withinReach(player, object, inset = 0) {
  return isInteractive(object) && Math.hypot(player.x - object.x, player.y - object.y) < object.radius - inset;
}

export function nearbyTarget(objects, player) {
  const [fx, fy] = directions[player.face] || directions.down;
  return objects.filter(object => withinReach(player, object)).map(object => {
    const dx = object.x - player.x, dy = object.y - player.y, distance = Math.hypot(dx, dy);
    const alignment = distance > .001 ? (dx * fx + dy * fy) / distance : 1;
    return { object, distance, alignment, score: distance + (1 - alignment) * 12 };
  }).filter(hit => hit.distance <= 8 || hit.alignment >= .1)
    .sort((a, b) => a.score - b.score || a.object.id.localeCompare(b.object.id))[0]?.object;
}

export function pointerTarget(objects, point, { padding = 0 } = {}) {
  const hits = [];
  for (const object of objects.filter(isInteractive)) {
    const custom = object.pointerShape;
    let shape = custom || actorHitShape(object), priority = custom?.priority ?? 1;
    if (!shape) {
      const [rx, ry, offset] = object.kind === 'umbrella' && (object.visualOptions?.open || object.open)
        ? [18, 14, -11] : silhouettes[object.kind] || [20, 20, -10];
      shape = { x: object.x, y: object.y + offset, rx, ry };
      // A dish/headphone/loose prop may overlap its owner or a larger landmark.
      priority = object.itemId || ['headphones', 'dish'].includes(object.kind) ? 2 : 0;
    }
    const distance = shape.kind === 'polygon' ? (pointInPolygon(point.x, point.y, shape.points) ? 0 : Infinity)
      : ((point.x - shape.x) / (shape.rx + padding)) ** 2 + ((point.y - shape.y) / (shape.ry + padding)) ** 2;
    if (distance > 1) continue;
    if (shape.kind === 'annulus' && ((point.x - shape.x) / Math.max(.01, shape.innerRx - padding)) ** 2
      + ((point.y - shape.y) / Math.max(.01, shape.innerRy - padding)) ** 2 < 1) continue;
    hits.push({ object, priority, distance });
  }
  return hits.sort((a, b) => b.priority - a.priority || a.distance - b.distance || b.object.y - a.object.y)[0]?.object;
}
