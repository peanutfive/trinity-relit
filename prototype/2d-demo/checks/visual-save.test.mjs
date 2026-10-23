import test from 'node:test';
import assert from 'node:assert/strict';
import { createPrologueSession } from '../engine-adapter.js';
import { SCENES } from '../scene-manifest.js';
import { isBlocked } from '../world.js';
import { getInventoryActions, getHotspots } from '../prologue-actions.js';
import { VISUAL_SAVE_KEY, VISUAL_SAVE_VERSION, makeVisualSave, parseVisualSave,
  exportVisualSave, restoreVisualSave, createVisualSaveStore } from '../save.js';

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return { values, getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
}
function session({ start = true, onAutosave } = {}) {
  const output = [];
  const ui = Object.fromEntries(['text', 'system', 'inventory', 'location', 'userInput']
    .map(name => [name, (...args) => output.push({ name, text: args.join('\n') })]));
  const engine = createPrologueSession({ ui, onAutosave });
  if (start) engine.moveTo(engine.state.room);
  return { engine, output };
}
async function command(game, input) {
  const start = game.output.length;
  await game.engine.processInput(input);
  assert.equal(game.engine.state.dead, false, input);
  assert.doesNotMatch(game.output.slice(start).map(entry => entry.text).join('\n'),
    /这句话无法识别|错误：|尚未开放|没有可进入的起始房间/, input);
}
const json = value => JSON.parse(JSON.stringify(value));
const visual = (engine, patch = {}) => ({ room: engine.state.room,
  x: SCENES[engine.state.room].spawn[0], y: SCENES[engine.state.room].spawn[1], face: 'right',
  knowledge: { observed: [], paper: { observed: [], identified: [] } }, ...patch });

async function reachMeadow(game) {
  for (const input of ['e', 'take ball', 'nw', 'unscrew gnomon', 'take gnomon',
    'n', 'take paper bird', 'open paper bird', 'w', 'buy crumbs', 'feed birds',
    'take ruby', 'n', 'push pram', 'push pram', 'wait', 'throw ball at tree',
    'take umbrella', 'push pram', 'open pram', 'enter pram', 'open umbrella',
    'take paper bird', 'take gnomon', 's', 'enter door']) await command(game, input);
  assert.equal(game.engine.state.room, 'meadow');
  assert.equal(game.engine.state.score, 15);
}

test('二维存档往返真实序章中段，位置/朝向/物品与计时器保留且不重放onEnter', async () => {
  const original = session();
  await command(original, 'e'); await command(original, 'take ball');
  await command(original, 'nw'); await command(original, 'unscrew gnomon');
  const store = createVisualSaveStore({ storage: memoryStorage() });
  const point = visual(original.engine, { x: 239.25, y: 219.5, face: 'left' });
  const written = store.write(original.engine, point);
  assert.equal(written.ok, true);
  assert.deepEqual(written.save.visual, point);
  assert.equal(written.save.version, VISUAL_SAVE_VERSION);
  const before = json(original.engine.serialize().state);
  const restored = session({ start: false });
  let autosaves = 0; restored.engine.onAutosave = () => autosaves++;
  const outputBefore = restored.output.length;
  const result = await store.restore(restored.engine);
  assert.equal(result.ok, true); assert.deepEqual(result.visual, point);
  assert.deepEqual(restored.engine.serialize().state, before);
  assert.equal(restored.output.length, outputBefore, '读档不显示进入文案或调用onEnter');
  assert.equal(autosaves, 0, '读档不能产生新回合或自动保存');
  assert.equal(typeof restored.engine.state.timer.perTurn, 'function');
  await command(restored, 'take gnomon');
  assert.ok(restored.engine.state.has('gnomon'));
  assert.equal(restored.engine.state.timer.remaining, before.timer.remaining - 1);
});

test('读回序章计时器后继续原有回合副作用，而非重新从80开始', async () => {
  const original = session();
  // This fixture advances the real timer using ordinary commands.
  for (let i = 0; i < 71; i++) await command(original, 'wait');
  const save = makeVisualSave(original.engine, visual(original.engine));
  const restored = session({ start: false });
  await restoreVisualSave(restored.engine, save);
  const previousRemaining = restored.engine.state.timer.remaining;
  const previousPhase = restored.engine.state.cnt('doom_phase');
  await command(restored, 'wait');
  assert.equal(restored.engine.state.timer.remaining, previousRemaining - 1);
  assert.equal(restored.engine.state.cnt('doom_phase'), previousPhase + 1);
});

test('完整真实序章到Meadow后导出/导入，懒加载和跨章标志保留', async () => {
  const original = session(); await reachMeadow(original);
  const save = makeVisualSave(original.engine, visual(original.engine));
  const text = exportVisualSave(save);
  assert.equal(JSON.parse(text).visual.room, 'meadow');
  const restored = session({ start: false });
  assert.equal(restored.engine.rooms.meadow, undefined);
  const result = await restoreVisualSave(restored.engine, text);
  assert.equal(result.repositioned, false);
  assert.ok(restored.engine.loadedChapters.has('wabe'));
  assert.ok(restored.engine.state.hasFlag('prologue_done'));
  assert.equal(restored.engine.state.score, 15);
  assert.deepEqual(restored.engine.serialize().state, save.engine.state);
  assert.equal(restored.engine.state.turns, save.engine.state.turns);
  assert.equal(typeof restored.engine.state.timer.perTurn, 'function');
  await command(restored, 'wait');
  assert.equal(restored.engine.state.room, 'meadow');
});

test('坏包、错房、未知计时器或错误字段不替换活进度和磁盘好档', async () => {
  const g = session(); await command(g, 'e');
  const storage = memoryStorage(), store = createVisualSaveStore({ storage });
  const good = makeVisualSave(g.engine, visual(g.engine));
  assert.equal(store.write(good).ok, true);
  const disk = storage.getItem(VISUAL_SAVE_KEY), before = json(g.engine.serialize().state);
  const broken = [
    null, '{}', '{broken', { ...good, version: -1 },
    { ...good, engine: null }, { ...good, visual: null },
    { ...good, visual: { ...good.visual, room: 'palace_gate' } },
    { ...good, engine: { ...good.engine, state: { ...good.engine.state, room: '__missing_visual__' } } },
    { ...good, engine: { ...good.engine, state: { ...good.engine.state, chapter: 'wabe' } } },
    { ...good, engine: { ...good.engine, state: { ...good.engine.state, flags: 'wrong' } } },
    { ...good, engine: { ...good.engine, state: { ...good.engine.state, counters: { turn: NaN } } } },
    { ...good, engine: { ...good.engine, state: { ...good.engine.state, turns: -1 } } },
  ];
  for (const packet of broken) {
    assert.equal(store.write(packet).ok, false);
    const result = await store.restore(g.engine, packet);
    assert.equal(result.ok, false);
    assert.deepEqual(g.engine.serialize().state, before);
    assert.equal(storage.getItem(VISUAL_SAVE_KEY), disk);
  }
  const unknownTimer = { ...good, engine: { ...good.engine,
    state: { ...good.engine.state, timer: { id: '__unknown__', remaining: 4 } } } };
  assert.equal(store.write(unknownTimer).ok, false, '未知计时器在写盘前就拒绝');
  assert.equal((await store.restore(g.engine, unknownTimer)).ok, false);
  assert.deepEqual(g.engine.serialize().state, before);
  assert.equal(storage.getItem(VISUAL_SAVE_KEY), disk);
});

test('视觉坏坐标、越界或碰撞回退spawn，错房绝不猜测', () => {
  const g = session();
  const good = makeVisualSave(g.engine, visual(g.engine));
  for (const point of [{ x: Infinity }, { y: NaN }, { x: '240' }, { x: -20 }, { y: 500 }, { x: null }]) {
    const corrected = parseVisualSave({ ...good, visual: { ...good.visual, ...point } });
    assert.deepEqual([corrected.visual.x, corrected.visual.y], SCENES.palace_gate.spawn);
    assert.equal(corrected.visual.face, good.visual.face);
  }
  const broadSave = { ...good,
    engine: { ...good.engine, state: { ...good.engine.state, room: 'broad_walk' } },
    visual: { room: 'broad_walk', x: 362, y: 151, face: 'up' } };
  assert.equal(isBlocked(SCENES.broad_walk, 362, 151), true);
  assert.deepEqual([parseVisualSave(broadSave).visual.x, parseVisualSave(broadSave).visual.y], SCENES.broad_walk.spawn);
  assert.throws(() => parseVisualSave({ ...good, visual: { ...good.visual, room: 'broad_walk' } }), /位置.*房间/);
});

test('无碰撞但与出生点隔离的位置也回退，读档不把人锁在封闭区域', () => {
  const g = session();
  const scene = { ...SCENES.palace_gate, spawn: [40, 40],
    // An explicit test floor, independent of Palace Gate's calibrated path mesh.
    walkablePolygons: [[[12, 12], [468, 12], [468, 276], [12, 276]]],
    blockedPolygons: [], footprint: { rx: 6, ry: 3 }, obstacles: [
    { x: 150, y: 100, w: 60, h: 4 }, { x: 150, y: 160, w: 60, h: 4 },
    { x: 150, y: 100, w: 4, h: 64 }, { x: 206, y: 100, w: 4, h: 64 },
  ] };
  assert.equal(isBlocked(scene, 180, 130), false);
  const packageWithIsolatedPoint = { version: VISUAL_SAVE_VERSION, engine: g.engine.serialize(),
    visual: { room: 'palace_gate', x: 180, y: 130, face: 'down' } };
  const parsed = parseVisualSave(packageWithIsolatedPoint, { scenes: { palace_gate: scene } });
  assert.deepEqual([parsed.visual.x, parsed.visual.y], scene.spawn);
});

test('死亡不保存、不覆盖最后活档；二维读写清除不触碰文字版key', async () => {
  const g = session(); await command(g, 'e');
  const textKey = 'trinity-relit:save:v1', textSave = JSON.stringify(g.engine.serialize());
  const storage = memoryStorage({ [textKey]: textSave }), store = createVisualSaveStore({ storage });
  assert.equal(store.read().empty, true, '只有文字版存档时不显示二维继续');
  assert.throws(() => store.parse(textSave), /二维游戏存档/);
  assert.equal(store.write(g.engine, visual(g.engine)).ok, true);
  const alive = storage.getItem(VISUAL_SAVE_KEY);
  g.engine.state.dead = true; // Only a death-protection test fixture.
  assert.equal(makeVisualSave(g.engine, visual(g.engine)), null);
  assert.equal(store.write(g.engine, visual(g.engine)).skipped, true);
  assert.equal(storage.getItem(VISUAL_SAVE_KEY), alive);
  assert.equal(store.export().ok, true);
  assert.equal(store.clear().ok, true);
  assert.equal(storage.getItem(VISUAL_SAVE_KEY), null);
  assert.equal(storage.getItem(textKey), textSave);
});

test('不可用/拒绝读写的storage返回错误，不依赖浏览器全局且不抛出', () => {
  const unavailable = createVisualSaveStore();
  assert.equal(unavailable.read().ok, false); assert.equal(unavailable.clear().ok, false);
  const g = session();
  const storage = { getItem() { throw new Error('denied'); },
    setItem() { throw new Error('full'); }, removeItem() { throw new Error('denied'); } };
  const store = createVisualSaveStore({ storage });
  assert.equal(store.read().ok, false); assert.equal(store.write(g.engine, visual(g.engine)).ok, false);
  assert.equal(store.clear().ok, false); assert.equal(store.export().ok, false);
});


test('正常默认日晷符号为2，engine.serialize包原样保留；缺少可选旧字段由引擎恢复默认值', async () => {
  const original = session();
  assert.equal(original.engine.state.sundialSymbol, 2);
  const engineSave = json(original.engine.serialize());
  const save = makeVisualSave(engineSave, visual(original.engine));
  assert.deepEqual(save.engine, engineSave, '二维包不能把engine envelope拆成裸state');
  const restored = session({ start: false });
  await restoreVisualSave(restored.engine, exportVisualSave(save));
  assert.equal(restored.engine.state.sundialSymbol, 2);
  assert.deepEqual(restored.engine.serialize().state, engineSave.state);
  const old = json(save); delete old.engine.state.sundialSymbol;
  await restoreVisualSave(restored.engine, old);
  assert.equal(restored.engine.state.sundialSymbol, 2);
  const before = json(restored.engine.serialize().state);
  for (const badSymbol of [0, 8, '2', null, NaN]) {
    const bad = json(save); bad.engine.state.sundialSymbol = badSymbol;
    await assert.rejects(restoreVisualSave(restored.engine, bad));
    assert.deepEqual(restored.engine.serialize().state, before);
  }
});

test('未开放章节标记与未知计时器的坏导入不污染本地存档', async () => {
  const g = session();
  const storage = memoryStorage(), store = createVisualSaveStore({ storage });
  store.write(g.engine, visual(g.engine));
  const disk = storage.getItem(VISUAL_SAVE_KEY), before = json(g.engine.serialize().state);
  for (const statePatch of [
    { flags: [...before.flags, 'chapter___unsupported___entered'] },
    { timer: { id: '__unknown__', remaining: 3 } },
  ]) {
    const bad = json(store.read().save); Object.assign(bad.engine.state, statePatch);
    assert.equal(store.write(bad).ok, false);
    assert.equal((await store.restore(g.engine, bad)).ok, false);
    assert.deepEqual(g.engine.serialize().state, before);
    assert.equal(storage.getItem(VISUAL_SAVE_KEY), disk);
  }
});


test('从本地坏坐标恢复时保留repositioned提示，并只回退视觉位置', async () => {
  const g = session();
  const save = makeVisualSave(g.engine, visual(g.engine));
  save.visual.x = -100;
  const storage = memoryStorage({ [VISUAL_SAVE_KEY]: JSON.stringify(save) });
  const store = createVisualSaveStore({ storage });
  const restored = session({ start: false });
  const result = await store.restore(restored.engine);
  assert.equal(result.ok, true); assert.equal(result.repositioned, true);
  assert.deepEqual([result.visual.x, result.visual.y], SCENES.palace_gate.spawn);
  assert.deepEqual(restored.engine.serialize().state, save.engine.state);
});


test('M4关键状态：车内恢复后经背包撑伞到Long Water，白门前恢复后继续到Meadow', async () => {
  const original = session();
  for (const input of ['e', 'take ball', 'nw', 'unscrew gnomon', 'take gnomon',
    'n', 'take paper bird', 'open paper bird', 'w', 'buy crumbs', 'feed birds',
    'take ruby', 'n', 'push pram', 'push pram', 'wait', 'throw ball at tree',
    'take umbrella', 'push pram', 'open pram', 'enter pram']) await command(original, input);
  assert.equal(original.engine.state.room, 'lancaster_walk');
  assert.ok(original.engine.state.hasFlag('pram_open'));
  assert.ok(original.engine.state.hasFlag('in_pram'));
  assert.ok(original.engine.state.hasFlag('wind_changed'));
  assert.ok(original.engine.state.has('umbrella'));
  const storage = memoryStorage(), store = createVisualSaveStore({ storage });
  const seatedPosition = visual(original.engine, { x: 279, y: 192, face: 'right' });
  const seatWrite = store.write(original.engine, seatedPosition);
  assert.equal(seatWrite.ok, true);
  const seatedState = json(original.engine.serialize().state);
  const seated = session({ start: false });
  const restoredSeat = await store.restore(seated.engine);
  assert.equal(restoredSeat.ok, true); assert.deepEqual(restoredSeat.visual, seatedPosition);
  assert.deepEqual(seated.engine.serialize().state, seatedState, '车内flags/计时器与回合不得重放');
  assert.equal(seated.output.length, 0, '车内读档不重复进入房间文案');
  assert.equal(typeof seated.engine.state.timer.perTurn, 'function');
  const umbrellaAction = getInventoryActions('umbrella', seated.engine.state)
    .find(action => action.command === 'open umbrella');
  assert.ok(umbrellaAction, '恢复后背包仍提供撑伞动作');
  await command(seated, umbrellaAction.command);
  assert.equal(seated.engine.state.room, 'long_water');
  assert.ok(seated.engine.state.hasFlag('pram_broken'));
  assert.ok(seated.engine.state.hasFlag('at_long_water'));
  assert.equal(seated.engine.state.hasFlag('in_pram'), false);
  assert.equal(seated.engine.state.itemAt('paper_bird'), 'long_water');
  assert.equal(seated.engine.state.turns, seatedState.turns + 1);
  for (const input of ['take paper bird', 'take gnomon', 's']) await command(seated, input);
  assert.equal(seated.engine.state.room, 'wading');
  assert.ok(seated.engine.state.hasFlag('white_door_visible'));
  const beforeDoor = json(seated.engine.serialize().state);
  assert.equal(store.write(seated.engine, visual(seated.engine, { face: 'right' })).ok, true);
  const crossing = session({ start: false });
  const restoredDoor = await store.restore(crossing.engine, store.export().text);
  assert.equal(restoredDoor.ok, true);
  assert.deepEqual(crossing.engine.serialize().state, beforeDoor, '白门前读档不重播onEnter或onTurn');
  assert.equal(crossing.output.length, 0);
  assert.equal(typeof crossing.engine.state.timer.perTurn, 'function');
  const enterDoorAction = getHotspots(crossing.engine.state).flatMap(object => object.actions)
    .find(action => action.command === 'enter door');
  assert.ok(enterDoorAction, '恢复后白门仍提供进入动作');
  await command(crossing, enterDoorAction.command);
  assert.equal(crossing.engine.state.room, 'meadow');
  assert.equal(crossing.engine.state.chapter, 'wabe');
  assert.ok(crossing.engine.state.hasFlag('prologue_done'));
  assert.ok(crossing.engine.state.hasFlag('chapter_wabe_entered'));
  assert.ok(crossing.engine.loadedChapters.has('wabe'));
  assert.equal(crossing.engine.state.score, 15);
  assert.equal(crossing.engine.state.turns, beforeDoor.turns + 1);
});


test('二维观察和纸鸟辨认知识随导出导入保留，旧档缺省为空且不写游戏flag', async () => {
  const original = session(); await command(original, 'ne');
  const beforeEngine = json(original.engine.serialize().state);
  const knowledge = { observed: ['the_wabe:sundial', 'round_pond:paper-craft', 'item:ball'],
    paper: { observed: ['round_pond:paper-craft'], identified: ['round_pond:paper-craft'] } };
  const save = makeVisualSave(original.engine, visual(original.engine, { knowledge }));
  assert.deepEqual(save.visual.knowledge, knowledge);
  knowledge.observed.push('palace_gate:sky');
  assert.equal(save.visual.knowledge.observed.includes('palace_gate:sky'), false, '不能与调用方数组共享引用');
  const storage = memoryStorage(), store = createVisualSaveStore({ storage });
  assert.equal(store.write(save).ok, true);
  const restored = session({ start: false });
  const result = await store.restore(restored.engine, store.export().text);
  assert.equal(result.ok, true);
  assert.deepEqual(result.visual.knowledge, save.visual.knowledge);
  assert.deepEqual(restored.engine.serialize().state, beforeEngine, '知识只属于视觉层，不补写引擎flag');
  const legacy = json(save); delete legacy.visual.knowledge;
  assert.deepEqual(parseVisualSave(legacy).visual.knowledge, { observed: [], paper: { observed: [], identified: [] } });
  const oldResult = await restoreVisualSave(restored.engine, legacy);
  assert.deepEqual(oldResult.visual.knowledge, { observed: [], paper: { observed: [], identified: [] } });
});

test('畸形或自相矛盾的knowledge拒绝导入，不覆盖活进度和盘上好档', async () => {
  const g = session(), storage = memoryStorage(), store = createVisualSaveStore({ storage });
  const good = makeVisualSave(g.engine, visual(g.engine));
  assert.equal(store.write(good).ok, true);
  const disk = storage.getItem(VISUAL_SAVE_KEY), before = json(g.engine.serialize().state);
  const empty = { observed: [], paper: { observed: [], identified: [] } };
  const malformed = [null, [], 'bad', {},
    { ...empty, observed: 'bad' }, { ...empty, observed: [1] },
    { ...empty, observed: [''] }, { ...empty, observed: ['arbitrary prose'] },
    { ...empty, observed: ['item:ball', 'item:ball'] },
    { ...empty, extra: true }, { ...empty, paper: null },
    { ...empty, paper: { observed: [], identified: 'bad' } },
    { ...empty, paper: { observed: ['item:ball'], identified: [] } },
    { ...empty, paper: { observed: [], identified: ['round_pond:paper-craft'] } },
    { ...empty, paper: { observed: ['round_pond:paper-craft'], identified: ['round_pond:paper-craft'], extra: true } },
  ];
  for (const knowledge of malformed) {
    const bad = { ...good, visual: { ...good.visual, knowledge } };
    assert.equal(store.write(bad).ok, false, JSON.stringify(knowledge));
    assert.equal((await store.restore(g.engine, bad)).ok, false, JSON.stringify(knowledge));
    assert.deepEqual(g.engine.serialize().state, before);
    assert.equal(storage.getItem(VISUAL_SAVE_KEY), disk);
  }
});
