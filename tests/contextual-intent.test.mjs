import assert from "node:assert/strict";
import test from "node:test";
import { GameEngine } from "../prototype/js/engine.js";
import { Parser } from "../prototype/js/parser.js";
import { INTENT_LIMITS, classifyDeterministicIntent } from "../prototype/js/contextual-intent.js";
import { stubUi } from "./harness.mjs";

const takeBall = {
  id: "take_ball", roomId: "palace_gate", intent: "Pick up the visible ball / 拿起足球",
  action: { kind: "generic", verb: "take", itemId: "ball" },
};
const takeUmbrella = {
  id: "try_umbrella", roomId: "palace_gate", intent: "Try to take the unreachable umbrella / 尝试拿伞",
  action: { kind: "event", eventId: "take_umbrella", command: { type: "simple", verb: "take", noun: "umbrella" } },
};
const useBall = {
  id: "throw_ball", roomId: "palace_gate", intent: "Throw the carried ball at the tree / 向树扔球",
  action: { kind: "event", eventId: "throw_ball", command: {
    type: "compound", verb: "throw", noun: "ball", prep: "at", noun2: "tree",
  } },
};
const candidateList = [takeBall, takeUmbrella, useBall];
const action = (request, candidateId = "take_ball") => ({ requestToken: request.requestToken, decision: "action", candidateId });
const abstain = (request, decision = "none") => ({ requestToken: request.requestToken, decision });

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function makeGame(select, options = {}) {
  const output = [];
  const room = {
    name: "Palace Gate", cn: "宫门", desc: "SCENE_DESCRIPTION_MUST_STAY_LOCAL", exits: { n: "garden" },
    onTurn: (state) => state.inc("room_ticks"),
    events: [
      { id: "take_umbrella", match: { verb: "take", noun: "umbrella" }, text: "伞太高，够不着。" },
      { id: "throw_ball", match: { verb: "throw", noun: "ball", prep: "at", noun2: "tree" },
        when: (state) => state.has("ball"),
        act: (state) => { state.inc("throws"); state.destroy("ball"); }, text: "扔出了足球。" },
    ],
  };
  const config = {
    rooms: { palace_gate: room, garden: { name: "Garden", cn: "花园", desc: "Garden", exits: { s: "palace_gate" },
      onTurn: (state) => state.inc("garden_ticks") } },
    items: { ball: { cn: "足球", aliases: ["ball", "球"], start: "palace_gate", desc: "A ball" },
      umbrella: { cn: "雨伞", aliases: ["umbrella", "伞"], start: "tree_top" },
      coin: { cn: "硬币", aliases: ["coin"], start: "pocket" },
      secret: { cn: "HIDDEN_SECRET", start: "hidden_room", desc: "PRIVATE_PUZZLE" } },
    parser: new Parser(), embedding: { findMatch() { throw new Error("Embedding must stay disabled"); } },
    ui: stubUi(output),
  };
  if (select) config.contextualIntent = { select, candidates: candidateList, ...options };
  const eng = new GameEngine(config);
  eng.state.startTimer(20, "test_clock", (state) => state.inc("timer_ticks"));
  return { eng, state: eng.state, output };
}

function hasUnrecognized(game) {
  return game.output.some(({ text }) => text.includes("这句话无法识别"));
}

function assertOneTurn(game) {
  assert.equal(game.state.turns, 1);
  assert.equal(game.state.cnt("room_ticks"), 1);
  assert.equal(game.state.cnt("timer_ticks"), 1);
  assert.equal(game.state.timer.remaining, 19);
}

test("default engine remains deterministic, keyless, and does not invoke a selector", async () => {
  const game = makeGame();
  await game.eng.processInput("please retrieve that round thing");
  assert.equal(game.eng.contextualIntent, null);
  assert.equal(game.state.has("ball"), false);
  assert.ok(hasUnrecognized(game));
  assertOneTurn(game);
});

test("bounded immutable snapshot exposes only the utterance and allowlisted visible context", async () => {
  let request;
  const game = makeGame((value) => { request = value; return action(value); });
  game.state.setFlag("PRIVATE_FLAG");
  game.state.customPrivate = "PRIVATE_NOTE";
  await game.eng.processInput("retrieve the round thing");
  assert.deepEqual(Object.keys(request), ["schemaVersion", "requestToken", "utterance", "scene", "candidates"]);
  assert.deepEqual(request.scene, {
    room: { id: "palace_gate", name: "Palace Gate", cn: "宫门" },
    visible: [{ id: "ball", label: "足球" }], inventory: [{ id: "coin", label: "硬币" }],
  });
  assert.deepEqual(request.candidates.map(({ id }) => id), ["take_ball", "try_umbrella"]);
  assert.ok(Object.isFrozen(request) && Object.isFrozen(request.scene.visible[0]) && Object.isFrozen(request.candidates));
  assert.throws(() => { request.scene.room.id = "garden"; }, TypeError);
  assert.doesNotMatch(JSON.stringify(request), /PRIVATE|HIDDEN|SCENE_DESCRIPTION|tree_top|eventId|command|score|turns/);
  assert.equal(game.state.has("ball"), true);
  assertOneTurn(game);
});

test("unknown parsed noun can reach selection before generic examine masks it", async () => {
  let calls = 0;
  const game = makeGame((request) => { calls++; return action(request); });
  await game.eng.processInput("examine round thing");
  assert.equal(calls, 1);
  assert.equal(game.state.has("ball"), true);
  assertOneTurn(game);
});

test("resolved actions and blocked attempts never ask the selector for a different action", async () => {
  let calls = 0;
  const game = makeGame((request) => { calls++; return action(request); });
  assert.equal(classifyDeterministicIntent(game.eng, game.eng.parser.parse("throw ball at tree")), "blocked");
  for (const input of ["take umbrella", "examine secret", "throw ball at tree", "s", "climb tree", "help", "i", "score", "look"]) {
    await game.eng.processInput(input);
  }
  assert.equal(calls, 0);
  assert.equal(game.state.has("ball"), false);
  assert.equal(game.state.cnt("throws"), 0);
  assert.ok(game.output.some(({ text }) => text === "伞太高，够不着。"));
  assert.equal(game.state.turns, 9);
  assert.equal(game.state.cnt("timer_ticks"), 6); // help/inventory/score retain existing no-post-turn rules.
});

test("a failed-attempt event remains a valid candidate and does not solve the puzzle", async () => {
  const game = makeGame((request) => action(request, "try_umbrella"));
  await game.eng.processInput("reach for the object in the tree");
  assert.equal(game.state.has("umbrella"), false);
  assert.equal(game.state.cnt("throws"), 0);
  assert.equal(game.output.filter(({ text }) => text === "伞太高，够不着。").length, 1);
  assertOneTurn(game);
});

for (const [name, provider] of [
  ["unknown candidate", (request) => action(request, "teleport_and_win")],
  ["ineligible candidate", (request) => action(request, "throw_ball")],
  ["wrong token", (request) => ({ ...action(request), requestToken: request.requestToken + 1 })],
  ["injected command", (request) => ({ ...action(request), command: "take secret" })],
  ["multiple actions", (request) => [action(request), action(request)]],
  ["provider prose", () => "take_ball"],
  ["provider error", () => { throw new Error("PRIVATE_PROVIDER_ERROR"); }],
  ["provider rejection", () => Promise.reject(new Error("PRIVATE_PROVIDER_ERROR"))],
  ["none", (request) => abstain(request)],
]) {
  test(`${name} safely retains the deterministic unrecognized result`, async () => {
    const game = makeGame(provider);
    await game.eng.processInput("unmapped utterance");
    assert.equal(game.state.has("ball"), false);
    assert.equal(game.state.cnt("throws"), 0);
    assert.ok(hasUnrecognized(game));
    assert.doesNotMatch(JSON.stringify(game.output), /PRIVATE_PROVIDER_ERROR/);
    assertOneTurn(game);
  });
}

test("provider failure preserves the original parsed generic failure response", async () => {
  const game = makeGame(() => { throw new Error("offline"); });
  await game.eng.processInput("examine round thing");
  assert.equal(hasUnrecognized(game), false);
  assert.ok(game.output.some(({ text }) => text === "你没有看到那样东西。"));
  assertOneTurn(game);
});

test("ask_user uses fixed local text without advancing a turn or timer", async () => {
  const game = makeGame((request) => abstain(request, "ask_user"));
  await game.eng.processInput("do something with it");
  assert.equal(game.state.has("ball"), false);
  assert.equal(hasUnrecognized(game), false);
  assert.ok(game.output.some(({ text }) => text.includes("请说明你想做的一个动作")));
  assert.equal(game.state.turns, 0);
  assert.equal(game.state.cnt("timer_ticks"), 0);
  assert.equal(game.state.cnt("room_ticks"), 0);
});

for (const [name, mutate] of [
  ["room", (game) => { game.state.room = "garden"; }],
  ["turn", (game) => { game.state.turns++; }],
  ["inventory", (game) => game.state.moveItem("coin", "garden")],
  ["flag", (game) => game.state.setFlag("changed")],
  ["custom state", (game) => { game.state.extra = { revision: 2 }; }],
  ["timer", (game) => { game.state.timer.remaining--; }],
  ["event implementation", (game) => { game.eng.currentRoom().events[0].text = "replacement"; }],
]) {
  test(`stale ${name} invalidates a delayed response`, async () => {
    const ready = deferred(), response = deferred();
    const game = makeGame((request) => { ready.resolve(request); return response.promise; });
    const turn = game.eng.processInput("unmapped utterance");
    const request = await ready.promise;
    mutate(game);
    response.resolve(action(request));
    await turn;
    assert.equal(game.state.has("ball"), false);
    assert.ok(hasUnrecognized(game));
    assert.equal(game.state.cnt("timer_ticks"), 1);
  });
}

test("an event prerequisite changed outside GameState is rechecked before execution", async () => {
  let eligible = true;
  const ready = deferred(), response = deferred();
  const game = makeGame((request) => { ready.resolve(request); return response.promise; });
  game.eng.currentRoom().events[0].when = () => eligible;
  const turn = game.eng.processInput("reach for it");
  const request = await ready.promise;
  assert.ok(request.candidates.some(({ id }) => id === "try_umbrella"));
  eligible = false;
  response.resolve(action(request, "try_umbrella"));
  await turn;
  assert.ok(hasUnrecognized(game));
  assert.equal(game.output.some(({ text }) => text === "伞太高，够不着。"), false);
  assertOneTurn(game);
});

test("shadowed events and unavailable generic objects cannot be offered as candidates", async () => {
  let request;
  const hidden = { ...takeBall, id: "hidden", action: { kind: "generic", verb: "take", itemId: "secret" } };
  const game = makeGame((value) => { request = value; return abstain(value); }, { candidates: [...candidateList, hidden] });
  game.eng.currentRoom().events.unshift({ id: "shadow", match: { verb: "take", noun: "umbrella" }, text: "shadow" });
  await game.eng.processInput("reach for it");
  assert.deepEqual(request.candidates.map(({ id }) => id), ["take_ball"]);
});

test("generic candidate cannot resolve through another item's alias", async () => {
  let calls = 0;
  const game = makeGame((request) => { calls++; return action(request); }, { candidates: [takeBall] });
  game.eng.items = { decoy: { cn: "诱饵", aliases: ["ball"] }, ...game.eng.items };
  game.state.placeItem("decoy", "palace_gate");
  await game.eng.processInput("retrieve round thing");
  assert.equal(calls, 0);
  assert.equal(game.state.has("decoy"), false);
  assert.equal(game.state.has("ball"), false);
  assert.ok(hasUnrecognized(game));
});

test("unsupported mutable state containers decline selection instead of hiding revisions", async () => {
  let calls = 0;
  const game = makeGame((request) => { calls++; return action(request); });
  game.state.custom = new Map([["revision", 1]]);
  await game.eng.processInput("retrieve round thing");
  assert.equal(calls, 0);
  assert.equal(game.state.has("ball"), false);
  assert.ok(hasUnrecognized(game));
  assertOneTurn(game);
});

test("new input cancels a hung selection before the next complete turn begins", async () => {
  const ready = deferred(), late = deferred();
  let signal;
  const game = makeGame((request, options) => { signal = options.signal; ready.resolve(request); return late.promise; });
  const first = game.eng.processInput("retrieve round thing");
  const request = await ready.promise;
  const second = game.eng.processInput("n");
  await Promise.all([first, second]);
  assert.equal(signal.aborted, true);
  assert.equal(game.state.room, "garden");
  assert.equal(game.state.turns, 2);
  assert.equal(game.state.cnt("room_ticks"), 1);
  assert.equal(game.state.cnt("garden_ticks"), 1);
  assert.equal(game.state.cnt("timer_ticks"), 2);
  const before = JSON.stringify(game.output);
  late.resolve(action(request));
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(game.state.has("ball"), false);
  assert.equal(JSON.stringify(game.output), before);
});

test("duplicate submissions settle independently while only the latest request can execute", async () => {
  const ready = deferred(), late = deferred();
  let calls = 0, staleRequest;
  const game = makeGame((request) => {
    if (++calls === 1) { staleRequest = request; ready.resolve(); return late.promise; }
    return action(request);
  });
  const first = game.eng.processInput("retrieve round thing");
  await ready.promise;
  const second = game.eng.processInput("retrieve round thing");
  await Promise.all([first, second]);
  late.resolve(action(staleRequest));
  late.resolve(action(staleRequest));
  await Promise.resolve();
  assert.equal(calls, 2);
  assert.equal(game.state.has("ball"), true);
  assert.equal(game.state.turns, 2);
  assert.equal(game.state.cnt("timer_ticks"), 2);
  assert.equal(game.output.filter(({ text }) => text === "你拿起了足球。").length, 1);
});

test("simultaneously queued inputs cannot dispatch a selection for an already superseded token", async () => {
  let calls = 0;
  const game = makeGame((request) => { calls++; return action(request); });
  await Promise.all([game.eng.processInput("retrieve round thing"), game.eng.processInput("help")]);
  assert.equal(calls, 0);
  assert.equal(game.state.turns, 2);
  assert.equal(game.state.cnt("timer_ticks"), 1);
  assert.ok(hasUnrecognized(game));
});

test("a hung provider times out and its late rejection cannot change the settled turn", async () => {
  const late = deferred();
  const game = makeGame(() => late.promise, { timeoutMs: 5 });
  await game.eng.processInput("retrieve round thing");
  late.reject(new Error("late private failure"));
  await Promise.resolve();
  assert.equal(game.state.has("ball"), false);
  assert.ok(hasUnrecognized(game));
  assertOneTurn(game);
});

test("event selection executes exactly once and applies exactly one post-turn", async () => {
  const game = makeGame((request) => action(request, "throw_ball"));
  game.state.take("ball");
  await game.eng.processInput("lob the round thing toward the branches");
  assert.equal(game.state.itemAt("ball"), "destroyed");
  assert.equal(game.state.cnt("throws"), 1);
  assertOneTurn(game);
});

test("an execution failure propagates without replaying fallback after a partial mutation", async () => {
  const game = makeGame((request) => action(request, "throw_ball"));
  game.state.take("ball");
  game.eng.currentRoom().events[1].act = (state) => { state.inc("throws"); throw new Error("event failed"); };
  await assert.rejects(game.eng.processInput("lob it"), /event failed/);
  assert.equal(game.state.cnt("throws"), 1);
  assert.equal(game.state.turns, 1);
  assert.equal(game.state.cnt("timer_ticks"), 0);
  assert.equal(hasUnrecognized(game), false);
  await game.eng.processInput("help"); // A rejected turn does not wedge the queue.
  assert.equal(game.state.turns, 2);
});

test("oversized inputs and scenes are declined intact rather than truncated", async () => {
  let calls = 0;
  const game = makeGame((request) => { calls++; return action(request); });
  await game.eng.processInput("x".repeat(INTENT_LIMITS.input + 1));
  for (let i = 0; i < INTENT_LIMITS.objects; i++) {
    game.eng.items[`object${i}`] = { cn: `物品${i}` };
    game.state.placeItem(`object${i}`, "palace_gate");
  }
  await game.eng.processInput("retrieve round thing");
  assert.equal(calls, 0);
  assert.equal(game.state.turns, 2);
  assert.equal(game.state.cnt("timer_ticks"), 2);
});

test("malformed or duplicate trusted candidate definitions fail closed during configuration", () => {
  assert.throws(() => makeGame(() => null, { candidates: [takeBall, takeBall] }), /unique/);
  assert.throws(() => makeGame(() => null, { candidates: [{ ...takeBall, action: { kind: "script", text: "win()" } }] }), /must bind/);
  assert.throws(() => makeGame(() => null, { timeoutMs: Infinity }), /configuration/);
});
