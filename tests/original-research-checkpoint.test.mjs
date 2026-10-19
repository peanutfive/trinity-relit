import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { hash, TARGET, SOURCE } from '../scripts/original-research/lib/common.mjs';
import { checkpointCommands, parseQuetzal, validateCheckpointArtifacts, validateHistory, createCheckpoint, restoreCheckpoint } from '../scripts/original-research/lib/checkpoint.mjs';

function saveFixture() {
  const bytes = Buffer.alloc(34);
  bytes.write('FORM'); bytes.writeUInt32BE(26, 4); bytes.write('IFZS', 8); bytes.write('IFhd', 12); bytes.writeUInt32BE(13, 16);
  bytes.writeUInt16BE(TARGET.release, 20); bytes.write(TARGET.serial, 22); bytes.writeUInt16BE(TARGET.checksum, 28); bytes.writeUIntBE(0x12345, 30, 3);
  return bytes;
}
function bundleFixture(withContinuation = false) {
  const commands = ['north', 'look', 'inventory', 'score'];
  const continuations = withContinuation ? [{ commandIndex: 0, lineSha256: hash('fixture continuation'), key: '\n' }] : [];
  let stdout = '[Press any key to begin.]\n>';
  const steps = [], controls = [];
  for (let i = 0; i < commands.length; i++) {
    const start = stdout.length;
    if (withContinuation && i === 0) {
      stdout += 'fixture continuation\n';
      controls.push({ type: 'continuation', ...continuations[0], markerSpan: { start, end: stdout.length } });
    }
    stdout += `${commands[i]} fixture response\n`;
    steps.push({ index: i, command: commands[i], output: stdout.slice(start), outputSpan: { start, end: stdout.length } });
    stdout += '>';
  }
  const start = stdout.length; stdout += '[SAVE completed.]\n';
  controls.push({ type: 'save', output: stdout.slice(start), outputSpan: { start, end: stdout.length } }); stdout += '>';
  const interpreterSHA256 = hash('fixture interpreter');
  const transcript = { schemaVersion: 1, kind: 'trinity-checkpoint-creation', origin: 'fresh-start', complete: true, requestedCommands: 4, completedCommands: 4, steps, controls, stdout,
    storySHA256: TARGET.sha256, interpreterSHA256,
    execution: { exitCode: 0, exitSignal: null, closed: true, failure: null, truncated: false, forcedCleanup: false } };
  const saveBytes = saveFixture(), transcriptBytes = Buffer.from(JSON.stringify(transcript));
  const manifest = { schemaVersion: 1, kind: 'trinity-original-checkpoint', origin: 'fresh-start', sourceCommit: SOURCE.commit,
    story: { ...TARGET, matchesTarget: true, checksumValid: true }, interpreter: { sha256: interpreterSHA256 },
    save: { file: 'state.qzl', sha256: hash(saveBytes), bytes: saveBytes.length, ifhd: parseQuetzal(saveBytes) },
    creationTranscript: { file: 'creation.json', sha256: hash(transcriptBytes), bytes: transcriptBytes.length },
    history: { origin: 'fresh-start', commands, completedCommands: 4, commandsSHA256: hash(JSON.stringify(commands)), continuations,
      continuationsSHA256: hash(JSON.stringify(continuations)), historySHA256: hash(JSON.stringify({ commands, continuations })) },
    observations: steps.slice(-3).map(({ command, output }) => ({ command, output })) };
  return { manifest, saveBytes, transcriptBytes };
}
function replaceTranscript(bundle, mutate) {
  const transcript = JSON.parse(bundle.transcriptBytes); mutate(transcript);
  bundle.transcriptBytes = Buffer.from(JSON.stringify(transcript));
  bundle.manifest.creationTranscript.sha256 = hash(bundle.transcriptBytes);
  bundle.manifest.creationTranscript.bytes = bundle.transcriptBytes.length;
}

test('Quetzal parser binds IFhd and rejects truncated or non-Quetzal containers', () => {
  assert.deepEqual(parseQuetzal(saveFixture()), { release: 12, serial: '860926', checksum: 0x16ab, programCounter: 0x12345 });
  assert.throws(() => parseQuetzal(saveFixture().subarray(0, 30)), /complete Quetzal/);
  const bad = saveFixture(); bad.writeUInt32BE(50, 16);
  assert.throws(() => parseQuetzal(bad), /Truncated/);
  const missing = Buffer.alloc(12); missing.write('FORM'); missing.writeUInt32BE(4, 4); missing.write('IFZS', 8);
  assert.throws(() => parseQuetzal(missing), /no Quetzal IFhd/);
});

test('checkpoint command specs bind explicit continuation controls and reject hidden restarts', () => {
  assert.deepEqual(checkpointCommands(['north']), { commands: ['north'], continuations: [] });
  const spec = { commands: ['north'], continuations: [{ commandIndex: 0, lineSha256: hash('fixture'), key: '\n' }] };
  assert.deepEqual(checkpointCommands(spec), spec);
  assert.throws(() => checkpointCommands({ ...spec, continuations: [{ ...spec.continuations[0], commandIndex: 1 }] }), /continuations/);
  for (const command of ['restore', 'save', 'restart', '\\help', 'north then restore', 'north. restart', 'look\nrestore']) assert.throws(() => validateHistory([command]));
  assert.deepEqual(validateHistory(['examine save', 'north']), ['examine save', 'north']);
});

test('checkpoint validation binds exact story, save, creation transcript and full command history', () => {
  const bundle = bundleFixture();
  assert.equal(validateCheckpointArtifacts(bundle).manifest.origin, 'fresh-start');
  const alteredSave = { ...bundle, saveBytes: Buffer.from(bundle.saveBytes) }; alteredSave.saveBytes[30] ^= 1;
  assert.throws(() => validateCheckpointArtifacts(alteredSave), /digest/);
  const alteredTranscript = { ...bundle, transcriptBytes: Buffer.from('{}') };
  assert.throws(() => validateCheckpointArtifacts(alteredTranscript), /digest/);
  bundle.manifest.history.commands[0] = 'south';
  assert.throws(() => validateCheckpointArtifacts(bundle), /digest/);
});

test('restored origin, partial capture and invalid output spans cannot masquerade as a fresh checkpoint', () => {
  const restored = bundleFixture(); restored.manifest.origin = 'restored-checkpoint';
  assert.throws(() => validateCheckpointArtifacts(restored), /manifest/);
  const partial = bundleFixture(); replaceTranscript(partial, transcript => { transcript.complete = false; });
  assert.throws(() => validateCheckpointArtifacts(partial), /incomplete/);
  const forgedSpan = bundleFixture(); replaceTranscript(forgedSpan, transcript => { transcript.steps[0].outputSpan.end++; });
  assert.throws(() => validateCheckpointArtifacts(forgedSpan), /spans/);
  const wrongStory = bundleFixture(); wrongStory.manifest.story.sha256 = hash('another story');
  assert.throws(() => validateCheckpointArtifacts(wrongStory), /story identity/);
});

test('continuation keys require matching recorded marker spans, not only declared hashes', () => {
  const bundle = bundleFixture(true);
  assert.equal(validateCheckpointArtifacts(bundle).manifest.history.continuations.length, 1);
  replaceTranscript(bundle, transcript => { transcript.controls[0].markerSpan.end--; });
  assert.throws(() => validateCheckpointArtifacts(bundle), /marker/);
  const missing = bundleFixture(true); replaceTranscript(missing, transcript => { transcript.controls.shift(); });
  assert.throws(() => validateCheckpointArtifacts(missing), /continuation history/);
});

test('checkpoint creation and restore refuse existing output paths before running an interpreter', async t => {
  const root = await mkdtemp(path.join(tmpdir(), 'trinity-checkpoint-test-')); t.after(() => rm(root, { recursive: true, force: true }));
  const directory = path.join(root, 'existing'); await mkdir(directory);
  await assert.rejects(createCheckpoint({ dat: '/missing/story', commands: [], out: directory }), /already exists/);
  const output = path.join(root, 'result.json'); await writeFile(output, 'original evidence');
  await assert.rejects(restoreCheckpoint({ dat: '/missing/story', checkpoint: '/missing/manifest', commands: [], out: output }), /already exists/);
  assert.equal(await readFile(output, 'utf8'), 'original evidence');
});


test('checkpoint metadata rejects changed story headers, non-boolean identity, step indexes and signalled exits', () => {
  const header = bundleFixture(); header.manifest.story.release++;
  assert.throws(() => validateCheckpointArtifacts(header), /story identity/);
  const identity = bundleFixture(); identity.manifest.story.matchesTarget = 'true';
  assert.throws(() => validateCheckpointArtifacts(identity), /story identity/);
  const index = bundleFixture(); replaceTranscript(index, transcript => { transcript.steps[0].index = 9; });
  assert.throws(() => validateCheckpointArtifacts(index), /spans/);
  const signalled = bundleFixture(); replaceTranscript(signalled, transcript => { transcript.execution.exitSignal = 'SIGTERM'; });
  assert.throws(() => validateCheckpointArtifacts(signalled), /incomplete/);
  const schema = bundleFixture(); replaceTranscript(schema, transcript => { transcript.schemaVersion = 2; });
  assert.throws(() => validateCheckpointArtifacts(schema), /incomplete/);
});
