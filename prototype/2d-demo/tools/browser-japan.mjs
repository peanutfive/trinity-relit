// Source-engine fixtures are imported through the ordinary save UI. Actual
// movement and F/held-item input exercise the browser controller, not a debug API.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createPrologueSession} from '../engine-adapter.js';
import {makeVisualSave,VISUAL_SAVE_KEY} from '../save.js';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const out=process.env.QA_OUTPUT||'/tmp/trinity-japan-qa';await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1440,height:900}});
const errors=[],receipts=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
const state=()=>page.evaluate(()=>JSON.parse(window.render_game_to_text()));
const tick=ms=>page.evaluate(ms=>window.advanceTime(ms),ms);
const shot=name=>page.screenshot({path:`${out}/${name}.png`,fullPage:true});
async function closeText(){for(let i=0;i<40&&(await state()).dialogue;i++)await page.keyboard.press('f');}
async function drain(){for(let i=0;i<100;i++){const s=await state();if(s.processing)await page.waitForTimeout(15);else if(s.dialogue)await page.keyboard.press('f');else if(s.narrative.busy)await page.click('#skip-event');else return;}throw Error('drain');}
async function click(x,y){const b=await page.locator('canvas').boundingBox();await page.mouse.click(b.x+x/480*b.width,b.y+y/288*b.height);}
async function moveTo(x,y){await click(x,y);for(let i=0;i<160;i++){const s=await state();if(!s.navigation.path.length&&!s.processing)return;await tick(100);}throw Error(`walk ${x},${y}`);}
async function F(command){await page.keyboard.press('f');await page.waitForFunction(c=>{const s=JSON.parse(window.render_game_to_text());return s.lastCommand===c&&!s.processing;},command);}
async function hold(id){await page.keyboard.press('i');await page.locator('#choices button').filter({hasText:id==='umbrella'?'雨伞':id==='paper_bird'?'纸鸟':id}).click();}
async function importSave(save){await page.keyboard.press('Escape');await page.getByRole('tab',{name:'探索进度'}).click();await page.locator('#save-file').setInputFiles({name:'japan.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(save))});await page.waitForFunction(room=>{const s=JSON.parse(window.render_game_to_text());return s.room===room&&s.mode!=='paused'&&!s.processing;},save.engine.state.room);await drain();}
const first=['e','take ball','nw','unscrew gnomon','take gnomon','n','take paper bird','open paper bird','w','buy crumbs','feed birds','take ruby','n','push pram','push pram','wait','throw ball at tree','take umbrella','push pram','open pram','enter pram','open umbrella','take paper bird','take gnomon','s','enter door','n','ne','e','u'];
try{
 await page.goto(process.env.DEMO_URL||'http://127.0.0.1:8080/2d-demo/?reviewRoutes=1');
 await page.waitForFunction(()=>window.render_game_to_text&&JSON.parse(window.render_game_to_text()).art==='loaded'&&JSON.parse(window.render_game_to_text()).japanSprites==='loaded');
 await page.click('#start');await drain();
 const e=createPrologueSession();e.moveTo(e.state.room);for(const c of first)await e.processInput(c);for(let i=0;e.state.sundialSymbol!==1&&i<7;i++)await e.processInput('turn ring');await e.processInput('d');
 await importSave(makeVisualSave(e,{room:e.state.room,x:438,y:232,face:'right',knowledge:{observed:[],paper:{observed:[],identified:[]}}}));
 // First new route runs on normal animation frames before deterministic samples.
 await page.keyboard.down('d');await page.waitForTimeout(750);await page.keyboard.up('d');await page.waitForFunction(()=>JSON.parse(window.render_game_to_text()).room==='the_bend');await drain();await shot('bend');
 await page.evaluate(()=>{const raf=requestAnimationFrame.bind(window);let next;window.requestAnimationFrame=f=>{next=f;return 0;};window.__resume=()=>{window.requestAnimationFrame=raf;if(next)raf(next);};});await page.waitForTimeout(45);
 await moveTo(233,139);await click(464,130);for(let i=0;i<120&&(await state()).room!=='moor';i++)await tick(100);await drain();assert.equal((await state()).room,'moor');await shot('moor-open');
 await moveTo(319,109);await page.keyboard.down('d');await tick(20);await page.keyboard.up('d');
 await F('look');await drain();await F('in');await drain();assert.equal((await state()).room,'playground');assert.equal((await state()).navigation.arrival.entrance,'out');await shot('playground-entry');
 await moveTo(240,118);await page.keyboard.down('w');await tick(15);await page.keyboard.up('w');await F('wait');await closeText();
 let s=await state();assert.equal(s.narrative.currentEvent,'japan_girl_approach');const turns=s.turns;
 await tick(s.narrative.duration*500);await shot('girl-approach');await tick(s.narrative.duration*1000);await drain();assert.equal((await state()).turns,turns);
 await hold('umbrella');await moveTo(235,166);await page.keyboard.down('d');await tick(20);await page.keyboard.up('d');await F('give umbrella to girl');await closeText();s=await state();assert.equal(s.narrative.currentEvent,'japan_give_umbrella');
 await tick(400);await shot('girl-receive');await tick(1700);await shot('girl-walk-umbrella');
 await page.keyboard.press('Escape');const paused=(await state()).narrative.elapsed;await tick(900);assert.equal((await state()).narrative.elapsed,paused);await page.keyboard.press('Escape');await tick(s.narrative.duration*1000);await drain();
 await moveTo(421,151);await page.keyboard.down('d');await tick(10);await page.keyboard.up('d');await F('e');await drain();assert.equal((await state()).room,'shelter');await shot('shelter');
 // There is one physical doorway despite e/in/out command aliases.
 assert.equal((await state()).exits.filter(x=>!x.interactionOnly).length,1);
 await moveTo(290,203);await page.keyboard.down('d');await tick(10);await page.keyboard.up('d');await F('examine spade');await drain();await F('take spade');await drain();assert.ok((await state()).inventory.includes('spade'));
 await hold('paper_bird');await moveTo(230,158);await page.keyboard.down('d');await tick(10);await page.keyboard.up('d');await F('give paper to girl');await closeText();s=await state();assert.equal(s.narrative.currentEvent,'japan_refold');await tick(1400);await shot('girl-folding');await tick(2000);await shot('girl-offering');await drain();assert.ok(!(await state()).flags.includes('bird_unfolded'));
 await page.keyboard.press('m');const mapped=await state();assert.equal(mapped.map.chapter,'japan');assert.equal(await page.locator('[data-room-id]').count(),2);await shot('japan-map');await tick(800);assert.equal((await state()).turns,mapped.turns);await page.keyboard.press('m');
 // Restore committed state, without replaying folding or creating another spade.
 const saved=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),VISUAL_SAVE_KEY);assert.equal(saved.engine.state.room,'shelter');await importSave(saved);s=await state();assert.equal(s.narrative.currentEvent,null);assert.ok(s.inventory.includes('spade'));assert.ok(!s.objects.some(o=>o.itemId==='spade'));await shot('shelter-restored');
 await click(30,166);for(let i=0;i<100&&(await state()).room==='shelter';i++)await tick(100);await drain();assert.equal((await state()).room,'playground');assert.ok(['e','in'].includes((await state()).navigation.arrival.entrance));
 await hold('paper_bird');await page.click('#held-item');await page.waitForFunction(()=>{const s=JSON.parse(window.render_game_to_text());return s.lastCommand==='ride bird'&&!s.processing;});await closeText();s=await state();assert.equal(s.room,'moor');assert.equal(s.narrative.currentEvent,'japan_paper_flight');assert.equal(s.narrative.sceneRoom,'playground');assert.equal(s.narrative.hidePlayer,true);assert.equal(await page.locator('#room').textContent(),'游乐场');await tick(1100);await shot('paper-bird-grown');await tick(1500);await shot('paper-bird-flying');const flightTurns=s.turns;await tick(6000);await drain();s=await state();assert.equal(s.turns,flightTurns);assert.equal(s.narrative.currentEvent,null);assert.equal(s.navigation.arrival.entrance,'in');assert.ok(s.inventory.includes('spade'));assert.ok(s.player.x<330);assert.equal(await page.locator('#room').textContent(),'荒野');await shot('moor-return');
 receipts.push({route:'stairs → bend → moor → playground → shelter → moor',F:true,normalRAF:true,pause:true,map:true,restore:true,score:s.score,turns:s.turns,arrival:s.navigation.arrival});
 await page.setViewportSize({width:844,height:390});await page.keyboard.press('m');await shot('japan-route-mobile-map');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.keyboard.press('m');
 assert.deepEqual(errors,[]);await writeFile(`${out}/result.json`,JSON.stringify({pass:true,receipts,errors},null,2));console.log('PASS Japan: painted walking, F, girl/umbrella/fold, flight return, pause/map, restore, no errors');
}catch(error){await shot('failure').catch(()=>{});await writeFile(`${out}/failure.json`,JSON.stringify({message:error.message,state:await state().catch(()=>null),receipts,errors},null,2));throw error;}finally{await browser.close();}
