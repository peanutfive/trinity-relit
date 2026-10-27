import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createPrologueSession} from '../engine-adapter.js';
import {makeVisualSave,VISUAL_SAVE_KEY} from '../save.js';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const out=process.env.QA_OUTPUT||'/tmp/trinity-clock-browser';await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
const state=()=>page.evaluate(()=>JSON.parse(window.render_game_to_text()));
const tick=ms=>page.evaluate(ms=>window.advanceTime(ms),ms);
const shot=name=>page.screenshot({path:`${out}/${name}.png`,fullPage:true});
async function drain(){for(let i=0;i<100;i++){const s=await state();if(s.processing)await page.waitForTimeout(15);else if(s.dialogue)await page.keyboard.press('f');else if(s.narrative.busy)await page.click('#skip-event');else return;}throw Error('drain');}
async function key(k){await page.keyboard.press(k);await page.waitForTimeout(25);}
async function click(x,y){const b=await page.locator('canvas').boundingBox();await page.mouse.click(b.x+x/480*b.width,b.y+y/288*b.height);}
async function importSave(save){await page.keyboard.press('Escape');await page.getByRole('tab',{name:'探索进度'}).click();await page.locator('#save-file').setInputFiles({name:'clock.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(save))});await page.waitForFunction(room=>{const s=JSON.parse(window.render_game_to_text());return s.room===room&&s.mode!=='paused'&&!s.processing;},save.engine.state.room);await drain();}
const road=['e','take ball','nw','unscrew gnomon','take gnomon','n','take paper bird','open paper bird','w','buy crumbs','feed birds','take ruby','n','push pram','push pram','wait','throw ball at tree','take umbrella','push pram','open pram','enter pram','open umbrella'];
try{
 await page.goto(process.env.DEMO_URL||'http://127.0.0.1:8080/2d-demo/');await page.waitForFunction(()=>window.render_game_to_text&&JSON.parse(window.render_game_to_text()).art==='loaded');await page.click('#start');await drain();
 await key('t');let s=await state();assert.match(s.dialogue.text,/3:30:00/);assert.equal(s.storyClock.elapsed,0);await shot('watch-start');await drain();
 await key('r');await drain();assert.equal((await state()).storyClock.elapsed,60);
 await key('l');await drain();assert.equal((await state()).storyClock.elapsed,75);
 // Normal RAF movement and real waiting do not advance the story clock.
 await page.keyboard.down('d');await page.waitForTimeout(180);await page.keyboard.up('d');await page.waitForTimeout(350);assert.equal((await state()).storyClock.elapsed,75);
 await key('Escape');await tick(5000);assert.equal((await state()).storyClock.elapsed,75);await key('Escape');await key('m');await tick(5000);assert.equal((await state()).storyClock.elapsed,75);await key('m');
 const e=createPrologueSession();e.moveTo(e.state.room);for(const c of road)await e.processInput(c);
 const save=makeVisualSave(e,{room:e.state.room,x:191,y:239,face:'right',knowledge:{observed:[],paper:{observed:[],identified:[]}}});
 await importSave(save);s=await state();assert.equal(s.storyClock.elapsed,1785);assert.equal(s.storyClock.phase,0);assert.equal(s.objects.some(o=>o.kind==='door'),false);await key('t');assert.match((await state()).dialogue.text,/3:59:45/);await shot('watch-frozen');await drain();assert.equal((await state()).storyClock.phase,0);
 await key('f');await drain();s=await state();assert.equal(s.lastCommand,'enter water');assert.equal(s.room,'wading');assert.equal(s.storyClock.phase,1);assert.equal(s.objects.some(o=>o.kind==='door'),false);await shot('wading-before-door');
 await key('r');await drain();assert.equal((await state()).storyClock.phase,2);assert.ok((await state()).flags.includes('missile_visible'));assert.ok(!(await state()).flags.includes('white_door_visible'));
 await key('r');await drain();assert.equal((await state()).storyClock.phase,3);assert.ok((await state()).objects.some(o=>o.kind==='door'));await shot('door-revealed');
 const saved=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),VISUAL_SAVE_KEY);await page.reload();await page.waitForFunction(()=>window.render_game_to_text);await page.click('#continue-save');await drain();s=await state();assert.equal(s.storyClock.phase,3);assert.equal(s.storyClock.elapsed,1785);assert.equal(s.turns,saved.engine.state.turns);
 await click(250,240);for(let i=0;i<100&&(await state()).navigation.path.length;i++)await tick(100);await page.keyboard.down('d');await tick(15);await page.keyboard.up('d');await key('f');await drain();s=await state();assert.equal(s.lastCommand,'examine door');assert.equal(s.storyClock.phase,4);await key('f');await drain();assert.equal((await state()).room,'meadow');await key('t');assert.match((await state()).dialogue.text,/无规律地闪烁/);await shot('watch-wabe');await drain();
 // The same original arrival fixture verifies the finite window and live-save protection.
 await importSave(save);for(let i=0;i<7;i++){await key('r');await drain();}s=await state();assert.equal(s.dead,true);assert.equal(s.storyClock.phase,7);await shot('missed-window');const alive=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),VISUAL_SAVE_KEY);assert.equal(alive.engine.state.dead,false);assert.equal(alive.engine.state.counters.long_water_phase,6);
 assert.deepEqual(errors,[]);await writeFile(`${out}/result.json`,JSON.stringify({pass:true,T:true,R:true,L:true,normalRAF:true,pauseMap:true,freeze:true,window:true,restore:true,deathSave:true,errors},null,2));console.log('PASS original clock: T/R/L, RAF/pause/M, frozen watch, hidden/revealed door, F wading/escape, restore and finite danger window');
}catch(error){await shot('failure').catch(()=>{});await writeFile(`${out}/failure.json`,JSON.stringify({message:error.message,state:await state().catch(()=>null),errors},null,2));throw error;}finally{await browser.close();}
