// The normal opening route exports a real save. This browser uses that file unchanged.
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
const output = process.env.QA_OUTPUT || join(tmpdir(), 'trinity-windmill');
const prelude = join(output, 'normal-route');
const priorCheckpoint = process.env.PLAYED_WINDMILL_SAVE;
const checkpoint = priorCheckpoint || join(prelude, 'windmill-normal-save.json');
await mkdir(output, { recursive: true });
if (!priorCheckpoint) {
  const journey = fileURLToPath(new URL('./browser-ranch-journey.mjs', import.meta.url));
  await promisify(execFile)(process.execPath, [journey, '--windmill-checkpoint'], {
    env: { ...process.env, DEMO_URL: url, QA_OUTPUT: prelude },
  });
}
const saved = JSON.parse(await readFile(checkpoint, 'utf8'));
assert.equal(saved.engine.state.room, 'under_windmill');
assert.equal(saved.engine.state.itemLoc.splinter, 'inventory');

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.setDefaultTimeout(8000);
const errors = [], steps = [], dialoguePages = [], animationFrames = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });

const state = () => page.evaluate(() => JSON.parse(window.render_game_to_text()));
const tick = ms => page.evaluate(value => window.advanceTime(value), ms);
const shot = name => page.screenshot({ path: join(output, `${name}.png`) });
const feet = ({ player }) => [player.x, player.y, player.facing];
const story = ({ room, turns, chapter, score, inventory, flags, observed, dead, player }) =>
  ({ room, turns, chapter, score, inventory, flags, observed, dead, foot: [player.x, player.y, player.facing] });
const glasses = s => s.objects.find(object => object.id === 'ranch:item:binoculars');

async function until(predicate, description, stepMs = 85) {
  for (let step = 0; step < 180; step++) {
    const current = await state();
    if (predicate(current)) return current;
    await tick(stepMs);
  }
  const { room, player, mode, nearby, navigation, lastCommand } = await state();
  throw Error(`${description}: ${JSON.stringify({ room, player, mode, nearby, navigation, lastCommand })}`);
}

async function drain() {
  for (let step = 0; step < 90; step++) {
    const current = await until(s => !s.processing, '操作未完成');
    if (current.narrative.busy) await tick(115);
    else if (current.mode === 'dialogue') {
      if (current.dialogue?.text) dialoguePages.push({ turn: current.turns, room: current.room, text: current.dialogue.text });
      await page.keyboard.press('f');
    } else return current;
  }
  throw Error('演出或叙事未结束');
}

async function walkTo([x, y]) {
  const before = await drain();
  const canvas = await page.locator('canvas').boundingBox();
  assert.ok(canvas);
  await page.mouse.click(canvas.x + x * canvas.width / 480, canvas.y + y * canvas.height / 288);
  const arrived = await until(s => !s.processing && !s.navigation.path.length, `无法走到 ${x},${y}`);
  assert.equal(arrived.room, before.room, '仅在木台或水中移动应留在原场景');
  assert.equal(arrived.turns, before.turns, '场景内物理移动应保持原回合数');
  assert.ok(Math.hypot(arrived.player.x - x, arrived.player.y - y) <= 6,
    `${before.room} 没有到达画面位置 ${x},${y}，停在 ${feet(arrived)}`);
}

async function face(key) {
  await page.keyboard.down(key);
  try { await tick(13); }
  finally { await page.keyboard.up(key); }
}

async function interact(id, command, target, { at, facing, screenshot, animation = [] } = {}) {
  if (at) await walkTo(at);
  if (facing) await face(facing);
  const before = await drain();
  const object = before.objects.find(candidate => candidate.id === id);
  assert.ok(object?.actions.some(action => action.command === command), `游戏未出现 ${id} 的 ${command} 动作`);
  assert.equal(before.nearby, object.label, `F 应锁定 ${id}`);
  assert.match(await page.locator('#hint').textContent(), /^F\s*·/);
  const firstNewPage = dialoguePages.length;
  await page.keyboard.press('f');
  await until(s => !s.processing && s.lastCommand === command && s.turns > before.turns, `F 未执行 ${command}`);
  for (const { event, after, name, scene } of animation) {
    const { narrative } = await until(s => s.narrative.currentEvent === event && s.narrative.elapsed >= after,
      `未看到 ${event} 的中段`, 25);
    assert.ok(narrative.elapsed <= after + 0.12, `画面越过 ${event} 的取样区间`);
    if (scene) assert.equal(narrative.sceneRoom, scene, `截取 ${event} 时已切换机位`);
    await shot(name);
    animationFrames.push({ name, event, seconds: narrative.elapsed, scene: narrative.sceneRoom });
  }
  const after = await drain();
  assert.equal(after.room, target);
  assert.equal(after.turns, before.turns + 1);
  assert.equal(after.dead, false);
  if (screenshot) await shot(screenshot);
  steps.push({ action: command, input: 'F', from: before.room, to: after.room, foot: feet(after),
    turns: [before.turns, after.turns], pages: dialoguePages.slice(firstNewPage) });
  return after;
}

async function saveAndReopen(screenshot) {
  const before = await drain();
  await page.keyboard.press('Escape');
  await page.getByRole('tab', { name: '探索进度' }).click();
  await page.locator('#save-now').click();
  const packet = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), VISUAL_SAVE_KEY);
  assert.equal(packet.engine.state.room, before.room);
  assert.equal(packet.engine.state.turns, before.turns);
  await page.reload();
  await page.locator('#continue-save').click();
  await until(s => s.room === before.room && !s.processing && s.art === 'loaded', '未恢复正常存档');
  const restored = await drain();
  assert.deepEqual(story(restored), story(before));
  assert.deepEqual(restored.objects.map(({ id }) => id), before.objects.map(({ id }) => id));
  await shot(screenshot);
  steps.push({ action: 'save-reload', room: restored.room, turn: restored.turns, foot: feet(restored) });
  return { restored, packet };
}

async function importPlayedProgress() {
  await page.goto(url);
  await page.waitForFunction(() => window.render_game_to_text && JSON.parse(window.render_game_to_text()).art === 'loaded');
  assert.equal((await state()).mode, 'title');
  await page.locator('#start').click();
  await drain();
  await page.keyboard.press('Escape');
  await page.getByRole('tab', { name: '探索进度' }).click();
  await page.locator('#save-file').setInputFiles(checkpoint);
  await until(s => !s.processing && s.room === 'under_windmill', '正常实玩导出无法读取');
  const current = await drain();
  assert.ok(current.inventory.includes('splinter') && !current.inventory.includes('binoculars'));
  assert.equal(current.turns, saved.engine.state.turns);
  await shot('under-windmill');
}

async function playWindmill() {
  const onDeck = await interact('under_windmill:passage:u', 'u', 'windmill', {
    at: [269, 178], facing: 'w', screenshot: 'deck-entry',
  });
  assert.deepEqual(feet(onDeck), [273, 117, 'left']);
  assert.ok(glasses(onDeck), '完好平台应该出现望远镜');
  await walkTo([205, 117]);
  const { restored: restoredDeck } = await saveAndReopen('deck-reopened');
  assert.ok(glasses(restoredDeck));
  assert.equal(restoredDeck.flags.includes('binoculars_broken'), false);

  const fell = await interact('ranch:item:binoculars', 'take binoculars', 'reservoir', {
    at: [188, 113], facing: 'a', screenshot: 'fallen-in-water',
    animation: [{ event: 'ranch_fall', after: 0.9, name: 'planks-mid-fall' },
      { event: 'ranch_fall', after: 1.46, name: 'explorer-before-water-cut', scene: 'windmill' }],
  });
  assert.ok(fell.flags.includes('binoculars_broken'));
  assert.ok(!fell.inventory.includes('binoculars') && !glasses(fell));
  const { packet: fallSave } = await saveAndReopen('fallen-in-water-reopened');
  assert.equal(fallSave.engine.state.itemLoc.binoculars, 'underwater');
  assert.equal(fallSave.engine.state.itemLoc.splinter, 'underwater', '翻板落水后发光木片应在水底照明');

  const submerged = await interact('reservoir:passage:d', 'd', 'underwater', { screenshot: 'visible-underwater' });
  assert.ok(glasses(submerged), '发光木片应照出沉到水底的望远镜');
  assert.ok(steps.at(-1).pages.every(({ text }) => !text.includes('灯笼光束')), '没有提灯时不应描述其光束');
  const { restored: restoredBottom } = await saveAndReopen('underwater-reopened');
  assert.ok(glasses(restoredBottom));
  const recovered = await interact('ranch:item:binoculars', 'take binoculars', 'underwater', {
    at: [306, 174], facing: 'd', screenshot: 'binoculars-recovered',
  });
  assert.ok(recovered.inventory.includes('binoculars') && !glasses(recovered));
  assert.equal(recovered.score, restoredBottom.score + 1);

  await interact('underwater:passage:u', 'u', 'reservoir', { at: [355, 182], screenshot: 'surfaced' });
  await interact('reservoir:passage:s', 's', 'edge_reservoir', {
    at: [238, 192], facing: 's', screenshot: 'on-shore',
  });
  const ashore = await interact('edge_reservoir:passage:d', 'd', 'south_reservoir', {
    at: [234, 188], facing: 's', screenshot: 'on-south-bank',
  });
  assert.ok(ashore.inventory.includes('binoculars'));
  await saveAndReopen('south-bank-reopened');

  await page.keyboard.press('i');
  await page.getByRole('button', { name: '望远镜', exact: true }).click();
  assert.equal((await state()).heldItem, 'binoculars');
  const sight = await interact('south_reservoir:view-windmill', 'look at windmill through binoculars', 'south_reservoir', {
    at: [367, 130], facing: 'd', screenshot: 'view-through-binoculars',
    animation: [{ event: 'ranch_focus', after: 1.1, name: 'binoculars-focus' }],
  });
  assert.ok(sight.inventory.includes('binoculars'));
  assert.ok(steps.at(-1).pages.some(({ text }) => /风车|木板|平台/.test(text)), '举镜后应出现实际观察结果');
  return sight;
}

try {
  await importPlayedProgress();
  const finish = await playWindmill();
  assert.deepEqual(errors, []);
  await writeFile(join(output, 'result.json'), `${JSON.stringify({
    start: priorCheckpoint ? '使用此前正常走到风车下并导出的存档。' : '正常从标题游玩，真实拾取发光木片，再通过界面导出和导入到风车下。',
    steps, animationFrames, finish: story(finish), errors,
  }, null, 2)}\n`);
  console.log('风车正常上梯、翻板落水、潜水取镜、返岸与举镜远望通过');
} catch (error) {
  await shot('failure').catch(() => {});
  await writeFile(join(output, 'failure.json'), `${JSON.stringify({ message: error.message,
    current: await state().catch(() => null), steps, dialoguePages, animationFrames, errors,
  }, null, 2)}\n`);
  throw error;
} finally {
  await browser.close();
}
