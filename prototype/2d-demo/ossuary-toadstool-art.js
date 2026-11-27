import {JAPAN_PROPS} from './japan-art-layout.js';

export const OSSUARY_TOADSTOOL_ART = './assets/ossuary-toadstool-plain-v1.png';

// The plain stem is registered against the full open-door frame. Share its
// ground pivot and scale so the cap remains still when the door disappears.
export function drawOssuaryToadstool(ctx, x, y, resolve) {
  const image = resolve(OSSUARY_TOADSTOOL_ART);
  if (!image?.naturalWidth) return false;
  const {source, foot, height} = JAPAN_PROPS.mushroom_open;
  const [sx, sy, width, sourceHeight] = source;
  const scale = height / sourceHeight;
  ctx.save();
  ctx.fillStyle = 'rgba(20,24,23,.22)';
  ctx.beginPath();
  ctx.ellipse(x, y + .6, 15, 1.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(image, x + (sx - foot[0]) * scale, y + (sy - foot[1]) * scale, width * scale, height);
  ctx.restore();
  return true;
}
