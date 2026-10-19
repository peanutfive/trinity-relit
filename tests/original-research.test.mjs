import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, mkdir, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { identifyStory } from '../scripts/original-research/baseline.mjs';
import { assertEvidencePath, ROOT, writeEvidence, SOURCE, TARGET } from '../scripts/original-research/lib/common.mjs';
import { captureTranscript } from '../scripts/original-research/lib/capture.mjs';
import { indexSources } from '../scripts/original-research/lib/zil.mjs';
import { checkSourceOutput, buildReport } from '../scripts/original-research/report.mjs';
import { reaScenario } from '../scripts/original-research/scenario.mjs';

const temporary = async fn => {
  const root = await mkdtemp(path.join(tmpdir(), 'trinity-research-test-'));
  try { return await fn(root); } finally { await rm(root, { recursive: true, force: true }); }
};
test('原版身份校验检测头部、声明长度、校验和以及截断', () => {
  const bytes = Buffer.alloc(80); bytes[0] = 4; bytes.writeUInt16BE(12, 2);
  bytes.write('860926', 18); bytes.writeUInt16BE(20, 26); bytes[64] = 7; bytes.writeUInt16BE(7, 28);
  assert.equal(identifyStory(bytes).checksumValid, true);
  assert.equal(identifyStory(bytes).matchesTarget, false, '合成头部不能冒充指定发行版');
  bytes[65] = 1;
  assert.equal(identifyStory(bytes).checksumValid, false);
  assert.throws(() => identifyStory(bytes.subarray(0, 79)), /truncated/);
});

test('证据路径拒绝源码覆盖、其他checkout及悬空symlink绕过', async () => temporary(async dir => {
  await assert.rejects(assertEvidencePath(path.join(ROOT, 'README.md')), /outside/);
  await mkdir(path.join(dir, '.git'));
  await assert.rejects(assertEvidencePath(path.join(dir, 'evidence.json')), /Git checkout/);
  const local = path.join(ROOT, '.local-research', path.basename(dir));
  await mkdir(local, { recursive: true });
  try {
    const escaped = path.join(ROOT, 'never-create-original-evidence.json');
    await symlink(escaped, path.join(local, 'dangling.json'));
    await assert.rejects(writeEvidence(path.join(local, 'dangling.json'), {}), /outside/);
    await assert.rejects(readFile(escaped), { code: 'ENOENT' });
    await symlink(path.join(local, 'loop.json'), path.join(local, 'loop.json'));
    await assert.rejects(assertEvidencePath(path.join(local, 'loop.json')), /Cyclic/);
  } finally { await rm(local, { recursive: true, force: true }); }
}));

const fixture = String.raw`
process.stdin.setEncoding('utf8');
process.stdout.write('[Press any key to begin.]');
let started=false, input='';
process.stdin.on('data', chunk => {
 input+=chunk;
 while(input.includes('\n')) {
  const index=input.indexOf('\n'); const line=input.slice(0,index); input=input.slice(index+1);
  if(!started){started=true;process.stdout.write('\n>');continue;}
  if(line==='quit'){process.exit(0);}
  if(line==='hang'){continue;}
  process.stdout.write((line==='large'?'x'.repeat(10000):'reply:'+line)+'\n>');
 }
});
`;
async function runFixture(dir, commands, extra = {}) {
  const file = path.join(dir, 'fixture.cjs'); await writeFile(file, fixture);
  return captureTranscript({ executable: process.execPath, arguments: [file], commands, timeoutMs: 5000, stepTimeoutMs: 1000, ...extra });
}
test('交互采集不吞第一条命令，并按实际提示符关联每条响应', async () => temporary(async dir => {
  const result = await runFixture(dir, ['alpha', 'beta']);
  assert.equal(result.complete, true);
  assert.deepEqual(result.steps.map(step => step.command), ['alpha', 'beta']);
  assert.match(result.steps[0].output, /reply:alpha/);
  assert.doesNotMatch(result.steps[0].output, /reply:beta/);
}));
test('等待、输出截断和启动错误都不能冒充完整采集', async () => temporary(async dir => {
  const timed = await runFixture(dir, ['hang'], { stepTimeoutMs: 300 });
  assert.equal(timed.complete, false); assert.match(timed.execution.failure, /timeout/);
  const truncated = await runFixture(dir, ['large'], { outputLimit: 100 });
  assert.equal(truncated.complete, false); assert.equal(truncated.execution.truncated, true);
  const missing = await captureTranscript({ executable: path.join(dir, 'missing'), commands: [] });
  assert.equal(missing.complete, false); assert.match(missing.execution.failure, /could not start/);
}));

test('源码片段命中绑定指定命令，支持ZIL换行且不推断隐藏状态', () => {
  const index = indexSources([{ path: 'sample.zil', source: '<ROUTINE SAMPLE () <TELL "fixture first|fixture second">>' }], { sourceCommit: 'abc' });
  const capture = { steps: [{ index: 0, command: 'alpha', output: 'fixture first\nfixture second' }, { index: 1, command: 'beta', output: 'different' }] };
  const check = { file: 'sample.zil', symbol: 'SAMPLE', commandIndex: 0, minLength: 16 };
  assert.equal(checkSourceOutput(check, capture, index).status, 'observed-fragment');
  assert.equal(checkSourceOutput({ ...check, commandIndex: 1 }, capture, index).status, 'not-observed');
  assert.equal(checkSourceOutput({ ...check, symbol: 'MISSING' }, capture, index).status, 'unknown');
  const manifest = { schemaVersion: 1, sourceCommit: SOURCE.commit, target: { ...TARGET }, pilots: [{ id: 'sample', cases: [{ id: 'a', commands: ['alpha'], status: 'runtime-verified' }, { id: 'b', status: 'static-only', commands: [] }] }] };
  const report = buildReport({ manifest, index: { ...index, sourceCommit: SOURCE.commit }, captures: [{ ...capture, caseId: 'a', complete: true, sourceCommit: SOURCE.commit, story: { ...TARGET, matchesTarget: true, checksumValid: true } }] });
  assert.equal(report.pilots[0].cases[0].status, 'incomplete', '不同指令序列的旧转录不可冒充新场景');
  assert.equal(report.pilots[0].cases[1].status, 'static-only');
});
test('REA场景单独派发开局键，定时命令与比较合同明确', () => {
  const scenario = reaScenario({ dat: '/tmp/sample.dat', dfrotz: '/tmp/fixture', cwd: '/tmp', commands: ['alpha'] });
  assert.equal(scenario.events[0].data, '\r');
  assert.equal(scenario.events[1].data, 'alpha\r');
  assert.ok(scenario.terminal.columns * (scenario.terminal.rows + scenario.terminal.scrollback) <= 1000000);
  assert.equal(scenario.events.at(-1).data, 'yes\r');
});
