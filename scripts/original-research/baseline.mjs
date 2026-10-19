import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { args, required, assertNewEvidencePath, writeEvidence, SOURCE, REA, TARGET, hash, json, main } from './lib/common.mjs';

export function identifyStory(bytes) {
  if (bytes.length < 64) throw new Error('Story file is shorter than its header');
  const word = n => bytes.readUInt16BE(n);
  const version = bytes[0];
  if (![3, 4, 5, 6, 7, 8].includes(version)) throw new Error(`Unsupported Z-machine version: ${version}`);
  const declaredBytes = word(26) * (version <= 3 ? 2 : version <= 5 ? 4 : 8);
  if (declaredBytes < 64 || declaredBytes > bytes.length) throw new Error('Invalid or truncated story length');
  let actualChecksum = 0;
  for (const byte of bytes.subarray(64, declaredBytes)) actualChecksum = (actualChecksum + byte) & 0xffff;
  const identity = { version, release: word(2), serial: bytes.toString('ascii', 18, 24), checksum: word(28) };
  const sha256 = hash(bytes);
  const checksumValid = actualChecksum === identity.checksum;
  const headerMatchesTarget = ['version', 'release', 'serial', 'checksum'].every(key => identity[key] === TARGET[key]);
  return { ...identity, sha256, bytes: bytes.length, declaredBytes, trailingBytes: bytes.length - declaredBytes,
    checksumValid, headerMatchesTarget,
    matchesTarget: headerMatchesTarget && checksumValid && sha256 === TARGET.sha256 };
}
export async function baseline({ dat, source }) {
  const story = identifyStory(await readFile(dat));
  let sourceEvidence = { repository: SOURCE.repository, declaredCommit: SOURCE.commit, verifiedFiles: false, unknown: 'No source directory provided' };
  if (source) {
    const manifest = await json(path.join(source, 'provenance.json'));
    if (manifest.repository !== SOURCE.repository || manifest.commit !== SOURCE.commit) throw new Error('Source identity differs from the pinned archive');
    if (!Array.isArray(manifest.files) || !manifest.files.length) throw new Error('Empty source manifest');
    const files = [];
    for (const entry of manifest.files) {
      if (path.basename(entry.path) !== entry.path) throw new Error('Unsafe source path');
      const digest = hash(await readFile(path.join(source, entry.path)));
      if (digest !== entry.sha256) throw new Error(`Source digest mismatch: ${entry.path}`);
      files.push({ path: entry.path, sha256: digest });
    }
    sourceEvidence = { repository: SOURCE.repository, commit: SOURCE.commit, verifiedFiles: true, files,
      archiveMatchesStory: 'unknown: the development snapshot is not proven to reproduce this release' };
  }
  return { schemaVersion: 1, kind: 'trinity-research-baseline', story, source: sourceEvidence, reaReference: REA,
    limitations: ['Source hashes verify agreement with the local manifest; archive-origin trust comes from the pinned fetch-source operation, not the version label.', 'No original text is included in this baseline.'] };
}
export async function runBaseline(argv) {
  const options = args(argv, ['dat', 'source', 'out']);
  if (options.help) { console.log('baseline --dat FILE [--source DIR] --out LOCAL_JSON'); return; }
  required(options, ['dat', 'out']);
  await assertNewEvidencePath(options.out);
  const result = await baseline(options);
  await writeEvidence(options.out, result);
  console.log(JSON.stringify({ story: result.story, sourceVerified: result.source.verifiedFiles, out: options.out }));
  if (!result.story.checksumValid || !result.story.matchesTarget) process.exitCode = 1;
  return result;
}
if (process.argv[1]?.endsWith('/baseline.mjs')) main(() => runBaseline(process.argv.slice(2)));
