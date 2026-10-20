// Actual main.js and DOM commands, isolated browser contexts.
// Single-mechanism save fixtures verify this remake, not fresh original-game routes.
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
const out = resolve(option('--out', '/tmp/trinity-t23-animals-browser'));
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: option('--channel', undefined) });
const key = `trinity-relit:save:v${SAVE_VERSION}`, oldKey = 'trinity-relit:save:v2';
const errors = [], resourceErrors = [], receipts = [];

function seed({ animal = 'lemming', room = 'edge_reservoir', light = true, legacy = false, snakeHistory = false, bagLight = false } = {}) {
  const s = new GameState();
  for (const [id, item] of Object.entries(ITEMS)) if (item.start) s.moveItem(id, item.start);
  s.chapter = 'ranch'; s.room = room; s.visited.add(room);
  s.score = 20; s.turns = 100;
  s.setFlag('prologue_done'); s.setFlag('chapter_ranch_entered'); s.setFlag('cage_taken_scored');
  for (const id of ['lemming', 'roadrunner', 'magpie']) { s.destroy(id); s.animals[id].active = false; }
  s.take('cage');
  if (light) s.take('splinter'); else s.destroy('splinter');
  if (bagLight) s.take('empty_bag');
  s.putIn(animal, 'cage'); s.animals[animal].active = true;
  if (animal === 'lemming') { s.setFlag('animal_lemming_discovered'); s.setFlag('cage_lemming_scored'); }
  if (animal === 'roadrunner') { s.animals.roadrunner.prepared = true; s.animals.roadrunner.takeable = true; s.setFlag('roadrunner_tower_met'); }
  if (room === 'closet') { s.setFlag('snake_started'); s.setCnt('snake_delay', 1); s.setFlag('closet_door_closed'); }
  const save = { version: SAVE_VERSION, state: s.serialize() };
  if (legacy) {
    save.version = 2; delete save.state.animals;
    for (const id of ['magpie', 'roadrunner', 'dead_magpie', 'dead_roadrunner', 'dead_lemming']) delete save.state.itemLoc[id];
    save.state.itemLoc.lemming = 'cage'; save.state.flags.push('cage_has_lemming');
    if (snakeHistory) { save.state.flags.push('snake_killed_lemming', 'lemming_dead'); save.state.itemLoc.lemming = 'assembly_room'; }
  }
  return save;
}

async function open(options = {}) {
  const context = await browser.newContext({ viewport: options.narrow ? { width: 390, height: 844 } : { width: 1280, height: 1000 } });
  const save = options.save || seed(options);
  await context.addInitScript(({ save, key, oldKey, legacy, origin }) => {
    if (location.origin !== origin) return;
    if (!sessionStorage.getItem('animal-test-seeded')) {
      localStorage.setItem(legacy ? oldKey : key, JSON.stringify(save));
      localStorage.setItem('trinity-relit:settings:v1', JSON.stringify({ semantic: 'off' }));
      sessionStorage.setItem('animal-test-seeded', 'true');
    }
    window.render_game_to_text = () => localStorage.getItem(key);
    window.advanceTime = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  }, { save, key, oldKey, legacy: options.legacy, origin: new URL(url).origin });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => {
    if (response.status() < 400) return;
    const entry = { status: response.status(), url: response.url() }; resourceErrors.push(entry);
    if (new URL(response.url()).pathname !== '/favicon.ico') errors.push(`HTTP ${entry.status}: ${entry.url}`);
  });
  await page.goto(url); await resume(page);
  return { context, page };
}
const ready = page => page.waitForFunction(() => document.querySelector('#input')?.disabled === false);
async function resume(page) { await page.getByRole('button', { name: '继续上次冒险', exact: true }).click(); await ready(page); }
async function reload(page) { await page.reload(); await resume(page); }
const state = page => page.evaluate(() => JSON.parse(window.render_game_to_text()).state);
async function command(page, input, { death = false } = {}) {
  const before = await page.locator('#output > div').count();
  await page.locator('#input').fill(input); await page.locator('#input').press('Enter');
  if (death) await page.waitForFunction(() => document.querySelector('#output')?.textContent.includes('annihilates much of the state of New Mexico'));
  else await ready(page);
  return (await page.locator('#output > div').allTextContents()).slice(before).join('\n');
}
async function snapshot(page, name) {
  await page.evaluate(async () => { const output = document.querySelector('#output'); output.style.scrollBehavior = 'auto'; output.scrollTop = output.scrollHeight; await window.advanceTime(0); });
  await page.screenshot({ path: resolve(out, `${name}.png`) });
  await writeFile(resolve(out, `${name}.json`), JSON.stringify({ saved: JSON.parse(await page.evaluate(() => window.render_game_to_text())), text: await page.locator('#output').innerText() }, null, 2));
}
async function recoverCorpse(page, animal) {
  assert.equal((await state(page)).itemLoc[animal], 'destroyed');
  assert.equal((await state(page)).itemLoc[`dead_${animal}`], 'in:cage');
  assert.match(await command(page, `take dead ${animal}`), /can't reach into the birdcage/);
  await command(page, 'open cage'); await command(page, `take dead ${animal}`);
  assert.equal((await state(page)).itemLoc[`dead_${animal}`], 'inventory');
  assert.match(await command(page, `examine drowned ${animal}`), /Drowned, as a matter of fact/);
}

try {
  for (const animal of ['magpie', 'lemming', 'roadrunner']) {
    const { page, context } = await open({ animal, narrow: animal === 'roadrunner' });
    await command(page, 'in'); assert.equal((await state(page)).room, 'reservoir');
    await reload(page); await recoverCorpse(page, animal);
    assert.equal((await state(page)).score, 20);
    await snapshot(page, `ordinary-${animal}${animal === 'roadrunner' ? '-mobile' : ''}`);
    receipts.push(`ordinary-water-${animal}-reload-recover`); await context.close();
  }
  for (const platform of [false, true]) for (const animal of ['magpie', 'lemming', 'roadrunner']) {
    const { page, context } = await open({ animal, room: 'under_windmill' });
    await command(page, 'up'); if (platform) await command(page, 'drop cage');
    const before = await state(page);
    assert.match(await command(page, 'take binoculars'), /CRACK!/);
    let after = await state(page);
    assert.equal(after.turns, before.turns); assert.equal(after.itemLoc.cage, 'underwater');
    assert.equal(after.itemLoc[`dead_${animal}`], 'in:cage');
    await reload(page); await command(page, 'down'); await command(page, 'take cage'); await command(page, 'up');
    await recoverCorpse(page, animal);
    await snapshot(page, `${platform ? 'platform' : 'held'}-${animal}-collapse`);
    receipts.push(`${platform ? 'platform' : 'held'}-collapse-${animal}-reload-recover`); await context.close();
  }
  for (const light of [false, true]) {
    const { page, context } = await open({ room: 'closet', light, narrow: !light });
    const opened = await command(page, 'open cage');
    assert.match(opened, /plops? to the floor/); assert.equal((await state(page)).itemLoc.lemming, 'closet');
    await reload(page);
    assert.match(await command(page, 'open closet door'), /straight into the fangs/);
    let after = await state(page);
    assert.equal(after.itemLoc.lemming, 'destroyed'); assert.equal(after.itemLoc.dead_lemming, undefined);
    assert.ok(after.flags.includes('snake_gone')); assert.equal(after.score, 23);
    await snapshot(page, `closet-snake-${light ? 'lit' : 'dark-mobile'}-solved`);
    await reload(page); await command(page, 'close door'); await command(page, 'open door');
    assert.equal((await state(page)).score, 23);
    await snapshot(page, `closet-snake-${light ? 'lit' : 'dark-mobile'}`);
    receipts.push(`closet-${light ? 'lit' : 'dark'}-release-reload-snake-single-score`); await context.close();
  }
  {
    const { page, context } = await open({ animal: 'magpie', room: 'closet', bagLight: true });
    await command(page, 'put splinter in paper bag');
    assert.equal((await state(page)).itemLoc.splinter, 'in:empty_bag');
    await reload(page);
    assert.doesNotMatch(await command(page, 'look'), /completely dark/);
    assert.match(await command(page, 'open cage'), /circles around the inside of the closet/);
    assert.equal((await state(page)).flags.includes('cage_open'), false);
    assert.equal((await state(page)).itemLoc.magpie, 'in:cage');
    await snapshot(page, 'bag-light-description-and-magpie-consistent');
    receipts.push('closed-closet-visible-bag-light-description-and-magpie-branch-agree'); await context.close();
  }
  {
    const { page, context } = await open({ room: 'nw_room' });
    await command(page, 'e');
    const before = await state(page);
    await command(page, '未识别的任意胡话');
    assert.equal((await state(page)).turns, before.turns);
    assert.match(await command(page, 'look'), /strikes your ankle/);
    const bittenRaw = await page.evaluate(key => localStorage.getItem(key), key);
    assert.ok((await state(page)).flags.includes('snake_bitten'));
    await reload(page); assert.match(await command(page, 'look', { death: true }), /throbbing fire/);
    assert.equal(await page.evaluate(key => localStorage.getItem(key), key), bittenRaw);
    await snapshot(page, 'snake-bite-reload-death-live-save-protected');
    receipts.push('snake-unknown-no-turn-bite-reload-next-action-death-save-protected'); await context.close();
  }
  for (const snakeHistory of [false, true]) {
    const { page, context } = await open({ legacy: true, snakeHistory });
    let after = await state(page);
    assert.equal(await page.evaluate(oldKey => JSON.parse(localStorage.getItem(oldKey)).version, oldKey), 2);
    assert.equal(after.itemLoc.lemming, snakeHistory ? 'destroyed' : 'in:cage');
    if (snakeHistory) { assert.ok(after.flags.includes('snake_gone')); assert.equal(after.itemLoc.dead_lemming, undefined); }
    assert.ok(!after.flags.includes('cage_has_lemming'));
    await reload(page); assert.equal((await state(page)).itemLoc.lemming, after.itemLoc.lemming);
    await snapshot(page, `v2-${snakeHistory ? 'snake-history' : 'flat-cage'}-migration`);
    receipts.push(`v2-${snakeHistory ? 'snake-history' : 'flat-cage'}-migration-preserves-old-key`); await context.close();
  }
  assert.deepEqual(errors, []);
  await writeFile(resolve(out, 'result.json'), JSON.stringify({ evidenceKind: 'remake-single-mechanism-save-fixtures', receipts, errors, resourceErrors }, null, 2));
  console.log(JSON.stringify({ passed: receipts.length, errors: errors.length, out }));
} finally { await browser.close(); }
