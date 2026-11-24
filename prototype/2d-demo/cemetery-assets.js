export const cemeteryAsset = name => `./assets/cemetery-${name}-v1.png`;
export const cemeteryTombs = {
  closed: cemeteryAsset('tomb-closed'),
  shrouded: cemeteryAsset('tomb-shrouded'),
  uncovered: cemeteryAsset('tomb-uncovered'),
};
export const CEMETERY_ITEM_ART = cemeteryAsset('loose-items');
export const CEMETERY_SCENE_ART = [...Object.values(cemeteryTombs), CEMETERY_ITEM_ART];
