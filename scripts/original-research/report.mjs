import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { args, required, json, writeEvidence, hash, main, SOURCE, TARGET } from './lib/common.mjs';
import { validateManifest, fingerprints, checkSourceOutput, checkScoreOutput } from './lib/checks.mjs';

export { validateManifest, checkSourceOutput } from './lib/checks.mjs';
const digest = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);

function validateIndex(index) {
  if (!index || index.schemaVersion !== 1 || index.sourceCommit !== SOURCE.commit || !Array.isArray(index.files) || !Array.isArray(index.definitions) || !Array.isArray(index.strings)) throw new Error('Invalid or unpinned source index');
  const files = new Map();
  for (const file of index.files) {
    if (typeof file.path !== 'string' || !file.path || !digest(file.sha256) || files.has(file.path)) throw new Error('Invalid or duplicate indexed source file');
    files.set(file.path, file.sha256);
  }
  const owners = new Map();
  for (const definition of index.definitions) {
    if (typeof definition.id !== 'string' || owners.has(definition.id) || !files.has(definition.span?.file)) throw new Error('Invalid source definition provenance');
    owners.set(definition.id, definition);
  }
  for (const string of index.strings) {
    if (typeof string.value !== 'string' || !files.has(string.span?.file) || (string.owner !== null && (!owners.has(string.owner) || owners.get(string.owner).span.file !== string.span.file))) throw new Error('Invalid source string provenance');
  }
  return files;
}

function invalidCapture(capture, manifest, pilot, scenario) {
  const errors = [], expected = fingerprints(manifest, scenario);
  if (capture.schemaVersion !== 1 || capture.kind !== 'trinity-command-transcript') errors.push('Unsupported transcript schema/kind');
  if (capture.caseId !== scenario.id || capture.pilotId !== pilot.id) errors.push('Capture case/pilot differs from the manifest');
  if (capture.sourceCommit !== manifest.sourceCommit || capture.manifestSha256 !== expected.manifestSha256 || capture.scenarioSha256 !== expected.scenarioSha256) errors.push('Capture does not bind to the current manifest/scenario/source commit');
  if (capture.origin?.kind !== 'fresh-game' || capture.commandsPrefix !== undefined) errors.push('A normal case requires a fresh-game capture without a checkpoint prefix');
  if (Object.entries(TARGET).some(([key, value]) => capture.story?.[key] !== value) || capture.story?.matchesTarget !== true || capture.story?.checksumValid !== true) errors.push('Story identity differs from the exact pinned target');
  const execution = capture.execution;
  if (capture.complete !== true || !execution || execution.exitCode !== 0 || execution.exitSignal !== null || execution.closed !== true || execution.forcedCleanup !== false || execution.failure !== null || execution.truncated !== false) errors.push('Interpreter execution was not complete and clean');
  const steps = capture.steps;
  if (!Array.isArray(steps) || steps.length !== scenario.commands.length || capture.requestedCommands !== scenario.commands.length || capture.completedCommands !== scenario.commands.length) errors.push('Requested/completed command counts differ');
  const raw = typeof capture.stdout === 'string' ? capture.stdout : '';
  const initialPrompt = /(?:^|\n)>/.exec(raw);
  let cursor = initialPrompt ? initialPrompt.index + initialPrompt[0].length : null;
  if (typeof capture.stdout !== 'string' || typeof capture.stderr !== 'string' || cursor === null) errors.push('Raw interpreter output or initial prompt is missing');
  if (Array.isArray(steps)) for (let i = 0; i < steps.length; i++) {
    const step = steps[i], span = step?.outputSpan;
    if (!step || step.index !== i || step.command !== scenario.commands[i] || typeof step.output !== 'string') { errors.push('Command order/index/output differs'); break; }
    const promptPattern = /(?:^|\n)>/g;
    promptPattern.lastIndex = cursor ?? 0;
    const prompt = promptPattern.exec(raw);
    if (!span || !Number.isSafeInteger(span.start) || !Number.isSafeInteger(span.end) || span.start !== cursor || span.end < span.start || span.end > raw.length || raw.slice(span.start, span.end) !== step.output || !prompt || prompt.index !== span.end) { errors.push('Step output does not match its ordered raw transcript/prompt span'); break; }
    cursor = prompt.index + prompt[0].length;
  }
  const expectedControls = scenario.continuations || [];
  if (!Array.isArray(capture.controls) || capture.controls.length !== expectedControls.length) errors.push('Transcript controls differ from declared continuations');
  else {
    let previousEnd = 0;
    for (let i = 0; i < expectedControls.length; i++) {
      const actual = capture.controls[i], expectedControl = expectedControls[i], span = actual?.markerSpan;
      const response = steps?.[expectedControl.commandIndex]?.outputSpan;
      if (!actual || actual.type !== 'continuation' || actual.commandIndex !== expectedControl.commandIndex || actual.lineSha256 !== expectedControl.lineSha256 || actual.key !== expectedControl.key || !response || !span || !Number.isSafeInteger(span.start) || !Number.isSafeInteger(span.end) || span.start < previousEnd || span.start < response.start || span.end > response.end || span.end <= span.start || raw[span.end - 1] !== '\n' || (span.start !== response.start && raw[span.start - 1] !== '\n') || hash(raw.slice(span.start, span.end).replace(/\s+/g, ' ').trim()) !== actual.lineSha256) {
        errors.push('Continuation key/marker is not bound to its declared command and raw output');
        break;
      }
      previousEnd = span.end;
    }
  }
  return errors;
}

export function buildReport({ manifest, index, captures }) {
  validateManifest(manifest);
  const sourceFiles = validateIndex(index);
  if (!Array.isArray(captures)) throw new Error('Captures must be an array');
  const entries = new Map(), caseIds = new Set(manifest.pilots.flatMap(pilot => pilot.cases.map(scenario => scenario.id)));
  for (const capture of captures) {
    if (!capture || typeof capture.caseId !== 'string' || !caseIds.has(capture.caseId)) throw new Error('Capture has unknown or missing case id');
    if (entries.has(capture.caseId)) throw new Error(`Duplicate capture case id: ${capture.caseId}`);
    entries.set(capture.caseId, capture);
  }
  return { schemaVersion: 1, kind: 'trinity-research-coverage', sourceCommit: index.sourceCommit,
    target: TARGET, manifestSha256: hash(JSON.stringify(manifest)),
    indexing: { files: index.files.length, definitions: index.definitions.length,
      limitation: 'All archived .zil files are indexed, including historical/alternative entrypoints. Counts are not active game object counts.' },
    sourceEvidence: { binding: 'declared-index-hashes',
      limitation: 'Source hashes identify indexed content. Commit labels and local manifests alone do not prove archive origin or equivalence to the target story.' },
    pilots: manifest.pilots.map(pilot => ({ id: pilot.id, title: pilot.title, unknowns: pilot.unknowns,
      cases: pilot.cases.map(scenario => {
        const capture = entries.get(scenario.id);
        if (!capture) return { id: scenario.id, status: scenario.status === 'static-only' ? 'static-only' : 'not-captured', verification: 'unknown' };
        const errors = invalidCapture(capture, manifest, pilot, scenario);
        if (scenario.status !== 'runtime-verified') errors.push('Static-only cases cannot be promoted by ordinary captures');
        const valid = errors.length === 0;
        const checks = (scenario.checks || []).map(check => ({ check,
          ...(!valid ? { status: 'invalid-evidence', pass: false, reason: 'Capture identity/process/command binding failed; check was not evaluated' }
            : check.type === 'source-output' ? checkSourceOutput(check, capture, index) : checkScoreOutput(check, capture)) }));
        const verification = !valid || checks.some(check => check.pass === false) ? 'failed'
          : checks.length && checks.every(check => check.pass === true) ? 'verified' : 'unknown';
        return { id: scenario.id, status: valid ? 'captured' : 'incomplete', verification,
          ...(capture.evidenceFile ? { evidence: { file: capture.evidenceFile, sha256: capture.evidenceSha256 } } : {}),
          ...(errors.length ? { evidenceErrors: errors } : {}),
          commandsMatch: Array.isArray(capture.steps) && JSON.stringify(scenario.commands) === JSON.stringify(capture.steps.map(step => step.command)),
          completedCommands: capture.completedCommands, storySha256: capture.story?.sha256, checks,
          sourceFiles: [...new Set((scenario.checks || []).filter(check => check.type === 'source-output').map(check => check.file))].map(file => ({ file, sha256: sourceFiles.get(file) })),
          unverified: ['Internal state', 'Full branch coverage', 'Source archive equivalence to target release'] };
      }) })),
    limitations: ['Verified means declared visible-output checks passed; it does not establish complete routine/branch coverage.', 'No inference from absence of text to absence of original behavior.', 'No automatic text synthesis or mutation of the remake.', 'Comparison and original execution may contain random variation.'] };
}

export function reportSummary(report) {
  const cases = report.pilots.flatMap(pilot => pilot.cases);
  return { captured: cases.filter(scenario => scenario.status === 'captured').length,
    verified: cases.filter(scenario => scenario.verification === 'verified').length,
    failed: cases.filter(scenario => scenario.verification === 'failed').length,
    unknown: cases.filter(scenario => scenario.status !== 'static-only' && scenario.verification === 'unknown').length,
    staticOnly: cases.filter(scenario => scenario.status === 'static-only').length };
}

export async function runReport(argv) {
  const options = args(argv, ['manifest', 'index', 'captures', 'out']);
  if (options.help) { console.log('report --index LOCAL_JSON --captures LOCAL_DIR --out LOCAL_JSON [--manifest research/pilots.json]'); return; }
  required(options, ['index', 'captures', 'out']);
  const captures = [];
  for (const entry of (await readdir(options.captures)).sort()) {
    if (!entry.endsWith('.json')) continue;
    const bytes = await readFile(path.join(options.captures, entry));
    const capture = JSON.parse(bytes);
    if (capture.kind !== 'trinity-command-transcript') continue;
    captures.push({ ...capture, evidenceFile: entry, evidenceSha256: hash(bytes) });
  }
  const result = buildReport({ manifest: await json(options.manifest || 'research/pilots.json'), index: await json(options.index), captures });
  await writeEvidence(options.out, result);
  const summary = reportSummary(result);
  console.log(JSON.stringify({ ...summary, out: options.out }));
  if (summary.failed || summary.unknown) process.exitCode = 1;
  return result;
}
if (process.argv[1]?.endsWith('/report.mjs')) main(() => runReport(process.argv.slice(2)));
