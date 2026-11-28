// Run the same played, unsearched Ossuary checkpoint by keyboard and touch.
// Recreate the input file with browser-dial-doors.mjs --ossuary-checkpoint.
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pointerCenter } from './browser-islet-route.mjs';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const source = process.env.PLAYED_OSSUARY_SAVE || fileURLToPath(
  new URL('../../../artifacts/agent-team/evidence/t67-ossuary-new-checkpoint/ossuary-unsearched.json',import.meta.url));
const legacy = process.env.PLAYED_LEGACY_OSSUARY_SAVE || fileURLToPath(
  new URL('../../../artifacts/agent-team/evidence/t67-ossuary-checkpoint/ossuary-unsearched.json',import.meta.url));
const output = process.env.QA_OUTPUT || join(tmpdir(),'trinity-ossuary-key');
const url = process.env.DEMO_URL || 'http://127.0.0.1:8080/2d-demo/';
const initial = JSON.parse(await readFile(source,'utf8'));
const keyId = 'key_barrow';
const bonesId = 'ossuary:bones';
const fingerKeyId = 'ossuary:skeleton-key';
const saved = initial.engine.state;
assert.equal(saved.room,'ossuary');
assert.ok(saved.visited.includes('waterfall')&&saved.visited.includes('barrow'));
assert.equal(saved.itemLoc[keyId],'ossuary_fingers');
assert.ok(!saved.flags.includes('ossuary_bones_searched'));
await mkdir(output,{recursive:true});

const browser = await chromium.launch({headless:true});
const errors = [];
const reports = [];

async function replay(touch,file=source){
  const oldSave=file===legacy;
  const prefix = oldSave?'legacy':touch?'mobile':'desktop';
  const check = oldSave?JSON.parse(await readFile(file,'utf8')).engine.state:saved;
  const page = await browser.newPage(touch?{viewport:{width:390,height:844},hasTouch:true,isMobile:true}:{viewport:{width:1440,height:900}});
  page.on('pageerror',error=>errors.push(`${prefix}: ${error.message}`));
  page.on('console',message=>{ if(message.type()==='error')errors.push(`${prefix}: ${message.text()}`); });
  page.on('response',response=>{ if(response.status()>=400)errors.push(`${prefix}: ${response.status()} ${response.url()}`); });
  const state=()=>page.evaluate(()=>JSON.parse(window.render_game_to_text()));
  const tick=ms=>page.evaluate(value=>window.advanceTime(value),ms);
  const keyObjects=s=>s.objects.filter(object=>object.itemId===keyId&&object.visual!==false);
  const carried=s=>s.inventory.filter(id=>id===keyId).length;
  const bones=s=>s.objects.find(object=>object.id===bonesId);
  const shot=name=>page.screenshot({path:join(output,`${prefix}-${name}.png`)});
  const records=[];

  async function until(predicate,label){
    for(let frame=0;frame<180;frame++){
      const s=await state();
      if(predicate(s))return s;
      await tick(80);
    }
    const s=await state();
    throw Error(`${label} · ${s.room}, ${s.mode}, (${s.player.x},${s.player.y}), ${s.lastCommand}`);
  }

  async function drain(){
    const text=[];
    for(let i=0;i<80;i++){
      const s=await until(s=>!s.processing,'等待读写');
      if(s.mode==='dialogue'){
        text.push(s.dialogue.text);
        const next=page.locator('#next');
        if(touch)await next.tap();
        else await next.click();
      }else if(s.narrative.busy)await tick(100);
      else return {s,text};
    }
    throw Error('对白仍未结束');
  }

  async function click([x,y]){
    const rect=await page.locator('canvas').boundingBox();
    assert.ok(rect);
    const point=[rect.x+x*rect.width/480,rect.y+y*rect.height/288];
    if(touch)await page.touchscreen.tap(...point);
    else await page.mouse.click(...point);
  }

  function clickProp(prop){
    assert.ok(prop);
    return click(pointerCenter(prop));
  }

  async function act(command,input,points=0){
    const before=await state();
    await input();
    await until(s=>!s.processing&&s.lastCommand===command&&(s.mode==='dialogue'||s.turns>before.turns),command);
    const result=await drain();
    assert.equal(result.s.score,before.score+points);
    assert.equal(result.s.room,before.room);
    records.push({command,score:result.s.score,turn:result.s.turns,text:result.text,keysOnScene:keyObjects(result.s).length,carried:carried(result.s)});
    return result;
  }

  async function reload(name){
    const before=await state();
    await page.reload();
    await page.locator('#continue-save').click();
    await until(s=>s.room==='ossuary'&&s.mode!=='title'&&!s.processing,'读档恢复纳骨堂');
    const {s}=await drain();
    assert.equal(s.turns,before.turns);
    assert.equal(s.score,before.score);
    assert.deepEqual(s.inventory,before.inventory);
    assert.deepEqual(keyObjects(s).map(key=>[key.id,key.x,key.y]),keyObjects(before).map(key=>[key.id,key.x,key.y]));
    records.push({restored:name,turn:s.turns,score:s.score});
    return s;
  }

  async function exportKey(){
    await page.keyboard.press('Escape');
    await page.getByRole('tab',{name:'探索进度'}).click();
    const download=page.waitForEvent('download');
    await page.locator('#export-save').click();
    const path=join(output,'ossuary-key-taken-played.json');
    await (await download).saveAs(path);
    await page.keyboard.press('Escape');
    return path;
  }

  async function takeGroundKey(key){
    assert.notEqual(key.id,fingerKeyId);
    const firstAction=key.actions[0].command;
    if(firstAction.startsWith('examine ')&&!(await state()).observed.includes(key.id))
      await act(firstAction,()=>clickProp(key));
    const take=key.actions.find(choice=>choice.command.startsWith('take ')).command;
    const regained=await act(take,()=>clickProp(key));
    assert.equal(carried(regained.s),1);
    assert.equal(keyObjects(regained.s).length,0);
    return regained.s;
  }

  async function dropBesidePlayer(){
    await page.keyboard.press('i');
    await page.getByRole('button',{name:'骸骨钥匙',exact:true}).click();
    const before=await state();
    assert.equal(before.heldItem,keyId);
    await page.keyboard.press('i');
    const {s}=await act('drop skeleton key',()=>page.locator('#inventory-drop').click());
    assert.equal(carried(s),0);
    const drops=keyObjects(s);
    assert.equal(drops.length,1);
    const [key]=drops;
    assert.notEqual(key.id,fingerKeyId);
    assert.ok(Math.hypot(key.x-before.player.x,key.y-before.player.y)<25,'钥匙应在玩家脚边，而非回到固定位置');
    records.push({placedKey:[key.x,key.y],player:[before.player.x,before.player.y]});
    return {s,key};
  }

  try{
    await page.goto(url);
    await page.waitForFunction(()=>window.render_game_to_text&&JSON.parse(window.render_game_to_text()).art==='loaded');
    await page.locator('#start').click();
    await drain();
    await page.keyboard.press('Escape');
    await page.getByRole('tab',{name:'探索进度'}).click();
    await page.locator('#save-file').setInputFiles(file);
    await until(s=>s.room==='ossuary'&&s.mode!=='paused'&&!s.processing,'导入真实纳骨堂存档');
    const {s:arrived}=await drain();
    assert.equal(arrived.turns,check.turns);
    assert.equal(arrived.score,check.score);
    if(oldSave){
      assert.equal(check.itemLoc[keyId],'ossuary');
      assert.equal(keyObjects(arrived).length,1);
      assert.notEqual(keyObjects(arrived)[0].id,fingerKeyId);
      await shot('original-loose-key');
      await act('examine bones',()=>clickProp(bones(arrived)));
      await act('search bones',()=>clickProp(bones(arrived)));
      const sifted=await state();
      assert.equal(keyObjects(sifted).length,1);
      const taken=await takeGroundKey(keyObjects(sifted)[0]);
      assert.equal(taken.score,check.score);
      await reload('legacy-original-loose-key-taken');
      reports.push({legacy:file,records,score:taken.score});
      return;
    }
    assert.equal(keyObjects(arrived).length,0);
    await shot('before-search');

    let inspectBones=()=>clickProp(bones(arrived));
    if(!touch){
      const pile=bones(arrived);
      await click([pile.x+18,pile.y]);
      await until(s=>!s.navigation.path.length&&s.nearby===pile.label,'走到骸骨前');
      inspectBones=()=>page.keyboard.press('f');
    }
    const viewed=await act('examine bones',inspectBones);
    assert.equal(keyObjects(viewed.s).length,0);
    assert.equal(carried(viewed.s),0);
    const discovered=await act('search bones',inspectBones);
    assert.equal(keyObjects(discovered.s).length,1);
    const key=keyObjects(discovered.s)[0];
    assert.equal(key.id,fingerKeyId);
    assert.match(discovered.text.join(' '),/钥匙/);
    assert.ok(bones(discovered.s).visualOptions?.handExposed);
    await shot('found-in-fingers');

    await reload('revealed-on-fingers');
    const examined=await act('examine key',()=>clickProp(key));
    assert.equal(keyObjects(examined.s).length,1);
    assert.equal(carried(examined.s),0);
    assert.match(examined.text.join(' '),/弯曲.*手指/);
    const obtained=await act('take key',touch?()=>clickProp(key):()=>page.keyboard.press('f'),1);
    assert.equal(keyObjects(obtained.s).length,0);
    assert.equal(carried(obtained.s),1);
    await shot('after-taking');
    const checkpoint=touch?null:await exportKey();
    await reload('carried-key');

    const repeated=await act('search bones',()=>clickProp(bones(obtained.s)));
    assert.match(repeated.text.join(' '),/没有发现/);
    const searched=await state();
    assert.equal(carried(searched),1);
    assert.equal(keyObjects(searched).length,0);
    if(!touch){
      const placed=await dropBesidePlayer();
      await shot('dropped-to-ground');
      await reload('dropped-key');
      await act('search bones',()=>clickProp(bones(placed.s)));
      const undone=await state();
      assert.equal(keyObjects(undone).length,1);
      const regained=await takeGroundKey(keyObjects(undone)[0]);
      assert.equal(regained.score,saved.score+1);
      await click([239,181]);
      await until(s=>!s.navigation.path.length&&Math.hypot(s.player.x-239,s.player.y-181)<=4,'移动到另一段地面');
      const another=await dropBesidePlayer();
      assert.ok(Math.hypot(another.key.x-placed.key.x,another.key.y-placed.key.y)>30);
      await shot('dropped-at-new-position');
      assert.equal((await takeGroundKey(another.key)).score,saved.score+1);
    }
    reports.push({touch,checkpoint,records,score:(await state()).score});
  }catch(error){
    await shot('failure').catch(()=>{});
    reports.push({touch,records,state:await state().catch(()=>null)});
    throw error;
  }finally{
    await page.close();
  }
}

try{
  const failures=[];
  for(const touch of [false,true]){
    try{await replay(touch);}catch(error){failures.push(error.message);}
  }
  try{await replay(false,legacy);}catch(error){failures.push(error.message);}
  if(failures.length)throw Error(failures.join('\n'));
  assert.deepEqual(errors,[]);
  await writeFile(join(output,'result.json'),JSON.stringify({pass:true,source,reports,errors},null,2));
  console.log('骨堆发现、指间钥匙、触摸、放下、续玩和重取均已通过');
}catch(error){
  await writeFile(join(output,'failure.json'),JSON.stringify({message:error.message,reports,errors},null,2));
  throw error;
}finally{
  await browser.close();
}
