import { args, required, json, main } from './lib/common.mjs';
import { findCase } from './capture.mjs';
import { createCheckpoint, restoreCheckpoint } from './lib/checkpoint.mjs';

export async function runCheckpoint(argv) {
  const [command, ...rest] = argv;
  if (!command || command === '--help') {
    console.log('checkpoint create --dat FILE (--commands JSON | --case ID [--prefix-count N]) --out NEW_DIR [--dfrotz PATH] [--timeout-ms N]\ncheckpoint restore --dat FILE --checkpoint MANIFEST [--commands JSON] --out NEW_JSON [--dfrotz PATH] [--timeout-ms N]');
    return;
  }
  const options = args(rest, ['dat', 'commands', 'out', 'checkpoint', 'dfrotz', 'timeout-ms', 'case', 'manifest', 'prefix-count']);
  if (options.help) return runCheckpoint(['--help']);
  required(options, ['dat', 'out']);
  if (options.case && options.commands) throw new Error('Choose either --case or --commands');
  if ((options.case || options['prefix-count'] || options.manifest) && command !== 'create') throw new Error('Case selection is only supported when creating a checkpoint');
  let suppliedCommands;
  if (options.case) {
    const { scenario } = findCase(await json(options.manifest || 'research/pilots.json'), options.case);
    if (scenario.status !== 'runtime-verified') throw new Error('Checkpoint case requires a complete verified route');
    const count = Number(options['prefix-count'] || scenario.commands.length);
    if (!Number.isSafeInteger(count) || count < 1 || count > scenario.commands.length) throw new Error('Invalid checkpoint prefix length');
    suppliedCommands = { commands: scenario.commands.slice(0, count), continuations: (scenario.continuations || []).filter(control => control.commandIndex < count) };
  } else {
    if (options['prefix-count'] || options.manifest) throw new Error('--prefix-count and --manifest require --case');
    if (command === 'create') required(options, ['commands']);
    suppliedCommands = options.commands ? await json(options.commands) : [];
  }
  const shared = { dat: options.dat, commands: suppliedCommands, out: options.out, dfrotz: options.dfrotz, timeoutMs: Number(options['timeout-ms'] || 30000) };
  if (command === 'create') {
    const result = await createCheckpoint(shared);
    console.log(JSON.stringify({ checkpoint: result.manifestFile, origin: result.manifest.origin, historyCommands: result.manifest.history.completedCommands }));
    return result;
  }
  if (command === 'restore') {
    required(options, ['checkpoint']);
    const result = await restoreCheckpoint({ ...shared, checkpoint: options.checkpoint });
    console.log(JSON.stringify({ out: options.out, origin: result.origin, complete: result.complete, restored: result.restored, observationsMatch: result.observationsMatch }));
    if (!result.complete) process.exitCode = 1;
    return result;
  }
  throw new Error(`Unknown checkpoint operation: ${command}`);
}
if (process.argv[1]?.endsWith('/checkpoint.mjs')) main(() => runCheckpoint(process.argv.slice(2)));
