import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,cp,mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
test('章节规范检查真实加载ES模块及辅助导入，仍拒绝真正的出口moveTo',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'trinity-rule-regression-'));
 try{
  await mkdir(join(dir,'scripts'),{recursive:true});await mkdir(join(dir,'prototype/js'),{recursive:true});
  await cp(new URL('../scripts/verify_chapters_rules.js',import.meta.url),join(dir,'scripts/verify_chapters_rules.js'));
  await cp(new URL('../prototype/js/data',import.meta.url),join(dir,'prototype/js/data'),{recursive:true});
  await cp(new URL('../prototype/js/prologue-time.js',import.meta.url),join(dir,'prototype/js/prologue-time.js'));
  const run=()=>spawnSync(process.execPath,[join(dir,'scripts/verify_chapters_rules.js')],{encoding:'utf8'});
  const good=run();assert.equal(good.status,0,good.stdout+good.stderr);
  const file=join(dir,'prototype/js/data/prologue.js'),source=await readFile(file,'utf8');
  await writeFile(file,source.replace('n: "broad_walk", e: "flower_walk"','n: {to:"broad_walk",act(s,eng){eng.moveTo("broad_walk");}}, e: "flower_walk"'));
  const bad=run();assert.equal(bad.status,1);assert.match(bad.stdout+bad.stderr,/出口act/);
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('出口真值检查加载辅助模块并保留目标错误判定；模块语法错不能静默跳章',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'trinity-exit-regression-'));
 try{
  await mkdir(join(dir,'scripts'),{recursive:true});await mkdir(join(dir,'prototype/js/data'),{recursive:true});
  await cp(new URL('../scripts/verify_exits_vs_zmachine.js',import.meta.url),join(dir,'scripts/verify_exits_vs_zmachine.js'));
  // Synthetic graph, deliberately unrelated to any original DAT extraction.
  await writeFile(join(dir,'prototype/CHAPTER_PLAN.md'),'| 9001 | `palace_gate` |\n| 9002 | `broad_walk` |\n');
  await writeFile(join(dir,'scripts/exit_truth.json'),JSON.stringify({9001:{exits:{n:9002},opaque:{}},9002:{exits:{},opaque:{}}}));
  const helper=join(dir,'prototype/js/helper.js'),chapter=join(dir,'prototype/js/data/prologue.js');
  await writeFile(helper,"export const neighbor='broad_walk';\n");
  await writeFile(chapter,"import {neighbor} from '../helper.js'; export const ROOMS={palace_gate:{exits:{n:neighbor}},broad_walk:{exits:{}}};\n");
  const run=()=>spawnSync(process.execPath,[join(dir,'scripts/verify_exits_vs_zmachine.js'),'prologue'],{encoding:'utf8'});
  const good=run();assert.equal(good.status,0,good.stdout+good.stderr);assert.match(good.stdout,/已比对房间: 2/);
  await writeFile(helper,"export const neighbor='palace_gate';\n");
  const wrong=run();assert.equal(wrong.status,1);assert.match(wrong.stdout,/目标错误/);
  await writeFile(helper,'export const neighbor = ;\n');
  const broken=run();assert.equal(broken.status,1);assert.match(broken.stderr,/SyntaxError/);assert.ok(!broken.stdout.includes('未发现偏差'));
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('Wabe专用校验读取带导入的真实物品模块；坏依赖必须失败',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'trinity-wabe-verifier-'));
 try{
  await mkdir(join(dir,'scripts'),{recursive:true});await mkdir(join(dir,'prototype/js'),{recursive:true});
  await cp(new URL('../scripts/verify_wabe.js',import.meta.url),join(dir,'scripts/verify_wabe.js'));
  await cp(new URL('../prototype/js/data',import.meta.url),join(dir,'prototype/js/data'),{recursive:true});
  await cp(new URL('../prototype/js/prologue-time.js',import.meta.url),join(dir,'prototype/js/prologue-time.js'));
  const run=()=>spawnSync(process.execPath,[join(dir,'scripts/verify_wabe.js')],{encoding:'utf8'});
  const good=run();assert.equal(good.status,0,good.stdout+good.stderr);assert.match(good.stdout,/全部检查通过/);
  await writeFile(join(dir,'prototype/js/prologue-time.js'),'export const watchDescription = ;\n');
  const bad=run();assert.equal(bad.status,1);assert.match(bad.stderr,/SyntaxError/);assert.ok(!bad.stdout.includes('全部检查通过'));
 }finally{await rm(dir,{recursive:true,force:true});}
});
