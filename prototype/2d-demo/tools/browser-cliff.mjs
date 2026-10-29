// Legal engine route creates a fixture; imports use the normal save UI. Every
// subsequent room transition uses visible ground and real keyboard/F input.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createPrologueSession} from '../engine-adapter.js';
import {makeVisualSave,VISUAL_SAVE_KEY} from '../save.js';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const out=process.env.QA_OUTPUT||'/tmp/trinity-cliff-browser';await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[],receipts=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
const state=()=>page.evaluate(()=>JSON.parse(window.render_game_to_text()));
const tick=ms=>page.evaluate(ms=>window.advanceTime(ms),ms);
const shot=name=>page.screenshot({path:`${out}/${name}.png`,fullPage:true});
async function closeText(){for(let i=0;i<80&&(await state()).dialogue;i++)await page.keyboard.press('f');}
async function drain(){for(let i=0;i<100;i++){const s=await state();if(s.processing)await page.waitForTimeout(15);else if(s.dialogue)await page.keyboard.press('f');else if(s.narrative.busy)await page.click('#skip-event');else return;}throw Error('drain');}
async function click(x,y){const b=await page.locator('canvas').boundingBox();await page.mouse.click(b.x+x/480*b.width,b.y+y/288*b.height);}
async function move(x,y){await drain();const from=(await state()).room;await click(x,y);for(let i=0;i<150;i++){const s=await state();assert.equal(s.room,from,'中间路点不应触发其他出口');if(!s.navigation.path.length&&!s.processing)return;await tick(100);}throw Error(`walk ${x},${y}`);}
async function face(key){await page.keyboard.down(key);await tick(12);await page.keyboard.up(key);}
async function F(command){await page.keyboard.press('f');await page.waitForFunction(c=>{const s=JSON.parse(window.render_game_to_text());return s.lastCommand===c&&!s.processing;},command,{timeout:5000});}
async function travel(target,points,keys){
 await drain();const from=(await state()).room;for(const p of points)await move(...p);await tick(600);
 for(const k of keys)await page.keyboard.down(k);
 for(let i=0;i<45&&(await state()).room===from;i++)await tick(70);
 for(const k of keys)await page.keyboard.up(k);
 assert.equal((await state()).room,target,`${from}→${target}`);receipts.push({from,target,keys});await drain();
}
async function importSave(save){await page.keyboard.press('Escape');await page.getByRole('tab',{name:'探索进度'}).click();await page.locator('#save-file').setInputFiles({name:'cliff.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(save))});await page.waitForFunction(room=>{const s=JSON.parse(window.render_game_to_text());return s.room===room&&s.mode!=='paused'&&!s.processing;},save.engine.state.room);await drain();}
const road=['e','take ball','nw','unscrew gnomon','take gnomon','n','take paper bird','open paper bird','w','buy crumbs','feed birds','take ruby','n','push pram','push pram','wait','throw ball at tree','take umbrella','push pram','open pram','enter pram','open umbrella','take paper bird','take gnomon','enter water','enter door','n','ne','e'];
try{
 await page.goto(process.env.DEMO_URL||'http://127.0.0.1:8080/2d-demo/?reviewRoutes=1');await page.waitForFunction(()=>window.render_game_to_text&&JSON.parse(window.render_game_to_text()).art==='loaded'&&JSON.parse(window.render_game_to_text()).cliffSprites==='loaded');await page.click('#start');await drain();
 const e=createPrologueSession();e.moveTo(e.state.room);for(const c of road)await e.processInput(c);assert.equal(e.state.room,'bottom_of_stairs');
 await importSave(makeVisualSave(e,{room:e.state.room,x:450,y:64,face:'up'}));await shot('stairs-eight-roads');
 // First transition runs on ordinary RAF, with the text arrows hidden.
 await click(448,38);await page.waitForTimeout(600);await page.keyboard.down('w');await page.waitForTimeout(550);await page.keyboard.up('w');await drain();assert.equal((await state()).room,'under_cliff');receipts.push({from:'bottom_of_stairs',target:'under_cliff',normalRAF:true});await shot('under-cliff-entry');
 await page.evaluate(()=>{const raf=requestAnimationFrame.bind(window);let next;window.requestAnimationFrame=f=>{next=f;return 0;};window.__resumeRAF=()=>{window.requestAnimationFrame=raf;if(next)raf(next);};});await page.waitForTimeout(40);
 await move(322,183);await face('w');await F('examine hive');await shot('hive-observation');await drain();await move(364,179);await face('w');await F('examine bees');await drain();
 await move(240,140);await face('w');await F('in');await closeText();let s=await state();assert.equal(s.room,'ice_cavern');assert.equal(s.narrative.currentEvent,'cliff_passage');const turns=s.turns;await tick(180);await shot('cave-entry-motion');
 await page.keyboard.press('Escape');const elapsed=(await state()).narrative.elapsed;await tick(1200);assert.equal((await state()).narrative.elapsed,elapsed);await page.keyboard.press('Escape');await tick(2500);await drain();assert.equal((await state()).turns,turns);await shot('ice-cavern');
 await move(246,179);await face('w');await F('examine icicles');await drain();assert.ok(!(await state()).inventory.includes('icicle'));
 await move(68,154);await face('a');await F('out');await drain();assert.equal((await state()).room,'under_cliff');
 await travel('craters_edge',[[241,186],[365,170],[437,157]],['d']);await shot('crater-edge');await move(270,216);await face('w');await F('examine crater');await drain();
 await move(315,176);await face('w');await F('d');await closeText();s=await state();assert.equal(s.narrative.currentEvent,'cliff_passage');assert.equal(s.narrative.sceneRoom,'craters_edge');await tick(200);await shot('descent-motion');await tick(2500);await drain();assert.equal((await state()).room,'crater');
 await move(260,222);await face('d');await F('examine lump');await shot('hot-metal');await drain();s=await state();assert.ok(!s.inventory.includes('lump'));assert.equal(s.objects.filter(o=>o.itemId==='lump').length,1);
 const saved=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),VISUAL_SAVE_KEY);await page.reload();await page.waitForFunction(()=>window.render_game_to_text&&JSON.parse(window.render_game_to_text()).art==='loaded');await page.click('#continue-save');await drain();s=await state();assert.equal(s.turns,saved.engine.state.turns);assert.equal(s.room,'crater');assert.equal(s.narrative.currentEvent,null);assert.equal(s.objects.filter(o=>o.itemId==='lump').length,1);await shot('crater-restored');
 await page.keyboard.press('m');s=await state();const mapTurns=s.turns;assert.equal(s.map.chapter,'wabe');assert.ok(await page.locator('[data-room-id="crater"]').count());assert.equal(await page.locator('[data-room-id="bluff"]').count(),0);await shot('cliff-map');await tick(1000);assert.equal((await state()).turns,mapTurns);await page.keyboard.press('m');
 // Resume deterministic samples after reload.
 await page.evaluate(()=>{window.requestAnimationFrame=()=>0;});
 await page.keyboard.press('i');await page.getByRole('button',{name:'雨伞',exact:true}).click();await move(77,61);await face('w');await F('u');await drain();assert.equal((await state()).room,'craters_edge');assert.equal((await state()).heldItem,'umbrella');await page.click('#clear-hand');
 await travel('under_cliff',[[223,219],[120,157],[47,118]],['a']);await travel('moor',[[241,186],[353,227],[431,258]],['d','s']);assert.equal((await state()).navigation.arrival.entrance,'nw');
 await travel('craters_edge',[[238,130],[248,48]],['w']);await travel('the_bend',[[125,168],[46,214]],['a','s']);
 await travel('under_cliff',[[233,139],[238,47]],['w']);await travel('the_bend',[[241,186],[234,243]],['s']);await travel('under_cliff',[[233,139],[238,47]],['w']);await travel('bottom_of_stairs',[[241,186],[101,228],[49,258]],['a','s']);assert.equal((await state()).navigation.arrival.entrance,'ne');await shot('stairs-return-ne');
 await page.setViewportSize({width:844,height:390});await page.keyboard.press('m');await shot('cliff-map-mobile');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.keyboard.press('m');
 assert.deepEqual(errors,[]);await writeFile(`${out}/result.json`,JSON.stringify({pass:true,receipts,F:true,restore:true,pause:true,map:true,arrowsHidden:true,errors},null,2));console.log('PASS cliff region: painted keyboard routes, F cave/ramp/objects, grounded transitions, pause, M, live restore and mobile map; no errors');
}catch(error){await shot('failure').catch(()=>{});await writeFile(`${out}/failure.json`,JSON.stringify({message:error.message,state:await state().catch(()=>null),receipts,errors},null,2));throw error;}finally{await browser.close();}
