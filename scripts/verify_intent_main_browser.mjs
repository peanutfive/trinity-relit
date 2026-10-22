// 正常新游戏 + 实际main输入框；不注入房间、物品或进度，不接触玩家上下文。
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { INTENT_ASSET_FILES } from './check-intent-assets.mjs';

const option = (name, fallback) => { const i = process.argv.indexOf(name); return i < 0 ? fallback : process.argv[i + 1]; };
const url = option('--url', 'http://127.0.0.1:8083/');
let origin;
const output = resolve(option('--output-dir', '/tmp/trinity-intent-main'));
const timeout = Number(option('--timeout-ms', '60000'));
const channel = option('--channel', undefined);
const modulePath = option('--playwright', 'playwright');
const run = { startedAt: new Date().toISOString(), url, channel: channel || 'chromium' };
const errors = [], consoleErrors = [], externalRequests = [], assetResponses = [], assetHeads = [];
let browser, page, workers = 0, modelRequests = 0;
mkdirSync(output, { recursive: true });
const receipt = (passed, detail = {}) => writeFileSync(`${output}/result.json`, JSON.stringify({
  ...run, passed, workers, modelRequests, errors, consoleErrors, externalRequests, assetHeads, assetResponses, ...detail,
}, null, 2));
receipt(false, { status: 'running' });
try {
  origin = new URL(url).origin;
  assert.ok(Number.isFinite(timeout) && timeout > 0, '--timeout-ms须为正数');
  const guide = readFileSync(new URL('../docs/PLAYTEST_GUIDE_CN.md', import.meta.url), 'utf8');
  const prefix = [...guide.matchAll(/^\| (\d+) \| `([^`]+)` \|/gm)]
    .filter(match => Number(match[1]) <= 20);
  assert.deepEqual(prefix.map(match => Number(match[1])), Array.from({ length: 20 }, (_, i) => i + 1));
  const { chromium } = await import(modulePath === 'playwright' ? modulePath : pathToFileURL(resolve(modulePath)).href);
  browser = await chromium.launch({ headless: true, channel });
  const context = await browser.newContext({ viewport: { width: 1280, height: 960 }, acceptDownloads: true });
  await context.route('**/*', route => {
    const target = new URL(route.request().url());
    // 字体与语义无关，独立测试用本机回退字体；推理资源不允许远程回退。
    if (target.hostname === 'fonts.googleapis.com') return route.fulfill({ status: 200, contentType: 'text/css', body: '' });
    if (target.origin !== origin) { externalRequests.push(target.href); return route.abort(); }
    if (target.pathname.endsWith('/favicon.ico')) return route.fulfill({ status: 204 });
    return route.continue();
  });
  context.on('request', request => { if (request.url().endsWith('/model_quantized.onnx')) modelRequests++; });
  context.on('response', response => {
    if (response.url().includes('/vendor/intent/')) assetResponses.push({ url: response.url(), status: response.status() });
  });
  // 先检查实际服务目录，避免本机文件存在、服务却指向另一工作树时误判。
  for (const path of INTENT_ASSET_FILES) {
    const response = await context.request.head(new URL(`vendor/intent/${path}`, url).href, { timeout, maxRedirects: 0 });
    assetHeads.push({ path, status: response.status() });
    assert.equal(response.status(), 200, `${path}未就绪；请在服务工作树运行 npm run prepare:models`);
  }
  page = await context.newPage();
  page.on('worker', () => workers++);
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  await page.goto(url);
  const ready = () => page.waitForFunction(() => document.querySelector('#input')?.disabled === false, null, { timeout });
  async function liveSave() {
    const pending = page.waitForEvent('download', { timeout });
    await page.locator('#btn-export').click();
    const download = await pending;
    const path = await download.path();
    assert.ok(path, '实际导出未生成存档');
    return JSON.parse(readFileSync(path, 'utf8'));
  }
  async function screenshot(name) {
    await page.locator('#output').evaluate(log => { log.style.scrollBehavior = 'auto'; log.scrollTop = log.scrollHeight; });
    await page.waitForFunction(() => { const log = document.querySelector('#output'); return log.scrollHeight - log.clientHeight - log.scrollTop < 2; });
    await page.screenshot({ path: `${output}/${name}.png` });
  }
  async function assertHealthy() {
    assert.deepEqual(errors, []);
    assert.deepEqual(consoleErrors, []);
    assert.deepEqual(externalRequests, []);
    assert.doesNotMatch(await page.locator('#output').innerText(), /处理指令时遇到问题，请重试|语义识别暂时不可用|这句话无法识别|错误：/);
  }
  await ready();
  assert.equal(await page.getByRole('button', { name: '继续上次冒险', exact: true }).count(), 0, '必须从隔离的新游戏开始');
  for (const match of prefix) {
    await page.locator('#input').fill(match[2]);
    await page.locator('#input').press('Enter');
    await ready();
  }
  const checkpoint = await liveSave();
  assert.equal(checkpoint.state.turns, 20);
  assert.equal(checkpoint.state.room, 'lancaster_walk');
  assert.equal(checkpoint.state.itemLoc.umbrella, 'inventory');
  assert.ok(checkpoint.state.flags.includes('wind_changed'));
  assert.ok(!checkpoint.state.flags.includes('in_pram'));
  assert.deepEqual(assetResponses, [], '标准前缀不应加载语义组件');
  assert.equal(workers, 0);
  const diskState = () => page.evaluate(version => JSON.parse(localStorage.getItem(`trinity-relit:save:v${version}`)).state, checkpoint.version);
  const unchanged = async () => {
    assert.deepEqual((await liveSave()).state, checkpoint.state, '当前活进度在确认前/取消后改变');
    assert.deepEqual(await diskState(), checkpoint.state, '确认前/取消后不应改写存档');
  };
  const propose = async () => {
    await page.locator('#input').fill('撑开伞');
    await page.locator('#input').press('Enter');
  };
  const suggestion = () => page.getByRole('button', { name: '撑伞', exact: true }).waitFor({ timeout });
  const cancel = async () => {
    await page.getByRole('button', { name: '都不是，重新输入', exact: true }).click();
    await ready();
    await unchanged();
  };

  await propose();
  await page.getByRole('button', { name: '下载并启用', exact: true }).waitFor({ timeout });
  assert.equal(modelRequests, 0, '同意前不能下载模型');
  assert.deepEqual(assetResponses, [], '同意前不应启动推理组件');
  assert.deepEqual(await diskState(), checkpoint.state);
  await page.getByRole('button', { name: '下载并启用', exact: true }).click();
  await suggestion();
  await unchanged();
  await screenshot('cold-suggestion');
  await cancel();
  await propose();
  await suggestion();
  await unchanged();
  await cancel();
  assert.equal(workers, 1, '连续请求应复用Worker');
  assert.equal(modelRequests, 1, '连续请求只下载一次中文权重');

  await page.reload();
  await page.getByRole('button', { name: '继续上次冒险', exact: true }).click();
  await ready();
  await unchanged();
  await propose();
  await suggestion();
  await unchanged();
  await screenshot('resumed-suggestion');
  assert.equal(workers, 2, '刷新后应创建新的Worker');
  assert.equal(modelRequests, 1, '新Worker应从Cache Storage读取权重');
  await page.getByRole('button', { name: '撑伞', exact: true }).click();
  await ready();
  const ending = await liveSave();
  assert.equal(ending.state.turns, 21);
  assert.equal(ending.state.room, 'round_pond');
  assert.equal(ending.state.dead, false);
  assert.deepEqual(await diskState(), ending.state, '确认后必须正确自动保存');
  assert.match(await page.locator('#output').innerText(), /The west wind fills the umbrella the moment you open it/);
  await screenshot('confirmed');
  await assertHealthy();
  const loaded = assetResponses.filter(item => item.status === 200).map(item => item.url);
  assert.ok(loaded.some(path => path.endsWith('/transformers.min.js')));
  assert.ok(loaded.some(path => path.endsWith('.wasm')));
  assert.ok(loaded.some(path => path.endsWith('/bge-small-zh-v1.5/onnx/model_quantized.onnx')));
  const result = { status: 'complete', normalPrefixInputs: 20, input: '撑开伞', candidate: '撑伞',
    liveAndDiskStatePreserved: true, confirmationTurns: ending.state.turns - checkpoint.state.turns,
    finalRoom: ending.state.room, freshContext: true, reloadUsesCacheStorage: true };
  receipt(true, result);
  console.log(JSON.stringify({ passed: true, ...result, workers, modelRequests }));
} catch (error) {
  receipt(false, { status: 'failed', error: String(error?.stack || error) });
  throw error;
} finally { await browser?.close(); }
