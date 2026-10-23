// Optional browser integration check. Set PLAYWRIGHT_MODULE to an installed Playwright entry.
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
import {mkdir} from 'node:fs/promises';
await mkdir('/tmp/trinity-hd2d-qa',{recursive:true});
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1280,height:1050}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
page.on('response',response=>{if(response.status()>=400)errors.push(`${response.status()} ${response.url()}`);});
await page.goto(process.env.DEMO_URL||'http://127.0.0.1:8080/2d-demo/');await page.waitForFunction(()=>JSON.parse(window.render_game_to_text()).art==='loaded'&&JSON.parse(window.render_game_to_text()).sprites==='loaded'&&JSON.parse(window.render_game_to_text()).wabeSprites==='loaded');
const state=()=>page.evaluate(()=>JSON.parse(window.render_game_to_text()));
async function drain(){for(let i=0;i<80;i++){let s=await state();if(s.processing){await page.waitForFunction(()=>!JSON.parse(window.render_game_to_text()).processing);continue;}if(s.mode==='dialogue'){await page.keyboard.press('Enter');continue;}if(s.narrative.busy){await page.click('#skip-event');continue;}break;}}
async function move(key,ms){await page.keyboard.down(key);await page.evaluate(ms=>window.advanceTime(ms),ms);await page.keyboard.up(key);}
async function approach(x,y){for(let i=0;i<12;i++){const s=await state();if(Math.hypot(s.player.x-x,s.player.y-y)<5)return;const dx=x-s.player.x,dy=y-s.player.y;await move(Math.abs(dx)>Math.abs(dy)?(dx>0?'ArrowRight':'ArrowLeft'):(dy>0?'ArrowDown':'ArrowUp'),Math.min(800,Math.max(25,Math.abs(Math.abs(dx)>Math.abs(dy)?dx:dy)/92*1000)));}}
async function walk(dir,target){await drain();const s=await state(),e=s.exits.find(e=>e.dir===dir);assert.ok(e,`${s.room} missing exit ${dir}`);await approach(e.x,e.y);assert.equal((await state()).room,target);await drain();}
async function choose(cmd){await drain();let s=await state();const o=s.objects.find(o=>o.actions.some(a=>a.command===cmd));assert.ok(o,`${s.room}: no hotspot command ${cmd}`);
 // Pick a nearby reachable standing point where this hotspot wins nearest selection.
 const choices=[];for(let x=12;x<=468;x+=4)for(let y=12;y<=276;y+=4){if(Math.hypot(x-o.x,y-o.y)>o.radius-3)continue;if(s.obstacles.some(r=>x>r.x-7&&x<r.x+r.w+7&&y>r.y-4&&y<r.y+r.h+5))continue;const nearest=s.objects.map(h=>({h,d:Math.hypot(x-h.x,y-h.y)})).sort((a,b)=>a.d-b.d)[0];if(nearest.h.id===o.id)choices.push({x,y,d:Math.hypot(x-o.x,y-o.y)*10+Math.hypot(x-s.player.x,y-s.player.y)});}
 choices.sort((a,b)=>a.d-b.d);assert.ok(choices.length,`${cmd} no reachable stance`);await approach(choices[0].x,choices[0].y);s=await state();assert.equal(s.nearby,o.label,`${cmd}: nearest ${s.nearby}`);await page.keyboard.press('z');const action=o.actions.find(a=>a.command===cmd);await page.getByRole('button',{name:action.label,exact:true}).click();}
async function inventory(item,label){await drain();await page.keyboard.press('i');await page.getByRole('button',{name:item,exact:true}).click();await page.getByRole('button',{name:label,exact:true}).click();}
await page.click('#start');await drain();
await walk('e','flower_walk');await choose('take ball');await drain();assert.ok((await state()).inventory.includes('ball'));
await walk('nw','the_wabe');await choose('unscrew gnomon');await drain();await choose('take gnomon');await drain();
await walk('n','round_pond');await choose('take paper bird');await drain();await inventory('纸鸟','展开纸鸟');await drain();
await walk('w','broad_walk');await choose('buy crumbs');await drain();await choose('feed birds');await page.evaluate(()=>window.advanceTime(1400));await page.screenshot({path:'/tmp/trinity-hd2d-qa/prologue-feed.png',fullPage:true});await drain();
await choose('take ruby');await page.evaluate(()=>window.advanceTime(1150));await page.screenshot({path:'/tmp/trinity-hd2d-qa/prologue-ruby-bird.png',fullPage:true});await drain();assert.ok((await state()).flags.includes('wind_changed'));
await walk('n','black_lion_gate');await choose('push pram');await drain();assert.equal((await state()).room,'inverness_terrace');
await choose('push pram');await drain();assert.equal((await state()).room,'lancaster_gate');await choose('wait');await drain();await choose('throw ball at tree');await drain();await choose('take umbrella');await drain();
await choose('push pram');await drain();assert.equal((await state()).room,'lancaster_walk');await choose('open pram');await drain();await choose('enter pram');await drain();await inventory('雨伞','撑开雨伞');await drain();assert.equal((await state()).room,'long_water');
await choose('take paper bird');await drain();await choose('take gnomon');await drain();await page.screenshot({path:'/tmp/trinity-hd2d-qa/prologue-long-water.png',fullPage:true});
await walk('s','wading');await choose('enter door');await drain();assert.equal((await state()).room,'meadow');assert.equal((await state()).chapter,'wabe');assert.equal((await state()).score,15);await page.screenshot({path:'/tmp/trinity-hd2d-qa/prologue-finish.png',fullPage:true});

await walk('n','summit');await page.screenshot({path:'/tmp/trinity-hd2d-qa/wabe-summit.png',fullPage:true});await walk('s','meadow');await walk('e','bottom_of_stairs');await page.screenshot({path:'/tmp/trinity-hd2d-qa/wabe-stairs.png',fullPage:true});
await choose('u');await drain();assert.equal((await state()).room,'vertex');
const originalSymbol=(await state()).sundialSymbol;
await choose('turn ring');await page.evaluate(()=>window.advanceTime(180));await page.screenshot({path:'/tmp/trinity-hd2d-qa/wabe-ring.png',fullPage:true});await drain();
for(let i=0;i<6;i++){await choose('turn ring');await drain();}assert.equal((await state()).sundialSymbol,originalSymbol);
await walk('d','bottom_of_stairs');await walk('w','south_bog');await choose('examine log');await drain();
await page.screenshot({path:'/tmp/trinity-hd2d-qa/wabe-bog.png',fullPage:true});await choose('take splinter');await drain();assert.ok((await state()).inventory.includes('splinter'));
await page.keyboard.press('i');await page.getByRole('button',{name:'木片',exact:true}).click();await page.getByRole('button',{name:'放下',exact:true}).click();await drain();assert.ok(!(await state()).inventory.includes('splinter'));await choose('take splinter');await drain();
await walk('n','north_bog');await page.screenshot({path:'/tmp/trinity-hd2d-qa/wabe-north-bog.png',fullPage:true});await walk('s','south_bog');await walk('s','forest_clearing');await walk('e','trellises');await page.screenshot({path:'/tmp/trinity-hd2d-qa/wabe-trellises.png',fullPage:true});await walk('n','bottom_of_stairs');
await walk('w','south_bog');await walk('n','north_bog');await walk('se','bottom_of_stairs');
// Save the actual result, then verify reload and import through the real UI.
await page.keyboard.press('Escape');await page.getByRole('tab',{name:'探索进度'}).click();const beforeSave=await state();
await page.click('#save-now');await page.screenshot({path:'/tmp/trinity-hd2d-qa/wabe-save-menu.png',fullPage:true});
const downloadEvent=page.waitForEvent('download');await page.click('#export-save');const download=await downloadEvent;await download.saveAs('/tmp/trinity-hd2d-qa/hd2d-export.json');
await page.reload();await page.waitForFunction(()=>window.render_game_to_text);await page.click('#continue-save');await page.waitForFunction(room=>JSON.parse(window.render_game_to_text()).room===room,beforeSave.room);await drain();
let restored=await state();assert.equal(restored.room,beforeSave.room);assert.equal(restored.sundialSymbol,beforeSave.sundialSymbol);assert.ok(restored.inventory.includes('splinter'));assert.deepEqual(restored.flags,beforeSave.flags);assert.equal(restored.turns,beforeSave.turns);
// Invalid import must preserve the living session and the saved packet.
await page.keyboard.press('Escape');await page.getByRole('tab',{name:'探索进度'}).click();const validSave=await page.evaluate(()=>localStorage.getItem('trinity-relit:hd2d:save:v1'));
await page.locator('#save-file').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{bad')});await page.waitForFunction(()=>document.querySelector('#save-message').textContent.includes('无法读取'));assert.match(await page.locator('#save-message').textContent(),/无法读取/);assert.equal((await state()).room,beforeSave.room);assert.equal(await page.evaluate(()=>localStorage.getItem('trinity-relit:hd2d:save:v1')),validSave);
await page.locator('#save-file').setInputFiles('/tmp/trinity-hd2d-qa/hd2d-export.json');await page.waitForFunction(()=>JSON.parse(window.render_game_to_text()).mode!=='paused');await drain();assert.equal((await state()).room,beforeSave.room);
assert.deepEqual(errors,[]);console.log('PASS: prologue→Wabe keyboard exploration, dial seven-turn cycle, splinter take/drop/take, automatic save+continue, export/import, invalid import protection; no page errors.');await browser.close();
