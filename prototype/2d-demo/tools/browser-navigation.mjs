// Real keyboard regressions for painted routes, exit direction and room arrivals.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const artifacts=process.env.QA_OUTPUT||'/tmp/trinity-navigation-qa';await mkdir(artifacts,{recursive:true});
import {createPrologueSession} from '../engine-adapter.js';
import {makeVisualSave} from '../save.js';
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1280,height:1000}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
await page.goto(process.env.DEMO_URL||'http://127.0.0.1:8080/2d-demo/');await page.waitForFunction(()=>window.render_game_to_text&&JSON.parse(window.render_game_to_text()).heroArt==='loaded');
const state=()=>page.evaluate(()=>JSON.parse(window.render_game_to_text()));
async function drain(){for(let i=0;i<80;i++){await page.waitForFunction(()=>!JSON.parse(window.render_game_to_text()).processing);const s=await state();if(s.mode==='dialogue')await page.keyboard.press('f');else if(s.narrative.busy)await page.click('#skip-event');else return;}throw Error('drain');}
async function fixture(commands,x,y){const e=createPrologueSession();e.moveTo(e.state.room);for(const c of commands)await e.processInput(c);const packet=makeVisualSave(e,{room:e.state.room,x,y,face:'up'});await page.keyboard.press('Escape');await page.getByRole('tab',{name:'探索进度'}).click();await page.locator('#save-file').setInputFiles({name:'route.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(packet))});await page.waitForFunction(r=>JSON.parse(window.render_game_to_text()).room===r&&JSON.parse(window.render_game_to_text()).mode!=='paused'&&!JSON.parse(window.render_game_to_text()).processing,e.state.room);await drain();await page.evaluate(()=>window.advanceTime(650));}
async function move(key,ms){await page.keyboard.down(key);await page.evaluate(ms=>window.advanceTime(ms),ms);await page.keyboard.up(key);}
async function click(x,y){const r=await page.locator('canvas').boundingBox();await page.mouse.click(r.x+x/480*r.width,r.y+y/288*r.height);}
async function point(x,y,room){for(let i=0;i<450;i++){const s=await state();if(s.room!==room)return;const dx=x-s.player.x,dy=y-s.player.y;if(Math.hypot(dx,dy)<2.3)return;const keys=[];if(Math.abs(dx)>1)keys.push(dx>0?'ArrowRight':'ArrowLeft');if(Math.abs(dy)>1)keys.push(dy>0?'ArrowDown':'ArrowUp');for(const k of keys)await page.keyboard.down(k);await page.evaluate(()=>window.advanceTime(25));for(const k of keys)await page.keyboard.up(k);}throw Error(`cannot walk painted path to ${x},${y}: ${JSON.stringify((await state()).player)}`);}
try{
await page.click('#start');await drain();
// Old saved position starts inside the west sensor: D must move into the room.
await fixture(['e'],32,162);await move('d',600);assert.equal((await state()).room,'flower_walk');assert.ok((await state()).player.x>70);await page.screenshot({path:`${artifacts}/flower-D.png`,fullPage:true});
// Each northbound trunk must reach N instead of a diagonal sensor on its way.
for(const [commands,x,y,room,target]of [[[],238,218,'palace_gate','broad_walk'],[['n'],240,250,'broad_walk','black_lion_gate'],[['e'],250,170,'flower_walk','lancaster_walk']]){
 await fixture(commands,x,y);await move('ArrowUp',4200);console.log('north',room,(await state()).room);await page.waitForFunction(t=>JSON.parse(window.render_game_to_text()).room===t,target);assert.equal((await state()).room,target,room);await drain();
}
await fixture([],280,158);await move('ArrowRight',500);assert.equal((await state()).room,'palace_gate');assert.ok((await state()).player.x>320);await page.screenshot({path:`${artifacts}/gate-east-road.png`,fullPage:true});
await fixture(['n','n'],230,196);await click(277,189);for(let i=0;i<120;i++){await page.evaluate(()=>window.advanceTime(100));if((await state()).room==='round_pond')break;}await drain();let s=await state();assert.equal(s.room,'round_pond');assert.equal(s.navigation.arrival.entrance,'nw');assert.ok(s.player.x<70&&s.player.y<110);await page.screenshot({path:`${artifacts}/pond-NW-arrival.png`,fullPage:true});
// These centreline samples were read from the painted paths, not generated
// by the collision/pathfinding code being tested. No exit arrows are clicked.
await fixture(['e','nw','n'],100,160);
for(const [x,y]of [[90,140],[76,120],[80,99],[100,87],[122,75],[150,63],[180,52],[211,43],[240,35],[272,36],[315,37],[355,38],[394,40]])await point(x,y,'round_pond');
assert.equal((await state()).room,'round_pond');await page.screenshot({path:`${artifacts}/pond-north-bank.png`,fullPage:true});
await point(418,36,'round_pond');await point(425,22,'round_pond');await page.waitForFunction(()=>JSON.parse(window.render_game_to_text()).room==='lancaster_gate');
assert.deepEqual(errors,[]);console.log('PASS: D moves into Flower Walk; three north roads avoid diagonal exits; Palace east road passes behind pillar; Black Lion→pond uses NW entrance; keyboard follows painted west curve and north bank to true NE branch; no errors.');await writeFile(`${artifacts}/result.json`,JSON.stringify({pass:true,cases:['flower_D','palace_north','broad_north','flower_north','gate_east','pond_NW_arrival','pond_painted_curve_and_NE'],errors},null,2));
}catch(error){await page.screenshot({path:`${artifacts}/failure.png`,fullPage:true}).catch(()=>{});await writeFile(`${artifacts}/failure.json`,JSON.stringify({message:error.message,state:await state().catch(()=>null),errors},null,2));throw error;}finally{await browser.close();}
