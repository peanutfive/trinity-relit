// Optional real-UI integration check. Set PLAYWRIGHT_MODULE to an installed Playwright entry.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { SCENES } from '../scene-manifest.js';
import { findPath } from '../world.js';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const artifacts = process.env.QA_OUTPUT || '/tmp/trinity-hd2d-qa';
await mkdir(artifacts, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 1050 } });
const errors = [], receipts = [], routes = [], visited = new Set();
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
page.on('dialog', dialog => dialog.accept());
const state = async () => {
  const value = await page.evaluate(() => JSON.parse(window.render_game_to_text()));
  visited.add(value.room);
  return value;
};
async function drain() {
  for (let index = 0; index < 100; index++) {
    const s = await state();
    if (s.processing) { await page.waitForFunction(() => !JSON.parse(window.render_game_to_text()).processing); continue; }
    if (s.mode === 'dialogue') { await page.keyboard.press('f'); continue; }
    if (s.narrative.busy) { await page.click('#skip-event'); continue; }
    return;
  }
  throw new Error('Dialogue or narrative did not finish');
}
async function screenshot(name) { await page.screenshot({ path: `${artifacts}/${name}.png`, fullPage: true }); }
async function clickLogical(x, y) {
  const rect = await page.locator('canvas').boundingBox();
  assert.ok(rect, 'Game canvas is visible');
  await page.mouse.click(rect.x + x / 480 * rect.width, rect.y + y / 288 * rect.height);
}
// Choose an exit through the actual pointer UI. A route can pass another
// exit anchor, so approaching a distant exit with bare movement is ambiguous.
// The game keeps the clicked direction in walkExit until its safe path ends.
async function walk(dir, target) {
  await drain();
  const before = await state(), exit = before.exits.find(value => value.dir === dir);
  assert.ok(exit, `${before.room}: missing exit ${dir}`);
  assert.equal(exit.target, target, `${before.room}: unexpected target for ${dir}`);
  const path = findPath(SCENES[before.room], before.player, exit, { nearest: true });
  assert.ok(path.length, `${before.room}: no ground path toward exit ${dir}`);
  await page.evaluate(() => window.advanceTime(550));
  await clickLogical(exit.x, exit.y);
  for (let tick = 0; tick < 250; tick++) {
    const current = await state();
    if (current.room !== before.room) {
      assert.equal(current.room, target, `${before.room}: clicking ${dir} took another exit (${current.lastCommand})`);
      routes.push({ from: before.room, direction: dir, target });
      await drain();
      return;
    }
    if (!current.processing && current.mode === 'dialogue') {
      throw new Error(`${before.room}: exit ${dir} produced ${current.lastCommand}: ${current.dialogue?.text}`);
    }
    await page.evaluate(() => window.advanceTime(100));
  }
  const current = await state();
  throw new Error(`${before.room}: clicked exit ${dir} did not finish; feet=${current.player.x},${current.player.y}, navigation=${JSON.stringify(current.navigation)}`);
}
// Click the actual prop: the game itself finds a reachable standing point and
// performs its single current intention. No action-list buttons are consulted.
async function touch(object) {
  await drain();
  const before = await state();
  const keyboard=before.nearby===object.label;
  if(keyboard)await page.keyboard.press('f');
  else if(object.id==='vertex:ring')await clickLogical(286,132);
  else {
    // Click the painted prop, not the old universal ten-pixels-above-foot
    // point (which is above a seven-pixel-high paper boat, for example).
    const offset = { paper_boat: -3.5, paper_bird: -5.5, ball: -5, ruby: -4,
      headphones: 0, dish: -1.5, gnomon: -5, bag: -6, splinter: -8, sign: -17 }[object.kind] ?? -10;
    await clickLogical(object.x, object.y + offset);
  }
  for (let index = 0; index < 200; index++) {
    const s = await state();
    if (!s.processing && (s.mode === 'dialogue' || s.room !== before.room || s.turns > before.turns)) {
      assert.deepEqual(s.dialogue?.actions || [], [], 'Exploration must not expose action-menu buttons');
      receipts.push({ room: before.room, object: object.id, command: s.lastCommand, input: keyboard?'F':'pointer' });
      return s;
    }
    await page.evaluate(() => window.advanceTime(100));
  }
  throw new Error(`${before.room}: touching ${object.id} did not execute an intention`);
}
async function perform(command, { objectId } = {}) {
  for (let attempt = 0; attempt < 5; attempt++) {
    await drain();
    const s = await state();
    const object = s.objects.find(value => (!objectId || value.id === objectId) && value.actions.some(action => action.command === command));
    assert.ok(object, `${s.room}: no prop offers ${command}`);
    const after = await touch(object);
    if (after.lastCommand === command) return after;
    assert.match(after.lastCommand || '', /^(examine |read |look$|wait$)/, `Unexpected intention before ${command}`);
  }
  throw new Error(`Direct interaction never reached ${command}`);
}
async function hold(item, label) {
  await drain(); await page.keyboard.press('i');
  await page.getByRole('button', { name: label, exact: true }).click();
  assert.equal((await state()).heldItem, item);
  assert.equal((await state()).mode, 'exploring');
}
async function clearHand() {
  await drain();
  if ((await state()).heldItem) await page.click('#clear-hand');
  assert.equal((await state()).heldItem, null);
}

try {
  await page.goto(process.env.DEMO_URL || 'http://127.0.0.1:8080/2d-demo/');
  await page.waitForFunction(() => {
    const s = window.render_game_to_text && JSON.parse(window.render_game_to_text());
    return s?.art === 'loaded' && s.sprites === 'loaded' && s.wabeSprites === 'loaded' && (!s.heroArt || s.heroArt === 'loaded');
  });
  assert.equal((await state()).controls.interact,'f');
  assert.equal((await state()).controls.fullscreen,'F11');
  await page.click('#start'); await drain();
  await walk('e', 'flower_walk'); await perform('take ball'); await drain();
  assert.ok((await state()).inventory.includes('ball'));
  await walk('nw', 'the_wabe'); await perform('unscrew gnomon'); await perform('take gnomon');
  await walk('n', 'round_pond');
  const boat = (await state()).objects.find(object => object.kind === 'paper_boat');
  assert.ok(boat, 'The unidentified paper object is a small boat');
  assert.equal(boat.actions.some(action => action.command.startsWith('take ')), false);
  await perform('examine boats'); await drain();
  const paper = (await state()).objects.find(object => object.id === boat.id);
  assert.equal(paper.kind, 'paper_bird'); assert.deepEqual([paper.x, paper.y], [boat.x, boat.y]);
  await perform('take paper bird'); await hold('paper_bird', '纸鸟');
  await page.click('#held-item');
  assert.equal((await state()).lastCommand, 'examine paper bird');
  await clickLogical(240, 110); await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).flags.includes('bird_unfolded'));
  assert.equal((await state()).lastCommand, 'open paper bird');
  await clickLogical(240, 110); await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).lastCommand === 'read paper bird');
  await screenshot('paper-closeup'); await clearHand();

  await walk('w', 'broad_walk'); await perform('examine woman');
  await hold('coin', '七边硬币'); await perform('buy crumbs'); await clearHand();
  await hold('bag', '面包屑袋'); await perform('feed birds');
  await page.evaluate(() => window.advanceTime(1400)); await screenshot('prologue-feed'); await clearHand();
  await perform('take ruby'); await page.evaluate(() => window.advanceTime(1150));
  await screenshot('prologue-ruby-bird'); await drain(); assert.ok((await state()).flags.includes('wind_changed'));
  await walk('n', 'black_lion_gate'); await perform('open pram'); await perform('push pram'); await drain();
  assert.equal((await state()).room, 'inverness_terrace');
  await perform('push pram'); await drain(); assert.equal((await state()).room, 'lancaster_gate');
  await perform('wait', { objectId: 'lancaster_gate:woman' }); await drain();
  await hold('ball', '足球'); await perform('throw ball at tree'); await clearHand();
  await perform('take umbrella'); await perform('push pram'); await drain();
  assert.equal((await state()).room, 'lancaster_walk');
  await perform('enter pram'); await drain(); assert.ok((await state()).flags.includes('in_pram'));
  await hold('umbrella', '雨伞'); await page.click('#held-item'); await drain();
  assert.equal((await state()).room, 'long_water'); assert.equal((await state()).lastCommand, 'open umbrella');
  await clearHand(); await perform('take paper bird'); await perform('take gnomon'); await drain();
  await screenshot('prologue-long-water');
  await walk('s', 'wading'); await perform('enter door'); await drain();
  assert.equal((await state()).room, 'meadow'); assert.equal((await state()).chapter, 'wabe'); assert.equal((await state()).score, 15);
  await screenshot('prologue-finish');

  await walk('n', 'summit'); await screenshot('wabe-summit'); await walk('s', 'meadow');
  await walk('e', 'bottom_of_stairs'); await screenshot('wabe-stairs'); await perform('u'); await drain();
  assert.equal((await state()).room, 'vertex');
  const originalSymbol = (await state()).sundialSymbol;
  await perform('turn ring'); await page.evaluate(() => window.advanceTime(180)); await screenshot('wabe-ring'); await drain();
  for (let index = 0; index < 6; index++) { await perform('turn ring'); await drain(); }
  assert.equal((await state()).sundialSymbol, originalSymbol);
  await walk('d', 'bottom_of_stairs'); await walk('w', 'south_bog'); await perform('examine log'); await drain();
  await screenshot('wabe-bog'); await perform('take splinter'); await drain();
  assert.ok((await state()).inventory.includes('splinter'));
  await walk('n', 'north_bog'); await screenshot('wabe-north-bog'); await walk('s', 'south_bog');
  await walk('s', 'forest_clearing'); await walk('e', 'trellises'); await screenshot('wabe-trellises');
  await walk('n', 'bottom_of_stairs'); await walk('w', 'south_bog'); await walk('n', 'north_bog'); await walk('se', 'bottom_of_stairs');

  // Save the actual result, then verify continuation and file transfer in the UI.
  await page.keyboard.press('Escape'); await page.getByRole('tab', { name: '探索进度' }).click();
  const beforeSave = await state();
  await page.click('#save-now'); await screenshot('wabe-save-menu');
  const downloadEvent = page.waitForEvent('download'); await page.click('#export-save');
  await (await downloadEvent).saveAs(`${artifacts}/hd2d-export.json`);
  await page.reload(); await page.waitForFunction(() => window.render_game_to_text);
  await page.click('#continue-save');
  await page.waitForFunction(room => JSON.parse(window.render_game_to_text()).room === room && !JSON.parse(window.render_game_to_text()).processing, beforeSave.room);
  await drain();
  const restored = await state();
  for (const key of ['room', 'sundialSymbol', 'turns']) assert.equal(restored[key], beforeSave[key], key);
  for (const key of ['inventory', 'flags', 'observed', 'discovery']) assert.deepEqual(restored[key], beforeSave[key], key);
  assert.ok(restored.inventory.includes('splinter'));
  await page.keyboard.press('Escape'); await page.getByRole('tab', { name: '探索进度' }).click();
  const validSave = await page.evaluate(() => localStorage.getItem('trinity-relit:hd2d:save:v1'));
  await page.locator('#save-file').setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{bad') });
  await page.waitForFunction(() => document.querySelector('#save-message').textContent.includes('无法读取'));
  assert.equal((await state()).room, beforeSave.room);
  assert.equal(await page.evaluate(() => localStorage.getItem('trinity-relit:hd2d:save:v1')), validSave);
  await page.locator('#save-file').setInputFiles(`${artifacts}/hd2d-export.json`);
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode !== 'paused'); await drain();
  const imported = await state();
  for (const key of ['room', 'sundialSymbol', 'turns']) assert.equal(imported[key], beforeSave[key], key);
  for (const key of ['inventory', 'flags', 'observed', 'discovery']) assert.deepEqual(imported[key], beforeSave[key], key);
  assert.deepEqual(errors, []);
  await writeFile(`${artifacts}/result.json`, JSON.stringify({ pass: true, visited: [...visited], receipts, routes, errors }, null, 2));
  console.log('PASS: direct exploration and held items complete prologue→Wabe eight rooms, paper observation/unfold/read, seven ring turns, splinter pickup, continuation/export/import and invalid import protection; no page errors.');
} catch (error) {
  await screenshot('failure').catch(() => {});
  const current = await state().catch(() => null);
  await writeFile(`${artifacts}/failure.json`, JSON.stringify({ error: error.message, state: current, receipts, routes, errors }, null, 2));
  throw error;
} finally { await browser.close(); }
