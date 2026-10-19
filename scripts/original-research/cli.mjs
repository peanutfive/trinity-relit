#!/usr/bin/env node
import { pathToFileURL } from 'node:url';
import { args, required, assertNewEvidencePath, writeEvidence, json, main, SOURCE, hash } from './lib/common.mjs';
import { runBaseline, baseline } from './baseline.mjs';
import { runCapture, captureCase } from './capture.mjs';
import { runIndex } from './index.mjs';
import { runFetch } from './fetch-source.mjs';
import { runReport, buildReport, reportSummary, validateManifest } from './report.mjs';
import { runScenario } from './scenario.mjs';
import { runCheckpoint } from './checkpoint.mjs';
import path from 'node:path';
import { readFile } from 'node:fs/promises';

const help = `Trinity 原版研究工具（开发期，本地证据）
  npm run research -- fetch-source --out .local-research/source
  npm run research -- baseline --dat FILE --source DIR --out LOCAL_JSON
  npm run research -- index --source DIR --commit FULL_SHA --out LOCAL_JSON
  npm run research -- capture --dat FILE --case ID --out LOCAL_JSON
  npm run research -- scenario --dat ABS_FILE --dfrotz ABS_EXE --case ID --cwd ABS_DIR --out LOCAL_JSON
  npm run research -- report --index LOCAL_JSON --captures LOCAL_DIR --out LOCAL_JSON
  npm run research -- run --dat FILE --source DIR --out LOCAL_DIR [--dfrotz PATH]
  npm run research -- checkpoint create|restore ...
  npm run research -- rea doctor|capture|compare ...
计划：docs/ORIGINAL_RESEARCH_PLAN.md；用法：docs/ORIGINAL_RESEARCH.md。
run 批量完成基线、源码索引、所有已验证路线场景和行为检查报告；REA显式调用见rea子命令。
`;
async function runAll(argv) {
  const options = args(argv, ['dat', 'source', 'out', 'dfrotz', 'manifest']);
  if (options.help) { console.log(help); return; }
  required(options, ['dat', 'source', 'out']);
  const out = await assertNewEvidencePath(options.out);
  const manifest = await json(options.manifest || 'research/pilots.json');
  validateManifest(manifest);
  const identity = await baseline(options);
  if (!identity.story.matchesTarget || !identity.story.checksumValid || !identity.source.verifiedFiles) throw new Error('Research baseline did not verify');
  await writeEvidence(path.join(out, 'baseline.json'), identity);
  const index = await runIndex(['--source', options.source, '--commit', SOURCE.commit, '--out', path.join(out, 'index.json')]);
  const captures = [];
  for (const pilot of manifest.pilots) for (const scenario of pilot.cases) {
    if (scenario.status !== 'runtime-verified') continue;
    const capture = await captureCase({ dat: options.dat, manifest, caseId: scenario.id, dfrotz: options.dfrotz });
    const file = path.join(out, 'captures', scenario.id + '.json');
    await writeEvidence(file, capture);
    captures.push({ ...capture, evidenceFile: path.relative(out, file), evidenceSha256: hash(await readFile(file)) });
    if (!capture.complete) throw new Error(`Incomplete capture saved: ${scenario.id}`);
  }
  const report = buildReport({ manifest, index, captures });
  await writeEvidence(path.join(out, 'report.json'), report);
  const observations = report.pilots.flatMap(pilot => pilot.cases).flatMap(scenario => scenario.checks || []);
  const summary = reportSummary(report);
  console.log(JSON.stringify({ ...summary, checks: observations.length,
    sourceChecks: observations.filter(result => result.check.type === 'source-output').length,
    scoreChecks: observations.filter(result => result.check.type === 'score-output').length,
    matched: observations.filter(check => check.status === 'observed-fragment').length, report: path.join(out, 'report.json'),
    staticOnly: summary.staticOnly }));
  if (summary.failed || summary.unknown) process.exitCode = 1;
}
main(async () => {
  const [command, ...argv] = process.argv.slice(2);
  const commands = { baseline: runBaseline, index: runIndex, 'fetch-source': runFetch, capture: runCapture, report: runReport, scenario: runScenario, run: runAll, checkpoint: runCheckpoint };
  if (!command || command === '--help') { console.log(help); return; }
  if (command === 'rea') {
    // The adapter is also directly runnable. Preserve its argv contract.
    process.argv = [process.argv[0], new URL('./rea.mjs', import.meta.url).pathname, ...argv];
    await import(pathToFileURL(process.argv[1]).href);
    return;
  }
  if (!commands[command]) throw new Error(`Unknown research command: ${command}`);
  await commands[command](argv);
});
