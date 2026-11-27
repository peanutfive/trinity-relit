export const ARBOR_LIGHT_ART = Object.freeze({
  arboretum: './assets/arboretum-v2.webp',
  top_of_arbor: './assets/arbor-top-v2.webp',
  trellises: './assets/trellises-v3.webp',
  north_arbor: './assets/arbor-north-v2.webp',
  south_arbor: './assets/arbor-south-v2.webp',
  crystal: './assets/arbor-crystal-v1.png',
});

export function drawArborCrystal(ctx, x, y, resolve, flipped = false) {
  const image = resolve(ARBOR_LIGHT_ART.crystal);
  if (!image?.naturalWidth) return false;
  const height = 51;
  const width = height * image.naturalWidth / image.naturalHeight;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(flipped ? -1 : 1, 1);
  const shadow = ctx.createRadialGradient(0, 0, 0, 0, 0, 12);
  shadow.addColorStop(0, 'rgba(39,34,19,.52)');
  shadow.addColorStop(1, 'rgba(39,34,19,0)');
  ctx.save();
  ctx.scale(1, .26);
  ctx.fillStyle = shadow;
  ctx.fillRect(-12, -12, 24, 24);
  ctx.restore();
  ctx.drawImage(image, -width / 2, -height, width, height);
  ctx.restore();
  return true;
}

export function drawArborTopLight(ctx, {lit, x = 240, y = 144, lantern = false}) {
  ctx.save();
  if (!lit) {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, 480, 288);
    ctx.restore();
    return;
  }
  const radius = lantern ? 185 : 137;
  const warmth = ctx.createRadialGradient(x, y, 0, x, y, radius);
  warmth.addColorStop(0, 'rgba(219,165,94,.16)');
  warmth.addColorStop(.32, 'rgba(178,141,84,.10)');
  warmth.addColorStop(1, 'rgba(126,108,78,0)');
  ctx.globalCompositeOperation = 'screen';
  ctx.fillStyle = warmth;
  ctx.fillRect(0, 0, 480, 288);
  ctx.globalCompositeOperation = 'source-over';
  const falloff = ctx.createRadialGradient(x, y, 8, x, y, radius * 1.6);
  falloff.addColorStop(0, 'rgba(1,4,5,0)');
  falloff.addColorStop(.37, 'rgba(1,4,5,.08)');
  falloff.addColorStop(.75, 'rgba(1,4,5,.38)');
  falloff.addColorStop(1, 'rgba(1,4,5,.66)');
  ctx.fillStyle = falloff;
  ctx.fillRect(0, 0, 480, 288);
  ctx.restore();
}
