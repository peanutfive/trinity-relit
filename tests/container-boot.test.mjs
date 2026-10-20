import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { createGame, stubUi } from './harness.mjs';

const oldKey = 'trinity-relit:save:v1';
const middleKey = 'trinity-relit:save:v2';
const newKey = 'trinity-relit:save:v3';
let runId = 0;
function current(room = 'flower_walk', turns = 12) {
  const game = createGame();
  game.eng.moveTo(room);
  game.state.turns = turns;
  return game.eng.serialize();
}
function legacy(room = 'flower_walk', turns = 12) {
  const save = { ...current(room, turns), version: 1 };
  delete save.state.animals;
  for (const id of ['magpie', 'roadrunner', 'dead_magpie', 'dead_roadrunner', 'dead_lemming', 'tower_box']) delete save.state.itemLoc[id];
  return save;
}
async function boot(t, initial, { failWrite = false, failRemoveKey = null } = {}) {
  const priorStorage = globalThis.localStorage;
  const priorError = console.error, priorWarn = console.warn;
  const diagnostics = [];
  console.error = console.warn = (message, error) => diagnostics.push(`${message}: ${error?.message || ''}`);
  const store = new Map(Object.entries(initial));
  const output = [];
  let input, controls, picked = null, consent = true, reloads = 0;
  globalThis.localStorage = {
    getItem: key => store.get(key) ?? null,
    setItem(key, value) { if (failWrite && key === newKey) throw new Error('fixture quota'); store.set(key, value); },
    removeItem(key) { if (key === failRemoveKey) throw new Error('fixture remove blocked'); store.delete(key); },
  };
  globalThis.__trinityContainerUi = {
    ...stubUi(output), setLoading() {}, hideLoading() {}, setSemanticControls() {}, semanticDebug() {},
    setSaveControls(value) { controls = value; }, askResume: async () => 'continue',
    enableInput(handler) { input = handler; }, confirm: () => consent,
    pickJSONFile: async () => picked, reload() { reloads++; },
  };
  t.after(() => {
    if (priorStorage === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = priorStorage;
    delete globalThis.__trinityContainerUi;
    console.error = priorError; console.warn = priorWarn;
  });
  const url = new URL('../prototype/js/main.js', import.meta.url);
  let source = await readFile(url, 'utf8');
  source = source.replace('import { ui } from "./ui.js";', 'const ui = globalThis.__trinityContainerUi;');
  source = source.replace(/(["'])(\.\/[^"']+)\1/g, (_m, quote, path) => quote + new URL(path, url).href + quote);
  source = source.replace('boot().catch(', 'await boot().catch(');
  await import(`data:text/javascript;base64,${Buffer.from(source + `\n// container boot ${++runId}`).toString('base64')}`);
  assert.equal(typeof input, 'function');
  return { store, output, input, controls, diagnostics,
    async import(save, confirm = true) { picked = JSON.stringify(save); consent = confirm; await controls.onImport(); },
    reloads: () => reloads,
  };
}

test('v1仅旧键自动续玩并落v3，不增加回合、不重放首房间副作用', async t => {
  const save = legacy('palace_gate');
  save.state.timer.remaining = 27;
  const raw = JSON.stringify(save);
  const app = await boot(t, { [oldKey]: raw });
  const updated = JSON.parse(app.store.get(newKey));
  assert.equal(updated.version, 3);
  assert.equal(updated.state.turns, save.state.turns);
  assert.deepEqual(updated.state.timer, save.state.timer);
  assert.equal(app.store.get(oldKey), raw, '自动迁移不先删除旧备份');
  assert.doesNotMatch(app.output.map(x => x.text).join('\n'), /Sharp words between the superpowers/);
  await app.input('wait');
  assert.equal(JSON.parse(app.store.get(newKey)).state.turns, save.state.turns + 1);
});

test('v3与v1同时存在优先新档；坏v3不静默退回旧v1，也不删除原始档', async t => {
  const old = JSON.stringify(legacy());
  const newer = current('flower_walk', 35);
  const app = await boot(t, { [oldKey]: old, [newKey]: JSON.stringify(newer) });
  await app.input('wait');
  assert.equal(JSON.parse(app.store.get(newKey)).state.turns, 36);
  assert.equal(app.store.get(oldKey), old);
});

test('不支持的新档版本不能回退到旧档；失败启动不删除两份磁盘数据', async t => {
  const old = JSON.stringify(legacy());
  const invalid = JSON.stringify({ ...legacy(), version: 999 });
  const app = await boot(t, { [oldKey]: old, [newKey]: invalid });
  assert.equal(app.store.get(oldKey), old);
  assert.equal(app.store.get(newKey), invalid);
  assert.match(app.output.map(x => x.text).join('\n'), /存档无法读取/);
  assert.doesNotMatch(app.output.map(x => x.text).join('\n'), /已回到上次离开的地方/);
  await app.input('wait');
  assert.equal(app.store.get(newKey), invalid, '失败加载后游戏输入不能覆盖坏档');
});

test('旧档导入确认前不写入，确认后仅落规范化v3包', async t => {
  const seed = JSON.stringify(current());
  const app = await boot(t, { [newKey]: seed });
  const incoming = legacy('round_pond', 44);
  await app.import(incoming, false);
  assert.equal(app.store.get(newKey), seed);
  assert.equal(app.reloads(), 0);
  await app.import(incoming);
  const imported = JSON.parse(app.store.get(newKey));
  assert.equal(imported.version, 3);
  assert.equal(imported.state.room, 'round_pond');
  assert.equal(imported.state.turns, 44);
  assert.equal(app.reloads(), 1);
});

test('旧档带容器关系、未来版本及循环容器导入均不损坏磁盘与活局', async t => {
  const seed = JSON.stringify(current());
  const app = await boot(t, { [newKey]: seed });
  const badOld = legacy(); badOld.state.itemLoc.credit_card = 'in:empty_bag';
  const future = { ...legacy(), version: 999 };
  const cycle = { ...legacy(), version: 2 };
  cycle.state.itemLoc.empty_bag = 'in:soggy_bag';
  cycle.state.itemLoc.soggy_bag = 'in:empty_bag';
  for (const invalid of [badOld, future, cycle]) {
    await app.import(invalid);
    assert.equal(app.store.get(newKey), seed);
    assert.equal(app.reloads(), 0);
  }
  await app.input('wait');
  assert.equal(JSON.parse(app.store.get(newKey)).state.turns, 13);
});

test('显式重新开始清除v1、v2与v3，避免旧档下次启动复活', async t => {
  const old = JSON.stringify(legacy());
  const middle = JSON.stringify({ ...legacy('round_pond', 20), version: 2 });
  const app = await boot(t, { [oldKey]: old, [middleKey]: middle });
  assert.ok(app.store.has(newKey));
  app.controls.onRestart();
  assert.equal(app.store.has(oldKey), false);
  assert.equal(app.store.has(middleKey), false);
  assert.equal(app.store.has(newKey), false);
  assert.equal(app.reloads(), 1);
});

test('自动迁移写入失败仍保留旧档并可在当前页面继续', async t => {
  const raw = JSON.stringify(legacy());
  const app = await boot(t, { [oldKey]: raw }, { failWrite: true });
  assert.equal(app.store.get(oldKey), raw);
  assert.equal(app.store.has(newKey), false);
  assert.match(app.output.map(x => x.text).join('\n'), /原存档仍保留/);
  await app.input('wait');
  assert.equal(app.store.get(oldKey), raw);
});

test('新键不是JSON时提示错误，后续普通输入仍保留两份原始档', async t => {
  const old = JSON.stringify(legacy());
  const app = await boot(t, { [oldKey]: old, [newKey]: '{broken' });
  assert.match(app.output.map(x => x.text).join('\n'), /已暂停自动保存/);
  await app.input('wait');
  assert.equal(app.store.get(newKey), '{broken');
  assert.equal(app.store.get(oldKey), old);
});

test('旧键无法删除时阻止重开且不先删新键，不使旧档复活', async t => {
  const old = JSON.stringify(legacy());
  const fresh = JSON.stringify(current('flower_walk', 40));
  const app = await boot(t, { [oldKey]: old, [newKey]: fresh }, { failRemoveKey: oldKey });
  app.controls.onRestart();
  assert.equal(app.store.get(oldKey), old);
  assert.equal(app.store.get(newKey), fresh);
  assert.equal(app.reloads(), 0);
  assert.match(app.output.map(x => x.text).join('\n'), /尚未重新开始/);
});

test('导入落盘失败不重载，不覆盖已有新档或活状态', async t => {
  const raw = JSON.stringify(current());
  const app = await boot(t, { [newKey]: raw }, { failWrite: true });
  await app.import(legacy('round_pond', 55));
  assert.equal(app.store.get(newKey), raw);
  assert.equal(app.reloads(), 0);
  assert.match(app.output.map(x => x.text).join('\n'), /导入失败：无法写入/);
});


test('v2键先于v1迁移且保留两份旧档，坏v2不退到v1', async t => {
  const old = JSON.stringify(legacy('flower_walk', 12));
  const middle = JSON.stringify({ ...legacy('round_pond', 26), version: 2 });
  const app = await boot(t, { [oldKey]: old, [middleKey]: middle });
  const migrated = JSON.parse(app.store.get(newKey));
  assert.equal(migrated.version, 3);
  assert.equal(migrated.state.room, 'round_pond');
  assert.equal(migrated.state.turns, 26);
  assert.equal(app.store.get(oldKey), old);
  assert.equal(app.store.get(middleKey), middle);
});

test('坏v3不回退到有效v2或v1，普通输入仍不覆盖损坏内容', async t => {
  const old = JSON.stringify(legacy());
  const middle = JSON.stringify({ ...legacy('round_pond', 26), version: 2 });
  const app = await boot(t, { [oldKey]: old, [middleKey]: middle, [newKey]: '{bad-v3' });
  await app.input('wait');
  assert.equal(app.store.get(newKey), '{bad-v3');
  assert.equal(app.store.get(middleKey), middle);
  assert.equal(app.store.get(oldKey), old);
});

test('v2删除失败阻止重开，不删除v3有效进度', async t => {
  const middle = JSON.stringify({ ...legacy('round_pond', 26), version: 2 });
  const currentRaw = JSON.stringify(current('flower_walk', 40));
  const app = await boot(t, { [middleKey]: middle, [newKey]: currentRaw }, { failRemoveKey: middleKey });
  app.controls.onRestart();
  assert.equal(app.reloads(), 0);
  assert.equal(app.store.get(middleKey), middle);
  assert.equal(app.store.get(newKey), currentRaw);
});

test('当前键缺失而v2损坏时不回退有效v1，输入也不写v3覆盖恢复机会', async t => {
  const old = JSON.stringify(legacy('round_pond', 22));
  const app = await boot(t, { [oldKey]: old, [middleKey]: '{bad-v2' });
  await app.input('wait');
  assert.equal(app.store.has(newKey), false);
  assert.equal(app.store.get(middleKey), '{bad-v2');
  assert.equal(app.store.get(oldKey), old);
});
