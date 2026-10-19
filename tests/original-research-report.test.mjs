import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { buildReport, reportSummary, validateManifest } from '../scripts/original-research/report.mjs';
import { fingerprints, parseScoreOutput } from '../scripts/original-research/lib/checks.mjs';
import { SOURCE, TARGET, hash } from '../scripts/original-research/lib/common.mjs';
import { indexSources } from '../scripts/original-research/lib/zil.mjs';

// Synthetic headers exercise the numeric grammar; no original transcript/rank is copied.
const scoreHeader = (score, moves, maximum = 100) => `[Your score is ${score} point${score === 1 ? '' : 's'} out of ${maximum}, in ${moves} move${moves === 1 ? '' : 's'}.]`;
function fixture() {
  const index = indexSources([{ path: 'fixture.zil', source: '<ROUTINE SAMPLE () <TELL "fixture recorded message">>' }], { sourceCommit: SOURCE.commit });
  const manifest = { schemaVersion: 1, sourceCommit: SOURCE.commit, target: { ...TARGET }, pilots: [{ id: 'sample', cases: [
    { id: 'sample-case', status: 'runtime-verified', commands: ['alpha', 'score'], checks: [
      { type: 'source-output', file: 'fixture.zil', symbol: 'SAMPLE', commandIndex: 0 },
      { type: 'score-output', commandIndex: 1, score: 17, moves: 4 },
    ] }, { id: 'static-case', status: 'static-only', commands: [], checks: [] },
  ] }] };
  const scenario = manifest.pilots[0].cases[0], outputs = ['fixture recorded message\n', scoreHeader(17, 4)];
  let stdout = 'fixture-start\n>';
  const steps = scenario.commands.map((command, index) => {
    const start = stdout.length, output = outputs[index];
    stdout += output;
    const end = stdout.length;
    stdout += '\n>';
    return { index, command, output, outputSpan: { start, end } };
  });
  const capture = { schemaVersion: 1, kind: 'trinity-command-transcript', caseId: scenario.id, pilotId: 'sample',
    complete: true, requestedCommands: 2, completedCommands: 2, sourceCommit: SOURCE.commit,
    ...fingerprints(manifest, scenario), origin: { kind: 'fresh-game' },
    story: { ...TARGET, matchesTarget: true, checksumValid: true }, steps, controls: [], stdout, stderr: '',
    execution: { exitCode: 0, exitSignal: null, closed: true, forcedCleanup: false, failure: null, truncated: false } };
  return { manifest, index, capture };
}
const report = ({ manifest, index, capture }) => buildReport({ manifest, index, captures: [capture] });
const first = result => result.pilots[0].cases[0];

test('报告区分有效采集、可见断言通过和源码静态线索', () => {
  const result = report(fixture()), scenario = first(result);
  assert.equal(scenario.status, 'captured');
  assert.equal(scenario.verification, 'verified');
  assert.equal(scenario.checks[0].status, 'observed-fragment');
  assert.match(scenario.checks[0].limitation, /not proof of full routine/);
  assert.deepEqual(scenario.checks[1].observed, { score: 17, maximum: 100, moves: 4 });
  assert.equal(result.sourceEvidence.binding, 'declared-index-hashes');
  assert.deepEqual(reportSummary(result), { captured: 1, verified: 1, failed: 0, unknown: 0, staticOnly: 1 });
});

test('已声明complete仍须核对真实退出、截断、计数、顺序、下标与原始输出范围', () => {
  const mutations = [
    value => value.capture.execution.exitCode = 1,
    value => value.capture.execution.exitSignal = 'SIGTERM',
    value => value.capture.execution.closed = false,
    value => value.capture.execution.truncated = true,
    value => value.capture.execution.forcedCleanup = true,
    value => value.capture.execution.failure = 'fixture failure',
    value => value.capture.completedCommands = 0,
    value => value.capture.requestedCommands = 99,
    value => value.capture.steps[0].index = 99,
    value => value.capture.steps.reverse(),
    value => value.capture.steps.pop(),
    value => value.capture.steps[0].output = 'unbound reply',
    value => value.capture.steps[1].outputSpan.start = 0,
    value => delete value.capture.steps[0].outputSpan,
    value => value.capture.controls = [{ type: 'save' }],
  ];
  for (const mutate of mutations) {
    const value = fixture(); mutate(value);
    const scenario = first(report(value));
    assert.equal(scenario.status, 'incomplete');
    assert.equal(scenario.verification, 'failed');
    assert.ok(scenario.checks.every(check => check.status === 'invalid-evidence' && check.pass === false));
  }
});

test('精确发行版和manifest/scenario指纹拒绝旧版本或同指令不同前置条件', () => {
  for (const field of ['version', 'release', 'serial', 'checksum', 'sha256']) {
    const value = fixture();
    value.capture.story[field] = typeof TARGET[field] === 'number' ? -1 : 'unrelated';
    assert.equal(first(report(value)).status, 'incomplete');
  }
  for (const mutate of [
    value => value.manifest.pilots[0].cases[0].description = 'changed fixture precondition',
    value => value.capture.manifestSha256 = '0'.repeat(64),
    value => value.capture.scenarioSha256 = '0'.repeat(64),
    value => value.capture.pilotId = 'other-pilot',
    value => value.capture.origin = { kind: 'restored-checkpoint' },
    value => value.capture.commandsPrefix = ['restore'],
  ]) {
    const value = fixture(); mutate(value);
    assert.equal(first(report(value)).status, 'incomplete');
  }
});

test('额外继续键须对应manifest和原始行标记，不能隐藏其他交互', () => {
  const value = fixture(), scenario = value.manifest.pilots[0].cases[0];
  scenario.continuations = [{ commandIndex: 0, lineSha256: hash('fixture recorded message'), key: '\n' }];
  Object.assign(value.capture, fingerprints(value.manifest, scenario));
  value.capture.controls = [{ type: 'continuation', ...scenario.continuations[0], markerSpan: { ...value.capture.steps[0].outputSpan } }];
  assert.equal(first(report(value)).verification, 'verified');
  value.capture.controls[0].key = ' ';
  assert.equal(first(report(value)).status, 'incomplete');
  value.capture.controls[0].key = '\n';
  value.capture.controls[0].markerSpan.start++;
  assert.equal(first(report(value)).status, 'incomplete');
});

test('未知、重复capture和重复manifest id不能静默覆盖证据', () => {
  const value = fixture();
  assert.throws(() => buildReport({ ...value, captures: [value.capture, structuredClone(value.capture)] }), /Duplicate capture/);
  assert.throws(() => buildReport({ ...value, captures: [{ ...value.capture, caseId: 'unknown' }] }), /unknown/);
  value.manifest.pilots[0].cases.push(structuredClone(value.manifest.pilots[0].cases[0]));
  assert.throws(() => report(value), /Duplicate or invalid case/);
});

test('manifest的pilot/case标识拒绝路径穿越、绝对路径与反斜线', () => {
  for (const id of ['../escape', '/absolute', 'nested/case', 'nested\\case']) {
    const pilot = fixture(); pilot.manifest.pilots[0].id = id;
    assert.throws(() => validateManifest(pilot.manifest), /invalid pilot id/);
    const scenario = fixture(); scenario.manifest.pilots[0].cases[0].id = id;
    assert.throws(() => validateManifest(scenario.manifest), /invalid case id/);
  }
});

test('manifest必须声明完整目标身份，分数检查须绑定score指令和有效下标', () => {
  for (const mutate of [
    value => delete value.target.sha256,
    value => value.target.release = 999,
    value => value.sourceCommit = 'a'.repeat(40),
    value => value.pilots[0].cases[0].checks[1].commandIndex = 0,
    value => value.pilots[0].cases[0].checks[1].moves = -1,
  ]) {
    const { manifest } = fixture(); mutate(manifest);
    assert.throws(() => validateManifest(manifest));
  }
});

test('分数解析支持换行、控制码、单复数，并拒绝多次或错误上限', () => {
  assert.deepEqual(parseScoreOutput('\x1b[31m' + scoreHeader(1, 1).replace('out of', 'out\nof') + '\x1b[0m'), { score: 1, maximum: 100, moves: 1 });
  assert.equal(parseScoreOutput(scoreHeader(2, 7, 99)), null);
  assert.equal(parseScoreOutput(scoreHeader(2, 7) + scoreHeader(2, 8)), null);
  assert.equal(parseScoreOutput(scoreHeader(2, 7) + '[Your score is ?]'), null);
  assert.equal(parseScoreOutput('17 100 4'), null);
});

test('输出断言不匹配或不可解析会分别报告failed/unknown，不能冒充verified', () => {
  const mismatch = fixture();
  mismatch.manifest.pilots[0].cases[0].checks[1].moves = 999;
  Object.assign(mismatch.capture, fingerprints(mismatch.manifest, mismatch.manifest.pilots[0].cases[0]));
  assert.equal(first(report(mismatch)).verification, 'failed');
  const unknown = fixture();
  unknown.manifest.pilots[0].cases[0].checks[0].symbol = 'MISSING';
  Object.assign(unknown.capture, fingerprints(unknown.manifest, unknown.manifest.pilots[0].cases[0]));
  assert.equal(first(report(unknown)).verification, 'unknown');
  assert.equal(reportSummary(report(unknown)).unknown, 1);
  const corrupt = fixture();
  corrupt.index.strings[0].span.file = 'different.zil';
  assert.throws(() => report(corrupt), /provenance/);
});

test('report CLI 对重复转录和失败检查返回失败，不产出歧义成功报告', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'trinity-report-fixture-'));
  try {
    const value = fixture();
    await mkdir(path.join(root, 'captures'));
    await writeFile(path.join(root, 'manifest.json'), JSON.stringify(value.manifest));
    await writeFile(path.join(root, 'index.json'), JSON.stringify(value.index));
    await writeFile(path.join(root, 'captures', 'a.json'), JSON.stringify({ ...value.capture, complete: false }));
    await writeFile(path.join(root, 'captures', 'z.json'), JSON.stringify(value.capture));
    const command = [path.resolve('scripts/original-research/report.mjs'), '--manifest', path.join(root, 'manifest.json'), '--index', path.join(root, 'index.json'), '--captures', path.join(root, 'captures'), '--out', path.join(root, 'report.json')];
    const duplicate = spawnSync(process.execPath, command, { encoding: 'utf8' });
    assert.notEqual(duplicate.status, 0);
    assert.match(duplicate.stderr, /Duplicate capture/);
    await rm(path.join(root, 'captures', 'z.json'));
    const failed = spawnSync(process.execPath, command, { encoding: 'utf8' });
    assert.equal(failed.status, 1);
    assert.equal(JSON.parse(failed.stdout).failed, 1);
  } finally { await rm(root, { recursive: true, force: true }); }
});
