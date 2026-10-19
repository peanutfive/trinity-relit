import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { args, required, json, assertNewEvidencePath, writeEvidence, main } from './lib/common.mjs';
import { findCase } from './capture.mjs';
import { identifyStory } from './baseline.mjs';

export function reaScenario({ dat, dfrotz, commands, cwd, intervalMs = 400, continuations = [] }) {
  if (!Array.isArray(continuations) || continuations.length) throw new Error('REA timed scenarios cannot enforce output-guarded continuation keys; use prompt capture or checkpoints for this case');
  if (!path.isAbsolute(dat) || !path.isAbsolute(dfrotz) || !path.isAbsolute(cwd)) throw new Error('REA scenario paths must be absolute');
  if (!Number.isSafeInteger(intervalMs) || intervalMs < 100) throw new Error('Invalid interaction interval');
  if (commands.some(command => typeof command !== 'string' || /[\r\n\0]/.test(command))) throw new Error('Invalid scenario command');
  const inputs = ['', ...commands, 'quit', 'yes'];
  return { executable: dfrotz, arguments: ['-q', '-m', '-p', '-w', '200', '-h', '200', dat], working_directory: cwd,
    terminal: { columns: 200, rows: 200, scrollback: 1000 },
    events: inputs.map((command, index) => ({ type: 'input', at_ms: (index + 1) * intervalMs, data: command + '\r' })),
    timeout_ms: Math.max(10000, (inputs.length + 4) * intervalMs), settle_ms: 100 };
}
export async function runScenario(argv) {
  const options = args(argv, ['dat', 'dfrotz', 'case', 'manifest', 'cwd', 'out']);
  if (options.help) { console.log('scenario --dat ABS_FILE --dfrotz ABS_EXE --case ID --cwd ABS_DIR --out LOCAL_JSON'); return; }
  required(options, ['dat', 'dfrotz', 'case', 'cwd', 'out']);
  await assertNewEvidencePath(options.out);
  const story = identifyStory(await readFile(options.dat));
  if (!story.matchesTarget || !story.checksumValid) throw new Error('Story does not match the research target');
  const { scenario } = findCase(await json(options.manifest || 'research/pilots.json'), options.case);
  if (scenario.status !== 'runtime-verified') throw new Error('No complete runtime route for this static-only case');
  const result = reaScenario({ dat: options.dat, dfrotz: options.dfrotz, commands: scenario.commands, continuations: scenario.continuations || [], cwd: options.cwd });
  await writeEvidence(options.out, result);
  console.log(JSON.stringify({ caseId: options.case, events: result.events.length, out: options.out }));
  return result;
}
if (process.argv[1]?.endsWith('/scenario.mjs')) main(() => runScenario(process.argv.slice(2)));
