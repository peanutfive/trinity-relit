// Actual F input and ordinary save import. The first trip runs on normal RAF;
// later trips sample the same controller deterministically for clear receipts.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createPrologueSession} from '../engine-adapter.js';
import {getHotspots} from '../interaction-catalog.js';
import {makeVisualSave,VISUAL_SAVE_KEY} from '../save.js';
import {createPramPushMotion,samplePramPushMotion} from '../pram-motion.js';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const out=process.env.QA_OUTPUT||'/tmp/trinity-pram-qa';await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1440,height:900}});
const errors=[],receipts=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
const state=()=>page.evaluate(()=>JSON.parse(window.render_game_to_text()));
const tick=ms=>page.evaluate(ms=>window.advanceTime(ms),ms);
const shot=name=>page.screenshot({path:`${out}/${name}.png`,fullPage:true});
async function closeText(){for(let i=0;i<30&&(await state()).dialogue;i++)await page.keyboard.press('f');}
async function drain(){for(let i=0;i<100;i++){const s=await state();if(s.processing)await page.waitForTimeout(20);else if(s.dialogue)await page.keyboard.press('f');else if(s.narrative.busy)await page.click('#skip-event');else return;}throw Error('drain');}
async function fixture(commands){
 const e=createPrologueSession();e.moveTo(e.state.room);for(const c of commands)await e.processInput(c);
 const cart=getHotspots(e.state).find(o=>o.kind==='pram');assert.ok(cart);
 const save=makeVisualSave(e,{room:e.state.room,x:cart.x-29,y:cart.y+1,face:'right',knowledge:{observed:[cart.id],paper:{observed:[],identified:[]}}});
 await page.keyboard.press('Escape');await page.getByRole('tab',{name:'探索进度'}).click();await page.locator('#save-file').setInputFiles({name:'pram.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(save))});
 await page.waitForFunction(room=>{const s=JSON.parse(window.render_game_to_text());return s.room===room&&s.mode!=='paused'&&!s.processing;},e.state.room);await drain();
 return e;
}
async function push(target){
 const before=await state();await page.keyboard.press('f');
 await page.waitForFunction(room=>{const s=JSON.parse(window.render_game_to_text());return s.room===room&&!s.processing&&s.narrative.currentEvent==='pram_push';},target);
 const after=await state();assert.equal(after.lastCommand,'push pram');assert.equal(after.turns,before.turns+1);assert.equal(after.narrative.hidePlayer,true);assert.equal(after.narrative.groundActors.length,2);
 return {before,after};
}
function landing(s,expected){assert.ok(Math.hypot(s.player.x-expected.x,s.player.y-expected.y)<1,'ordinary player must resume at the final visible pushing foot');}
try{
 await page.goto(process.env.DEMO_URL||'http://127.0.0.1:8080/2d-demo/?reviewRoutes=1');
 await page.waitForFunction(()=>window.render_game_to_text&&JSON.parse(window.render_game_to_text()).sprites==='loaded');await page.click('#start');await drain();
 await fixture(['n','n','open pram']);const first=await push('inverness_terrace');
 const initial=first.after.narrative.groundActors.find(a=>a.kind==='pram');
 await page.waitForTimeout(1100);let s=await state();const rolling=s.narrative.groundActors.find(a=>a.kind==='pram');
 assert.ok(rolling.x-initial.x>20&&rolling.x-initial.x<100,'normal RAF must show a measured walking pace');await shot('inverness-normal-raf');
 await page.keyboard.press('Escape');const paused=await state();await page.waitForTimeout(450);assert.equal((await state()).narrative.elapsed,paused.narrative.elapsed);await shot('inverness-paused');await page.keyboard.press('Escape');
 await closeText();await page.keyboard.press('m');const mapped=await state();await tick(900);assert.equal((await state()).narrative.elapsed,mapped.narrative.elapsed);await page.keyboard.press('m');
 const expected=(await state()).narrative.playerLanding;
 await page.waitForFunction(()=>JSON.parse(window.render_game_to_text()).narrative.currentEvent!=='pram_push');await drain();s=await state();landing(s,expected);assert.equal(s.turns,first.after.turns);await shot('inverness-stopped');
 // The command is already committed and saved once. Restoring cannot replay it.
 const saved=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),VISUAL_SAVE_KEY);assert.ok(saved);assert.equal(saved.engine.state.room,'inverness_terrace');
 await page.reload();await page.waitForFunction(()=>window.render_game_to_text&&JSON.parse(window.render_game_to_text()).sprites==='loaded');await page.click('#continue-save');await drain();s=await state();landing(s,expected);assert.equal(s.turns,first.after.turns);assert.equal(s.narrative.currentEvent,null);await shot('inverness-restored');
 receipts.push({room:s.room,normalRAF:true,pause:true,mapFreeze:true,saveRestore:true,turns:s.turns,landing:s.player});
 // Freeze automatic RAF only for repeatable intermediate/end comparisons.
 await page.evaluate(()=>{const raf=requestAnimationFrame.bind(window);let next;window.requestAnimationFrame=f=>{next=f;return 0;};window.__resume=()=>{window.requestAnimationFrame=raf;if(next)raf(next);};});await page.waitForTimeout(60);
 for(const [commands,target] of [[['n','n','push pram'],'lancaster_gate'],[['n','n','push pram','push pram'],'lancaster_walk']]){
  await fixture(commands);const {after}=await push(target);await closeText();await tick(after.narrative.duration*500);await shot(`${target}-pushing`);
  const middle=await state(),end=middle.narrative.playerLanding;assert.equal(middle.narrative.currentEvent,'pram_push');await tick(after.narrative.duration*1000+10);await drain();s=await state();landing(s,end);assert.equal(s.turns,after.turns);await shot(`${target}-stopped`);receipts.push({room:target,F:true,turns:s.turns,landing:s.player});
 }
 await fixture(['n','n','open pram']);const skipped=await push('inverness_terrace'),skipEnd=skipped.after.narrative.playerLanding;await page.click('#skip-event');await closeText();s=await state();landing(s,skipEnd);assert.equal(s.turns,skipped.after.turns);assert.equal(s.narrative.groundActors.length,0);await shot('inverness-skipped');
 // The fourth ordinary push exists in the original engine. Its visual route
 // is exercised by the Node contact/renderer checks; retain its source receipt.
 const e=createPrologueSession();e.moveTo(e.state.room);for(const c of ['n','n','push pram','push pram','push pram','push pram'])await e.processInput(c);
 const target=getHotspots(e.state).find(o=>o.kind==='pram'),plan=createPramPushMotion({fromRoom:'lancaster_walk',room:e.state.room,target});
 receipts.push({room:e.state.room,sourceEngine:true,duration:plan.duration,end:samplePramPushMotion(plan,plan.duration).pusher});
 await page.evaluate(()=>window.__resume());assert.deepEqual(errors,[]);await writeFile(`${out}/result.json`,JSON.stringify({pass:true,receipts,errors},null,2));console.log('PASS normal-RAF push; F trips; pause/map; grounded endpoints; restore/skip once; no errors');
}catch(e){await shot('failure').catch(()=>{});await writeFile(`${out}/failure.json`,JSON.stringify({message:e.message,state:await state().catch(()=>null),receipts,errors},null,2));throw e;}finally{await browser.close();}
