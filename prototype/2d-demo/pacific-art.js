const image = file => {
  if (typeof Image !== 'function') return null;
  const sheet = new Image();sheet.src = new URL(file,import.meta.url).href;return sheet;
};
const sheet = image('./assets/pacific-props-v1.png');
const ready = () => Boolean(sheet?.complete && sheet.naturalWidth);
// Scene transitions draw a serialized snapshot, not a live GameState instance.
const flag=(state,id)=>state.hasFlag?.(id)??(state.flags instanceof Set?state.flags.has(id):(state.flags||[]).includes(id));

// Source regions sample the original RGBA without flattening or resampling it.
// Every cabinet uses the same scale and actual lower attachment line. The
// opened door adds width on the left; it never shifts the fixed main body.
export const PACIFIC_BOX_SCALE = 22/387;
export const PACIFIC_BOX_FRAMES = Object.freeze([
  {pose:'closed',source:[52,147,309,405],foot:[208,540]},
  {pose:'open',source:[375,146,368,403],foot:[611,540]},
  {pose:'switch_pressed',source:[757,146,370,403],foot:[995,540]},
  {pose:'button_pressed',source:[1143,146,370,403],foot:[1381,540]},
]);
export const PACIFIC_COCONUT_REGIONS = Object.freeze({
  whole:{source:[1526,236,291,311],foot:[1670,539],width:8},
  cracked:{source:[1829,237,335,324],foot:[1995,552],width:10},
});

// Read-only projection of the shared chapter's real flags and turn timer.
// Rendering must not start, tick or clear the timer or simulate a new deadline.
export function pacificControlState(state) {
  const open = flag(state,'pacific_box_open');
  const switched = flag(state,'pacific_switch_pushed');
  const pushed = flag(state,'pacific_button_pushed');
  const frame = !open ? 0 : pushed ? 3 : switched ? 2 : 1;
  return {
    boxOpen:open,switchPressed:switched,buttonPressed:pushed,
    expired:flag(state,'pacific_timer_expired'),
    timerTurns:state.timer?.id === 'pacific_switch' ? state.timer.remaining : null,
    frame,pose:PACIFIC_BOX_FRAMES[frame].pose,
  };
}

function stamp(c,region,p,scale) {
  const [sx,sy,sw,sh] = region.source;
  c.save();c.imageSmoothingEnabled = true;
  c.drawImage(sheet,sx,sy,sw,sh,
    p.x+(sx-region.foot[0])*scale,p.y+(sy-region.foot[1])*scale,sw*scale,sh*scale);
  c.restore();
}
export function renderPacificSprite(c,object,state) {
  const raw = object.visualOptions?.drawAt || object;
  const p = Array.isArray(raw) ? {x:raw[0],y:raw[1]} : raw;
  if (object.kind === 'pacific_box') {
    if (!ready()) return false;
    const control = pacificControlState(state);
    stamp(c,PACIFIC_BOX_FRAMES[control.frame],p,PACIFIC_BOX_SCALE);
    return true;
  }
  if (object.kind === 'pacific_coconut' || object.kind === 'coconut') {
    if (!ready()) return false;
    const region = PACIFIC_COCONUT_REGIONS[flag(state,'coconut_cracked')?'cracked':'whole'];
    c.save();c.fillStyle='rgba(39,36,22,.18)';
    c.beginPath();c.ellipse(p.x,p.y,.38*region.width,1,0,0,Math.PI*2);c.fill();c.restore();
    stamp(c,region,p,region.width/region.source[2]);return true;
  }
  // These hit regions sample controls already painted in the cabinet, or
  // scenery already painted in the background; no second floating prop.
  return ['pacific_switch','pacific_button','pacific_outside_button'].includes(object.kind);
}
export const pacificArtStatus = () => ready() ? 'loaded' : 'loading';
