import { fitGnomonFixture, lockProjectionFixture } from './browser-vertex-gnomon.mjs';
// UI-imported legal play fixtures; all rendered travel uses F, actual ground,
// keyboard edges and hidden labels rather than executing game commands in-page.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createPrologueSession} from '../engine-adapter.js';
import {makeVisualSave,VISUAL_SAVE_KEY} from '../save.js';
import {SCENES} from '../scene-manifest.js';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const out=process.env.QA_OUTPUT||'/tmp/trinity-arbor-orbit-browser';await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[],receipts=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
const state=()=>page.evaluate(()=>JSON.parse(window.render_game_to_text()));
const tick=ms=>page.evaluate(ms=>window.advanceTime(ms),ms);
const shot=name=>page.screenshot({path:`${out}/${name}.png`,fullPage:true});
async function closeText(){for(let i=0;i<80&&(await state()).dialogue;i++)await page.keyboard.press('f');}
async function drain(){for(let i=0;i<100;i++){const s=await state();if(s.processing)await page.waitForTimeout(20);else if(s.dialogue)await page.keyboard.press('f');else if(s.narrative.busy)await tick(110);else return;}throw Error('drain');}
async function click(x,y){const b=await page.locator('canvas').boundingBox();await page.mouse.click(b.x+x/480*b.width,b.y+y/288*b.height);}
async function move(x,y){await drain();const from=(await state()).room;await click(x,y);for(let i=0;i<180;i++){const s=await state();assert.equal(s.room,from,'中间路点不应触发其他出口');if(!s.navigation.path.length&&!s.processing){assert.ok(Math.hypot(s.player.x-x,s.player.y-y)<10,`walk missed ${x},${y}, actual ${s.player.x},${s.player.y}`);return;}await tick(90);}throw Error(`walk ${x},${y}`);}
async function face(key){await page.keyboard.down(key);await tick(12);await page.keyboard.up(key);}
async function F(command){await page.keyboard.press('f');await page.waitForFunction(c=>{const s=JSON.parse(window.render_game_to_text());return s.lastCommand===c&&!s.processing;},command,{timeout:8000});}
async function travel(target,points,keys){await drain();const from=(await state()).room;for(const p of points)await move(...p);await tick(600);for(const k of keys)await page.keyboard.down(k);for(let i=0;i<65&&(await state()).room===from;i++)await tick(70);for(const k of keys)await page.keyboard.up(k);for(let i=0;i<40&&(await state()).processing;i++)await page.waitForTimeout(20);assert.equal((await state()).room,target,`${from}→${target}`);receipts.push({from,target,keys,arrival:(await state()).navigation.arrival});await drain();}
async function clickExit(dir,target){
  const before=await state();
  const exit=before.exits.find(value=>value.dir===dir&&value.target===target);
  assert.ok(exit,`${before.room} ${dir} to ${target}`);
  await tick(550);
  await click(exit.x,exit.y);
  return before.room;
}
async function travelExit(dir,target){
  await drain();
  const from=await clickExit(dir,target);
  for(let i=0;i<160&&(await state()).room===from;i++)await tick(75);
  await drain();
  const after=await state();
  assert.equal(after.room,target,`${from}→${target}`);
  receipts.push({from,target,dir,input:'pointer',arrival:after.navigation.arrival});
}
async function importSave(save){await drain();await page.keyboard.press('Escape');await page.getByRole('tab',{name:'探索进度'}).click();await page.locator('#save-file').setInputFiles({name:'arbor-orbit.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(save))});await page.waitForFunction(room=>{const s=JSON.parse(window.render_game_to_text());return s.room===room&&s.mode!=='paused'&&!s.processing;},save.engine.state.room);await drain();}
async function hold(name){await page.keyboard.press('i');await page.getByRole('button',{name,exact:true}).click();}
const road=['e','take ball','nw','unscrew gnomon','take gnomon','n','take paper bird','open paper bird','w','buy crumbs','feed birds','take ruby','n','push pram','push pram','wait','throw ball at tree','take umbrella','push pram','open pram','enter pram','open umbrella','take paper bird','take gnomon','enter water','enter door','n','ne','move log','take splinter','e','s'];
const e=createPrologueSession(),fixtures={};e.moveTo(e.state.room);
const capture=name=>{const room=e.state.room,[x,y]=SCENES[room].spawn;fixtures[name||room]=makeVisualSave(e,{room,x,y,face:'up'});};
async function cmds(commands){for(const c of commands){await e.processInput(c);assert.equal(e.state.dead,false,c);if(SCENES[e.state.room])capture();}}
await cmds(road);capture('trellises-start');
await cmds(['se','w','n','u','take axe','s','d']);capture('arboretum-flipped');
await cmds(['s','u','n','d']);capture('arboretum-normal');
await cmds(['w','ne','nw','w']);capture('waterfall-closed');await cmds(['e','e','u']);await fitGnomonFixture(e);await lockProjectionFixture(e,'second');await cmds(['d','ne','e','nw','e','take soap bubble','w','se','sw','w','w','w']);capture('waterfall-ready');await cmds(['in']);capture('satellite-ready');await cmds(['u']);capture('space-ready');await cmds(['d','out','se','n','n']);
try{
 await page.goto(process.env.DEMO_URL||'http://127.0.0.1:8080/2d-demo/?reviewRoutes=1');await page.waitForFunction(()=>window.render_game_to_text&&JSON.parse(window.render_game_to_text()).art==='loaded'&&JSON.parse(window.render_game_to_text()).arborOrbitSprites==='loaded');
 assert.deepEqual((await state()).backgrounds,['./assets/gardens-hd2d.png'],'开局不请求所有章节背景');await page.click('#start');await drain();
 await importSave(fixtures['trellises-start']);await shot('trellises-seven-routes');
 await travelExit('se','arborvitaes_n');await travelExit('w','arboretum');await travelExit('n','north_arbor');
 // First climb uses normal RAF rather than virtual time.
 await clickExit('u','top_of_arbor');
 await page.waitForFunction(()=>{
   const s=JSON.parse(window.render_game_to_text());
   return s.room==='top_of_arbor'&&!s.processing;
 });
 await closeText();assert.equal((await state()).narrative.currentEvent,'cliff_passage');await page.waitForTimeout(300);await shot('climb-normal-raf');await page.keyboard.press('Escape');const paused=(await state()).narrative.elapsed;await tick(1000);assert.equal((await state()).narrative.elapsed,paused);await page.keyboard.press('Escape');await drain();await shot('top-with-axe');
 await page.evaluate(()=>{window.requestAnimationFrame=()=>0;});await page.waitForTimeout(30);
 const axe=(await state()).objects.find(object=>object.itemId==='axe');
 assert.ok(axe);
 await move(axe.x,axe.y);await face('d');await F('examine axe');await drain();await F('take axe');await drain();assert.ok((await state()).inventory.includes('axe'));assert.ok(!(await state()).objects.some(o=>o.itemId==='axe'));await shot('axe-removed');
 await travelExit('s','south_arbor');assert.equal((await state()).flipped,false);await shot('south-arbor-slope');
 await travelExit('d','arboretum');assert.equal((await state()).flipped,true);
 await travelExit('s','south_arbor');await travelExit('u','top_of_arbor');
 await travelExit('n','north_arbor');assert.equal((await state()).flipped,true);await shot('north-arbor-slope');
 await travelExit('d','arboretum');assert.equal((await state()).flipped,false);
 // Independently sampled painted route centerlines. Destinations retain the
 // chapter's compass labels even when the local trail bends at the frame.
 const routes={
 trellises:[['bottom_of_stairs',[[240,95],[240,38]],['w']],['the_bend',[[325,117],[394,60],[425,29]],['d','w']],['arborvitaes_n',[[324,189],[406,240],[443,265]],['d','s']],['arborvitaes_s',[[174,184],[99,228],[44,265]],['a','s']],['forest_clearing',[[120,146],[43,146]],['a']],['south_bog',[[151,117],[75,58],[50,28]],['a','w']]],
 south_bog:[['north_bog',[[242,80],[240,38]],['w']],['bottom_of_stairs',[[350,164],[420,153],[442,150]],['d']],['trellises',[[307,201],[360,241],[403,266]],['d','s']],['forest_clearing',[[237,221],[237,252]],['s']],['waterfall',[[120,142],[43,136]],['a']]],
 north_bog:[['bottom_of_stairs',[[360,215],[442,231]],['d']],['south_bog',[[240,227],[240,253]],['s']],['waterfall',[[151,213],[70,258],[47,269]],['a','s']]],
 forest_clearing:[['south_bog',[[247,100],[249,38]],['w']],['bottom_of_stairs',[[317,110],[360,70],[401,32]],['d','w']],['trellises',[[350,167],[440,149]],['d']],['waterfall',[[180,100],[120,70],[87,30]],['a','w']]],
 arborvitaes_n:[['trellises',[[250,150],[185,115],[130,70],[106,32]],['a','w']],['arboretum',[[140,180],[44,174]],['a']]],
 arborvitaes_s:[['trellises',[[218,161],[220,132],[261,95],[304,60],[313,35]],['w']],['arboretum',[[365,177],[441,174]],['d']]],
 waterfall:[['north_bog',[[360,105],[352,36]],['w']],['south_bog',[[405,151],[442,147]],['d']],['forest_clearing',[[350,220],[378,255]],['d','s']]],
 };
 for(const [room,tests]of Object.entries(routes))for(const [target,points,keys]of tests){await importSave(fixtures[room]);await travel(target,points,keys);}
 for(const flipped of [false,true])for(const [key,target]of [['d','arborvitaes_n'],['a','arborvitaes_s']]){await importSave(fixtures[flipped?'arboretum-flipped':'arboretum-normal']);assert.equal((await state()).flipped,flipped);await shot(`arboretum-${flipped?'flipped':'normal'}`);await travel(target,[[key==='d'?440:40,185]],[key]);}
 await importSave(fixtures['waterfall-closed']);await move(350,200);await face('w');await F('look');await drain();await F('in');await drain();assert.equal((await state()).room,'waterfall');await shot('waterfall-closed');
 await importSave(fixtures['waterfall-ready']);await move(350,200);await face('w');await F('look');await drain();await F('in');await closeText();assert.equal((await state()).chapter,'orbit');await tick(150);await shot('waterfall-entry');await drain();await shot('orbit-satellite');assert.equal((await state()).player.animation.airborne,true);
 await travel('orbit_space',[[420,155]],['d']);await shot('orbit-space');
 const saved=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),VISUAL_SAVE_KEY);await page.reload();await page.waitForFunction(()=>window.render_game_to_text&&JSON.parse(window.render_game_to_text()).art==='loaded');await page.click('#continue-save');await drain();assert.equal((await state()).room,'orbit_space');assert.equal((await state()).turns,saved.engine.state.turns);assert.equal((await state()).narrative.currentEvent,null);await shot('orbit-restored');await page.evaluate(()=>{window.requestAnimationFrame=()=>0;});
 await page.keyboard.press('m');assert.equal((await state()).map.chapter,'orbit');const turns=(await state()).turns;await tick(1000);assert.equal((await state()).turns,turns);await shot('orbit-map');await page.setViewportSize({width:844,height:390});await shot('orbit-map-phone');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.keyboard.press('m');await page.setViewportSize({width:1440,height:900});
 await travel('orbit_satellite',[[240,55]],['w']);await hold('斧头');await F('break bubble with axe');await closeText();assert.equal((await state()).narrative.currentEvent,'orbit_return');await tick(350);await shot('bubble-burst');await page.keyboard.press('Escape');const elapsed=(await state()).narrative.elapsed;await tick(900);assert.equal((await state()).narrative.elapsed,elapsed);await page.keyboard.press('Escape');await drain();assert.equal((await state()).room,'waterfall');assert.ok(!(await state()).inventory.includes('soap_bubble'));assert.ok((await state()).inventory.includes('axe'));await shot('waterfall-return');
 assert.deepEqual(errors,[]);await writeFile(`${out}/result.json`,JSON.stringify({pass:true,receipts,normalRAF:true,F:true,flipped:true,lazyBackgrounds:true,restore:true,map:true,errors},null,2));console.log(`PASS arbor/orbit: ${receipts.length} real keyboard routes, F axe/bubble, flipping, pause, maps, refresh and lazy plates; no errors`);
}catch(error){await shot('failure').catch(()=>{});await writeFile(`${out}/failure.json`,JSON.stringify({message:error.message,state:await state().catch(()=>null),receipts,errors},null,2));throw error;}finally{await browser.close();}
