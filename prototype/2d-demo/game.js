import { renderStorySprite, drawStoryPortrait, spriteArtStatus } from './story-atlas.js';
import { createPrologueSession } from './engine-adapter.js';
import { getHotspots, getInventoryActions } from './prologue-actions.js';
import { createNarrativeDirector, drawStoryProp, setStorySpriteRenderer } from './narrative.js';
import { isRepeatedItemDescription } from './text-output.js';
import { isBlocked } from './world.js';
import { SCENES, LOGICAL_SIZE, sceneExits } from './scene-manifest.js';
import { DEFAULT_BINDINGS, loadPreferences, savePreferences, keyLabel } from './settings.js';
import { createAudio } from './audio.js';
import { drawScene, drawActor, artStatus } from './art.js';
import { ITEMS } from '../js/data/items.js';

const $ = selector => document.querySelector(selector);
const canvas = $('canvas');
const ctx = canvas.getContext('2d');
setStorySpriteRenderer(renderStorySprite);
const keys = new Set();
const scenes = SCENES;

let engine;
let director = createNarrativeDirector();
let portrait = null;
let exitLock = 0;
let player;
let motion;
let started = false;
let busy = false;
let language = 'cn';
let pages = [];
let pageIndex = 0;
let dialogSource = '';
let dialogActions = [];
let inventoryOpen = false;
let clock = 0;
let paused = false;
let captureBinding = null;
const preferences = loadPreferences();
const sound = createAudio();
sound.configure(preferences.audio);
sound.setPaused(true);
let output = [];
let roomDescription = null;
let roomItemDescriptions = [];
function beginOutput() {
  output = [];
  roomDescription = null;
  roomItemDescriptions = [];
}
const ui = {
  text(text) {
    if (roomDescription === null) roomDescription = text;
    else if (isRepeatedItemDescription(text, roomDescription, roomItemDescriptions)) return;
    output.push(text);
  },
  system: text => output.push(text), inventory: text => output.push(text), userInput() {},
  location() {
    roomDescription = null;
    roomItemDescriptions = engine.state.roomItems().map(id => engine.items[id]?.roomDesc)
      .filter(description => typeof description === 'string' && description.trim());
  },
};

function reset() {
  engine = createPrologueSession({ ui });
  director = createNarrativeDirector();
  portrait = null;
  // New games enter the first room once, matching the current text entry point.
  player = { x: 238, y: 218, face: 'down', walk: 0 };
  motion = { moving: false, blend: 0, action: 'idle', elapsed: 0, duration: 0 };
  closeQuest();
  closeDialog();
  updateLabels();
  $('#objective').textContent = '试着去东边的花径，寻找花丛里的足球。';
  if (started) enterOpening();
  updateHud();
  render();
}

function updateLabels() {
  const room = engine.rooms[engine.state.room];
  $('#room').textContent = room.cn;
  $('#room-en').textContent = room.name;
}

function updateHud() {
  const reading = pages.length > 0;
  const hintOpen = !$('#quest').hidden;
  $('.game-shell').classList.toggle('is-reading', reading);
  $('.game-shell').classList.toggle('is-title', !started);
  $('.game-shell').classList.toggle('is-paused', paused);
  $('#menu-bag').disabled = !started || busy;
  $('#menu-help').disabled = !started || busy;
  const near = started && !reading && !hintOpen && !paused && !director.getState().busy ? nearby() : null;
  $('#touch-interact').textContent = reading ? '继续' : director.getState().busy ? '跳过' : '互动';
  $('#skip-event').hidden = !director.getState().busy || paused;
  $('#hint').textContent = near ? `${keyLabel(preferences.bindings.interact)} / ↵ · ${near.label}` : '';
}

function paginate(text) {
  const blocks = String(text).split(/\n+/).filter(Boolean).filter(block => language === 'both'
    || (language === 'cn' ? /[\u3400-\u9fff]/.test(block) : !/[\u3400-\u9fff]/.test(block)));
  const result = [];
  for (const block of blocks) {
    let rest = block;
    const max = language === 'cn' ? 105 : 270;
    while (rest.length > max) {
      let cut = rest.lastIndexOf(language === 'cn' ? '。' : ' ', max);
      cut = cut < max / 3 ? max : cut + 1;
      result.push(rest.slice(0, cut));
      rest = rest.slice(cut).trim();
    }
    if (rest) result.push(rest);
  }
  return result.length ? result : ['（此条信息没有所选语言的文本。）'];
}

function stopMovement() {
  keys.clear();
  motion.moving = false;
}

function show(text, actions = []) {
  closeQuest();
  dialogSource = text;
  dialogActions = actions;
  pages = paginate(text);
  pageIndex = 0;
  inventoryOpen = false;
  stopMovement();
  paintDialog();
  canvas.focus({ preventScroll: true });
}

function paintDialog() {
  $('#dialogue').hidden = false;
  $('#speaker').textContent = engine.rooms[engine.state.room].cn;
  $('#page').textContent = `${pageIndex + 1} / ${pages.length}`;
  $('#text').textContent = pages[pageIndex];
  $('#choices').replaceChildren();
  const last = pageIndex === pages.length - 1;
  if (last) for (const action of dialogActions) {
    const button = document.createElement('button');
    button.textContent = action.label;
    button.onclick = action.run;
    $('#choices').append(button);
  }
  $('#next').textContent = last ? '收起 ↵' : '继续 ↵';
  updateHud();
}

function closeDialog() {
  $('#dialogue').hidden = true;
  pages = [];
  dialogActions = [];
  inventoryOpen = false;
  portrait = null;
  stopMovement();
  canvas.focus({ preventScroll: true });
  updateHud();
}

function closeQuest() {
  $('#quest').hidden = true;
}

function toggleQuest() {
  if (!started || busy || paused) return;
  if (!$('#quest').hidden) closeQuest();
  else {
    closeDialog();
    $('#quest').hidden = false;
  }
  stopMovement();
  updateHud();
  canvas.focus({ preventScroll: true });
}

function back() {
  closeQuest();
  closeDialog();
}

function next() {
  if (!pages.length) return;
  if (inventoryOpen) { closeDialog(); return; }
  if (director.getState().busy) director.skip();
  if (pageIndex < pages.length - 1) { pageIndex++; paintDialog(); }
  else closeDialog();
}

function animateAction(action) {
  motion.action = action;
  motion.elapsed = 0;
  motion.duration = action === 'pickup' ? 0.68 : 0.45;
  stopMovement();
}

function faceObject(object) {
  const dx = object.x - player.x;
  const dy = object.y - player.y;
  if (Math.hypot(dx, dy) > 1) player.face = Math.abs(dx) > Math.abs(dy)
    ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
}

function gameSnapshot() {
  return { ...engine.state.serialize(), visual: { room: engine.state.room, player: { ...player }, hotspots: objects() } };
}
async function command(input, actions = []) {
  if (busy || paused) return;
  busy = true;
  const before = gameSnapshot();
  beginOutput();
  updateHud();
  try {
    await engine.processInput(input);
    if (before.room !== engine.state.room) {
      const scene = scenes[engine.state.room];
      if (scene) [player.x, player.y] = scene.spawn;
      stopMovement(); motion.blend = 0; player.walk = 0; exitLock = 0.5;
    }
    const after = gameSnapshot();
    director.onCommand(before, after, input);
    updateLabels();
    if (output.length) show(output.join('\n\n'), actions);
    if (engine.state.chapter !== 'prologue') $('#objective').textContent = '序章已完成。你已经穿过白门，抵达新的世界。';
  } finally {
    busy = false;
    updateHud();
    render();
  }
}

function describe() {
  if (!started || busy || paused) return;
  beginOutput();
  engine.describeRoom();
  show(output.join('\n\n'));
}

function enterOpening() {
  beginOutput();
  engine.moveTo(engine.state.room);
  show(output.join('\n\n'));
}

function objects() { return getHotspots(engine.state); }
function exits() { return sceneExits(engine.state.room, engine.state, engine.rooms); }

function nearby() {
  return objects().map(object => ({ ...object, d: Math.hypot(player.x - object.x, player.y - object.y) }))
    .filter(object => object.d < object.radius).sort((a, b) => a.d - b.d)[0];
}

function actionMenu(label, actions, portraitId = null) {
  closeQuest();
  portrait = portraitId;
  dialogActions = actions.map(action => ({ label: action.label, run: () => {
    if (/^(take|get|pick)/.test(action.command)) animateAction('pickup');
    else animateAction('inspect');
    command(action.command);
  } }));
  pages = ['选择操作。']; pageIndex = 0; inventoryOpen = false;
  stopMovement(); paintDialog(); $('#speaker').textContent = label;
  canvas.focus({ preventScroll: true });
}
function interact() {
  if (!started || busy || paused) return;
  if (pages.length) { next(); return; }
  if (director.getState().busy) { director.skip(); return; }
  if (!$('#quest').hidden) { back(); return; }
  const object = nearby();
  if (!object) { describe(); return; }
  faceObject(object);
  actionMenu(object.label, object.actions, object.kind === 'woman' ? (engine.state.room === 'broad_walk' ? 'bird_woman' : 'umbrella_woman') : null);
}

function inventory() {
  if (!started || busy || paused) return;
  if (inventoryOpen) { closeDialog(); return; }
  closeQuest();
  stopMovement();
  inventoryOpen = true;
  pages = ['背包'];
  pageIndex = 0;
  dialogActions = [];
  $('#dialogue').hidden = false;
  $('#speaker').textContent = '随身物品';
  $('#page').textContent = '';
  $('#text').textContent = '选择物品查看。';
  $('#choices').replaceChildren();
  for (const { id } of engine.state.inventoryList()) {
    const button = document.createElement('button');
    button.textContent = ITEMS[id].cn;
    button.onclick = () => actionMenu(ITEMS[id].cn, getInventoryActions(id, engine.state));
    $('#choices').append(button);
  }
  $('#next').textContent = '收起 ↵';
  updateHud();
  canvas.focus({ preventScroll: true });
}

function obstacles() { return scenes[engine.state.room].obstacles; }

function solid(x, y) { return isBlocked(scenes[engine.state.room], x, y); }

async function transition(exit) {
  if (busy) return;
  const target = exit.target;
  if (!scenes[target]) return;
  await command(exit.dir);
  if (engine.state.room === target) {
    [player.x, player.y] = exit.spawn;
    stopMovement();
    motion.blend = 0;
    motion.action = 'idle';
    player.walk = 0;
  }
  render();
}

function update(dt) {
  if (paused) return;
  clock += dt;
  director.update(dt);
  exitLock = Math.max(0, exitLock - dt);
  motion.elapsed += dt;
  if (motion.action !== 'idle' && motion.elapsed >= motion.duration) motion.action = 'idle';
  const canWalk = started && !pages.length && !busy && !paused && !engine.state.dead && !director.getState().busy && !engine.state.hasFlag('in_pram') && $('#quest').hidden;
  const dx = canWalk ? Number(keys.has('ArrowRight') || keys.has(preferences.bindings.right)) - Number(keys.has('ArrowLeft') || keys.has(preferences.bindings.left)) : 0;
  const dy = canWalk ? Number(keys.has('ArrowDown') || keys.has(preferences.bindings.down)) - Number(keys.has('ArrowUp') || keys.has(preferences.bindings.up)) : 0;
  const oldX = player.x, oldY = player.y;
  if (dx || dy) {
    player.face = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
    const step = 92 * dt / Math.hypot(dx, dy);
    if (!solid(player.x + dx * step, player.y)) player.x += dx * step;
    if (!solid(player.x, player.y + dy * step)) player.y += dy * step;
  }
  const distance = Math.hypot(player.x - oldX, player.y - oldY);
  motion.moving = distance > 0.001;
  motion.blend += (Number(motion.moving) - motion.blend) * (1 - Math.exp(-dt * 20));
  if (motion.blend < 0.001) motion.blend = 0;
  if (motion.moving) {
    player.walk = (player.walk + distance / 46 * Math.PI * 2) % (Math.PI * 2);
    motion.action = 'idle';
    for (const exit of exits()) {
      if (!exitLock && Math.hypot(player.x - exit.x, player.y - exit.y) < exit.radius) { transition(exit); break; }
    }
  }
  updateHud();
}

function animationState() {
  return {
    moving: motion.moving, blend: motion.blend, time: preferences.video.effects ? clock : 0,
    action: motion.action !== 'idle' ? motion.action : motion.moving ? 'walk' : 'idle',
    actionProgress: motion.duration ? Math.min(1, motion.elapsed / motion.duration) : 0,
  };
}

function render() {
  const scale = preferences.video.resolution;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  const story = director.getState();
  const renderRoom = story.sceneRoom && scenes[story.sceneRoom] ? story.sceneRoom : engine.state.room;
  drawScene(ctx, renderRoom, clock, preferences.video.effects);
  const actors = objects().filter(object => !(story.hiddenKinds || []).includes(object.kind)).map(object => ({ y: object.y, draw: () => drawStoryProp(ctx, object, engine.state, preferences.video.effects ? clock : 0) }));
  if (!story.hidePlayer) actors.push({ y: player.y, draw: () => drawActor(ctx, player.x, player.y, '#bca071', player.face, player.walk, false, animationState()) });
  actors.sort((a, b) => a.y - b.y).forEach(actor => actor.draw());
  director.draw(ctx, renderRoom, engine.state, clock);
  if (portrait && pages.length) drawStoryPortrait(ctx, portrait, 25, 45, 85, 95);
  for (const exit of exits()) {
    const x = Math.max(52, Math.min(416, exit.x));
    const y = ['ne','nw'].includes(exit.dir) ? 49 : exit.dir === 'n' ? 27 : exit.dir === 's' ? 268 : exit.y - 10;
    const label = (exit.dir === 'n' ? '↑ ' : exit.dir === 'w' ? '← ' : '') + exit.label
      + (exit.dir === 'e' ? ' →' : exit.dir === 's' ? ' ↓' : '');
    ctx.font = '8px serif';
    ctx.textAlign = 'center';
    const width = ctx.measureText(label).width + 14;
    ctx.fillStyle = '#19251ed6';
    ctx.fillRect(x - width / 2, y - 9, width, 14);
    ctx.strokeStyle = '#cfb48177';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(x - width / 2, y - 9, width, 14);
    ctx.fillStyle = '#efe0b8';
    ctx.fillText(label, x, y);
  }
  const near = nearby();
  if (near && started && !pages.length && !paused && !story.busy && $('#quest').hidden) {
    ctx.fillStyle = '#ffdfa1'; ctx.font = '11px serif'; ctx.textAlign = 'center';
    ctx.shadowColor = '#f3c673'; ctx.shadowBlur = 5;
    ctx.fillText('◇', near.x, near.y - 38 + Math.sin(clock * 4) * 1.2);
    ctx.shadowBlur = 0;
  }
}

function start() {
  if (started) return;
  started = true;
  sound.setPaused(false);
  sound.unlock().catch(() => {});
  $('#overlay').hidden = true;
  enterOpening();
  updateHud();
  render();
}

function fullscreen() {
  const request = document.fullscreenElement ? document.exitFullscreen() : $('main').requestFullscreen?.();
  request?.catch(() => { $('#fullscreen').textContent = '当前窗口不支持全屏'; });
}

const bindingNames = { up: '向上行走', down: '向下行走', left: '向左行走', right: '向右行走', interact: '互动 / 继续', inventory: '背包', look: '环顾四周', hint: '探索提示', fullscreen: '切换全屏' };
function paintBindings() {
  $('#binding-list').replaceChildren();
  for (const [action, label] of Object.entries(bindingNames)) {
    const row = document.createElement('div');
    row.className = 'binding-row';
    const name = document.createElement('span');
    name.textContent = label;
    const button = document.createElement('button');
    button.dataset.binding = action;
    button.textContent = captureBinding === action ? '按下新键…' : keyLabel(preferences.bindings[action]);
    button.setAttribute('aria-label', `修改${label}按键`);
    button.classList.toggle('is-capturing', captureBinding === action);
    button.onclick = () => {
      captureBinding = action;
      $('#binding-message').textContent = `正在设置「${label}」：按一个字母或数字，Esc 取消。`;
      paintBindings();
      $(`[data-binding="${action}"]`).focus();
    };
    row.append(name, button);
    $('#binding-list').append(row);
  }
  $('.keys').textContent = `方向键 / ${['up', 'left', 'down', 'right'].map(key => keyLabel(preferences.bindings[key])).join('')} 行走 · ${keyLabel(preferences.bindings.interact)} / 回车 互动 · Esc 暂停与设置`;
}

function selectTab(tab) {
  sound.playUi('click');
  captureBinding = null;
  for (const button of document.querySelectorAll('[data-tab]')) {
    const selected = button.dataset.tab === tab;
    button.setAttribute('aria-selected', String(selected));
    button.tabIndex = selected ? 0 : -1;
    $(`#settings-${button.dataset.tab}`).hidden = !selected;
  }
  paintBindings();
}

function setPaused(value) {
  if (paused === value) return;
  paused = value;
  captureBinding = null;
  stopMovement();
  motion.blend = 0;
  $('#pause-menu').hidden = !paused;
  $('.stage').inert = paused;
  $('header').inert = paused;
  sound.setPaused(paused || !started);
  updateHud();
  if (paused) {
    selectTab('controls');
    $('#binding-message').textContent = 'Esc 取消改键或关闭菜单。';
    $('#resume').focus();
  } else canvas.focus({ preventScroll: true });
}

function storeSettings() { savePreferences(preferences); }
function applyVideo() {
  canvas.width = LOGICAL_SIZE.width * preferences.video.resolution;
  canvas.height = LOGICAL_SIZE.height * preferences.video.resolution;
  canvas.style.filter = `brightness(${preferences.video.brightness}%)`;
  $('#resolution').value = String(preferences.video.resolution);
  $('#brightness').value = preferences.video.brightness;
  $('#brightness-value').textContent = `${preferences.video.brightness}%`;
  $('#effects').checked = preferences.video.effects;
  render();
}
function applyAudio() {
  sound.configure(preferences.audio);
  $('#audio-enabled').checked = preferences.audio.enabled;
  for (const [id, key] of [['master', 'master'], ['ambience', 'ambience'], ['interface-volume', 'interfaceVolume']]) {
    $(`#${id}`).value = preferences.audio[key];
    $(`#${id}-value`).textContent = `${preferences.audio[key]}%`;
    $(`#${id}`).disabled = !preferences.audio.enabled;
  }
  $('#test-sound').disabled = !preferences.audio.enabled;
  $('#audio-status').textContent = sound.getState().supported === false ? '当前浏览器不支持声音播放。' : preferences.audio.enabled ? '继续探索后可听到轻柔的环境风声。' : '声音已关闭。启用后可调节音量。';
}

function actionKey(key) {
  const bindings = preferences.bindings;
  if ([bindings.interact, 'Enter', ' '].includes(key)) interact();
  else if (key === bindings.inventory) inventory();
  else if (key === bindings.look) describe();
  else if (key === bindings.hint) toggleQuest();
  else if (key === bindings.fullscreen) fullscreen();
}

const normalKey = key => key.length === 1 ? key.toLowerCase() : key;
window.addEventListener('keydown', event => {
  const key = normalKey(event.key);
  if (paused && captureBinding) {
    event.preventDefault();
    if (key === 'Escape') { captureBinding = null; paintBindings(); $('#binding-message').textContent = '已取消改键。'; return; }
    if (!/^[a-z0-9]$/.test(key)) { $('#binding-message').textContent = '请选择字母或数字；方向键、回车和 Esc 为固定按键。'; return; }
    const conflict = Object.entries(preferences.bindings).find(([action, value]) => value === key && action !== captureBinding);
    if (conflict) { $('#binding-message').textContent = `${keyLabel(key)} 已用于「${bindingNames[conflict[0]]}」，请选择其他按键。`; return; }
    preferences.bindings[captureBinding] = key;
    captureBinding = null;
    storeSettings(); paintBindings();
    $('#binding-message').textContent = '新键位已保存。';
    return;
  }
  if (key === 'Escape') {
    event.preventDefault();
    if (!event.repeat) setPaused(!paused);
    return;
  }
  if (paused) {
    if (key === 'Tab') {
      const focusable = [...$('#pause-menu').querySelectorAll('button:not(:disabled),input:not(:disabled),select')].filter(element => element.getClientRects().length);
      const first = focusable[0], last = focusable.at(-1);
      if (event.shiftKey && (document.activeElement === first || !$('#pause-menu').contains(document.activeElement))) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
    return;
  }
  if (event.target.closest('button') && ['Enter', ' '].includes(key)) return;
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(key)) event.preventDefault();
  if (!event.repeat) actionKey(key);
  keys.add(key);
});
window.addEventListener('keyup', event => keys.delete(normalKey(event.key)));
window.addEventListener('blur', stopMovement);
$('#start').onclick = start;
$('#next').onclick = next;
$('#restart').onclick = reset;
$('#close-quest').onclick = () => { closeQuest(); updateHud(); canvas.focus({ preventScroll: true }); };
$('#touch-interact').onclick = interact;
$('#skip-event').onclick = () => { director.skip(); updateHud(); render(); };
$('#pause-open').onclick = () => setPaused(true);
$('#resume').onclick = () => setPaused(false);
$('#fullscreen').onclick = fullscreen;
$('#menu-bag').onclick = () => { setPaused(false); inventory(); };
$('#menu-help').onclick = () => { setPaused(false); toggleQuest(); };
$('#reset-bindings').onclick = () => { preferences.bindings = { ...DEFAULT_BINDINGS }; captureBinding = null; storeSettings(); paintBindings(); $('#binding-message').textContent = '已恢复默认键位。'; };
for (const button of document.querySelectorAll('[data-tab]')) {
  button.onclick = () => selectTab(button.dataset.tab);
  button.onkeydown = event => {
    if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    const tabs = [...document.querySelectorAll('[data-tab]')];
    const index = (tabs.indexOf(button) + (event.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length;
    selectTab(tabs[index].dataset.tab); tabs[index].focus();
  };
}
$('#resolution').onchange = event => { preferences.video.resolution = Number(event.target.value); storeSettings(); applyVideo(); };
$('#brightness').oninput = event => { preferences.video.brightness = Number(event.target.value); storeSettings(); applyVideo(); };
$('#effects').onchange = event => { preferences.video.effects = event.target.checked; storeSettings(); applyVideo(); };
$('#audio-enabled').onchange = async event => {
  preferences.audio.enabled = event.target.checked; storeSettings(); applyAudio();
  if (preferences.audio.enabled) { await sound.unlock(); sound.playUi(); applyAudio(); }
};
for (const [id, key] of [['master', 'master'], ['ambience', 'ambience'], ['interface-volume', 'interfaceVolume']]) {
  $(`#${id}`).oninput = event => { preferences.audio[key] = Number(event.target.value); storeSettings(); applyAudio(); };
}
$('#test-sound').onclick = async () => { await sound.unlock(); sound.playUi(); };
document.addEventListener('pointerdown', () => { if (preferences.audio.enabled) sound.unlock().catch(() => {}); }, { passive: true });
document.addEventListener('fullscreenchange', () => { $('#fullscreen').textContent = document.fullscreenElement ? '退出全屏' : '进入全屏'; });
$('#language').onclick = () => {
  language = language === 'cn' ? 'en' : language === 'en' ? 'both' : 'cn';
  $('#language').textContent = { cn: '中文', en: '英文', both: '双语' }[language];
  if (pages.length && !inventoryOpen) show(dialogSource, dialogActions);
};
for (const button of document.querySelectorAll('[data-key]')) {
  button.onpointerdown = event => {
    event.preventDefault(); button.setPointerCapture(event.pointerId); keys.add(button.dataset.key);
  };
  button.onpointerup = button.onpointercancel = button.onlostpointercapture = () => keys.delete(button.dataset.key);
}

window.render_game_to_text = () => JSON.stringify({
  art: artStatus(), sprites: spriteArtStatus(), mode: paused ? 'paused' : !started ? 'title' : pages.length ? 'dialogue' : !$('#quest').hidden ? 'hint' : 'exploring',
  coordinateSystem: 'origin top-left; x right, y down; 480x288', room: engine.state.room,
  player: { x: Math.round(player.x), y: Math.round(player.y), facing: player.face, phase: player.walk, animation: animationState() },
  objects: objects(), obstacles: obstacles(), exits: exits(), narrative: director.getState(), nearby: nearby()?.label,
  flags: [...engine.state.flags], turns: engine.state.turns, chapter: engine.state.chapter,
  inventory: engine.state.inventoryList().map(item => item.id), score: engine.state.score,
  controls: { ...preferences.bindings, pause: 'Escape' },
  settings: { video: { ...preferences.video }, audio: sound.getState(), captureBinding },
  hint: !$('#quest').hidden ? $('#objective').textContent : null,
  dialogue: pages.length ? { text: $('#text').textContent, page: pageIndex + 1, total: pages.length, actions: dialogActions.map(action => action.label) } : null,
});
window.advanceTime = ms => {
  const count = Math.max(1, Math.ceil(ms / (1000 / 60)));
  for (let step = 0; step < count; step++) update(ms / count / 1000);
  render();
};
let previous = performance.now();
function frame(now) {
  update(Math.min((now - previous) / 1000, 0.04)); previous = now; render(); requestAnimationFrame(frame);
}
reset();
paintBindings();
applyVideo();
applyAudio();
requestAnimationFrame(frame);
