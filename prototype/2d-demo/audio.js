// Optional local sound. No context or sound is created until an explicit unlock.
const DEFAULTS = { enabled: false, master: 35, ambience: 25, interfaceVolume: 35 };
const volume = (value, fallback) => Number.isFinite(Number(value))
  ? Math.max(0, Math.min(100, Number(value))) : fallback;

export function createAudio() {
  const Context = globalThis.AudioContext || globalThis.webkitAudioContext;
  const supported = typeof Context === 'function';
  let settings = { ...DEFAULTS }, paused = false, disposed = false;
  let context = null, masterGain = null, ambienceGain = null, uiGain = null;
  let windSource = null, windMotion = null;
  const activeTones = new Set();

  function ramp(parameter, target, seconds = .18) {
    if (!context || !parameter) return;
    const now = context.currentTime;
    parameter.cancelScheduledValues(now);
    parameter.setValueAtTime(parameter.value, now);
    parameter.linearRampToValueAtTime(target, now + seconds);
  }

  function apply() {
    if (!context || context.state === 'closed') return;
    ramp(masterGain?.gain, settings.enabled ? settings.master / 100 : 0);
    ramp(ambienceGain?.gain, paused ? 0 : settings.ambience / 100 * .085, .5);
    ramp(uiGain?.gain, settings.interfaceVolume / 100 * .13);
  }

  function buildWind() {
    // A deterministic, softly coloured noise loop. No media files or downloads.
    const length = Math.round(context.sampleRate * 8);
    const buffer = context.createBuffer(2, length, context.sampleRate);
    for (let channel = 0; channel < 2; channel++) {
      const data = buffer.getChannelData(channel);
      let seed = 7817 + channel * 1409, low = 0;
      for (let i = 0; i < length; i++) {
        seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
        const white = (seed >>> 0) / 2147483648 - 1;
        low = low * .975 + white * .025;
        const gust = .68 + .18 * Math.sin(i / length * Math.PI * 2)
          + .08 * Math.sin(i / length * Math.PI * 6 + channel);
        data[i] = low * 4.5 * gust;
      }
      // Blend the ends to keep even the low-frequency component seamless.
      const fade = Math.round(context.sampleRate * .08);
      for (let i = 0; i < fade; i++) {
        const amount = i / fade;
        data[i] = data[length - fade + i] * (1 - amount) + data[i] * amount;
      }
    }
    windSource = context.createBufferSource();
    windSource.buffer = buffer;
    windSource.loop = true;
    const highpass = context.createBiquadFilter();
    highpass.type = 'highpass'; highpass.frequency.value = 95;
    const lowpass = context.createBiquadFilter();
    lowpass.type = 'lowpass'; lowpass.frequency.value = 620; lowpass.Q.value = .45;
    windSource.connect(highpass); highpass.connect(lowpass); lowpass.connect(ambienceGain);
    // Very slow spectral drift gives the wind gentle movement.
    windMotion = context.createOscillator();
    const depth = context.createGain();
    windMotion.frequency.value = .075; depth.gain.value = 120;
    windMotion.connect(depth); depth.connect(lowpass.frequency);
    windSource.start(); windMotion.start();
  }

  function configure(next = {}) {
    if (typeof next.enabled === 'boolean') settings.enabled = next.enabled;
    for (const key of ['master', 'ambience', 'interfaceVolume']) {
      if (key in next) settings[key] = volume(next[key], settings[key]);
    }
    apply();
  }

  async function unlock() {
    if (disposed || !supported || !settings.enabled) return;
    try {
      if (!context) {
        context = new Context();
        masterGain = context.createGain();
        ambienceGain = context.createGain();
        uiGain = context.createGain();
        masterGain.gain.value = 0; ambienceGain.gain.value = 0; uiGain.gain.value = 0;
        ambienceGain.connect(masterGain); uiGain.connect(masterGain);
        masterGain.connect(context.destination);
        buildWind();
      }
      if (context.state === 'suspended') await context.resume();
      if (!disposed) apply();
    } catch {
      // Unsupported/blocked audio must never prevent exploring or using settings.
    }
  }

  function setPaused(value) {
    paused = Boolean(value);
    apply();
  }

  function playUi(kind = 'confirm') {
    if (disposed || !settings.enabled || !context || context.state !== 'running'
      || settings.master === 0 || settings.interfaceVolume === 0) return;
    try {
      const cancel = kind === 'cancel' || kind === 'back';
      const click = kind === 'click' || kind === 'move';
      const duration = click ? .055 : .115;
      const now = context.currentTime;
      const tone = context.createOscillator(), envelope = context.createGain();
      tone.type = 'sine';
      tone.frequency.setValueAtTime(cancel ? 262 : click ? 440 : 523.25, now);
      tone.frequency.exponentialRampToValueAtTime(cancel ? 196 : click ? 392 : 659.25,
        now + duration);
      envelope.gain.setValueAtTime(0, now);
      envelope.gain.linearRampToValueAtTime(.32, now + .008);
      envelope.gain.exponentialRampToValueAtTime(.001, now + duration);
      tone.connect(envelope); envelope.connect(uiGain);
      activeTones.add(tone);
      tone.onended = () => { activeTones.delete(tone); tone.disconnect(); envelope.disconnect(); };
      tone.start(now); tone.stop(now + duration + .025);
    } catch {
      // A browser may close/suspend audio while a menu event is in flight.
    }
  }

  function getState() {
    return { ...settings, supported, unlocked: Boolean(context && context.state === 'running'), paused };
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    for (const node of [windSource, windMotion, ...activeTones]) {
      try { node?.stop(); node?.disconnect(); } catch { /* Already ended. */ }
    }
    activeTones.clear();
    if (context && context.state !== 'closed') {
      try { const result = context.close(); result?.catch?.(() => {}); } catch { /* Already closing. */ }
    }
    context = null;
  }

  return { configure, setPaused, unlock, playUi, getState, dispose };
}
