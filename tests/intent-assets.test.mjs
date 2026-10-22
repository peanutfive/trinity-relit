import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { INTENT_ASSET_FILES, inspectIntentAssets, formatIntentAssets } from '../scripts/check-intent-assets.mjs';

async function fixture(t, complete = false) {
  const root = await mkdtemp(join(tmpdir(), 'trinity-intent-assets-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  if (complete) for (const file of INTENT_ASSET_FILES) {
    const path = join(root, file);
    await mkdir(join(path, '..'), { recursive: true });
    await writeFile(path, 'synthetic fixture'); // 不含真实模型或原版数据。
  }
  return root;
}

test('全新工作树缺少模型时，预检明确失败且指出当前目录准备命令', async t => {
  const root = await fixture(t);
  const result = await inspectIntentAssets(root);
  assert.equal(result.ready, false);
  assert.equal(result.files.length, 11);
  assert.ok(result.files.every(file => file.status === 'missing'));
  assert.match(formatIntentAssets(result), /npm run prepare:models/);
  assert.ok(formatIntentAssets(result).includes(root));
});

test('只有完整的双语运行必需文件集合才报告就绪，不把权重本体存在当作完成', async t => {
  const root = await fixture(t, true);
  assert.equal((await inspectIntentAssets(root)).ready, true);
  await rm(join(root, 'models/Xenova/bge-small-en-v1.5/tokenizer_config.json'));
  const result = await inspectIntentAssets(root);
  assert.equal(result.ready, false);
  assert.deepEqual(result.files.filter(file => file.status !== 'ok').map(file => file.path),
    ['models/Xenova/bge-small-en-v1.5/tokenizer_config.json']);
});

test('空运行库和同名目录不能冒充已准备资源', async t => {
  const root = await fixture(t, true);
  await writeFile(join(root, 'transformers.min.js'), '');
  await rm(join(root, 'ort-wasm-simd.wasm'));
  await mkdir(join(root, 'ort-wasm-simd.wasm'));
  const result = await inspectIntentAssets(root);
  assert.equal(result.ready, false);
  assert.equal(result.files.find(file => file.path === 'transformers.min.js').status, 'empty');
  assert.equal(result.files.find(file => file.path === 'ort-wasm-simd.wasm').status, 'not-file');
});

test('命令行对缺失资源返回失败，资源就绪返回成功', async t => {
  const root = await fixture(t);
  const script = fileURLToPath(new URL('../scripts/check-intent-assets.mjs', import.meta.url));
  let failure;
  try { execFileSync(process.execPath, [script, '--root', root], { encoding: 'utf8' }); }
  catch (error) { failure = error; }
  assert.equal(failure?.status, 1);
  assert.match(failure.stdout, /本地语义资源未准备完整/);
  const complete = await fixture(t, true);
  assert.match(execFileSync(process.execPath, [script, '--root', complete], { encoding: 'utf8' }), /已就绪/);
});
