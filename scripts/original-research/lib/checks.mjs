import { SOURCE, TARGET, hash, normalize } from './common.mjs';

const object = value => value && typeof value === 'object' && !Array.isArray(value);
const command = value => typeof value === 'string' && !!value.trim() && !/[\r\n\0]/.test(value);
const safeId = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(value);
export const fingerprints = (manifest, scenario) => ({
  manifestSha256: hash(JSON.stringify(manifest)), scenarioSha256: hash(JSON.stringify(scenario)),
});

export function validateManifest(manifest) {
  if (!object(manifest) || manifest.schemaVersion !== 1 || manifest.sourceCommit !== SOURCE.commit) throw new Error('Manifest does not identify the pinned source commit/schema');
  if (!object(manifest.target) || Object.entries(TARGET).some(([key, value]) => manifest.target[key] !== value)) throw new Error('Manifest target does not match the complete pinned story identity');
  if (!Array.isArray(manifest.pilots) || !manifest.pilots.length) throw new Error('Manifest has no pilots');
  const pilots = new Set(), cases = new Set();
  for (const pilot of manifest.pilots) {
    if (!object(pilot) || !safeId(pilot.id) || pilots.has(pilot.id)) throw new Error('Duplicate or invalid pilot id');
    pilots.add(pilot.id);
    if (!Array.isArray(pilot.cases)) throw new Error(`Pilot has no cases: ${pilot.id}`);
    for (const scenario of pilot.cases) {
      if (!object(scenario) || !safeId(scenario.id) || cases.has(scenario.id)) throw new Error('Duplicate or invalid case id');
      cases.add(scenario.id);
      if (!['runtime-verified', 'static-only'].includes(scenario.status)) throw new Error(`Unknown case status: ${scenario.id}`);
      if (!Array.isArray(scenario.commands) || scenario.commands.length > 500 || scenario.commands.some(value => !command(value)) || (scenario.status === 'runtime-verified' && !scenario.commands.length)) throw new Error(`Invalid command sequence: ${scenario.id}`);
      if (scenario.checks !== undefined && !Array.isArray(scenario.checks)) throw new Error(`Invalid checks: ${scenario.id}`);
      if (scenario.continuations !== undefined) {
        if (!Array.isArray(scenario.continuations)) throw new Error(`Invalid continuations: ${scenario.id}`);
        let previous = -1;
        for (const control of scenario.continuations) {
          if (!object(control) || !Number.isSafeInteger(control.commandIndex) || control.commandIndex < 0 || control.commandIndex < previous || control.commandIndex >= scenario.commands.length || typeof control.lineSha256 !== 'string' || !/^[a-f0-9]{64}$/.test(control.lineSha256) || !['\n', ' '].includes(control.key)) throw new Error(`Invalid continuation binding: ${scenario.id}`);
          previous = control.commandIndex;
        }
      }
      for (const check of scenario.checks || []) {
        if (!object(check) || !['source-output', 'score-output'].includes(check.type)) throw new Error(`Unknown check type: ${scenario.id}`);
        if (check.commandIndex !== undefined && (!Number.isSafeInteger(check.commandIndex) || check.commandIndex < 0 || check.commandIndex >= scenario.commands.length)) throw new Error(`Invalid check commandIndex: ${scenario.id}`);
        if (check.type === 'source-output') {
          if (typeof check.file !== 'string' || !check.file || typeof check.symbol !== 'string' || !check.symbol || (check.minLength !== undefined && (!Number.isSafeInteger(check.minLength) || check.minLength < 1))) throw new Error(`Invalid source-output check: ${scenario.id}`);
        } else if (!Number.isSafeInteger(check.commandIndex) || scenario.commands[check.commandIndex].trim().toLowerCase() !== 'score' || !Number.isSafeInteger(check.score) || check.score < 0 || check.score > 100 || !Number.isSafeInteger(check.moves) || check.moves < 0) throw new Error(`Invalid score-output check: ${scenario.id}`);
      }
    }
  }
  return manifest;
}

export function checkSourceOutput(check, capture, index) {
  const definitions = index.definitions.filter(def => def.name === check.symbol && def.span.file === check.file);
  if (!definitions.length) return { status: 'unknown', pass: null, reason: 'Source symbol was not found' };
  const ownerIds = new Set(definitions.map(def => def.id));
  const strings = index.strings.filter(string => ownerIds.has(string.owner) && string.span.file === check.file);
  const selected = check.commandIndex === undefined ? capture.steps : capture.steps.filter(step => step.index === check.commandIndex);
  if (!selected.length) return { status: 'unknown', pass: null, reason: 'Requested command response was not captured' };
  const observations = normalize(selected.map(step => step.output).join('\n'));
  const minimum = check.minLength ?? 16;
  if (!Number.isSafeInteger(minimum) || minimum < 1) return { status: 'unknown', pass: null, reason: 'Invalid minimum literal length' };
  const hits = strings.filter(string => {
    const text = normalize(string.value.replaceAll('|', '\n'));
    return text.length >= minimum && observations.includes(text);
  });
  return { status: hits.length ? 'observed-fragment' : 'not-observed', pass: hits.length > 0,
    sourceSpans: hits.map(string => string.span), literalMatches: hits.length,
    limitation: 'A matching literal is output evidence, not proof of full routine/branch execution or hidden state.' };
}

// Parse only the numeric score header. No rank/narrative text is retained or generated.
export function parseScoreOutput(output) {
  if (typeof output !== 'string') return null;
  const clean = output.replace(/\x1b\[[0-9;]*[A-Za-z]/g, '');
  if ((clean.match(/\[\s*Your\s+score\s+is\b/g) || []).length !== 1) return null;
  const matches = [...clean.matchAll(/\[\s*Your\s+score\s+is\s+(\d+)\s+points?\s+out\s+of\s+(\d+),\s+in\s+(\d+)\s+moves?\./g)];
  if (matches.length !== 1) return null;
  const [score, maximum, moves] = matches[0].slice(1).map(Number);
  if (![score, maximum, moves].every(Number.isSafeInteger) || maximum !== 100 || score > maximum) return null;
  return { score, maximum, moves };
}

export function checkScoreOutput(check, capture) {
  const steps = capture.steps.filter(step => step.index === check.commandIndex);
  if (steps.length !== 1 || steps[0].command.trim().toLowerCase() !== 'score') return { status: 'unknown', pass: null, reason: 'Score check is not attached to exactly one score command' };
  const observed = parseScoreOutput(steps[0].output);
  if (!observed) return { status: 'unknown', pass: null, reason: 'Expected one unambiguous score header with maximum 100' };
  const pass = observed.score === check.score && observed.moves === check.moves;
  return { status: pass ? 'observed-values' : 'mismatch', pass, observed,
    expected: { score: check.score, moves: check.moves },
    limitation: 'Score/moves are visible numeric observations; hidden state and full branch coverage remain unverified.' };
}
