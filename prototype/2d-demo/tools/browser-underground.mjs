import { fitGnomonFixture, lockProjectionFixture } from './browser-vertex-gnomon.mjs';
import { pointerCenter, setIslandDial as setFixedDial } from './browser-islet-route.mjs';
// Legal engine route creates a fixture; imports use the normal save UI. Every
// subsequent room transition uses visible ground and real keyboard/F input.
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createPrologueSession} from '../engine-adapter.js';
import {makeVisualSave,VISUAL_SAVE_KEY} from '../save.js';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const out=process.env.QA_OUTPUT||'/tmp/trinity-underground-browser';await mkdir(out,{recursive:true});
const lanternJourney=process.argv.includes('--lantern-journey');
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:900},hasTouch:lanternJourney,isMobile:lanternJourney});
const errors=[],receipts=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
const state=()=>page.evaluate(()=>JSON.parse(window.render_game_to_text()));
const tick=ms=>page.evaluate(ms=>window.advanceTime(ms),ms);
const shot=name=>page.screenshot({path:`${out}/${name}.png`,fullPage:true});
async function closeText(){for(let i=0;i<80&&(await state()).dialogue;i++)await page.keyboard.press('f');}
async function drain(){
 const lines=[];
 for(let i=0;i<100;i++){
  const s=await state();
  if(s.processing)await page.waitForTimeout(15);
  else if(s.dialogue){lines.push(s.dialogue.text);await page.keyboard.press('f');}
  else if(s.narrative.busy)await tick(100);
  else return {s,lines};
 }
 throw Error('drain');
}
async function click(x,y,touch=false){
 const b=await page.locator('canvas').boundingBox();
 assert.ok(b);
 const at=[b.x+x/480*b.width,b.y+y/288*b.height];
 if(touch)await page.touchscreen.tap(...at);
 else await page.mouse.click(...at);
}
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
async function importSave(input){
 const fromFile=typeof input==='string';
 const save=fromFile?JSON.parse(await readFile(input,'utf8')):input;
 const upload=fromFile?input:{name:'underground.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(save))};
 await page.keyboard.press('Escape');await page.getByRole('tab',{name:'探索进度'}).click();
 await page.locator('#save-file').setInputFiles(upload);
 await page.waitForFunction(room=>{const s=JSON.parse(window.render_game_to_text());return s.room===room&&s.mode!=='paused'&&!s.processing;},save.engine.state.room);
 await drain();
 return save.engine.state;
}
const road=['e','take ball','nw','unscrew gnomon','take gnomon','n','take paper bird','open paper bird','w','buy crumbs','feed birds','take ruby','n','push pram','push pram','wait','throw ball at tree','take umbrella','push pram','open pram','enter pram','open umbrella','take paper bird','take gnomon','enter water','enter door','n','ne','move log','take splinter','e','u'];
async function hold(name){await page.keyboard.press('i');await page.getByRole('button',{name,exact:true}).click();}
async function until(predicate,reason) {
 for(let attempt=0;attempt<190;attempt++){
  const s=await state();
  if(predicate(s))return s;
  await tick(80);
 }
 const s=await state();
 throw Error(`${reason}: ${s.room}, ${s.mode}, ${s.player.x},${s.player.y}, ${s.lastCommand}`);
}
const getProp=(s,id)=>s.objects.find(o=>o.id===id);
const lanterns=s=>s.objects.filter(o=>o.itemId==='lantern'&&o.visual!==false);
const carriesLantern=s=>s.inventory.filter(id=>id==='lantern').length===1;
const lampIsOn=s=>s.flags.includes('lantern_on');

async function clickProp(object,touch=false){
 assert.ok(object);
 const pointer=object.pointerShape?pointerCenter(object):[object.x,object.y-7];
 await click(...pointer,touch);
}

async function finishRoute(before,dir,to){
 await until(s=>s.room===to&&!s.processing,`${before.room} ${dir} → ${to}`);
 const {s,lines}=await drain();
 assert.equal(s.lastCommand,dir);
 assert.equal(s.navigation.arrival?.fromRoom,before.room);
 if(before.room==='underground_3'&&to==='ossuary') {
  // The return has a painted arrival even though the door disappears on entry.
  assert.equal(s.navigation.arrival.entrance,'in');
  assert.deepEqual([s.player.x,s.player.y],[315,127]);
 } else assert.equal(s.navigation.arrival?.matched,true);
 receipts.push({from:before.room,target:to,dir,arrival:s.navigation.arrival,turn:s.turns,lines});
 return s;
}

async function go(dir,to){
 const {s:before}=await drain();
 const exit=before.exits.find(e=>e.dir===dir&&e.target===to);
 assert.ok(exit,`${before.room} ${dir} → ${to}`);
 await tick(550);
 await click(exit.x,exit.y);
 return finishRoute(before,dir,to);
}

async function followPassage(id,dir,to){
 let before=(await drain()).s;
 for(let attempt=0;attempt<2;attempt++){
  await clickProp(getProp(before,id));
  const resolved=await until(s=>!s.processing&&(s.room===to||s.turns>before.turns||s.mode==='dialogue'),'触碰 '+id);
  if(resolved.room===to)return finishRoute(before,dir,to);
  assert.match(resolved.lastCommand,/^(look|examine )/);
  ({s:before}=await drain());
 }
 throw Error('实体通道未能抵达 '+to);
}

async function playedCommand(command,trigger,{scoreDelta=0,source='pointer'}={}){
 const before=await state();
 await trigger();
 await until(s=>!s.processing&&s.turns>before.turns,'执行 '+command);
 const {s,lines}=await drain();
 assert.equal(s.lastCommand,command);
 assert.equal(s.room,before.room);
 assert.equal(s.turns,before.turns+1);
 assert.equal(s.score,before.score+scoreDelta);
 receipts.push({room:s.room,command,input:source,turn:s.turns,score:s.score,text:lines});
 return {s,lines};
}

async function takeGroundLantern({touch=false,scoreDelta=0}={}){
 const before=await state();
 const lamp=lanterns(before)[0];
 assert.ok(lamp,'地面灯笼应有实际轮廓');
 if(!before.observed.includes(lamp.id)){
  await playedCommand('examine lantern',()=>clickProp(lamp,touch),{source:touch?'touch':'pointer'});
 }
 const near=await state();
 const useF=near.nearby===lamp.label;
 if(scoreDelta>0)assert.ok(useF,'点灯笼后的实际站位要能接续按 F 拿取');
 const take=useF?()=>page.keyboard.press('f'):()=>clickProp(lamp,touch);
 const {s}=await playedCommand('take lantern',take,{scoreDelta,source:useF?'F':touch?'touch':'pointer'});
 assert.ok(carriesLantern(s));
 assert.equal(lanterns(s).length,0);
 return s;
}

async function dropItem(name,id){
 await hold(name);
 assert.equal((await state()).heldItem,id);
 await page.keyboard.press('i');
 return (await playedCommand(`drop ${id}`,()=>page.locator('#inventory-drop').click(),{source:'inventory'})).s;
}

async function reloadCurrent(name){
 const before=await state();
 await page.reload();
 await page.locator('#continue-save').click();
 await until(s=>s.room===before.room&&!s.processing&&s.mode!=='title','读取灯笼存档');
 const {s}=await drain();
 for(const field of ['room','turns','score','inventory','arborLight'])assert.deepEqual(s[field],before[field],field);
 assert.equal(lampIsOn(s),lampIsOn(before));
 assert.deepEqual(lanterns(s).map(({id,x,y})=>({id,x,y})),lanterns(before).map(({id,x,y})=>({id,x,y})));
 await shot(name);
 return s;
}

async function exportCurrent(name){
 await page.keyboard.press('Escape');
 await page.getByRole('tab',{name:'探索进度'}).click();
 const download=page.waitForEvent('download');
 await page.locator('#export-save').click();
 const path=`${out}/${name}.json`;
 await (await download).saveAs(path);
 await page.keyboard.press('Escape');
 return path;
}

async function charge(){
 const saved=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),VISUAL_SAVE_KEY);
 return saved.engine.state.counters.lantern_charge;
}

async function toggleLantern(on,via){
 const input=via==='F'?()=>page.keyboard.press('f'):()=>page.locator('#held-item').click();
 const {s}=await playedCommand(on?'turn on lantern':'turn off lantern',input,{source:via});
 assert.equal(lampIsOn(s),on);
 assert.ok(carriesLantern(s));
 return s;
}

async function canvasBrightness(){
 return page.evaluate(()=>{
  const canvas=document.querySelector('canvas');
  const pixels=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
  let sum=0,count=0;
  for(let index=0;index<pixels.length;index+=28){
   sum+=pixels[index]*.213+pixels[index+1]*.715+pixels[index+2]*.072;
   count++;
  }
  return Math.round(100*sum/count)/100;
 });
}

async function confirmWestBlock(){
 const before=await state();
 assert.equal(before.room,'underground_1');
 assert.ok(!getProp(before,'underground_1:white-door'));
 assert.ok(!before.exits.some(exit=>!exit.locked && (exit.dir==='w'||exit.target==='ossuary')));
 await move(52,153);
 await face('a');
 await playedCommand('examine landslide',()=>page.keyboard.press('f'),{source:'F'});
 const examined=await state();
 await page.keyboard.down('a');
 try {await tick(800);} finally {await page.keyboard.up('a');}
 const after=await state();
 assert.equal(after.room,before.room);
 assert.equal(after.turns,examined.turns);
 assert.equal(after.score,before.score);
 await shot('west-rock-barrier');
 receipts.push({room:after.room,input:'A',obstacle:'west-rockfall',turn:after.turns,feet:[after.player.x,after.player.y]});
}

async function exitViaWhiteDoor(useF){
 let before=await state();
 assert.equal(before.room,'underground_3');
 assert.ok(getProp(before,'underground_3:white-door'));
 if(useF){
  await move(404,144);
  await face('w');
  before=await state();
 }
 const remaining=await charge();
 if(useF)await page.keyboard.press('f');
 else await clickProp(getProp(before,'underground_3:white-door'),lanternJourney);
 const returned=await finishRoute(before,'e','ossuary');
 assert.equal(returned.turns,before.turns,'东侧白门按方向返回不消耗回合');
 assert.equal(returned.score,before.score);
 assert.deepEqual(returned.inventory,before.inventory);
 assert.equal(await charge(),remaining);
 return returned;
}

async function checkSpentMushroom(name){
 const before=await state();
 assert.equal(before.room,'ossuary');
 const fungus=getProp(before,'ossuary:mushroom');
 assert.ok(fungus);
 assert.ok(!fungus.actions.some(action=>action.command==='in'));
 assert.ok(!before.exits.some(exit=>exit.target.startsWith('underground_')));
 assert.equal(Boolean(fungus.visualOptions?.open),false);
 assert.equal(fungus.visualOptions?.gone,true);
 await shot(name);
 const examined=await playedCommand('examine toadstool',()=>clickProp(fungus,lanternJourney));
 assert.equal(examined.s.room,'ossuary');
 assert.equal(examined.s.score,before.score);
 return examined.s;
}

async function lanternPlaythrough(){
 const source=process.env.PLAYED_UNDERGROUND_APPROACH_SAVE||fileURLToPath(new URL(
  '../../../artifacts/agent-team/evidence/t60-vertex-regression/hd2d-export.json',import.meta.url,
 ));
 const prior=await importSave(source);
 assert.equal(prior.room,'bottom_of_stairs');
 assert.equal(prior.itemLoc.splinter,'inventory');
 assert.equal(prior.visited.includes('underground_3'),false);
 assert.equal((await state()).turns,prior.turns);
 await followPassage('bottom_of_stairs:stairs','u','vertex');
 await setFixedDial({state,tap:(point,command)=>playedCommand(command,()=>click(...point))},3);
 await followPassage('vertex:stairs','d','bottom_of_stairs');
 await go('ne','under_cliff');
 await go('e','craters_edge');
 await go('nw','bluff');
 await go('e','cottage');
 await go('s','cemetery');
 await shot('cemetery-approach');
 await followPassage('cemetery:crypt','n','barrow');
 await followPassage('barrow:door','in','ossuary');
 const inner=await followPassage('ossuary:mushroom','in','underground_3');
 assert.equal(inner.navigation.arrival?.entrance,'e');
 assert.ok(Math.hypot(inner.player.x-404,inner.player.y-144)<=15);
 const entry=await exportCurrent('first-arrival-by-east-door-played');
 const floor=lanterns(inner)[0];
 assert.equal(lanterns(inner).length,1);
 assert.equal(lampIsOn(inner),false);
 assert.deepEqual([floor.x,floor.y],[388,159]);
 assert.ok(Math.hypot(...pointerCenter(floor).map((v,i)=>v-[388,149][i]))<=4);
 const marker=inner.routeMarker;
 if(marker?.exit?.dir==='e') {
  const {x,y,rx,ry}=getProp(inner,'underground_3:white-door').pointerShape;
  assert.ok(marker.left+marker.width<=x-rx || marker.left>=x+rx
    || marker.top+marker.height<=y-ry || marker.top>=y+ry,'东侧牌位应避开白门洞口');
 }
 assert.doesNotMatch(receipts.at(-1).lines.join(' '),/灯笼在里面|从圆筒|圆筒中取出/);
 await shot('lantern-on-mud');
 const cylinder=getProp(inner,'underground_3:cylinder');
 const description=await playedCommand('examine cylinder',()=>clickProp(cylinder));
 assert.doesNotMatch(description.lines.join(' '),/灯笼在里面|从圆筒|圆筒中取出/);
 assert.equal(lanterns(description.s).length,1);

 await page.setViewportSize({width:390,height:844});
 const picked=await takeGroundLantern({touch:true,scoreDelta:1});
 assert.equal(lampIsOn(picked),false);
 assert.doesNotMatch(receipts.at(-1).text.join(' '),/圆筒/);
 await shot('lantern-taken-phone');
 await page.setViewportSize({width:1440,height:900});
 await hold('灯笼');
 await toggleLantern(true,'F');
 await shot('lantern-lit-in-hand');
 await reloadCurrent('lantern-lit-after-reload');
 await go('w','underground_2');
 await go('w','underground_1');
 await confirmWestBlock();
 await go('e','underground_2');
 await go('e','underground_3');
 await exitViaWhiteDoor(true);
 await checkSpentMushroom('spent-mushroom-after-carrying-lantern');
 await go('out','barrow');
 await go('s','cemetery');
 await go('s','cottage');
 await go('w','bluff');
 await go('se','craters_edge');
 await go('w','under_cliff');
 await go('sw','bottom_of_stairs');
 await go('s','trellises');
 await go('se','arborvitaes_n');
 await go('w','arboretum');
 await dropItem('木片','splinter');
 await go('n','north_arbor');
 const top=await go('u','top_of_arbor');
 assert.equal(top.inventory.includes('splinter'),false);
 assert.equal(top.arborLight,'lantern');
 assert.equal(top.score,picked.score);
 const lit=await canvasBrightness();
 assert.ok(lit>8,'灯笼应实际照亮顶部画布');
 await shot('lantern-alone-lights-arbor');
 await hold('灯笼');
 const dark=await toggleLantern(false,'held-item');
 assert.equal(dark.arborLight,null);
 assert.equal(await canvasBrightness(),0);
 assert.ok(await page.locator('#arbor-dark-routes').isVisible());
 await shot('arbor-with-lantern-off');
 assert.equal((await toggleLantern(true,'F')).arborLight,'lantern');
 const placed=await dropItem('灯笼','lantern');
 assert.equal(placed.arborLight,'lantern');
 assert.equal(carriesLantern(placed),false);
 assert.equal(lanterns(placed).length,1);
 const [placedLamp]=lanterns(placed);
 await shot('lantern-lights-floor');
 await go('n','north_arbor');
 const returned=await go('u','top_of_arbor');
 assert.equal(returned.arborLight,'lantern');
 assert.equal(lanterns(returned).length,1);
 assert.deepEqual([lanterns(returned)[0].x,lanterns(returned)[0].y],[placedLamp.x,placedLamp.y]);
 await reloadCurrent('lantern-on-floor-after-reload');
 const retaken=await takeGroundLantern();
 assert.equal(retaken.arborLight,'lantern');
 assert.equal(retaken.score,picked.score);
 await shot('arbor-lantern-retaken');
 await exitEmptyHanded(entry);
 const legacy=await playLegacyWest();
 return {source,entry,route:'east-white-door',score:retaken.score,turns:retaken.turns,litBrightness:lit,legacy};
}

async function exitEmptyHanded(entry){
 const original=await importSave(entry);
 assert.equal(original.room,'underground_3');
 assert.equal(original.itemLoc.lantern,'underground_3');
 const returned=await exitViaWhiteDoor(false);
 assert.equal(carriesLantern(returned),false);
 assert.equal(returned.score,original.score);
 await reloadCurrent('spent-door-after-reload');
 await checkSpentMushroom('spent-mushroom-after-empty-hand-return');
}

async function playLegacyWest(){
 const source=process.env.LEGACY_UNDERGROUND_WEST_SAVE||fileURLToPath(new URL(
  '../../../artifacts/agent-team/evidence/t63-underground-legacy-source/legacy-west-with-lit-lantern.json',import.meta.url,
 ));
 const original=await importSave(source);
 const restored=await state();
 assert.equal(original.room,'underground_1');
 assert.equal(restored.turns,original.turns);
 assert.equal(restored.score,original.score);
 assert.ok(carriesLantern(restored)&&lampIsOn(restored));
 assert.equal(await charge(),original.counters.lantern_charge);
 await go('e','underground_2');
 await go('e','underground_3');
 const returned=await exitViaWhiteDoor(true);
 assert.ok(carriesLantern(returned)&&lampIsOn(returned));
 await checkSpentMushroom('legacy-west-correct-return');
 return {source,room:returned.room,score:returned.score,turns:returned.turns};
}

async function olderRegression(){
 const e=createPrologueSession();e.moveTo(e.state.room);for(const c of road)await e.processInput(c);await fitGnomonFixture(e);await lockProjectionFixture(e,'third');for(const c of ['d','ne','e','nw'])await e.processInput(c);assert.equal(e.state.room,'bluff');
 await importSave(makeVisualSave(e,{room:e.state.room,x:240,y:180,face:'right'}));await shot('bluff');
 await click(440,136);await page.waitForTimeout(2900);await page.keyboard.down('d');await page.waitForTimeout(800);await page.keyboard.up('d');await drain();assert.equal((await state()).room,'cottage');await shot('cottage');
 await page.evaluate(()=>{window.requestAnimationFrame=()=>0;});await page.waitForTimeout(40);
 await move(193,129);await page.keyboard.down('d');await tick(650);await page.keyboard.up('d');await face('a');await F('examine map');await drain();await move(320,142);await face('w');await F('examine birdcage');await drain();await move(240,194);await face('w');await F('examine cauldron');await drain();
 await move(287,210);await face('d');await F('examine soap bubble');await drain();await F('take soap bubble');await drain();assert.ok((await state()).inventory.includes('soap_bubble'));assert.ok(!(await state()).objects.some(o=>o.itemId==='soap_bubble'));await shot('cottage-bubble-taken');
 await travel('cemetery',[[241,250]],['s']);await shot('cemetery');await move(244,244);await move(260,203);await move(224,161);await move(242,140);await move(244,110);await face('w');await F('n');await drain();assert.equal((await state()).room,'barrow');await shot('barrow');
 await move(240,137);await face('w');await F('examine door');await drain();await F('in');await drain();assert.equal((await state()).room,'ossuary');await shot('ossuary');
 await move(152,157);await face('a');await F('examine bones');await drain();
 await move(323,135);await face('d');await F('look');await drain();await F('in');await closeText();
 let s=await state();assert.equal(s.room,'underground_3');assert.equal(s.narrative.currentEvent,'cliff_passage');
 await tick(220);await shot('mushroom-crossing');await page.keyboard.press('Escape');
 const elapsed=(await state()).narrative.elapsed;await tick(1000);assert.equal((await state()).narrative.elapsed,elapsed);
 await page.keyboard.press('Escape');await drain();await shot('underground-entry');
 await shot('underground-inner-with-lantern');await takeGroundLantern({scoreDelta:1});await hold('灯笼');
 await toggleLantern(true,'F');await shot('lantern-lit');await page.click('#clear-hand');
 await go('w','underground_2');await shot('underground-middle');
 await move(249,194);await face('d');await F('examine walkie-talkie');await drain();await F('take walkie-talkie');await drain();
 assert.ok(!(await state()).objects.some(o=>o.itemId==='walkie_talkie'));
 await go('w','underground_1');
 await move(235,165);await face('s');await F('examine crevice');await drain();
 await confirmWestBlock();
 await go('e','underground_2');
 await reloadCurrent('underground-restored');
 s=await state();assert.ok(lampIsOn(s));assert.ok(s.inventory.includes('walkie_talkie'));assert.equal(s.narrative.currentEvent,null);
 await page.keyboard.press('m');const mapTurns=(await state()).turns;assert.equal((await state()).map.chapter,'underground');assert.equal(await page.locator('[data-room-id]').count(),3);await shot('underground-map');await tick(1000);assert.equal((await state()).turns,mapTurns);await page.setViewportSize({width:844,height:390});await shot('underground-map-mobile');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.keyboard.press('m');await page.setViewportSize({width:1440,height:900});await page.evaluate(()=>{window.requestAnimationFrame=()=>0;});
 await dropItem('灯笼','lantern');assert.equal(lanterns(await state()).length,1);
 await dropItem('木片','splinter');await shot('lantern-left-middle');
 await travel('underground_1',[[82,164],[44,145]],['a','w']);await travel('underground_2',[[250,164],[390,165],[444,150]],['d']);assert.equal((await state()).dead,false);const lamp=(await state()).objects.find(o=>o.itemId==='lantern');await move(lamp.x-20,lamp.y);await face('d');await F('take lantern');await drain();
 await go('e','underground_3');await hold('灯笼');await exitViaWhiteDoor(true);
 assert.equal((await state()).heldItem,'lantern');await page.click('#clear-hand');await shot('ossuary-return');
 await travel('barrow',[[240,195],[238,235],[240,252]],['s']);await travel('cemetery',[[240,245]],['s']);await travel('cottage',[[242,140],[224,161],[260,203],[244,244],[246,255]],['s']);await travel('bluff',[[170,210],[70,154],[42,141]],['a']);assert.equal((await state()).navigation.arrival.entrance,'e');await shot('bluff-return');
 await page.keyboard.press('m');assert.equal((await state()).map.chapter,'wabe');await shot('wabe-grave-map');await page.keyboard.press('m');
 return {F:true,normalRAF:true,restore:true,light:true,map:true};
}

try{
 const defaultUrl='http://127.0.0.1:8080/2d-demo/'+(lanternJourney?'':'?reviewRoutes=1');
 await page.goto(process.env.DEMO_URL||defaultUrl);
 await page.waitForFunction(()=>window.render_game_to_text&&JSON.parse(window.render_game_to_text()).art==='loaded'&&JSON.parse(window.render_game_to_text()).undergroundSprites==='loaded');
 await page.click('#start');await drain();
 const report=lanternJourney?await lanternPlaythrough():await olderRegression();
 assert.deepEqual(errors,[]);
 await writeFile(`${out}/result.json`,JSON.stringify({pass:true,receipts,...report,errors},null,2));
 console.log(lanternJourney?'真实进度从墓地拿取灯笼、往返洞外及藤架亮灭和续玩通过':'地下八景、F、照明、返程、存档、手机地图通过');
}catch(error){await shot('failure').catch(()=>{});await writeFile(`${out}/failure.json`,JSON.stringify({message:error.message,state:await state().catch(()=>null),receipts,errors},null,2));throw error;}finally{await browser.close();}
