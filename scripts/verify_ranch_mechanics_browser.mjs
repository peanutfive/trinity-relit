// 实际 main.js + DOM 输入验收。单章存档夹具不充作原版正常路线证据。
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { GameState, SAVE_VERSION } from '../prototype/js/engine.js';
import { ITEMS } from '../prototype/js/data/items.js';

const option = (name, fallback) => {
  const index = process.argv.indexOf(name);
  return index < 0 ? fallback : process.argv[index + 1];
};
const modulePath = option('--playwright', 'playwright');
const { chromium } = await import(modulePath === 'playwright' ? modulePath : pathToFileURL(resolve(modulePath)).href);
const url = option('--url', 'http://127.0.0.1:8083/');
const out = resolve(option('--out', '/tmp/trinity-ranch-mechanics-browser'));
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: option('--channel', undefined) });
const errors = [], resourceErrors = [], receipts = [];
const key = `trinity-relit:save:v${SAVE_VERSION}`;

function saveAt(room, chapter = 'ranch') {
  const state = new GameState();
  for (const [id, item] of Object.entries(ITEMS)) if (item.start) state.moveItem(id, item.start);
  state.room = room;
  state.chapter = chapter;
  state.visited.add(room);
  if (chapter === 'ranch') {
    state.setFlag('prologue_done');
    state.setFlag('chapter_ranch_entered');
    for (const id of ['bandage', 'splinter', 'spade']) state.take(id);
    state.wear('shroud');
  } else {
    state.setFlag('umbrella_woman_seen');
    state.startTimer(60, 'doomsday', null);
  }
  return { version: SAVE_VERSION, state: state.serialize() };
}

async function open(room, { chapter = 'ranch', narrow = false } = {}) {
  const context = await browser.newContext({ viewport: narrow ? { width: 390, height: 844 } : { width: 1280, height: 1000 } });
  await context.addInitScript(({ seed, key, origin }) => {
    if (location.origin !== origin) return;
    if (!sessionStorage.getItem('ranch-test-seeded')) {
      localStorage.setItem(key, JSON.stringify(seed));
      localStorage.setItem('trinity-relit:settings:v1', JSON.stringify({ semantic: 'off' }));
      sessionStorage.setItem('ranch-test-seeded', 'true');
    }
    // 仅测试上下文中的观察/等待钩子；文字冒险按指令推进，无动画时钟。
    window.render_game_to_text = () => JSON.stringify(JSON.parse(localStorage.getItem(key)).state);
    window.advanceTime = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  }, { seed: saveAt(room, chapter), key, origin: new URL(url).origin });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => {
    if (response.status() < 400) return;
    const entry = { url: response.url(), status: response.status() };
    resourceErrors.push(entry);
    // 主线原有的缺省favicon请求不属于游戏脚本；仍记录以便审查。
    if (new URL(response.url()).pathname !== '/favicon.ico') errors.push(`HTTP ${entry.status}: ${entry.url}`);
  });
  await page.goto(url);
  await resume(page);
  return { page, context };
}
async function resume(page) {
  await page.getByRole('button', { name: '继续上次冒险', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('#input')?.disabled === false);
}
const state = page => page.evaluate(() => JSON.parse(window.render_game_to_text()));
async function command(page, text) {
  const start = await page.locator('#output > div').count();
  await page.locator('#input').fill(text);
  await page.locator('#input').press('Enter');
  await page.waitForFunction(() => document.querySelector('#input')?.disabled === false);
  const nodes = await page.locator('#output > div').allTextContents();
  return nodes.slice(start).join('\n');
}
async function snapshot(page, name) {
  await page.evaluate(async () => {
    const output = document.querySelector('#output');
    output.style.scrollBehavior = 'auto';
    output.scrollTop = output.scrollHeight;
    await window.advanceTime(0);
  });
  await page.screenshot({ path: resolve(out, `${name}.png`) });
  await writeFile(resolve(out, `${name}.json`), await page.evaluate(() => window.render_game_to_text()));
}

try {
  {
    const { page, context } = await open('lancaster_gate', { chapter: 'prologue' });
    const before = await state(page);
    assert.match(await command(page, 'help woman'), /Her face is wrong[\s\S]*strong gust/);
    const after = await state(page);
    assert.equal(after.turns, before.turns);
    assert.equal(after.timer.remaining, before.timer.remaining);
    assert.ok(after.flags.includes('umbrella_woman_done'));
    await snapshot(page, 'woman-free-action');
    await page.reload(); await resume(page);
    assert.ok((await state(page)).flags.includes('umbrella_woman_done'));
    assert.doesNotMatch(await command(page, 'wait'), /Her face is wrong|strong gust/);
    receipts.push({ case: 'woman-free-action-and-resume', pass: true });
    await context.close();
  }
  {
    const { page, context } = await open('under_windmill');
    assert.match(await command(page, 'up'), /Somebody has left[\s\S]*creaks under your weight/);
    await snapshot(page, 'windmill-first-warning');
    const before = await state(page);
    assert.match(await command(page, '拿双筒望远镜'), /CRACK!/);
    const collapsed = await state(page);
    assert.equal(collapsed.room, 'reservoir'); assert.equal(collapsed.turns, before.turns);
    for (const id of ['binoculars', 'bandage', 'splinter', 'spade']) assert.equal(collapsed.itemLoc[id], 'underwater');
    assert.equal(collapsed.itemLoc.credit_card, 'pocket'); assert.equal(collapsed.itemLoc.watch, 'worn');
    await snapshot(page, 'windmill-collapse');
    await page.reload(); await resume(page);
    await command(page, 'down');
    assert.match(await command(page, '拿望远镜'), /Taken/);
    await command(page, 'up'); await command(page, '戴上望远镜');
    assert.match(await command(page, 'wear binoculars'), /already wearing/);
    assert.equal((await state(page)).score, 1); assert.equal((await state(page)).itemLoc.binoculars, 'worn');
    for (const input of ['s', 'd', 'ne']) await command(page, input);
    assert.match(await command(page, 'up'), /landing overhead is broken/);
    await snapshot(page, 'binoculars-recovered');
    receipts.push({ case: 'collapse-resume-recover-wear-broken-platform', pass: true });
    await context.close();
  }
  {
    const { page, context } = await open('reservoir', { narrow: true });
    await command(page, 'down');
    const submerged = await state(page);
    assert.equal(submerged.counters.ranch_breath_remaining, 3);
    assert.match(await command(page, 'north'), /hit your head/);
    await command(page, 'xyzzyfoo');
    assert.deepEqual(await state(page), submerged);
    assert.match(await command(page, 'wait'), /can't hold your breath much longer/);
    assert.equal((await state(page)).turns, submerged.turns + 2);
    await snapshot(page, 'breath-warning-mobile');
    await page.reload(); await resume(page);
    assert.match(await command(page, 'wait'), /claw your way to the surface/);
    assert.equal((await state(page)).room, 'reservoir');
    assert.equal((await state(page)).counters.ranch_breath_remaining, 0);
    await snapshot(page, 'breath-surfaced-mobile');
    receipts.push({ case: 'failed-direction-unknown-wait-warning-resume-surface-mobile', pass: true });
    await context.close();
  }
  {
    const { page, context } = await open('under_windmill');
    await command(page, 'up'); await command(page, '屏息');
    const before = await state(page);
    await command(page, 'take the pair of binoculars');
    assert.equal((await state(page)).turns, before.turns);
    assert.equal((await state(page)).counters.ranch_breath_remaining, 1);
    await page.reload(); await resume(page);
    assert.match(await command(page, 'down'), /sink below the surface[\s\S]*claw your way to the surface/);
    assert.equal((await state(page)).room, 'reservoir');
    await snapshot(page, 'held-breath-collapse-resume');
    receipts.push({ case: 'hold-collapse-resume-dive-immediate-surface', pass: true });
    await context.close();
  }
  {
    const { page, context } = await open('under_windmill');
    await command(page, 'up'); await command(page, 'hold breath');
    const before = await state(page);
    assert.match(await command(page, 'listen to landing'), /sagging dangerously[\s\S]*CRACK!/);
    assert.equal((await state(page)).turns, before.turns + 1);
    assert.equal((await state(page)).counters.ranch_breath_remaining, 1);
    await page.reload(); await resume(page);
    assert.match(await command(page, 'down'), /sink below the surface[\s\S]*claw your way to the surface/);
    assert.equal((await state(page)).room, 'reservoir');
    await snapshot(page, 'breath-queued-after-platform');
    receipts.push({ case: 'platform-before-breath-listen-collapse-order', pass: true });
    await context.close();
  }
  {
    const { page, context } = await open('under_windmill');
    await command(page, 'hold breath'); await command(page, 'up');
    await page.reload(); await resume(page);
    await command(page, 'listen to landing');
    assert.equal((await state(page)).counters.ranch_breath_remaining, 1);
    assert.match(await command(page, 'wait'), /CRACK![\s\S]*involuntary gasp/);
    assert.equal((await state(page)).counters.ranch_breath_remaining, 0);
    assert.match(await command(page, 'down'), /holding your breath first/);
    assert.equal((await state(page)).room, 'underwater');
    await snapshot(page, 'platform-queued-after-breath');
    receipts.push({ case: 'breath-before-platform-resume-order', pass: true });
    await context.close();
  }
  {
    const { page, context } = await open('under_windmill');
    await command(page, 'up'); await command(page, 'down');
    for (let index = 0; index < 3; index++) await command(page, 'wait');
    assert.equal((await state(page)).counters.ranch_landing_life, 3);
    await page.reload(); await resume(page);
    assert.match(await command(page, 'up'), /wooden moan/);
    assert.match(await command(page, '听平台'), /sagging dangerously[\s\S]*CRACK!/);
    assert.equal((await state(page)).room, 'reservoir');
    await snapshot(page, 'landing-pause-listen-collapse');
    receipts.push({ case: 'pause-resume-listen-timer-collapse', pass: true });
    await context.close();
  }
  assert.deepEqual(errors, []);
} finally {
  await writeFile(resolve(out, 'result.json'), JSON.stringify({ receipts, errors, resourceErrors }, null, 2));
  await browser.close();
}
console.log(JSON.stringify({ passed: receipts.length, errors: errors.length, out }));
