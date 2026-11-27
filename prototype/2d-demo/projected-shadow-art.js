import {ARBOR_POINTS} from './arbor-points.js';
import {UG_POINTS} from './underground-points.js';
import {projectedDoorView, vertexShadowView} from './islet-shadow.js';

const motion = new WeakMap();

function shadowTip(room, state) {
  if (room !== 'waterfall' && room !== 'ossuary') return null;
  const view = projectedDoorView(state, room);
  if (!view.near && !view.aligned) return null;

  const {phase, leverUp} = vertexShadowView(state);
  const falls = room === 'waterfall';
  const gate = falls ? ARBOR_POINTS.mushroom : UG_POINTS.mushroom;
  const handed = state.flipped ? -1 : 1;
  const travel = view.aligned ? 0 : phase < 5 ? phase - 5 : phase - 6;
  return {
    x: gate.x + (falls ? 0 : 9 * handed) * travel,
    y: gate.y - (falls ? 9 : 5) * travel,
    tailX: gate.x + (falls ? 66 : -160 * handed),
    tailY: falls ? 301 : 256,
    phase, leverUp, aligned: view.aligned,
  };
}

function renderPosition(ctx, room, state, tip, time, effects) {
  let last = motion.get(ctx);
  const advance = effects && tip.leverUp && !tip.aligned && last?.leverUp
    && last.room === room && last.state === state && last.phase + 1 === tip.phase;
  if (!last || last.room !== room || last.state !== state || last.phase !== tip.phase
      || last.leverUp !== tip.leverUp || last.tailX !== tip.tailX) {
    last = {
      room, state, phase: tip.phase, leverUp: tip.leverUp, tailX: tip.tailX,
      start: time, fromX: advance ? last.x : tip.x, fromY: advance ? last.y : tip.y,
      x: tip.x, y: tip.y,
    };
    motion.set(ctx, last);
  }
  // Only ease a real turn of the dial. Waiting at a prompt cannot unlock
  // a door, and the two open phases must meet its foot from the first frame.
  const t = effects && tip.leverUp ? Math.max(0, Math.min(1, (time - last.start) / .28)) : 1;
  const eased = t * t * (3 - 2 * t);
  last.x = last.fromX + (tip.x - last.fromX) * eased;
  last.y = last.fromY + (tip.y - last.fromY) * eased;
  return last;
}

function wedge(ctx, tip, tail, halfWidth) {
  const dx = tail.x - tip.x, dy = tail.y - tip.y;
  const length = Math.hypot(dx, dy), nx = -dy / length, ny = dx / length;
  ctx.beginPath();
  ctx.moveTo(tip.x, tip.y);
  ctx.lineTo(tip.x + dx * .37 + nx * (halfWidth * .37 + .65),
    tip.y + dy * .37 + ny * (halfWidth * .37 + .65));
  ctx.lineTo(tail.x + nx * halfWidth, tail.y + ny * halfWidth);
  ctx.lineTo(tail.x - nx * halfWidth, tail.y - ny * halfWidth);
  ctx.lineTo(tip.x + dx * .53 - nx * (halfWidth * .53 - .55),
    tip.y + dy * .53 - ny * (halfWidth * .53 - .55));
  ctx.closePath();
  ctx.fill();
}

export function drawProjectedShadow(ctx, room, state, time = 0, effects = true) {
  const tip = shadowTip(room, state);
  if (!tip) {
    motion.delete(ctx);
    return;
  }
  const point = renderPosition(ctx, room, state, tip, time, effects);
  const tail = {x: tip.tailX, y: tip.tailY};
  const gradient = ctx.createLinearGradient(point.x, point.y, tail.x, tail.y);
  gradient.addColorStop(0, 'rgba(48,53,66,.68)');
  gradient.addColorStop(.20, 'rgba(52,56,65,.62)');
  gradient.addColorStop(.64, 'rgba(61,66,72,.43)');
  gradient.addColorStop(1, 'rgba(71,77,78,0)');
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = gradient;
  const opacity = ctx.globalAlpha;
  ctx.globalAlpha = opacity * .22;
  wedge(ctx, point, tail, 23);
  ctx.globalAlpha = opacity;
  wedge(ctx, point, tail, 20);
  ctx.restore();
}
