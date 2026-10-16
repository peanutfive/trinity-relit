import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { args, required, json, normalize, writeEvidence, hash, main } from './lib/common.mjs';

export function checkSourceOutput(check, capture, index) {
  const definitions = index.definitions.filter(def => def.name === check.symbol && def.span.file === check.file);
  if (!definitions.length) return { status: 'unknown', reason: 'Source symbol was not found' };
  const ownerIds = new Set(definitions.map(def => def.id));
  const strings = index.strings.filter(string => ownerIds.has(string.owner));
  const selected = check.commandIndex === undefined ? capture.steps : capture.steps.filter(step => step.index === check.commandIndex);
  if (!selected.length) return { status: 'unknown', reason: 'Requested command response was not captured' };
  const observations = normalize(selected.map(step => step.output).join('\n'));
  const hits = strings.filter(string => normalize(string.value.replaceAll('|', '\n')).length >= (check.minLength || 16) && observations.includes(normalize(string.value.replaceAll('|', '\n'))));
  return { status: hits.length ? 'observed-fragment' : 'not-observed',
    sourceSpans: hits.map(string => string.span), literalMatches: hits.length,
    limitation: 'A matching literal is output evidence, not proof of full routine/branch execution or hidden state.' };
}
export function buildReport({ manifest, index, captures }) {
  if (manifest.sourceCommit !== index.sourceCommit) throw new Error('Manifest and source index commits differ');
  const entries = new Map(captures.map(capture => [capture.caseId, capture]));
  return { schemaVersion: 1, kind: 'trinity-research-coverage', sourceCommit: index.sourceCommit,
    indexing: { files: index.files.length, definitions: index.definitions.length,
      limitation: 'All archived .zil files are indexed, including historical/alternative entrypoints. Counts are not active game object counts.' },
    pilots: manifest.pilots.map(pilot => ({ id: pilot.id, title: pilot.title, unknowns: pilot.unknowns,
      cases: pilot.cases.map(scenario => {
        const capture = entries.get(scenario.id);
        if (!capture) return { id: scenario.id, status: scenario.status === 'static-only' ? 'static-only' : 'not-captured' };
        const sourceFiles = new Map(index.files.map(file => [file.path, file.sha256]));
        const checks = (scenario.checks || []).map(check => ({ check,
          ...(check.type === 'source-output' ? checkSourceOutput(check, capture, index) : { status: 'unknown', reason: 'Unsupported check type' }) }));
        const commandsMatch = JSON.stringify(scenario.commands) === JSON.stringify(capture.steps.map(step => step.command));
        const identityValid = commandsMatch && capture.sourceCommit === manifest.sourceCommit && capture.story?.matchesTarget === true && capture.story?.checksumValid === true;
        return { id: scenario.id, status: capture.complete && identityValid ? 'captured' : 'incomplete',
          ...(capture.evidenceFile ? { evidence: { file: capture.evidenceFile, sha256: capture.evidenceSha256 } } : {}),
          commandsMatch, completedCommands: capture.completedCommands, storySha256: capture.story?.sha256, checks,
          sourceFiles: [...new Set((scenario.checks || []).map(check => check.file))].map(file => ({ file, sha256: sourceFiles.get(file) })),
          unverified: ['Internal state', 'Full branch coverage', 'Source archive equivalence to target release'] };
      }) })),
    limitations: ['No inference from absence of text to absence of original behavior.', 'No automatic text synthesis or mutation of the remake.', 'Comparison and original execution may contain random variation.'] };
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
  // Bind each case to the exact transcript; only local paths and hashes are exposed here.
  for (const pilot of result.pilots) for (const scenario of pilot.cases) {
    const capture = captures.find(candidate => candidate.caseId === scenario.id);
    if (capture) scenario.evidence = { file: capture.evidenceFile, sha256: capture.evidenceSha256 };
  }
  await writeEvidence(options.out, result);
  console.log(JSON.stringify({ pilots: result.pilots.length,
    captured: result.pilots.flatMap(pilot => pilot.cases).filter(scenario => scenario.status === 'captured').length, out: options.out }));
  return result;
}
if (process.argv[1]?.endsWith('/report.mjs')) main(() => runReport(process.argv.slice(2)));
