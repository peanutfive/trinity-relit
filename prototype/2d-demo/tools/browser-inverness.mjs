// Painted centerlines sampled independently of the collision mesh.
// The review URL hides exit labels; outbound/return walks use real keys.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createPrologueSession} from '../engine-adapter.js';
import {makeVisualSave} from '../save.js';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const out=process.env.QA_OUTPUT||'/tmp/trinity-inverness-qa';await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1440,height:900}});
const errors=[],receipts=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
const state=()=>page.evaluate(()=>JSON.parse(window.render_game_to_text()));
const tick=ms=>page.evaluate(ms=>window.advanceTime(ms),ms);
const shot=name=>page.screenshot({path:`${out}/${name}.png`,fullPage:true});
async function drain(){for(let i=0;i<100;i++){const s=await state();if(s.processing){await page.waitForTimeout(20);continue;}if(s.dialogue)await page.keyboard.press('f');else if(s.narrative.busy)await page.click('#skip-event');else return;}throw Error('drain');}
async function fixture(pram,x=235,y=101){
 const e=createPrologueSession();e.moveTo(e.state.room);for(const c of pram?['n','n','push pram']:['n','ne'])await e.processInput(c);
 const save=makeVisualSave(e,{room:e.state.room,x,y,face:'down'});
 await page.keyboard.press('Escape');await page.getByRole('tab',{name:'探索进度'}).click();await page.locator('#save-file').setInputFiles({name:'inverness.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(save))});
 await page.waitForFunction(()=>{const s=JSON.parse(window.render_game_to_text());return s.room==='inverness_terrace'&&s.mode!=='paused'&&!s.processing;});await drain();await tick(650);
 assert.equal((await state()).objects.some(o=>o.kind==='pram'),pram);
}
async function move(keys,ms){for(const k of keys)await page.keyboard.down(k);await tick(ms);for(const k of keys)await page.keyboard.up(k);}
async function point(x,y){
 for(let i=0;i<250;i++){
  const s=await state();if(s.room!=='inverness_terrace')return;
  const dx=x-s.player.x,dy=y-s.player.y;if(Math.hypot(dx,dy)<2.5)return;
  const keys=[];if(Math.abs(dx)>1.4)keys.push(dx>0?'d':'a');if(Math.abs(dy)>1.4)keys.push(dy>0?'s':'w');await move(keys,20);
 }
 throw Error(`blocked painted centerline ${x},${y}: ${JSON.stringify((await state()).player)}`);
}
async function click(x,y){const b=await page.locator('canvas').boundingBox();await page.mouse.click(b.x+x/480*b.width,b.y+y/288*b.height);}
const left=[[130,101],[92,108],[85,132],[89,157],[106,184],[109,190]];
const routes=[
 {dir:'w',target:'black_lion_gate',points:[[200,101],[140,101],[80,99],[40,96]],keys:['a']},
 {dir:'e',target:'lancaster_gate',points:[[300,102],[380,101],[440,97]],keys:['d']},
 {dir:'sw',target:'broad_walk',points:[...left,[82,207],[52,225],[38,237]],keys:['a','s']},
 {dir:'s',target:'round_pond',points:[...left,[150,204],[185,220],[215,245],[220,255]],keys:['s']},
 {dir:'se',target:'lancaster_walk',points:[[320,102],[344,112],[344,132],[356,156],[386,177],[421,199],[444,227],[460,255]],keys:['s']},
];
try{
 const url=new URL(process.env.DEMO_URL||'http://127.0.0.1:8080/2d-demo/');url.searchParams.set('reviewRoutes','1');await page.goto(url.href);
 await page.waitForFunction(()=>window.render_game_to_text&&JSON.parse(window.render_game_to_text()).art==='loaded');await page.click('#start');await drain();
 // Hold automatic RAF; all motion below still goes through real key handlers.
 await page.evaluate(()=>{const raf=requestAnimationFrame.bind(window);let next;window.requestAnimationFrame=f=>{next=f;return 0;};window.__resume=()=>{window.requestAnimationFrame=raf;if(next)raf(next);};});await page.waitForTimeout(60);
 for(const pram of [false,true])for(const route of routes){
  await fixture(pram);const start=await state();
  for(let i=0;i<route.points.length;i++){
   await point(...route.points[i]);assert.equal((await state()).room,'inverness_terrace',`${route.dir}: another exit stole the painted road at ${i}`);
   if(i===route.points.length-1||route.dir==='s'&&i===5)await shot(`${pram?'pram':'empty'}-${route.dir}-${i}`);
  }
  await move(route.keys,650);await page.waitForFunction(target=>JSON.parse(window.render_game_to_text()).room===target,route.target);
  let s=await state();assert.equal(s.lastCommand,route.dir);await drain();
  // Other rooms retain their own pending art audits. Use their existing exit
  // to return, then keyboard-walk this scene's same curve in reverse.
  const back=(await state()).exits.find(e=>e.target==='inverness_terrace');assert.ok(back);
  await tick(650);await click(back.x,back.y);
  for(let i=0;i<150;i++){await tick(100);if((await state()).room==='inverness_terrace')break;}
  await drain();s=await state();assert.equal(s.room,'inverness_terrace');assert.equal(s.navigation.arrival.entrance,route.dir);assert.equal(s.navigation.arrival.matched,true);
  assert.ok(Math.hypot(s.player.x-start.player.x,s.player.y-start.player.y)>20,'return arrival must use its own entrance');
  await shot(`${pram?'pram':'empty'}-${route.dir}-arrival`);
  for(const p of [...route.points].reverse())await point(...p);await point(235,101);
  assert.equal((await state()).room,'inverness_terrace');
  receipts.push({pram,dir:route.dir,target:route.target,outwardKeys:route.keys,returnEntrance:s.navigation.arrival.entrance});
  console.log('PASS',pram?'pram':'empty',route.dir,'out and back');
 }
 // Exact old-save neighborhood remains escapable; restore must not strand it.
 await fixture(false,198,108);await point(180,101);assert.equal((await state()).room,'inverness_terrace');
 await page.setViewportSize({width:844,height:390});await fixture(true);await point(300,102);await shot('mobile-pram-bypass');
 await page.evaluate(()=>window.__resume());assert.deepEqual(errors,[]);await writeFile(`${out}/result.json`,JSON.stringify({pass:true,receipts,errors},null,2));
 console.log('PASS five painted routes, both directions, with and without solid pram; no arrows; local SE accepts S; source entrances and mobile bypass; no errors.');
}catch(e){await shot('failure').catch(()=>{});await writeFile(`${out}/failure.json`,JSON.stringify({message:e.message,state:await state().catch(()=>null),receipts,errors},null,2));throw e;}finally{await browser.close();}
