// 真实main.js/DOM输入，独立上下文；不修改玩家当前浏览器存档。
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { GameState, SAVE_VERSION } from '../prototype/js/engine.js';
import { ITEMS } from '../prototype/js/data/items.js';
const option = (name, fallback) => { const i = process.argv.indexOf(name); return i < 0 ? fallback : process.argv[i + 1]; };
const modulePath = option('--playwright', 'playwright');
const { chromium } = await import(modulePath === 'playwright' ? modulePath : pathToFileURL(resolve(modulePath)).href);
const url = option('--url', 'http://127.0.0.1:8083/');
const out = resolve(option('--out', '/tmp/trinity-containers-browser'));
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: option('--channel', undefined) });
const key = `trinity-relit:save:v${SAVE_VERSION}`, oldKey = 'trinity-relit:save:v1';
const errors = [], receipts = [];
function seed(prologue = false) {
  const s = new GameState();
  for (const [id, item] of Object.entries(ITEMS)) if (item.start) s.moveItem(id, item.start);
  if (prologue) {
    s.setFlag('palace_gate_visited'); s.startTimer(80, 'doomsday', null);
    return { version: SAVE_VERSION, state: s.serialize() };
  }
  s.chapter = 'ranch'; s.room = 'south_reservoir'; s.visited.add(s.room);
  s.setFlag('prologue_done'); s.setFlag('chapter_ranch_entered');
  for (const id of ['bag', 'splinter', 'cage', 'walkie_talkie']) s.take(id);
  return { version: SAVE_VERSION, state: s.serialize() };
}
async function open({ narrow = false, legacy = false, bad = false, prologue = false } = {}) {
  const context = await browser.newContext({ viewport: narrow ? { width: 390, height: 844 } : { width: 1280, height: 1000 } });
  const save = seed(prologue);
  if (legacy) {
    save.version = 1;
    delete save.state.animals;
    for (const id of ['magpie', 'roadrunner', 'dead_magpie', 'dead_roadrunner', 'dead_lemming', 'tower_box']) delete save.state.itemLoc[id];
  }
  await context.addInitScript(({ save, key, oldKey, legacy, bad, origin }) => {
    if (location.origin !== origin) return;
    if (!sessionStorage.getItem('container-test-seeded')) {
      localStorage.setItem(legacy ? oldKey : key, JSON.stringify(save));
      if (bad) localStorage.setItem(key, '{broken');
      localStorage.setItem('trinity-relit:settings:v1', JSON.stringify({ semantic: 'off' }));
      sessionStorage.setItem('container-test-seeded', 'yes');
    }
    window.render_game_to_text = () => localStorage.getItem(key);
    window.advanceTime = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  }, { save, key, oldKey, legacy, bad, origin: new URL(url).origin });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => { if (response.status() >= 400 && new URL(response.url()).pathname !== '/favicon.ico') errors.push(`HTTP ${response.status()}: ${response.url()}`); });
  await page.goto(url);
  if (!bad) await resume(page); else await ready(page);
  return { page, context };
}
const ready = page => page.waitForFunction(() => document.querySelector('#input')?.disabled === false);
async function resume(page) { await page.getByRole('button', { name: '继续上次冒险', exact: true }).click(); await ready(page); }
const state = page => page.evaluate(() => JSON.parse(window.render_game_to_text()).state);
async function command(page, input) {
  const before = await page.locator('#output > div').count();
  await page.locator('#input').fill(input); await page.locator('#input').press('Enter'); await ready(page);
  return (await page.locator('#output > div').allTextContents()).slice(before).join('\n');
}
async function snapshot(page, name) {
  await page.evaluate(async () => { const output = document.querySelector('#output'); output.style.scrollBehavior = 'auto'; output.scrollTop = output.scrollHeight; await window.advanceTime(0); });
  await page.screenshot({ path: resolve(out, `${name}.png`) });
  await writeFile(resolve(out, `${name}.json`), await page.evaluate(() => window.render_game_to_text()));
}
async function cardBag(page) {
  await command(page, '清空袋子'); await command(page, 'take credit card');
  await command(page, '把信用卡放进纸袋');
  assert.equal((await state(page)).itemLoc.credit_card, 'in:empty_bag');
  assert.match(await command(page, 'look in bag'), /credit card/);
}
try {
  {
    const { page, context } = await open({ prologue: true });
    await command(page, 'n'); await command(page, 'buy bag');
    assert.equal((await state(page)).itemLoc.bag, 'inventory');
    assert.match(await command(page, 'empty bag'), /glint of red/);
    assert.equal((await state(page)).itemLoc.empty_bag, 'inventory');
    assert.ok((await state(page)).flags.includes('ruby_visible'));
    await command(page, 'take ruby'); assert.ok((await state(page)).flags.includes('wind_changed'));
    await snapshot(page, 'broadwalk-empty-keeps-story');
    receipts.push('buy-empty-ruby-story-continues'); await context.close();
  }
  {
    const { page, context } = await open({ legacy: true });
    assert.equal((await state(page)).turns, 0);
    assert.equal(await page.evaluate(key => JSON.parse(localStorage.getItem(key)).version, key), SAVE_VERSION);
    assert.equal(await page.evaluate(key => JSON.parse(localStorage.getItem(key)).version, oldKey), 1);
    await page.reload(); await resume(page);
    assert.equal((await state(page)).turns, 0);
    await snapshot(page, 'legacy-resumed-current');
    receipts.push('legacy-auto-upgrade-and-reload'); await context.close();
  }
  {
    const { page, context } = await open(); await cardBag(page);
    await command(page, 'up'); await command(page, 'in');
    const after = await state(page);
    assert.equal(after.itemLoc.soggy_bag, 'inventory'); assert.equal(after.itemLoc.credit_card, 'in:empty_bag');
    await page.reload(); await resume(page);
    assert.doesNotMatch(await command(page, 'look in bag'), /credit card/);
    await command(page, 'take card'); assert.equal((await state(page)).itemLoc.credit_card, 'in:empty_bag');
    await snapshot(page, 'ordinary-water-card-inaccessible');
    receipts.push('ordinary-water-and-resume-card-inaccessible'); await context.close();
  }
  for (const platform of [false, true]) {
    const { page, context } = await open({ narrow: platform }); await cardBag(page);
    await command(page, 'ne'); await command(page, 'up');
    if (platform) await command(page, 'drop bag');
    const before = await state(page); assert.match(await command(page, 'take binoculars'), /CRACK!/);
    const after = await state(page);
    assert.equal(after.turns, before.turns); assert.equal(after.itemLoc.soggy_bag, 'underwater');
    assert.equal(after.itemLoc.credit_card, 'in:soggy_bag');
    await page.reload(); await resume(page);
    assert.match(await command(page, 'down'), /soggy bag/);
    await snapshot(page, platform ? 'loose-wet-bag-mobile' : 'loose-wet-bag');
    await command(page, 'take bag');
    assert.match(await command(page, '从湿纸袋里拿出信用卡'), /Taken|取出|拿到/);
    assert.equal((await state(page)).itemLoc.credit_card, 'inventory');
    await command(page, 'inventory'); await snapshot(page, platform ? 'platform-recovered-mobile' : 'held-bag-recovered');
    await page.reload(); await resume(page); assert.equal((await state(page)).itemLoc.credit_card, 'inventory');
    receipts.push(platform ? 'platform-collapse-recover-mobile' : 'held-collapse-recover'); await context.close();
  }
  {
    const { page, context } = await open();
    await command(page, 'empty bag'); await command(page, 'put bag in pocket'); await command(page, 'take card');
    await command(page, 'put card in bag'); assert.equal((await state(page)).itemLoc.credit_card, 'inventory');
    await command(page, 'take bag'); await command(page, 'put card in bag');
    await command(page, 'open cage'); await command(page, 'put bag in cage'); await command(page, 'close cage');
    await command(page, 'take bag'); assert.equal((await state(page)).itemLoc.empty_bag, 'in:cage');
    await page.reload(); await resume(page);
    await command(page, 'open cage'); await command(page, 'take bag');
    assert.equal((await state(page)).itemLoc.empty_bag, 'inventory');
    await snapshot(page, 'pocket-and-cage-gates'); receipts.push('pocket-and-closed-cage-gates'); await context.close();
  }
  {
    const { page, context } = await open();
    await command(page, '打开对讲机'); assert.match(await command(page, 'listen to walkie-talkie'), /static|hiss|crackle|whine/);
    await command(page, 'up'); await command(page, 'in'); assert.ok((await state(page)).flags.includes('walkie_wet'));
    assert.match(await command(page, 'examine walkie-talkie'), /dripping wet/);
    assert.match(await command(page, 'listen to walkie-talkie'), /silent/);
    await snapshot(page, 'wet-radio-silent'); receipts.push('wet-radio-description-and-listen'); await context.close();
  }
  {
    const { page, context } = await open({ legacy: true, bad: true });
    await command(page, 'wait');
    assert.equal(await page.evaluate(key => localStorage.getItem(key), key), '{broken');
    assert.match(await page.locator('#output').innerText(), /已暂停自动保存/);
    receipts.push('corrupt-new-save-never-overwritten-by-input'); await context.close();
  }
  assert.deepEqual(errors, []);
  await writeFile(resolve(out, 'result.json'), JSON.stringify({ receipts, errors }, null, 2));
  console.log(JSON.stringify({ passed: receipts.length, errors: errors.length, out }));
} finally { await browser.close(); }
