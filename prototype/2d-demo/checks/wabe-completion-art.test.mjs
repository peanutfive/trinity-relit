import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {inflateSync} from 'node:zlib';

globalThis.Image = class {complete=true;naturalWidth=2172;};
const {
  renderCompletionSprite,completionBoyMotion,COMPLETION_BOY_FRAMES,
  COMPLETION_BOY_SCALE,COMPLETION_PROP_REGIONS,COMPLETION_GARLIC_REGION,
} = await import('../wabe-completion-art.js');

// Decode the shipped PNG's actual alpha, not just its RGBA header. This catches
// opaque backgrounds and cut-off frames without an image-library dependency.
async function rgbaPNG(name) {
  const bytes=await readFile(new URL(`../assets/${name}.png`,import.meta.url));
  assert.equal(bytes.subarray(1,4).toString(),'PNG');
  const width=bytes.readUInt32BE(16),height=bytes.readUInt32BE(20);
  assert.equal(bytes[24],8);assert.equal(bytes[25],6,'raw image must retain RGBA');
  assert.equal(bytes[28],0,'non-interlaced sampling');
  const chunks=[];
  for(let at=8;at<bytes.length;){const length=bytes.readUInt32BE(at),type=bytes.toString('ascii',at+4,at+8);if(type==='IDAT')chunks.push(bytes.subarray(at+8,at+8+length));at+=length+12;}
  const packed=inflateSync(Buffer.concat(chunks)),stride=width*4,pixels=Buffer.alloc(stride*height);
  const paeth=(a,b,c)=>{const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);return pa<=pb&&pa<=pc?a:pb<=pc?b:c;};
  for(let y=0;y<height;y++){
    const filter=packed[y*(stride+1)],start=y*(stride+1)+1;
    for(let x=0;x<stride;x++){
      const offset=y*stride+x,a=x>=4?pixels[offset-4]:0,b=y?pixels[offset-stride]:0,c=y&&x>=4?pixels[offset-stride-4]:0;
      const predictor=[0,a,b,Math.floor((a+b)/2),paeth(a,b,c)][filter];assert.ok(predictor!==undefined);
      pixels[offset]=(packed[start+x]+predictor)&255;
    }
  }
  return {width,height,alpha:(x,y)=>pixels[(y*width+x)*4+3]};
}
const rawBoy=rgbaPNG('wabe-giant-boy-v2'),rawProps=rgbaPNG('wabe-completion-props-v1');
const rawClove=rgbaPNG('wabe-garlic-clove-v1');

test('巨人及独立物件保留真实透明像素，源区不越界且完整提示随图保存',async()=>{
  for(const [name,promise,regions] of [
    ['wabe-giant-boy-v2',rawBoy,COMPLETION_BOY_FRAMES.map(frame=>frame.source)],
    ['wabe-completion-props-v1',rawProps,Object.values(COMPLETION_PROP_REGIONS)],
    ['wabe-garlic-clove-v1',rawClove,[COMPLETION_GARLIC_REGION]],
  ]) {
    const im=await promise;let clear=0,painted=0,maxAlpha=0;
    for(let y=0;y<im.height;y++)for(let x=0;x<im.width;x++){const a=im.alpha(x,y);if(a===0)clear++;if(a>240)painted++;maxAlpha=Math.max(maxAlpha,a);}
    assert.ok(clear>im.width*im.height*.2,'transparent gutters must remain clear');
    assert.ok(painted>1000,'the saved sprite must contain substantial painted pixels');assert.ok(maxAlpha>250);
    for(const [x,y,w,h] of regions)assert.ok(x>=0&&y>=0&&x+w<=im.width&&y+h<=im.height);
    assert.ok((await readFile(new URL(`../assets/${name}.prompt.txt`,import.meta.url),'utf8')).length>500);
  }
});

test('四姿态以同一尺度和实际脚线接地，PNG鞋尖不会随蘸水或吹泡漂移',async()=>{
  const im=await rawBoy,toes=[];
  for(const frame of COMPLETION_BOY_FRAMES){
    const [sx,sy,sw,sh]=frame.source;let minY=Infinity,maxY=-Infinity,maxX=-Infinity;
    for(let y=sy;y<sy+sh;y++)for(let x=sx;x<sx+sw;x++)if(im.alpha(x,y)>64){minY=Math.min(minY,y);maxY=Math.max(maxY,y);maxX=Math.max(maxX,x);}
    assert.ok(Math.abs((maxY-frame.foot[1])*COMPLETION_BOY_SCALE)<1,'painted contact stays on ground');
    assert.ok((frame.foot[1]-minY)*COMPLETION_BOY_SCALE>124);
    assert.ok((frame.foot[1]-minY)*COMPLETION_BOY_SCALE<134);
    toes.push((maxX-frame.foot[0])*COMPLETION_BOY_SCALE);
  }
  assert.ok(Math.max(...toes)-Math.min(...toes)<1,'stationary shoes use a stable world anchor');
});

function context(){
  const calls={images:[],arcs:[]};
  return {calls,save(){},restore(){},translate(){},scale(){},beginPath(){},ellipse(){},fill(){},stroke(){},moveTo(){},lineTo(){},closePath(){},clip(){},
    drawImage(...args){calls.images.push(args);},arc(...args){calls.arcs.push(args);},
    createLinearGradient(){return {addColorStop(){}};}};
}

test('真实渲染依次取独立休息、蘸水、举棒、吹泡画并保持逻辑脚锚',()=>{
  const sources=new Set();
  for(const time of [1,4,6,8]){
    const c=context(),m=completionBoyMotion(time),object={kind:'completion_boy',x:260,y:191,visualOptions:{drawAt:[185,176]}};
    assert.equal(renderCompletionSprite(c,object,Object.freeze({}),time),true);
    const draw=c.calls.images[0],f=COMPLETION_BOY_FRAMES[m.frame];sources.add(draw[1]);
    assert.ok(draw[0].src.endsWith('/assets/wabe-giant-boy-v2.png'));
    assert.deepEqual(draw.slice(1,5),f.source);
    assert.equal(draw[7]/draw[3],COMPLETION_BOY_SCALE);
    assert.ok(Math.abs(draw[5]+(f.foot[0]-f.source[0])*COMPLETION_BOY_SCALE-185)<1e-8);
    assert.ok(Math.abs(draw[6]+(f.foot[1]-f.source[1])*COMPLETION_BOY_SCALE-176)<1e-8);
  }
  assert.equal(sources.size,4);
  const c=context();renderCompletionSprite(c,{kind:'garlic',x:220,y:205},Object.freeze({}),0);
  assert.ok(c.calls.images[0][0].src.endsWith('/assets/wabe-garlic-clove-v1.png'),'current item text describes one clove, not several whole bulbs');
});

test('泡在嘴边棒环附着生长后脱离向外漂散，暂停及完整循环不生成剧情状态',()=>{
  const before=completionBoyMotion(7.4),after=completionBoyMotion(8.9);
  assert.equal(completionBoyMotion(4).pose,'dip');
  assert.ok(completionBoyMotion(4).wand.y>completionBoyMotion(6).wand.y+80,'wand rises from dish to face');
  assert.equal(before.pose,'blow');assert.ok(before.bubbles[0].attached);
  assert.ok(Math.hypot(before.bubbles[0].x-before.wand.x,before.bubbles[0].y-before.wand.y)<4);
  assert.ok(!after.bubbles[0].attached);assert.ok(after.bubbles[0].radius>before.bubbles[0].radius);
  assert.ok(Math.hypot(after.bubbles[0].x-before.wand.x,after.bubbles[0].y-before.wand.y)>15);
  assert.deepEqual(completionBoyMotion(11.9).bubbles,[]);
  assert.deepEqual(completionBoyMotion(12),completionBoyMotion(0));
  assert.deepEqual(completionBoyMotion(0).bubbles,[],'disabled ambient animation uses static time zero');
  const state=Object.freeze({itemLoc:Object.freeze({soap_bubble:'cottage'}),flags:Object.freeze([])}),snapshot=JSON.stringify(state),paused=completionBoyMotion(8.9),c=context();
  renderCompletionSprite(c,{kind:'completion_boy',x:185,y:176},state,8.9);
  assert.deepEqual(completionBoyMotion(8.9),paused,'queries and rendering cannot advance a paused clock');
  assert.equal(JSON.stringify(state),snapshot);
  const bubbleArc=c.calls.arcs[0];
  assert.ok(Math.abs(bubbleArc[0]-(185+paused.bubbles[0].x))<1e-8);
  assert.ok(Math.abs(bubbleArc[1]-(176+paused.bubbles[0].y))<1e-8);
});

test('姿态过渡在复用离屏画布线性混合后只合成一次，重叠身体不会透明',()=>{
  let allocations=0;const layers=[];
  globalThis.OffscreenCanvas=class {
    constructor(){allocations++;this.context={...context(),globalAlpha:1,globalCompositeOperation:'source-over',setTransform(){},clearRect(){layers.length=0;},
      save(){this.previousAlpha=this.globalAlpha;},restore(){this.globalAlpha=this.previousAlpha;},
      drawImage(...args){layers.push({args,alpha:this.globalAlpha,operation:this.globalCompositeOperation});}};}
    getContext(){return this.context;}
  };
  const c=context(),m=completionBoyMotion(3.38);
  renderCompletionSprite(c,{kind:'completion_boy',x:185,y:176},Object.freeze({}),3.38);
  assert.equal(layers.length,2);assert.equal(layers[0].operation,'source-over');assert.equal(layers[1].operation,'lighter');
  assert.ok(Math.abs(layers[0].alpha+layers[1].alpha-1)<1e-8,'overlapping pixels retain their full combined coverage');
  assert.equal(c.calls.images.length,1,'the scene receives a single finished character composite');
  assert.ok(c.calls.images[0][0] instanceof OffscreenCanvas);
  assert.deepEqual(layers.map(layer=>layer.args.slice(1,5)),[COMPLETION_BOY_FRAMES[m.previous].source,COMPLETION_BOY_FRAMES[m.frame].source]);
  renderCompletionSprite(context(),{kind:'completion_boy',x:185,y:176},Object.freeze({}),3.4);
  assert.equal(allocations,1,'a new raster surface is not allocated every animation frame');
  delete globalThis.OffscreenCanvas;
});
