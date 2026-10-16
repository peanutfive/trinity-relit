// REA remains an explicitly installed development tool, outside the game runtime.
import { spawn } from 'node:child_process';
import { readFile, realpath, mkdir, open, unlink, lstat } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const REA_REFERENCE = Object.freeze({
  repository: 'https://github.com/peanutfive/rea',
  commit: 'd901561640121272bf1498d85e38e1ac8b3f5793',
  publishedPackage: 'rea-agents',
  publishedVersion: '6.4.0',
  // A package version is NOT an assertion of identity with the fork commit.
});

export function reaInvocation({ rea = 'rea', node } = {}, args = []) {
  if (typeof rea !== 'string' || !rea || rea.includes('\0')) throw new Error('Invalid REA executable');
  if (node && (!isAbsolute(rea) || !isAbsolute(node))) throw new Error('--node and --rea must be absolute paths when selecting Node explicitly');
  return node ? { command: node, args: [rea, ...args] } : { command: rea, args };
}

export function runRea(args, { rea, node, cwd, signal, maxBytes = 32 * 1024 * 1024, timeoutMs = 120000, cleanupGraceMs = 10000, progress = () => {} } = {}) {
  const invocation = reaInvocation({ rea, node }, args);
  if (signal?.aborted) return Promise.reject(new Error('REA invocation was cancelled before launch'));
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1 || !Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || !Number.isSafeInteger(cleanupGraceMs) || cleanupGraceMs < 1) {
    return Promise.reject(new Error('REA byte/time limits must be positive safe integers'));
  }
  return new Promise((resolvePromise, reject) => {
    const child = spawn(invocation.command, invocation.args, { cwd, shell: false, stdio: ['ignore', 'pipe', 'pipe'] });
    const stdout = []; let bytes = 0; let stderr = ''; let failure; let escalation;
    const stop = error => {
      if (failure) return;
      failure = error;
      // Give REA its own controlled cleanup interval before terminating the CLI.
      child.kill('SIGTERM');
      escalation = setTimeout(() => child.kill('SIGKILL'), cleanupGraceMs);
    };
    const abort = () => stop(new Error('REA invocation cancelled; no complete Evidence was saved'));
    signal?.addEventListener('abort', abort, { once: true });
    const timer = setTimeout(() => stop(new Error('REA command exceeded its outer time limit; cleanup is unverified, inspect before retrying')), timeoutMs);
    const finish = () => { clearTimeout(timer); clearTimeout(escalation); signal?.removeEventListener('abort', abort); };
    child.stdout.on('data', chunk => {
      bytes += chunk.length;
      if (bytes > maxBytes) stop(new Error('REA output exceeded the adapter byte limit; no Evidence was saved'));
      else stdout.push(chunk);
    });
    child.stderr.on('data', chunk => {
      // Keep a bounded diagnostic tail; progress is never interpreted as Evidence.
      stderr = (stderr + chunk.toString('utf8')).slice(-32768);
      progress(chunk.toString('utf8'));
    });
    child.once('error', error => { finish(); reject(error); });
    child.once('close', code => {
      finish();
      if (failure) return reject(failure);
      const text = Buffer.concat(stdout).toString('utf8');
      resolvePromise({ code, text, stderr });
    });
  });
}

export function parseReaJson(result) {
  let data;
  try { data = JSON.parse(result.text); }
  catch { throw new Error(`REA did not return JSON (exit ${result.code}). ${result.stderr.slice(-1000)}`); }
  if (result.code !== 0 || data?.error) {
    const error = new Error(`REA failed: ${data?.code ?? result.code}: ${data?.message ?? data?.error ?? result.stderr.slice(-1000)}`);
    error.details = data;
    throw error;
  }
  return data;
}

// A projection for operators; never replace or rewrite the upstream Evidence.
export function summarizeCapture(evidence) {
  const result = evidence?.normalized_result;
  if (!result || !Array.isArray(result.frames) || !result.exit) return { kind: 'unrecognized', complete_equivalence_proven: false };
  return {
    kind: 'process-capture-summary', evidence_id: evidence.evidence_id ?? null,
    exit: result.exit, settlement: result.settlement ?? null, cleanup: result.cleanup ?? null,
    terminal_frames: result.frames.length,
    interaction_events: result.interaction_events ?? [],
    truncated: result.truncated ?? 'not_reported',
    truncation_details: result.truncation_details ?? null,
    residual_unknowns: result.residual_unknowns ?? [],
    internal_game_state: 'not_observed', complete_equivalence_proven: false,
  };
}

async function canonicalDestination(path) {
  const absolute = resolve(path);
  const missing = [];
  let existing = dirname(absolute);
  for (;;) {
    try { existing = await realpath(existing); break; }
    catch (error) {
      if (error.code !== 'ENOENT') throw error;
      const parent = dirname(existing);
      if (parent === existing) throw error;
      missing.unshift(existing.slice(parent.length + (parent.endsWith(sep) ? 0 : 1)));
      existing = parent;
    }
  }
  return resolve(existing, ...missing, absolute.slice(dirname(absolute).length + 1));
}

export async function assertEvidenceDestination(path, { repositoryRoot = fileURLToPath(new URL('../../../', import.meta.url)), inputs = [] } = {}) {
  const destination = await canonicalDestination(path);
  const root = await realpath(repositoryRoot);
  const within = relative(root, destination);
  if (!within || (!within.startsWith(`..${sep}`) && within !== '..' && !isAbsolute(within))) {
    throw new Error('原版采集和派生证据必须写到仓库之外；请选择 /tmp 或外部研究目录。');
  }
  // A second checkout is still a repository: do not leak original text into it.
  let ancestor = dirname(destination);
  for (;;) {
    try { await lstat(resolve(ancestor, '.git')); throw new Error('Evidence output must stay outside every Git checkout'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    const parent = dirname(ancestor);
    if (parent === ancestor) break;
    ancestor = parent;
  }
  for (const input of inputs) {
    if (await realpath(input) === destination) throw new Error('Evidence output must differ from every input file');
  }
  return destination;
}

export async function writeEvidence(path, data, options) {
  const destination = await assertEvidenceDestination(path, options);
  await mkdir(dirname(destination), { recursive: true });
  // Exclusive creation refuses existing files, including symlink destinations.
  const handle = await open(destination, 'wx', 0o600);
  try { await handle.writeFile(`${JSON.stringify(data, null, 2)}\n`); }
  catch (error) { await handle.close(); await unlink(destination).catch(() => {}); throw error; }
  await handle.close();
  return destination;
}

export async function captureScenario({ scenario, out, ...options }) {
  const destination = await assertEvidenceDestination(out, { inputs: [scenario], repositoryRoot: options.repositoryRoot });
  // Parse early to catch a wrong file before invoking the explicitly selected target.
  const specification = JSON.parse(await readFile(scenario, 'utf8'));
  if (typeof specification?.executable !== 'string' || !specification.executable.trim()) throw new Error('Scenario requires executable');
  const result = await runRea(['capture-process', resolve(scenario), '--format', 'json'], options);
  const data = parseReaJson(result);
  await writeEvidence(destination, data, { inputs: [scenario], repositoryRoot: options.repositoryRoot });
  return { path: destination, data, summary: summarizeCapture(data) };
}

export async function compareCaptures({ left, right, out, trace, ...options }) {
  const inputs = [left, right, ...(trace ? [trace] : [])];
  const destination = await assertEvidenceDestination(out, { inputs, repositoryRoot: options.repositoryRoot });
  const result = await runRea(['compare-process-captures', resolve(left), resolve(right), ...(trace ? [resolve(trace)] : []), '--format', 'json'], options);
  const data = parseReaJson(result);
  await writeEvidence(destination, data, { inputs, repositoryRoot: options.repositoryRoot });
  return { path: destination, data };
}

export async function doctorRea(options = {}) {
  const version = await runRea(['--version'], options);
  if (version.code !== 0) throw new Error(`Cannot read REA version: ${version.stderr}`);
  const capture = await runRea(['capture-process', '--help'], options);
  const compare = await runRea(['compare-process-captures', '--help'], options);
  let reaNode = 'unknown';
  if (options.node) {
    const selected = await runRea(['--version'], { ...options, rea: options.node, node: undefined });
    if (selected.code !== 0 || !/^v\d+\.\d+\.\d+/.test(selected.text.trim())) throw new Error('Cannot determine the explicitly selected REA Node version');
    reaNode = selected.text.trim();
  }
  return {
    adapter: 'trinity-rea-cli-v1', reference: REA_REFERENCE,
    installed_version: version.text.trim(),
    commands_present: capture.code === 0 && capture.text.includes('capture-process') && compare.code === 0 && compare.text.includes('compare-process-captures'),
    host: process.platform, adapter_node: process.version, rea_node: reaNode,
    capture_prerequisites: 'Native PTY backend; on macOS xcrun Swift and process inspection. Only a successful capture establishes availability.',
    source_identity: 'not_verified_by_version',
  };
}
