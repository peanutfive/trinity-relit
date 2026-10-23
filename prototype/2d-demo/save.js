import { SAVE_VERSION as ENGINE_SAVE_VERSION } from '../js/engine.js';
import { TIMERS as PROLOGUE_TIMERS } from '../js/data/prologue.js';
import { SCENES, LOGICAL_SIZE } from './scene-manifest.js';
import { isBlocked as worldIsBlocked } from './world.js';

// This key is intentionally unrelated to the text game's trinity-relit:save:v1.
export const VISUAL_SAVE_VERSION = 1;
export const VISUAL_SAVE_KEY = `trinity-relit:hd2d:save:v${VISUAL_SAVE_VERSION}`;
const SUPPORTED_TIMERS = new Set(Object.keys(PROLOGUE_TIMERS));
const FACES = new Set(['up', 'down', 'left', 'right']);
const own = (value, key) => Object.hasOwn(value, key);
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value)
  && [Object.prototype, null].includes(Object.getPrototypeOf(value));
const text = value => typeof value === 'string' && value.length > 0;
const list = value => Array.isArray(value) && value.every(text);
const numericMap = value => map(value, Number.isSafeInteger);
function map(value, valid) {
  return record(value) && Object.entries(value).every(([key, entry]) =>
    !['__proto__', 'constructor', 'prototype'].includes(key) && valid(entry));
}
function fail(code, message) {
  const error = new Error(message);
  error.code = code;
  throw error;
}
function validateEngineEnvelope(save, scenes) {
  if (!record(save) || save.version !== ENGINE_SAVE_VERSION || !record(save.state)) {
    fail('ENGINE_FORMAT', '游戏状态格式或版本不兼容。');
  }
  const state = save.state;
  if (!text(state.room) || !own(scenes, state.room)) fail('ROOM_UNSUPPORTED', '该存档的房间尚未制作二维场景。');
  if (!text(state.chapter) || state.chapter !== scenes[state.room].chapter) fail('CHAPTER_MISMATCH', '存档章节与房间不一致。');
  const checks = {
    itemLoc: value => map(value, text), flags: list, visited: list, counters: numericMap,
    score: Number.isFinite, maxScore: value => Number.isFinite(value) && value > 0,
    turns: value => Number.isSafeInteger(value) && value >= 0,
    flipped: value => typeof value === 'boolean', leverPulled: value => typeof value === 'boolean',
    dead: value => typeof value === 'boolean',
    sundialSymbol: value => Number.isSafeInteger(value) && value >= 1 && value <= 7,
    timer: value => value === null || (record(value) && text(value.id) && Number.isSafeInteger(value.remaining)),
  };
  for (const [key, valid] of Object.entries(checks)) {
    if (own(state, key) && !valid(state[key])) fail('ENGINE_FIELD', `游戏状态字段「${key}」格式错误。`);
  }
  const chapters = new Set(Object.values(scenes).map(scene => scene.chapter));
  for (const flag of state.flags || []) {
    const chapter = /^chapter_(.+)_entered$/.exec(flag)?.[1];
    if (chapter && !chapters.has(chapter)) fail('CHAPTER_UNSUPPORTED', '该存档包含尚未开放的二维章节。');
  }
  if (state.timer && !SUPPORTED_TIMERS.has(state.timer.id)) fail('TIMER_UNSUPPORTED', '该存档的计时器无法在当前二维版本中恢复。');
  if (state.dead) fail('DEAD_STATE', '死亡状态不能作为继续冒险的存档。');
}
function rawPacket(input) {
  if (typeof input !== 'string') return input;
  try { return JSON.parse(input); }
  catch { fail('JSON', '文件不是有效的存档格式。'); }
}
function clearSegment(scene, from, to, blocked) {
  const distance = Math.hypot(to.x - from.x, to.y - from.y);
  const steps = Math.max(1, Math.ceil(distance / 2));
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    if (blocked(scene, from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t)) return false;
  }
  return true;
}
function reachable(scene, point, blocked) {
  const start = { x: scene.spawn[0], y: scene.spawn[1] };
  if (clearSegment(scene, start, point, blocked)) return true;
  // A small room-local flood avoids placing a restored character in an isolated
  // pocket. Edge sampling prevents crossing a thin collider between grid points.
  const stride = 8, queue = [start], visited = new Set([`${start.x},${start.y}`]);
  for (let index = 0; index < queue.length; index++) {
    const node = queue[index];
    if (Math.hypot(node.x - point.x, node.y - point.y) <= stride * 1.5
      && clearSegment(scene, node, point, blocked)) return true;
    for (const [dx, dy] of [[stride, 0], [-stride, 0], [0, stride], [0, -stride]]) {
      const next = { x: node.x + dx, y: node.y + dy }, key = `${next.x},${next.y}`;
      if (visited.has(key) || next.x < 12 || next.x > LOGICAL_SIZE.width - 12
        || next.y < 12 || next.y > LOGICAL_SIZE.height - 12) continue;
      visited.add(key);
      if (clearSegment(scene, node, next, blocked)) queue.push(next);
    }
  }
  return false;
}
const PAPER_CRAFT_ID = 'round_pond:paper-craft';
const stableObjectId = value => typeof value === 'string'
  && /^[a-z][a-z0-9_-]*(?::[a-z0-9_-]+)+$/i.test(value);
function knowledgeLists(value, validId) {
  return Array.isArray(value) && value.every(validId) && new Set(value).size === value.length;
}
function normalizeKnowledge(value) {
  if (value === undefined) return { observed: [], paper: { observed: [], identified: [] } };
  const knownKeys = (object, keys) => record(object)
    && Object.keys(object).every(key => keys.includes(key));
  if (!knownKeys(value, ['observed', 'paper']) || !knowledgeLists(value.observed, stableObjectId)
    || !knownKeys(value.paper, ['observed', 'identified'])
    || !knowledgeLists(value.paper.observed, id => id === PAPER_CRAFT_ID)
    || !knowledgeLists(value.paper.identified, id => id === PAPER_CRAFT_ID)
    || value.paper.identified.some(id => !value.paper.observed.includes(id))) {
    fail('VISUAL_KNOWLEDGE', '存档中的观察与辨认记录格式错误。');
  }
  return { observed: [...value.observed], paper: {
    observed: [...value.paper.observed], identified: [...value.paper.identified],
  } };
}

function visualPosition(visual, scene, blocked) {
  if (!Array.isArray(scene.spawn) || !Number.isFinite(scene.spawn[0]) || !Number.isFinite(scene.spawn[1])
    || blocked(scene, scene.spawn[0], scene.spawn[1])) fail('SCENE_SPAWN', '当前场景缺少可用的出生点。');
  const valid = Number.isFinite(visual.x) && Number.isFinite(visual.y)
    && !blocked(scene, visual.x, visual.y) && reachable(scene, visual, blocked);
  const normalized = {
    room: visual.room,
    x: valid ? visual.x : scene.spawn[0], y: valid ? visual.y : scene.spawn[1],
    face: FACES.has(visual.face) ? visual.face : 'down',
  };
  return { visual: normalized, repositioned: !valid };
}
function prepare(input, { scenes = SCENES, isBlocked = worldIsBlocked } = {}) {
  const packet = rawPacket(input);
  if (!record(packet) || packet.version !== VISUAL_SAVE_VERSION
    || !record(packet.engine) || !record(packet.visual)) fail('VISUAL_FORMAT', '这不是兼容的二维游戏存档。');
  validateEngineEnvelope(packet.engine, scenes);
  if (packet.visual.room !== packet.engine.state.room) fail('VISUAL_ROOM_MISMATCH', '角色位置与存档房间不一致。');
  const knowledge = normalizeKnowledge(packet.visual.knowledge);
  const position = visualPosition(packet.visual, scenes[packet.visual.room], isBlocked);
  position.visual.knowledge = knowledge;
  // Copy only the supported package fields. Imported objects cannot alias the
  // running state or carry the text entry point's unrelated presentation state.
  let engine;
  try { engine = JSON.parse(JSON.stringify(packet.engine)); }
  catch { fail('ENGINE_FORMAT', '游戏状态无法序列化。'); }
  return { save: { version: VISUAL_SAVE_VERSION, engine, visual: position.visual }, repositioned: position.repositioned };
}

export function makeVisualSave(engineOrSave, visual, options = {}) {
  const engineSave = typeof engineOrSave?.serialize === 'function' ? engineOrSave.serialize() : engineOrSave;
  if (engineSave?.state?.dead === true) return null;
  return prepare({ version: VISUAL_SAVE_VERSION, engine: engineSave, visual }, options).save;
}
export function parseVisualSave(input, options = {}) {
  return prepare(input, options).save;
}
export function exportVisualSave(input, options = {}) {
  return JSON.stringify(parseVisualSave(input, options), null, 2);
}
export async function restoreVisualSave(engine, input, options = {}) {
  const prepared = prepare(input, options);
  if (typeof engine?.deserialize !== 'function') fail('ENGINE_API', '游戏暂时无法恢复存档。');
  // Existing engine preflight validates lazy chapter/timer registration without
  // replacing active progress. deserialize is itself atomic and never onEnters.
  if (typeof engine.validateSave === 'function') await engine.validateSave(prepared.save.engine);
  await engine.deserialize(prepared.save.engine);
  return { ...prepared, visual: { ...prepared.save.visual } };
}

export function createVisualSaveStore({ storage, scenes = SCENES, isBlocked = worldIsBlocked } = {}) {
  const options = { scenes, isBlocked };
  const unavailable = () => new Error('此设备当前无法读写本地存档。');
  function read() {
    try {
      if (typeof storage?.getItem !== 'function') throw unavailable();
      const raw = storage.getItem(VISUAL_SAVE_KEY);
      if (raw === null || raw === undefined) return { ok: true, save: null, empty: true, error: null };
      const prepared = prepare(raw, options);
      return { ok: true, ...prepared, empty: false, error: null };
    } catch (error) { return { ok: false, save: null, empty: false, error }; }
  }
  function write(engineOrSave, visual) {
    try {
      if (typeof storage?.setItem !== 'function') throw unavailable();
      const serialized = typeof engineOrSave?.serialize === 'function' ? engineOrSave.serialize() : engineOrSave;
      const engineSave = serialized?.engine || serialized;
      if (engineSave?.state?.dead === true) return { ok: true, save: null, skipped: true, error: null };
      const prepared = serialized?.engine && visual === undefined
        ? prepare(serialized, options)
        : prepare({ version: VISUAL_SAVE_VERSION, engine: serialized, visual }, options);
      const text = JSON.stringify(prepared.save);
      storage.setItem(VISUAL_SAVE_KEY, text);
      return { ok: true, ...prepared, skipped: false, error: null };
    } catch (error) { return { ok: false, save: null, skipped: false, error }; }
  }
  function clear() {
    try {
      if (typeof storage?.removeItem !== 'function') throw unavailable();
      storage.removeItem(VISUAL_SAVE_KEY);
      return { ok: true, error: null };
    } catch (error) { return { ok: false, error }; }
  }
  function exportSave(input) {
    try {
      if (input === undefined) {
        const current = read();
        if (!current.ok) throw current.error;
        if (!current.save) fail('EMPTY', '目前还没有可导出的存档。');
        input = current.save;
      }
      return { ok: true, text: exportVisualSave(input, options), error: null };
    } catch (error) { return { ok: false, text: null, error }; }
  }
  async function restore(engine, input) {
    try {
      let correctedOnRead = false;
      if (input === undefined) {
        const current = read();
        if (!current.ok) throw current.error;
        if (!current.save) fail('EMPTY', '目前还没有可继续的存档。');
        correctedOnRead = current.repositioned;
        input = current.save;
      }
      const restored = await restoreVisualSave(engine, input, options);
      return { ok: true, ...restored, repositioned: correctedOnRead || restored.repositioned, error: null };
    } catch (error) { return { ok: false, save: null, error }; }
  }
  return { read, write, clear, export: exportSave, parse: input => parseVisualSave(input, options), restore };
}
