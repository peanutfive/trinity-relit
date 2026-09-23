// Optional, transport-free intent boundary. Nothing here opens a connection,
// reads credentials, or enables a provider in the browser entry point.

export const INTENT_LIMITS = Object.freeze({
  input: 240, candidates: 16, manifest: 128, objects: 32,
  id: 80, label: 120, intent: 200, timeoutMs: 5000,
});

const GENERIC_VERBS = new Set(["take", "drop", "examine"]);
const ID = /^[a-zA-Z0-9_.:-]+$/;

function record(value) {
  return value !== null && typeof value === "object" &&
    Object.getPrototypeOf(value) === Object.prototype;
}

function keysAre(value, keys) {
  return record(value) && Object.keys(value).length === keys.length &&
    keys.every((key) => Object.hasOwn(value, key));
}

function bounded(value, max) {
  return typeof value === "string" && value.length > 0 && value.length <= max;
}

function validId(value) {
  return bounded(value, INTENT_LIMITS.id) && ID.test(value);
}

function freeze(value) {
  if (value && typeof value === "object") {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

function copyCommand(command) {
  const fields = command?.type === "simple" ? ["type", "verb", "noun"] :
    ["type", "verb", "noun", "prep", "noun2"];
  if (!keysAre(command, fields) || !["simple", "compound"].includes(command.type) ||
      !fields.slice(1).every((key) => bounded(command[key], INTENT_LIMITS.label))) {
    throw new TypeError("Intent commands must be one explicit simple or compound action.");
  }
  return Object.fromEntries(fields.map((key) => [key, command[key]]));
}

function copyCandidate(candidate) {
  if (!keysAre(candidate, ["id", "roomId", "intent", "action"]) ||
      !validId(candidate.id) || !validId(candidate.roomId) ||
      !bounded(candidate.intent, INTENT_LIMITS.intent)) {
    throw new TypeError("Invalid local intent candidate.");
  }
  const action = candidate.action;
  let copy;
  if (keysAre(action, ["kind", "eventId", "command"]) && action.kind === "event" &&
      validId(action.eventId)) {
    copy = { kind: "event", eventId: action.eventId, command: copyCommand(action.command) };
  } else if (keysAre(action, ["kind", "verb", "itemId"]) && action.kind === "generic" &&
      GENERIC_VERBS.has(action.verb) && validId(action.itemId)) {
    copy = { kind: "generic", verb: action.verb, itemId: action.itemId };
  } else {
    throw new TypeError("Intent actions must bind an existing event or generic item action.");
  }
  return freeze({ id: candidate.id, roomId: candidate.roomId, intent: candidate.intent, action: copy });
}

function matchingEvent(engine, command) {
  return (engine.currentRoom()?.events || []).find((event) =>
    (!event.when || event.when(engine.state)) && event.match &&
    engine._matchCommand(command, event.match));
}

// Read-only interpretation check: a known but blocked request must keep its
// deterministic response, including attempts to take unreachable objects.
export function classifyDeterministicIntent(engine, command) {
  if (!command) return "unresolved";
  if (command.type === "direction" || command.type === "meta") return "resolved";
  if (!["simple", "compound"].includes(command.type)) return "unresolved";
  if (matchingEvent(engine, command)) return "resolved";
  if (GENERIC_VERBS.has(command.verb)) {
    if (!command.noun) return "resolved";
    const id = engine._resolveItem(command.noun);
    if (id) return engine.state.has(id) || engine.state.inRoom(id) ? "resolved" : "blocked";
  }
  if (command.verb === "climb" ||
      (["push", "move"].includes(command.verb) && engine._looksLikePram(command.noun))) {
    return "blocked";
  }
  const inactiveMatch = (engine.currentRoom()?.events || []).some((event) =>
    event.match && engine._matchCommand(command, event.match));
  return inactiveMatch ? "blocked" : "unresolved";
}

function bindCandidate(engine, candidate) {
  if (candidate.roomId !== engine.state.room || engine.state.dead) return null;
  const action = candidate.action;
  const command = action.kind === "event" ? action.command :
    { type: "simple", verb: action.verb, noun: action.itemId };
  const event = matchingEvent(engine, command);
  if (action.kind === "event") {
    // Reuse actual dispatch order; a shadowed or ineligible event is not legal.
    if (!event || event.id !== action.eventId) return null;
  } else {
    if (event || !Object.hasOwn(engine.items, action.itemId)) return null;
    const available = action.verb === "drop" ? engine.state.has(action.itemId) :
      engine.state.has(action.itemId) || engine.state.inRoom(action.itemId);
    if (!available) return null;
  }
  return { candidate, command };
}

function sceneSnapshot(engine) {
  const room = engine.currentRoom();
  if (!room || !validId(engine.state.room) ||
      !bounded(room.name, INTENT_LIMITS.label) || !bounded(room.cn, INTENT_LIMITS.label)) return null;
  const visible = engine.state.roomItems();
  const inventory = engine.state.inventoryList().map(({ id }) => id);
  if (visible.length + inventory.length > INTENT_LIMITS.objects) return null;
  const objects = (ids) => ids.map((id) => {
    const item = engine.items[id];
    if (!validId(id) || !item || !bounded(item.cn, INTENT_LIMITS.label)) {
      throw new TypeError("Invalid scene object.");
    }
    return { id, label: item.cn };
  });
  // No transcript, descriptions, flags, score, hidden locations, event bodies,
  // aliases, saved state, account data, or provider error text crosses this line.
  return { room: { id: engine.state.room, name: room.name, cn: room.cn },
    visible: objects(visible), inventory: objects(inventory) };
}

function validChoice(choice, token) {
  if (!record(choice) || choice.requestToken !== token) return false;
  if (choice.decision === "action") {
    return keysAre(choice, ["requestToken", "decision", "candidateId"]) && validId(choice.candidateId);
  }
  return ["none", "ask_user"].includes(choice.decision) &&
    keysAre(choice, ["requestToken", "decision"]);
}

export class ContextualIntentBoundary {
  constructor({ select, candidates = [], timeoutMs = INTENT_LIMITS.timeoutMs } = {}) {
    if (typeof select !== "function" || !Array.isArray(candidates) ||
        candidates.length > INTENT_LIMITS.manifest || !Number.isInteger(timeoutMs) ||
        timeoutMs < 1 || timeoutMs > INTENT_LIMITS.timeoutMs) {
      throw new TypeError("Invalid contextual intent configuration.");
    }
    this.select = select;
    this.candidates = candidates.map(copyCandidate);
    if (new Set(this.candidates.map(({ id }) => id)).size !== this.candidates.length) {
      throw new TypeError("Intent candidate IDs must be unique.");
    }
    this.timeoutMs = timeoutMs;
    this.sequence = 0;
    this.pending = null;
    this.tail = Promise.resolve();
    this.functionIds = new WeakMap();
    this.nextFunctionId = 0;
  }

  run(input, process) {
    const token = ++this.sequence;
    this.pending?.abort();
    // Opt-in only: serialize the complete turn, including deterministic async
    // events. A newer submission cancels selection, then waits for settlement.
    const result = this.tail.then(() => process(input, token));
    this.tail = result.catch(() => {});
    return result;
  }

  _stamp(engine) {
    // Private comparison only; never sent to select(). Include custom state
    // fields and mutable room/item definitions, not just room and turn count.
    const stack = new Set();
    const encode = (value) => {
      if (typeof value === "function") {
        if (!this.functionIds.has(value)) this.functionIds.set(value, ++this.nextFunctionId);
        return ["function", this.functionIds.get(value)];
      }
      if (value === null || typeof value !== "object") return [typeof value, String(value)];
      if (stack.has(value)) throw new TypeError("Cyclic intent state.");
      stack.add(value);
      let result;
      if (value instanceof Set) result = ["set", [...value].map(encode)];
      else if (Array.isArray(value)) result = ["array", value.map(encode)];
      else result = ["object", Object.keys(value).sort().map((key) => [key, encode(value[key])])];
      stack.delete(value);
      return result;
    };
    return JSON.stringify(encode([engine.state, engine.currentRoom(), engine.items]));
  }

  async _select(request) {
    const controller = new AbortController();
    this.pending = controller;
    let timer;
    const cancelled = new Promise((resolve) => {
      controller.signal.addEventListener("abort", () => resolve(null), { once: true });
      timer = setTimeout(() => controller.abort(), this.timeoutMs);
    });
    try {
      // Convert synchronous throws and late rejections to a safe abstention.
      const selected = Promise.resolve().then(() => this.select(request, { signal: controller.signal }));
      return await Promise.race([selected, cancelled]);
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
      controller.abort();
      if (this.pending === controller) this.pending = null;
    }
  }

  async tryHandle(engine, input, token) {
    let request, bindings, state, room, stamp, choice;
    try {
      if (token !== this.sequence || engine.state.dead || input.length > INTENT_LIMITS.input) return false;
      bindings = this.candidates.map((candidate) => bindCandidate(engine, candidate)).filter(Boolean);
      // Do not silently truncate a scene/candidate set or the user's intent.
      if (!bindings.length || bindings.length > INTENT_LIMITS.candidates) return false;
      const scene = sceneSnapshot(engine);
      if (!scene) return false;
      state = engine.state;
      room = engine.currentRoom();
      stamp = this._stamp(engine);
      request = freeze({ schemaVersion: 1, requestToken: token, utterance: input, scene,
        candidates: bindings.map(({ candidate }) => ({ id: candidate.id, intent: candidate.intent })) });
      choice = await this._select(request);
      if (!validChoice(choice, token) || token !== this.sequence || engine.state !== state ||
          engine.currentRoom() !== room || this._stamp(engine) !== stamp) return false;
      if (choice.decision === "none") return false;
      if (choice.decision === "ask_user") {
        engine.ui.system("请说明你想做的一个动作，并说清目标和使用的物品。");
        return true;
      }
      const original = bindings.find(({ candidate }) => candidate.id === choice.candidateId);
      if (!original) return false;
      // Recheck prerequisites and dispatch order immediately before execution.
      const current = bindCandidate(engine, original.candidate);
      if (!current || token !== this.sequence || this._stamp(engine) !== stamp) return false;
    } catch {
      // Only preparation/provider/validation failures fall back. Execution is
      // deliberately outside this catch: a partially executed event must not retry.
      return false;
    }
    const binding = bindings.find(({ candidate }) => candidate.id === choice.candidateId);
    return await engine._handleParsed(binding.command);
  }
}
