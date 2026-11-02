// Legal chapter fixtures enter through the normal save UI. Every visible road
// is then traversed with pointer waypoints and real directional/F inputs.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createPrologueSession} from '../engine-adapter.js';
import {makeVisualSave,VISUAL_SAVE_KEY} from '../save.js';
import {SCENES} from '../scene-manifest.js';
import {COMPLETION_POINTS as P} from '../wabe-completion-points.js';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const out=process.env.QA_OUTPUT||'/private/tmp/trinity-wabe-completion-browser';await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[],receipts=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
const state=()=>page.evaluate(()=>JSON.parse(window.render_game_to_text()));
const tick=ms=>page.evaluate(ms=>window.advanceTime(ms),ms);
const shot=name=>page.screenshot({path:`${out}/${name}.png`,fullPage:true});
async function drain(){for(let i=0;i<100;i++){const s=await state();if(s.processing)await page.waitForTimeout(20);else if(s.dialogue)await page.keyboard.press('f');else if(s.narrative.busy)await page.click('#skip-event');else return;}throw Error('drain');}
async function click(x,y){const b=await page.locator('canvas').boundingBox();await page.mouse.click(b.x+x/480*b.width,b.y+y/288*b.height);}
async function move(x,y){await drain();const room=(await state()).room;await click(x,y);for(let i=0;i<180;i++){const s=await state();assert.equal(s.room,room,'中途路点不能抢触其它出口');if(!s.navigation.path.length&&!s.processing){assert.ok(Math.hypot(s.player.x-x,s.player.y-y)<10,`missed ${x},${y}: ${s.player.x},${s.player.y}`);return;}await tick(80);}throw Error(`walk ${x},${y}`);}
async function face(key){await page.keyboard.down(key);await tick(12);await page.keyboard.up(key);}
async function F(command){await page.keyboard.press('f');await page.waitForFunction(c=>{const s=JSON.parse(window.render_game_to_text());return s.lastCommand===c&&!s.processing;},command);}
async function inspectAt(x,y,command){const before=(await state()).turns;await click(x,y);for(let i=0;i<180;i++){const s=await state();if(s.lastCommand===command&&s.turns>before&&!s.processing)return;await tick(80);}throw Error(`visible artwork did not inspect: ${command}`);}
async function importSave(save){await drain();await page.keyboard.press('Escape');await page.getByRole('tab',{name:'探索进度'}).click();await page.locator('#save-file').setInputFiles({name:'wabe.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(save))});await page.waitForFunction(room=>{const s=JSON.parse(window.render_game_to_text());return s.room===room&&!s.processing&&s.mode!=='paused';},save.engine.state.room);await drain();}
async function travel(target,points,keys){await drain();const from=(await state()).room;for(const p of points)await move(...p);await tick(600);for(const k of keys)await page.keyboard.down(k);for(let i=0;i<65&&(await state()).room===from;i++)await tick(70);for(const k of keys)await page.keyboard.up(k);for(let i=0;i<40&&(await state()).processing;i++)await page.waitForTimeout(20);assert.equal((await state()).room,target,`${from}→${target}`);receipts.push({from,target,arrival:(await state()).navigation.arrival});await drain();}
const road=['e','take ball','nw','unscrew gnomon','take gnomon','n','take paper bird','open paper bird','w','buy crumbs','feed birds','take ruby','n','push pram','push pram','wait','throw ball at tree','take umbrella','push pram','open pram','enter pram','open umbrella','take paper bird','take gnomon','enter water','enter door','n','ne','take splinter','n','n'];
const e=createPrologueSession(),fixtures={};e.moveTo(e.state.room);
function capture(){if(SCENES[e.state.room]){const room=e.state.room,[x,y]=SCENES[room].spawn;fixtures[room]=makeVisualSave(e,{room,x,y,face:'up'});}}
async function run(commands){for(const c of commands){await e.processInput(c);assert.equal(e.state.dead,false,c);capture();}}
await run(road);await run(['se','ne','sw','e','w','se','nw','sw','ne','w','e','nw','s','n','se','ne','e','e','w','w','sw','se','s','w','e','nw','se','n','nw','ne','e','e']);
const routes={
 chasms_brink:[['bluff',[[350,159],[390,105],[418,44]],['w']],['under_cliff',[[360,165],[438,152]],['d']],['the_bend',[[300,185],[340,210],[390,246],[404,254]],['d','s']],['south_bog',[[175,187],[133,211],[80,248],[65,256]],['a','s']],['north_bog',[[100,155],[39,150]],['a']],['promontory',[[128,141],[86,103],[52,40]],['w']]],
 promontory:[['north_bog',[[258,220],[234,251]],['s']],['chasms_brink',[[370,214],[427,247]],['d','s']]],
 herb_garden:[['cottage',[[180,192],[114,180],[60,160],[40,160]],['a']]],
 the_river:[['the_bend',[[244,143],[267,103],[275,63],[273,37]],['w']],['trellises',[[212,156],[120,146],[40,146]],['a']],['bottom_of_stairs',[[212,155],[155,132],[119,106],[81,65],[53,30]],['a','w']]],
 // Independent samples from adjoining, previously delivered paintings.
 bluff:[['chasms_brink',[[181,189],[102,224],[67,254]],['a','s']]],
 under_cliff:[['chasms_brink',[[124,171],[42,160]],['a']]],
 the_bend:[['chasms_brink',[[119,77],[65,27]],['a','w']],['the_river',[[255,220],[245,253]],['s']]],
 south_bog:[['chasms_brink',[[302,116],[363,70],[400,30]],['d','w']]],
 north_bog:[['chasms_brink',[[360,140],[440,125]],['d']],['promontory',[[235,82],[231,39]],['w']]],
 cottage:[['herb_garden',[[300,188],[382,174],[430,153],[442,144]],['d']]],
 trellises:[['the_river',[[360,146],[440,146]],['d']]],
 bottom_of_stairs:[['the_river',[[335,196],[403,221],[440,233]],['d']]],
};
try{
 await page.goto(process.env.DEMO_URL||'http://127.0.0.1:8080/2d-demo/?reviewRoutes=1');await page.waitForFunction(()=>window.render_game_to_text&&JSON.parse(window.render_game_to_text()).art==='loaded');await page.click('#start');await drain();
 await importSave(fixtures.promontory);await page.waitForFunction(()=>JSON.parse(window.render_game_to_text()).completionSprites==='loaded');await shot('giant-normal-raf');await page.waitForTimeout(900);await shot('giant-normal-raf-next');
 const opaque=await page.evaluate(async()=>{const{renderCompletionSprite}=await import('/2d-demo/wabe-completion-art.js');const canvas=document.createElement('canvas');canvas.width=480;canvas.height=288;const c=canvas.getContext('2d');return[2.1,3.38,5.68,6.98,9.88].map(time=>{c.clearRect(0,0,480,288);renderCompletionSprite(c,{kind:'completion_boy',x:185,y:176,visualOptions:{drawAt:{x:185,y:176}}},{chapter:'wabe'},time);return{time,alpha:c.getImageData(185,131,1,1).data[3]};});});assert.ok(opaque.every(sample=>sample.alpha>=250),`巨人动作过渡身体不能半透明: ${JSON.stringify(opaque)}`);
 await page.evaluate(()=>{window.requestAnimationFrame=()=>0;});await page.waitForTimeout(25);
 for(const [room,tests]of Object.entries(routes))for(const [target,points,keys]of tests){await importSave(fixtures[room]);await travel(target,points,keys);}
 for(const room of ['chasms_brink','promontory','herb_garden','the_river']){await importSave(fixtures[room]);await shot(room);}
 await importSave(fixtures.chasms_brink);await inspectAt(276,29,'examine toadstool');await shot('visible-toadstool-hit');await drain();
 await importSave(fixtures.promontory);await move(P.boy.x,P.boy.y);await face('a');await F('examine boy');await shot('giant-inspect');await drain();
 await move(240,194);await page.keyboard.down('w');await tick(800);await page.keyboard.up('w');assert.ok((await state()).player.y>=184,'右鞋是接地实体，不能走进鞋里');await shot('giant-shoe-contact');
 await inspectAt(157,79,'examine headphones');await shot('visible-headphones-hit');await drain();
 const before=(await state()).turns;for(const [index,ms]of [0,1800,1800,1800,1800].entries()){await tick(ms);await shot(`giant-cycle-${index}`);}assert.equal((await state()).turns,before,'泡动画不提交原回合');
 await page.keyboard.press('Escape');const frozen=(await state()).completionBoy;await tick(1500);assert.deepEqual((await state()).completionBoy,frozen,'暂停冻结同一动作阶段');await page.keyboard.press('Escape');
 await importSave(fixtures.herb_garden);await move(365,185);await page.keyboard.down('w');await tick(800);await page.keyboard.up('w');assert.ok((await state()).player.y>=164,'毒菌树干不能穿过');await shot('mushroom-contact');await inspectAt(170,160,'examine herbs');await drain();await inspectAt(305,176,'examine thyme');await drain();assert.ok(!(await state()).inventory.includes('thyme'));const garlic=(await state()).objects.find(o=>o.itemId==='garlic');assert.ok(garlic);await move(garlic.x+24,garlic.y);await face('a');await F('examine garlic');await drain();await F('take garlic');await drain();assert.ok((await state()).inventory.includes('garlic'));assert.ok(!(await state()).objects.some(o=>o.itemId==='garlic'));await shot('garlic-collected');
 await page.keyboard.press('i');await page.getByRole('button',{name:'大蒜',exact:true}).click();await page.keyboard.press('i');await page.click('#inventory-drop');await drain();assert.ok((await state()).objects.some(o=>o.itemId==='garlic'));await shot('garlic-dropped');
 await page.keyboard.press('m');assert.equal((await state()).map.chapter,'wabe');await shot('completed-wabe-map');const turns=(await state()).turns;await tick(1200);assert.equal((await state()).turns,turns);await page.setViewportSize({width:844,height:390});await shot('map-phone');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.keyboard.press('m');await page.setViewportSize({width:1440,height:900});
 const saved=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),VISUAL_SAVE_KEY);await page.reload();await page.waitForFunction(()=>window.render_game_to_text&&JSON.parse(window.render_game_to_text()).art==='loaded');await page.click('#continue-save');await drain();assert.equal((await state()).room,saved.engine.state.room);assert.equal((await state()).turns,saved.engine.state.turns);assert.ok((await state()).objects.some(o=>o.itemId==='garlic'));await shot('restored-herb-garden');
 assert.deepEqual(errors,[]);await writeFile(`${out}/result.json`,JSON.stringify({pass:true,receipts,normalRAF:true,F:true,giantCycle:true,map:true,restore:true,errors},null,2));console.log(`PASS Wabe completion: ${receipts.length} real keyboard roads, giant cycle/pause, F garlic, maps and restore; no errors`);
}catch(error){await shot('failure').catch(()=>{});await writeFile(`${out}/failure.json`,JSON.stringify({message:error.message,state:await state().catch(()=>null),receipts,errors},null,2));throw error;}finally{await browser.close();}
