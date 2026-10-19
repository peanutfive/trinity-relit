import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { args, required, assertNewEvidencePath, writeEvidence, json, hash, main } from './lib/common.mjs';
import { identifyStory } from './baseline.mjs';
import { captureTranscript } from './lib/capture.mjs';
import { validateManifest } from './report.mjs';
export function findCase(manifest, id) {
  validateManifest(manifest);
  for (const pilot of manifest.pilots) {
    const scenario = pilot.cases.find(candidate => candidate.id === id);
    if (scenario) return { pilot, scenario };
  }
  throw new Error(`Unknown research case: ${id}`);
}
export async function captureCase({ dat, manifest, caseId, dfrotz = 'dfrotz', timeoutMs = 30000 }) {
  const { pilot, scenario } = findCase(manifest, caseId);
  if (scenario.status !== 'runtime-verified' || !scenario.commands?.length) throw new Error('Case is static-only or has no complete command route');
  const story = identifyStory(await readFile(dat));
  if (!story.matchesTarget || !story.checksumValid) throw new Error('Story does not match the research target');
  const result = await captureTranscript({ executable: dfrotz,
    arguments: ['-q', '-m', '-p', '-w', '200', '-h', '200', path.resolve(dat)],
    commands: scenario.commands, continuations: scenario.continuations || [], timeoutMs });
  return { ...result, caseId, pilotId: pilot.id, story, sourceCommit: manifest.sourceCommit,
    manifestSha256: hash(JSON.stringify(manifest)), scenarioSha256: hash(JSON.stringify(scenario)), origin: { kind: 'fresh-game' } };
}
export async function runCapture(argv) {
  const options = args(argv, ['dat', 'case', 'manifest', 'out', 'dfrotz', 'timeout-ms']);
  if (options.help) { console.log('capture --dat FILE --case ID --out LOCAL_JSON [--manifest research/pilots.json] [--dfrotz PATH] [--timeout-ms N]'); return; }
  required(options, ['dat', 'case', 'out']);
  await assertNewEvidencePath(options.out);
  const result = await captureCase({ dat: options.dat, manifest: await json(options.manifest || 'research/pilots.json'), caseId: options.case,
    dfrotz: options.dfrotz, timeoutMs: Number(options['timeout-ms'] || 30000) });
  await writeEvidence(options.out, result);
  console.log(JSON.stringify({ caseId: result.caseId, complete: result.complete, completedCommands: result.completedCommands, out: options.out,
    failure: result.execution.failure }));
  if (!result.complete) process.exitCode = 1;
  return result;
}
if (process.argv[1]?.endsWith('/capture.mjs')) main(() => runCapture(process.argv.slice(2)));
