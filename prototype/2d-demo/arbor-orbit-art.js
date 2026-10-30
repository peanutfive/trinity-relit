// Raw generated RGBA images are sampled directly; logical positions stay in the
// controller. Animation time is supplied by the paused game clock.
import {paintCharacter} from './character.js';
const axe = typeof Image === 'function' ? new Image() : null;
const props = typeof Image === 'function' ? new Image() : null;
if (axe) axe.src = new URL('./assets/arbor-axe-v1.png', import.meta.url).href;
if (props) props.src = new URL('./assets/ug-props-v1.png', import.meta.url).href;
export const ARBOR_ORBIT_REGIONS = Object.freeze({
  axe: Object.freeze([51, 71, 1175, 1143]),
  bubble: Object.freeze([1396, 175, 574, 565]),
});
const clamp = n => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));
const ready = image => Boolean(image?.complete && image.naturalWidth);
function paintAxe(c, x, y, width = 18) {
  if (!ready(axe)) return false;
  const h = width * ARBOR_ORBIT_REGIONS.axe[3] / ARBOR_ORBIT_REGIONS.axe[2];
  c.drawImage(axe, ...ARBOR_ORBIT_REGIONS.axe, x - width / 2, y - h, width, h);
  return true;
}
function membrane(c, x, y, width, height, alpha) {
  if (!ready(props) || alpha <= 0) return;
  c.save(); c.globalAlpha *= alpha;
  c.drawImage(props, ...ARBOR_ORBIT_REGIONS.bubble, x - width / 2, y - height / 2, width, height);
  c.restore();
}
export function renderOrbitPlayer(c, player, time = 0, {fade = 1, burst = 0} = {}) {
  const clock = Number.isFinite(time) ? time : 0, pop = clamp(burst);
  const bob = Math.sin(clock * .85) * 1.05, tilt = Math.sin(clock * .48) * .025;
  const x = Number.isFinite(player?.x) ? player.x : 220;
  const y = (Number.isFinite(player?.y) ? player.y : 180) + bob;
  const width = 60 * (1 + pop * .14), height = 62 * (1 + pop * .14);
  c.save(); c.globalAlpha *= clamp(fade); c.translate(x, y - 17); c.rotate(tilt);
  // A rear film and a lighter front film keep the same painted iridescence as
  // the small inventory bubble while preserving the explorer's silhouette.
  membrane(c, 0, 0, width, height, .62 * (1 - pop));
  c.save(); c.scale(.86, .86);
  paintCharacter(c, 0, 19, '#bca071', player?.facing || player?.face || 'right', 0, false,
    {airborne: true, moving: false, blend: 0, action: 'idle', time: clock});
  c.restore();
  membrane(c, 0, 0, width, height, .2 * (1 - pop));
  if (pop > 0 && pop < 1) {
    paintAxe(c, 11, 2, 13);
    // Brief film glints separate from the body as the membrane expands.
    c.save(); c.globalAlpha *= Math.sin(pop * Math.PI) * .65; c.lineWidth = .7;
    for (let i = 0; i < 6; i++) {
      const a = i * Math.PI / 3 + .2, r = 29 + pop * 13;
      c.strokeStyle = i % 2 ? '#d1bfdc' : '#cce2d8'; c.beginPath();
      c.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      c.lineTo(Math.cos(a + .08) * (r + 3), Math.sin(a + .08) * (r + 3)); c.stroke();
    }
    c.restore();
  }
  c.restore(); return true;
}
export function renderArborOrbitSprite(c, object, state, time = 0) {
  const v = object.visualOptions || {};
  if (object.kind === 'arbor_axe') {
    const p = v.drawAt || object;
    return paintAxe(c, p.x, p.y);
  }
  if (object.kind === 'orbit_rider') return renderOrbitPlayer(c,
    {...object, facing: v.facing}, time, {fade: v.fade ?? 1, burst: v.burst ?? 0});
  return ['orbit_membrane', 'orbit_hull', 'arbor_waterfall'].includes(object.kind);
}
export const arborOrbitArtStatus = () => ready(axe) && ready(props) ? 'loaded' : 'loading';
