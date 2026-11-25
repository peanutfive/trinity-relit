import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { pointerCenter } from './browser-islet-route.mjs';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const url = process.env.DEMO_URL || 'http://127.0.0.1:8080/2d-demo/';
const output = process.env.QA_OUTPUT || join(tmpdir(),'trinity-shack-paperback');
const upstream = join(output,'normal-island-route');
const checkpoint = process.env.PLAYED_SHACK_SAVE || join(upstream,'shack-shut-played.json');
await mkdir(output,{recursive:true});
if (!process.env.PLAYED_SHACK_SAVE) {
  const script = fileURLToPath(new URL('./browser-islet.mjs',import.meta.url));
  await promisify(execFile)(process.execPath,[script],{env:{...process.env,DEMO_URL:url,QA_OUTPUT:upstream}});
}
const original = JSON.parse(await readFile(checkpoint,'utf8'));
assert.equal(original.engine.state.room,'shack');
assert.ok(!['inventory','pocket','worn'].includes(original.engine.state.itemLoc.paperback));
assert.ok(original.engine.state.flags.includes('river_ferry_crossed'));

const browser = await chromium.launch({headless:true});
const page = await browser.newPage({viewport:{width:1440,height:900},hasTouch:true});
const errors = [], receipts = [];
page.setDefaultTimeout(8000);
page.on('pageerror',error=>errors.push(error.message));
page.on('console',message=>{if(message.type()==='error') errors.push(message.text());});
page.on('response',response=>{if(response.status()>=400) errors.push(response.status()+' '+response.url());});

const state = () => page.evaluate(() => JSON.parse(window.render_game_to_text()));
const tick = ms => page.evaluate(ms => window.advanceTime(ms),ms);
const shot = name => page.screenshot({path:join(output,name+'.png')});
const physicalBook = current => current.objects.filter(object=>object.itemId==='paperback');
const feet = current => [current.player.x,current.player.y,current.player.facing];
function bookOnFloor(current,id) {
  const books = physicalBook(current);
  assert.equal(books.length,1);
  const [item] = books;
  assert.equal(item.id,id);
  return {id:item.id,x:item.x,y:item.y,drawAt:item.drawAt??item.visualOptions?.drawAt??null,pointerShape:item.pointerShape};
}

async function until(check,label) {
  for (let step = 0; step < 165; step++) {
    const current = await state();
    if (check(current)) return current;
    await tick(75);
  }
  const current = await state();
  throw Error(`${label} · ${current.room} ${current.lastCommand} ${feet(current)}`);
}

async function drain() {
  for (let step = 0; step < 75; step++) {
    const current = await until(s=>!s.processing,'动作未结算');
    if (current.mode==='dialogue') await page.keyboard.press('f');
    else if (current.narrative.busy) await tick(100);
    else return current;
  }
  throw Error('文字或过场未结束');
}

async function clickAt([x,y],touch = false) {
  const box = await page.locator('canvas').boundingBox();
  assert.ok(box);
  const point = [box.x+x*box.width/480,box.y+y*box.height/288];
  if (touch) await page.touchscreen.tap(...point);
  else await page.mouse.click(...point);
}

async function action(command,input,label) {
  const before = await drain();
  await input();
  const current = await until(s=>!s.processing && s.turns>before.turns,`未完成 ${command}`);
  assert.equal(current.lastCommand,command);
  assert.equal(current.turns,before.turns+1);
  assert.equal(current.score,before.score);
  await drain();
  receipts.push({command,input:label,from:before.room,to:current.room,turn:current.turns,foot:feet(current)});
  return current;
}

async function walkTo([x,y]) {
  const before = await drain();
  await clickAt([x,y]);
  const arrived = await until(s=>!s.processing && !s.navigation.path.length,'未走到地面脚点');
  assert.equal(arrived.room,before.room);
  assert.equal(arrived.turns,before.turns);
  assert.ok(Math.hypot(arrived.player.x-x,arrived.player.y-y)<7);
}

async function walkBesideBook(item) {
  await walkTo([item.x-12,item.y]);
  await page.keyboard.down('d');
  try { await tick(12); }
  finally { await page.keyboard.up('d'); }
  assert.equal((await state()).nearby,'平装书');
}

async function westernPassage(direction,destination) {
  const before = await state();
  const found = before.objects.find(item=>item.id===`${before.room}:passage:${direction}`);
  const after = await action(direction,()=>clickAt(pointerCenter(found)),'mouse');
  assert.equal(after.room,destination);
  assert.equal(after.navigation.arrival?.fromRoom,before.room);
}

async function dropBook() {
  await page.keyboard.press('i');
  await page.getByRole('button',{name:'平装书',exact:true}).click();
  await action('drop book',async()=>{
    await page.keyboard.press('i');
    await page.locator('#inventory-drop').click();
  },'inventory');
  assert.ok(!(await state()).inventory.includes('paperback'));
}

async function reopen(screenshot) {
  const before = await drain();
  await page.keyboard.press('Escape');
  await page.getByRole('tab',{name:'探索进度'}).click();
  await page.locator('#save-now').click();
  await page.reload();
  await page.locator('#continue-save').click();
  await until(s=>s.room===before.room && !s.processing && s.art==='loaded','未恢复实际进度');
  const current = await drain();
  assert.equal(current.turns,before.turns);
  assert.deepEqual(current.inventory,before.inventory);
  assert.deepEqual(feet(current),feet(before));
  await shot(screenshot);
  receipts.push({case:'reload',room:current.room,turn:current.turns});
}

try {
  await page.goto(url);
  await page.waitForFunction(()=>window.render_game_to_text && JSON.parse(window.render_game_to_text()).art==='loaded');
  await page.locator('#start').click();
  await drain();
  await page.keyboard.press('Escape');
  await page.getByRole('tab',{name:'探索进度'}).click();
  await page.locator('#save-file').setInputFiles(checkpoint);
  await until(s=>s.room==='shack' && !s.processing,'正式棚屋进度无法导入');
  await drain();

  const initial = bookOnFloor(await state(),'shack:paperback');
  await walkBesideBook(initial);
  const cover = await action('examine book',()=>page.keyboard.press('f'),'F');
  assert.match(cover.dialogue?.text,/荒岛十日谈/);
  assert.ok(!cover.inventory.includes('paperback'));
  await page.setViewportSize({width:844,height:390});
  const taken = await action('take book',()=>clickAt(pointerCenter(initial),true),'touch');
  assert.ok(taken.inventory.includes('paperback'));
  assert.deepEqual(physicalBook(taken),[]);
  await page.setViewportSize({width:1440,height:900});
  await shot('shack-book-carried');
  await westernPassage('w','tower_platform');
  assert.ok((await state()).inventory.includes('paperback'));
  await walkTo([248,153]);
  await dropBook();
  const platformBook = bookOnFloor(await state(),'desert:item:paperback');
  await shot('book-on-platform');
  await westernPassage('e','shack');
  assert.deepEqual(physicalBook(await state()),[]);
  await westernPassage('w','tower_platform');
  assert.deepEqual(bookOnFloor(await state(),'desert:item:paperback'),platformBook);
  await reopen('book-on-platform-restored');
  assert.deepEqual(bookOnFloor(await state(),'desert:item:paperback'),platformBook);

  await page.setViewportSize({width:844,height:390});
  const point = pointerCenter(platformBook);
  if (!(await state()).observed.includes(platformBook.id)) await action('examine book',()=>clickAt(point,true),'touch');
  assert.ok((await action('take book',()=>clickAt(point,true),'touch')).inventory.includes('paperback'));
  await page.setViewportSize({width:1440,height:900});
  await westernPassage('e','shack');
  await walkTo([242,220]);
  await dropBook();
  const backInside = bookOnFloor(await state(),'shack:paperback');
  assert.ok(Math.hypot(initial.x-backInside.x,initial.y-backInside.y)>25);
  await shot('book-in-new-shack-spot');
  await walkBesideBook(backInside);
  assert.ok((await action('take book',()=>page.keyboard.press('f'),'F')).inventory.includes('paperback'));
  await reopen('shack-book-carried-restored');
  assert.deepEqual(physicalBook(await state()),[]);
  assert.equal((await state()).inventory.filter(id=>id==='paperback').length,1);
  assert.deepEqual(errors,[]);
  await writeFile(join(output,'result.json'),JSON.stringify({pass:true,receipts,platformBook,backInside,errors},null,2));
  console.log('通过棚屋读书、键盘和手机拾放、跨房及刷新续玩');
} catch (error) {
  await shot('failure').catch(()=>{});
  await writeFile(join(output,'failure.json'),JSON.stringify({message:error.message,state:await state().catch(()=>null),receipts,errors},null,2));
  throw error;
} finally {
  await browser.close();
}
