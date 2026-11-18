// Legal engine fixtures enter through the normal save UI. No page state edits.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createPrologueSession} from '../engine-adapter.js';
import {makeVisualSave,VISUAL_SAVE_KEY} from '../save.js';
import {SCENES} from '../scene-manifest.js';
import {ROOMS} from '../../js/data/tundra.js';
import {ROAD_SAMPLES,F_APPROACH} from './tundra-road-samples.mjs';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const out=process.env.QA_OUTPUT||'/private/tmp/trinity-t26-browser';await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[],receipts=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
const state=()=>page.evaluate(()=>JSON.parse(window.render_game_to_text()));
const tick=ms=>page.evaluate(ms=>window.advanceTime(ms),ms);
const shot=name=>page.screenshot({path:`${out}/${name}.png`,fullPage:true});
async function drain(){for(let i=0;i<100;i++){const s=await state();if(s.processing)await page.waitForTimeout(20);else if(s.dialogue)await page.keyboard.press('f');else if(s.narrative.busy)await page.click('#skip-event');else return;}throw Error('drain');}
async function click(x,y){const b=await page.locator('canvas').boundingBox();await page.mouse.click(b.x+x/480*b.width,b.y+y/288*b.height);}
async function move(x,y){await drain();const room=(await state()).room;await click(x,y);for(let i=0;i<180;i++){const s=await state();assert.equal(s.room,room,'路中不能误切房');if(!s.navigation.path.length&&!s.processing){assert.ok(Math.hypot(s.player.x-x,s.player.y-y)<10,`missed ${x},${y}: ${s.player.x},${s.player.y}`);return;}await tick(80);}throw Error(`walk ${x},${y}`);}
async function hit(x,y,command,target){await drain();const before=await state();await click(x,y);for(let i=0;i<180;i++){const s=await state();if(!s.processing&&s.lastCommand===command&&(target?s.room===target:s.turns>before.turns)){await drain();return;}await tick(80);}throw Error(`art hit ${before.room}: ${command} → ${target||'same room'}`);}
async function F(command){await page.keyboard.press('f');await page.waitForFunction(c=>{const s=JSON.parse(window.render_game_to_text());return s.lastCommand===c&&!s.processing;},command);}
async function face(key){await page.keyboard.down(key);await tick(12);await page.keyboard.up(key);}
async function importSave(save){await drain();await page.keyboard.press('Escape');await page.getByRole('tab',{name:'探索进度'}).click();await page.locator('#save-file').setInputFiles({name:'tundra.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(save))});await page.waitForFunction(room=>{const s=JSON.parse(window.render_game_to_text());return s.room===room&&!s.processing&&s.mode!=='paused';},save.engine.state.room);await drain();}
async function road(target,points,keys){await drain();const from=(await state()).room;for(const p of points)await move(...p);await tick(600);for(const k of keys)await page.keyboard.down(k);for(let i=0;i<65&&(await state()).room===from;i++)await tick(70);for(const k of keys)await page.keyboard.up(k);for(let i=0;i<40&&(await state()).processing;i++)await page.waitForTimeout(20);assert.equal((await state()).room,target,`${from}→${target}`);receipts.push({from,target,kind:'keyboard',arrival:(await state()).navigation.arrival});await drain();}
const e=createPrologueSession(),fixtures={};e.moveTo(e.state.room);
function capture(){if(SCENES[e.state.room]){const room=e.state.room,[x,y]=SCENES[room].spawn;fixtures[room]=makeVisualSave(e,{room,x,y,face:'up'});}}
async function run(commands){for(const c of commands){await e.processInput(c);assert.equal(e.state.dead,false,c);capture();}}
await run(['e','take ball','nw','unscrew gnomon','take gnomon','n','take paper bird','open paper bird','w','buy crumbs','feed birds','take ruby','n','push pram','push pram','wait','throw ball at tree','take umbrella','push pram','open pram','enter pram','open umbrella','take paper bird','take gnomon','enter water','enter door','e','u']);
while(e.state.sundialSymbol!==5)await run(['turn ring']);
await run(['d','ne','e','nw','e','e']);assert.equal(e.state.room,'herb_garden');
await run(['in','n','n','e','e','s','s','w','n','u','n','s','d','sw']);
assert.equal(Object.keys(fixtures).filter(id=>SCENES[id].chapter==='tundra').length,11);
try{
 await page.goto(process.env.DEMO_URL||'http://127.0.0.1:8080/2d-demo/?reviewRoutes=1');await page.waitForFunction(()=>window.render_game_to_text&&JSON.parse(window.render_game_to_text()).art==='loaded');await page.click('#start');await drain();
 await importSave(fixtures.herb_garden);await hit(365,120,'look');await hit(365,120,'in','tundra_1');assert.equal((await state()).navigation.arrival.matched,true);
 for(const room of Object.keys(ROOMS)){await importSave(fixtures[room]);await page.waitForFunction(()=>JSON.parse(window.render_game_to_text()).tundraSprites==='loaded');await shot(room);}
 await page.waitForTimeout(500);await shot('normal-raf');
 await page.evaluate(()=>{window.requestAnimationFrame=()=>0;});await page.waitForTimeout(25);
 // Room-local exit sensors are checked through actual movement/F. Text arrows
 // and their click targets stay hidden throughout. Screenshots review the art.
 for(const room of Object.keys(ROOMS)){
  const entries=SCENES[room].exits;
  for(const exit of entries){
   await importSave(fixtures[room]);const from=room;
   if(exit.interactionOnly){
    const [stand,key]=F_APPROACH[room][exit.dir];await move(...stand);await face(key);const target=(await state()).objects.find(o=>o.actions?.some(a=>a.command===exit.dir));assert.ok(target,`${room}.${exit.dir} F target`);
    // Standing on the authored threshold gives an unambiguous F intention.
    await F(exit.dir);await page.waitForFunction(to=>JSON.parse(window.render_game_to_text()).room===to,exit.target);await drain();
    receipts.push({from,target:exit.target,kind:'F-passage',command:exit.dir,arrival:(await state()).navigation.arrival});
   }else{
    const sample=ROAD_SAMPLES[room]?.[exit.dir];assert.ok(sample,`${room}.${exit.dir} needs an independent painting sample`);
    await road(exit.target,...sample);
   }
   assert.equal((await state()).room,exit.target);
  }
 }
 assert.equal(receipts.length,45,'all new current room directions exercised');
 await importSave(fixtures.cliff_edge);const hidden=(await state()).objects.find(o=>o.itemId==='lemming');assert.ok(hidden&&hidden.visual===false);assert.ok(!(await state()).dialogue?.text.includes('旅鼠'));await shot('before-fissure');
 const fissure=(await state()).objects.find(o=>o.kind==='tundra_fissure');await move(fissure.x,fissure.y);await F('examine fissure');await drain();const mouse=(await state()).objects.find(o=>o.itemId==='lemming');assert.equal(mouse.visual,true);await shot('mouse-discovered');
 await move(mouse.x,mouse.y+12);await face('w');await F('examine lemming');await drain();await F('take lemming');await drain();assert.ok((await state()).inventory.includes('lemming'));assert.ok(!(await state()).objects.some(o=>o.itemId==='lemming'));await shot('mouse-taken');
 await page.keyboard.press('i');await page.getByRole('button',{name:'旅鼠',exact:true}).click();await page.keyboard.press('i');await page.click('#inventory-drop');await drain();assert.equal((await state()).objects.filter(o=>o.itemId==='lemming'&&o.visual!==false).length,1);await shot('mouse-dropped');
 const turns=(await state()).turns;await page.keyboard.press('m');assert.equal((await state()).map.nodes,11);await tick(60000);assert.equal((await state()).turns,turns);await shot('chapter-map');await page.setViewportSize({width:844,height:390});await shot('phone-map');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.keyboard.press('m');await shot('phone-game');await page.setViewportSize({width:1440,height:900});
 const saved=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),VISUAL_SAVE_KEY);await page.reload();await page.waitForFunction(()=>window.render_game_to_text&&JSON.parse(window.render_game_to_text()).art==='loaded');await page.click('#continue-save');await drain();assert.equal((await state()).room,saved.engine.state.room);assert.equal((await state()).turns,saved.engine.state.turns);assert.equal((await state()).objects.filter(o=>o.itemId==='lemming'&&o.visual!==false).length,1);await shot('restored-cliff');
 await importSave(fixtures.tundra_1);await page.keyboard.press('i');await page.getByRole('button',{name:'日晷指针',exact:true}).click();await page.keyboard.press('i');await move(135,216);await face('a');await F('out');await drain();assert.equal((await state()).room,'herb_garden');assert.equal((await state()).navigation.arrival.entrance,'in');await shot('returned-herbs-held');
 assert.deepEqual(errors,[]);await writeFile(`${out}/result.json`,JSON.stringify({pass:true,receipts,discovery:true,stableMouse:true,map:true,restore:true,heldPassage:true,errors},null,2));console.log(`PASS Tundra: ${receipts.length} actual keyboard/F exits, discovery, mouse, map/phone/restore and held return; no errors`);
}catch(error){await shot('failure').catch(()=>{});await writeFile(`${out}/failure.json`,JSON.stringify({message:error.message,state:await state().catch(()=>null),receipts,errors},null,2));throw error;}finally{await browser.close();}
