import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, writeFile, readdir, lstat } from 'node:fs/promises';
import path from 'node:path';
import { args, required, assertEvidencePath, SOURCE, hash, writeEvidence, main } from './lib/common.mjs';

const api = endpoint => JSON.parse(execFileSync('gh', ['api', endpoint], { encoding: 'utf8', timeout: 45000, maxBuffer: 8 * 1024 * 1024 }));
export async function fetchSource(destination) {
  const root = await assertEvidencePath(destination);
  const existing = await lstat(root).catch(error => { if (error.code === 'ENOENT') return null; throw error; });
  if (existing && (!existing.isDirectory() || (await readdir(root)).length)) throw new Error('Source destination must be absent or an empty directory; refusing to overwrite existing content');
  const tree = api(`repos/${SOURCE.repository}/git/trees/${SOURCE.commit}`);
  if (tree.truncated) throw new Error('Source tree response was truncated');
  const selected = tree.tree.filter(entry => entry.type === 'blob' && (/\.zil$/i.test(entry.path) || entry.path === 'README.md'));
  if (!selected.length) throw new Error('Pinned archive contains no source files');
  await mkdir(root, { recursive: true });
  const files = [];
  for (const entry of selected) {
    if (path.basename(entry.path) !== entry.path) throw new Error('Unsafe archive path');
    const response = api(`repos/${SOURCE.repository}/git/blobs/${entry.sha}`);
    if (response.encoding !== 'base64') throw new Error('Unsupported blob encoding');
    const bytes = Buffer.from(response.content, 'base64');
    const gitBlob = createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
    if (gitBlob !== entry.sha) throw new Error(`Git blob digest mismatch: ${entry.path}`);
    const file = await assertEvidencePath(path.join(root, entry.path));
    await writeFile(file, bytes, { mode: 0o600, flag: 'wx' });
    files.push({ path: entry.path, gitBlob, sha256: hash(bytes), bytes: bytes.length });
  }
  const provenance = { schemaVersion: 1, ...SOURCE, files };
  await writeEvidence(path.join(root, 'provenance.json'), provenance);
  console.log(JSON.stringify({ ...SOURCE, files: files.length, out: root }));
  return provenance;
}
export async function runFetch(argv) {
  const options = args(argv, ['out']);
  if (options.help) { console.log('fetch-source --out LOCAL_DIR (requires gh and network; fixed archive commit)'); return; }
  required(options, ['out']);
  return fetchSource(options.out);
}
if (process.argv[1]?.endsWith('/fetch-source.mjs')) main(() => runFetch(process.argv.slice(2)));
