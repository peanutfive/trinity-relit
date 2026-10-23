import { GameEngine } from '../js/engine.js';
import { Parser } from '../js/parser.js';
import { ITEMS } from '../js/data/items.js';
import { ROOMS, TIMERS } from '../js/data/prologue.js';

// The visual entry point has its own room dictionary. Lazy loading must not mutate
// the chapter module's exported ROOMS object or share state between sessions.
export function createPrologueSession({ ui, onAutosave } = {}) {
  const quietUi = Object.fromEntries(['text', 'system', 'inventory', 'location', 'userInput'].map(name => [name, () => {}]));
  let engine;
  engine = new GameEngine({
    rooms: { ...ROOMS }, items: ITEMS, parser: new Parser(), embedding: null,
    ui: ui || quietUi, onAutosave, preloadedChapters: ['prologue'],
    chapterLoader: async chapterId => {
      // Wabe is loaded lazily. Other chapters remain outside this visual slice.
      if (chapterId !== 'wabe') return null;
      const chapter = await import('../js/data/wabe.js');
      engine.registerTimerHandlers(chapter.TIMERS);
      return chapter.ROOMS;
    },
  });
  engine.registerTimerHandlers(TIMERS);
  return engine;
}
