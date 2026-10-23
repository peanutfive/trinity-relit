import { ROOMS } from '../js/data/prologue.js';

export const PAPER_CRAFT_ID = 'round_pond:paper-craft';
const ROOM = 'round_pond';
const ANCHOR = Object.freeze({ x: 300, y: 176 });

// Query the existing description through a minimal, read-only view. The
// difference consists of whole original paragraphs, including both languages.
function originalDiscoveryParagraphs() {
  const view = identified => Object.freeze({
    inRoom: id => id === 'paper_bird',
    hasFlag: flag => flag === 'seen_paper_bird' && identified,
  });
  const paragraphs = text => text.split(/\n\s*\n/).map(part => part.trim()).filter(Boolean);
  const known = new Set(paragraphs(ROOMS[ROOM].desc(view(true))));
  return Object.freeze(paragraphs(ROOMS[ROOM].desc(view(false))).filter(part => !known.has(part)));
}

const DISCOVERY_PARAGRAPHS = originalDiscoveryParagraphs();
const DISCOVERY_TEXT = DISCOVERY_PARAGRAPHS.join('\n\n');
const DISCOVERY_PARAGRAPH_SET = new Set(DISCOVERY_PARAGRAPHS);
const isAtPond = state => state?.room === ROOM && state.inRoom('paper_bird');
const isCraft = object => object.id === `${ROOM}:boats`
  || object.id === 'item:paper_bird' || object.id === PAPER_CRAFT_ID || object.itemId === 'paper_bird';

/**
 * Player knowledge for the 2D presentation, independent of GameState flags.
 * For an observation: filter the engine output first, then call inspect only
 * after the command succeeded, and append its returned text once.
 */
export function createDiscovery(saved) {
  let observed = new Set();
  let identified = new Set();

  function snapshot() {
    return { observed: [...observed], identified: [...identified] };
  }

  function restore(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const valid = list => Array.isArray(list) && list.every(id => id === PAPER_CRAFT_ID);
    if (!valid(value.observed) || !valid(value.identified)) return false;
    const nextObserved = new Set(value.observed);
    const nextIdentified = new Set(value.identified);
    if ([...nextIdentified].some(id => !nextObserved.has(id))) return false;
    observed = nextObserved;
    identified = nextIdentified;
    return true;
  }

  function mapHotspots(state, objects) {
    if (state.room !== ROOM) return objects;
    const first = objects.findIndex(isCraft);
    const result = objects.filter(object => !isCraft(object));
    if (!isAtPond(state)) return result;
    const source = objects.find(object => object.itemId === 'paper_bird')
      || objects.find(isCraft) || {};
    const known = identified.has(PAPER_CRAFT_ID);
    const actions = [{ label: known ? '观察折纸鸟' : '观察小船', command: 'examine boats' }];
    if (known) actions.push({ label: '伸手拿取', command: 'take paper bird' });
    const craft = {
      ...source, id: PAPER_CRAFT_ID, ...ANCHOR,
      label: known ? '折纸鸟' : '白色的小船', kind: known ? 'paper_bird' : 'paper_boat',
      eventId: 'examine_boats', itemId: 'paper_bird', radius: source.radius ?? 37, actions,
    };
    result.splice(first < 0 ? result.length : first, 0, craft);
    return result;
  }

  function filterOutput(text, state) {
    if (state.room !== ROOM || identified.has(PAPER_CRAFT_ID) || typeof text !== 'string') return text;
    const paragraphs = text.split(/\n\s*\n/);
    const kept = paragraphs.filter(part => !DISCOVERY_PARAGRAPH_SET.has(part.trim()));
    return kept.length === paragraphs.length ? text : kept.join('\n\n').trim();
  }

  function inspect(state, { command, success = false } = {}) {
    const empty = { ok: false, newlyIdentified: false, id: PAPER_CRAFT_ID, text: '' };
    if (command !== 'examine boats' || success !== true || !isAtPond(state) || !DISCOVERY_TEXT) return empty;
    observed.add(PAPER_CRAFT_ID);
    const newlyIdentified = !identified.has(PAPER_CRAFT_ID);
    identified.add(PAPER_CRAFT_ID);
    return { ok: true, newlyIdentified, id: PAPER_CRAFT_ID, text: newlyIdentified ? DISCOVERY_TEXT : '' };
  }

  if (saved !== undefined) restore(saved);
  return Object.freeze({ snapshot, restore, mapHotspots, filterOutput, inspect });
}
