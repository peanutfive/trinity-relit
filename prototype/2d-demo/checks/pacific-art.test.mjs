import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {inflateSync} from 'node:zlib';
import {getPacificHotspots,PACIFIC_POINTS,PACIFIC_ROOMS} from '../pacific-actions.js';
import {nearbyTarget,pointerTarget} from '../interaction-targets.js';
import {SCENES} from '../scene-manifest.js';
import {isBlocked} from '../world.js';
import {ITEMS} from '../../js/data/items.js';

globalThis.Image = class {complete=true;naturalWidth=2172;};
const {
  renderPacificSprite,pacificControlState,PACIFIC_BOX_SCALE,
  PACIFIC_BOX_FRAMES,PACIFIC_COCONUT_REGIONS,
} = await import('../pacific-art.js');

async function rgbaPNG() {
  const bytes = await readFile(new URL('../assets/pacific-props-v1.png',import.meta.url));
  assert.equal(bytes.subarray(1,4).toString(),'PNG');
  const width=bytes.readUInt32BE(16),height=bytes.readUInt32BE(20);
  assert.equal(bytes[24],8);assert.equal(bytes[25],6,'retain original RGBA');
  assert.equal(bytes[28],0);
  const chunks=[];
  for(let at=8;at<bytes.length;){const size=bytes.readUInt32BE(at);if(bytes.toString('ascii',at+4,at+8)==='IDAT')chunks.push(bytes.subarray(at+8,at+8+size));at+=size+12;}
  const packed=inflateSync(Buffer.concat(chunks)),stride=width*4,pixels=Buffer.alloc(stride*height);
  const paeth=(a,b,c)=>{const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);return pa<=pb&&pa<=pc?a:pb<=pc?b:c;};
  for(let y=0;y<height;y++)for(let x=0;x<stride;x++){
    const i=y*stride+x,left=x>=4?pixels[i-4]:0,up=y?pixels[i-stride]:0,corner=y&&x>=4?pixels[i-stride-4]:0;
    const filter=packed[y*(stride+1)],predictor=[0,left,up,Math.floor((left+up)/2),paeth(left,up,corner)][filter];
    assert.ok(predictor!==undefined);pixels[i]=(packed[y*(stride+1)+1+x]+predictor)&255;
  }
  return {width,height,alpha:(x,y)=>pixels[(y*width+x)*4+3]};
}
const raw = rgbaPNG();
const state = (flags=[],items=[]) => Object.freeze({
  room:'bottom_scaffold',timer:flags.includes('pacific_switch_pushed')?Object.freeze({id:'pacific_switch',remaining:6}):null,
  hasFlag:key=>flags.includes(key),roomItems:()=>items,
});
const context = () => ({
  calls:[],save(){},restore(){},beginPath(){},ellipse(){},fill(){},
  drawImage(...args){this.calls.push(args);},
});

test('Pacific图集含真透明背景、完整金属箱与椰子，源区不越界并保留完整提示',async()=>{
  const im=await raw;let clear=0,painted=0;
  for(let y=0;y<im.height;y++)for(let x=0;x<im.width;x++){
    const alpha=im.alpha(x,y);if(alpha===0)clear++;if(alpha>240)painted++;
  }
  assert.ok(clear>im.width*im.height*.35);assert.ok(painted>100000);
  for(const region of [...PACIFIC_BOX_FRAMES,...Object.values(PACIFIC_COCONUT_REGIONS)]){
    const [x,y,w,h]=region.source;
    assert.ok(x>=0&&y>=0&&x+w<=im.width&&y+h<=im.height);
    assert.ok(region.foot[0]>x&&region.foot[0]<x+w);
    let minY=Infinity,maxY=-Infinity;
    for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++)if(im.alpha(xx,yy)>64){minY=Math.min(minY,yy);maxY=Math.max(maxY,yy);}
    assert.ok(minY<maxY&&minY>=y+2&&maxY<y+h-2,'source frame retains its painted silhouette');
  }
  const prompt=await readFile(new URL('../art-prompts/pacific-props-v1.md',import.meta.url),'utf8');
  assert.ok(prompt.includes('First FOUR slots'));assert.ok(prompt.includes('fully transparent RGBA'));assert.ok(prompt.includes('Final TWO slots'));
});

test('四态控制箱共用壁面锚点和尺寸，没有因开门变成落地箱或漂移',()=>{
  const sequence=[[],['pacific_box_open'],['pacific_box_open','pacific_switch_pushed'],['pacific_box_open','pacific_switch_pushed','pacific_button_pushed']];
  const sources=new Set();
  for(const flags of sequence){
    const s=state(flags),before=JSON.stringify(s),c=context(),projection=pacificControlState(s);
    const object=getPacificHotspots(s).find(value=>value.kind==='pacific_box');
    assert.equal(object.depthY,99);assert.equal(object.y,129);
    assert.equal(renderPacificSprite(c,object,s),true);
    const draw=c.calls[0],frame=PACIFIC_BOX_FRAMES[projection.frame];sources.add(draw[1]);
    assert.ok(draw[0].src.endsWith('/assets/pacific-props-v1.png'));
    assert.deepEqual(draw.slice(1,5),frame.source);
    assert.ok(Math.abs(draw[7]/draw[3]-PACIFIC_BOX_SCALE)<1e-10);
    assert.ok(Math.abs(draw[5]+(frame.foot[0]-frame.source[0])*PACIFIC_BOX_SCALE-291)<1e-10);
    assert.ok(Math.abs(draw[6]+(frame.foot[1]-frame.source[1])*PACIFIC_BOX_SCALE-99)<1e-10);
    assert.equal(JSON.stringify(s),before,'painting cannot tick a timer or set a flag');
  }
  assert.equal(sources.size,4);
});

test('切房演出使用普通JSON快照也可绘箱体与椰子，不依赖GameState方法',()=>{
  const flags=['pacific_box_open','pacific_switch_pushed','coconut_cracked'];
  const live=state(flags),snapshot={flags:[...flags],timer:{id:'pacific_switch',remaining:6}};
  const before=JSON.stringify(snapshot);
  assert.equal(pacificControlState(snapshot).pose,pacificControlState(live).pose);
  assert.equal(pacificControlState({...snapshot,flags:new Set(flags)}).frame,2);
  const box=getPacificHotspots(live).find(value=>value.kind==='pacific_box');
  assert.equal(renderPacificSprite(context(),box,snapshot),true);
  assert.equal(renderPacificSprite(context(),{kind:'pacific_coconut',x:295,y:183},snapshot),true);
  assert.equal(JSON.stringify(snapshot),before,'快照绘制保持只读');
});

test('闭箱不会点击到内部控件，开箱后F在两个站位可分别选中开关和按钮',()=>{
  const closed=getPacificHotspots(state());
  assert.equal(closed.filter(value=>['pacific_switch','pacific_button'].includes(value.kind)).length,0);
  assert.equal(pointerTarget(closed,{x:287.4,y:87.6})?.kind,'pacific_box');
  const open=getPacificHotspots(state(['pacific_box_open']));
  assert.equal(open.find(value=>value.kind==='pacific_box').pointerOnly,true);
  assert.equal(pointerTarget(open,{x:287.4,y:87.6})?.kind,'pacific_switch');
  assert.equal(pointerTarget(open,{x:291.6,y:87.6})?.kind,'pacific_button');
  assert.equal(pointerTarget(open,{x:281,y:125}),undefined,'floor around the cabinet is not a painted click target');
  for(const kind of ['switch','button'])assert.equal(nearbyTarget(open,{...PACIFIC_POINTS[kind],face:'up'})?.kind,`pacific_${kind}`);
});

test('真实状态决定按钮的可执行动作，到期保留原规则Too late路径且不伪重置',()=>{
  const opened=getPacificHotspots(state(['pacific_box_open']));
  assert.ok(opened.find(value=>value.kind==='pacific_switch').actions.some(value=>value.command==='push switch'));
  assert.ok(!opened.find(value=>value.kind==='pacific_button').actions.some(value=>value.command==='push button'));
  const flags=['pacific_box_open','pacific_switch_pushed','pacific_timer_expired'];
  const expired=state(flags),objects=getPacificHotspots(expired);
  assert.ok(objects.find(value=>value.kind==='pacific_button').actions.some(value=>value.command==='push button'));
  assert.ok(!objects.find(value=>value.kind==='pacific_switch').actions.some(value=>value.command==='push switch'));
  assert.equal(pacificControlState(expired).timerTurns,6);
  assert.equal(pacificControlState(expired).expired,true);
  flags.push('pacific_button_pushed');
  assert.ok(!getPacificHotspots(state(flags)).find(value=>value.kind==='pacific_button').actions.some(value=>value.command==='push button'));
});

test('椰子仅在真实物品列表中出现，按真实破裂flag选画且保持可取的地面站位',()=>{
  for(const cracked of [false,true]){
    const s=Object.freeze({...state(cracked?['coconut_cracked']:[],['coconut']),room:'east_beach'});
    const before=JSON.stringify(s),object=getPacificHotspots(s).find(value=>value.itemId==='coconut');
    assert.ok(object.actions.some(value=>value.command==='examine coconut'));
    assert.ok(object.actions.some(value=>value.command==='take coconut'));
    assert.equal(object.depthY,183);assert.equal(object.y,183);
    assert.equal(object.x,object.visualOptions.drawAt.x,'a loose coconut uses its actual sand contact as the interaction anchor');
    const c=context();assert.equal(renderPacificSprite(c,object,s),true);
    assert.deepEqual(c.calls[0].slice(1,5),PACIFIC_COCONUT_REGIONS[cracked?'cracked':'whole'].source);
    assert.equal(JSON.stringify(s),before);
  }
  assert.ok(!getPacificHotspots(Object.freeze({...state(),room:'east_beach'})).some(value=>value.itemId==='coconut'));
});

test('七房放下的物品落点与完整足底均在交付图的可走地面内',()=>{
  for(const room of PACIFIC_ROOMS){
    const s=Object.freeze({...state([],Object.keys(ITEMS)),room});
    for(const object of getPacificHotspots(s))assert.equal(isBlocked(SCENES[room],object.x,object.y),false,`${room}:${object.id}`);
  }
});
