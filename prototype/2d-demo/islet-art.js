// The dory and rower share a waterline. Only the head, arms and oar change
// pose; anchoring below the hull instead of below the oar keeps the boat still.
const scale = 86 / 492;
const frames = [0, 1, 2, 3].map(index => ({
  left: 544 * index + 10,
  top: 184,
  width: 526,
  height: 357,
}));
let sheet;

function loadSheet() {
  if (!sheet && typeof Image === 'function') {
    sheet = new Image();
    sheet.src = new URL('./assets/islet-ferry-props-v1.png', import.meta.url).href;
  }
  return sheet?.complete && sheet.naturalWidth > 0;
}

export function renderIsletSprite(ctx, object, state, time = 0) {
  // The cap, door and oarsman's smaller pointer region have their own hotspots.
  if (object.kind === 'islet_gate' || object.kind === 'islet_oarsman') return true;
  if (object.kind !== 'islet_ferry') return false;
  if (!loadSheet()) return true;

  // The moored ferry rests for most of the cycle. The boatman occasionally
  // dips, draws and lifts his blade to hold it near the bank.
  const phase = time % 8;
  const pose = phase < 5.8 ? 0 : phase < 6.45 ? 1 : phase < 7.15 ? 2 : 3;
  const frame = frames[pose];
  const anchor = object.visualOptions?.drawAt || object;
  const bob = Math.sin(time * 1.15) * 0.42;
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.fillStyle = 'rgba(15,31,32,.25)';
  ctx.beginPath();
  ctx.ellipse(anchor.x, anchor.y, 36, 2.2, -0.025, 0, Math.PI * 2);
  ctx.fill();
  ctx.drawImage(sheet, frame.left, frame.top, frame.width, frame.height,
    anchor.x - (266 - 10) * scale, anchor.y - (488 - frame.top) * scale + bob,
    frame.width * scale, frame.height * scale);
  ctx.restore();
  return true;
}

export function isletArtStatus() {
  if (!sheet) return 'idle';
  return sheet.complete && sheet.naturalWidth > 0 ? 'loaded' : 'loading';
}
