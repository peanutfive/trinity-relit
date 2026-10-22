import { LOGICAL_SIZE } from './scene-manifest.js';
// One coordinate/collision contract for gameplay and scene audits.
export function isBlocked(scene, x, y) {
  return !Number.isFinite(x) || !Number.isFinite(y)
    || x < 12 || x > LOGICAL_SIZE.width - 12 || y < 12 || y > LOGICAL_SIZE.height - 12
    || scene.obstacles.some(object => x > object.x - 7 && x < object.x + object.w + 7
      && y > object.y - 4 && y < object.y + object.h + 5);
}
