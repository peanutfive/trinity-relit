// Legal engine fixtures enter through the normal save UI. No page state edits.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createPrologueSession} from '../engine-adapter.js';
import {makeVisualSave,VISUAL_SAVE_KEY} from '../save.js';
import {SCENES} from '../scene-manifest.js';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const out=process.env.QA_OUTPUT||'/private/tmp/trinity-t25-browser';await mkdir(out,{recursive:true});
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
async function importSave(save){await drain();await page.keyboard.press('Escape');await page.getByRole('tab',{name:'探索进度'}).click();await page.locator('#save-file').setInputFiles({name:'pacific.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(save))});await page.waitForFunction(room=>{const s=JSON.parse(window.render_game_to_text());return s.room===room&&!s.processing&&s.mode!=='paused';},save.engine.state.room);await drain();}
async function road(target,points,keys){await drain();const from=(await state()).room;for(const p of points)await move(...p);await tick(600);for(const k of keys)await page.keyboard.down(k);for(let i=0;i<65&&(await state()).room===from;i++)await tick(70);for(const k of keys)await page.keyboard.up(k);for(let i=0;i<40&&(await state()).processing;i++)await page.waitForTimeout(20);assert.equal((await state()).room,target,`${from}→${target}`);receipts.push({from,target,kind:'keyboard',arrival:(await state()).navigation.arrival});await drain();}
const e=createPrologueSession(),fixtures={};e.moveTo(e.state.room);
function capture(){if(SCENES[e.state.room]){const room=e.state.room,[x,y]=SCENES[room].spawn;fixtures[room]=makeVisualSave(e,{room,x,y,face:'up'});}}
async function run(commands){for(const c of commands){await e.processInput(c);assert.equal(e.state.dead,false,c);capture();}}
await run(['e','take ball','nw','unscrew gnomon','take gnomon','n','take paper bird','open paper bird','w','buy crumbs','feed birds','take ruby','n','push pram','push pram','wait','throw ball at tree','take umbrella','push pram','open pram','enter pram','open umbrella','take paper bird','take gnomon','enter water','enter door','e','u']);
while(e.state.sundialSymbol!==4)await run(['turn ring']);
await run(['d','w','ne']);capture();await run(['in','s','d','u','n','e','s','w']);
assert.equal(Object.keys(fixtures).filter(id=>SCENES[id].chapter==='pacific').length,7);
// Samples are picked from visible doors and beaches, independently of hitboxes.
const passages={
 mesa:[['s','scaffold',[223,91]],['out','chasms_brink',[240,180]]],
 scaffold:[['u','mesa',[163,70]],['d','bottom_scaffold',[310,150]],['n','north_beach',[241,63]],['s','south_beach',[242,246]],['w','west_beach',[17,95]],['e','east_beach',[465,95]]],
 bottom_scaffold:[['u','scaffold',[244,95]],['s','south_beach',[340,95]],['nw','west_beach',[48,65]]],
 north_beach:[['s','scaffold',[325,247]]],
 west_beach:[['e','scaffold',[443,101]]],
 east_beach:[['w','scaffold',[40,108]]],
 south_beach:[['n','scaffold',[195,55]],['in','bottom_scaffold',[332,96]]],
};
const routes={
 north_beach:[['west_beach',[[170,161],[85,150],[40,155]],['a']],['east_beach',[[320,160],[405,152],[443,153]],['d']]],
 west_beach:[['north_beach',[[243,140],[235,75],[235,38]],['w']],['south_beach',[[340,180],[395,193],[438,215],[460,249]],['s']]],
 east_beach:[['north_beach',[[263,145],[255,75],[248,38]],['w']],['south_beach',[[255,228],[240,260]],['s']]],
 south_beach:[['west_beach',[[150,155],[70,155],[39,163]],['a']],['east_beach',[[335,164],[405,178],[442,190]],['d']]],
};
try{
 await page.goto(process.env.DEMO_URL||'http://127.0.0.1:8080/2d-demo/?reviewRoutes=1');await page.waitForFunction(()=>window.render_game_to_text&&JSON.parse(window.render_game_to_text()).art==='loaded');await page.click('#start');await drain();
 await importSave(fixtures.chasms_brink);await hit(276,29,'examine toadstool');await hit(276,29,'in','mesa');assert.equal((await state()).navigation.arrival.matched,true);
 for(const room of Object.keys(passages)){await importSave(fixtures[room]);await page.waitForFunction(()=>JSON.parse(window.render_game_to_text()).pacificSprites==='loaded');await shot(room);}
 // Normal RAF stays active during first visual review; deterministic road bursts follow.
 await page.evaluate(()=>{window.requestAnimationFrame=()=>0;});await page.waitForTimeout(25);
 for(const [room,entries]of Object.entries(passages))for(const [command,target,pixel]of entries){await importSave(fixtures[room]);await hit(...pixel,command,target);receipts.push({from:room,target,kind:'painted-passage',command,arrival:(await state()).navigation.arrival});}
 for(const [room,entries]of Object.entries(routes))for(const [target,points,keys]of entries){await importSave(fixtures[room]);await road(target,points,keys);}
 await importSave(fixtures.bottom_scaffold);await page.keyboard.press('i');await page.getByRole('button',{name:'日晷指针',exact:true}).click();await page.keyboard.press('i');assert.equal((await state()).heldItem,'gnomon');await move(291,146);await face('w');await F('look');await drain();await shot('held-box-before-open');await F('open box');await drain();await shot('box-open');
 await move(279,142);await face('w');await F('push switch');await drain();assert.equal((await state()).pacific.timerTurns,6);await shot('switch-pressed');
 const active=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),VISUAL_SAVE_KEY);
 for(const key of ['m','Escape']){await page.keyboard.press(key);const turns=(await state()).turns;await tick(5000);assert.equal((await state()).turns,turns);assert.equal((await state()).pacific.timerTurns,6);await shot(key==='m'?'active-map':'active-pause');await page.keyboard.press(key);}
 await page.reload();await page.waitForFunction(()=>window.render_game_to_text&&JSON.parse(window.render_game_to_text()).art==='loaded');await page.click('#continue-save');await drain();assert.equal((await state()).pacific.timerTurns,6);assert.equal((await state()).turns,active.engine.state.turns);await shot('timer-restored');
 await move(304,142);await face('w');await F('push button');await drain();assert.equal((await state()).pacific.buttonPressed,true);assert.equal((await state()).pacific.timerTurns,null);await shot('button-pressed');
 await importSave(active);await page.evaluate(()=>{window.requestAnimationFrame=()=>0;});await page.waitForTimeout(25);
 for(let i=0;i<6;i++){await page.keyboard.press('r');await drain();}
 assert.equal((await state()).pacific.expired,true);assert.equal((await state()).dead,false);await move(304,142);await face('w');await F('push button');await drain();assert.equal((await state()).pacific.buttonPressed,false);await shot('timer-expired');
 await importSave(fixtures.east_beach);const coconut=(await state()).objects.find(o=>o.itemId==='coconut');assert.ok(coconut);await hit(295,179,'examine coconut');await hit(295,179,'take coconut');assert.ok((await state()).inventory.includes('coconut'));await shot('coconut-taken');
 await page.keyboard.press('i');await page.getByRole('button',{name:'椰子',exact:true}).click();await page.keyboard.press('i');await page.click('#inventory-drop');await drain();assert.equal((await state()).objects.filter(o=>o.itemId==='coconut').length,1);
 await page.keyboard.press('m');assert.equal((await state()).map.chapter,'pacific');await shot('chapter-map');await page.setViewportSize({width:844,height:390});await shot('phone-map');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.keyboard.press('m');await shot('phone-game');
 assert.deepEqual(errors,[]);await writeFile(`${out}/result.json`,JSON.stringify({pass:true,receipts,box:true,timerBothBranches:true,timerRestore:true,coconut:true,map:true,errors},null,2));console.log(`PASS Pacific: ${receipts.length} painted passages/keyboard roads, box, timer both branches/restore, coconut and map; no errors`);
}catch(error){await shot('failure').catch(()=>{});await writeFile(`${out}/failure.json`,JSON.stringify({message:error.message,state:await state().catch(()=>null),receipts,errors},null,2));throw error;}finally{await browser.close();}
