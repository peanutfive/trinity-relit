// Isolated cartography fixture; gameplay/keyboard integration lives in browser-immersive.
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
const output=process.env.QA_OUTPUT||'/tmp/trinity-map-qa';await mkdir(output,{recursive:true});
const demo=(process.env.DEMO_URL||'http://127.0.0.1:8080/2d-demo/').replace(/\/?$/,'/');
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1280,height:768}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.route('**/2d-demo/map-fixture.html',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body></body></html>'}));
await page.goto(`${demo}map-fixture.html`);
await page.evaluate(async()=>{
 const {createChapterMapView}=await import('./chapter-map.js');const {ROOMS}=await import('../js/data/prologue.js');const {SCENES}=await import('./scene-manifest.js');
 document.body.replaceChildren();document.body.style.cssText='padding:0;margin:0;overflow:hidden;background:#13251c';
 const stage=document.createElement('div');stage.style.cssText='position:relative;width:100vw;height:100dvh';document.body.append(stage);
 window.fixture={state:{room:'palace_gate',chapter:'prologue',visited:['palace_gate'],flags:[],counters:{},itemLoc:{}},rooms:ROOMS,scenes:SCENES};window.chart=createChapterMapView({host:stage});window.chart.open(window.fixture);
});
await page.screenshot({path:`${output}/desktop-new.png`});
assert.equal(await page.locator('[data-room-id]').count(),1);assert.equal(await page.locator('.map-landscape').count(),1);
await page.evaluate(()=>{fixture.state.visited=Object.keys(fixture.rooms);chart.open(fixture);});await page.screenshot({path:`${output}/desktop-full.png`});
assert.equal(await page.locator('[data-room-id]').count(),11);
// Independently selected rectangle lies wholly inside the painted pond. No
// ordinary road may sample it, irrespective of which places were visited first.
const flooded=await page.locator('.map-road').evaluateAll(paths=>paths.some(path=>{for(let i=0;i<=120;i++){const p=path.getPointAtLength(path.getTotalLength()*i/120);if(p.x>402&&p.x<525&&p.y>209&&p.y<274)return true;}return false;}));assert.equal(flooded,false,'道路穿过了池水');
await page.getByRole('button',{name:'放大地图',exact:true}).click();assert.equal(await page.evaluate(()=>chart.getState().zoom),1.25);
await page.getByRole('button',{name:'定位当前位置',exact:true}).click();assert.ok((await page.evaluate(()=>chart.getState())).zoom>=1.5);
await page.getByRole('button',{name:'恢复全图',exact:true}).click();assert.deepEqual((await page.evaluate(()=>chart.getState())).pan,{x:0,y:0});
await page.locator('[data-room-id="round_pond"]').click();assert.equal((await page.evaluate(()=>chart.getState())).selected,'round_pond');
const before=await page.evaluate(()=>JSON.stringify(fixture.state));await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>chart.isOpen()),false);assert.equal(await page.evaluate(()=>JSON.stringify(fixture.state)),before);
for(const [label,width,height]of [['phone-portrait',390,844],['phone-landscape',844,390]]){
 await page.setViewportSize({width,height});await page.evaluate(()=>chart.open(fixture));await page.waitForTimeout(50);await page.screenshot({path:`${output}/${label}.png`});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 const b=await page.locator('.chapter-map').boundingBox();assert.ok(b.x>=0&&b.y>=0&&b.x+b.width<=width&&b.y+b.height<=height);
 await page.getByRole('button',{name:'恢复全图',exact:true}).click();await page.screenshot({path:`${output}/${label}-overview.png`});
}
assert.deepEqual(errors,[]);console.log('PASS single-node/full chapter, zoom/locate/reset/select/Esc, state unchanged, desktop/portrait/landscape bounds, no page errors');await browser.close();
