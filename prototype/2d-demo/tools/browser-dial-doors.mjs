// Branch an actual played Vertex save. Dial, lever, gates and walking are real browser inputs.
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { VISUAL_SAVE_KEY } from '../save.js';
import { pointerCenter, setIslandDial as setFixedDial } from './browser-islet-route.mjs';

const { chromium }=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=fileURLToPath(new URL('../../../artifacts/agent-team/evidence/',import.meta.url));
const source=process.env.PLAYED_VERTEX_SAVE||join(root,'t60-vertex-regression','vertex-installed.json');
const legacy=process.env.LEGACY_UNDERGROUND_ENTRY_SAVE||join(root,'t63-east-door-journey-final','first-arrival-by-east-door-played.json');
const output=process.env.QA_OUTPUT||join(tmpdir(),'trinity-dial-doors');
const url=process.env.DEMO_URL||'http://127.0.0.1:8080/2d-demo/';
const original=JSON.parse(await readFile(source,'utf8')).engine.state;
assert.equal(original.room,'vertex');
assert.ok(original.flags.includes('vertex_gnomon_scored'));
assert.ok(!original.visited.includes('ossuary')&&!original.visited.includes('waterfall'));
await mkdir(output,{recursive:true});

const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:900},hasTouch:true,isMobile:true});
page.setDefaultTimeout(12000);
const reports=[];
const errors=[];
let name='';
let actions=[];
page.on('pageerror',error=>errors.push(error.message));
page.on('console',msg=>{if(msg.type()==='error')errors.push(msg.text());});
page.on('response',res=>{if(res.status()>=400)errors.push(res.status()+' '+res.url());});
const state=()=>page.evaluate(()=>JSON.parse(window.render_game_to_text()));
const tick=ms=>page.evaluate(ms=>window.advanceTime(ms),ms);
const object=(s,id)=>s.objects.find(prop=>prop.id===id);
const getGate=(s,site)=>object(s,site+':mushroom');
const shot=(label)=>page.screenshot({path:join(output,name+'-'+label+'.png')});

async function until(predicate,reason){
  for(let frame=0;frame<160;frame++){
    const s=await state();
    if(predicate(s))return s;
    await tick(80);
  }
  const s=await state();
  throw Error(`${reason}: ${s.room}, ${s.mode}, ${s.player.x},${s.player.y}, ${s.lastCommand}`);
}

async function drain(){
  const text=[];
  for(let i=0;i<80;i++){
    const s=await until(value=>!value.processing,'等待行动');
    if(s.mode==='dialogue'){
      text.push(s.dialogue.text);
      await page.locator('#next').click();
    }else if(s.narrative.busy)await tick(100);
    else return {s,text};
  }
  throw Error('对白仍未结束');
}

async function click([x,y],touch=false){
  const box=await page.locator('canvas').boundingBox();
  assert.ok(box);
  const at=[box.x+x/480*box.width,box.y+y/288*box.height];
  if(touch)await page.touchscreen.tap(...at);
  else await page.mouse.click(...at);
}

async function clickProp(prop,touch=false){
  assert.ok(prop);
  const point=prop.kind==='cliff_stone_steps'?[prop.x,prop.y]:prop.pointerShape?pointerCenter(prop):[prop.x,prop.y-5];
  await click(point,touch);
}

async function importPlayed(file){
  const save=JSON.parse(await readFile(file,'utf8')).engine.state;
  await page.keyboard.press('Escape');
  await page.getByRole('tab',{name:'探索进度'}).click();
  await page.locator('#save-file').setInputFiles(file);
  await until(s=>s.room===save.room&&s.mode!=='paused'&&!s.processing,'读取实际存档');
  const {s}=await drain();
  assert.equal(s.turns,save.turns);
  assert.equal(s.score,save.score);
  return {s,save};
}

async function dial(){
  const raw=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).engine.state,VISUAL_SAVE_KEY);
  const counter=raw.counters.vertex_shadow_tick;
  assert.ok(Number.isInteger(counter));
  return {counter,sector:Math.floor(counter/13),phase:counter%13,ring:raw.sundialSymbol,
    moving:raw.flags.includes('vertex_lever_up')};
}

async function finishRoute(before,dir,to){
  await until(s=>s.room===to&&!s.processing,`${before.room} ${dir}到${to}`);
  const {s,text}=await drain();
  assert.equal(s.lastCommand,dir);
  assert.equal(s.navigation.arrival?.fromRoom,before.room);
  assert.equal(s.score,before.score);
  actions.push({from:before.room,to,dir,turn:s.turns,text,arrival:s.navigation.arrival});
  return s;
}

async function walk(dir,to){
  const {s:before}=await drain();
  const exit=before.exits.find(e=>e.dir===dir&&e.target===to&&!e.locked);
  assert.ok(exit,`${before.room} ${dir}→${to}`);
  await tick(550);
  await click([exit.x,exit.y]);
  return finishRoute(before,dir,to);
}

async function touchPassage(id,dir,to,touch=false){
  let {s:before}=await drain();
  for(let attempt=0;attempt<2;attempt++){
    await clickProp(object(before,id),touch);
    const next=await until(s=>!s.processing&&(s.room===to||s.turns>before.turns||s.mode==='dialogue'),id);
    if(next.room===to)return finishRoute(before,dir,to);
    assert.match(next.lastCommand,/^(look|examine )/);
    ({s:before}=await drain());
  }
  throw Error(id+' 未能通行到 '+to);
}

async function command(command,input){
  const before=await state();
  await input();
  await until(s=>!s.processing&&(s.mode==='dialogue'||s.turns>before.turns)&&s.lastCommand===command,command);
  const result=await drain();
  actions.push({room:before.room,command,turn:result.s.turns,text:result.text});
  return result;
}

async function startProjection(symbol,moving,needLight=false){
  await importPlayed(source);
  if(needLight&&!(await state()).inventory.includes('splinter')){
    await touchPassage('vertex:stairs','d','bottom_of_stairs');
    await walk('w','south_bog');
    const log=object(await state(),'south_bog:log');
    if(log){
      await command('examine log',()=>clickProp(log));
      await command('move log',()=>clickProp(log));
    }
    const splinter=(await state()).objects.find(prop=>prop.itemId==='splinter');
    await command('examine splinter',()=>clickProp(splinter));
    const {s}=await command('take splinter',()=>clickProp(splinter));
    assert.ok(s.inventory.includes('splinter'));
    await walk('e','bottom_of_stairs');
    await touchPassage('bottom_of_stairs:stairs','u','vertex');
  }
  const controller={
    state,
    tap:(point,expected)=>command(expected,()=>click(point)),
  };
  await setFixedDial(controller,symbol);
  if(moving){
    const lever=object(await state(),'vertex:lever');
    await command('pull lever',()=>clickProp(lever));
  }
  const configured=await dial();
  assert.equal(configured.ring,symbol);
  assert.equal(configured.moving,moving);
  await shot('dial');
  return configured;
}

async function reach(site){
  await touchPassage('vertex:stairs','d','bottom_of_stairs');
  await walk('w','south_bog');
  const waterfall=await walk('w','waterfall');
  if(site==='waterfall')return waterfall;
  await touchPassage('waterfall:steps','n','cemetery');
  await touchPassage('cemetery:crypt','n','barrow');
  return touchPassage('barrow:door','in','ossuary');
}

function assertGate(s,site,open){
  const gate=getGate(s,site);
  assert.ok(gate,site+'应显示实体巨菌');
  assert.equal(Boolean(gate.visualOptions?.open),open);
  return gate;
}

async function inspectGate(site){
  const before=await state();
  await clickProp(getGate(before,site));
  await until(s=>!s.processing&&s.mode==='dialogue','观察巨菌和门');
  const {s,text}=await drain();
  assert.equal(s.room,site);
  assert.match(s.lastCommand,/^(look|examine )/);
  assert.ok(text.length);
  actions.push({room:site,command:s.lastCommand,turn:s.turns,text});
  return text;
}

async function tryClosedGate(site){
  const {s:before}=await drain();
  const gate=assertGate(before,site,false);
  await clickProp(gate);
  await until(s=>!s.processing&&s.mode==='dialogue','查看或尝试关闭的白门');
  const {s,text}=await drain();
  assert.equal(s.room,site);
  assert.equal(s.score,before.score);
  assert.match(text.join(' '),/关|闭|未开|不能/);
  actions.push({room:site,command:s.lastCommand,outcome:'closed',turn:s.turns,text});
}

async function oneWait(){
  const {s}=await command('wait',()=>page.keyboard.press('r'));
  return s;
}

async function waitForFirstWindow(site,sector){
  for(let i=0;i<28;i++){
    const s=await oneWait();
    if(getGate(s,site)?.visualOptions?.open){
      const p=await dial();
      assert.equal(p.sector,sector);
      assert.equal(p.phase,5);
      return p;
    }
  }
  throw Error(site+'没有按实际投影打开');
}

async function roundTrip(){
  const atGate=await state();
  assertGate(atGate,'ossuary',true);
  const inside=await touchPassage('ossuary:mushroom','in','underground_3');
  assert.equal(inside.chapter,'underground');
  await shot('inside');
  const before=inside.turns;
  const back=await touchPassage('underground_3:white-door','e','ossuary');
  assert.equal(back.turns,before);
  assert.ok(getGate(back,'ossuary').visualOptions?.gone);
  await shot('returned');
}

async function enterLastMoment(){
  const before=await state();
  assertGate(before,'ossuary',true);
  assert.ok(before.observed.includes('ossuary:mushroom'),'错过窗口前已在画中观察巨菌');
  const entered=await touchPassage('ossuary:mushroom','in','underground_3',true);
  assert.equal((await dial()).phase,7);
  assert.ok(!entered.exits.some(e=>!e.locked&&e.target==='ossuary'),'末拍进去后不能立刻从应该关闭的门退出');
  await shot('last-beat-inside');
  await click([407,98],true);
  await tick(1200);
  const after=await state();
  assert.equal(after.room,'underground_3');
  assert.equal(after.score,entered.score);
  assert.equal(after.turns,entered.turns);
  await page.reload();
  await page.locator('#continue-save').click();
  await until(s=>s.room==='underground_3'&&!s.processing&&s.mode!=='title','末拍入场后重载');
  const {s:restored}=await drain();
  assert.equal(restored.turns,entered.turns);
  assert.ok(!restored.exits.some(e=>!e.locked&&e.target==='ossuary'));
  await shot('last-beat-restored');
}

async function closeAwayFromDoor(){
  name='ossuary-2-moving-closed-away';
  actions=[];
  const configured=await startProjection(2,true,true);
  await reach('ossuary');
  await inspectGate('ossuary');
  const openWindow=await waitForFirstWindow('ossuary',4);
  const inside=await touchPassage('ossuary:mushroom','in','underground_3');
  assert.equal((await dial()).phase,6);
  assert.ok(inside.exits.some(e=>!e.locked&&e.target==='ossuary'));
  await shot('open');
  const middle=await walk('w','underground_2');
  assert.ok(middle.flags.includes('ossuary_door_closed_away'));
  assert.ok(!middle.flags.includes('ossuary_door_spent'));
  const closed=await walk('e','underground_3');
  assert.ok(!closed.exits.some(e=>!e.locked&&e.target==='ossuary'));
  assert.ok(!object(closed,'underground_3:white-door'));
  assert.ok(object(closed,'underground_3:closed-white-door'));
  assert.ok(closed.backgrounds.includes('./assets/ug-inner-closed-v1.webp'));
  await shot('closed');
  await page.reload();
  await page.locator('#continue-save').click();
  await until(s=>s.room==='underground_3'&&!s.processing&&s.mode!=='title','白门在相邻室合上后重载');
  const {s:restored}=await drain();
  assert.equal(restored.turns,closed.turns);
  assert.ok(restored.flags.includes('ossuary_door_closed_away'));
  assert.ok(!restored.exits.some(e=>!e.locked&&e.target==='ossuary'));
  assert.ok(restored.backgrounds.includes('./assets/ug-inner-closed-v1.webp'));
  await shot('closed-restored');
  const closedDoor=object(restored,'underground_3:closed-white-door');
  for(let attempt=0;attempt<2;attempt++){
    const observed=await command('look',()=>clickProp(closedDoor));
    assert.equal(observed.s.room,'underground_3');
    assert.match(observed.text.join(' '),/东墙上的白门关着/);
  }
  reports.push({site:'ossuary',symbol:2,moving:true,configured,openWindow,closedAway:true,actions});
}

async function replay(site,symbol,moving,windowCheck=false){
  name=[site,symbol,moving?'moving':'fixed'].join('-');
  actions=[];
  const configured=await startProjection(symbol,moving);
  const atGate=await reach(site);
  const arrival=await dial();
  const correctSymbol=site==='ossuary'?3:2;
  const expectedOpen=!moving&&symbol===correctSymbol;
  assertGate(atGate,site,expectedOpen);
  if(moving)assert.notEqual(arrival.counter,configured.counter);
  else assert.equal(arrival.counter,configured.counter);
  await tick(900);
  assert.deepEqual(await dial(),arrival,'读完场景后的动画帧不推移投影');
  await shot('arrival');
  await inspectGate(site);
  assertGate(await state(),site,expectedOpen);
  if(!expectedOpen)await tryClosedGate(site);
  if(!moving&&site==='ossuary'&&expectedOpen)await roundTrip();
  let openWindow;
  if(windowCheck){
    openWindow=await waitForFirstWindow(site,(correctSymbol-1)*2);
    await shot('window-first');
    await oneWait();
    assert.equal((await dial()).phase,6);
    assertGate(await state(),site,true);
    await shot('window-last');
    if(site==='ossuary')await enterLastMoment();
    else {
      await oneWait();
      assert.equal((await dial()).phase,7);
      assertGate(await state(),site,false);
      await shot('after-window');
    }
  }
  reports.push({site,symbol,moving,expectedOpen,configured,arrival,openWindow,actions});
}

async function legacyReturn(){
  name='legacy-inside';
  actions=[];
  const {s,save}=await importPlayed(legacy);
  assert.equal(s.room,'underground_3');
  assert.equal(save.sundialSymbol,2);
  assert.ok(s.exits.some(e=>!e.locked&&e.target==='ossuary'));
  const restored=await touchPassage('underground_3:white-door','e','ossuary');
  assert.equal(restored.turns,save.turns);
  assert.deepEqual(restored.inventory,s.inventory);
  assert.ok(getGate(restored,'ossuary').visualOptions?.gone);
  await shot('returned');
  reports.push({legacy,score:restored.score,turns:restored.turns,actions});
}

try{
  await page.goto(url);
  await page.waitForFunction(()=>window.render_game_to_text&&JSON.parse(window.render_game_to_text()).art==='loaded');
  await page.locator('#start').click();
  await drain();
  for(const site of ['waterfall','ossuary']) {
    for(const symbol of [2,3])await replay(site,symbol,false);
    for(const symbol of [2,3])await replay(site,symbol,true,site==='ossuary'&&symbol===2);
  }
  await replay('waterfall',1,true,true);
  await closeAwayFromDoor();
  await legacyReturn();
  assert.deepEqual(errors,[]);
  await writeFile(join(output,'result.json'),JSON.stringify({pass:true,source,reports,errors},null,2));
  console.log('两座白门的固定/移动投影、末拍锁门及旧档返程通过');
}catch(error){
  await shot('failure').catch(()=>{});
  await writeFile(join(output,'failure.json'),JSON.stringify({
    message:error.message,name,state:await state().catch(()=>null),actions,reports,errors,
  },null,2));
  throw error;
}finally{
  await browser.close();
}
