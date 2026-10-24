// Optional browser QA for the immersive viewport and stage-bound exploration map.
// PLAYWRIGHT_MODULE may point to the installed Playwright entry; artifacts stay in /tmp.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createPrologueSession} from '../engine-adapter.js';
import {makeVisualSave} from '../save.js';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const artifacts=process.env.QA_OUTPUT||'/tmp/trinity-immersive-qa';
await mkdir(artifacts,{recursive:true});
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:900}});
const errors=[],receipts=[];
page.on('pageerror',error=>errors.push(error.message));
page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
page.on('response',response=>{if(response.status()>=400)errors.push(`${response.status()} ${response.url()}`);});
const state=()=>page.evaluate(()=>JSON.parse(window.render_game_to_text()));
const shot=name=>page.screenshot({path:`${artifacts}/${name}.png`,fullPage:true});
async function drain(){
  for(let i=0;i<100;i++){
    await page.waitForFunction(()=>!JSON.parse(window.render_game_to_text()).processing);
    const s=await state();
    if(s.mode==='dialogue')await page.keyboard.press('f');
    else if(s.narrative.busy)await page.click('#skip-event');
    else return;
  }
  throw Error('Dialogue or narrative did not finish');
}
async function tick(ms){await page.evaluate(ms=>window.advanceTime(ms),ms);}
async function contained(selector,parent='.stage'){
  const inner=await page.locator(selector).boundingBox(),outer=await page.locator(parent).boundingBox();
  assert.ok(inner&&outer,`${selector} and ${parent} must be visible`);
  const tolerance=2;
  assert.ok(inner.x>=outer.x-tolerance&&inner.y>=outer.y-tolerance&&inner.x+inner.width<=outer.x+outer.width+tolerance&&inner.y+inner.height<=outer.y+outer.height+tolerance,
    `${selector} escapes ${parent}: ${JSON.stringify({inner,outer})}`);
  return inner;
}
async function viewportFit(label){
  const viewport=page.viewportSize(),stage=await contained('.stage','main');
  assert.ok(stage.x>=-1&&stage.y>=-1&&stage.x+stage.width<=viewport.width+1&&stage.y+stage.height<=viewport.height+1,`${label}: stage outside browser`);
  assert.ok(Math.abs(stage.width/stage.height-5/3)<.015,`${label}: game aspect ratio changed`);
  assert.ok(stage.width>=Math.min(viewport.width,viewport.height*5/3)*.93,`${label}: excessive unused browser space`);
  const overflow=await page.evaluate(()=>({x:document.documentElement.scrollWidth-innerWidth,y:document.documentElement.scrollHeight-innerHeight}));
  assert.ok(overflow.x<=2&&overflow.y<=2,`${label}: document scrolls ${JSON.stringify(overflow)}`);
  assert.equal(await page.locator('.touch-pad,#touch-interact,#pause-open').count(),0,'Persistent corner controls must be removed');
  receipts.push({case:label,viewport,stage});
}
async function mapCheck(label){
  const before=await state();await page.keyboard.press('m');
  await page.waitForFunction(()=>JSON.parse(window.render_game_to_text()).mode==='map');
  await contained('.chapter-map');await contained('.chapter-map-viewport');
  assert.ok(await page.locator('.map-landscape').count()>0,'A readable landscape must exist even in a fresh save');
  assert.ok(await page.locator('.map-node[data-room-id]').count()>0,'Current location must be shown');
  const frozen=await state();await tick(1000);let after=await state();
  assert.equal(after.turns,before.turns,'Map must freeze story turns');
  assert.deepEqual(after.player,frozen.player,'Map must freeze player movement and animation');
  const location=page.locator('.map-node[data-room-id]').first();await location.click();
  after=await state();assert.equal(after.room,before.room,'Selecting a map marker must not teleport');
  assert.equal(after.turns,before.turns,'Selecting a map marker must not execute a game command');
  await shot(`${label}-map`);await page.keyboard.press('Escape');
  assert.notEqual((await state()).mode,'map');
}
async function pauseCheck(label){
  const before=await state();await page.keyboard.press('Escape');
  await page.waitForFunction(()=>JSON.parse(window.render_game_to_text()).mode==='paused');
  await contained('#pause-menu');await contained('.pause-window');
  const frozen=await state();await tick(1000);const after=await state();assert.equal(after.turns,before.turns);assert.deepEqual(after.player,frozen.player);
  await shot(`${label}-pause`);await page.click('#resume');
  assert.notEqual((await state()).mode,'paused');
}
async function fixture(commands=['n','e'],x=100,y=160){
  const engine=createPrologueSession();engine.moveTo(engine.state.room);
  for(const command of commands)await engine.processInput(command);
  const packet=makeVisualSave(engine,{room:engine.state.room,x,y,face:'up'});
  await page.keyboard.press('Escape');await page.getByRole('tab',{name:'探索进度'}).click();
  await page.locator('#save-file').setInputFiles({name:'map-exploration.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(packet))});
  await page.waitForFunction(room=>{const s=JSON.parse(window.render_game_to_text());return s.room===room&&s.mode!=='paused'&&!s.processing;},engine.state.room);
  await drain();
}
async function visibleHeroThroughGate(){
  // Compare the real frame with a background-only frame at the same paused
  // time. This catches an opaque gate mask erasing the complete protagonist;
  // it does not derive a success condition from the mask's own alpha values.
  await page.keyboard.press('Escape');
  await page.waitForFunction(()=>JSON.parse(window.render_game_to_text()).mode==='paused');
  const pixels=await page.evaluate(async()=>{
    const {drawScene,drawOcclusion}=await import('./art.js');
    const s=JSON.parse(window.render_game_to_text()),actual=document.querySelector('canvas');
    const baseline=document.createElement('canvas');baseline.width=actual.width;baseline.height=actual.height;
    const ctx=baseline.getContext('2d'),scale=actual.width/480;
    ctx.setTransform(scale,0,0,scale,0,0);
    drawScene(ctx,s.room,s.player.animation.time,s.settings.video.effects);
    for(const y of [...s.objects.map(object=>object.y),s.player.y].sort((a,b)=>a-b))drawOcclusion(ctx,s.room,y);
    const frame=actual.getContext('2d').getImageData(0,0,actual.width,actual.height).data;
    const empty=ctx.getImageData(0,0,baseline.width,baseline.height).data;
    let visible=0,samples=0;
    for(let y=s.player.y-35;y<s.player.y;y++)for(let x=s.player.x-10;x<s.player.x+10;x++){
      const index=(Math.floor((y+.5)*scale)*actual.width+Math.floor((x+.5)*scale))*4;
      if(Math.abs(frame[index]-empty[index])+Math.abs(frame[index+1]-empty[index+1])+Math.abs(frame[index+2]-empty[index+2])>36)visible++;
      samples++;
    }
    return {visible,samples,player:s.player,room:s.room};
  });
  receipts.push({case:'hero-visible-through-iron-gate',...pixels});
  assert.ok(pixels.visible>50,`Iron gate must show the hero between its bars; visible logical pixels=${pixels.visible}/${pixels.samples}`);
  await page.click('#resume');
}
async function umbrellaSequence(){
  // Hold only the browser's automatic rendering clock; all inputs, commands,
  // turn effects and the director remain the same as a player's session.
  await page.evaluate(()=>{
    const original=window.requestAnimationFrame.bind(window);let queued;
    window.requestAnimationFrame=callback=>{queued=callback;return 0;};
    window.__qaResumeAnimation=()=>{window.requestAnimationFrame=original;if(queued)original(queued);delete window.__qaResumeAnimation;};
  });
  await page.waitForTimeout(60);
  await fixture(['n','ne','e'],205,180);await tick(0);
  const before=await state();assert.ok(!before.flags.includes('umbrella_woman_done'));
  await shot('umbrella-standing');
  const woman=before.objects.find(object=>object.id==='lancaster_gate:woman');assert.ok(woman);
  const box=await page.locator('canvas').boundingBox();
  await page.mouse.click(box.x+woman.x/480*box.width,box.y+(woman.y-12)/288*box.height);
  await page.waitForFunction(()=>!JSON.parse(window.render_game_to_text()).processing);
  let s=await state();assert.equal(s.lastCommand,'wait','The normal first NPC interaction must advance her original event');
  assert.equal(s.narrative.currentEvent,'umbrella_gust');
  // Advancing text must never silently skip a visible event.
  await page.keyboard.press('f');await page.keyboard.press('f');
  assert.equal((await state()).narrative.currentEvent,'umbrella_gust');
  const duration=(await state()).narrative.duration;let elapsed=0;
  for(const [action,progress]of [['prepare',.03],['raise',1.4/13.2],['open',2.5/13.2],['hold',3.5/13.2],['brace',4.5/13.2],['released',6/13.2],['circle',8.6/13.2],['look_up',9.8/13.2],['wipe',10.6/13.2],['kick',11.3/13.2],['leave',12.3/13.2]]){
    await tick((duration*progress-elapsed)*1000);elapsed=duration*progress;s=await state();
    assert.equal(s.narrative.currentEvent,'umbrella_gust');
    const actors=s.narrative.visibleActorActions.filter(actor=>actor.actorId==='lancaster_umbrella_woman');
    assert.equal(actors.length,1,'A single umbrella woman must be rendered throughout the event');
    assert.equal(actors[0].action,action);assert.equal(actors[0].umbrella,['prepare','raise','open','hold','brace'].includes(action));
    assert.equal(s.turns,before.turns+1,'Animation must not add turns');
    await shot(`umbrella-gust-${action}`);receipts.push({case:`umbrella-gust-${action}`,actor:actors[0],turns:s.turns});
  }
  await tick(duration*1000-elapsed*1000+50);
  assert.notEqual((await state()).narrative.currentEvent,'umbrella_gust');
  assert.ok((await state()).flags.includes('umbrella_woman_done'));
  for(let i=0;i<20&&(await state()).mode==='dialogue';i++)await page.click('#next');
  assert.notEqual((await state()).mode,'dialogue');
  await page.evaluate(()=>window.__qaResumeAnimation());
}
try{
  await page.goto(process.env.DEMO_URL||'http://127.0.0.1:8080/2d-demo/');
  await page.waitForFunction(()=>{const s=window.render_game_to_text&&JSON.parse(window.render_game_to_text());return s?.art==='loaded'&&s.heroArt==='loaded'&&s.sprites==='loaded';});
  await viewportFit('desktop-title');await shot('desktop-title');
  await page.click('#start');await drain();
  assert.equal((await state()).controls.interact,'f');
  await mapCheck('fresh-desktop');await pauseCheck('desktop');
  const beforeClick=await state(),canvas=await page.locator('canvas').boundingBox();
  await page.mouse.click(canvas.x+240/480*canvas.width,canvas.y+242/288*canvas.height);await tick(600);
  assert.ok(Math.hypot((await state()).player.x-beforeClick.player.x,(await state()).player.y-beforeClick.player.y)>8,'Ground clicking must still move the player');
  const start=await state();await page.keyboard.down('ArrowRight');await tick(150);await page.keyboard.up('ArrowRight');
  assert.ok((await state()).player.x>start.player.x,'Keyboard movement must work after map/menu close');
  await page.keyboard.press('f');const dialogue=await state();
  assert.equal(dialogue.mode,'dialogue','F must open nearby interaction or room narration');
  const currentPage=dialogue.dialogue.page;await page.keyboard.press('Enter');
  assert.equal((await state()).dialogue?.page,currentPage,'Enter must not advance gameplay dialogue');
  await page.keyboard.press('z');assert.equal((await state()).dialogue?.page,currentPage,'Z must not advance gameplay dialogue');
  await drain();
  for(const [name,x,y]of [['gate-behind-upper',278,180],['gate-behind-lower',282,205],['gate-in-front',280,224]]){
    await fixture([],x,y);await shot(name);receipts.push({case:name,state:await state()});
    if(name==='gate-behind-lower')await visibleHeroThroughGate();
  }
  await fixture(['n'],162,177);await shot('seller-seat-front');
  receipts.push({case:'seller-seat-front',state:await state()});
  for(let index=0;index<3;index++){
    await fixture(['n','ne',...Array(index).fill('wait')],325,129);await shot(`boy-phase-${index}`);
    receipts.push({case:`boy-phase-${index}`,state:await state()});
  }
  await fixture(['n','ne','e'],230,219);await shot('umbrella-standing');
  await umbrellaSequence();
  await fixture();
  for(const [name,width,height]of [['desktop',1366,768],['tablet',1024,768],['portrait',390,844],['landscape',844,390]]){
    await page.setViewportSize({width,height});await page.waitForTimeout(100);
    await viewportFit(name);await shot(`${name}-exploring`);await mapCheck(name);await pauseCheck(name);
  }
  // Chromium dispatches trusted simultaneous touch contacts. No visible control
  // or injected game-state mutation is used to open the menu on touch devices.
  const cdp=await page.context().newCDPSession(page);
  await cdp.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:2});
  async function twoFingers(){
    const box=await page.locator('.stage').boundingBox();
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[
      {id:0,x:box.x+box.width*.42,y:box.y+box.height*.45},
      {id:1,x:box.x+box.width*.58,y:box.y+box.height*.45},
    ]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  }
  await twoFingers();await page.waitForFunction(()=>JSON.parse(window.render_game_to_text()).mode==='paused');
  await shot('landscape-touch-menu');await twoFingers();
  await page.waitForFunction(()=>JSON.parse(window.render_game_to_text()).mode!=='paused');
  await page.keyboard.press('m');await twoFingers();
  await page.waitForFunction(()=>JSON.parse(window.render_game_to_text()).mode!=='map');
  await cdp.send('Emulation.setTouchEmulationEnabled',{enabled:false});await cdp.detach();
  receipts.push({case:'two-finger-menu-and-map',pass:true});
  await page.setViewportSize({width:1440,height:900});
  await page.keyboard.press('Escape');await page.getByRole('tab',{name:'画面设置'}).click();
  await page.click('#fullscreen');await page.waitForFunction(()=>Boolean(document.fullscreenElement));
  const fullscreen=await page.evaluate(()=>({tag:document.fullscreenElement.tagName,map:document.fullscreenElement.contains(document.querySelector('.chapter-map')),pause:document.fullscreenElement.contains(document.querySelector('#pause-menu'))}));
  assert.ok(fullscreen.map&&fullscreen.pause,'Map and menu must belong to the fullscreen element');
  await page.click('#resume');await viewportFit('fullscreen');await mapCheck('fullscreen');await pauseCheck('fullscreen');
  await page.keyboard.press('Escape');await page.getByRole('tab',{name:'画面设置'}).click();await page.click('#fullscreen');
  await page.waitForFunction(()=>!document.fullscreenElement);await page.click('#resume');
  assert.deepEqual(errors,[]);
  await writeFile(`${artifacts}/result.json`,JSON.stringify({pass:true,receipts,fullscreen,errors},null,2));
  console.log(`PASS: immersive viewport, hidden corner controls, F-only interaction, stage-bound map/menu, paused state and fullscreen at desktop/tablet/phone sizes. Artifacts: ${artifacts}`);
}catch(error){
  await shot('failure').catch(()=>{});
  await writeFile(`${artifacts}/failure.json`,JSON.stringify({message:error.message,state:await state().catch(()=>null),receipts,errors},null,2));
  throw error;
}finally{await browser.close();}
