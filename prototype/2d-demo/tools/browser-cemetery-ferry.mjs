// Produces a fresh browser-played Prologue checkpoint, then continues via the normal UI.
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { pointerCenter, setIslandDial, shackPassages } from './browser-islet-route.mjs';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const url = process.env.DEMO_URL || 'http://127.0.0.1:8080/2d-demo/';
const output = process.env.QA_OUTPUT || join(tmpdir(), 'trinity-cemetery-ferry');
const checkpointStage = process.argv.includes('--river-checkpoint') ? 'river' : process.argv.includes('--crater-checkpoint') ? 'crater' : null;
const prelude = join(output, 'fresh-prologue');
await mkdir(output, { recursive: true });
const smoke = fileURLToPath(new URL('./browser-smoke.mjs', import.meta.url));
if (!process.env.PLAYED_PROLOGUE_DIR) {
  await promisify(execFile)(process.execPath, [smoke], { env: { ...process.env, DEMO_URL: url, QA_OUTPUT: prelude } });
}
const sourcePrelude = process.env.PLAYED_PROLOGUE_DIR || prelude;
const prologue = JSON.parse(await readFile(join(sourcePrelude, 'result.json'), 'utf8'));
assert.equal(prologue.pass, true);
assert.deepEqual(prologue.errors, []);
const checkpoint = join(sourcePrelude, 'hd2d-export.json');
const exported = JSON.parse(await readFile(checkpoint, 'utf8'));
assert.equal(exported.engine.state.room, 'bottom_of_stairs');
for (const item of ['spade','shroud','bandage','silver_coin']) {
  assert.ok(!['inventory','pocket','worn'].includes(exported.engine.state.itemLoc[item]));
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, hasTouch: true });
page.setDefaultTimeout(8000);
const errors = [];
const receipts = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });

const state = () => page.evaluate(() => JSON.parse(window.render_game_to_text()));
const tick = ms => page.evaluate(ms => window.advanceTime(ms), ms);
const shot = name => page.screenshot({ path: join(output, `${name}.png`) });
const feet = ({ player }) => [player.x, player.y, player.facing];
const story = ({ room, chapter, turns, inventory, score, flags, sundialSymbol }) =>
  ({ room, chapter, turns, inventory, score, flags, sundialSymbol });

async function until(check, failure) {
  for (let step = 0; step < 180; step++) {
    const current = await state();
    if (check(current)) return current;
    await tick(85);
  }
  const { room, player, mode, navigation, lastCommand } = await state();
  throw Error(`${failure}: ${JSON.stringify({ room, player, mode, navigation, lastCommand })}`);
}

async function drain() {
  for (let step = 0; step < 65; step++) {
    const current = await until(s => !s.processing, '操作未结算');
    if (current.mode === 'dialogue') await page.keyboard.press('f');
    else if (current.narrative.busy) await tick(130);
    else return;
  }
  throw Error('叙事未结束');
}

async function clickAt([x, y], touch = false) {
  const canvas = await page.locator('canvas').boundingBox();
  assert.ok(canvas);
  const point = [canvas.x + x / 480 * canvas.width, canvas.y + y / 288 * canvas.height];
  if (touch) await page.touchscreen.tap(...point);
  else await page.mouse.click(...point);
}

async function walkTo(point) {
  const before = await state();
  const [x, y] = point;
  const marker = before.routeMarker;
  if (marker?.exit && x >= marker.left && x <= marker.left + marker.width
      && y >= marker.top && y <= marker.top + marker.height) {
    // When a route sign covers this sample, walk the last stretch on the ground.
    await walkUnderSign(point, before.room);
  } else {
    await clickAt(point);
  }
  const after = await until(s => {
    assert.equal(s.room, before.room, `中途路点 ${point} 引发意外换房`);
    return !s.processing && !s.navigation.path.length;
  }, `未走到画面采样点 ${point}`);
  assert.ok(Math.hypot(after.player.x - point[0], after.player.y - point[1]) <= 7,
    `${before.room} 没有到达地面点 ${point}，停在 ${feet(after)}`);
  assert.equal(after.turns, before.turns);
}

async function walkUnderSign([x, y], room) {
  for (let i = 0; i < 160; i++) {
    const current = await state();
    assert.equal(current.room, room);
    const dx = x - current.player.x, dy = y - current.player.y;
    if (Math.hypot(dx, dy) <= 4) return;
    const keys = [];
    if (Math.abs(dx) > 2) keys.push(dx > 0 ? 'd' : 'a');
    if (Math.abs(dy) > 2) keys.push(dy > 0 ? 's' : 'w');
    for (const key of keys) await page.keyboard.down(key);
    try { await tick(35); }
    finally { for (const key of keys) await page.keyboard.up(key); }
  }
  throw Error(`${room} 无法步行到标识下的 ${x},${y}`);
}

async function clickExit(dir, target) {
  await drain();
  const before = await state();
  const exit = before.exits.find(candidate => candidate.dir === dir);
  assert.equal(exit?.target, target);
  await tick(600);
  await clickAt([exit.x, exit.y]);
  await until(s => s.room === target && !s.processing, `${before.room}.${dir} 未到达 ${target}`);
  await drain();
}

async function pointerAction(objectId, point, command, target, touch = false) {
  for (let attempt = 0; attempt < 3; attempt++) {
    await drain();
    const before = await state();
    assert.ok(before.objects.some(object => object.id === objectId && object.actions.some(action => action.command === command)),
      `${before.room} 画中物件未提供 ${command}`);
    await clickAt(point, touch);
    const after = await until(s => !s.processing && (s.room !== before.room || s.turns > before.turns),
      `${objectId} 未响应点击`);
    if (after.lastCommand === command) {
      if (target) assert.equal(after.room, target);
      await drain();
      return;
    }
    assert.match(after.lastCommand || '', /^(examine |look$)/);
  }
  throw Error(`${objectId} 未执行 ${command}`);
}

async function approachF(point, direction, objectId) {
  await walkTo(point);
  await page.keyboard.down(direction);
  try { await tick(13); }
  finally { await page.keyboard.up(direction); }
  const current = await state();
  const object = current.objects.find(value => value.id === objectId);
  assert.ok(object);
  assert.equal(current.nearby, object.label);
}

async function pressF(command, target) {
  const before = await state();
  await page.keyboard.press('f');
  const after = await until(s => !s.processing && s.lastCommand === command && s.turns > before.turns,
    `F 未执行 ${command}`);
  assert.equal(after.room, target || before.room);
  assert.equal(after.turns, before.turns + 1);
  receipts.push({ from:before.room,to:after.room,command,input:'F',turn:after.turns,foot:feet(after) });
  await drain();
  return after;
}

async function exportProgress(path) {
  await page.keyboard.press('Escape');
  await page.getByRole('tab', { name: '探索进度' }).click();
  await page.locator('#save-now').click();
  const download = page.waitForEvent('download');
  await page.locator('#export-save').click();
  await (await download).saveAs(path);
  await page.keyboard.press('Escape');
  return JSON.parse(await readFile(path, 'utf8'));
}

async function importProgress(path, expectedRoom) {
  await drain();
  await page.keyboard.press('Escape');
  await page.getByRole('tab',{name:'探索进度'}).click();
  await page.locator('#save-file').setInputFiles(path);
  await until(s => !s.processing && s.room===expectedRoom && s.mode!=='paused', '实玩存档未恢复');
  await drain();
}


async function holdItem(name) {
  await page.keyboard.press('i');
  await page.getByRole('button',{name,exact:true}).click();
}
async function tapDirection(key) {
  await page.keyboard.down(key);
  try { await tick(18); }
  finally { await page.keyboard.up(key); }
}
async function travel(dir,to) {
  const from = await state();
  await clickExit(dir,to);
  const landed = await state();
  assert.equal(landed.turns,from.turns+1);
  receipts.push({from:from.room,dir,to,arrival:landed.navigation.arrival,turn:landed.turns});
}
async function dial(symbol) {
  await pointerAction('bottom_of_stairs:stairs', [245,102], 'u', 'vertex');
  assert.ok((await state()).objects.some(o=>o.id==='vertex:lever'),'前序实走应已装针，旧版来档沿用拉杆');
  for(let attempt=0;attempt<7&&(await state()).sundialSymbol!==symbol;attempt++)
    await pointerAction('vertex:ring',[286,132],'turn ring');
  assert.equal((await state()).sundialSymbol,symbol);
  await pointerAction('vertex:stairs',[200,222],'d','bottom_of_stairs');
}
async function record(label) {
  const s = await state();
  if (s.mode === 'inspect') {
    await inspection.locator('img').evaluate(async image => {
      await image.decode();
      if (image.naturalWidth < 480) throw Error('石棺特写未加载最终画面');
    });
  }
  receipts.push({label,room:s.room,turn:s.turns,player:s.player,inventory:s.inventory,
    flags:s.flags,objects:s.objects.map(o=>({id:o.id,item:o.itemId,actions:o.actions}))});
  await shot(label);
}

async function reachCemetery() {
  await page.goto(url);
  await page.waitForFunction(() => window.render_game_to_text && JSON.parse(window.render_game_to_text()).art === 'loaded');
  assert.equal((await state()).mode,'title');
  await page.locator('#start').click();
  await importProgress(checkpoint,exported.engine.state.room);
  assert.equal((await state()).turns,exported.engine.state.turns);
  await dial(1);
  await travel('e','the_bend');
  await travel('e','moor');
  await walkTo([319,109]);
  await tapDirection('d');
  await pressF('look');
  await pressF('in','playground');
  await walkTo([240,118]);
  await tapDirection('w');
  await pressF('wait');
  await holdItem('雨伞');
  await walkTo([235,166]);
  await tapDirection('d');
  await pressF('give umbrella to girl');
  await walkTo([421,151]);
  await tapDirection('d');
  await pressF('e','shelter');
  await record('shelter-before-spade');
  await walkTo([290,203]);
  await tapDirection('d');
  await pressF('examine spade');
  await pressF('take spade');
  assert.ok((await state()).inventory.includes('spade'));
  await record('shelter-spade-taken');
  await holdItem('纸鸟');
  await walkTo([230,158]);
  await tapDirection('d');
  await pressF('give paper to girl');
  await travel('w','playground');
  await holdItem('纸鸟');
  await page.locator('#held-item').click();
  await until(s=>!s.processing && s.room==='moor' && s.lastCommand==='ride bird','纸鸟回荒野失败');
  await drain();
  assert.ok((await state()).inventory.includes('spade'));
  await record('moor-with-spade');
  await page.locator('#clear-hand').click();
  await travel('n','craters_edge');
  await travel('nw','bluff');
  await travel('e','cottage');
  await travel('s','cemetery');
  await record('cemetery-with-spade');
}

async function reachRiver() {
  await pointerAction('cemetery:crypt',[240,62],'n','barrow');
  await record('barrow-current');
  await travel('s','cemetery');
  await travel('s','cottage');
  await travel('w','bluff');
  await travel('se','craters_edge');
  await travel('w','under_cliff');
  await travel('sw','bottom_of_stairs');
  await pointerAction('bottom_of_stairs:stairs',[245,102],'u','vertex');
  await setIslandDial({state,tap:(point,command)=>checkCommand(()=>clickAt(point),command)},checkpointStage==='river'?6:7);
  await record('shadow-prepared-for-crossing');
  await pointerAction('vertex:stairs',[200,222],'d','bottom_of_stairs');
  await travel('se','the_river');
  await record('river-before-board');
}

const inspection = page.locator('#crypt-inspection');
const detail = id => inspection.locator(`[data-detail="${id}"]`);

async function leaveInspection() {
  await inspection.locator('.crypt-leave').click();
  await inspection.waitFor({ state:'hidden' });
}

async function inspectCrypt() {
  await pressF('look in crypt');
  await inspection.waitFor({ state:'visible' });
}

async function checkCommand(input, command, points = 0, {turns = 1,crossing = false} = {}) {
  const before = await state();
  await input();
  const after = await until(s => !s.processing && s.lastCommand===command && s.turns>before.turns, `未完成 ${command}`);
  assert.equal(after.turns,before.turns+turns);
  assert.equal(after.score,before.score+points);
  receipts.push({ command,room:after.room,turn:after.turns,points });
  if (crossing) {
    const frame = await until(s => s.narrative.currentEvent==='ferry_crossing' && s.narrative.elapsed>=0.65,'渡船穿雾演出未播放');
    assert.equal(frame.narrative.sceneRoom,'the_river');
    assert.equal(frame.turns,after.turns);
    await shot('ferry-crossing-mid-fog');
  }
  await drain();
  return after;
}

async function selectDetail(id) {
  for (let attempt = 0; attempt < 8; attempt++) {
    if (await detail(id).evaluate(node => node === document.activeElement)) return;
    await page.keyboard.press('ArrowRight');
  }
  throw Error(`用方向键无法选到石棺细部 ${id}`);
}

async function reopen(name) {
  const before = await state();
  const previous = await exportProgress(join(output,`${name}.json`));
  await page.reload();
  await page.locator('#continue-save').click();
  await until(s => s.room===before.room && s.turns===before.turns && s.art==='loaded' && !s.processing, '真实存档未恢复');
  await drain();
  const after = await state();
  assert.deepEqual(story(after),story(before));
  assert.deepEqual(feet(after),feet(before));
  await record(name);
  return previous.engine.state;
}

async function approachCrypt() {
  await walkTo([197,151]);
  await tapDirection('a');
}

async function checkCryptReuse() {
  await holdItem('裹尸布');
  await checkCommand(() => detail('cover').click(),'put shroud on corpse');
  await checkCommand(() => detail('shroud').click(),'take shroud');
  await holdItem('银币');
  await checkCommand(() => detail('replaceCoin').click(),'put silver coin in mouth');
  await holdItem('绷带');
  await checkCommand(() => detail('bind').click(),'put bandage on corpse');
  assert.ok(!(await detail('mouth').isVisible()));
  assert.ok(!(await detail('coin').isVisible()));
  await checkCommand(() => detail('bandage').click(),'take bandage');
  assert.ok(!(await detail('coin').isVisible()));
  await checkCommand(() => detail('mouth').click(),'look in mouth');
  const retaken = await checkCommand(() => detail('coin').click(),'take silver coin');
  assert.equal(retaken.inventory.filter(id => id==='silver_coin').length,1);
}

async function testCrypt() {
  const coffinPoint = [179,125];
  await holdItem('铲子');
  await page.keyboard.press('i');
  await checkCommand(() => page.locator('#inventory-drop').click(),'drop spade');
  assert.ok(!(await state()).inventory.includes('spade'));
  await approachCrypt();
  await checkCommand(() => page.keyboard.press('f'),'examine crypt');
  const denied = await checkCommand(() => clickAt(coffinPoint),'open crypt');
  assert.match(denied.dialogue?.text,/力臂/);
  assert.ok(!denied.flags.includes('cemetery_crypt_open'));
  assert.equal(await inspection.isVisible(),false);
  await record('closed-crypt-without-spade');

  const spade = (await state()).objects.find(item => item.itemId==='spade');
  assert.ok(spade);
  await pointerAction(spade.id,[spade.pointerShape.x,spade.pointerShape.y],'take spade');
  await holdItem('铲子');
  await approachCrypt();
  const opened = await checkCommand(() => page.keyboard.press('f'),'open crypt with spade',3);
  assert.ok(opened.flags.includes('cemetery_crypt_open'));
  await page.locator('#clear-hand').click();
  await record('open-crypt-with-spade');

  await inspectCrypt();
  assert.ok(await detail('shroud').isVisible());
  assert.ok(await detail('bandage').isVisible());
  assert.ok(!(await detail('coin').isVisible()));
  await record('open-crypt-before-taking');
  await selectDetail('shroud');
  const shroud = await checkCommand(() => page.keyboard.press('f'),'take shroud',1);
  assert.ok(shroud.inventory.includes('shroud'));
  assert.ok(!(await detail('shroud').isVisible()));
  assert.ok(!(await detail('coin').isVisible()));
  await page.setViewportSize({width:390,height:844});
  const bandage = await checkCommand(() => detail('bandage').tap(),'take bandage');
  assert.ok(bandage.inventory.includes('bandage'));
  assert.ok(!(await detail('bandage').isVisible()));
  assert.ok(!(await detail('coin').isVisible()));
  await record('phone-crypt-no-coin-yet');
  await leaveInspection();
  await page.setViewportSize({width:1440,height:900});
  const intermediate = await reopen('cemetery-partly-searched');
  assert.equal(intermediate.itemLoc.shroud,'inventory');
  assert.equal(intermediate.itemLoc.bandage,'inventory');

  await inspectCrypt();
  assert.ok(!(await detail('shroud').isVisible()));
  assert.ok(!(await detail('bandage').isVisible()));
  assert.ok(!(await detail('coin').isVisible()));
  await page.setViewportSize({width:390,height:844});
  await checkCommand(() => detail('mouth').tap(),'look in mouth');
  assert.ok(await detail('coin').isVisible());
  await record('phone-coin-revealed');
  await page.setViewportSize({width:1440,height:900});
  await record('desktop-coin-revealed');
  await page.setViewportSize({width:390,height:844});
  const coin = await checkCommand(() => detail('coin').tap(),'take silver coin',1);
  assert.ok(coin.inventory.includes('silver_coin'));
  assert.ok(!(await detail('coin').isVisible()));
  await leaveInspection();
  await page.setViewportSize({width:1440,height:900});
  await inspectCrypt();
  assert.ok(!(await detail('coin').isVisible()));
  assert.equal((await state()).inventory.filter(id => id==='silver_coin').length,1);
  assert.equal((await state()).score,coin.score);
  await checkCryptReuse();
  await leaveInspection();

  await holdItem('裹尸布');
  await page.keyboard.press('i');
  await checkCommand(() => page.locator('#inventory-wear-shroud').click(),'wear shroud');
  const dressed = await reopen('cemetery-coin-and-shroud-restored');
  assert.equal(dressed.itemLoc.shroud,'worn');
  assert.equal(dressed.itemLoc.silver_coin,'inventory');
}

async function checkPhase(phase,visible,docked = false) {
  const current = await state();
  assert.equal(current.ferry.phase,phase);
  assert.equal(current.ferry.visible,visible);
  assert.equal(current.ferry.docked,docked);
  assert.equal(current.objects.some(object => object.id===`${current.room}:ferry`),visible);
  receipts.push({ phase,visible,docked,room:current.room,turn:current.turns });
  return current;
}

async function pressWait(turns = 1) {
  return checkCommand(() => page.keyboard.press('r'),'wait',0,{turns});
}

async function touchFerry(kind, command, touch = false) {
  const current = await state();
  const object = current.objects.find(entry => entry.id===`${current.room}:${kind}`);
  assert.ok(object?.actions.some(action => action.command===command),`${current.room} 缺少 ${command}`);
  const polygon = object.pointerShape.points;
  const midpoint = polygon.reduce(([x,y],[px,py]) => [x+px/polygon.length,y+py/polygon.length],[0,0]);
  return checkCommand(() => clickAt(midpoint,touch),command);
}

async function changeShroud(command) {
  await holdItem('裹尸布');
  await page.keyboard.press('i');
  await checkCommand(() => page.locator('#inventory-wear-shroud').click(),command);
  const clear = page.locator('#clear-hand');
  if (await clear.isVisible()) await clear.click();
}

async function checkPaidCrossing() {
  await holdItem('银币');
  const arrival = await checkCommand(() => page.keyboard.press('f'),'give silver coin to oarsman',0,{crossing:true});
  assert.equal(arrival.room,'sand_bar');
  assert.equal(arrival.chapter,'islet');
  assert.equal(arrival.navigation.arrival?.entrance,'ferry');
  assert.equal(arrival.navigation.arrival?.fromRoom,'the_river');
  assert.equal(arrival.inventory.includes('silver_coin'),false);
  assert.equal(arrival.ferry.crossed,true);
  assert.equal(arrival.ferry.legacyPaid,false);
  assert.ok(!arrival.exits.some(exit => exit.dir==='out'));
  await record('paid-sand-bar');
}

async function crossFromFirstSighting() {
  await checkPhase(0,true);
  await touchFerry('ferry','examine dory');
  await pressWait();
  await checkPhase(2,true,true);
  await approachF([306,165],'d','the_river:ferry');
  const boarded = await pressF('enter dory');
  assert.equal(boarded.ferry.onboard,true);
  await checkPaidCrossing();
}

async function testFerry() {
  const initial = await checkPhase(0,true);
  await tick(2400);
  assert.deepEqual((await state()).ferry,initial.ferry);
  await page.keyboard.press('m');
  assert.equal((await state()).mode,'map');
  await page.keyboard.press('m');
  assert.equal((await state()).turns,initial.turns);
  await touchFerry('ferry','examine dory');
  await checkPhase(1,true);
  const recognized = await touchFerry('oarsman','examine oarsman');
  assert.match(recognized.dialogue?.text,/兜帽/);
  assert.ok(recognized.flags.includes('river_oarsman_recognized'));
  await checkPhase(2,true,true);
  await holdItem('银币');
  const refused = await touchFerry('oarsman','give silver coin to oarsman');
  assert.equal(refused.room,'the_river');
  assert.match(refused.dialogue?.text,/先上船/);
  assert.ok(refused.inventory.includes('silver_coin'));
  assert.ok(!refused.flags.includes('ferry_paid'));
  await record('shore-payment-refused');
  await page.locator('#clear-hand').click();
  await checkPhase(3,true,true);
  await pressWait();
  await checkPhase(4,true,true);
  await shot('river-docked');
  await pressWait();
  await checkPhase(5,true);
  await shot('river-departure');
  await pressWait();
  await checkPhase(6,false);
  await shot('river-no-ferry');
  await pressWait(4);
  await checkPhase(10,false);
  await pressWait(2);
  const again = await checkPhase(0,true);
  assert.equal(again.turns,initial.turns+12);
  await shot('river-return-after-twelve');

  await changeShroud('remove shroud');
  await pressWait();
  await checkPhase(2,true,true);
  await approachF([306,165],'d','the_river:ferry');
  const rejected = await pressF('enter dory');
  assert.equal(rejected.ferry.onboard,false);
  assert.ok(rejected.flags.includes('river_ferry_shorts_seen'));
  await changeShroud('wear shroud');
  await checkPhase(4,true,true);
  const boarded = await pressF('enter dory');
  assert.equal(boarded.ferry.onboard,true);
  assert.equal(boarded.ferry.selection,'oarsman');
  assert.deepEqual(boarded.exits,[]);
  await reopen('aboard-restored');
  await page.keyboard.press('ArrowLeft');
  assert.equal((await state()).ferry.selection,'ferry');
  await page.keyboard.press('ArrowRight');
  assert.equal((await state()).ferry.selection,'oarsman');
  assert.equal((await state()).turns,boarded.turns);
  assert.equal((await pressWait()).ferry.onboard,true);
  assert.equal((await pressWait()).ferry.onboard,false);
  await checkPhase(5,true);
  for (const turns of [1,4,2,1,1]) await pressWait(turns);
  await checkPhase(2,true,true);
  assert.equal((await touchFerry('ferry','enter dory')).ferry.onboard,true);
  await page.keyboard.press('ArrowLeft');
  assert.equal((await pressF('exit dory')).ferry.onboard,false);
  await checkPhase(3,true,true);
  await page.setViewportSize({width:390,height:844});
  assert.equal((await touchFerry('ferry','enter dory',true)).ferry.onboard,true);
  await shot('phone-aboard');
  await page.setViewportSize({width:1440,height:900});
  await checkPaidCrossing();
}

async function testSandBar() {
  await checkPhase(10,true);
  await reopen('sand-bar-payment-restored');
  await checkPhase(10,true);
  await page.setViewportSize({width:390,height:844});
  for (const [point,command] of [[[225,239],'examine sand'],[[294,239],'examine river']]) {
    const examined = await checkCommand(() => clickAt(point,true),command);
    assert.match(examined.dialogue?.text,/南边的沙地/);
  }
  await page.setViewportSize({width:1440,height:900});
  await travel('s','islet');
  const island = await checkCommand(() => page.keyboard.press('l'),'look');
  assert.match(island.dialogue?.text,/十来码|脚步|每一步/);
  assert.ok(!/南边的沙地/.test(island.dialogue?.text));
  await travel('n','sand_bar');
  for (let turn = 0; turn < 12 && (await state()).ferry.phase!==8; turn++) {
    await checkCommand(() => page.keyboard.press('l'),'look');
  }
  await checkPhase(8,true);
  await touchFerry('ferry','examine dory');
  await checkPhase(9,true,true);
  const turnedAway = await touchFerry('ferry','enter dory');
  assert.equal(turnedAway.room,'sand_bar');
  assert.equal(turnedAway.ferry.onboard,false);
  assert.match(turnedAway.dialogue?.text,/摇了摇头|推开/);
  await record('sand-bar-ferry-refusal');
}

async function enterCrater() {
  await travel('s','islet');
  assert.ok((await state()).isletDoor?.aligned);
  await approachF([343,166],'d','islet:gate');
  await pressF('examine door');
  const shack = await pressF('enter door','shack');
  assert.equal(shack.navigation.arrival?.entrance,'door');
  assert.equal(shack.navigation.arrival?.fromRoom,'islet');
  assert.equal(shack.shackDoor.open,true);
  await record('shack-from-islet');
  for (const {from,dir,to,entrance} of shackPassages) {
    const object = (await state()).objects.find(item=>item.id===`${from}:passage:${dir}`);
    await pointerAction(object.id,pointerCenter(object),dir,to);
    assert.equal((await state()).navigation.arrival?.entrance,entrance);
  }
  await travel('se','shallow_crater');
  const crater = await state();
  assert.equal(crater.navigation.arrival?.entrance,'nw');
  assert.equal(crater.navigation.arrival?.fromRoom,'base_of_tower');
  await record('crater-from-tower');
}

try {
  await reachCemetery();
  await testCrypt();
  await reachRiver();
  await exportProgress(join(output,'river-played.json'));
  if (checkpointStage !== 'river') {
    if (checkpointStage === 'crater') await crossFromFirstSighting();
    else {
      await testFerry();
      await testSandBar();
    }
    await enterCrater();
    await exportProgress(join(output,'crater-played.json'));
  }
  assert.deepEqual(errors,[]);
  await writeFile(join(output,'result.json'),JSON.stringify({pass:true,receipts,errors},null,2));
  if (checkpointStage === 'river') console.log('正常探索墓地并在初见渡船时导出河岸存档');
  else if (checkpointStage === 'crater') console.log('从正常开局过河并导出浅坑存档');
  else console.log('正常探索墓地、河岸候船及渡船起程通过');
} catch (error) {
  await shot('failure').catch(() => {});
  await writeFile(join(output,'failure.json'),JSON.stringify({message:error.message,state:await state().catch(() => null),receipts,errors},null,2));
  throw error;
} finally {
  await browser.close();
}
