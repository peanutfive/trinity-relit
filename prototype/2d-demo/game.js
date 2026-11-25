import { createCryptInspection, tombArtView } from './cemetery-inspection.js';
import { drawCemeteryTomb, renderCemeteryItem, cemeteryShroudAtlas } from './cemetery-art.js';
import { drawSwimmer, drawBottomVisibility, drawRanchProp, warmWindmillArt, drawClosetThreshold, drawClosetLight } from './ranch-art.js';
import { closetView } from './ranch-closet-story.js';
import { positionWaterTarget, ranchDoorOpen, ranchDoors } from './ranch-actions.js';
import { rememberIndoorDrops } from './ranch-floor-items.js';
import { restoreKitchenState, restoreWindmillState, reservoirBottomLit, reservoirLanternLit } from './ranch-story.js';
import {keyboardInteraction,chapterObjective} from './interaction-context.js';
import {createNavigationSceneCache} from './navigation-scene.js';
import {renderCompletionSprite,completionArtStatus,completionBoyMotion} from './wabe-completion-art.js';
import {renderPacificSprite,pacificArtStatus,pacificControlState} from './pacific-art.js';
import {animateBookmark,resetBookmarkMotion,renderIsletSprite,renderFerryAboard,isletArtStatus} from './islet-art.js';
import {ferryView} from './ferry-state.js';
import {isletDoorView,vertexShadowView} from './islet-shadow.js';
import {shackDoorOpen} from './shack-story.js';
import {rememberDesertBookDrop,rememberBookmarkDrop} from './shack-route-actions.js';
import {shackRouteCharacterScale} from './shack-route-layout.js';
import {renderTundraSprite,tundraArtStatus} from './tundra-art.js';
import {renderArborOrbitSprite,renderOrbitPlayer,arborOrbitArtStatus} from './arbor-orbit-art.js';
import {filterVisualPresence} from './visual-text-policy.js';
import {renderNotice,noticeArtStatus} from './notice-art.js';
import { nearbyTarget, pointerTarget, withinReach } from './interaction-targets.js';
import { createChapterMapView } from './chapter-map.js';
import { renderStorySprite, drawStoryPortrait, spriteArtStatus } from './story-atlas.js';
import { animateVertexMount, renderWabeSprite, resetWabeArt, wabeArtStatus } from './wabe-art.js';
import { heroArtStatus } from './character.js';
import {prologueClock} from '../js/prologue-time.js';
import {renderJapanSprite,japanArtStatus} from './japan-art.js';
import {renderUndergroundSprite,drawUndergroundAtmosphere,undergroundArtStatus} from './underground-art.js';
import {renderCliffSprite,cliffArtStatus} from './cliff-art.js';
import { createPrologueSession } from './engine-adapter.js';
import { GameState } from '../js/engine.js';
import { getHotspots } from './interaction-catalog.js';
import { createDiscovery, PAPER_CRAFT_ID } from './discovery.js';
import { resolveInteraction, resolveHeldSelf } from './interaction-intent.js';
import { roomArrival } from './arrivals.js';
import { createVisualSaveStore, VISUAL_SAVE_VERSION } from './save.js';
import { createNarrativeDirector, drawStoryProp, setStorySpriteRenderer } from './narrative.js';
import { isRepeatedItemDescription } from './text-output.js';
import { isBlocked, findPath, nearestWalkable, approachingExit, leavingBoundaryExit, nearestExitPoint, exitDistance, pointInPolygon } from './world.js';
import { SCENES, LOGICAL_SIZE, sceneExits, sceneBoundaries } from './scene-manifest.js';
import { DEFAULT_BINDINGS, loadPreferences, savePreferences, keyLabel } from './settings.js';
import { createAudio } from './audio.js';
import { drawScene, drawActor, drawOcclusion, artStatus, ensureSceneArt, requestedSceneArt, currentPlate } from './art.js';
import { ITEMS } from './exploration-items.js';

const $ = selector => document.querySelector(selector);
const canvas = $('canvas');
const ctx = canvas.getContext('2d');
// Art-route review removes both painted labels and their pointer targets, so
// walkthroughs must follow the scene itself. This never changes game rules.
const reviewRoutes = new URLSearchParams(location.search).get('reviewRoutes') === '1';
setStorySpriteRenderer((ctx,object,state,time)=>{
  if(object.kind==='cemetery_tomb'){drawCemeteryTomb(ctx,tombArtView(state));return true;}
  if(renderCemeteryItem(ctx,object))return true;
  return drawRanchProp(ctx,object)||renderIsletSprite(ctx,object,state,time)||renderTundraSprite(ctx,object,state,time)||renderPacificSprite(ctx,object,state,time)||renderCompletionSprite(ctx,object,state,time)||renderArborOrbitSprite(ctx,object,state,time)||renderUndergroundSprite(ctx,object,state,time)||renderCliffSprite(ctx,object,state,time)||renderJapanSprite(ctx,object,state,time)||renderNotice(ctx,object)||renderWabeSprite(ctx,object,state,clock)||renderStorySprite(ctx,object,state,time);
});
const cryptInspection = createCryptInspection($('#crypt-inspection'), input => {
  if (!busy && !paused && !pages.length) command(input);
}, leaveCrypt);
function leaveCrypt() {
  cryptInspection.hide();
  closeDialog();
  render();
}
const keys = new Set();
const chapterMap = createChapterMapView({host:$('.stage'),onClose:()=>{stopMovement();sound.setPaused(paused);canvas.focus({preventScroll:true});}});
const scenes = SCENES;
const cachedNavigationScene=createNavigationSceneCache();
let browserStorage;
try { browserStorage = window.localStorage; } catch { browserStorage = null; }
const saveStore = createVisualSaveStore({ storage: browserStorage, scenes, prepareRoom: ensureSceneArt });
let ferryDeparture = null;

let engine;
let director = createNarrativeDirector();
let portrait = null;
let exitLock = 0;
let player;
let motion;
let started = false;
let discovery = createDiscovery();
let observedObjects = new Set();
let heldItem = null;
let boatSelection = 'oarsman';
let focusedItem = null;
let walkPath = [];
let walkTarget = null;
let walkExit = null;
let previousScene = null;
let lastArrival = null;
let busy = false;
let applyingCommand = false;
let lastCommand = null;
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
let climbArrivalText = null;
let roomDescription = null;
let roomItemDescriptions = [];
let roomDescriptionPending=false,removedPresence=[];
const displayedDescriptions = new Set();
let showInspectionDetails = false;
function beginOutput(inspecting = false) {
  output = [];
  displayedDescriptions.clear();
  showInspectionDetails = inspecting;
  roomDescription = null;
  roomItemDescriptions = [];roomDescriptionPending=false;removedPresence=[];
}
const ui = {
  text(text) {
    const isRoom=roomDescriptionPending;roomDescriptionPending=false;
    const itemAnnotation=roomItemDescriptions.some(description=>String(description).trim()===String(text).trim());
    text = discovery.filterOutput(text, engine?.state || {});
    if(isRoom)roomDescription=text;
    else if(isRepeatedItemDescription(text, roomDescription, roomItemDescriptions))return;
    const source = isRoom ? 'room' : itemAnnotation ? 'item-annotation' : 'event';
    if(itemAnnotation && engine.state.room==='underwater' && !reservoirBottomLit(engine.state))return;
    if (source !== 'event') {
      // A conditional exit may describe its destination both while activating
      // the new chapter and again when the enclosing movement command finishes.
      const entry = JSON.stringify([engine.state.room, source, text]);
      if (displayedDescriptions.has(entry)) return;
      displayedDescriptions.add(entry);
    }
    const adapted=filterVisualPresence(text,{room:engine?.state.room,objects:engine?getHotspots(engine.state):[],lanternLit:engine?.state.room==='underwater'&&reservoirLanternLit(engine.state),source:showInspectionDetails?'event':source});
    removedPresence.push(...adapted.removed);text=adapted.text;
    if (!String(text).trim()) return;
    output.push(text);
  },
  system: text => output.push(text), inventory: text => output.push(text), userInput() {},
  location() {
    roomDescriptionPending=true;
    roomDescription = null;
    roomItemDescriptions = engine.state.roomItems().map(id => engine.items[id]?.roomDesc)
      .filter(description => typeof description === 'string' && description.trim());
  },
};

function reset() {
  if (busy) return;
  engine = createPrologueSession({ ui });
  director = createNarrativeDirector();
  resetWabeArt();
  resetBookmarkMotion();
  cryptInspection.hide();
  discovery = createDiscovery(); observedObjects = new Set(); heldItem = null;
  previousScene = null;
  ferryDeparture = null;
  climbArrivalText = null;
  lastArrival = null;
  portrait = null;
  // New games enter the first room once, matching the current text entry point.
  player = { x: 238, y: 218, face: 'down', walk: 0 };
  motion = { moving: false, blend: 0, action: 'idle', elapsed: 0, duration: 0 };
  closeQuest();
  closeDialog();
  updateLabels();
  $('#objective').textContent = '沿着小径走走。观察周围，再试试手中物品能做什么。';
  if (started) enterOpening();
  updateHud();
  paintSaveState();
  render();
}

function updateLabels(roomId=engine.state.room) {
  const room = engine.rooms[roomId];
  const labelState=previousScene?.room===roomId && engine.state.room!==roomId ? previousScene : engine.state;
  const aboard=roomId==='the_river' && ferryView(labelState).onboard;
  const name = aboard ? '河流 · 平底船上' : scenes[roomId]?.mapLabel || room.cn;
  const english = aboard ? 'The River, in the dory' : room.name;
  if ($('#room').textContent !== name) $('#room').textContent = name;
  if($('#room-en').textContent!==english)$('#room-en').textContent = english;
  const compass=$('.compass'),southView=Boolean(scenes[roomId]?.northAtBottom);
  if(compass.classList.contains('south-view')!==southView){
    compass.classList.toggle('south-view',southView);
    compass.setAttribute('aria-label',southView?'北在下方':'北在上方');
    compass.querySelector('text').setAttribute('y',southView?'46':'9');
  }
}

function updateHud() {
  if (applyingCommand) return;
  const reading = pages.length > 0;
  const hintOpen = !$('#quest').hidden;
  $('.game-shell').classList.toggle('is-reading', reading);
  $('.game-shell').classList.toggle('is-title', !started);
  $('.game-shell').classList.toggle('is-paused', paused);
  $('#menu-bag').disabled = !started || busy;
  $('#menu-help').disabled = !started || busy;
  $('#menu-map').disabled = !started || busy;
  $('#return-to-ferry-shore').hidden = !(started && ferryDeparture && engine.state.room==='islet'
    && observedObjects.has('islet:gate') && !isletDoorView(engine.state).open);
  $('#replay-umbrella').hidden = !started || engine.state.room!=='lancaster_gate'||!engine.state.hasFlag('umbrella_woman_done');
  const near = started && !cryptInspection.open && !reading && !hintOpen && !paused && !director.getState().busy ? nearby() : null;
  $('#skip-event').hidden = !director.getState().busy || paused;
  const decision=started&&!reading&&!hintOpen&&!paused&&!director.getState().busy?keyboardInteraction(engine.state,near,{heldItem,observed:observedObjects}):null;
  const darkTouch=decision?.command==='u' && engine.state.room==='underwater'
    && navigator.maxTouchPoints>0 && !reservoirBottomLit(engine.state);
  $('#surface-water').hidden=!darkTouch;
  const control=near?.actorRelative && matchMedia('(pointer: coarse)').matches ? '轻触人物' : keyLabel(preferences.bindings.interact);
  $('#hint').textContent=decision&&!darkTouch?`${control} · ${decision.hint}`:'';
  $('#hand-kit').hidden = !heldItem || !started || paused || reading || cryptInspection.open;
  $('#held-item').textContent = heldItem ? '手中 · ' + ITEMS[heldItem].cn : '';
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
  walkPath = []; walkTarget = null; walkExit = null;
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
  $('#next').textContent = `${last?'收起':'继续'} ${keyLabel(preferences.bindings.interact)}`;
  updateHud();
}

function closeDialog() {
  focusedItem = null;
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
  const [x,y]=object.sideApproaches ? object.drawAt : [object.x,object.y];
  const dx = x - player.x;
  const dy = y - player.y;
  if (Math.hypot(dx, dy) > 1) player.face = Math.abs(dx) > Math.abs(dy)
    ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
}

function gameSnapshot() {
  return { ...engine.state.serialize(), visual: { room: engine.state.room, player: { ...player }, hotspots: objects(), paperIdentified:discovery.snapshot().identified.includes(PAPER_CRAFT_ID) } };
}
function visualSavePosition() {
  return {room:engine.state.room,x:player.x,y:player.y,face:player.face,
    knowledge:{observed:[...observedObjects],paper:discovery.snapshot()}};
}
async function command(input, actions = [], observedId = null) {
  if (busy || paused) return;
  lastCommand=input;
  busy = true;
  const before = gameSnapshot();
  const boarding = before.room==='the_river' && !ferryView(before).onboard
    && (input==='enter dory' || input==='in');
  const departure = boarding
    ? {version:VISUAL_SAVE_VERSION,engine:engine.serialize(),visual:visualSavePosition()} : null;
  const timerCallback = engine.state.timer?.perTurn;
  beginOutput(engine.state.chapter === 'islet' && input === 'look' && Boolean(observedId));
  updateHud();
  try {
    // A command can move the engine before the current animation frame ends.
    applyingCommand = true;
    await engine.processInput(input);
    const destination = engine.state;
    const moved = before.room !== destination.room;
    if(destination.room==='the_river' && ferryView(destination).onboard && !ferryView(before).onboard) {
      if (departure) ferryDeparture = departure;
      boatSelection='oarsman';
      stopMovement();
    }
    if(!moved && destination.chapter==='ranch')rememberIndoorDrops(before,destination,navigationScene());
    if(!moved && destination.chapter==='desert')rememberDesertBookDrop(before,destination,navigationScene());
    if(!moved && before.itemLoc.slip!==destination.itemAt('slip') && destination.inRoom('slip'))
      rememberBookmarkDrop(before,destination,navigationScene());
    if (moved) {
      cryptInspection.hide();
      // Keep the source room and live timer available while its destination loads.
      const source = GameState.deserialize(before);
      if (source.timer) source.timer.perTurn = timerCallback;
      engine.state = source;
      applyingCommand = false;
      await ensureSceneArt(destination.room,destination);
      engine.state = destination;
      previousScene = before;
    }
    if (!['sand_bar','islet'].includes(destination.room) && !ferryView(destination).onboard) ferryDeparture=null;
    if(['inventory','pocket','worn'].includes(before.itemLoc.lemming)&&engine.state.inRoom('lemming'))observedObjects.add('tundra:item:lemming');
    const revelation=discovery.inspect(engine.state,{command:input,success:!engine.state.dead});
    if(revelation.text)output.push(revelation.text);
    if(observedId&&!engine.state.dead)observedObjects.add(observedId);
    if(heldItem&&!engine.state.has(heldItem))heldItem=null;
    if (moved) {
      const scene = scenes[engine.state.room];
      if (scene) [player.x, player.y] = scene.spawn;
      const arrivalDirection=before.chapter==='japan'&&engine.state.room==='moor'?'out':input;
      lastArrival=roomArrival(navigationScene(),{fromRoom:before.room,direction:arrivalDirection,exits:exits()});
      const crossedDoor=ranchDoors(scene).find(door=>door.dir && door.dir===lastArrival?.entrance);
      if(crossedDoor && lastArrival.matched)engine.state.setFlag(crossedDoor.flag+'_crossed');
      if(lastArrival){player.x=lastArrival.x;player.y=lastArrival.y;player.face=lastArrival.face;}
      if (['reservoir','underwater'].includes(before.room) && ['reservoir','underwater'].includes(destination.room)) {
        const {x,y,face}=before.visual.player;
        const inside=solid(x,y)?nearestWalkable(navigationScene(),{x,y}):{x,y};
        if(inside){
          lastArrival={...inside,face,fromRoom:before.room};
          player.x=inside.x;player.y=inside.y;player.face=face;
        }
      }
      stopMovement(); motion.blend = 0; player.walk = 0; exitLock = 0.5;
    }
    normalizePlayerLocation();
    const after = gameSnapshot();
    if(preferences.video.effects)animateBookmark(before,after,clock);
    if(preferences.video.effects) animateVertexMount(before,after,clock);
    director.onCommand(before, after, input);
    const landing=director.getState(engine.state).playerLanding;
    if(landing){player.x=landing.x;player.y=landing.y;player.face=landing.face;stopMovement();}
    if (input==='look in crypt' && destination.room==='cemetery' && tombArtView(destination).open) {
      cryptInspection.show(destination,heldItem);
    } else if (cryptInspection.open) {
      cryptInspection.update(destination,heldItem);
    }
    updateLabels();
    if (output.length) {
      const text=output.join('\n\n');
      if(director.getState().currentEvent==='tower_climb') climbArrivalText={text,actions};
      else show(text,actions);
    }
    $('#objective').textContent=chapterObjective(engine.state.chapter);
    persistProgress({force:true});
  } catch(error){
    if(error.name!=='SceneArtError')throw error;
    beginOutput();
    show(error.message||'画面未能载入，请刷新后继续。');
  } finally {
    applyingCommand = false;
    busy = false;
    updateHud();
    render();
  }
}

function describe() {
  if (!started || busy || paused) return;
  command('look');
}

function enterOpening() {
  beginOutput();
  engine.moveTo(engine.state.room);
  show(output.join('\n\n'));
  persistProgress();
}

function persistProgress({force=false}={}) {
  if (!started || engine.state.dead || (busy&&!force)) return {ok:false,skipped:true};
  // The bite gives one final turn. Keep the most recent playable position for Continue.
  if (engine.state.chapter==='ranch' && closetView(engine.state).snake==='bitten')return {ok:false,skipped:true};
  const result = saveStore.write(engine,visualSavePosition(),ferryDeparture);
  if (!result.ok && !result.skipped) $('#save-message').textContent = '进度未能保存：' + result.error.message;
  return result;
}

function paintSaveState() {
  const result = saveStore.read();
  const hasSave = result.ok && Boolean(result.save);
  const savedScene = hasSave ? scenes[result.save.engine.state.room] : null;
  const savedName = savedScene?.mapLabel || savedScene?.label;
  $('#continue-save').hidden = !hasSave;
  $('#continue-save').textContent = hasSave ? '继续探索 · ' + savedName : '继续上次探索';
  $('#start').textContent = hasSave ? '重新开始' : '走进花园 →';
  $('#load-save').disabled = !hasSave || busy;
  $('#export-save').disabled = !hasSave;
  $('#save-now').disabled = !started || busy || engine.state.dead;
  $('#save-summary').textContent = hasSave ? `已保存：${savedName} · 第${result.save.engine.state.turns}回合` : result.error ? '存档暂不可读取：' + result.error.message : '尚无探索进度。进入游戏后，每次操作都会自动保存。';
}

async function restoreProgress(input) {
  if (busy) return;
  busy = true;
  updateHud();
  try {
    const restored = await saveStore.restore(engine, input);
    if (!restored.ok) throw restored.error;
    if(engine.state.chapter==='ranch'){
      restoreWindmillState(engine.state);
      if(engine.state.room==='kitchen')restoreKitchenState(engine.state);
    }
    $('#save-message').textContent = restored.repositioned ? '已恢复进度，角色已移至附近安全位置。' : '已恢复探索进度。';
    $('#title-save-message').textContent = '';
    started = true; director = createNarrativeDirector(); portrait = null; resetWabeArt();
    resetBookmarkMotion();
    ferryDeparture=restored.save.ferryDeparture || null;
    climbArrivalText=null;
    boatSelection='oarsman';
    previousScene=null;
    lastArrival=null;
    cryptInspection.hide();
    discovery=createDiscovery(restored.visual.knowledge.paper);observedObjects=new Set(restored.visual.knowledge.observed);heldItem=null;
    player = {x:restored.visual.x,y:restored.visual.y,face:restored.visual.face,walk:0};
    motion = {moving:false,blend:0,action:'idle',elapsed:0,duration:0};
    exitLock = .5;
    normalizePlayerLocation();
    closeQuest(); closeDialog(); setPaused(false);
    $('#overlay').hidden = true;
    updateLabels();
    $('#objective').textContent=chapterObjective(engine.state.chapter);
    beginOutput(); engine.describeRoom(); show(output.join('\n\n'));
    persistProgress({force:true}); sound.setPaused(false); sound.unlock().catch(()=>{});
  } catch (error) {
    const message='无法读取这份存档：'+error.message;
    $('#save-message').textContent=message; $('#title-save-message').textContent=message;
  } finally { busy=false; paintSaveState(); updateHud(); render(); }
}

function loadSavedProgress() {
  const result=saveStore.read();
  if(result.ok&&result.save) restoreProgress(result.save);
}

function objects() {
  const listed=discovery.mapHotspots(engine.state,getHotspots(engine.state,{observed:observedObjects}));
  const ids=new Set(listed.map(object=>object.id));
  const persistent=director.getState(engine.state).persistentActors.filter(object=>object.room===engine.state.room&&!ids.has(object.id));
  return [...listed,...persistent].map(object=>object.kind==='orbit_membrane'?{...object,x:player.x,y:player.y,pointerShape:{...object.pointerShape,x:player.x,y:player.y-17}}:object.id==='palace_gate:self'?{...object,visual:false}:positionWaterTarget(object,player));
}
function aboard() { return engine.state.room==='the_river' && ferryView(engine.state).onboard; }
function exits() { return aboard() ? [] : sceneExits(engine.state.room, engine.state, engine.rooms); }
function pendingObject(){
  const current=objects().find(object=>object.id===walkTarget?.id);
  return current && (current.approachSpan||current.shoreline) ? positionWaterTarget(current,walkTarget) : current;
}

function nearby() {
  const targets=objects();
  if(aboard()) return targets.find(object=>object.id==='the_river:'+boatSelection);
  return nearbyTarget(targets.filter(object=>!object.actorRelative),player) || targets.find(object=>object.actorRelative);
}

function interact() {
  if (!started || busy || paused) return;
  if (pages.length) { next(); return; }
  if (director.getState().busy) return;
  if (cryptInspection.open) { cryptInspection.interact(); return; }
  if (!$('#quest').hidden) { back(); return; }
  const object = nearby();
  const decision=keyboardInteraction(engine.state,object,{heldItem,observed:observedObjects});
  if(!decision)return;
  if(decision.type==='self'){useHeldItem();return;}
  interactWith(decision.target);
}

function interactWith(object) {
  if(busy||paused||director.getState().busy)return;
  if(aboard()){
    boatSelection=object.kind==='islet_oarsman'?'oarsman':'ferry';
  }else{
    if(!withinReach(player,object))return;
    faceObject(object);
  }
  const input=resolveInteraction(engine.state,object,{heldItem,observed:observedObjects});
  if(!input){sound.playUi('click');$('#hand-status').textContent='没有反应。';return;}
  portrait=object.kind==='woman'?(engine.state.room==='broad_walk'?'bird_woman':'umbrella_woman'):null;
  animateAction(/^(take|get|pick)/.test(input)?'pickup':'inspect');
  const actions=[];
  if(object.kind==='paperback' && input==='examine book' && !object.visualOptions?.onShelf){
    const open=engine.state.hasFlag('paperback_open');
    actions.push({label:open?'合上书':'翻开书',run:()=>command(open?'close book':'open book')});
  }
  command(input,actions,object.id);
}

function useHeldItem() {
  const paperFlight=heldItem==='paper_bird'&&engine.state.room==='playground';
  const input=heldItem==='paper_bird'&&!paperFlight?'examine paper bird':resolveHeldSelf(heldItem,engine.state);
  focusedItem=heldItem==='paper_bird'&&!paperFlight?heldItem:null;
  if(input&&!paused&&!busy)command(input);
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
  $('#text').textContent = '选择一件物品拿在手中，再点击场景尝试使用。点击手中物品可以近看。';
  $('#choices').replaceChildren();
  for (const { id } of engine.state.inventoryList()) {
    const button = document.createElement('button');
    button.textContent = ITEMS[id].cn;
    button.onclick = () => {heldItem=id;closeDialog();if(cryptInspection.open)cryptInspection.update(engine.state,heldItem);$('#hand-status').textContent='';updateHud();};
    $('#choices').append(button);
  }
  if(['shroud','bandage'].includes(heldItem) && engine.state.has(heldItem)
      && engine.currentRoom()?.events?.some(event=>event.id==='wear_'+heldItem)){
    const item=heldItem;
    const worn=engine.state.wearing(item);
    const button=document.createElement('button');
    button.id='inventory-wear-'+item;
    button.textContent=item==='shroud'?(worn?'脱下裹尸布':'穿上裹尸布'):(worn?'解下绷带':'缠上绷带');
    button.onclick=()=>{closeDialog();command((worn?'remove ':'wear ')+item);};
    $('#choices').append(button);
  }
  if(heldItem==='binoculars' && engine.state.has(heldItem)
    && engine.currentRoom()?.events?.some(event=>event.id==='ranch_wear_binoculars')){
    const worn=engine.state.wearing(heldItem);
    const strap=document.createElement('button');strap.textContent=worn?'摘下望远镜':'挂上望远镜';
    strap.onclick=()=>{closeDialog();command(worn?'remove binoculars':'wear binoculars');};
    $('#choices').append(strap);
  }
  if(engine.state.has('paperback') && (heldItem==='paperback'||heldItem==='slip')){
    const cover=heldItem==='paperback', open=engine.state.hasFlag('paperback_open');
    const button=document.createElement('button');
    button.id=cover?'inventory-book-cover':'inventory-bookmark';
    button.textContent=cover?(open?'合上书':'翻开书'):'夹回书里';
    button.onclick=()=>{closeDialog();command(cover?(open?'close book':'open book'):'put slip in book');};
    $('#choices').append(button);
  }
  if(heldItem&&engine.state.has(heldItem)&&!ITEMS[heldItem]?.fixed&&!(heldItem==='soap_bubble'&&engine.state.chapter==='orbit')){
    const drop=document.createElement('button');drop.textContent='放下手中物品';drop.id='inventory-drop';
    drop.onclick=()=>{const id=heldItem;closeDialog();command(`drop ${ITEMS[id].aliases?.[0]||id}`);};
    $('#choices').append(drop);
  }
  $('#next').textContent = `收起 ${keyLabel(preferences.bindings.interact)}`;
  updateHud();
  canvas.focus({ preventScroll: true });
}

function obstacles() { return scenes[engine.state.room].obstacles; }

function bodyObstacles(){return objects().filter(o=>['woman','umbrella_woman','boy','pram','sundial','door','japan_door','japan_girl','mushroom_gate'].includes(o.kind)).map(o=>{
  const rx=o.kind==='pram'?20:o.kind==='sundial'?16:['door','japan_door'].includes(o.kind)?11:o.kind==='mushroom_gate'?16:o.kind==='japan_girl'?4:6,ry=['pram','sundial'].includes(o.kind)?7:o.kind==='mushroom_gate'?5:o.kind==='japan_girl'?2.5:3;
  return {x:o.x-rx,y:o.y-ry,w:rx*2,h:ry*2};
});}
function navigationScene(){
  const scene=scenes[engine.state.room];
  const bodies=bodyObstacles();
  for(const door of ranchDoors(scene)){
    const doorBody=ranchDoorOpen(engine.state,door)?door.openObstacles:door.closedObstacles;
    if(doorBody)bodies.push(...doorBody);
  }
  const plate = currentPlate(scene.background,engine.state);
  return cachedNavigationScene(scene,bodies,plate?.walkablePolygons);
}
function solid(x, y) { return isBlocked(navigationScene(), x, y); }
function normalizePlayerLocation(){
  if(engine.state.hasFlag('in_pram')||!solid(player.x,player.y))return;
  const safe=nearestWalkable(navigationScene(),player);
  if(safe){player.x=safe.x;player.y=safe.y;}
}

async function transition(exit) {
  if (busy) return;
  const target = exit.target;
  if (!scenes[target]) return;
  await command(exit.dir);
  if (engine.state.room === target) {
    stopMovement();
    motion.blend = 0;
    motion.action = 'idle';
    player.walk = 0;
  }
  render();
}

function canMovePlayer() {
  return started && !pages.length && !busy && !paused && !cryptInspection.open && !chapterMap.isOpen()
    && !engine.state.dead && !director.getState().busy && !engine.state.hasFlag('in_pram') && !aboard()
    && $('#quest').hidden;
}

function update(dt) {
  if (paused || chapterMap.isOpen() || applyingCommand) return;
  clock += dt;
  director.update(dt);
  if(climbArrivalText && director.getState().currentEvent!=='tower_climb'){
    const {text,actions}=climbArrivalText;
    climbArrivalText=null;
    show(text,actions);
  }
  exitLock = Math.max(0, exitLock - dt);
  motion.elapsed += dt;
  if (motion.action !== 'idle' && motion.elapsed >= motion.duration) motion.action = 'idle';
  const canWalk = canMovePlayer();
  let dx = canWalk ? Number(keys.has('ArrowRight') || keys.has(preferences.bindings.right)) - Number(keys.has('ArrowLeft') || keys.has(preferences.bindings.left)) : 0;
  let dy = canWalk ? Number(keys.has('ArrowDown') || keys.has(preferences.bindings.down)) - Number(keys.has('ArrowUp') || keys.has(preferences.bindings.up)) : 0;
  // A movement input wins over a previously queued click, even on the frame
  // when the old object has just entered reach.
  if(dx||dy){walkPath=[];walkTarget=null;walkExit=null;}
  if(canWalk&&walkTarget){
    const target=pendingObject();
    if(target&&withinReach(player,target,1)){walkPath=[];walkTarget=null;interactWith(target);return;}
  }
  let remainingDistance=Infinity;
  if(!dx&&!dy&&canWalk&&walkPath.length){
    // Each next segment was checked from the exact corner. Turning a fraction
    // of a pixel early can put the feet outside a narrow lane for its full length.
    while(walkPath.length && player.x === walkPath[0][0] && player.y === walkPath[0][1]) walkPath.shift();
    if(walkPath.length){dx=walkPath[0][0]-player.x;dy=walkPath[0][1]-player.y;remainingDistance=Math.hypot(dx,dy);}
    else if(walkTarget){const target=pendingObject();walkTarget=null;if(target&&withinReach(player,target))interactWith(target);}
    else if(walkExit){
      const exit=exits().find(candidate=>candidate.dir===walkExit);walkExit=null;
      if(exit&&exitDistance(exit,player)<exit.radius){command(exit.dir);return;}
    }
  }
  const oldX = player.x, oldY = player.y;
  if (dx || dy) {
    player.face = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
    const stride = 92 * dt;
    const reachCorner = remainingDistance <= stride;
    const step = stride / Math.hypot(dx, dy);
    const nx = reachCorner ? walkPath[0][0] : player.x + dx * step;
    const ny = reachCorner ? walkPath[0][1] : player.y + dy * step;
    if(walkPath.length&&!solid(nx,ny)){player.x=nx;player.y=ny;}
    else {
      if (!solid(nx, player.y)) player.x = nx;
      if (!solid(player.x, ny)) player.y = ny;
    }
  }
  const distance = Math.hypot(player.x - oldX, player.y - oldY);
  motion.moving = distance > 0.001;
  motion.blend += (Number(motion.moving) - motion.blend) * (1 - Math.exp(-dt * 20));
  if (motion.blend < 0.001) motion.blend = 0;
  if (motion.moving) {
    player.walk = (player.walk + distance / 46 * Math.PI * 2) % (Math.PI * 2);
    motion.action = 'idle';
    for (const exit of exits()) {
      if (!exit.interactionOnly&&!walkTarget&&!walkPath.length&&!exitLock && approachingExit(exit,{x:oldX,y:oldY},player)) { transition(exit); break; }
    }
  }
  if(canWalk&&!motion.moving&&(dx||dy)&&!exitLock&&!walkTarget&&!walkPath.length){
    const exit=exits().find(exit=>leavingBoundaryExit(exit,player,{x:dx,y:dy}));
    if(exit)transition(exit);
  }
  updateHud();
}

function animationState() {
  if(engine.state.chapter==='orbit')return {moving:motion.moving,blend:0,time:preferences.video.effects?clock:0,action:motion.moving?'float':'idle',actionProgress:0,airborne:true};
  return {
    moving: motion.moving, blend: motion.blend, time: preferences.video.effects ? clock : 0,
    action: motion.action !== 'idle' ? motion.action : motion.moving ? 'walk' : 'idle',
    actionProgress: motion.duration ? Math.min(1, motion.elapsed / motion.duration) : 0,
  };
}

function paperDetailLayout() {
  return canvas.clientWidth<600?{left:150,top:34,width:180,height:90,x:240,y:114,scale:4.5}
    :{left:166,top:58,width:148,height:110,x:240,y:144,scale:5};
}
function pointedPaperDetail(point) {
  if(focusedItem!=='paper_bird'||!pages.length)return false;
  const box=paperDetailLayout();
  return point.x>box.left&&point.x<box.left+box.width&&point.y>box.top&&point.y<box.top+box.height;
}

function visibleRouteMarker() {
  if (reviewRoutes || !canMovePlayer()) return null;
  const routes = exits();
  let route = null, exit = null, bestDistance = Infinity;
  for (const candidate of routes) {
    if (candidate.interactionOnly) continue;
    const distance = exitDistance(candidate, player);
    if (distance >= 55 || distance >= bestDistance) continue;
    exit = candidate;
    route = {...candidate,...nearestExitPoint(candidate,player)};
    bestDistance = distance;
  }
  for (const boundary of sceneBoundaries(engine.state.room, engine.state, engine.rooms)) {
    const distance = Math.hypot(boundary.x - player.x, boundary.y - player.y);
    if (distance >= 49 || distance >= bestDistance) continue;
    route = boundary;
    exit = null;
    bestDistance = distance;
  }
  if (!route) return null;

  const { dir } = route;
  const anchor = exit && scenes[engine.state.room].exitLabelAnchors?.[dir];
  const x = anchor?.[0] ?? Math.max(52, Math.min(416, route.x));
  const y = anchor?.[1] ?? ({ ne: Math.max(49, route.y - 10), nw: Math.max(49, route.y - 10),
    n: Math.max(27, route.y - 10), s: Math.min(268, route.y - 7) }[dir] ?? route.y - 10);
  const screenDir=scenes[engine.state.room].northAtBottom?({n:'s',s:'n',e:'w',w:'e'}[dir]||dir):dir;
  const text = exit ? `${{ n: '↑ ', w: '← ' }[screenDir] ?? ''}${exit.label}${{ e: ' →', s: ' ↓' }[screenDir] ?? ''}` : '前方场景制作中';
  ctx.save();
  ctx.font = '8px serif';
  const width = ctx.measureText(text).width + 14, height = 14;
  ctx.restore();

  const minEdge = 6, maxLeft = LOGICAL_SIZE.width - width - minEdge, maxTop = LOGICAL_SIZE.height - height - minEdge;
  const left = Math.max(minEdge, Math.min(maxLeft, x - width / 2));
  const top = Math.max(minEdge, Math.min(maxTop, y - 9));
  // Reserve the visible character and the direct canvas targets for other roads.
  const floating = engine.state.chapter === 'orbit';
  const halfWidth = floating ? 36 : 12;
  const obstacles = [{ left: player.x - halfWidth, right: player.x + halfWidth,
    top: player.y - (floating ? 54 : 40), bottom: player.y + (floating ? 20 : 7) }];
  for(const door of ranchDoors(scenes[engine.state.room])){
    const shapes=ranchDoorOpen(engine.state,door)?[door.openingShape,door.openLeafShape]:[door.pointerShape];
    for(const shape of shapes){
      if(!shape?.points?.length)continue;
      const xs=shape.points.map(([px])=>px),ys=shape.points.map(([,py])=>py);
      obstacles.push({left:Math.min(...xs)-2,right:Math.max(...xs)+2,top:Math.min(...ys)-2,bottom:Math.max(...ys)+2});
    }
  }
  for (const other of routes) {
    if (other !== exit) obstacles.push({ left: other.x - 13, right: other.x + 13, top: other.y - 13, bottom: other.y + 13 });
  }
  const positions = [[left, top]];
  for (const obstacle of obstacles) {
    positions.push([obstacle.left - width, top], [obstacle.right, top],
      [left, obstacle.top - height], [left, obstacle.bottom]);
  }
  positions.sort((a, b) => Math.hypot(a[0] - left, a[1] - top) - Math.hypot(b[0] - left, b[1] - top));
  const placement = positions.find(([px, py]) => px >= minEdge && px <= maxLeft && py >= minEdge && py <= maxTop
    && obstacles.every(obstacle => px + width <= obstacle.left || px >= obstacle.right
      || py + height <= obstacle.top || py >= obstacle.bottom));
  return placement ? { exit, text, left: placement[0], top: placement[1], width, height } : null;
}

function pointedExitLabel(point) {
  const marker = visibleRouteMarker();
  if (marker?.exit && point.x >= marker.left && point.x <= marker.left + marker.width
      && point.y >= marker.top && point.y <= marker.top + marker.height) return marker.exit;
  return null;
}

function render() {
  if (applyingCommand) return;
  const scale = preferences.video.resolution;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  const story = director.getState(engine.state);
  const renderRoom = story.sceneRoom && scenes[story.sceneRoom] ? story.sceneRoom : engine.state.room;
  updateLabels(renderRoom);
  const crossing=renderRoom!==engine.state.room;
  const renderState=crossing&&previousScene?.room===renderRoom?previousScene:engine.state;
  if(renderRoom==='the_river' && ferryView(renderState).onboard){
    renderFerryAboard(ctx,{shrouded:renderState.itemLoc.shroud==='worn',phase:ferryView(renderState).phase},preferences.video.effects?clock:0);
    if(story.currentEvent==='ferry_crossing')director.draw(ctx,renderRoom,engine.state,clock);
    return;
  }
  const renderObjects=crossing?(previousScene?.room===renderRoom?previousScene.visual.hotspots:[]):objects();
  warmWindmillArt(renderRoom);
  drawScene(ctx, renderRoom, clock, preferences.video.effects,renderState);
  if(renderRoom==='closet')drawClosetThreshold(ctx,renderState,scenes[renderRoom]);
  drawUndergroundAtmosphere(ctx,renderRoom,renderState,player,preferences.video.effects?clock:0,renderObjects);
  const inPram=engine.state.hasFlag('in_pram');
  const actors = renderObjects.filter(object => !(story.hiddenKinds || []).includes(object.kind) && !(object.kind==='dish' && renderObjects.some(actor=>actor.kind==='boy'))).map(object => ({ y: object.depthY??object.y, draw: () => drawStoryProp(ctx, {...object,visualOptions:{...object.visualOptions,...story.actorVisuals?.[object.id],...(object.kind==='pram'&&inPram?{rider:true,open:true}:{})}}, renderState, preferences.video.effects ? clock : 0) }));
  for(const object of story.groundActors||[])actors.push({y:object.y,draw:()=>drawStoryProp(ctx,object,renderState,clock)});
  if (!story.hidePlayer&&!inPram) {
    actors.push({y:player.y,draw:()=>{
      const time=preferences.video.effects?clock:0;
      const costumeAtlas=renderState.itemLoc.shroud==='worn'?cemeteryShroudAtlas():null;
      if(renderRoom==='reservoir'||renderRoom==='underwater'){
        drawSwimmer(ctx,renderRoom,player,time,motion.moving,costumeAtlas);
      }else if(renderState.chapter==='orbit'){
        renderOrbitPlayer(ctx,player,time);
      }else{
        const animation=animationState();
        const scene=scenes[renderRoom], perspective=scene?.actorPerspective;
        animation.sceneScale=scene?.actorScale ?? shackRouteCharacterScale(renderRoom,player.y);
        if(perspective){
          const depth=Math.max(0,Math.min(1,(player.y-perspective.backY)/(perspective.frontY-perspective.backY)));
          animation.sceneScale=perspective.backScale+depth*(perspective.frontScale-perspective.backScale);
        }
        animation.costumeAtlas=costumeAtlas;
        drawActor(ctx,player.x,player.y,'#bca071',player.face,player.walk,false,animation);
      }
      if(renderRoom.startsWith('underground_')&&engine.state.has('lantern')){
        renderUndergroundSprite(ctx,{kind:'lantern',x:player.x+7,y:player.y-9},renderState,clock);
      }
    }});
  }
  actors.sort((a, b) => a.y - b.y).forEach(actor => {actor.draw();drawOcclusion(ctx,renderRoom,actor.y,renderState);});
  if(renderRoom==='closet')drawClosetLight(ctx,renderState,player,renderObjects);
  if(renderRoom==='underwater'){
    const lantern=reservoirLanternLit(renderState);
    const bottomLight=renderObjects.find(o=>o.itemId===(lantern?'lantern':'splinter'));
    drawBottomVisibility(ctx,player,reservoirBottomLit(renderState),bottomLight,lantern);
  }
  director.draw(ctx, renderRoom, engine.state, clock);
  if (portrait && pages.length) drawStoryPortrait(ctx, portrait, 25, 45, 85, 95);
  if(focusedItem==='paper_bird'&&pages.length){
    const box=paperDetailLayout();
    ctx.save();ctx.fillStyle='#192820f5';ctx.strokeStyle='#bfa46e';ctx.fillRect(box.left,box.top,box.width,box.height);ctx.strokeRect(box.left,box.top,box.width,box.height);
    ctx.beginPath();ctx.rect(box.left+2,box.top+2,box.width-4,box.height-4);ctx.clip();ctx.translate(box.x,box.y);ctx.scale(box.scale,box.scale);
    drawStoryProp(ctx,{kind:'paper_bird',x:0,y:0},engine.state,clock);
    if(engine.state.hasFlag('bird_unfolded')){ctx.fillStyle='#59472d';ctx.font='italic 2px Georgia,serif';ctx.textAlign='center';ctx.fillText('Long Water,',0,-6);ctx.fillText("Four O’Clock",0,-3.4);}
    ctx.restore();
  }
  const marker = crossing ? null : visibleRouteMarker();
  if (marker) {
    const { left, top, width, height, text, exit } = marker;
    ctx.font = '8px serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = exit ? '#19251ed6' : '#19251ee8';
    ctx.fillRect(left, top, width, height);
    ctx.strokeStyle = '#cfb48177';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(left, top, width, height);
    ctx.fillStyle = exit ? '#efe0b8' : '#d1c6a3';
    ctx.fillText(text, left + width / 2, top + 9);
  }
}

function pointerPoint(event){const rect=canvas.getBoundingClientRect();return {x:(event.clientX-rect.left)/rect.width*480,y:(event.clientY-rect.top)/rect.height*288};}
function pointedObject(point,padding=0){
  const target=pointerTarget(objects(),point,{padding});
  return target && (target.shoreline||target.approachSpan) ? positionWaterTarget(target,point) : target;
}
function pointedOpenPassage(point){
  const outlines=scenes[engine.state.room]?.exitPointerPolygons;
  if(!outlines)return null;
  return exits().find(exit=>!exit.locked && outlines[exit.dir] && pointInPolygon(point.x,point.y,outlines[exit.dir]));
}
canvas.addEventListener('pointermove',event=>{
  const p=pointerPoint(event),active=started&&!paused&&!chapterMap.isOpen()&&!busy&&!director.getState().busy;
  canvas.style.cursor=active&&(pages.length?pointedPaperDetail(p):pointedObject(p)||pointedExitLabel(p)||pointedOpenPassage(p))?'pointer':'default';
});
canvas.addEventListener('pointerdown',event=>{
  if(!started||paused||busy||chapterMap.isOpen()||event.button!==0)return;
  if(pages.length){
    const point=pointerPoint(event);
    if(pointedPaperDetail(point)){command(resolveHeldSelf('paper_bird',engine.state));return;}
    next();return;
  }
  if(director.getState().busy)return;
  stopMovement();
  const point=pointerPoint(event),padding=event.pointerType==='touch'?Math.min(10,12*480/canvas.clientWidth):0;
  const target=pointedObject(point,padding);
  if(aboard()){
    if(target)interactWith(target);
    return;
  }
  const touchedDoor=target?.kind==='ranch_outside_door'||target?.id.endsWith(':opening');
  const labelExit=touchedDoor?null:pointedExitLabel(point);
  // A ferry's shore point is for approaching its hull. Clicking the sand walks there.
  const layout=scenes[engine.state.room];
  const propOnlyDirs=[...(layout.propOnlyExitDirs||[]), ...ranchDoors(layout).map(door=>door.dir)];
  const requestedExit = labelExit || (!target && (pointedOpenPassage(point) || exits().find(exit =>
    !propOnlyDirs.includes(exit.dir) && exitDistance(exit,point) < 13)));
  if(requestedExit&&!engine.state.hasFlag('in_pram')){
    const navigation=navigationScene(), landing=nearestExitPoint(requestedExit,labelExit?player:point);
    walkPath=findPath(navigation,player,landing,{nearest:true});walkTarget=null;walkExit=walkPath.length?requestedExit.dir:null;canvas.focus({preventScroll:true});return;
  }
  if(target&&withinReach(player,target)){interactWith(target);return;}
  if(engine.state.hasFlag('in_pram')){if(heldItem)useHeldItem();else command('exit pram');return;}
  const navigation=navigationScene();
  const landing=nearestWalkable(navigation,target||point,{from:player});
  if(!landing)return;
  walkPath=findPath(navigation,player,landing);
  walkExit=null;
  walkTarget=target&&Math.hypot(target.x-landing.x,target.y-landing.y)<target.radius?target:null;
  canvas.focus({preventScroll:true});
});

function start() {
  if (started || busy) return;
  if (saveStore.read().save && !window.confirm('开始新的探索会替换当前2D存档。要重新开始吗？')) return;
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

const bindingNames = { up: '向上行走', down: '向下行走', left: '向左行走', right: '向右行走', interact: '互动 / 继续', inventory: '背包', look: '环顾四周', hint: '探索提示', watch:'查看手表',wait:'等候片刻',fullscreen: '切换全屏' };
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
      $('#binding-message').textContent = `正在设置「${label}」：按字母、数字或 F11，Esc 取消。`;
      paintBindings();
      $(`[data-binding="${action}"]`).focus();
    };
    row.append(name, button);
    $('#binding-list').append(row);
  }
  $('.keys').textContent = `方向键 / ${['up', 'left', 'down', 'right'].map(key => keyLabel(preferences.bindings[key])).join('')} 行走 · ${keyLabel(preferences.bindings.interact)} 互动 · ${keyLabel(preferences.bindings.watch)} 看表 · ${keyLabel(preferences.bindings.wait)} 等待 · M 地图 · Esc 暂停设置 · ${keyLabel(preferences.bindings.fullscreen)} 全屏`;
  canvas.setAttribute('aria-label',`方向键行走，${keyLabel(preferences.bindings.interact)}互动和继续对话，Esc暂停与设置`);
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
  for(const child of $('.stage').children) if(child !== $('#pause-menu')) child.inert = paused;
  sound.setPaused(paused || !started);
  updateHud();
  if (paused) {
    persistProgress(); paintSaveState();
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
  if([bindings.watch,bindings.wait,bindings.look].includes(key)&&(!started||pages.length||busy||director.getState().busy))return;
  if (key === bindings.interact) interact();
  else if (key === bindings.inventory) inventory();
  else if (key === bindings.look) describe();
  else if (key === bindings.watch) command(engine.state.chapter==='prologue'?'time':'examine watch');
  else if (key === bindings.wait) command('wait');
  else if (key === bindings.hint) toggleQuest();
  else if (key === bindings.fullscreen) fullscreen();
}

const normalKey = key => key.length === 1 ? key.toLowerCase() : key;
const arrowKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
function isMovementKey(key) {
  const {up, down, left, right} = preferences.bindings;
  return arrowKeys.includes(key) || [up, down, left, right].includes(key);
}
window.addEventListener('keydown', event => {
  const key = normalKey(event.key);
  if (paused && captureBinding) {
    event.preventDefault();
    if (key === 'Escape') { captureBinding = null; paintBindings(); $('#binding-message').textContent = '已取消改键。'; return; }
    if (key==='m'||(!/^[a-z0-9]$/.test(key)&&!(key==='F11'&&captureBinding==='fullscreen'))) { $('#binding-message').textContent = '请选择字母或数字；F11仅用于全屏，方向键、M和Esc为固定按键。'; return; }
    const conflict = Object.entries(preferences.bindings).find(([action, value]) => value === key && action !== captureBinding);
    if (conflict) { $('#binding-message').textContent = `${keyLabel(key)} 已用于「${bindingNames[conflict[0]]}」，请选择其他按键。`; return; }
    preferences.bindings[captureBinding] = key;
    captureBinding = null;
    storeSettings(); paintBindings();
    $('#binding-message').textContent = '新键位已保存。';
    return;
  }
  if (cryptInspection.open && !paused && !chapterMap.isOpen()) {
    if (key==='Escape') { event.preventDefault(); if(!event.repeat)leaveCrypt(); return; }
    if (key==='m') leaveCrypt();
    else if (!pages.length && key==='Tab') {
      event.preventDefault();
      if (!event.repeat) cryptInspection.tab(event.shiftKey?-1:1);
      return;
    } else if (!pages.length && isMovementKey(key)) {
      event.preventDefault();
      if (!event.repeat) {
        const reverse=['ArrowLeft','ArrowUp',preferences.bindings.left,preferences.bindings.up].includes(key);
        cryptInspection.step(reverse?-1:1);
      }
      return;
    } else if (!pages.length && key===preferences.bindings.interact) {
      event.preventDefault(); if(!event.repeat)interact(); return;
    }
    if (!pages.length && [preferences.bindings.look,preferences.bindings.hint,preferences.bindings.wait,preferences.bindings.watch].includes(key)) return;
  }
  if ((key === 'm' && !paused && started && !busy) || (key === 'Escape' && chapterMap.isOpen())) {
    event.preventDefault();if(event.repeat)return;
    if(chapterMap.isOpen())chapterMap.close('key');else{stopMovement();sound.setPaused(true);chapterMap.open({state:engine.state,rooms:engine.rooms,scenes});}return;
  }
  if(chapterMap.isOpen())return;
  if (key === 'Escape') {
    event.preventDefault();
    if (!event.repeat) setPaused(!paused);
    return;
  }
  if (key===preferences.bindings.fullscreen&&!captureBinding){event.preventDefault();if(!event.repeat)fullscreen();return;}
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
  if (arrowKeys.includes(key) || key === ' ') event.preventDefault();
  // Held keys already have an entry. A repeat must never restore one cleared
  // by a room change, dialogue, map, pause or loss of focus.
  if (event.repeat) return;
  if (isMovementKey(key)) {
    if(aboard()&&!pages.length&&!busy&&$('#quest').hidden){
      boatSelection=['ArrowLeft','ArrowDown',preferences.bindings.left,preferences.bindings.down].includes(key)?'ferry':'oarsman';
      updateHud();
      return;
    }
    if (canMovePlayer()) keys.add(key);
    return;
  }
  actionKey(key);
});
canvas.addEventListener('contextmenu',event=>{event.preventDefault();if(started&&!chapterMap.isOpen())setPaused(true);});
$('.stage').addEventListener('touchstart',event=>{if(event.touches.length===2){event.preventDefault();if(chapterMap.isOpen())chapterMap.close('gesture');else setPaused(!paused);}}, {passive:false});
window.addEventListener('keyup', event => keys.delete(normalKey(event.key)));
window.addEventListener('blur', stopMovement);
$('#start').onclick = start;
$('#held-item').onclick = useHeldItem;
$('#clear-hand').onclick = () => {heldItem=null;$('#hand-status').textContent='';updateHud();canvas.focus({preventScroll:true});};
$('#continue-save').onclick = loadSavedProgress;
$('#load-save').onclick = loadSavedProgress;
$('#return-to-ferry-shore').onclick = () => {
  if (ferryDeparture && !$('#return-to-ferry-shore').hidden) restoreProgress(ferryDeparture);
};
$('#save-now').onclick = () => { const result=persistProgress(); paintSaveState(); if(result.ok) $('#save-message').textContent='已保存当前探索进度。'; };
$('#export-save').onclick = () => {
  const result=saveStore.export();
  if(!result.ok){$('#save-message').textContent='导出失败：'+result.error;return;}
  const url=URL.createObjectURL(new Blob([result.text],{type:'application/json'}));
  const link=document.createElement('a');link.href=url;link.download='trinity-hd2d-save.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
};
$('#import-save').onclick = () => $('#save-file').click();
$('#save-file').onchange = async event => {
  const file=event.target.files?.[0];if(!file)return;
  try {
    if(file.size>1024*1024){$('#save-message').textContent='这份存档过大，无法读取。';return;}
    await restoreProgress(await file.text());
  } catch { $('#save-message').textContent='无法读取这份存档文件。'; }
  finally { event.target.value=''; }
};
window.addEventListener('pagehide',persistProgress);
$('#next').onclick = next;
$('#restart').onclick = () => { if(!started || window.confirm('重新开始会替换当前2D存档。要重新开始吗？')) reset(); };
$('#close-quest').onclick = () => { closeQuest(); updateHud(); canvas.focus({ preventScroll: true }); };
$('#surface-water').onclick=()=>{
  if(engine.state.room==='underwater' && !reservoirBottomLit(engine.state))interact();
};
$('#skip-event').onclick = () => { director.skip(); updateHud(); render(); };
$('#resume').onclick = () => setPaused(false);
$('#fullscreen').onclick = fullscreen;
$('#start-fullscreen').onclick = () => {fullscreen();start();};
$('#menu-map').onclick = () => {setPaused(false);stopMovement();sound.setPaused(true);chapterMap.open({state:engine.state,rooms:engine.rooms,scenes});};
$('#menu-bag').onclick = () => { setPaused(false); inventory(); };
$('#menu-help').onclick = () => { setPaused(false); toggleQuest(); };
$('#replay-umbrella').onclick = () => {setPaused(false);closeDialog();stopMovement();director.replayUmbrella(gameSnapshot());updateHud();render();};
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
    if (!canMovePlayer()) return;
    event.preventDefault(); button.setPointerCapture(event.pointerId); keys.add(button.dataset.key);
  };
  button.onpointerup = button.onpointercancel = button.onlostpointercapture = () => keys.delete(button.dataset.key);
}

window.render_game_to_text = () => JSON.stringify({
  art: artStatus(), backgrounds:requestedSceneArt(), isletSprites:isletArtStatus(), tundraSprites:tundraArtStatus(), pacificSprites:pacificArtStatus(), pacific:engine.state.chapter==='pacific'?pacificControlState(engine.state):null, completionSprites:completionArtStatus(), completionBoy:engine.state.room==='promontory'?completionBoyMotion(preferences.video.effects?clock:0):null, arborOrbitSprites:arborOrbitArtStatus(), sprites: spriteArtStatus(), noticeArt:noticeArtStatus(), heroArt:heroArtStatus(), wabeSprites:wabeArtStatus(), japanSprites:japanArtStatus(), cliffSprites:cliffArtStatus(), undergroundSprites:undergroundArtStatus(), map: chapterMap.getState(), mode: chapterMap.isOpen() ? 'map' : paused ? 'paused' : !started ? 'title' : pages.length ? 'dialogue' : !$('#quest').hidden ? 'hint' : cryptInspection.open ? 'inspect' : 'exploring',
  cryptInspection:cryptInspection.open?{selected:cryptInspection.selected()}:null,
  closet:['closet','assembly_room'].includes(engine.state.room)?closetView(engine.state):null,
  isletDoor:engine.state.room==='islet'?isletDoorView(engine.state):null,
  dialShadow:engine.state.room==='vertex'?vertexShadowView(engine.state):null,
  shackDoor:engine.state.room==='shack'?{open:shackDoorOpen(engine.state)}:null,
  ferry:['the_river','sand_bar'].includes(engine.state.room)?{...ferryView(engine.state),selection:aboard()?boatSelection:null}:null,
  coordinateSystem: 'origin top-left; x right, y down; 480x288', room: engine.state.room,
  player: { x: Math.round(player.x), y: Math.round(player.y), facing: player.face, phase: player.walk, animation: animationState() },
  removedPresence:[...new Set(removedPresence)], objects: objects(), obstacles: obstacles(), exits: exits(), routeMarker:visibleRouteMarker(), boundaries:sceneBoundaries(engine.state.room,engine.state,engine.rooms), narrative: director.getState(), nearby: nearby()?.label,
  flags: [...engine.state.flags], turns: engine.state.turns, chapter: engine.state.chapter, dead:engine.state.dead,processing:busy,
  storyClock:prologueClock(engine.state),
  inventory: engine.state.inventoryList().map(item => item.id), heldItem, lastCommand, discovery:discovery.snapshot(), observed:[...observedObjects], navigation:{path:walkPath,target:walkTarget?.id??null,exit:walkExit,arrival:lastArrival}, score: engine.state.score, sundialSymbol:engine.state.sundialSymbol, flipped:engine.state.flipped,
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
