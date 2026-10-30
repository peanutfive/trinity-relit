// Legal story fixtures, normal save UI and real keyboard/pointer inputs.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createPrologueSession} from '../engine-adapter.js';
import {makeVisualSave} from '../save.js';
import {ITEMS} from '../../js/data/items.js';
import {JAPAN_POINTS as P} from '../japan-route-layout.js';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const out=process.env.QA_OUTPUT||'/private/tmp/trinity-response-browser';await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[],receipts=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
const state=()=>page.evaluate(()=>JSON.parse(window.render_game_to_text()));
const tick=ms=>page.evaluate(ms=>window.advanceTime(ms),ms);
const shot=name=>page.screenshot({path:`${out}/${name}.png`,fullPage:true});
async function drain(){for(let i=0;i<100;i++){const s=await state();if(s.processing)await page.waitForTimeout(15);else if(s.dialogue)await page.keyboard.press(s.controls.interact);else if(s.narrative.busy)await page.click('#skip-event');else return;}throw Error('drain');}
async function click(x,y){const b=await page.locator('canvas').boundingBox();await page.mouse.click(b.x+x/480*b.width,b.y+y/288*b.height);}
async function move(x,y){await click(x,y);for(let i=0;i<180&&(await state()).navigation.path.length;i++)await tick(80);assert.ok(Math.hypot((await state()).player.x-x,(await state()).player.y-y)<10);}
async function input(command){await page.keyboard.press((await state()).controls.interact);await page.waitForFunction(c=>{const s=JSON.parse(window.render_game_to_text());return s.lastCommand===c&&!s.processing;},command);}
async function hold(id){await page.keyboard.press('i');await page.getByRole('button',{name:ITEMS[id].cn,exact:true}).click();}
async function importSave(e,x,y,face='up'){
 await drain();const save=makeVisualSave(e,{room:e.state.room,x,y,face});
 await page.keyboard.press('Escape');await page.getByRole('tab',{name:'探索进度'}).click();await page.locator('#save-file').setInputFiles({name:'response.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(save))});await page.waitForFunction(room=>{const s=JSON.parse(window.render_game_to_text());return s.room===room&&!s.processing&&s.mode!=='paused';},e.state.room);await drain();
}
const road=['e','take ball','nw','unscrew gnomon','take gnomon','n','take paper bird','open paper bird','w','buy crumbs','feed birds','take ruby','n','push pram','push pram','wait','throw ball at tree','take umbrella','push pram','open pram','enter pram','open umbrella','take paper bird','take gnomon','enter water'];
const e=createPrologueSession();e.moveTo(e.state.room);for(const c of road)await e.processInput(c);
try{
 await page.goto(process.env.DEMO_URL||'http://127.0.0.1:8080/2d-demo/?reviewRoutes=1');await page.waitForFunction(()=>window.render_game_to_text&&JSON.parse(window.render_game_to_text()).art==='loaded');await page.click('#start');await drain();
 await page.evaluate(()=>{window.requestAnimationFrame=()=>0;});await page.waitForTimeout(25);
 await importSave(e,250,225,'right');await hold('gnomon');assert.equal(await page.locator('#hint').textContent(),'F · 观察');await shot('held-gnomon-observe');await input('examine door');await drain();assert.equal((await state()).room,'wading');assert.equal(await page.locator('#hint').textContent(),'F · 通行');await shot('held-gnomon-passage');
 await page.keyboard.press('Escape');await page.locator('[data-binding="interact"]').click();await page.keyboard.press('g');await page.locator('[data-binding="fullscreen"]').click();await page.keyboard.press('p');assert.match(await page.locator('.keys').textContent(),/G 互动.*P 全屏/);await shot('remapped-bindings');await page.keyboard.press('Escape');assert.equal(await page.locator('#hint').textContent(),'G · 通行');const before=await state();await page.keyboard.press('f');assert.equal((await state()).turns,before.turns);await input('enter door');await drain();assert.equal((await state()).room,'meadow');assert.equal((await state()).heldItem,'gnomon');await page.keyboard.press('p');await page.waitForFunction(()=>!!document.fullscreenElement);await shot('remapped-fullscreen');await page.keyboard.press('p');await page.waitForFunction(()=>!document.fullscreenElement);receipts.push('held gnomon: observe then pass; F/G remap and P fullscreen agree with prompt');
 await page.keyboard.press('Escape');await page.click('#reset-bindings');await page.keyboard.press('Escape');
 for(const c of ['enter door','n','ne','take splinter','e'])await e.processInput(c);assert.equal(e.state.room,'bottom_of_stairs');await importSave(e,245,135);await hold('splinter');assert.equal(await page.locator('#hint').textContent(),'F · 通行');await input('u');await drain();assert.equal((await state()).room,'vertex');await move(218,234);await page.keyboard.down('a');await tick(12);await page.keyboard.up('a');assert.equal(await page.locator('#hint').textContent(),'F · 通行');await shot('held-splinter-descent');await input('d');await drain();assert.equal((await state()).room,'bottom_of_stairs');assert.equal((await state()).heldItem,'splinter');receipts.push('held splinter: F ascends and descends without clearing the hand');
 // Measure the synchronous canvas handler itself, excluding Playwright IPC and
 // animation duration. Keep receipts instead of a machine-dependent time gate.
 const pond=createPrologueSession();pond.moveTo(pond.state.room);for(const c of ['n','e'])await pond.processInput(c);await importSave(pond,235,242);
 await page.evaluate(()=>{const c=document.querySelector('canvas');c.addEventListener('pointerdown',()=>{window.__navStart=performance.now();},true);c.addEventListener('pointerdown',()=>{window.__navMillis=performance.now()-window.__navStart;});});
 const times=[];for(const [x,y]of [[394,40],[300,205],[240,240]]){await click(x,y);times.push(await page.evaluate(()=>window.__navMillis));}await move(394,40);await shot('pond-after-path');await click(240,240);await page.keyboard.down('a');await tick(35);await page.keyboard.up('a');assert.equal((await state()).navigation.path.length,0);receipts.push({case:'real canvas click handler milliseconds',times});
 // Chapter-specific help must survive import without retaining forest wording.
 await e.processInput('u');for(let i=0;e.state.sundialSymbol!==2&&i<7;i++)await e.processInput('turn ring');for(const c of ['d','ne','e','nw','e','s','n','in','in'])await e.processInput(c);assert.equal(e.state.chapter,'underground');await importSave(e,88,164);await page.keyboard.press('h');assert.match((await state()).hint,/通道/);assert.doesNotMatch((await state()).hint,/林间|符号环/);await shot('underground-help');await page.keyboard.press('f');
 const japan=createPrologueSession();japan.moveTo(japan.state.room);for(const c of [...road,'enter door','n','ne','take splinter','e','u'])await japan.processInput(c);for(let i=0;japan.state.sundialSymbol!==1&&i<7;i++)await japan.processInput('turn ring');for(const c of ['d','e','e','in'])await japan.processInput(c);assert.equal(japan.state.room,'playground');await importSave(japan,P.children.x,P.children.y+25);await hold('umbrella');assert.equal(await page.locator('#hint').textContent(),'F · 等候');await shot('children-wait');const turns=(await state()).turns;await input('wait');await drain();assert.equal((await state()).turns,turns+1);receipts.push('Japan children: held umbrella still shows F wait and commits exactly one wait turn');
 await page.setViewportSize({width:844,height:390});await page.keyboard.press('i');await page.getByRole('button',{name:'木片',exact:true}).click();await page.keyboard.press('Escape');await shot('mobile-controls');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.keyboard.press('Escape');
 assert.deepEqual(errors,[]);await writeFile(`${out}/result.json`,JSON.stringify({pass:true,receipts,errors},null,2));console.log('PASS response: held-item passages, shared F prompts, remap/fullscreen, real click timings, cancellation, chapter help and mobile');
}catch(error){await shot('failure').catch(()=>{});await writeFile(`${out}/failure.json`,JSON.stringify({message:error.message,state:await state().catch(()=>null),receipts,errors},null,2));throw error;}finally{await browser.close();}
