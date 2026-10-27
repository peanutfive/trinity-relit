import { GameEngine } from '../js/engine.js';
import { Parser } from '../js/parser.js';
import { ITEMS } from '../js/data/items.js';
import { ROOMS, TIMERS } from '../js/data/prologue.js';

const VISUAL_CHAPTER_LOADERS = Object.freeze({
  wabe: () => import('../js/data/wabe.js'),
  japan: () => import('../js/data/japan.js'),
});

// The visual entry point has its own room dictionary. Lazy loading must not mutate
// the chapter module's exported ROOMS object or share state between sessions.
export function createPrologueSession({ ui, onAutosave } = {}) {
  const quietUi = Object.fromEntries(['text', 'system', 'inventory', 'location', 'userInput'].map(name => [name, () => {}]));
  let engine;
  engine = new GameEngine({
    rooms: { ...ROOMS }, items: ITEMS, parser: new Parser(), embedding: null,
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
