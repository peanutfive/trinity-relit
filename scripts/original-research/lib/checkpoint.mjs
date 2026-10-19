import { access, mkdir, readFile, realpath, lstat } from 'node:fs/promises';
import { constants } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { identifyStory } from '../baseline.mjs';
import { assertNewEvidencePath, writeEvidence, hash, TARGET, SOURCE } from './common.mjs';
import { captureTranscript } from './capture.mjs';

const exec = promisify(execFile);
const PROBES = ['look', 'inventory', 'score'];
const RESTORE_PROBES = ['score', 'inventory'];
const LIMITATIONS = [
  'Digests bind local files and command-history records; they are not signatures or proof against a forged provenance bundle.',
  'Quetzal IFhd binds release, serial and checksum only; exact story identity is checked separately by SHA256.',
  'Normal SAVE/RESTORE preserves interpreter state; terminal probes do not expose every VM flag, timer or random branch.',
  'Only fresh-start checkpoint creation is supported. Restored observations are never labelled fresh-start.',
  'Only the root interpreter lifecycle is controlled; descendant cleanup is not observed.',
];

export function validateHistory(commands) {
  if (!Array.isArray(commands) || commands.length > 500 || commands.some(command => typeof command !== 'string' || !command.trim() || /[\r\n\0]/.test(command))) throw new Error('Checkpoint commands must be up to 500 nonempty single lines');
  // Interpreter controls must have explicit recorded provenance, not masquerade as game history.
  if (commands.some(command => /(?:^\s*\\|(?:^|[.;]|\bthen\s+)\s*(?:save|restore|restart|undo|quit|q|script|unscript|record|replay)(?:\s|$))/i.test(command))) throw new Error('Checkpoint history cannot contain interpreter controls or session restarts');
  return commands;
}

export function checkpointCommands(value, extraContinuations) {
  const commands = Array.isArray(value) ? value : value?.commands;
  const continuations = extraContinuations ?? (Array.isArray(value) ? [] : value?.continuations ?? []);
  validateHistory(commands);
  if (!Array.isArray(continuations) || continuations.length > 1000 || continuations.some(control => !Number.isInteger(control.commandIndex) || control.commandIndex < 0 || control.commandIndex >= commands.length || !/^[a-f0-9]{64}$/.test(control.lineSha256) || !['\n', ' '].includes(control.key))) throw new Error('Checkpoint continuations require a valid command index, exact line digest and explicit key');
  return { commands, continuations: continuations.map(({ commandIndex, lineSha256, key }) => ({ commandIndex, lineSha256, key })) };
}

export function parseQuetzal(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length < 12 || bytes.toString('ascii', 0, 4) !== 'FORM' || bytes.toString('ascii', 8, 12) !== 'IFZS' || bytes.readUInt32BE(4) !== bytes.length - 8) throw new Error('Checkpoint is not a complete Quetzal FORM/IFZS file');
  let identity;
  for (let cursor = 12; cursor < bytes.length;) {
    if (cursor + 8 > bytes.length) throw new Error('Truncated Quetzal chunk header');
    const type = bytes.toString('ascii', cursor, cursor + 4), length = bytes.readUInt32BE(cursor + 4);
    const start = cursor + 8, next = start + length + (length & 1);
    if (next > bytes.length) throw new Error('Truncated Quetzal chunk');
    if (type === 'IFhd') {
      if (identity || length !== 13) throw new Error('Invalid or duplicate Quetzal IFhd');
      identity = { release: bytes.readUInt16BE(start), serial: bytes.toString('ascii', start + 2, start + 8), checksum: bytes.readUInt16BE(start + 8), programCounter: bytes.readUIntBE(start + 10, 3) };
    }
    cursor = next;
  }
  if (!identity) throw new Error('Checkpoint has no Quetzal IFhd');
  return identity;
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const artifact = (file, bytes) => ({ file, sha256: hash(bytes), bytes: bytes.length });
function verifyIfhd(ifhd) {
  if (['release', 'serial', 'checksum'].some(key => ifhd[key] !== TARGET[key])) throw new Error('Checkpoint Quetzal identity differs from the target story');
}
function verifyCapture(capture, commands, origin, continuations = []) {
  if (capture.schemaVersion !== 1 || capture.kind !== 'trinity-checkpoint-creation' || capture.origin !== origin || capture.complete !== true || typeof capture.stdout !== 'string' || capture.requestedCommands !== commands.length || capture.completedCommands !== commands.length || !Array.isArray(capture.steps) || capture.steps.length !== commands.length || capture.execution?.exitCode !== 0 || capture.execution?.exitSignal !== null || !capture.execution?.closed || capture.execution?.failure || capture.execution?.truncated || capture.execution?.forcedCleanup) throw new Error('Checkpoint creation transcript is incomplete or has the wrong origin');
  let previous = 0;
  for (let i = 0; i < commands.length; i++) {
    const step = capture.steps[i], span = step.outputSpan;
    if (step.index !== i || step.command !== commands[i] || !span || !Number.isSafeInteger(span.start) || !Number.isSafeInteger(span.end) || span.start < previous || span.end < span.start || span.end > capture.stdout.length || capture.stdout.slice(span.start, span.end) !== step.output) throw new Error('Checkpoint history does not match transcript command spans');
    previous = span.end;
  }
  const save = capture.controls?.find(control => control.type === 'save');
  const dispatched = (capture.controls ?? []).filter(control => control.type === 'continuation');
  if (dispatched.length !== continuations.length || !same(dispatched.map(({ commandIndex, lineSha256, key }) => ({ commandIndex, lineSha256, key })), continuations)) throw new Error('Checkpoint continuation history differs from the transcript');
  for (const control of dispatched) {
    const span = control.markerSpan, step = capture.steps[control.commandIndex];
    if (!span || !Number.isSafeInteger(span.start) || !Number.isSafeInteger(span.end) || span.start < step.outputSpan.start || span.end > step.outputSpan.end || span.end < span.start || capture.stdout[span.end - 1] !== '\n' || hash(capture.stdout.slice(span.start, span.end).replace(/\s+/g, ' ').trim()) !== control.lineSha256) throw new Error('Checkpoint continuation marker does not match its transcript span');
  }
  if (capture.controls?.length !== continuations.length + 1 || !save?.outputSpan || !Number.isSafeInteger(save.outputSpan.start) || !Number.isSafeInteger(save.outputSpan.end) || save.outputSpan.start < previous || save.outputSpan.end < save.outputSpan.start || save.outputSpan.end > capture.stdout.length || !save?.output.includes('[SAVE completed.]') || capture.stdout.slice(save.outputSpan.start, save.outputSpan.end) !== save.output || !capture.stdout.includes('[Press any key to begin.]') || capture.stdout.includes('[RESTORE completed.]')) throw new Error('Checkpoint transcript has no verified fresh SAVE operation');
}

export function validateCheckpointArtifacts({ manifest, saveBytes, transcriptBytes }) {
  if (manifest?.schemaVersion !== 1 || manifest.kind !== 'trinity-original-checkpoint' || manifest.origin !== 'fresh-start' || manifest.story?.sha256 !== TARGET.sha256 || manifest.story.matchesTarget !== true || manifest.story.checksumValid !== true || ['version', 'release', 'serial', 'checksum'].some(key => manifest.story[key] !== TARGET[key]) || manifest.sourceCommit !== SOURCE.commit) throw new Error('Unsupported checkpoint manifest or original story identity');
  const { commands, continuations } = checkpointCommands(manifest.history?.commands, manifest.history?.continuations);
  if (manifest.history.continuationsSHA256 !== hash(JSON.stringify(continuations)) || manifest.history.historySHA256 !== hash(JSON.stringify({ commands, continuations }))) throw new Error('Checkpoint continuation history digest differs');
  if (manifest.history.origin !== 'fresh-start' || manifest.history.commandsSHA256 !== hash(JSON.stringify(commands)) || manifest.history.completedCommands !== commands.length || !same(commands.slice(-PROBES.length), PROBES)) throw new Error('Checkpoint history is incomplete or its digest differs');
  if (manifest.save?.file !== 'state.qzl' || manifest.creationTranscript?.file !== 'creation.json' || manifest.save.sha256 !== hash(saveBytes) || manifest.save.bytes !== saveBytes.length || manifest.creationTranscript.sha256 !== hash(transcriptBytes) || manifest.creationTranscript.bytes !== transcriptBytes.length) throw new Error('Checkpoint artifact digest, size or relative path differs');
  const ifhd = parseQuetzal(saveBytes); verifyIfhd(ifhd);
  if (!same(ifhd, manifest.save.ifhd)) throw new Error('Checkpoint IFhd differs from its manifest');
  const transcript = JSON.parse(transcriptBytes.toString('utf8'));
  verifyCapture(transcript, commands, 'fresh-start', continuations);
  if (transcript.storySHA256 !== manifest.story.sha256 || transcript.interpreterSHA256 !== manifest.interpreter?.sha256 || !/^[a-f0-9]{64}$/.test(manifest.interpreter?.sha256 ?? '') || !same(manifest.observations, transcript.steps.slice(-PROBES.length).map(step => ({ command: step.command, output: step.output })))) throw new Error('Checkpoint transcript identity or observation binding differs');
  return { manifest, transcript, ifhd };
}

async function interpreterIdentity(executable) {
  let selected;
  if (executable.includes(path.sep)) selected = path.resolve(executable);
  else for (const directory of (process.env.PATH ?? '').split(path.delimiter)) {
    const candidate = path.resolve(directory || '.', executable);
    try { await access(candidate, constants.X_OK); selected = candidate; break; } catch {}
  }
  if (!selected) throw new Error(`Interpreter executable not found: ${executable}`);
  selected = await realpath(selected);
  const bytes = await readFile(selected);
  const version = await exec(selected, ['-v'], { timeout: 5000, maxBuffer: 32768, encoding: 'utf8' });
  return { executable: selected, sha256: hash(bytes), bytes: bytes.length, version: (version.stdout + version.stderr).trim() };
}
async function storyIdentity(dat) {
  const story = identifyStory(await readFile(dat));
  if (!story.matchesTarget) throw new Error('Story does not match the exact research target SHA256');
  return story;
}
async function unchangedInputs(dat, story, interpreter) {
  if (hash(await readFile(dat)) !== story.sha256 || hash(await readFile(interpreter.executable)) !== interpreter.sha256) throw new Error('Story or interpreter changed during checkpoint execution');
}
const interpreterArguments = (dat, save) => ['-q', '-m', '-p', '-w', '200', '-h', '200', ...(save ? ['-L', save] : []), path.resolve(dat)];

export async function createCheckpoint({ dat, commands: suppliedCommands, continuations: suppliedContinuations, out, dfrotz = 'dfrotz', timeoutMs = 30000 }) {
  const { commands, continuations } = checkpointCommands(suppliedCommands, suppliedContinuations);
  if (commands.length + PROBES.length > 500) throw new Error('Checkpoint creation allows at most 497 commands plus observation probes');
  const root = await assertNewEvidencePath(out);
  const story = await storyIdentity(dat), interpreter = await interpreterIdentity(dfrotz);
  await mkdir(path.dirname(root), { recursive: true });
  await mkdir(root, { mode: 0o700 }); // An existing directory is never reused.
  const saveFile = path.join(root, 'state.qzl'); await assertNewEvidencePath(saveFile);
  const fullHistory = [...commands, ...PROBES];
  const capture = { ...await captureTranscript({ executable: interpreter.executable, arguments: interpreterArguments(dat), commands: fullHistory, continuations, saveFile, timeoutMs, cwd: root }), kind: 'trinity-checkpoint-creation', origin: 'fresh-start', storySHA256: story.sha256, interpreterSHA256: interpreter.sha256 };
  const creation = path.join(root, 'creation.json');
  await writeEvidence(creation, capture); // Retain partial observations on failure, without a success manifest.
  verifyCapture(capture, fullHistory, 'fresh-start', continuations);
  await unchangedInputs(dat, story, interpreter);
  const saveBytes = await readFile(saveFile), transcriptBytes = await readFile(creation);
  const ifhd = parseQuetzal(saveBytes); verifyIfhd(ifhd);
  const manifest = {
    schemaVersion: 1, kind: 'trinity-original-checkpoint', origin: 'fresh-start',
    story, sourceCommit: SOURCE.commit, sourceRole: 'historical-reference-not-build-proof', interpreter,
    save: { ...artifact('state.qzl', saveBytes), ifhd }, creationTranscript: artifact('creation.json', transcriptBytes),
    history: { origin: 'fresh-start', commands: fullHistory, commandsSHA256: hash(JSON.stringify(fullHistory)), continuations, continuationsSHA256: hash(JSON.stringify(continuations)), historySHA256: hash(JSON.stringify({ commands: fullHistory, continuations })), completedCommands: capture.completedCommands },
    observations: capture.steps.slice(-PROBES.length).map(step => ({ command: step.command, output: step.output })),
    limitations: LIMITATIONS,
  };
  validateCheckpointArtifacts({ manifest, saveBytes, transcriptBytes });
  const manifestFile = path.join(root, 'manifest.json'); await writeEvidence(manifestFile, manifest);
  return { manifestFile, manifest, capture };
}

async function checkpointFile(root, file) {
  if (!['state.qzl', 'creation.json'].includes(file)) throw new Error('Unsafe checkpoint artifact path');
  const selected = path.join(root, file), entry = await lstat(selected);
  if (!entry.isFile() || entry.isSymbolicLink()) throw new Error('Checkpoint artifacts must be regular files, not symlinks');
  const canonical = await realpath(selected);
  if (path.dirname(canonical) !== root) throw new Error('Checkpoint artifact escaped its directory');
  return canonical;
}
export async function restoreCheckpoint({ dat, checkpoint, commands: suppliedCommands, continuations: suppliedContinuations, out, dfrotz = 'dfrotz', timeoutMs = 30000 }) {
  const { commands, continuations } = checkpointCommands(suppliedCommands, suppliedContinuations);
  if (commands.length + RESTORE_PROBES.length > 500) throw new Error('Checkpoint restoration allows at most 498 commands plus observation probes');
  await assertNewEvidencePath(out);
  const manifestFile = await realpath(checkpoint), root = path.dirname(manifestFile);
  const manifestBytes = await readFile(manifestFile), manifest = JSON.parse(manifestBytes.toString('utf8'));
  const saveFile = await checkpointFile(root, manifest.save?.file), creation = await checkpointFile(root, manifest.creationTranscript?.file);
  const saveBytes = await readFile(saveFile), transcriptBytes = await readFile(creation);
  validateCheckpointArtifacts({ manifest, saveBytes, transcriptBytes });
  const story = await storyIdentity(dat), interpreter = await interpreterIdentity(dfrotz);
  if (interpreter.sha256 !== manifest.interpreter.sha256) throw new Error('Checkpoint interpreter SHA256 differs; cross-interpreter restoration is not claimed');
  const capture = await captureTranscript({ executable: interpreter.executable, arguments: interpreterArguments(dat, saveFile), commands: [...RESTORE_PROBES, ...commands], continuations: continuations.map(control => ({ ...control, commandIndex: control.commandIndex + RESTORE_PROBES.length })), restoreFile: saveFile, timeoutMs });
  await unchangedInputs(dat, story, interpreter);
  if (hash(await readFile(saveFile)) !== manifest.save.sha256) throw new Error('Checkpoint save changed during restoration');
  const restored = capture.stdout.includes('[RESTORE completed.]') && !capture.stdout.includes('[Press any key to begin.]');
  const observations = capture.steps.slice(0, RESTORE_PROBES.length).map(step => ({ command: step.command, output: step.output }));
  const expectedObservations = RESTORE_PROBES.map(command => manifest.observations.find(observation => observation.command === command));
  const observationsMatch = same(observations, expectedObservations);
  const result = { ...capture, kind: 'trinity-checkpoint-restored-observation', origin: 'restored-checkpoint',
    checkpoint: { manifestSHA256: hash(manifestBytes), storySHA256: story.sha256, saveSHA256: manifest.save.sha256, creationTranscriptSHA256: manifest.creationTranscript.sha256, commandsSHA256: manifest.history.commandsSHA256, continuationsSHA256: manifest.history.continuationsSHA256, historySHA256: manifest.history.historySHA256 },
    interpreter, restored, observationsMatch, complete: capture.complete && restored && observationsMatch,
    continuationCommands: commands, continuationControls: continuations, restoreObservations: observations, limitations: [...capture.limitations, ...LIMITATIONS] };
  await writeEvidence(out, result);
  return result;
}
