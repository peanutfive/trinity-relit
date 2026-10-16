import { spawn } from 'node:child_process';

// Read a fresh interpreter from its prompt, rather than guessing fixed delays.
// This captures terminal responses only; it does not inspect VM flags or memory.
export async function captureTranscript({ executable, arguments: argv = [], commands,
  timeoutMs = 30000, stepTimeoutMs = 3000, outputLimit = 2 * 1024 * 1024, cwd,
  startupPattern = /\[Press any key to begin\.\]/, promptPattern = /(?:^|\n)>/g,
  shutdown = 'quit\nyes\n' }) {
  if (!Array.isArray(commands) || commands.length > 500 || commands.some(command =>
    typeof command !== 'string' || !command.trim() || /[\r\n\0]/.test(command))) throw new Error('Commands must be up to 500 nonempty single lines');
  for (const number of [timeoutMs, stepTimeoutMs, outputLimit]) if (!Number.isSafeInteger(number) || number <= 0) throw new Error('Capture limits must be positive integers');
  const child = spawn(executable, argv, { cwd, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
  child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8');
  let stdout = '', stderr = '', bytes = 0, exited = false, closed = false, exitCode = null, exitSignal = null;
  let failure = null, truncated = false, forcedCleanup = false;
  const changes = new Set();
  const wake = () => { for (const listener of [...changes]) listener(); };
  const fail = message => { failure ||= message; wake(); };
  child.on('error', error => fail(`Interpreter could not start: ${error.code || error.message}`));
  child.stdin.on('error', error => { if (!exited) fail(`Interpreter input failed: ${error.code}`); });
  const append = (key, text) => {
    bytes += Buffer.byteLength(text);
    if (bytes > outputLimit) { truncated = true; fail('Output limit exceeded'); return; }
    if (key === 'stdout') stdout += text; else stderr += text;
    wake();
  };
  child.stdout.on('data', text => append('stdout', text));
  child.stderr.on('data', text => append('stderr', text));
  const closure = new Promise(resolve => child.on('close', (code, signal) => {
    exited = true; closed = true; exitCode = code; exitSignal = signal; wake(); resolve();
  }));
  child.on('exit', () => { exited = true; wake(); });
  const deadline = setTimeout(() => fail('Capture timeout exceeded'), timeoutMs);
  function until(pattern, from) {
    return new Promise((resolve, reject) => {
      let timer;
      const clean = () => { clearTimeout(timer); changes.delete(check); };
      const check = () => {
        if (failure) { clean(); reject(new Error(failure)); return; }
        const regex = new RegExp(pattern.source, pattern.flags.replace('g', '') + 'g');
        regex.lastIndex = from;
        const match = regex.exec(stdout);
        if (match) { clean(); resolve({ start: match.index, end: regex.lastIndex }); return; }
        if (exited) { clean(); reject(new Error('Interpreter exited before the next prompt')); }
      };
      changes.add(check);
      timer = setTimeout(() => { clean(); reject(new Error('Command prompt timeout exceeded')); }, stepTimeoutMs);
      check();
    });
  }
  let cursor = 0;
  const steps = [];
  try {
    await until(startupPattern, 0);
    child.stdin.write('\n'); // Startup keystroke is not a game command.
    cursor = (await until(promptPattern, 0)).end;
    for (const command of commands) {
      const from = cursor;
      child.stdin.write(command + '\n');
      const prompt = await until(promptPattern, from);
      steps.push({ index: steps.length, command, output: stdout.slice(from, prompt.start) });
      cursor = prompt.end;
    }
    child.stdin.end(shutdown);
  } catch (error) { failure ||= error.message; }
  finally {
    clearTimeout(deadline);
    if (failure && !exited) child.kill('SIGTERM');
    let cleanupTimer;
    await Promise.race([closure, new Promise(resolve => {
      cleanupTimer = setTimeout(() => { forcedCleanup = true; child.kill('SIGKILL'); resolve(); }, 1500);
    })]);
    clearTimeout(cleanupTimer);
    if (!closed) await Promise.race([closure, new Promise(resolve => { cleanupTimer = setTimeout(resolve, 1500); })]);
    clearTimeout(cleanupTimer);
  }
  return { schemaVersion: 1, kind: 'trinity-command-transcript', complete: !failure && !truncated && !forcedCleanup && closed && exitCode === 0,
    requestedCommands: commands.length, completedCommands: steps.length, steps, stdout, stderr,
    execution: { executable, arguments: argv, exitCode, exitSignal, closed, forcedCleanup, failure, truncated, outputLimit },
    limitations: ['Only the root interpreter lifecycle is controlled; descendant cleanup is not observed.', 'Terminal output only; internal VM state and causal branch execution are not observed.', 'Transcript observations do not establish source/build equivalence or exhaustive behavior coverage.'] };
}
