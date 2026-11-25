import { GameEngine } from '../js/engine.js';
import { ferryView, startFerry } from './ferry-state.js';
import { advanceFerry, leaveFerry } from './ferry-voyage.js';
import { unseenFerryTarget } from './ferry-shore.js';
import { Parser } from '../js/parser.js';
import { ITEMS } from '../js/data/items.js';
import { ROOMS, TIMERS } from '../js/data/prologue.js';

const VISUAL_CHAPTER_LOADERS = Object.freeze({
  wabe: () => import('./cemetery-story.js'),
  japan: () => import('../js/data/japan.js'),
  underground: () => import('../js/data/underground.js'),
  orbit: () => import('../js/data/orbit.js'),
  pacific: () => import('../js/data/pacific.js'),
  tundra: () => import('../js/data/tundra.js'),
  islet: async () => {
    const [islet, cemetery] = await Promise.all([import('./ferry-islet.js'),import('./cemetery-story.js')]);
    return {ROOMS:cemetery.withCemeteryItems(islet.ISLET_ROOMS)};
  },
  desert: () => import('../js/data/desert.js'),
  ranch: () => import('./ranch-story.js'),
});

class ExplorationParser extends Parser {
  parse(input){
    const text=input.trim().toLowerCase();
    if (/^用(?:小)?(?:铲子?|铁铲|锹)(?:撬开|打开)(?:石棺|棺盖)$/.test(text))
      return super.parse('open crypt with spade');
    if (/^(?:untie (?:the )?bandage|解开(?:绷带|布条))$/.test(text))return super.parse('take bandage');
    const clothing=text.match(/^(put on|take off) (?:the )?((?:burial )?shroud|bandage)$/);
    if (clothing)return super.parse((clothing[1]==='put on'?'wear ':'remove ')+clothing[2]);
    if (/^脱下裹尸布$/.test(text))return super.parse('remove shroud');
    if (/^(?:board (?:the )?(?:dory|boat)|登艇|登船|上船)$/.test(text))return super.parse('enter dory');
    if (/^(?:get out of (?:the )?(?:dory|boat)|离艇|下船)$/.test(text))return super.parse('exit dory');
    const command=super.parse(input);
    if(command)return command;
    if(/^(?:(?:touch|feel) (?:the )?walls?|(?:摸|触摸)(?:墙|墙壁|墙面))$/i.test(input.trim()))
      return {type:'simple',verb:'touch',noun:'wall'};
    return null;
  }
}

class ExplorationEngine extends GameEngine {
  async deserialize(save) {
    await super.deserialize(save);
    if (['the_river','sand_bar'].includes(this.state.room)) startFerry(this.state);
    return true;
  }

  async _runCommandTurn(command) {
    const state = this.state;
    if (command && (state.room === 'the_river' || state.room === 'sand_bar')) {
      const view = ferryView(state);
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
    return super._runCommandTurn(command);
  }

  async _handleDirection(dir) {
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
    return super._handleDirection(dir);
  }

  _postTurn() {
    advanceFerry(this.state,this);
    super._postTurn();
  }
}

// The visual entry point has its own room dictionary. Lazy loading must not mutate
// the chapter module's exported ROOMS object or share state between sessions.
export function createPrologueSession({ ui, onAutosave } = {}) {
  const quietUi = Object.fromEntries(['text', 'system', 'inventory', 'location', 'userInput'].map(name => [name, () => {}]));
  let engine;
  engine = new ExplorationEngine({
    rooms: { ...ROOMS }, items: ITEMS, parser: new ExplorationParser(), embedding: null,
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
  return engine;
}
