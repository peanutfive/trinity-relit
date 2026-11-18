import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {inflateSync} from 'node:zlib';
import {TUNDRA_LANDMARKS_LAYOUT as L,TUNDRA_POINTS as P} from '../tundra-landmarks-layout.js';
import {isBlocked,findPath,isSegmentWalkable} from '../world.js';

globalThis.Image=class{complete=true;naturalWidth=2172;};
const {renderTundraSprite,tundraLemmingMotion,TUNDRA_LEMMING_SCALE,TUNDRA_LEMMING_FRAMES}=await import('../tundra-art.js');
function context(){const calls=[];return{calls,globalAlpha:1,save(){},restore(){},beginPath(){},ellipse(){},fill(){},drawImage(...args){calls.push(args);}};}
async function image(){
  const bytes=await readFile(new URL('../assets/tundra-props-v1.png',import.meta.url));
  const width=bytes.readUInt32BE(16),height=bytes.readUInt32BE(20);
  assert.equal(bytes[24],8);assert.equal(bytes[25],6,'保留生成图的真实RGBA透明');assert.equal(bytes[28],0);
  const chunks=[];for(let at=8;at<bytes.length;){const size=bytes.readUInt32BE(at);if(bytes.toString('ascii',at+4,at+8)==='IDAT')chunks.push(bytes.subarray(at+8,at+8+size));at+=size+12;}
  const raw=inflateSync(Buffer.concat(chunks)),stride=width*4,pixels=Buffer.alloc(stride*height);
  const paeth=(a,b,c)=>{const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);return pa<=pb&&pa<=pc?a:pb<=pc?b:c;};
  for(let y=0;y<height;y++)for(let x=0;x<stride;x++){const i=y*stride+x,a=x>=4?pixels[i-4]:0,b=y?pixels[i-stride]:0,c=y&&x>=4?pixels[i-stride-4]:0,f=raw[y*(stride+1)];pixels[i]=(raw[y*(stride+1)+1+x]+[0,a,b,Math.floor((a+b)/2),paeth(a,b,c)][f])&255;}
  return{width,height,alpha:(x,y)=>pixels[(y*width+x)*4+3]};
}

test('旅鼠四姿态为透明原画，单体完整且相对35像素主角保持小型动物体积',async()=>{
  const im=await image();assert.equal(im.width,2172);assert.equal(im.height,724);
  let clear=0;for(let y=0;y<im.height;y++)for(let x=0;x<im.width;x++)if(im.alpha(x,y)===0)clear++;
  assert.ok(clear>im.width*im.height*.45);
  for(const frame of TUNDRA_LEMMING_FRAMES){
    const[x,y,w,h]=frame.source;let loX=Infinity,hiX=-Infinity,loY=Infinity,hiY=-Infinity;
    assert.ok(x>=0&&y>=0&&x+w<=im.width&&y+h<=im.height);
    for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++)if(im.alpha(xx,yy)>64){loX=Math.min(loX,xx);hiX=Math.max(hiX,xx);loY=Math.min(loY,yy);hiY=Math.max(hiY,yy);}
    assert.ok(loX>x+2&&hiX<x+w-2&&loY>y+2&&hiY<y+h-2,'采样框不可切断毛发/脚');
    assert.ok((hiX-loX)*TUNDRA_LEMMING_SCALE<9);assert.ok((hiY-loY)*TUNDRA_LEMMING_SCALE<7);
    assert.ok(Math.abs(frame.foot[1]-hiY)*TUNDRA_LEMMING_SCALE<.1,'每帧脚点接地，不因动作悬浮');
  }
});

test('四种微动作不移动脚点、不依赖实时状态对象、不创造旅鼠或原章周期',()=>{
  const snapshot=Object.freeze({room:'cliff_edge',chapter:'tundra',flags:[],itemLoc:{lemming:'cliff_edge'}}),before=JSON.stringify(snapshot),sources=new Set();
  for(const time of [0,6.5,8.5,10.5]){
    const c=context(),motion=tundraLemmingMotion(time),frame=TUNDRA_LEMMING_FRAMES[motion.frame];
    assert.equal(renderTundraSprite(c,{kind:'tundra_lemming',...P.lemming},snapshot,time),true);
    const call=c.calls[0];sources.add(call[1]);assert.deepEqual(call.slice(1,5),frame.source);
    const groundY=call[6]+(frame.foot[1]-frame.source[1])*TUNDRA_LEMMING_SCALE;
    assert.ok(Math.abs(groundY-P.lemming.y)<1e-8);assert.equal(c.globalAlpha,1);
  }
  assert.equal(sources.size,4);assert.equal(JSON.stringify(snapshot),before);
  assert.deepEqual(tundraLemmingMotion(7),tundraLemmingMotion(7),'暂停时同一视觉时刻必须同姿态');
  assert.equal(renderTundraSprite(context(),{kind:'tundra_fissure',...P.fissure},snapshot),false,'裂缝已在背景，不再画第二个');
});

test('平台只在窄金属地面行走，悬崖/裂缝站位和梯脚使用完整足底',()=>{
  for(const [id,scene]of Object.entries(L)){
    assert.equal(isBlocked(scene,...scene.spawn),false,id);
    for(const [dir,anchor]of Object.entries(scene.exitAnchors)){
      const path=findPath(scene,scene.spawn,anchor,{nearest:true});assert.ok(path.length,`${id}.${dir}`);
      for(let i=1;i<path.length;i++)assert.ok(isSegmentWalkable(scene,path[i-1],path[i]),`${id}.${dir} segment`);
      assert.ok(Math.hypot(path.at(-1)[0]-anchor[0],path.at(-1)[1]-anchor[1])<17);
    }
  }
  assert.ok(L.platform.interactionExitDirs.includes('n')&&L.platform.interactionExitDirs.includes('d'),'离开高台均F，不从空气自动跨向山口');
  assert.equal(isBlocked(L.platform,300,230),true,'平台下面的钢壳/空中不是可站地面');
  assert.equal(isBlocked(L.cliff_edge,235,90),true,'北冰洋与崖壁不是地面');
  assert.equal(isBlocked(L.cliff_edge,P.fissure.x,P.fissure.y),false);
  assert.equal(isBlocked(L.cliff_edge,P.lemming.x,P.lemming.y),false);
});
