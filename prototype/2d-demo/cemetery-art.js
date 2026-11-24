import { propImage } from './art.js';
import { cemeteryAsset as asset, cemeteryTombs as graves, CEMETERY_ITEM_ART } from './cemetery-assets.js';

export function cemeteryShroudAtlas() {
  return propImage(asset('hero-shroud'));
}

export function drawCemeteryTomb(ctx, view) {
  const source = !view.open ? graves.closed : view.shrouded ? graves.shrouded : graves.uncovered;
  const image = propImage(source);
  if (image) ctx.drawImage(image, 137, 101, 82, 51);
}

const bounds = (x, y, width, height) => Object.freeze([x, y, width, height]);
// Fixed regions on the 16:9 painting. The mouth and coin share a position,
// while the separate larger shroud never conceals the knot or the lips.
export const cemeteryBodyRegions = Object.freeze({
  shroud: bounds(.66, .60, .31, .36),
  bandage: bounds(.09, .25, .18, .34),
  mouth: bounds(.42, .31, .15, .22),
});

export function cemeteryDetailRegions(view) {
  const regions = {};
  if (!view.open) return regions;
  if (view.shrouded) regions.shroud = cemeteryBodyRegions.shroud;
  if (view.bound) regions.bandage = cemeteryBodyRegions.bandage;
  else if (view.coinSeen && view.coinPresent) regions.coin = cemeteryBodyRegions.mouth;
  else regions.mouth = cemeteryBodyRegions.mouth;
  return regions;
}

export function cemeteryDetailImage(view) {
  if (!view.open) return graves.closed;
  const body = view.shrouded ? 'shrouded' : 'uncovered';
  const jaw = view.bound ? 'bound' : view.coinSeen && view.coinPresent ? 'coin' : 'mouth';
  return `./assets/cemetery-detail-${body}-${jaw}-v1.webp`;
}

const loose = {
  shroud: { slot: 0, width: 17 },
  bandage: { slot: 1, width: 11 },
  silver_coin: { slot: 2, width: 6 },
};

export function renderCemeteryItem(ctx, object) {
  const prop = loose[object.itemId ?? object.kind];
  if (!prop) return false;
  const image = propImage(CEMETERY_ITEM_ART);
  if (image) {
    const at = object.visualOptions?.drawAt ?? object;
    const width = image.naturalWidth / 3;
    const height = prop.width * image.naturalHeight / width;
    ctx.drawImage(image, prop.slot * width, 0, width, image.naturalHeight,
      at.x - prop.width / 2, at.y - height, prop.width, height);
  }
  return true;
}
