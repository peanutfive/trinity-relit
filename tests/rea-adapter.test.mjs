import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, mkdir, symlink, rm, chmod } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { assertEvidenceDestination, captureScenario, compareCaptures, doctorRea, parseReaJson, reaInvocation, runRea, summarizeCapture, writeEvidence } from '../scripts/original-research/lib/rea.mjs';

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'trinity-rea-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const repo = join(root, 'repo'); await mkdir(repo);
  const fake = join(root, 'fake-rea.mjs');
  await writeFile(fake, `const a=process.argv.slice(2);if(a[0]==='--version')console.log('6.4.0');else if(a.includes('--help'))console.log(a[0]);else console.log(JSON.stringify({operation:a[0],normalized_result:{unknown:['fixture'],cleanup:'not_observed'},arguments:a.slice(1)}));`);
  return { root, repo, fake, options: { node: process.execPath, rea: fake, repositoryRoot: repo } };
}

test('REA invocation uses argv without shell interpolation and requires explicit compatible paths', () => {
  assert.deepEqual(reaInvocation({ rea: '/tmp/space ; $(whoami)/rea.mjs', node: '/tmp/node' }, ['capture-process', 'a b']), {
    command: '/tmp/node', args: ['/tmp/space ; $(whoami)/rea.mjs', 'capture-process', 'a b'],
  });
  assert.throws(() => reaInvocation({ node: '/tmp/node', rea: 'rea.mjs' }), /absolute/);
});

test('Evidence writer refuses repository paths, symlink traversal and overwrite', async t => {
  const f = await fixture(t);
  await assert.rejects(assertEvidenceDestination(join(f.repo, 'deep', 'capture.json'), { repositoryRoot: f.repo }), /仓库之外/);
  const link = join(f.root, 'link'); await symlink(f.repo, link);
  await assert.rejects(assertEvidenceDestination(join(link, 'capture.json'), { repositoryRoot: f.repo }), /仓库之外/);
  const other = join(f.root, 'another-checkout'); await mkdir(other); await writeFile(join(other, '.git'), 'gitdir: /unrelated/common');
  await assert.rejects(assertEvidenceDestination(join(other, 'capture.json'), { repositoryRoot: f.repo }), /Git checkout/);
  const out = join(f.root, 'evidence.json');
  await writeEvidence(out, { original: true }, { repositoryRoot: f.repo });
  await assert.rejects(writeEvidence(out, { original: false }, { repositoryRoot: f.repo }), { code: 'EEXIST' });
  assert.deepEqual(JSON.parse(await readFile(out, 'utf8')), { original: true });
});

test('capture preserves upstream unknowns and invokes the real CLI contract', async t => {
  const f = await fixture(t);
  const scenario = join(f.root, 'scenario.json');
  await writeFile(scenario, JSON.stringify({ executable: '/tmp/fixture-program' }));
  const out = join(f.root, 'capture.json');
  const result = await captureScenario({ ...f.options, scenario, out });
  assert.equal(result.data.operation, 'capture-process');
  assert.deepEqual(result.data.arguments, [scenario, '--format', 'json']);
  assert.deepEqual(result.data.normalized_result.unknown, ['fixture']);
  assert.deepEqual(JSON.parse(await readFile(out, 'utf8')), result.data);
  await assert.rejects(captureScenario({ ...f.options, scenario, out: scenario }), /differ/);
});

test('compare passes optional trace and preserves upstream result', async t => {
  const f = await fixture(t);
  const paths = ['left', 'right', 'trace'].map(name => join(f.root, `${name}.json`));
  for (const path of paths) await writeFile(path, '{}');
  const result = await compareCaptures({ ...f.options, left: paths[0], right: paths[1], trace: paths[2], out: join(f.root, 'comparison.json') });
  assert.equal(result.data.operation, 'compare-process-captures');
  assert.deepEqual(result.data.arguments, [...paths, '--format', 'json']);
});

test('upstream errors, non-JSON and byte-budget failure never become valid Evidence', async t => {
  assert.throws(() => parseReaJson({ code: 0, text: 'not JSON', stderr: '' }), /did not return JSON/);
  assert.throws(() => parseReaJson({ code: 1, text: JSON.stringify({ error: 'no PTY', code: 'capture_unavailable' }), stderr: '' }), /capture_unavailable/);
  const f = await fixture(t);
  await assert.rejects(runRea(['capture-process'], { ...f.options, maxBytes: 4 }), /byte limit/);
});

test('doctor reports installed CLI separately from unverified reference commit', async t => {
  const f = await fixture(t);
  const report = await doctorRea(f.options);
  assert.equal(report.installed_version, '6.4.0');
  assert.equal(report.commands_present, true);
  assert.equal(report.source_identity, 'not_verified_by_version');
  assert.equal(report.reference.commit, 'd901561640121272bf1498d85e38e1ac8b3f5793');
});


test('outer deadline is bounded even when a selected CLI ignores graceful shutdown', async t => {
  const f = await fixture(t);
  await writeFile(f.fake, "process.on('SIGTERM',()=>{});setInterval(()=>{},1000);");
  await assert.rejects(runRea([], { ...f.options, timeoutMs: 100, cleanupGraceMs: 50 }), /outer time limit/);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(runRea([], { ...f.options, signal: controller.signal }), /before launch/);
});


test('operator summary preserves truncation and unknowns without claiming game equivalence', () => {
  const evidence = { evidence_id: 'fixture', normalized_result: { frames: [], exit: { reason: 'timeout' }, truncated: true, residual_unknowns: [{ scope: 'network', reason: 'not observed' }] } };
  const summary = summarizeCapture(evidence);
  assert.equal(summary.exit.reason, 'timeout');
  assert.equal(summary.truncated, true);
  assert.deepEqual(summary.residual_unknowns, evidence.normalized_result.residual_unknowns);
  assert.equal(summary.complete_equivalence_proven, false);
  assert.equal(summary.internal_game_state, 'not_observed');
  assert.equal(summarizeCapture({}).kind, 'unrecognized');
});


test('doctor distinguishes the adapter runtime from explicitly selected REA Node', async t => {
  const f = await fixture(t);
  const launcher = join(f.root, 'selected-node');
  await writeFile(launcher, `#!${process.execPath}
import { spawnSync } from 'node:child_process';
if(process.argv[2]==='--version')console.log('v24.99.1');
else { const r=spawnSync(process.execPath,process.argv.slice(2),{stdio:'inherit'});process.exit(r.status??1); }
`);
  await chmod(launcher, 0o700);
  const report = await doctorRea({ ...f.options, node: launcher });
  assert.equal(report.adapter_node, process.version);
  assert.equal(report.rea_node, 'v24.99.1');
  assert.equal(report.node, undefined);
  const unspecified = await doctorRea({ rea: launcher });
  assert.equal(unspecified.adapter_node, process.version);
  assert.equal(unspecified.rea_node, 'unknown');
});
