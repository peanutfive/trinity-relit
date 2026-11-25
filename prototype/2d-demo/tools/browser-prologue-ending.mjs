// Fresh-title reprise plus two outcomes from one normal Long Water export.
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { VISUAL_SAVE_KEY } from '../save.js';
import { pointerCenter } from './browser-islet-route.mjs';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const url = process.env.DEMO_URL || 'http://127.0.0.1:8080/2d-demo/';
const output = process.env.QA_OUTPUT || join(tmpdir(), 'trinity-prologue-ending');
const upstream = join(output, 'normal-lake-route');
const existing = process.env.PLAYED_LONG_WATER_SAVE;
const source = existing || join(upstream, 'long-water-played.json');
await mkdir(output, { recursive:true });
if (!existing) {
  const tool = fileURLToPath(new URL('./browser-smoke.mjs', import.meta.url));
  await promisify(execFile)(process.execPath, [tool, '--lake-checkpoint'], {
    env:{ ...process.env, DEMO_URL:url, QA_OUTPUT:upstream },
  });
}
const { engine:{state:lake} } = JSON.parse(await readFile(source, 'utf8'));
assert.equal(lake.room, 'long_water');
assert.equal(lake.chapter, 'prologue');
assert.equal(lake.dead, false);
assert.equal(lake.score, 15);

const browser = await chromium.launch({ headless:true });
const reports = [];
const errors = [];
let page;
let label;

const state = () => page.evaluate(() => JSON.parse(window.render_game_to_text()));
const tick = ms => page.evaluate(ms => window.advanceTime(ms), ms);
const shot = name => page.screenshot({ path:join(output,label+'-'+name+'.png') });
const safeBytes = () => page.evaluate(key => localStorage.getItem(key), VISUAL_SAVE_KEY);
const story = s => ({
  room:s.room, score:s.score, turns:s.turns, inventory:s.inventory,
  clock:s.storyClock, dead:s.dead,
});

async function openCase(name, phone = false) {
  label = name;
  await page?.context().close();
  const viewport = phone ? { width:390, height:844 } : { width:1440, height:900 };
  const context = await browser.newContext({ viewport, hasTouch:phone, isMobile:phone });
  page = await context.newPage();
  page.setDefaultTimeout(8000);
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', msg => { if (msg.type()==='error') errors.push(msg.text()); });
  page.on('response', res => { if (res.status()>=400) errors.push(`${res.status()} ${res.url()}`); });
  await page.goto(url);
  await page.waitForFunction(() => window.render_game_to_text && JSON.parse(window.render_game_to_text()).art==='loaded');
  await page.locator('#start').click();
  await readDialogue();
}

async function until(predicate, reason) {
  for (let frame=0; frame<155; frame++) {
    const s = await state();
    if (predicate(s)) return s;
    await tick(75);
  }
  const s = await state();
  throw Error(`${reason}, ${s.room}, ${s.mode}, ${s.turns}, ${s.storyClock.phase}, ${s.lastCommand}`);
}

async function readDialogue(captureThreat = false) {
  const lines = [];
  for (let i=0; i<70; i++) {
    const s = await until(value => !value.processing,'等待行动');
    if (s.mode==='dialogue') {
      lines.push(s.dialogue.text);
      if (captureThreat && s.dialogue.page===s.dialogue.total) await shot('local-threat');
      await page.locator('#next').click();
    } else if (s.mode!=='ending' && s.narrative.busy) await tick(100);
    else return { s, lines };
  }
  throw Error('普通叙事未结束');
}

async function importLake() {
  await page.keyboard.press('Escape');
  await page.getByRole('tab', { name:'探索进度' }).click();
  await page.locator('#save-file').setInputFiles(source);
  await until(s => s.mode!=='paused' && !s.processing && s.room==='long_water','读取新开局导出的湖岸档');
  const { s } = await readDialogue();
  assert.equal(s.turns,lake.turns);
  assert.equal(s.storyClock.elapsed,1785);
  assert.equal(s.storyClock.phase,0);
  assert.equal(s.storyClock.frozen,true);
  assert.equal(s.ending,null);
  return s;
}

async function clickCanvas([x,y],phone) {
  const box = await page.locator('canvas').boundingBox();
  assert.ok(box);
  const at = [box.x+x*box.width/480, box.y+y*box.height/288];
  if (phone) await page.touchscreen.tap(...at);
  else await page.mouse.click(...at);
}

async function wade(phone) {
  const before = await state();
  assert.ok(!before.objects.some(object => object.kind==='door'));
  const water = before.objects.find(object => object.id==='long_water:water');
  assert.ok(water,'岸上的真实水线可以涉入');
  await clickCanvas(pointerCenter(water),phone);
  await until(s => s.room==='wading' && !s.processing,'点击湖面涉水');
  const { s } = await readDialogue();
  assert.match(s.lastCommand,/^(enter water|e|in)$/);
  assert.equal(s.storyClock.phase,1);
  assert.equal(s.storyClock.elapsed,1785);
  assert.ok(!s.objects.some(object => object.kind==='door'));
  return s;
}

async function waitFrom(before) {
  await page.keyboard.press('r');
  await until(s => !s.processing && (s.dead || s.turns>before.turns),'按 R 等待一个剧情动作');
  return readDialogue();
}

async function approachLastParkTurn() {
  let before = await state();
  const warnings = [];
  assert.equal(before.room,'palace_gate');
  assert.equal(before.turns,0);
  assert.equal(before.storyClock.elapsed,0);
  for (let action=0; action<42; action++) {
    if (before.storyClock.elapsed===1785) {
      assert.equal(before.turns,119);
      assert.equal(before.score,0);
      assert.equal(warnings.length,8);
      return { before, warnings };
    }
    const { s, lines } = await waitFrom(before);
    assert.equal(s.room,'palace_gate');
    assert.equal(s.dead,false,'警报完成前仍可正常活动');
    assert.equal(s.ending,null);
    if (s.storyClock.elapsed>=1680) {
      if (!warnings.length) assert.match(lines.join(' '),/防空警报/);
      warnings.push({ turn:s.turns, elapsed:s.storyClock.elapsed, text:lines });
    }
    before=s;
  }
  throw Error('正常等待未抵达公园的最后可行动回合');
}

async function approachLastLakeTurn(before) {
  const stages = [];
  while (before.storyClock.phase<6) {
    const {s,lines} = await waitFrom(before);
    assert.equal(s.room,before.room);
    assert.equal(s.storyClock.phase,before.storyClock.phase+1);
    assert.equal(s.storyClock.elapsed,1785);
    assert.equal(s.dead,false);
    assert.equal(s.ending,null);
    if (s.storyClock.phase===3) {
      assert.ok(s.objects.some(object => object.kind==='door'));
      await shot('door-revealed');
    }
    stages.push({ phase:s.storyClock.phase,turn:s.turns,text:lines });
    before=s;
  }
  return { before,stages };
}

function assertConclusion(s,before) {
  assert.equal(s.mode,'ending');
  assert.equal(s.room,before.room);
  assert.equal(s.chapter,'prologue');
  assert.equal(s.dead,true);
  assert.equal(s.ferry,null);
  assert.deepEqual(s.inventory,before.inventory);
  assert.equal(s.score,before.score);
  assert.equal(s.turns,before.turns);
  assert.equal(s.ending.score,before.score);
  assert.equal(s.ending.turns,before.turns);
  assert.equal(s.ending.rank.en,before.room==='palace_gate'?'TOURIST':'EXPLORER');
}

async function witnessEnding(before,fatal,phone) {
  const raw = await safeBytes();
  const lastSafe = JSON.parse(raw).engine.state;
  assert.equal(lastSafe.dead,false);
  assert.equal(lastSafe.turns,before.turns);
  assert.equal(lastSafe.room,before.room);
  await page.keyboard.press(fatal);
  const terminal = await until(s => s.dead && !s.processing,'触发本场景的末次行动');
  assert.equal(terminal.turns,before.turns,'最后一个活回合才用于结算');
  const {lines} = await readDialogue(true);
  const sourceText = before.room==='palace_gate' ? /东风.*沉寂|新星/ : /炽烈|汽化/;
  assert.match(lines.join(' '),sourceText);
  assert.doesNotMatch(lines.join(' '),/毫无生气的沙地|船从雾中滑出/,'进入尾声前不应重复河岸段落');
  const pages = [];
  for (const phase of ['bank','boat','aboard','menu']) {
    const s = await until(value => value.ending?.phase===phase,'尾声 '+phase);
    assertConclusion(s,before);
    await tick(phase==='aboard'?3500:phase==='boat'?2400:600);
    const words = (await page.locator('#ending-text').textContent()).trim();
    const text = { bank:/沙地|暗河/, boat:/雾.*船|船.*雾/, aboard:/银币|登上船/, menu:/游客|探索者/ };
    assert.match(words,text[phase]);
    pages.push({ phase,text:words });
    await shot(phase);
    await page.keyboard.press('m');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('r');
    assertConclusion(await state(),before);
    assert.equal((await state()).ending.phase,phase);
    assert.equal((await state()).map.open,false);
    assert.equal(await safeBytes(),raw);
    if (phase!=='menu') {
      if (phone) await page.locator('#ending-next').tap();
      else await page.keyboard.press('f');
    }
  }
  return { intro:lines, pages };
}

async function restoreFromEnding(before,phone) {
  if (phone) await page.locator('#ending-restore').tap();
  else await page.locator('#ending-restore').click();
  await until(s => !s.ending && !s.processing && !s.dead,'恢复实际末次健康存档');
  const {s} = await readDialogue();
  assert.deepEqual(story(s),story(before));
  await shot('restored');
  return story(s);
}

async function lateShore() {
  await openCase('late-shore');
  const {before,stages} = await approachLastLakeTurn(await importLake());
  const observed = await witnessEnding(before,'l',false);
  const restored = await restoreFromEnding(before,false);
  return { label, last:story(before), stages, ...observed, restored };
}

async function lateWading() {
  await openCase('late-wading',true);
  await importLake();
  const {before,stages} = await approachLastLakeTurn(await wade(true));
  await page.keyboard.press('t');
  await until(s => !s.processing && s.lastCommand==='time' && s.mode==='dialogue','查询停住的手表');
  const watch = await readDialogue();
  assert.match(watch.lines.join(' '),/3:59:45/);
  assert.deepEqual(story(watch.s),story(before));
  const observed = await witnessEnding(watch.s,'r',true);
  await page.locator('#ending-quit').tap();
  await until(s => s.mode==='title' && !s.ending,'触屏退出末局');
  await page.locator('#continue-save').tap();
  const {s} = await readDialogue();
  assert.deepEqual(story(s),story(before));
  return { label, last:story(before), stages, watch:watch.lines, ...observed, restored:story(s) };
}

async function palace() {
  await openCase('palace-wait');
  const {before,warnings} = await approachLastParkTurn();
  const observed = await witnessEnding(before,'r',false);
  await page.locator('#ending-restart').click();
  const {s} = await readDialogue();
  assert.equal(s.room,'palace_gate');
  assert.equal(s.score,0);
  assert.equal(s.turns,0);
  assert.equal(s.ending,null);
  assert.equal(s.storyClock.elapsed,0);
  await shot('restarted');
  return { label, last:story(before), warnings, ...observed, restart:story(s) };
}

async function timelyDoor(observe) {
  await openCase(observe?'timely-observed-door':'timely-first-interaction');
  const shore = await importLake();
  await wade(false);
  let current = await state();
  for (let i=0; i<2; i++) ({s:current}=await waitFrom(current));
  assert.equal(current.storyClock.phase,3);
  assert.ok(current.objects.some(o => o.id==='wading:door'));
  await shot('reachable-door');
  await clickCanvas([250,240],false);
  await until(s => s.navigation.path.length===0,'走到白门前实际湖面位置');
  await page.keyboard.down('d');
  try { await tick(15); } finally { await page.keyboard.up('d'); }
  if (observe) {
    await page.keyboard.press('f');
    await until(s => !s.processing && s.lastCommand==='examine door' && s.storyClock.phase===4,'F 查看白门');
    await readDialogue();
  }
  const {before:last,stages} = await approachLastLakeTurn(await state());
  assert.equal(last.storyClock.phase,6);
  assert.equal(last.observed.includes('wading:door'),observe);
  await shot('last-chance');
  await page.keyboard.press('f');
  await until(s => !s.processing && s.room==='meadow','F 在最后机会穿过白门');
  const {s} = await readDialogue();
  assert.equal(s.chapter,'wabe');
  assert.equal(s.lastCommand,'enter door');
  assert.equal(s.dead,false);
  assert.equal(s.ending,null);
  assert.equal(s.storyClock.anomalous,true);
  assert.equal(s.score,shore.score);
  await shot('meadow-safe');
  return { label, observed:observe, start:story(shore), last:story(last), stages, recovered:story(s) };
}

try {
  reports.push(await palace());
  reports.push(await lateShore());
  reports.push(await lateWading());
  reports.push(await timelyDoor(true));
  reports.push(await timelyDoor(false));
  const passages = ({pages}) => pages.slice(0,3);
  assert.deepEqual(passages(reports[0]),passages(reports[1]));
  assert.deepEqual(passages(reports[1]),passages(reports[2]));
  assert.deepEqual(errors,[]);
  await writeFile(join(output,'result.json'),JSON.stringify({ pass:true,source,reports,errors },null,2));
  console.log('公园末局、湖岸与水中超时、及时过门和三种尾声操作通过');
} catch (error) {
  if (page) await shot('failure').catch(() => {});
  await writeFile(join(output,'failure.json'),JSON.stringify({
    error:error.message,label,current:page ? await state().catch(() => null) : null,reports,errors,
  },null,2));
  throw error;
} finally { await browser.close(); }
