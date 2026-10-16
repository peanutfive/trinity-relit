#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { captureScenario, compareCaptures, doctorRea } from './lib/rea.mjs';

const help = `Trinity 原版研究 · REA CLI 适配器（不会自动安装、联网或修改全局配置）

用法:
  node scripts/original-research/rea.mjs doctor [--rea CLI] [--node NODE]
  node scripts/original-research/rea.mjs capture --scenario FILE --out JSON [--rea CLI] [--node NODE]
  node scripts/original-research/rea.mjs compare --left JSON --right JSON --out JSON [--trace JSON] [--rea CLI] [--node NODE]

--rea 是已安装可执行文件，搭配 --node 时是绝对路径的 REA scripts/rea.mjs。
所有输出必须位于仓库之外且文件不存在。REA 采集会执行 scenario 指定的本机程序。
使用说明: docs/REA_ADAPTER.md。
比较保留上游 unknown / truncation / cleanup，不宣称原版与重制版完全等价。
`;

try {
  const { values, positionals } = parseArgs({ allowPositionals: true, options: Object.fromEntries(['rea', 'node', 'scenario', 'out', 'left', 'right', 'trace'].map(key => [key, { type: 'string' }]).concat([['help', { type: 'boolean', short: 'h' }]])) });
  if (values.help || !positionals.length) console.log(help);
  else {
    if (positionals.length !== 1) throw new Error('Only one subcommand is accepted');
    const options = { ...values, progress: text => process.stderr.write(text) };
    const need = keys => { for (const key of keys) if (!values[key]) throw new Error(`Missing --${key}`); };
    switch (positionals[0]) {
      case 'doctor': {
        const report = await doctorRea(options);
        console.log(JSON.stringify(report, null, 2));
        if (!report.commands_present) process.exitCode = 1;
        break;
      }
      case 'capture': {
        need(['scenario', 'out']);
        const result = await captureScenario(options);
        console.log(JSON.stringify({ saved: result.path, summary: result.summary }));
        break;
      }
      case 'compare': need(['left', 'right', 'out']); console.log(JSON.stringify({ saved: (await compareCaptures(options)).path })); break;
      default: throw new Error(`Unknown subcommand: ${positionals[0]}`);
    }
  }
} catch (error) { console.error(error.message); process.exitCode = 1; }
