// Browser regression for keeping the source on screen when a background fails.
// PLAYWRIGHT_MODULE may point to a locally installed Playwright entry.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createPrologueSession } from '../engine-adapter.js';
import { makeVisualSave, VISUAL_SAVE_KEY } from '../save.js';
import { SCENES } from '../scene-manifest.js';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const url = process.env.DEMO_URL || 'http://127.0.0.1:8080/2d-demo/';
const output = process.env.QA_OUTPUT || join(tmpdir(), 'trinity-2d-art-retry');
const source = 'flower_walk';
const target = 'the_wabe';
const targetArt = new URL(SCENES[target].background.image, url).href;

// Reach the destination in a separate engine session to make a valid save.
const fixture = createPrologueSession();
fixture.moveTo(fixture.state.room);
for (const direction of ['e', 'nw']) await fixture.processInput(direction);
assert.equal(fixture.state.room, target);
const [x, y] = SCENES[target].spawn;
const targetSave = makeVisualSave(fixture, { room: target, x, y, face: 'up' });

const stableState = page => page.evaluate(key => {
  const state = JSON.parse(window.render_game_to_text());
  return {
    processing: state.processing,
    mode: state.mode,
    position: { x: state.player.x, y: state.player.y, facing: state.player.facing },
    progress: {
      room: state.room, chapter: state.chapter, turns: state.turns, clock: state.storyClock,
      score: state.score, flags: state.flags, inventory: state.inventory, held: state.heldItem,
      observed: state.observed, discovery: state.discovery,
      title: document.querySelector('#room').textContent, save: localStorage.getItem(key),
    },
  };
}, VISUAL_SAVE_KEY);

async function drain(page) {
  for (let tries = 0; tries < 30; tries++) {
    const state = await stableState(page);
    if (state.processing) {
      await page.waitForFunction(() => !JSON.parse(window.render_game_to_text()).processing);
    } else if (state.mode === 'dialogue') {
      await page.keyboard.press('f');
    } else {
      return;
    }
  }
  throw new Error('对话未能完成');
}

async function clickExit(page, direction, room) {
  const exit = await page.evaluate(({ direction, room }) => JSON.parse(window.render_game_to_text()).exits
    .find(exit => exit.dir === direction && exit.target === room), { direction, room });
  assert.ok(exit, `缺少通往 ${room} 的 ${direction} 出口`);
  await page.evaluate(() => window.advanceTime(600));
  const bounds = await page.locator('canvas').boundingBox();
  assert.ok(bounds, '画布必须可见');
  await page.mouse.click(bounds.x + exit.x * bounds.width / 480, bounds.y + exit.y * bounds.height / 288);
}

async function tickUntil(page, predicate) {
  for (let tries = 0; tries < 140; tries++) {
    const state = await stableState(page);
    if (predicate(state)) return state;
    await page.evaluate(() => window.advanceTime(85));
  }
  throw new Error('移动或画面请求未完成');
}

async function startAtSource(page) {
  await page.goto(url);
  await page.waitForFunction(() => typeof window.render_game_to_text === 'function'
    && JSON.parse(window.render_game_to_text()).art === 'loaded');
  await page.locator('#start').click();
  await drain(page);
  await clickExit(page, 'e', source);
  await tickUntil(page, state => !state.processing && state.progress.room === source);
  await drain(page);
}

async function scenario(browser, { name, prepare, submit, errorLocator, expectedTurns }) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.setDefaultTimeout(7000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    const mockedAbort = message.location().url === targetArt && message.text().includes('net::ERR_FAILED');
    if (message.type() === 'error' && !mockedAbort) errors.push(message.text());
  });
  let releaseRequest;
  const holdRequest = new Promise(resolve => { releaseRequest = resolve; });
  let requests = 0;
  try {
    await page.route(targetArt, async route => {
      if (++requests === 1) {
        await holdRequest;
        await route.abort('failed');
      } else {
        await route.continue();
      }
    });
    await startAtSource(page);
    await prepare?.(page);
    const before = await stableState(page);
    assert.equal(requests, 0, '目的地画面应在首次进入时请求');
    await page.evaluate(() => {
      const title = document.querySelector('#room');
      window.artRetryTitles = [];
      new MutationObserver(records => {
        for (const record of records) {
          for (const node of record.addedNodes) window.artRetryTitles.push(node.textContent);
        }
      }).observe(title, { childList: true });
    });
    await submit(page);
    await tickUntil(page, state => state.processing && requests === 1);
    await page.keyboard.press('f');
    await page.waitForTimeout(125);
    const pending = await stableState(page);
    assert.equal(pending.processing, true);
    assert.deepEqual(pending.progress, before.progress, `${name} 等待画面期间保留当前进度`);
    releaseRequest();
    await page.waitForFunction(() => !JSON.parse(window.render_game_to_text()).processing);
    const failed = await stableState(page);
    assert.deepEqual(failed.progress, before.progress, `${name} 画面失败后保留当前进度`);
    assert.deepEqual(failed.position, pending.position, `${name} 画面失败后保留人物位置`);
    const titles = await page.evaluate(() => window.artRetryTitles);
    assert.ok(titles.every(title => title === before.progress.title), `${name} 提前显示目标标题 ${JSON.stringify(titles)}`);
    await page.locator(errorLocator).filter({ hasText: /画面加载失败/ }).waitFor();
    await page.screenshot({ path: join(output, `${name}-failed.png`) });
    assert.equal(requests, 1, '玩家重试前不应在后台重复请求');

    await drain(page);
    await submit(page);
    const retried = await tickUntil(page, state => !state.processing && state.progress.room === target);
    const saved = JSON.parse(retried.progress.save);
    assert.equal(requests, 2, '重试应重新请求目的地画面');
    assert.equal(retried.progress.title, SCENES[target].label);
    assert.equal(retried.progress.turns, expectedTurns(before));
    assert.equal(saved.engine.state.room, target);
    assert.equal(saved.visual.room, target);
    assert.equal(saved.engine.state.turns, retried.progress.turns);
    await page.screenshot({ path: join(output, `${name}-retried.png`) });
    assert.deepEqual(errors, []);
    return { scenario: name, source, target, turns: [before.progress.turns, failed.progress.turns, retried.progress.turns], requests };
  } finally {
    releaseRequest();
    await page.close();
  }
}

await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  const results = [
    await scenario(browser, {
      name: 'passage', submit: page => clickExit(page, 'nw', target), errorLocator: '#text',
      expectedTurns: sourceState => sourceState.progress.turns + 1,
    }),
    await scenario(browser, {
      name: 'import',
      prepare: async page => {
        await page.keyboard.press('Escape');
        await page.getByRole('tab', { name: '探索进度' }).click();
      },
      submit: page => page.locator('#save-file').setInputFiles({
        name: 'art-retry.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(targetSave)),
      }),
      errorLocator: '#save-message', expectedTurns: () => targetSave.engine.state.turns,
    }),
  ];
  await writeFile(join(output, 'result.json'), `${JSON.stringify(results, null, 2)}\n`);
  console.log('通过 2D 画面失败与重试检查（场景切换、存档导入）');
} finally {
  await browser.close();
}
