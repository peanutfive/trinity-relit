// Play from an unvisited bog save and from an old game that already carries its light.
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pointerCenter } from './browser-islet-route.mjs';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const url = process.env.DEMO_URL || 'http://127.0.0.1:8080/2d-demo/';
const output = process.env.QA_OUTPUT || join(tmpdir(),'trinity-bog-log');
const t52 = fileURLToPath(new URL('../../../artifacts/agent-team/evidence/t52-gnomon-reference-final/',import.meta.url));
const sources = {
  untouched:process.env.PLAYED_BEFORE_BOG_SAVE || join(t52,'vertex-mismatched.json'),
  carried:process.env.LEGACY_BOG_SPLINTER_SAVE || join(t52,'hd2d-export.json'),
};
await mkdir(output,{recursive:true});

const browser = await chromium.launch({headless:true});
const reports = [];
const errors = [];
let page;
let branch;
let phone;
let steps;
const state = () => page.evaluate(() => JSON.parse(window.render_game_to_text()));
const tick = ms => page.evaluate(ms => window.advanceTime(ms),ms);
const shot = name => page.screenshot({path:join(output,branch+'-'+name+'.png')});
const prop = (s,id) => s.objects.find(o=>o.id===id);
const splinters = s => s.objects.filter(o=>o.itemId==='splinter'&&o.visual!==false);
const inventory = s => s.inventory.filter(id=>id==='splinter').length;

async function until(predicate,reason) {
  for(let frame=0;frame<160;frame++) {
    const s = await state();
    if(predicate(s))return s;
    await tick(75);
  }
  const s = await state();
  throw Error(`${reason}: ${s.room}, ${s.mode}, ${s.player.x},${s.player.y}, ${s.lastCommand}`);
}

async function drain() {
  const lines = [];
  for(let i=0;i<90;i++) {
    const s = await until(value=>!value.processing,'等待动作完成');
    if(s.mode==='dialogue'){
      lines.push(s.dialogue.text);
      await page.locator('#next').click();
    }else if(s.narrative.busy)await tick(100);
    else return {s,lines};
  }
  throw Error('对白和演出未结束');
}

async function selectEnglish() {
  await page.getByRole('tab',{name:'键位设置'}).click();
  const button=page.locator('#language');
  if(await button.textContent()!=='英文')await button.click();
  assert.equal(await button.textContent(),'英文');
}

async function openCase(name,touch,language='cn') {
  branch=language==='en'?name+'-english':name;
  phone=touch;
  steps=[];
  await page?.context().close();
  page=await browser.newPage({
    viewport:touch?{width:390,height:844}:{width:1440,height:900},
    hasTouch:touch,isMobile:touch,
  });
  page.setDefaultTimeout(10000);
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',msg=>{if(msg.type()==='error')errors.push(msg.text());});
  page.on('response',res=>{if(res.status()>=400)errors.push(res.status()+' '+res.url());});
  await page.goto(url);
  await page.waitForFunction(()=>window.render_game_to_text&&JSON.parse(window.render_game_to_text()).art==='loaded');
  await page.locator('#start').click();
  await drain();
  const {engine:{state:original}}=JSON.parse(await readFile(sources[name],'utf8'));
  assert.equal(original.chapter,'wabe');
  if(name==='untouched') {
    assert.equal(original.visited.includes('south_bog'),false);
    assert.equal(original.itemLoc.splinter,'south_bog');
  } else {
    assert.ok(original.visited.includes('south_bog'));
    assert.equal(original.itemLoc.splinter,'inventory');
  }
  await page.keyboard.press('Escape');
  if(language==='en')await selectEnglish();
  await page.getByRole('tab',{name:'探索进度'}).click();
  await page.locator('#save-file').setInputFiles(sources[name]);
  await until(s=>s.room===original.room&&s.mode!=='paused'&&!s.processing,'导入实际进度');
  const {s}=await drain();
  assert.equal(s.turns,original.turns);
  assert.equal(s.score,original.score);
  assert.equal(inventory(s),name==='carried'?1:0);
}

async function clickCanvas([x,y]) {
  const box=await page.locator('canvas').boundingBox();
  assert.ok(box);
  const point=[box.x+x*box.width/480,box.y+y*box.height/288];
  if(phone)await page.touchscreen.tap(...point);
  else await page.mouse.click(...point);
}

async function clickProp(object) {
  assert.ok(object);
  await clickCanvas(object.pointerShape?pointerCenter(object):[object.x,object.y-7]);
}

async function arrive(to) {
  await until(s=>s.room===to&&!s.processing,'走到 '+to);
  return (await drain()).s;
}

async function go(dir,to) {
  const before=await state();
  const exit=before.exits.find(e=>e.dir===dir&&e.target===to);
  assert.ok(exit,`没有找到 ${before.room} 的 ${dir} 出口`);
  await tick(550);
  await clickCanvas([exit.x,exit.y]);
  const s=await arrive(to);
  assert.equal(s.lastCommand,dir);
  assert.equal(s.turns,before.turns+1);
  assert.equal(s.navigation.arrival?.fromRoom,before.room);
  assert.equal(s.navigation.arrival?.matched,true);
  steps.push({from:before.room,to,dir,arrival:s.navigation.arrival,turn:s.turns});
  return s;
}

async function enterBog() {
  if((await state()).room==='vertex') {
    await clickProp(prop(await state(),'vertex:stairs'));
    await arrive('bottom_of_stairs');
  }
  return go('w','south_bog');
}

async function act(input,command,trigger,scoreDelta=0) {
  const before=await state();
  await trigger();
  await until(s=>!s.processing&&s.turns>before.turns,'执行 '+command);
  const {s,lines}=await drain();
  assert.equal(s.room,'south_bog');
  assert.equal(s.lastCommand,command);
  assert.equal(s.turns,before.turns+1);
  assert.equal(s.score,before.score+scoreDelta);
  steps.push({input,command,text:lines,turn:s.turns,score:s.score});
  return {s,lines};
}

function checkLog(s) {
  assert.ok(prop(s,'south_bog:log'));
  assert.ok(!prop(s,'south_bog:heap'));
  assert.equal(splinters(s).length,0,'未搬开朽木前没有可点取的木片');
  assert.equal(inventory(s),0);
}

function checkHeap(s,{ground=0,carried=0}={}) {
  assert.ok(!prop(s,'south_bog:log'));
  assert.ok(prop(s,'south_bog:heap'));
  assert.equal(splinters(s).length,ground);
  assert.equal(inventory(s),carried);
}

async function reload(name,language) {
  const before=await state();
  await page.reload();
  await page.locator('#continue-save').click();
  await until(s=>!s.processing&&s.mode!=='title'&&s.room===before.room,'继续上一份存档');
  const {s}=await drain();
  for(const key of ['room','turns','score','inventory'])assert.deepEqual(s[key],before[key],key);
  assert.deepEqual(s.objects.map(o=>o.id).sort(),before.objects.map(o=>o.id).sort());
  if(language==='en') {
    await page.keyboard.press('Escape');
    await selectEnglish();
    await page.keyboard.press('Escape');
  }
  steps.push({input:'reload',turn:s.turns,score:s.score});
  await shot(name);
  return s;
}

async function dropWood() {
  await page.keyboard.press('i');
  await page.getByRole('button',{name:/^(木片|splinter)$/i}).click();
  assert.equal((await state()).heldItem,'splinter');
  await page.keyboard.press('i');
  return (await act('inventory','drop splinter',()=>page.locator('#inventory-drop').click())).s;
}

async function takeWood(firstScore,via='F') {
  const before=await state();
  const wood=splinters(before)[0];
  assert.ok(wood);
  if(!before.observed.includes(wood.id)) {
    await act(phone?'touch':'pointer','examine splinter',()=>clickProp(wood));
  }
  const choice=via==='F'?()=>page.keyboard.press('f'):()=>clickProp(wood);
  return (await act(via,'take splinter',choice,firstScore)).s;
}

async function lightArbor(score) {
  await go('se','trellises');
  await go('se','arborvitaes_n');
  await go('w','arboretum');
  await go('n','north_arbor');
  const top=await go('u','top_of_arbor');
  assert.equal(top.arborLight,'splinter');
  assert.equal(top.score,score);
  assert.equal(inventory(top),1);
  assert.equal(await page.locator('#arbor-dark-routes').isVisible(),false);
  assert.match(await page.locator('#room').textContent(),/藤架顶部/);
  await shot('wood-lights-arbor');
  return {room:top.room,light:top.arborLight,score:top.score};
}

async function untouched(language='cn') {
  await openCase('untouched',false,language);
  const onArrival=await enterBog();
  checkLog(onArrival);
  const log=prop(onArrival,'south_bog:log');
  const marker=onArrival.routeMarker;
  if(marker?.exit?.dir==='e') {
    const { x,y,rx,ry }=log.pointerShape;
    assert.ok(marker.left+marker.width<=x-rx || marker.left>=x+rx
      || marker.top+marker.height<=y-ry || marker.top>=y+ry,'楼梯口指示牌应避让画中的朽木');
  }
  await shot('intact');
  const observed=await act('pointer','examine log',()=>clickProp(log));
  assert.match(observed.lines.join(' '),language==='en'?/phosphorescence|decay/i:/磷光|腐朽|边缘/);
  checkLog(observed.s);
  checkLog(await reload('observed-still-intact',language));

  const beforeMove=await state();
  assert.equal(beforeMove.nearby,log.label);
  const broken=await act('F','move log',()=>page.keyboard.press('f'));
  assert.match(broken.lines.join(' '),language==='en'?/crumbles.*heap|splinter/i:/潮湿.*腐屑|木片/);
  checkHeap(broken.s,{ground:1});
  await shot('crumbled-and-loose');
  checkHeap(await reload('crumbled-after-reload',language),{ground:1});

  const taken=await takeWood(1);
  checkHeap(taken,{carried:1});
  assert.equal(taken.score,onArrival.score+1);
  const dropped=await dropWood();
  checkHeap(dropped,{ground:1});
  const point=splinters(dropped).map(({id,x,y})=>({id,x,y}));
  await shot('dropped');

  await go('e','bottom_of_stairs');
  const returned=await go('w','south_bog');
  checkHeap(returned,{ground:1});
  assert.deepEqual(splinters(returned).map(({id,x,y})=>({id,x,y})),point);
  const restored=await reload('returned-with-wood',language);
  assert.deepEqual(splinters(restored).map(({id,x,y})=>({id,x,y})),point);
  const retaken=await takeWood(0,'pointer');
  checkHeap(retaken,{carried:1});
  assert.equal(retaken.score,taken.score);
  await shot('retaken');
  const arbor=language==='cn'?await lightArbor(retaken.score):null;
  return {source:sources.untouched,language,initialScore:onArrival.score,finalScore:retaken.score,arbor,steps};
}

async function carriedLegacy() {
  await openCase('carried',true);
  const onArrival=await enterBog();
  checkHeap(onArrival,{carried:1});
  await shot('legacy-carried');
  const dropped=await dropWood();
  checkHeap(dropped,{ground:1});
  const retaken=await takeWood(0,'touch');
  checkHeap(retaken,{carried:1});
  assert.equal(retaken.score,onArrival.score);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await shot('legacy-retaken');
  return {source:sources.carried,initialScore:onArrival.score,finalScore:retaken.score,steps};
}

try {
  reports.push(await untouched());
  reports.push(await untouched('en'));
  reports.push(await carriedLegacy());
  assert.deepEqual(errors,[]);
  await writeFile(join(output,'result.json'),JSON.stringify({pass:true,reports,errors},null,2));
  console.log('真实未访档观察、搬朽木、首取加分、复取与旧档触摸，通过');
}catch(error){
  if(page)await shot('failure').catch(()=>{});
  await writeFile(join(output,'failure.json'),JSON.stringify({
    error:error.message,branch,current:page?await state().catch(()=>null):null,reports,steps,errors,
  },null,2));
  throw error;
}finally{
  await browser.close();
}
