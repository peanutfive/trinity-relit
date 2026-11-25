// A genuine 2D closet save is imported through the game menu. No terminal state is injected.
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { VISUAL_SAVE_KEY } from '../save.js';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const url = process.env.DEMO_URL || 'http://127.0.0.1:8080/2d-demo/';
const output = process.env.QA_OUTPUT || join(tmpdir(), 'trinity-river-ending');
const existing = process.env.PLAYED_CLOSET_SAVE;
const upstream = join(output, 'normal-closet-route');
const source = existing || join(upstream, 'closet-closed-played.json');
await mkdir(output, { recursive: true });
if (!existing) {
  const tool = fileURLToPath(new URL('./browser-ranch-closet.mjs', import.meta.url));
  await promisify(execFile)(process.execPath, [tool, '--ending-checkpoint'], {
    env: { ...process.env, DEMO_URL: url, QA_OUTPUT: upstream },
  });
}
const original = JSON.parse(await readFile(source, 'utf8')).engine.state;
assert.equal(original.room, 'closet');
assert.equal(original.chapter, 'ranch');
assert.ok(original.flags.includes('closet_door_closed'));
assert.ok(original.flags.includes('ranch_snake_awake'));
assert.ok(!original.flags.includes('ranch_snake_bitten'));

const browser = await chromium.launch({ headless: true });
const reports = [];
const errors = [];
let page;

const state = () => page.evaluate(() => JSON.parse(window.render_game_to_text()));
const tick = ms => page.evaluate(ms => window.advanceTime(ms), ms);
const shot = label => page.screenshot({ path: join(output, label + '.png') });
const saveBytes = () => page.evaluate(key => localStorage.getItem(key), VISUAL_SAVE_KEY);
const foot = s => [s.player.x, s.player.y, s.player.facing];
const terminalStory = ({ room, chapter, turns, score, dead, inventory, flags, lastCommand, player, ending }) => ({
  room, chapter, turns, score, dead, inventory, flags, lastCommand, foot: foot({ player }), ending,
});

async function openBrowserCase(phone) {
  await page?.context().close();
  const viewport = phone ? { width:390, height:844 } : { width:1440, height:900 };
  const context = await browser.newContext({ viewport, hasTouch: phone, isMobile: phone });
  page = await context.newPage();
  page.setDefaultTimeout(8000);
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('response', res => { if (res.status() >= 400) errors.push(`${res.status()} ${res.url()}`); });
  page.on('dialog', modal => modal.accept());
  await page.goto(url);
  await page.waitForFunction(() => window.render_game_to_text && JSON.parse(window.render_game_to_text()).art === 'loaded');
  await page.locator('#start').click();
  await readOrdinaryPages();
}

async function until(predicate, description) {
  for (let frame = 0; frame < 150; frame++) {
    const s = await state();
    if (predicate(s)) return s;
    await tick(70);
  }
  const s = await state();
  throw Error(`${description}: ${s.mode}, ${s.room}, ${s.turns}, ${s.ending?.phase}`);
}

async function readOrdinaryPages() {
  const lines = [];
  for (let i = 0; i < 80; i++) {
    const s = await until(value => !value.processing, '等候输入结算');
    if (s.mode === 'dialogue') {
      lines.push(s.dialogue?.text);
      await page.locator('#next').click();
    } else if (s.narrative.busy && s.mode !== 'ending') await tick(100);
    else return { s, lines };
  }
  throw Error('对白未结束');
}

async function clickCanvas([x, y], phone) {
  const box = await page.locator('canvas').boundingBox();
  assert.ok(box);
  const at = [box.x + x * box.width / 480, box.y + y * box.height / 288];
  if (phone) await page.touchscreen.tap(...at);
  else await page.mouse.click(...at);
}

async function configure(language, interact) {
  if (language === 'cn' && interact === 'f') return;
  await page.keyboard.press('Escape');
  await page.getByRole('tab', { name:'键位设置' }).click();
  if (language !== 'cn') {
    await page.locator('#language').click();
    if (language === 'both') await page.locator('#language').click();
    assert.equal((await page.locator('#language').textContent()).trim(),language==='both'?'双语':'英文');
  }
  if (interact !== 'f') {
    await page.locator('[data-binding="interact"]').click();
    await page.keyboard.press(interact);
  }
  await page.keyboard.press('Escape');
  assert.equal((await state()).controls.interact,interact);
}

async function loadCloset() {
  await page.keyboard.press('Escape');
  await page.getByRole('tab', { name:'探索进度' }).click();
  await page.locator('#save-file').setInputFiles(source);
  await until(s => s.mode !== 'paused' && !s.processing && s.room === 'closet', '读取真实危机前的壁橱存档');
  const { s } = await readOrdinaryPages();
  assert.equal(s.turns, original.turns);
  assert.equal(s.score, original.score);
  assert.equal(s.closet.doorOpen, false);
}

async function reachLastLiveTurn(phone, language) {
  await clickCanvas([225,128], phone);
  const opened = await until(s => !s.processing && s.room==='closet' && s.closet.doorOpen, '摸门打开');
  assert.equal(opened.lastCommand, 'open closet door');
  assert.equal(opened.turns, original.turns + 1);
  await readOrdinaryPages();

  const rawSafe = await saveBytes();
  const safe = JSON.parse(rawSafe).engine.state;
  assert.equal(safe.room, 'closet');
  assert.equal(safe.turns, opened.turns);
  assert.ok(!safe.flags.includes('ranch_snake_bitten'));

  await clickCanvas([238,136], phone);
  const last = await until(s => !s.processing && s.room === 'assembly_room' && s.closet.snake === 'bitten', '从门洞出去并遭到咬伤');
  const { lines } = await readOrdinaryPages();
  assert.equal(last.dead, false);
  assert.equal(last.turns, opened.turns + 1);
  assert.deepEqual(last.inventory, opened.inventory);
  assert.equal(last.score, original.score);
  assert.match(lines.join(' '), language === 'cn' ? /咬中|脚踝/ : /strikes|ankle/i);
  assert.equal(await saveBytes(), rawSafe);
  return { last, rawSafe, safe, safeFoot: foot(opened) };
}

function assertEnding(s, last) {
  assert.equal(s.mode, 'ending');
  assert.equal(s.room, last.room, '尾声是独立画面，地点数据仍在末次游戏场景');
  assert.equal(s.chapter, last.chapter);
  assert.equal(s.ferry, null);
  assert.equal(s.dead, true);
  assert.equal(s.turns, last.turns);
  assert.equal(s.score, last.score);
  assert.equal(s.ending.turns, last.turns);
  assert.equal(s.ending.score, last.score);
  assert.deepEqual(s.ending.rank, { en:'EXPLORER', cn:'探索者' });
  assert.deepEqual(s.inventory, last.inventory);
  assert.deepEqual(foot(s), foot(last));
}

async function startEnding(last, label, language) {
  await page.keyboard.press('r');
  const fatal = await until(s => !s.processing && s.dead, '吃完最后一个有效动作后触发尾声');
  assert.equal(fatal.lastCommand, 'wait');
  const intro = [];
  while ((await state()).mode === 'dialogue') {
    const { dialogue } = await state();
    intro.push(dialogue?.text);
    if (dialogue.page === dialogue.total) {
      assert.match(await page.locator('#next').textContent(),language==='en'?/^→ /:/^继续 /);
    }
    await shot(label + '-intro-' + intro.length);
    await page.locator('#next').click();
  }
  const bank = await until(s => s.mode==='ending' && s.ending?.phase==='bank', '白光后出现静止的河岸');
  assertEnding(bank, last);
  const collapse = intro.findIndex(line => (language === 'cn' ? /倒|脚踝/ : /sink|ankle/i).test(line));
  assert.ok(collapse >= 0, '尾声先出现倒地文字');
  assert.match(intro.slice(collapse+1).join(' '), language === 'cn' ? /强光|亮光|白光|刺眼|耀眼/ : /blind|light/i);
  if (language !== 'cn') assert.ok(intro.some(line => line.includes('New Mexico.')), '白光段落不得从地名中间分页');
  return intro;
}

async function noExplorationInput(last, unwanted) {
  const current = await state();
  for (const key of unwanted) await page.keyboard.press(key);
  await tick(700);
  const after = await state();
  assertEnding(after, last);
  assert.deepEqual(terminalStory(after), terminalStory(current));
  assert.equal(after.map?.open, false);
  assert.equal(await page.locator('#pause-menu').isVisible(), false);
  assert.equal(await page.locator('#dialogue').isVisible(), false);
}

async function endingText(language, phase) {
  const panel = page.locator('#ending-text');
  await panel.waitFor({ state:'visible' });
  const words = (await panel.textContent()).trim();
  const patterns = {
    cn: { bank:/沙岸|暗河|雾/, boat:/船夫|小船|雾/, aboard:/银币|船夫|搁岸|船上/, menu:/探索者/ },
    en: { bank:/shore|bank|river/i, boat:/boatman|dory|figure|fog/i, aboard:/silver coin|gestures|boatman|aboard/i, menu:/explorer/i },
  };
  if (language !== 'en') assert.match(words,patterns.cn[phase]);
  if (language !== 'cn') assert.match(words,patterns.en[phase]);
  if (language === 'both') assert.match(words,/^[^\u3400-\u9fff]+[\u3400-\u9fff]/);
  if (language === 'en' && phase !== 'menu') assert.doesNotMatch(words,/[\u3400-\u9fff]/);
  assert.match((await page.locator('#ending-title').textContent()).trim(),language==='cn'?/河/:/The River/i);
  return words;
}

async function phoneDoesNotOverflow() {
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  for (const id of ['#ending-title','#ending-text','#ending-next','#ending-restore','#ending-restart','#ending-quit']) {
    const node = page.locator(id);
    if (!await node.isVisible()) continue;
    const box = await node.boundingBox();
    const view = page.viewportSize();
    assert.ok(box && box.x >= -1 && box.y >= -1 && box.x+box.width <= view.width+1 && box.y+box.height <= view.height+1,
      id+' 应完整显示在手机视口内');
    if (!['#ending-title','#ending-text'].includes(id)) assert.ok(box.height >= 40, id+' 需要可触摸的高度');
  }
}

async function readLongPhoneCaption(label) {
  const panel = page.locator('#ending-text');
  const bounds = await panel.boundingBox();
  const maxScroll = await panel.evaluate(node => node.scrollHeight-node.clientHeight);
  assert.ok(maxScroll > 0, '双语长段落应在自己的文字区域滚动');
  await panel.evaluate(node => { node.scrollTop=0; });
  const cdp = await page.context().newCDPSession(page);
  try {
    const x = Math.round(bounds.x + bounds.width/2);
    const y = Math.round(bounds.y + bounds.height-4);
    async function touch(type, touchPoints = []) {
      await cdp.send('Input.dispatchTouchEvent', { type, touchPoints });
    }
    for (let swipe=0; swipe<6; swipe++) {
      await touch('touchStart', [{ x,y }]);
      for (let dy=12; dy<=96; dy+=12) await touch('touchMove', [{ x, y:y-dy }]);
      await touch('touchEnd');
      const read = await panel.evaluate(node => node.scrollTop+node.clientHeight >= node.scrollHeight-1);
      if (read) {
        await shot(label+'-scroll-end');
        return;
      }
    }
    throw Error('触屏滑动未读到双语文字末尾');
  } finally { await cdp.detach(); }
}

async function moveThroughEnding({ language, interact, label, phone }, last, rawSafe) {
  const pages = [];
  const phases = ['bank','boat','aboard','menu'];
  for (const [index, phase] of phases.entries()) {
    const visible = await until(s => s.ending?.phase === phase && s.mode === 'ending', '尾声阶段 '+phase);
    assertEnding(visible, last);
    pages.push({ phase, text: await endingText(language,phase), score: visible.score, turns: visible.turns });
    if (phone) await phoneDoesNotOverflow();
    if (phase==='aboard' && label==='cn-f-restore') {
      await tick(2450);
      await shot(label+'-coin');
      await tick(1100);
    } else if (phase==='aboard') await tick(3500);
    else if (phase==='boat') await tick(2400);
    else await tick(700);
    assert.equal((await state()).ending.phase,phase);
    await shot(label+'-'+phase);
    if (phone && language==='both' && phase==='aboard') {
      await readLongPhoneCaption(label+'-390');
      await page.setViewportSize({ width:360,height:800 });
      await phoneDoesNotOverflow();
      await readLongPhoneCaption(label+'-360');
    }
    const noisy = ['m','i','l','r','h','t','w','ArrowUp','Escape'];
    if (interact !== 'f') noisy.push('f');
    if (phase==='menu') noisy.push(interact);
    await noExplorationInput(last, noisy);
    assert.equal(await saveBytes(), rawSafe);
    if (phase==='menu') break;

    const next = page.locator('#ending-next');
    assert.equal(await next.isVisible(),true);
    if (phone) await next.tap();
    else if (!index && interact !== 'f') {
      // Playwright's second down dispatches the real repeat flag.
      await page.keyboard.down(interact);
      try {
        await until(s => s.ending?.phase==='boat', '改键进入下一页');
        await page.keyboard.down(interact);
        await tick(480);
        assert.equal((await state()).ending?.phase,'boat');
      } finally { await page.keyboard.up(interact); }
    } else await page.keyboard.press(interact);
  }
  const final = pages.at(-1).text;
  assert.match(final, new RegExp(String(last.score)));
  assert.match(final, new RegExp(String(last.turns)));
  assert.match(final,/100/);
  for (const [id, english] of [['restore','RESTORE'],['restart','RESTART'],['quit','QUIT']]) {
    const button = page.locator('#ending-'+id);
    assert.equal(await button.isVisible(),true);
    if (language==='en') assert.match((await button.textContent()).trim(),new RegExp(english,'i'));
  }
  return pages;
}

async function checkFinalAction({ action, phone, label }, { rawSafe, safe, safeFoot }) {
  const button = page.locator('#ending-'+action);
  if (phone) await button.tap();
  else await button.click();
  if (action === 'restart') {
    const fresh = await until(s => !s.ending && s.room==='palace_gate' && !s.processing,'重开回到宫殿门');
    assert.equal(fresh.turns,0);
    assert.equal(fresh.score,0);
    assert.equal(fresh.dead,false);
    await shot(label+'-fresh-game');
    return { room:fresh.room, turns:fresh.turns, score:fresh.score };
  }
  if (action === 'quit') {
    await until(s => s.mode==='title' && !s.ending,'退出返回标题');
    assert.equal(await page.locator('#overlay').isVisible(),true);
    assert.equal(await page.locator('#continue-save').isVisible(),true);
    assert.equal(await saveBytes(),rawSafe);
    await shot(label+'-quit-preserves-title-save');
    await page.locator('#continue-save').tap();
  }
  await until(s => s.mode!=='ending' && !s.ending && !s.processing && s.room===safe.room,'继续危机前的存档');
  const { s: restored } = await readOrdinaryPages();
  assert.equal(restored.turns,safe.turns);
  assert.equal(restored.score,safe.score);
  assert.equal(restored.closet.doorOpen,true);
  assert.equal(restored.dead,false);
  assert.deepEqual(foot(restored),safeFoot);
  await shot(label+'-restored');
  return { room:restored.room, turns:restored.turns, score:restored.score };
}

async function endingCase(options) {
  const { phone, language, interact, label } = options;
  await openBrowserCase(phone);
  await configure(language,interact);
  await loadCloset();
  const progress = await reachLastLiveTurn(phone,language);
  const { last, rawSafe } = progress;
  const intro = await startEnding(last,label,language);
  const pages = await moveThroughEnding(options,last,rawSafe);
  if (phone) {
    await page.setViewportSize({ width:360,height:800 });
    await phoneDoesNotOverflow();
    await shot(label+'-menu-360');
  }
  const action = await checkFinalAction(options,progress);
  reports.push({ label, language, interact, last:{room:last.room,score:last.score,turns:last.turns}, intro, pages, action });
}

try {
  await endingCase({ label:'cn-f-restore', language:'cn', interact:'f', action:'restore', phone:false });
  await endingCase({ label:'en-remap-restart', language:'en', interact:'g', action:'restart', phone:false });
  await endingCase({ label:'cn-touch-quit', language:'cn', interact:'f', action:'quit', phone:true });
  await endingCase({ label:'bilingual-touch-restore', language:'both', interact:'f', action:'restore', phone:true });
  assert.deepEqual(errors,[]);
  await writeFile(join(output,'result.json'),JSON.stringify({ pass:true,source,reports,errors },null,2));
  console.log('三个末局分支、双语触屏滚读、改键、输入隔离与安全存档通过');
} catch (error) {
  if (page) await shot('failure').catch(() => {});
  await writeFile(join(output,'failure.json'),JSON.stringify({
    message:error.message, current:page ? await state().catch(() => null) : null, reports, errors,
  },null,2));
  throw error;
} finally {
  await browser.close();
}
