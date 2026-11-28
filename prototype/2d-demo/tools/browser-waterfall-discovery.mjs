// Follow the painted bank from an actual earlier game save in desktop and touch sessions.
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pointerCenter } from './browser-islet-route.mjs';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const stairsJourney = process.argv.includes('--stairs');
const source = process.env.PLAYED_VERTEX_SAVE || fileURLToPath(
  new URL('../../../artifacts/agent-team/evidence/t60-vertex-regression/vertex-installed.json',import.meta.url));
const legacy = stairsJourney
  ? process.env.PLAYED_OLD_CEMETERY_SAVE || fileURLToPath(new URL('../../../artifacts/agent-team/evidence/t47-t48-ferry-final/cemetery-coin-and-shroud-restored.json',import.meta.url))
  : process.env.PLAYED_OLD_CAVERN_SAVE || fileURLToPath(new URL('../../../artifacts/agent-team/evidence/t65-waterfall-discovery/pre-t65-cavern.json',import.meta.url));
const output = process.env.QA_OUTPUT || join(tmpdir(),stairsJourney?'trinity-waterfall-stairs':'trinity-waterfall-discovery');
const url = process.env.DEMO_URL || 'http://127.0.0.1:8080/2d-demo/';
const original = JSON.parse(await readFile(source,'utf8')).engine.state;
const foundFlag = 'waterfall_opening_found';
const sprayId = 'waterfall:spray';
const iceExit = 'ice_cavern:exit';
const stepsLower = 'waterfall:steps';
const stepsUpper = 'cemetery:steps';
const bank = [[300,166],[311,145],[301,132],[283,119],[262,110],[242,103],[216,95],[192,88],[168,82],[147,79]];
assert.equal(original.room,'vertex');
assert.ok(!original.visited.includes('waterfall') && !original.flags.includes(foundFlag));
await mkdir(output,{recursive:true});

const browser = await chromium.launch({headless:true});
const reports = [];
const errors = [];

async function replay(touch,file=source){
  const oldSave = file===legacy;
  const prefix = oldSave ? 'legacy' : touch ? 'mobile' : 'desktop';
  const initial = oldSave ? JSON.parse(await readFile(file,'utf8')).engine.state : original;
  const page = await browser.newPage(touch ? {viewport:{width:390,height:844},hasTouch:true,isMobile:true} : {viewport:{width:1440,height:900}});
  page.on('pageerror',error=>errors.push(`${prefix}: ${error.message}`));
  page.on('console',message=>{ if(message.type()==='error')errors.push(`${prefix}: ${message.text()}`); });
  page.on('response',res=>{ if(res.status()>=400)errors.push(`${prefix}: ${res.status()} ${res.url()}`); });
  const state = () => page.evaluate(() => JSON.parse(window.render_game_to_text()));
  const tick = ms => page.evaluate(value=>window.advanceTime(value),ms);
  const shot = name => page.screenshot({path:join(output,`${prefix}-${name}.png`)});
  const compass = () => page.locator('.compass').getAttribute('aria-label');
  const object = (s,id) => s.objects.find(prop=>prop.id===id);
  const hasPassage = s => s.exits.some(e=>!e.locked && e.dir==='w' && e.target==='ice_cavern');
  const records = [];

  async function until(predicate,label){
    for(let frame=0;frame<180;frame++){
      const s = await state();
      if(predicate(s))return s;
      await tick(80);
    }
    const s = await state();
    throw Error(`${label} · ${s.room}, ${s.mode}, (${s.player.x},${s.player.y}), ${s.lastCommand}`);
  }

  async function drain(){
    const text = [];
    for(let i=0;i<80;i++){
      const s = await until(s=>!s.processing,'等待读写');
      if(s.mode==='dialogue'){
        text.push(s.dialogue.text);
        await page.locator('#next').click();
      }else if(s.narrative.busy)await tick(100);
      else return {s,text};
    }
    throw Error('对白仍未结束');
  }

  async function click([x,y]){
    const box = await page.locator('canvas').boundingBox();
    assert.ok(box);
    const point = [box.x+x*box.width/480,box.y+y*box.height/288];
    if(touch)await page.touchscreen.tap(...point);
    else await page.mouse.click(...point);
  }

  function clickProp(prop){
    assert.ok(prop);
    if(prop.kind==='cliff_stone_steps')return click([prop.x,prop.y]);
    return click(prop.pointerShape?pointerCenter(prop):[prop.x,prop.y-5]);
  }

  async function hold(key,ms){
    await page.keyboard.down(key);
    try{await tick(ms);}finally{await page.keyboard.up(key);}
  }

  async function through(to,cmd,from,input){
    await input();
    await until(s=>s.room===to&&!s.processing,`${cmd} 从 ${from} 走到 ${to}`);
    const {s,text} = await drain();
    assert.equal(s.lastCommand,cmd);
    assert.equal(s.navigation.arrival?.fromRoom,from);
    assert.equal(s.score,initial.score);
    records.push({from,to,command:cmd,arrival:s.navigation.arrival,turn:s.turns,text});
    return s;
  }

  async function walkExit(dir,to){
    const before = await state();
    const e = before.exits.find(exit=>exit.dir===dir&&exit.target===to&&!exit.locked);
    assert.ok(e,`${before.room} ${dir} ${to}`);
    await tick(550);
    return through(to,dir,before.room,()=>click([e.x,e.y]));
  }

  async function command(cmd,input){
    await input();
    await until(s=>s.mode==='dialogue'&&!s.processing&&s.lastCommand===cmd,cmd);
    const {s,text} = await drain();
    records.push({room:s.room,command:cmd,turn:s.turns,text});
    return {s,text};
  }

  function verifyArrival(s,[x,y],facing,before){
    assert.deepEqual([s.player.x,s.player.y,s.player.facing],[x,y,facing]);
    assert.deepEqual(s.inventory,before.inventory);
    assert.equal(s.turns,before.turns+1);
  }

  async function observeSteps(id,input){
    const before = await state();
    const steps = object(before,id);
    assert.ok(steps);
    const {s,text} = await command('examine steps',input||(()=>clickProp(steps)));
    assert.equal(s.room,before.room);
    assert.equal(s.turns,before.turns+1);
    assert.equal(s.score,before.score);
    assert.match(text.join(' '),/凿|刻/);
    return s;
  }

  async function checkStairsMap(expectConnection){
    const before = await state();
    await page.keyboard.press('m');
    await until(s=>s.mode==='map','打开章节地图');
    const connection = page.locator('[data-from="waterfall"][data-to="cemetery"], [data-from="cemetery"][data-to="waterfall"]');
    assert.equal(await connection.count(),Number(expectConnection),'未探索或已探索的同一座石阶');
    if(expectConnection){
      assert.ok((await connection.getAttribute('class')).includes('map-stairway'));
      const from = await connection.getAttribute('data-from');
      const to = await connection.getAttribute('data-to');
      records.push({map:[from,to],stairs:true});
      await shot('stairs-map');
    }
    await page.keyboard.press('m');
    assert.equal((await state()).turns,before.turns);
  }

  async function walkStairs(arrival){
    assert.equal(arrival.room,'waterfall');
    const exits = arrival.exits.filter(e=>!e.locked);
    assert.deepEqual(exits.filter(e=>e.target==='cemetery').map(e=>e.dir),['n']);
    for(const [dir,target] of [['ne','north_bog'],['e','south_bog'],['se','forest_clearing']]){
      assert.ok(exits.some(e=>e.dir===dir&&e.target===target));
    }
    assert.equal(hasPassage(arrival),false);
    await checkStairsMap(false);
    if(!touch){
      await walkExit('ne','north_bog');
      await walkExit('sw','waterfall');
      await click([240,103]);
      await until(s=>!s.navigation.path.length&&Math.hypot(s.player.x-240,s.player.y-103)<=4,'在岩沿接近石阶');
      await page.keyboard.down('ArrowLeft');
      try{await hold('ArrowUp',220);}finally{await page.keyboard.up('ArrowLeft');}
      await hold('ArrowUp',50);
      assert.equal((await state()).room,'waterfall');
      assert.equal((await state()).nearby,object(await state(),stepsLower).label);
    }
    const lower = async()=>clickProp(object(await state(),stepsLower));
    const upper = async()=>clickProp(object(await state(),stepsUpper));
    const enter = touch ? lower : ()=>page.keyboard.press('f');
    const inspected = await observeSteps(stepsLower,enter);
    await shot('stairs-before-ascent');
    const cemetery = await through('cemetery','n','waterfall',enter);
    verifyArrival(cemetery,[251,240],'up',inspected);
    assert.deepEqual(cemetery.exits.filter(e=>!e.locked&&e.target==='waterfall').map(e=>e.dir),['s']);
    assert.ok(!cemetery.exits.some(e=>e.target==='cottage'));
    await shot('stairs-arrival-at-cemetery');
    await checkStairsMap(true);
    await page.reload();
    await page.locator('#continue-save').click();
    await until(s=>s.room==='cemetery'&&s.mode!=='title'&&!s.processing,'在墓地续玩');
    const {s:restored} = await drain();
    assert.equal(restored.turns,cemetery.turns);
    assert.deepEqual([restored.player.x,restored.player.y],[251,240]);

    const beforeDown = touch ? await observeSteps(stepsUpper) : restored;
    await tick(550);
    const waterfall = await through('waterfall','s','cemetery',touch?upper:()=>hold('ArrowDown',1050));
    verifyArrival(waterfall,[210,41],'right',beforeDown);
    assert.equal(hasPassage(waterfall),false);
    assert.notEqual(waterfall.navigation.arrival.entrance,'ne');
    await shot('stairs-return-to-rock');
    await checkStairsMap(true);
  }

  try{
    await page.goto(url);
    await page.waitForFunction(()=>window.render_game_to_text&&JSON.parse(window.render_game_to_text()).art==='loaded');
    await page.locator('#start').click();
    await drain();
    await page.keyboard.press('Escape');
    await page.getByRole('tab',{name:'探索进度'}).click();
    await page.locator('#save-file').setInputFiles(file);
    await until(s=>s.room===initial.room&&s.mode!=='paused'&&!s.processing,'读取实际存档');
    const {s:loaded} = await drain();
    assert.equal(loaded.turns,initial.turns);

    if(oldSave&&stairsJourney){
      assert.equal(loaded.room,'cemetery');
      assert.equal(initial.itemLoc.silver_coin,'inventory');
      assert.equal(initial.itemLoc.shroud,'worn');
      assert.ok(!initial.visited.includes('waterfall'));
      const seen = await observeSteps(stepsUpper);
      const returned = await through('waterfall','s','cemetery',()=>clickProp(object(seen,stepsUpper)));
      verifyArrival(returned,[210,41],'right',seen);
      assert.ok(returned.inventory.includes('spade')&&returned.inventory.includes('silver_coin'));
      await checkStairsMap(true);
      await shot('stairs-from-old-save');
      reports.push({legacy:file,records,finalTurn:returned.turns});
      return;
    }
    if(oldSave){
      assert.equal(loaded.room,'ice_cavern');
      assert.ok(!loaded.flags.includes(foundFlag));
      assert.ok(loaded.exits.some(exit=>exit.dir==='out'&&exit.target==='under_cliff'));
      await shot('before-return');
      await click([66,145]);
      await until(s=>!s.navigation.path.length&&s.nearby==='洞外的光','走到旧档洞外亮口');
      const returned = await through('under_cliff','out','ice_cavern',()=>page.keyboard.press('f'));
      assert.ok(!returned.exits.some(exit=>exit.target==='ice_cavern'));
      assert.ok(!object(returned,'under_cliff:ice-entry'));
      await click([237,86]);
      await tick(1200);
      const atWall = await state();
      assert.equal(atWall.room,'under_cliff');
      assert.equal(atWall.turns,returned.turns);
      await shot('cliff-wall');
      reports.push({legacy:file,records,finalTurn:atWall.turns});
      return;
    }

    await through('bottom_of_stairs','d','vertex',()=>clickProp(object(loaded,'vertex:stairs')));
    await walkExit('w','south_bog');
    const arrival = await walkExit('w','waterfall');
    assert.ok(arrival.backgrounds.includes('./assets/waterfall-v3.webp'),'应加载带连续岩沿和石阶的底图');
    assert.equal(await compass(),'北在上方');
    if(stairsJourney){
      await walkStairs(arrival);
      reports.push({touch,records,finalTurn:(await state()).turns});
      return;
    }
    assert.equal(hasPassage(arrival),false);
    assert.equal(arrival.flags.includes(foundFlag),false);
    const ordinary = await command('examine waterfall',()=>click([106,56]));
    assert.match(ordinary.text.join(' '),/白色水帘/);
    assert.equal(ordinary.s.turns,arrival.turns);
    assert.equal(hasPassage(ordinary.s),false);
    assert.ok(!ordinary.s.flags.includes(foundFlag));
    await shot('ordinary-falls');

    for(const [index,point] of bank.entries()){
      await click(point);
      const step = await until(s=>s.room==='waterfall'&&!s.navigation.path.length
        && Math.hypot(s.player.x-point[0],s.player.y-point[1])<=4,'沿岸逐段行走 '+point.join(','));
      assert.equal(step.turns,arrival.turns);
      assert.equal(step.routeMarker?.exit?.target==='ice_cavern',false);
      records.push({waypoint:point,actual:[step.player.x,step.player.y]});
      if(index===6&&!touch){
        await hold('ArrowDown',550);
        const blocked = await state();
        assert.equal(blocked.room,'waterfall');
        assert.ok(blocked.player.y<114,'应被水体挡住');
        assert.equal(blocked.player.x,step.player.x);
        records.push({waterBlocked:[blocked.player.x,blocked.player.y]});
      }
    }

    if(!touch){
      await hold('ArrowLeft',410);
      const blocked = await state();
      assert.equal(blocked.room,'waterfall');
      assert.equal(blocked.flags.includes(foundFlag),false);
      assert.ok(blocked.player.x>=120,'找不到洞以前，向西走应被实体边缘挡住');
      records.push({unseenOpeningBlocked:[blocked.player.x,blocked.player.y]});
    }
    await shot('bank-before-inspection');
    const {s:found,text} = await command('search waterfall',()=>touch?click([126,80]):page.keyboard.press('f'));
    assert.match(text.join(' '),/岩壁上发现了一处开口/);
    assert.equal(found.turns,arrival.turns+1);
    assert.ok(found.flags.includes(foundFlag));
    assert.ok(hasPassage(found));
    assert.ok(object(found,sprayId).actions.some(action=>action.command==='w'));
    assert.equal(found.routeMarker?.exit?.target,'ice_cavern');
    assert.match(found.routeMarker?.text,/^←.*冰穴/);
    await shot('bank-after-inspection');

    const inside = await through('ice_cavern','w','waterfall',()=>touch?click([126,80]):page.keyboard.press('f'));
    assert.equal(await compass(),'北在下方');
    assert.ok(inside.exits.some(exit=>exit.dir==='out'&&exit.target==='waterfall'));
    assert.ok(inside.flags.includes(foundFlag));
    await shot('ice-cavern');
    await page.reload();
    await page.locator('#continue-save').click();
    await until(s=>s.room==='ice_cavern'&&s.mode!=='title'&&!s.processing,'读档留在冰穴');
    const {s:restored} = await drain();
    assert.equal(restored.turns,inside.turns);
    assert.ok(restored.flags.includes(foundFlag));
    assert.equal(await compass(),'北在下方');

    const returned = await through('waterfall','out','ice_cavern',()=>clickProp(object(restored,iceExit)));
    assert.deepEqual([returned.player.x,returned.player.y],[148,80]);
    assert.equal(returned.player.facing,'right');
    assert.equal(await compass(),'北在上方');
    assert.ok(hasPassage(returned));
    assert.ok(returned.flags.includes(foundFlag));
    await shot('shore-after-return');

    await tick(550);
    await through('ice_cavern','w','waterfall',()=>touch?click([126,80]):hold('ArrowLeft',550));
    records.push({reentered:touch?'tap':'ArrowLeft'});
    reports.push({touch,records,finalTurn:(await state()).turns});
  }catch(error){
    await shot('failure').catch(()=>{});
    reports.push({touch,records,state:await state().catch(()=>null)});
    throw error;
  }finally{
    await page.close();
  }
}

try{
  const failures = [];
  for(const touch of [false,true]){
    try{await replay(touch);}catch(error){failures.push(error.message);}
  }
  try{await replay(false,legacy);}catch(error){failures.push(error.message);}
  if(failures.length)throw Error(failures.join('\n'));
  assert.deepEqual(errors,[]);
  await writeFile(join(output,'result.json'),JSON.stringify({pass:true,source,reports,errors},null,2));
  console.log(stairsJourney?'瀑布石阶和墓地双向新路线、地图与旧档均已实走通过':'瀑布岩沿、冰穴发现与往返，含键鼠、手机和续玩，均已实走通过');
}catch(error){
  await writeFile(join(output,'failure.json'),JSON.stringify({message:error.message,reports,errors},null,2));
  throw error;
}finally{
  await browser.close();
}
