// Browser QA from normal ferry/islet play. Supply PLAYED_LEGACY_ISLET separately
// to verify a genuine pre-tower shortcut from a historical build.
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { pointerCenter, setIslandDial } from './browser-islet-route.mjs';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const url = process.env.DEMO_URL || 'http://127.0.0.1:8080/2d-demo/';
const output = process.env.QA_OUTPUT || join(tmpdir(), 'trinity-roadrunner');
const upstream = join(output, 'normal-island-route');
const played = process.env.PLAYED_ISLET_SAVE;
const source = played || join(upstream, 'islet-pre-door-played.json');
const legacy = process.env.PLAYED_LEGACY_ISLET;
const approachOnly = process.argv.includes('--approach-only');
const withOptics = process.argv.includes('--with-optics');
await mkdir(output, { recursive: true });
if (!played) {
  const script = fileURLToPath(new URL('./browser-islet.mjs', import.meta.url));
  await promisify(execFile)(process.execPath, [script], {
    env: { ...process.env, DEMO_URL: url, QA_OUTPUT: upstream },
  });
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, hasTouch: true });
page.setDefaultTimeout(8000);
const errors = [];
const steps = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
page.on('response', res => { if (res.status() >= 400) errors.push(res.status() + ' ' + res.url()); });

const state = () => page.evaluate(() => JSON.parse(window.render_game_to_text()));
const tick = ms => page.evaluate(ms => window.advanceTime(ms), ms);
const foot = ({ player }) => [player.x, player.y, player.facing];
const shot = label => page.screenshot({ path: join(output, label + '.png') });
const usePhone = active => page.setViewportSize(active ? { width:390, height:844 } : { width:1440, height:900 });
const item = (s, id) => s.objects.find(object => object.itemId === id);
const story = ({ room, turns, inventory, flags, score, dead }) => ({ room, turns, inventory, flags, score, dead });

async function until(check, reason) {
  for (let i = 0; i < 165; i++) {
    const s = await state();
    if (check(s)) return s;
    await tick(75);
  }
  const s = await state();
  throw Error(`${reason}: ${s.room} · ${foot(s)} · ${s.lastCommand}`);
}

async function drain() {
  const pages = [];
  for (let i = 0; i < 80; i++) {
    const s = await until(s => !s.processing, '等待输入结算');
    if (s.narrative.busy) await tick(100);
    else if (s.mode === 'dialogue') {
      if (s.dialogue?.text) pages.push(s.dialogue.text);
      await page.locator('#next').click();
    } else return { state: s, pages };
  }
  throw Error('对白未结束');
}

async function click([x, y], touch = false) {
  const canvas = await page.locator('canvas').boundingBox();
  assert.ok(canvas);
  const position = [canvas.x + x / 480 * canvas.width, canvas.y + y / 288 * canvas.height];
  if (touch) await page.touchscreen.tap(...position);
  else await page.mouse.click(...position);
}

async function hold(keys, ms) {
  for (const key of keys) await page.keyboard.down(key);
  try { await tick(ms); }
  finally { for (const key of keys) await page.keyboard.up(key); }
}

async function moveTo([x, y]) {
  const { state: before } = await drain();
  const marker = before.routeMarker;
  const covered = marker?.exit && x >= marker.left && x <= marker.left + marker.width &&
    y >= marker.top && y <= marker.top + marker.height;
  if (covered) {
    for (let i = 0; i < 100; i++) {
      const s = await state();
      assert.equal(s.room, before.room);
      const dx = x - s.player.x, dy = y - s.player.y;
      if (Math.hypot(dx, dy) < 5) break;
      const dirs = [];
      if (Math.abs(dx) > 2) dirs.push(dx > 0 ? 'd' : 'a');
      if (Math.abs(dy) > 2) dirs.push(dy > 0 ? 's' : 'w');
      await hold(dirs, 25);
    }
  } else await click([x, y]);
  const s = await until(candidate => !candidate.processing && !candidate.navigation.path.length, '未走到画面脚点');
  assert.deepEqual(story(s), story(before), '点击地面只移动脚步');
  assert.ok(Math.hypot(s.player.x - x, s.player.y - y) < 7, `${s.room}: ${foot(s)} 未靠近 ${x},${y}`);
}

async function run(command, target, input, options = {}) {
  const { state: before } = await drain();
  await input();
  const changed = await until(s => !s.processing && s.turns > before.turns, '未执行 ' + command);
  assert.equal(changed.lastCommand, command);
  assert.equal(changed.room, target);
  if (options.ferryWait) assert.ok([1,2,4].includes(changed.turns - before.turns));
  else assert.equal(changed.turns, before.turns + 1);
  assert.equal(changed.score, before.score + (options.points || 0));
  const dropped = Array.isArray(options.drop) ? options.drop : [options.drop];
  const inventory = before.inventory.filter(id => !dropped.includes(id));
  if (options.take) inventory.push(options.take);
  assert.deepEqual(changed.inventory.toSorted(), inventory.toSorted());
  assert.equal(changed.dead, false);
  if (before.room !== target) {
    assert.equal(changed.navigation.arrival?.fromRoom, before.room);
    if (options.entrance) assert.equal(changed.navigation.arrival?.entrance, options.entrance);
    if (options.label === 'walking') assert.equal(changed.navigation.arrival?.matched, true);
    assert.equal(changed.art, 'loaded');
  }
  if (options.shot) await shot(options.shot);
  if (options.beat) {
    const { name, elapsed, image, room, actor } = options.beat;
    const frame = await until(s => s.narrative.currentEvent === name && s.narrative.elapsed >= elapsed,
      '未显示动画中段 ' + name);
    assert.equal(frame.narrative.sceneRoom, room);
    if (actor) assert.ok(frame.narrative.groundActors.some(o => o.id === actor));
    await shot(image);
    steps.push({ input: 'animation-frame', name, elapsed: frame.narrative.elapsed, room, image });
  }
  const result = await drain();
  steps.push({ command, from: before.room, to: target, input: options.label, foot: foot(changed),
    turns: [before.turns, changed.turns], score: changed.score, pages: result.pages.length });
  return result;
}

async function pressF(command, target, options = {}) {
  return run(command, target, () => page.keyboard.press('f'), { ...options, label: 'F' });
}

async function tap(command, target, point, options = {}) {
  return run(command, target, () => click(point, Boolean(options.touch)), {
    ...options, label: options.touch ? 'touch' : 'click',
  });
}

const directions = { n: ['w'], ne: ['w','d'], e: ['d'], se: ['s','d'], s: ['s'], w: ['a'], nw: ['w','a'] };
async function road(dir, target, entrance, waypoints, keys = directions[dir], beat) {
  const from = (await state()).room;
  assert.ok((await state()).exits.some(exit => exit.dir === dir && exit.target === target && !exit.interactionOnly));
  for (const point of waypoints) await moveTo(point);
  await tick(510);
  const travel = async () => {
    for (const key of keys) await page.keyboard.down(key);
    try { await until(s => s.room !== from && !s.processing, `走 ${dir} 后没有到达 ${target}`); }
    finally { for (const key of keys) await page.keyboard.up(key); }
  };
  return run(dir, target, travel, { entrance, label: 'walking', beat });
}

async function importPlayed(file) {
  const saved = JSON.parse(await readFile(file, 'utf8')).engine.state;
  await drain();
  await page.keyboard.press('Escape');
  await page.getByRole('tab', { name: '探索进度' }).click();
  await page.locator('#save-file').setInputFiles(file);
  const s = await until(value => value.mode !== 'paused' && value.room === saved.room && !value.processing, '导入正式存档失败');
  assert.equal(s.turns, saved.turns);
  assert.equal(s.score, saved.score);
  assert.equal(s.dead, false);
  steps.push({ input: 'import', source: file, room: s.room, turn: s.turns });
  return drain();
}

async function checkpoint(label, reload = true) {
  const { state: before } = await drain();
  await page.keyboard.press('Escape');
  await page.getByRole('tab', { name: '探索进度' }).click();
  await page.locator('#save-now').click();
  const downloaded = page.waitForEvent('download');
  await page.locator('#export-save').click();
  const file = join(output, label + '.json');
  await (await downloaded).saveAs(file);
  if (reload) {
    await page.reload();
    await page.locator('#continue-save').click();
    await until(s => !s.processing && s.room === before.room && s.art === 'loaded', '刷新后无法恢复');
    const { state: restored } = await drain();
    assert.deepEqual(story(restored), story(before));
    assert.deepEqual(foot(restored), foot(before));
    assert.deepEqual(restored.objects.map(o => o.id).sort(), before.objects.map(o => o.id).sort());
    assert.deepEqual(restored.roadrunner, before.roadrunner);
  } else await page.keyboard.press('Escape');
  steps.push({ input: reload ? 'save-reload' : 'save', label, room: before.room, turn: before.turns });
  return JSON.parse(await readFile(file, 'utf8')).engine.state;
}

async function examineGate() {
  const { state: before } = await drain();
  const gate = before.objects.find(o => o.id === 'islet:gate');
  assert.ok(gate);
  const read = gate.actions.find(action => action.command.startsWith('examine '));
  if (!before.observed.includes(gate.id) && read) {
    await tap(read.command, 'islet', [363,135], { touch:true });
  }
}

async function alignAClosedStart() {
  await usePhone(true);
  await examineGate();
  const denied = await tap('enter door', 'islet', [363,135], { touch:true });
  assert.match(denied.pages.join(' '), /关着/);
  await page.keyboard.press('Escape');
  await page.getByRole('tab', { name: '探索进度' }).click();
  await page.locator('#return-to-ferry-shore').click();
  await until(s => s.room === 'the_river' && !s.processing && s.mode !== 'paused', '回到真正登船前');
  await drain();
  await usePhone(false);
  await road('nw', 'bottom_of_stairs', 'se', [[212,155],[155,132],[119,106],[81,65],[53,30]]);
  await tap('u','vertex',[245,102],{entrance:'d'});
  await setIslandDial({
    state,
    tap: (point, command) => tap(command, 'vertex', point),
  }, 7);
  await tap('d','bottom_of_stairs',[200,222],{entrance:'u'});
  await road('se','the_river','nw',[[335,196],[403,221],[440,233]],['d']);
  for (let i = 0; i < 10 && !(await state()).ferry.docked; i++) {
    await run('wait','the_river', () => page.keyboard.press('r'), { label: 'R', ferryWait: true });
  }
  const atShore = await state();
  assert.ok(atShore.ferry.docked);
  await usePhone(true);
  const dory = atShore.objects.find(o => o.id === 'the_river:ferry');
  const aboard = await tap('enter dory','the_river',pointerCenter(dory), { touch: true });
  assert.ok(aboard.state.ferry.onboard);
  await page.keyboard.press('i');
  await page.getByRole('button', { name:'银币', exact:true }).click();
  const oarsman = (await state()).objects.find(o => o.id === 'the_river:oarsman');
  await tap('give silver coin to oarsman','sand_bar',pointerCenter(oarsman),
    { touch:true, entrance:'ferry', drop:'silver_coin' });
  await usePhone(false);
  const beat = approachOnly ? undefined : {
    name:'companion_door', elapsed:.58, room:'islet', image:'roadrunner-crosses-white-door', actor:'companion:arrival',
  };
  await road('s','islet','n',[[210,255]],undefined,beat);
  assert.ok((await state()).isletDoor.aligned);
  await checkpoint('aligned-islet-before-door', false);
}

async function isletGate(target) {
  const { state: atIslet } = await drain();
  assert.equal(atIslet.room, 'islet');
  if (!atIslet.isletDoor.open && target === 'shack') await alignAClosedStart();
  const before = (await drain()).state;
  assert.ok(before.isletDoor.open);
  assert.equal(before.isletDoor.legacy, target === 'shallow_crater');
  await usePhone(true);
  await examineGate();
  const result = await tap('enter door', target, [363,135], { touch:true, entrance:'door' });
  await usePhone(false);
  return result;
}

async function passage(dir, target, entrance, point, useF = false, beat) {
  const s = (await drain()).state;
  const obj = s.objects.find(o => o.id === `${s.room}:passage:${dir}`);
  assert.ok(obj, '缺少画面通行位置 ' + dir);
  if (useF) {
    await moveTo(point);
    const toward = { u:'w', d:'s', w:'a' }[dir];
    await hold([toward], 14);
    assert.equal((await state()).nearby, obj.label);
    return pressF(dir, target, { entrance, beat });
  }
  return tap(dir, target, point || pointerCenter(obj), { entrance, beat });
}

async function reachLanding() {
  const reached = await isletGate('shack');
  assert.ok(!item(reached.state, 'ruby'));
  await shot('shack-after-white-door');
  const platform = await passage('w', 'tower_platform', 'e');
  assert.ok(!item(platform.state, 'ruby'));
  const landing = await passage('d', 'tower_landing', 'u');
  assert.ok(!item(landing.state, 'ruby'));
  await shot('landing-before-first-meeting');
  if (approachOnly) await checkpoint('tower-landing-played', false);
}

const bird = s => s.objects.find(o => o.id === 'companion:roadrunner');

function assertBird(s, present, birdRoom) {
  assert.equal(Boolean(bird(s)), present, s.room + ' 走鹃应' + (present ? '出现' : '留在别处'));
  assert.equal(Boolean(s.roadrunner?.visible), present);
  if (birdRoom) assert.equal(s.roadrunner?.birdRoom, birdRoom);
}

async function observeBird(phone = false) {
  const { state: before } = await drain();
  const target = bird(before);
  assert.ok(target);
  if (phone) await usePhone(true);
  const command = target.actions.find(action => action.command.startsWith('examine '))?.command;
  assert.ok(command);
  const result = await tap(command, before.room, pointerCenter(target), { touch:phone, shot:phone ? 'phone-roadrunner-observation' : undefined });
  assertBird(result.state, true, before.room);
  assert.match(result.pages.join(' '), /走鹃|细长|长尾|明亮/);
  if (phone) await usePhone(false);
}

async function dropRuby() {
  const before = (await drain()).state;
  assert.equal(before.inventory.filter(id => id === 'ruby').length,1);
  await page.keyboard.press('i');
  await page.getByRole('button', {name:'红宝石',exact:true}).click();
  return run('drop ruby', before.room, async () => {
    await page.keyboard.press('i');
    await page.locator('#inventory-drop').click();
  }, { drop:'ruby', label:'inventory' });
}

async function verifyRuby() {
  const initial = (await drain()).state;
  const gem = item(initial, 'ruby');
  assert.equal(gem?.id, 'base_of_tower:box-ruby');
  assert.equal(initial.objects.filter(o => o.itemId === 'ruby').length, 1);
  assert.equal(initial.roadrunner.rubyOnBox, true);
  assert.ok(!initial.inventory.includes('ruby'));
  assert.ok(Math.hypot(pointerCenter(gem)[0]-190, pointerCenter(gem)[1]-161) < 5);
  await shot('ruby-visible-on-box');
  const saved = await checkpoint('tower-box-ruby-before-collect');
  assert.equal(saved.itemLoc.ruby, 'tower_ruby_box');

  if (!(await state()).observed.includes(gem.id)) {
    await tap('examine ruby', 'base_of_tower', [190,161]);
  }
  if ((await state()).nearby !== gem.label) {
    await moveTo([193,187]);
    await hold(['w'],20);
  }
  assert.equal((await state()).nearby, gem.label, '从已画箱沿可按 F 取宝石');
  const pickup = await pressF('take ruby','base_of_tower',{take:'ruby',points:1});
  assert.equal(pickup.state.roadrunner.rubyOnBox,false);
  assert.ok(!item(pickup.state,'ruby'));
  const after = await checkpoint('tower-box-ruby-collected');
  assert.equal(after.itemLoc.ruby,'inventory');
  assert.equal(after.score, initial.score + 1);

  const dropped = await dropRuby();
  const floor = item(dropped.state,'ruby');
  assert.ok(floor && floor.id !== gem.id, '再次放下只出现在地面');
  assert.equal(dropped.state.roadrunner.rubyOnBox, false);
  if (!(await state()).observed.includes(floor.id)) {
    const inspect = floor.actions.find(a => a.command.startsWith('examine '))?.command;
    if (inspect) await tap(inspect,'base_of_tower',pointerCenter(floor));
  }
  const pickedAgain=await tap('take ruby','base_of_tower',pointerCenter(floor),{take:'ruby'});
  assert.equal(pickedAgain.state.score, initial.score+1);
  assert.ok(!item(pickedAgain.state,'ruby'));

  await selectItem('红宝石','ruby');
  const box = (await state()).objects.find(o => o.actions.some(action => action.command === 'put ruby on box'));
  assert.ok(box, '拿着红宝石时能把它放回箱盖');
  const replace = await tap('put ruby on box','base_of_tower',pointerCenter(box),{drop:'ruby'});
  assert.ok(replace.state.roadrunner.rubyOnBox);
  const replaced = item(replace.state,'ruby');
  assert.equal(replaced?.id, gem.id);
  await shot('ruby-back-on-same-box');
  const retaken = await tap('take ruby','base_of_tower',pointerCenter(replaced),{take:'ruby'});
  assert.equal(retaken.state.score, initial.score + 1);
  assert.ok(!retaken.state.roadrunner.rubyOnBox);
}

async function testFirstMeeting() {
  assertBird(await state(),false);
  assert.equal((await state()).roadrunner?.alreadyCrossed,true);
  await checkpoint('bird-waiting-at-tower-foot');
  const first=await passage('d','base_of_tower','u',undefined,false,{
    name:'companion_drop', elapsed:.59, room:'base_of_tower', image:'tower-ruby-mid-fall', actor:'companion:falling-ruby',
  });
  assert.match(first.pages.join(' '), /走鹃/);
  assert.equal(first.state.roadrunner?.joined,true);
  assertBird(first.state,true,'base_of_tower');
  const companion = bird(first.state);
  const comparison = [companion.x - first.state.player.x, companion.y - first.state.player.y];
  assert.ok(Math.abs(comparison[0]) >= 18 || comparison[1] >= 0,
    '走鹃落稳后应露出在主角一侧');
  steps.push({ input:'first-meeting-feet', player:foot(first.state), bird:[companion.x,companion.y] });
  await shot('tower-first-meeting');
  await verifyRuby();
  await observeBird(true);
}

const craterToRanch = [[286,194],[307,210],[339,219],[362,234],[392,253]];
const ranchEast = [[193,102],[248,90],[351,89],[438,88]];
const ranchSouth = [[249,157],[254,201],[249,248]];
const frontToWater = [[221,153],[250,176],[279,183],[309,194],[352,213],[389,230],[424,246]];
const southToWindmill = [[298,145],[338,133],[374,116],[410,85],[437,53],[446,42]];

async function courtyardRoute() {
  const oldScore=(await state()).score;
  const crater=await road('se','shallow_crater','nw',[[408,256]]);
  assertBird(crater.state,true,'shallow_crater');
  const base=await road('nw','base_of_tower','se',[[43,129]],['w','d']);
  assertBird(base.state,true,'base_of_tower');
  assert.equal(base.state.score,oldScore);
  assert.ok(!base.state.roadrunner.rubyOnBox && !item(base.state,'ruby'));
  await road('se','shallow_crater','nw',[[408,256]]);
  for (const [dir,destination,entrance,waypoints] of [
    ['se','nw_ranch','nw',craterToRanch],
    ['e','ne_ranch','w',ranchEast],
    ['s','front_yard','n',ranchSouth],
  ]) assertBird((await road(dir,destination,entrance,waypoints)).state,true,destination);
  await shot('bird-at-front-yard');
  const slope=(await state()).objects.find(o=>o.label==='上坡' && o.actions.some(a=>a.command==='w'));
  const deck=await tap('w','front_deck',pointerCenter(slope),{entrance:'e'});
  assertBird(deck.state,true,'front_deck');
  const southeast=await road('s','se_yard','n',[[155,244]]);
  assertBird(southeast.state,true,'se_yard');
  await checkpoint('bird-at-southeast-yard');
  const north=(await road('n','front_deck','s',[[181,44]])).state;
  assertBird(north,true,'front_deck');
  const lower=north.objects.find(o=>o.label==='下坡' && o.actions.some(a=>a.command==='e'));
  assertBird((await tap('e','front_yard',pointerCenter(lower),{entrance:'w'})).state,true,'front_yard');
}

async function testNaturalStops() {
  const south=await road('se','south_reservoir','nw',frontToWater);
  assertBird(south.state,true,'south_reservoir');
  const edge=await passage('u','edge_reservoir','d',[237,151],true);
  assertBird(edge.state,false,'south_reservoir');
  await shot('bird-remains-on-south-bank');
  await checkpoint('bird-still-on-land-from-edge');
  const back=await passage('d','south_reservoir','u',[234,188],true);
  assertBird(back.state,true,'south_reservoir');
  await shot('bird-reunion-south-bank');
  const bottom=await road('ne','under_windmill','sw',southToWindmill);
  assertBird(bottom.state,true,'under_windmill');
  await shot('bird-waits-below-ladder');
  const deck=await passage('u','windmill','d',[269,178],true);
  assertBird(deck.state,false,'under_windmill');
  await checkpoint('bird-remains-below-ladder');
  const restored=await passage('d','under_windmill','u');
  assertBird(restored.state,true,'under_windmill');
  await shot('bird-reunion-windmill-ground');
}

async function selectItem(label, id) {
  await drain();
  await page.keyboard.press('i');
  await page.getByRole('button',{name:label,exact:true}).click();
  assert.equal((await state()).heldItem,id);
}

async function aimF(objectId, point, direction) {
  if (point) await moveTo(point);
  if (direction) await hold([direction],14);
  const s = (await drain()).state;
  const target=s.objects.find(o=>o.id===objectId);
  assert.ok(target, objectId);
  assert.equal(s.nearby,target.label);
}

async function followWindmillToShore() {
  const baseline = await checkpoint('natural-optics-start-under-windmill',false);
  assert.equal(baseline.room,'under_windmill');
  assert.equal(baseline.itemLoc.splinter,'inventory');
  assert.equal(baseline.itemLoc.binoculars,'windmill');
  await passage('u','windmill','d',[269,178],true);

  const glassesId='ranch:item:binoculars';
  const dropped = Object.entries(baseline.itemLoc).filter(([,location]) => location==='inventory').map(([id]) => id);
  await aimF(glassesId,[188,113],'a');
  const fell = await pressF('take binoculars','reservoir',{
    drop:dropped, beat:{name:'ranch_fall',elapsed:1.0,room:'windmill',image:'optics-fall-before-water'},
  });
  assertBird(fell.state,false,'under_windmill');
  assert.ok(fell.state.flags.includes('binoculars_broken'));
  assert.ok(!fell.state.inventory.includes('binoculars'));
  const water = await checkpoint('real-windmill-fall');
  assert.equal(water.itemLoc.splinter,'underwater');
  assert.equal(water.itemLoc.binoculars,'underwater');

  await aimF('reservoir:passage:d');
  const dived = await pressF('d','underwater');
  assertBird(dived.state,false,'under_windmill');
  assert.ok(item(dived.state,'binoculars'));
  await shot('optics-visible-in-lit-water');
  await aimF(glassesId,[306,174],'d');
  const got=await pressF('take binoculars','underwater',{take:'binoculars',points:1});
  assert.ok(!item(got.state,'binoculars'));
  await aimF('underwater:passage:u',[355,182]);
  await pressF('u','reservoir');
  await aimF('reservoir:passage:s',[238,192],'s');
  await pressF('s','edge_reservoir',{entrance:'n'});
  const ashore=await passage('d','south_reservoir','u',[234,188],true);
  assertBird(ashore.state,true,'south_reservoir');
  assert.equal(ashore.state.inventory.filter(id=>id==='binoculars').length,1);
  await checkpoint('normal-binoculars-back-on-south-shore');
}

async function testOptics() {
  await followWindmillToShore();
  const command='look at roadrunner through binoculars';
  await selectItem('望远镜','binoculars');
  await shot('binoculars-selected-on-south-shore');
  await usePhone(true);
  const target=bird(await state());
  const first=await tap(command,'south_reservoir',pointerCenter(target),{
    touch:true, beat:{name:'bird_optics',elapsed:1.0,room:'south_reservoir',image:'phone-first-bird-optics'},
  });
  assert.match(first.pages.join(' '),/调好焦距/);
  assert.match(first.pages.join(' '),/近了许多/);
  assert.ok(first.state.flags.includes('binoculars_focused_on_roadrunner'));
  await usePhone(false);
  await checkpoint('same-bird-optical-focus-saved');

  await selectItem('望远镜','binoculars');
  await aimF(target.id);
  const second=await pressF(command,'south_reservoir',{
    beat:{name:'bird_optics',elapsed:1.0,room:'south_reservoir',image:'F-repeat-bird-optics'},
  });
  assert.equal(second.pages.length,1);
  assert.match(second.pages[0],/近了许多/);
  assert.doesNotMatch(second.pages[0],/焦距/);
  assert.equal(second.state.score,first.state.score);
  assertBird(second.state,true,'south_reservoir');
}

async function testLegacyShortcut() {
  const loaded=await importPlayed(legacy);
  assert.equal(loaded.state.isletDoor.legacy,true);
  assert.equal(Boolean(loaded.state.roadrunner?.joined),false);
  const back=await isletGate('shallow_crater');
  assertBird(back.state,false);
  const tower=await road('nw','base_of_tower','se',[[43,129]],['w','d']);
  assertBird(tower.state,false);
  assert.equal(Boolean(tower.state.roadrunner?.joined),false);
  assert.ok(!item(tower.state,'ruby'));
  await shot('legacy-shortcut-no-bird-at-tower');
  await checkpoint('legacy-shortcut-untriggered');
  await road('se','shallow_crater','nw',[[408,256]]);
  const ranch=await road('se','nw_ranch','nw',craterToRanch);
  assertBird(ranch.state,false);
  assert.equal(Boolean(ranch.state.roadrunner?.joined),false);
  await shot('legacy-shortcut-no-bird-at-ranch');
}

try {
  await page.goto(url);
  await page.waitForFunction(() => window.render_game_to_text && JSON.parse(window.render_game_to_text()).art === 'loaded');
  await page.locator('#start').click();
  const { state: origin } = await importPlayed(source);
  assert.ok(origin.flags.includes('river_ferry_crossed'));
  assert.ok(!origin.inventory.includes('ruby'));
  if (!approachOnly && !origin.isletDoor.open) {
    assertBird(origin,true,'islet');
    assert.ok(origin.roadrunner.perched && origin.roadrunner.rubyInBeak);
    await shot('islet-roadrunner-ruby-perched');
  }
  await reachLanding();
  if (!approachOnly) {
    await testFirstMeeting();
    await courtyardRoute();
    await testNaturalStops();
    if (withOptics) await testOptics();
    if (legacy) await testLegacyShortcut();
  }
  assert.deepEqual(errors, []);
  await writeFile(join(output, 'result.json'), JSON.stringify({ pass: true, source, legacy, steps, errors }, null, 2));
  console.log(approachOnly ? '由真实小岛白门抵达棚屋和塔梯中段通过' : '塔脚初遇、红宝石、随行、驻留和真实新旧存档通过');
} catch (error) {
  await shot('failure').catch(() => {});
  await writeFile(join(output, 'failure.json'), JSON.stringify({
    message: error.message, current: await state().catch(() => null), steps, errors,
  }, null, 2));
  throw error;
} finally {
  await browser.close();
}
