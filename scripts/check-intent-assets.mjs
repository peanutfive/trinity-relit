// 本地推理资源就绪检查；只读文件，不下载或导入模型。
import { stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const INTENT_ASSET_FILES = Object.freeze([
  'transformers.min.js', 'ort-wasm-simd.wasm', 'ort-wasm.wasm',
  ...['bge-small-zh-v1.5', 'bge-small-en-v1.5'].flatMap(model =>
    ['config.json', 'tokenizer.json', 'tokenizer_config.json', 'onnx/model_quantized.onnx']
      .map(file => `models/Xenova/${model}/${file}`)),
]);
export const DEFAULT_INTENT_ROOT = fileURLToPath(new URL('../prototype/vendor/intent/', import.meta.url));

export async function inspectIntentAssets(root = DEFAULT_INTENT_ROOT) {
  root = resolve(root);
  const files = await Promise.all(INTENT_ASSET_FILES.map(async path => {
    try {
      const info = await stat(resolve(root, path));
      return { path, status: !info.isFile() ? 'not-file' : info.size <= 0 ? 'empty' : 'ok', bytes: info.isFile() ? info.size : 0 };
    } catch (error) {
      return { path, status: ['ENOENT', 'ENOTDIR'].includes(error.code) ? 'missing' : 'unreadable', bytes: 0 };
    }
  }));
  return { root, ready: files.every(file => file.status === 'ok'), files,
    bytes: files.reduce((sum, file) => sum + file.bytes, 0) };
}

export function formatIntentAssets(report) {
  if (report.ready) return `本地语义资源已就绪：${report.files.length}个运行所需文件，约${(report.bytes / 1048576).toFixed(1)} MB。`;
  const labels = { missing: '缺失', empty: '空文件', 'not-file': '不是文件', unreadable: '无法读取' };
  const failures = report.files.filter(file => file.status !== 'ok');
  return [
    `本地语义资源未准备完整：${failures.length}/${report.files.length}项不可用。`,
    ...failures.map(file => `  ${labels[file.status]}：${file.path}`),
    `资源目录：${report.root}`,
    '请在当前工作树运行 npm run prepare:models。每个新工作树需单独准备；标准指令仍可使用。',
    '此检查仅验证文件存在且非空，不代替真实模型加载验收。',
  ].join('\n');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const index = process.argv.indexOf('--root');
  if (index >= 0 && !process.argv[index + 1]) throw new Error('--root需要资源目录');
  const report = await inspectIntentAssets(index < 0 ? undefined : process.argv[index + 1]);
  console.log(formatIntentAssets(report));
  if (!report.ready) process.exitCode = 1;
}
