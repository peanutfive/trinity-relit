import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { hash } from '../scripts/original-research/lib/common.mjs';
import { reaScenario } from '../scripts/original-research/scenario.mjs';
import { captureTranscript } from '../scripts/original-research/lib/capture.mjs';

const fixture = String.raw`
process.stdin.setEncoding('utf8');process.stdout.write('[Press any key to begin.]');
let input='',started=false,key=false;
process.stdin.on('data',chunk=>{input+=chunk;while(input.includes('\n')){
 const at=input.indexOf('\n'),line=input.slice(0,at);input=input.slice(at+1);
 if(!started){started=true;process.stdout.write('\n>');continue;}
 if(key){if(line!=='')process.exit(2);key=false;process.stdout.write('transition accepted\n>');continue;}
 if(line==='quit')process.exit(0);
 if(line==='chapter'){key=true;process.stdout.write('fixture transition marker\n');continue;}
 process.stdout.write('reply:'+line+'\n>');
}});
`;
async function run(controls) {
 const root=await mkdtemp(path.join(tmpdir(),'trinity-continuation-'));
 try {
  const file=path.join(root,'fixture.cjs');await writeFile(file,fixture);
  return await captureTranscript({executable:process.execPath,arguments:[file],commands:['chapter','alpha'],continuations:controls,stepTimeoutMs:300});
 }finally{await rm(root,{recursive:true,force:true});}
}
test('明确过场按键只在绑定命令的整行摘要命中时发送，不占游戏命令索引',async()=>{
 const control={commandIndex:0,lineSha256:hash('fixture transition marker'),key:'\n'};
 const result=await run([control]);
 assert.equal(result.complete,true);
 assert.equal(result.steps.length,2);
 assert.equal(result.steps[1].command,'alpha');
 assert.match(result.steps[1].output,/reply:alpha/);
 assert.equal(result.controls.length,1);
 const span=result.controls[0].markerSpan;
 assert.equal(hash(result.stdout.slice(span.start,span.end).trim()),control.lineSha256);
});
test('未声明或摘要错误的过场不自动发送按键，也不吞后续指令',async()=>{
 for(const controls of [[],[{commandIndex:0,lineSha256:'a'.repeat(64),key:'\n'}]]){
  const result=await run(controls);
  assert.equal(result.complete,false);
  assert.equal(result.completedCommands,0);
  assert.doesNotMatch(result.stdout,/reply:alpha/);
 }
});

test('REA定时场景不能静默丢掉需要输出门控的过场按键',()=>{
 assert.throws(()=>reaScenario({dat:'/tmp/fixture.dat',dfrotz:'/tmp/fixture',cwd:'/tmp',commands:['chapter'],continuations:[{commandIndex:0,lineSha256:hash('fixture'),key:'\n'}]}),/cannot enforce/);
});
