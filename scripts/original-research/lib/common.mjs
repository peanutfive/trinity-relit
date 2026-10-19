import { createHash } from 'node:crypto';
import { mkdir, readFile, realpath, lstat, readlink, open, unlink } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
export const SOURCE = { repository: 'historicalsource/trinity', commit: '16a024ce6bc5b9da85f42e65d7f9fd93b32c808c' };
export const REA = { repository: 'peanutfive/rea', commit: 'd901561640121272bf1498d85e38e1ac8b3f5793', release: '6.4.0' };
export const TARGET = { version: 4, release: 12, serial: '860926', checksum: 0x16ab, sha256: 'c49ce555bf4a9f0703587ff3462a7cb998c82ef9d72e461b18e5444dc6d6ac35' };
export const hash = bytes => createHash('sha256').update(bytes).digest('hex');
export const normalize = text => text.replace(/\x1b\[[0-9;]*[A-Za-z]/g, '').replace(/\s+/g, ' ').trim();
export function args(argv, names) {
  const result = {};
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i].replace(/^--/, '');
    if (argv[i] === '--help') return { help: true };
    if (!argv[i].startsWith('--') || !names.includes(key)) throw new Error(`Unknown argument: ${argv[i]}`);
    if (result[key] !== undefined || !argv[i + 1] || argv[i + 1].startsWith('--')) throw new Error(`Invalid value: --${key}`);
    result[key] = argv[++i];
  }
  return result;
}
export function required(options, names) {
  for (const key of names) if (!options[key]) throw new Error(`Missing --${key}`);
}
async function canonical(destination, seen = new Set()) {
  if (seen.has(destination)) throw new Error("Cyclic evidence destination symlink");
  const next = new Set(seen).add(destination);
  try { return await realpath(destination); }
  catch (error) {
    if (!['ENOENT', 'ELOOP'].includes(error.code)) throw error;
    const entry = await lstat(destination).catch(error => { if (error.code === 'ENOENT') return null; throw error; });
    if (entry?.isSymbolicLink()) return canonical(path.resolve(path.dirname(destination), await readlink(destination)), next);
    const parent = path.dirname(destination);
    if (parent === destination) throw error;
    return path.join(await canonical(parent, next), path.basename(destination));
  }
}
const within = (root, file) => file === root || file.startsWith(root + path.sep);
export async function assertEvidencePath(destination, repoRoot = ROOT) {
  const file = await canonical(path.resolve(destination));
  const root = await realpath(repoRoot);
  // Allow the current ignored workspace; reject outputs in any other Git checkout.
  if (within(path.join(root, '.local-research'), file)) return file;
  if (within(root, file)) throw new Error('Original/derived evidence must be outside the repository or in .local-research/');
  for (let ancestor = path.dirname(file);;) {
    const git = await lstat(path.join(ancestor, '.git')).catch(error => { if (error.code === 'ENOENT') return null; throw error; });
    if (git) throw new Error('Original/derived evidence must not be written into a Git checkout');
    const parent = path.dirname(ancestor);
    if (parent === ancestor) break;
    ancestor = parent;
  }
  return file;
}
export async function assertNewEvidencePath(destination, repoRoot = ROOT) {
  // Check the supplied leaf as well as its canonical target: dangling symlinks
  // must not silently redirect a newly created evidence file.
  for (const file of new Set([path.resolve(destination), await assertEvidencePath(destination, repoRoot)])) {
    const entry = await lstat(file).catch(error => { if (error.code === 'ENOENT') return null; throw error; });
    if (entry) throw new Error(`Evidence destination already exists; refusing to overwrite: ${destination}`);
  }
  return assertEvidencePath(destination, repoRoot);
}
export async function writeEvidence(destination, evidence) {
  const file = await assertNewEvidencePath(destination);
  await mkdir(path.dirname(file), { recursive: true });
  const handle = await open(file, 'wx', 0o600);
  try { await handle.writeFile(JSON.stringify(evidence, null, 2) + '\n'); }
  catch (error) { await handle.close(); await unlink(file).catch(() => {}); throw error; }
  await handle.close();
  return file;
}

export async function json(file) { return JSON.parse(await readFile(file, 'utf8')); }
export function main(run) {
  run().catch(error => { console.error(error.message); process.exitCode = 1; });
}
