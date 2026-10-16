#!/usr/bin/env node
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { indexSources } from './lib/zil.mjs';
import { assertEvidencePath, writeEvidence } from './lib/common.mjs';

export { indexSources, buildIndex, parseZil } from './lib/zil.mjs';

function argumentsFrom(argv) {
  const options = {};
  for (let i = 0; i < argv.length; i++) {
    const name = argv[i];
    if (name === '--help') return { help: true };
    if (!['--source', '--out', '--commit'].includes(name)) throw new Error(`Unknown argument: ${name}`);
    if (!argv[i + 1] || argv[i + 1].startsWith('--')) throw new Error(`Missing value: ${name}`);
    if (options[name.slice(2)]) throw new Error(`Duplicate argument: ${name}`);
    options[name.slice(2)] = argv[++i];
  }
  if (!options.source || !options.out || !options.commit) throw new Error('--source, --out, and --commit are required');
  if (!/^[0-9a-f]{40}$/i.test(options.commit)) throw new Error('--commit must be a full 40-character source Git commit');
  return options;
}

export async function runIndex(argv) {
  const options = argumentsFrom(argv);
  if (options.help) {
    console.log('Usage: node scripts/original-research/index.mjs --source DIR --out JSON --commit FULL_SHA\nOutput contains original/derived evidence: only outside the repository or in .local-research/.\n--commit is a declared source label; indexing alone does not verify archive provenance.');
    return;
  }
  const destination = await assertEvidencePath(options.out);
  const root = path.resolve(options.source);
  const sources = [];
  async function collect(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      const full = path.join(directory, entry.name);
      if (entry.isDirectory() && !entry.name.startsWith('.')) await collect(full);
      else if (entry.isFile() && /\.zil$/i.test(entry.name)) sources.push({
        path: path.relative(root, full).split(path.sep).join('/'), source: await readFile(full, 'utf8'),
      });
    }
  }
  await collect(root);
  if (!sources.length) throw new Error(`No .zil source files found in ${root}`);
  const result = indexSources(sources, { sourceCommit: options.commit.toLowerCase() });
  await writeEvidence(destination, result);
  console.log(JSON.stringify({ files: result.files.length, definitions: result.definitions.length,
    references: result.references.length, strings: result.strings.length, exits: result.exits.length,
    diagnostics: result.diagnostics.length, out: destination }));
  return result;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runIndex(process.argv.slice(2)).catch(error => { console.error(error.message); process.exitCode = 1; });
}
