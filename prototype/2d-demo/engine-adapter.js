import { GameEngine } from '../js/engine.js';
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
    const [islet, cemetery] = await Promise.all([import('../js/data/islet.js'),import('./cemetery-story.js')]);
    return {...islet,ROOMS:cemetery.withCemeteryItems(islet.ROOMS)};
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
    const command=super.parse(input);
    if(command)return command;
    if(/^(?:(?:touch|feel) (?:the )?walls?|(?:摸|触摸)(?:墙|墙壁|墙面))$/i.test(input.trim()))
      return {type:'simple',verb:'touch',noun:'wall'};
    return null;
  }
}

// The visual entry point has its own room dictionary. Lazy loading must not mutate
// the chapter module's exported ROOMS object or share state between sessions.
export function createPrologueSession({ ui, onAutosave } = {}) {
  const quietUi = Object.fromEntries(['text', 'system', 'inventory', 'location', 'userInput'].map(name => [name, () => {}]));
  let engine;
  engine = new GameEngine({
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
