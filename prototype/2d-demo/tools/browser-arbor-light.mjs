// Play through real T52 saves, plus an old export made before the ladder was removed.
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pointerCenter } from './browser-islet-route.mjs';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const url = process.env.DEMO_URL || 'http://127.0.0.1:8080/2d-demo/';
const output = process.env.QA_OUTPUT || join(tmpdir(),'trinity-arbor-light');
const evidence = fileURLToPath(new URL('../../../artifacts/agent-team/evidence/',import.meta.url));
const t52 = join(evidence,'t52-gnomon-reference-final');
const legacy = join(evidence,'t60-arbor-legacy-saves');
const files = {
  dark:process.env.PLAYED_ARBOR_UNLIT_SAVE || join(t52,'vertex-mismatched.json'),
  lit:process.env.PLAYED_ARBOR_LIT_SAVE || join(t52,'hd2d-export.json'),
  legacy:process.env.LEGACY_ARBOR_TOP_SAVE || join(legacy,'without-light-top-played.json'),
};
await mkdir(output,{recursive:true});

const browser = await chromium.launch({ headless:true });
const reports = [];
const errors = [];
let page;
let testName;
let phone;
let routes;
const state = () => page.evaluate(() => JSON.parse(window.render_game_to_text()));
const tick = ms => page.evaluate(ms => window.advanceTime(ms),ms);
const shot = file => page.screenshot({ path:join(output,testName+'-'+file+'.png') });
const prop = (s,id) => s.objects.find(object => object.id===id);
const items = (s,id) => s.objects.filter(object => object.itemId===id);
const feet = s => [s.player.x,s.player.y,s.player.facing];
const visible = (s,id) => items(s,id).filter(object => object.visual!==false);

async function until(predicate,reason) {
  for (let frame=0; frame<170; frame++) {
    const s = await state();
    if (predicate(s)) return s;
    await tick(75);
  }
  const s = await state();
  throw Error(`${reason}: ${s.room}, ${s.mode}, ${feet(s)}, ${s.lastCommand}`);
}

async function drain() {
  const lines = [];
  for (let i=0; i<75; i++) {
    const s = await until(value => !value.processing,'等待场景动作');
    if (s.mode==='dialogue') {
      lines.push(s.dialogue.text);
      await page.locator('#next').click();
    } else if (s.narrative.busy) await tick(110);
    else return { s,lines };
  }
  throw Error('对白和过场未结束');
}

async function openCase(name,touch = false) {
  testName=name;
  phone=touch;
  routes=[];
  await page?.context().close();
  page=await browser.newPage({
    viewport:touch?{width:390,height:844}:{width:1440,height:900},
    hasTouch:touch,isMobile:touch,
  });
  page.setDefaultTimeout(10000);
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',msg=>{ if(msg.type()==='error')errors.push(msg.text()); });
  page.on('response',res=>{ if(res.status()>=400)errors.push(res.status()+' '+res.url()); });
  await page.goto(url);
  await page.waitForFunction(() => window.render_game_to_text && JSON.parse(window.render_game_to_text()).art==='loaded');
  await page.locator('#start').click();
  await drain();
}

async function importPlayed(file) {
  const {engine:{state:original}}=JSON.parse(await readFile(file,'utf8'));
  await page.keyboard.press('Escape');
  await page.getByRole('tab',{name:'探索进度'}).click();
  await page.locator('#save-file').setInputFiles(file);
  await until(s=>s.room===original.room&&s.mode!=='paused'&&!s.processing,'导入已有实际存档');
  const {s}=await drain();
  assert.equal(s.turns,original.turns);
  assert.equal(s.score,original.score);
  assert.equal(s.flipped,original.flipped);
  assert.equal(s.inventory.includes('splinter'),['inventory','pocket','worn'].includes(original.itemLoc.splinter));
  return s;
}

async function clickCanvas([x,y]) {
  const box = await page.locator('canvas').boundingBox();
  assert.ok(box);
  const at=[box.x+x*box.width/480,box.y+y*box.height/288];
  if (phone) await page.touchscreen.tap(...at);
  else await page.mouse.click(...at);
}

async function go(dir,target) {
  const {s:before}=await drain();
  let input = phone?'tap-route':'click-route';
  const control=page.locator(`#arbor-dark-routes [data-dir="${dir}"]`);
  if (await control.isVisible()) {
    if (phone) {
      await control.tap();
      input='tap-dark-direction';
    } else {
      await page.keyboard.press(dir==='n'?'w':'s');
      input='dark-direction-key';
    }
  } else {
    const exit=before.exits.find(e=>e.dir===dir&&e.target===target);
    assert.ok(exit,`${before.room} 的 ${dir} 应通到 ${target}`);
    await tick(550);
    await clickCanvas([exit.x,exit.y]);
  }
  await until(s=>s.room===target&&!s.processing,`${input} ${dir} 应到 ${target}`);
  const {s,lines}=await drain();
  assert.equal(s.lastCommand,dir);
  assert.equal(s.turns,before.turns+1);
  assert.equal(s.score,before.score);
  assert.equal(s.navigation.arrival?.fromRoom,before.room);
  assert.equal(s.navigation.arrival?.matched,true);
  routes.push({ from:before.room, to:s.room, dir, input, feet:feet(s), arrival:s.navigation.arrival, flipped:s.flipped, lines });
  return s;
}

async function getArboretum() {
  let s=await state();
  if (s.room==='vertex') {
    const stairs=prop(s,'vertex:stairs');
    assert.ok(stairs);
    const touch=stairs.pointerShape ? pointerCenter(stairs) : [stairs.x,stairs.y-5];
    await clickCanvas(touch);
    await until(next=>next.room==='bottom_of_stairs'&&!next.processing,'日晷下楼');
    ({s}=await drain());
  }
  assert.equal(s.room,'bottom_of_stairs');
  const trellises=await go('s','trellises');
  assert.ok(!trellises.exits.some(e=>e.dir==='u'),'棚架没有登顶捷径');
  assert.ok(!prop(trellises,'trellises:ascent'));
  await clickCanvas([341,28]);
  await tick(600);
  const afterOldLadder=await state();
  assert.equal(afterOldLadder.room,'trellises');
  assert.equal(afterOldLadder.turns,trellises.turns);
  await shot('trellises');
  await go('se','arborvitaes_n');
  return go('w','arboretum');
}

async function luminance() {
  return page.evaluate(() => {
    const c=document.querySelector('canvas');
    const pixels=c.getContext('2d').getImageData(0,0,c.width,c.height).data;
    let count=0,sum=0,max=0;
    for(let i=0; i<pixels.length; i+=28) {
      const value=pixels[i]*.213+pixels[i+1]*.715+pixels[i+2]*.072;
      count++;
      sum+=value;
      max=Math.max(max,value);
    }
    return { mean:Math.round(sum*100/count)/100, max:Math.round(max*100)/100 };
  });
}

async function checkDark() {
  const s=await state();
  assert.equal(s.room,'top_of_arbor');
  assert.equal(s.arborLight,null);
  assert.match(await page.locator('#room').textContent(),/黑暗/);
  assert.match(await page.locator('#room-en').textContent(),/Darkness/i);
  assert.ok(await page.locator('#arbor-dark-routes').isVisible());
  if (phone) {
    for (const button of await page.locator('#arbor-dark-routes button').all()) {
      assert.ok((await button.boundingBox()).height>=40);
    }
  }
  assert.ok(!s.objects.some(o=>o.visual!==false&&(o.itemId||o.id==='arboretum:sculpture')));
  assert.ok(!s.exits.some(e=>e.dir==='d'));
  const pixels=await luminance();
  assert.ok(pixels.mean<16,'暗处实际画布不能照亮地面与物品');
  return pixels;
}

async function lookInDark() {
  const s=await state();
  await page.keyboard.press('l');
  await until(next=>next.mode==='dialogue'&&!next.processing&&next.lastCommand==='look','暗中环顾');
  const result=await drain();
  assert.match(result.lines.join(' '),/黑|看不清|看不见/);
  assert.doesNotMatch(result.lines.join(' '),/雕塑|水晶|斧头/);
  assert.equal(result.s.room,s.room);
  return result.lines;
}

async function checkSculpture() {
  const before=await state();
  assert.equal(before.room,'arboretum');
  const sculpture=prop(before,'arboretum:sculpture');
  assert.ok(sculpture,'植物园中央应有固定的水晶雕塑');
  await shot(before.flipped?'sculpture-mirrored':'sculpture');
  if (!phone && before.nearby===sculpture.label) await page.keyboard.press('f');
  else await clickCanvas(pointerCenter(sculpture));
  await until(s=>!s.processing && s.mode==='dialogue' && /^examine (crystal|sculpture)$/.test(s.lastCommand),'实际查看水晶雕塑');
  const {s,lines}=await drain();
  assert.equal(s.room,before.room);
  assert.match(s.lastCommand,/^examine (crystal|sculpture)$/);
  assert.match(lines.join(' '),/晶|玻璃|雕塑|瓶/);
  assert.match(lines.join(' '),before.flipped?/5291-9481 NIELK XILEF/:/FELIX KLEIN 1849-1925/);
  assert.equal(s.score,before.score);
  if (!before.flags.includes('arbor_sculpture_examined')) assert.equal(s.turns,before.turns);
  return lines;
}

async function checkKeyboardSculpture() {
  const before=await state();
  assert.equal(before.nearby,prop(before,'arboretum:sculpture').label);
  await page.keyboard.press('f');
  await until(s=>!s.processing&&s.mode==='dialogue','靠近用 F 查看雕塑');
  const {s,lines}=await drain();
  assert.equal(s.lastCommand,'examine sculpture');
  assert.match(lines.join(' '),/FELIX KLEIN 1849-1925/);
}

async function reloadCurrent() {
  const before=await state();
  await page.reload();
  await page.locator('#continue-save').click();
  const {s:after}=await drain();
  for(const field of ['room','turns','score','arborLight','flipped','inventory']) {
    assert.deepEqual(after[field],before[field],field);
  }
  return after;
}

async function dropSplinter() {
  const before=await state();
  assert.ok(before.inventory.includes('splinter'));
  await page.keyboard.press('i');
  await page.getByRole('button',{name:'木片',exact:true}).click();
  assert.equal((await state()).heldItem,'splinter');
  await page.keyboard.press('i');
  await page.locator('#inventory-drop').click();
  await until(s=>!s.processing&&s.lastCommand==='drop splinter'&&s.turns>before.turns,'放下发光木片');
  const {s}=await drain();
  assert.equal(s.room,before.room);
  assert.equal(s.score,before.score);
  assert.equal(s.inventory.includes('splinter'),false);
  assert.equal(visible(s,'splinter').length,1);
  return s;
}

async function recoverSplinter() {
  for(let attempt=0; attempt<2; attempt++) {
    const before=await state();
    const wood=visible(before,'splinter')[0];
    assert.ok(wood,'实际发光的木片还在画面');
    await clickCanvas(pointerCenter(wood));
    await until(s=>!s.processing&&s.turns>before.turns,'点选照明木片');
    const {s}=await drain();
    if(s.inventory.includes('splinter')) {
      assert.equal(s.inventory.filter(id=>id==='splinter').length,1);
      assert.equal(items(s,'splinter').length,0);
      return s;
    }
    assert.equal(s.lastCommand,'examine splinter');
  }
  throw Error('未能从画面取回木片');
}

async function darkRoute() {
  await openCase('unlit');
  const start=await importPlayed(files.dark);
  assert.equal(start.inventory.includes('splinter'),false);
  const garden=await getArboretum();
  const sculpture=await checkSculpture();
  await checkKeyboardSculpture();
  await go('n','north_arbor');
  await go('u','top_of_arbor');
  const darkness=await checkDark();
  await shot('top');
  const beforeBlindClick=await state();
  await clickCanvas([339,115]);
  await tick(600);
  const afterBlindClick=await state();
  assert.equal(afterBlindClick.room,beforeBlindClick.room);
  assert.equal(afterBlindClick.turns,beforeBlindClick.turns);
  const look=await lookInDark();
  await go('n','north_arbor');
  const sameSide=await go('d','arboretum');
  assert.equal(sameSide.flipped,garden.flipped,'同侧退回不应翻转');
  await go('s','south_arbor');
  await go('u','top_of_arbor');
  await checkDark();
  await go('n','north_arbor');
  const crossed=await go('d','arboretum');
  assert.notEqual(crossed.flipped,garden.flipped,'从另一侧落到植物园时才翻转');
  const mirrored=await checkSculpture();
  const mapBefore=await state();
  await page.keyboard.press('m');
  const map=await until(s=>s.map.open,'打开探索地图');
  assert.equal(map.map.chapter,'wabe');
  await shot('map');
  await page.keyboard.press('m');
  assert.equal((await state()).turns,mapBefore.turns);
  return { source:files.dark,darkness,sculpture,mirrored,look,routes };
}

async function litRoute() {
  await openCase('lit');
  const start=await importPlayed(files.lit);
  assert.ok(start.inventory.includes('splinter'));
  const garden=await getArboretum();
  await go('s','south_arbor');
  const top=await go('u','top_of_arbor');
  assert.equal(top.arborLight,'splinter');
  assert.ok(!prop(top,'arboretum:sculpture'));
  assert.equal(await page.locator('#arbor-dark-routes').isVisible(),false);
  const illuminated=await luminance();
  assert.ok(illuminated.mean>17,'发光木片应让顶层实际画面可见');
  await shot('carried-splinter');
  const dropped=await dropSplinter();
  assert.equal(dropped.arborLight,'splinter','木片在顶层地上仍应照明');
  await shot('splinter-on-top');
  await reloadCurrent();
  const slope=await go('s','south_arbor');
  assert.equal(slope.flipped,garden.flipped);
  const returned=await go('u','top_of_arbor');
  assert.equal(returned.arborLight,'splinter');
  assert.equal(visible(returned,'splinter').length,1);
  await recoverSplinter();
  await go('s','south_arbor');
  await go('d','arboretum');
  await dropSplinter();
  await shot('splinter-left-below');
  await go('s','south_arbor');
  await go('u','top_of_arbor');
  const belowLight=await checkDark();
  await shot('dark-with-splinter-below');
  return { source:files.lit,illuminated,belowLight,routes };
}

async function oldTopTouch() {
  await openCase('legacy-phone',true);
  const old=await importPlayed(files.legacy);
  assert.equal(old.room,'top_of_arbor');
  await checkDark();
  await reloadCurrent();
  await checkDark();
  await shot('dark-return-options');
  await go('s','south_arbor');
  await go('d','arboretum');
  await checkSculpture();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  return { source:files.legacy, restoredFeet:feet(old),routes };
}

try {
  reports.push(await darkRoute());
  reports.push(await litRoute());
  reports.push(await oldTopTouch());
  assert.deepEqual(errors,[]);
  await writeFile(join(output,'result.json'),JSON.stringify({pass:true,reports,errors},null,2));
  console.log('南北坡往返、顶层明暗、留置木片、植物园水晶和旧存档触屏通过');
} catch(error) {
  if(page)await shot('failure').catch(()=>{});
  await writeFile(join(output,'failure.json'),JSON.stringify({
    error:error.message,testName,current:page?await state().catch(()=>null):null,reports,routes,errors,
  },null,2));
  throw error;
} finally {
  await browser.close();
}
