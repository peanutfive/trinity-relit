import {parseWaterfallObservation,freeWaterfallObservation} from './waterfall-discovery.js';
import {parseFallsSteps,freeFallsDirection} from './waterfall-stairs.js';
import {freeBogAction,initializeBogLog,parseBogAction,restoreBogLog} from './bog-log-story.js';
import {burnLantern, freeLanternAction, handleLantern, lanternAction, lanternWaitMoves, parseLanternCommand,
  initializeUndergroundItems, restoreLantern} from './lantern-story.js';
import { advanceShadow, completeProjectedReturn, initializeShadow, restoreShadow, initializeVertexInstallation, vertexShadowView, waterfallDoorView,
  restoreVertexInstallation, recordVertexMirrorCrossing } from './islet-shadow.js';
import {freeProjectedAction, projectedWaitMoves, reportProjectedMotion} from './projected-doors.js';
import {fadeUndergroundDoor} from './underground-story.js';
import { GameEngine } from '../js/engine.js';
import { ferryView, startFerry } from './ferry-state.js';
import { advanceFerry, leaveFerry } from './ferry-voyage.js';
import { unseenFerryTarget } from './ferry-shore.js';
import { missingSandbarFeature } from './sandbar-ground.js';
import { initializeRoadrunner, restoreRoadrunner, birdAtOpenDoor, advanceRoadrunner, roadrunnerAction,
  missingRoadrunnerTarget, performRoadrunnerAction, roadrunnerWait, recordSceneryFocus } from './roadrunner-story.js';
import { ranchCollapseDue, RANCH_RIVER_ENDING } from './river-ending-story.js';
import { beginPrologueTurn, finishPrologueTurn, restoreGardenMoves } from './prologue-ending-story.js';
import {arborLight} from './arbor-light-state.js';
import {freeArborAction,unlitArbor} from './arbor-story.js';
import { Parser } from '../js/parser.js';
import { ITEMS, restorePaperback, paperbackAction, unavailablePaperback, handlePaperback } from './exploration-items.js';
import { ROOMS, TIMERS } from '../js/data/prologue.js';

const VISUAL_CHAPTER_LOADERS = Object.freeze({
  wabe: () => import('./cemetery-story.js'),
  japan: () => import('../js/data/japan.js'),
  underground: () => import('./underground-story.js'),
  orbit: () => import('../js/data/orbit.js'),
  pacific: () => import('../js/data/pacific.js'),
  tundra: () => import('../js/data/tundra.js'),
  islet: async () => {
    const [islet, cemetery] = await Promise.all([import('./ferry-islet.js'),import('./cemetery-story.js')]);
    return {ROOMS:cemetery.withCemeteryItems(islet.ISLET_ROOMS)};
  },
  desert: () => import('./shack-story.js'),
  ranch: () => import('./ranch-story.js'),
});

class ExplorationParser extends Parser {
  constructor(currentRoom){
    super();
    this.currentRoom=currentRoom;
  }
  parse(input){
    const text=input.trim().toLowerCase();
    const stairs=parseFallsSteps(this.currentRoom(),text);
    if(stairs)return stairs;
    const waterfall = parseWaterfallObservation(text);
    if (waterfall) return waterfall;
    const lamp=parseLanternCommand(text);
    if(lamp)return lamp;
    const birdOptics=text.match(/^observe (?:the )?(roadrunner|bird) (with|through) (?:the )?(?:pair of )?binoculars$/);
    if(birdOptics)return super.parse('look at '+birdOptics[1]+' '+birdOptics[2]+' binoculars');
    if(/^用(?:双筒)?望远镜(?:看|观察)(?:那只)?(?:走鹃|鸟)$/.test(text))
      return super.parse('look at roadrunner through binoculars');
    if (/^用(?:小)?(?:铲子?|铁铲|锹)(?:撬开|打开)(?:石棺|棺盖)$/.test(text))
      return super.parse('open crypt with spade');
    if (/^(?:untie (?:the )?bandage|解开(?:绷带|布条))$/.test(text))return super.parse('take bandage');
    const clothing=text.match(/^(put on|take off) (?:the )?((?:burial )?shroud|bandage)$/);
    if (clothing)return super.parse((clothing[1]==='put on'?'wear ':'remove ')+clothing[2]);
    if (/^脱下裹尸布$/.test(text))return super.parse('remove shroud');
    if (/^(?:board (?:the )?(?:dory|boat)|登艇|登船|上船)$/.test(text))return super.parse('enter dory');
    if (/^(?:get out of (?:the )?(?:dory|boat)|离艇|下船)$/.test(text))return super.parse('exit dory');
    const symbol=text.match(/^(?:turn|rotate) (?:the )?(?:brass )?ring to (?:the )?(first|second|third|fourth|fifth|sixth|seventh) symbol$/);
    if(symbol)return {type:'compound',verb:'turn',noun:'ring',prep:'to',noun2:symbol[1]+' symbol'};
    const cnSymbol=text.match(/^(?:把)?(?:铜环|符号环)(?:转至|转到|对准)第([一二三四五六七])个?符号$/);
    if(cnSymbol)return {type:'compound',verb:'turn',noun:'ring',prep:'to',noun2:'第'+cnSymbol[1]+'个符号'};
    if(['压下拉杆','压下杆'].includes(text))return super.parse('push lever');
    if(['抬起拉杆','抬杆'].includes(text))return super.parse('pull lever');
    if (/^(?:put|insert|screw) (?:the )?gnomon (?:in|into) (?:the )?(?:sundial|dial|hole|socket)$/.test(text)
      || /^(?:把|将)?(?:日晷)?指针(?:装入|拧入|插入)(?:盘心|螺孔|孔中)$/.test(text)) return super.parse('put gnomon in hole');
    if (/^(?:拧下|旋下)(?:日晷)?指针$/.test(text)) return super.parse('unscrew gnomon');
    const command=super.parse(input);
    if(command)return command;
    const bog=parseBogAction(text);
    if(bog)return bog;
    if(/^(?:(?:touch|feel) (?:the )?walls?|(?:摸|触摸)(?:墙|墙壁|墙面))$/i.test(input.trim()))
      return {type:'simple',verb:'touch',noun:'wall'};
    return null;
  }
}

class ExplorationEngine extends GameEngine {
  moveTo(roomId,silent) {
    const backFromOrbit=this._inputBusy && this.state.room==='orbit_satellite' && roomId==='waterfall' && this.rooms[roomId];
    if(backFromOrbit){
      this.state.setFlag('waterfall_door_spent');
      completeProjectedReturn(this.state);
    }
    super.moveTo(roomId,silent);
    if(backFromOrbit && !silent)this.print('The white door fades away into the texture of the toadstool.\n\n白门渐渐隐入毒菌的纹理，消失了。');
  }

  describeRoom() {
    if (this.state.room==='top_of_arbor' && !arborLight(this.state)) {
      this.ui.location('Darkness','黑暗');
      this.print(unlitArbor);
      return;
    }
    super.describeRoom();
  }

  async deserialize(save) {
    await super.deserialize(save);
    restoreLantern(this.state);
    // Before this flag existed, escaping orbit was the only action that
    // destroyed the bubble. A player still in orbit keeps their return route.
    if(this.state.chapter!=='orbit' && this.state.hasFlag('wabe_to_orbit_used') && this.state.itemAt('soap_bubble')==='destroyed')
      this.state.setFlag('waterfall_door_spent');
    if(this.state.chapter==='underground')initializeUndergroundItems(this.state);
    restoreBogLog(this.state,save.state);
    restoreGardenMoves(this.state);
    restorePaperback(this.state,save.state);
    restoreVertexInstallation(this.state,save.state);
    restoreShadow(this.state);
    restoreRoadrunner(this.state);
    if (['the_river','sand_bar'].includes(this.state.room)) startFerry(this.state);
    return true;
  }

  async _runCommandTurn(command) {
    const state = this.state;
    this._shadowTurnStart=state.turns;
    this._birdDoorOpenAtStart=birdAtOpenDoor(state);
    const water = freeFallsDirection(state.room,command?.dir) || freeWaterfallObservation(state,command);
    if (water) { this.print(water); return true; }
    const invisible=freeProjectedAction(state,command);
    if(invisible){this.print(invisible);return true;}
    if(['ossuary','underground_3','underground_1'].includes(state.room)) {
      const {freeUndergroundAction}=await import('./underground-story.js');
      const free=freeUndergroundAction(state,command);
      if(free?.text){this.print(free.text);return true;}
      if(free?.dir){await this._handleDirection(free.dir);this._autosave();return true;}
    }
    const bog=freeBogAction(state,command);
    if(bog){this.print(bog);return true;}
    const arbor=freeArborAction(state,command,this.items);
    if (arbor) {
      this.print(arbor.text);
      if (arbor.save) this._autosave();
      return true;
    }
    const lampRefusal=freeLanternAction(state,lanternAction(state,command));
    if(lampRefusal){this.print(lampRefusal);return true;}
    if (state.room==='assembly_room' || state.room==='closet') {
      const {closetFreeResponse}=await import('./ranch-closet-story.js');
      const notice=closetFreeResponse(state,command);
      if(notice){this.print(notice);return true;}
    }
    const action=paperbackAction(command,state);
    if (action) {
      const absent=unavailablePaperback(state,action);
      if (absent) { this.print(absent); return true; }
    }
    const birdAction=roadrunnerAction(state,command);
    const birdRefusal=missingRoadrunnerTarget(state,birdAction,command);
    if(birdRefusal) {this.print(birdRefusal);return true;}
    if (command?.type==='direction' && command.dir==='out' && state.room==='shack') {
      this.print('[Which way do you want to go out?]\n\n[你想往哪个方向出去？]');
      return true;
    }
    if (command && (state.room === 'the_river' || state.room === 'sand_bar')) {
      const view = ferryView(state);
      if (state.room === 'sand_bar' && !view.fixedBerth) {
        const missing = missingSandbarFeature(command);
        if (missing) { this.print(missing); return true; }
      }
      if (command.type === 'direction') {
        const direction = command.dir;
        // The Z-machine's bare IN/OUT are direction routines. They can change
        // the player's seat without spending the move that ENTER/EXIT DORY uses.
        if (direction === 'out' && !(state.room === 'sand_bar' && view.legacyPaid)) {
          if (view.onboard) { leaveFerry(state,this); this._autosave(); }
          else this.print('[Which way do you want to go out?]\n\n[你想往哪个方向出去？]');
          return true;
        }
        if (direction === 'in' && !(state.room === 'the_river' && view.legacyPaid)) {
          if (!view.visible) this.print('[Which way do you want to go in?]\n\n[你想往哪个方向进去？]');
          else {
            this.print('[into the dory]\n\n[进入平底船]');
            await this._handleAction({type:'simple',verb:'enter',noun:'dory'});
            if (!view.onboard && ferryView(state).onboard) state.setCnt('river_ferry_patience',3);
            this._autosave();
          }
          return true;
        }
      } else if (!view.visible) {
        const target = unseenFerryTarget(command);
        if (target) {
          this.print("You can't see any "+target+" here.\n\n你在这里看不见"+(target==='dory'?'平底船':'船夫')+'。');
          return true;
        }
      }
    }
    this._prologueTurn=beginPrologueTurn(state);
    try { return await super._runCommandTurn(command); }
    finally { this._prologueTurn=null; }
  }

  _autosave() {
    // The room and timer have settled by this point. The auto-save and the
    // visible state must include the same number of completed clock cycles.
    finishPrologueTurn(this.state,this._prologueTurn);
    super._autosave();
  }

  async _handleAction(command) {
    const lamp=lanternAction(this.state,command);
    if(lamp)return handleLantern(this.state,this,lamp);
    const birdAction=roadrunnerAction(this.state,command);
    if(birdAction) {
      performRoadrunnerAction(this.state,this,birdAction,command);
      return true;
    }
    const action=paperbackAction(command,this.state);
    if (action) {
      handlePaperback(this.state,this,action);
      return true;
    }
    const upstairs=this.state.room==='top_of_arbor';
    const oldAxeLocation=upstairs && this.state.itemAt('axe');
    const handled=await super._handleAction(command);
    if (upstairs && this.state.itemAt('axe')!==oldAxeLocation) this.state.setFlag('arbor_axe_moved');
    if(handled) recordSceneryFocus(this.state,command);
    return handled;
  }

  _handleMetaCmd(command) {
    if(command==='wait'){
      const projected=projectedWaitMoves(this.state);
      const lamp=lanternWaitMoves(this.state);
      let moves=projected ?? lamp;
      if(projected!==null && this.state.hasFlag('lantern_on') && this.state.room!=='waterfall')moves=Math.min(moves,lamp);
      this.state.turns+=moves-1;
    }
    if(command==='wait' && !this.currentRoom().onWait && roadrunnerWait(this.state)) this.state.turns++;
    return super._handleMetaCmd(command);
  }

  _handleMeta(input) {
    // The shared text entry point precharges raw meta commands. On the
    // recorded bird route, checking one's score or pockets costs no move.
    const birdRoute=this.state.hasFlag('river_ferry_crossed') && ['islet','desert','ranch'].includes(this.state.chapter);
    const awaitingRanchEnding=this.state.chapter==='ranch' && this.state.hasFlag('ranch_snake_bitten');
    const inArbor=this.state.chapter==='wabe' && ['arboretum','north_arbor','south_arbor','top_of_arbor','trellises'].includes(this.state.room);
    const lampRoute=this.state.itemAt('lantern') && this.state.itemAt('lantern')!=='destroyed';
    const localFreeChecks=['ossuary','waterfall','underground_3','cemetery','cottage'].includes(this.state.room);
    if(this.state.chapter==='prologue' || ((birdRoute || awaitingRanchEnding || inArbor || lampRoute || localFreeChecks)
      && ['i','inventory','score','物品','背包','分数'].includes(input.toLowerCase()))) this.state.turns--;
    return super._handleMeta(input);
  }

  async _handleDirection(dir) {
    if(this.state.room==='orbit_satellite' && dir==='out' && this.state.has('axe') && !(await this.activateChapter('wabe')))return false;
    if(this.state.room==='waterfall' && dir==='in' && waterfallDoorView(this.state).open && this.state.has('soap_bubble')){
      if(!(await this.activateChapter('orbit')))return false;
    }
    if(this.state.room==='ossuary' || this.state.room==='underground_3') {
      const {undergroundCrossingChapter}=await import('./underground-story.js');
      const to=undergroundCrossingChapter(this.state,dir);
      if(to && !(await this.activateChapter(to)))return false;
    }
    if (this.state.room==='shack' && dir==='e') {
      const {approachShackDoor}=await import('./shack-story.js');
      approachShackDoor(this.state,this);
      return true;
    }
    if (this.state.room==='islet' && dir==='in') return this._handleAction({type:'simple',verb:'enter',noun:'door'});
    const view = ferryView(this.state);
    if (view.legacyPaid && this.state.room === 'the_river' && dir === 'in') {
      return this.transitionChapter({to:'islet',roomCandidates:['islet']});
    }
    if (view.legacyPaid && this.state.room === 'sand_bar' && dir === 'out') {
      return this.transitionChapter({to:'wabe',roomCandidates:['the_river']});
    }
    if (view.onboard) {
      this.print("You couldn't do that while you're in the dory.\n\n你还在船上，没法往那里走。");
      return true;
    }
    const flipped=this.state.flipped, carried=this.state.has('gnomon');
    const moved=await super._handleDirection(dir);
    recordVertexMirrorCrossing(this.state,flipped,carried);
    return moved;
  }

  _postTurn() {
    if (this.state.chapter==='wabe') initializeShadow(this.state);
    const islandWasOpen=this._birdDoorOpenAtStart || birdAtOpenDoor(this.state);
    const before=vertexShadowView(this.state), moves=Math.max(1,this.state.turns-this._shadowTurnStart);
    advanceShadow(this.state,moves);
    fadeUndergroundDoor(this.state,this,before,moves);
    reportProjectedMotion(this.state,this,before,moves);
    advanceFerry(this.state,this);
    advanceRoadrunner(this.state,this,islandWasOpen);
    burnLantern(this.state,this,Math.max(0,this.state.turns-this._shadowTurnStart));
    // The original ends inside this room's turn handler, before posting the
    // pending move. Keep normal living turns and unrelated endings intact.
    const pendingRanchEnding=ranchCollapseDue(this.state);
    super._postTurn();
    if(pendingRanchEnding && this.state.dead) {
      this.state.setFlag(RANCH_RIVER_ENDING);
      this.state.turns=this._shadowTurnStart;
    }
  }
}

// The visual entry point has its own room dictionary. Lazy loading must not mutate
// the chapter module's exported ROOMS object or share state between sessions.
export function createPrologueSession({ ui, onAutosave } = {}) {
  const quietUi = Object.fromEntries(['text', 'system', 'inventory', 'location', 'userInput'].map(name => [name, () => {}]));
  let engine;
  engine = new ExplorationEngine({
    rooms: { ...ROOMS }, items: ITEMS, parser: new ExplorationParser(()=>engine?.state.room), embedding: null,
    ui: ui || quietUi, onAutosave, preloadedChapters: ['prologue'],
    chapterLoader: async chapterId => {
      // Keep chapter imports lazy and register timer callbacks before exposing
      // rooms. Restoring a cross-chapter save follows this same engine path.
      if (!Object.hasOwn(VISUAL_CHAPTER_LOADERS, chapterId)) return null;
      const chapter = await VISUAL_CHAPTER_LOADERS[chapterId]();
      engine.registerTimerHandlers(chapter.TIMERS);
      return chapter.ROOMS;
    },
  });
  engine.registerTimerHandlers(TIMERS);
  restoreLantern(engine.state);
  initializeBogLog(engine.state);
  initializeVertexInstallation(engine.state);
  initializeRoadrunner(engine.state);
  return engine;
}
