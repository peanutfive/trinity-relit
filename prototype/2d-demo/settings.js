export const DEFAULT_BINDINGS = Object.freeze({
  up: 'w', down: 's', left: 'a', right: 'd',
  interact: 'z', inventory: 'i', look: 'l', hint: 'h', fullscreen: 'f',
});
const STORAGE_KEY = 'trinity-2d-demo-preferences-v1';
export function defaultPreferences() {
  return {
    bindings: { ...DEFAULT_BINDINGS },
    video: { resolution: 3, brightness: 100, effects: true },
    audio: { enabled: false, master: 55, ambience: 35, interfaceVolume: 45 },
  };
}
const clamp = (value, fallback, min, max) => Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;
export function loadPreferences() {
  const result = defaultPreferences();
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved || typeof saved !== 'object') return result;
    // Load bindings as a complete conflict-free set; corrupted maps fall back together.
    const bindings = Object.fromEntries(Object.keys(DEFAULT_BINDINGS).map(key => [key, saved.bindings?.[key]]));
    const values = Object.values(bindings);
    if (values.every(value => typeof value === 'string' && /^[a-z0-9]$/.test(value)) && new Set(values).size === values.length) result.bindings = bindings;
    if ([1, 2, 3].includes(saved.video?.resolution)) result.video.resolution = saved.video.resolution;
    result.video.brightness = clamp(saved.video?.brightness, 100, 70, 130);
    if (typeof saved.video?.effects === 'boolean') result.video.effects = saved.video.effects;
    if (typeof saved.audio?.enabled === 'boolean') result.audio.enabled = saved.audio.enabled;
    for (const key of ['master', 'ambience', 'interfaceVolume']) result.audio[key] = clamp(saved.audio?.[key], result.audio[key], 0, 100);
  } catch { /* Storage is optional; blocked or malformed storage uses defaults. */ }
  return result;
}
export function savePreferences(preferences) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences)); } catch { /* Session settings still work. */ }
}
export const keyLabel = key => key.toUpperCase();
