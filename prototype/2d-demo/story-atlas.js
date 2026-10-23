import { paintCharacter } from './character.js';
const image = new Image();
image.src = new URL('./assets/story-sprites-cutout.png', import.meta.url).href;
const details = new Image();
details.src = new URL('./assets/story-detail.png', import.meta.url).href;
// The approved raster atlas uses hand-verified bounds, not assumed equal cells.
const bounds = {
  woman:[30,30,205,330],woman_give:[270,30,225,330],woman_alarm:[518,25,230,335],
  umbrella_woman:[780,20,220,345],boy:[1025,25,215,335],boy_startled:[1270,20,250,345],
  pigeon:[12,371,230,183],pigeon_flap:[254,359,233,195],
  runner0:[488,385,270,165],runner1:[765,385,255,165],runner_ruby0:[1021,385,253,165],runner_ruby1:[1275,385,260,165],
  ruby:[73,583,120,120],ball:[294,563,160,146],gnomon:[565,558,180,155],paper_bird:[785,575,218,140],paper_open:[1018,572,231,140],bag:[1300,565,218,150],
  pram:[0,722,258,272],pram_open:[260,718,277,277],umbrella:[565,719,108,275],umbrella_open:[687,728,319,267],sundial:[1019,722,246,277],white_door:[1324,710,204,290],
};
const detailBounds={seller_portrait:[80,15,655,528],umbrella_portrait:[810,10,670,531],missile:[30,550,740,430],runner_flutter:[780,545,750,460]};
function stamp(ctx,key,x,y,width,height,options={}) {
  const source=detailBounds[key]?details:image;
  const region=detailBounds[key]||bounds[key];
  if(!source.complete||!source.naturalWidth||!region)return false;
  const [sx,sy,sw,sh]=region;
  ctx.save();ctx.translate(x,y);if(options.flip)ctx.scale(-1,1);if(options.rotation)ctx.rotate(options.rotation);
  ctx.imageSmoothingEnabled=true;
  ctx.drawImage(source,sx,sy,sw,sh,-width/2,-height,width,height);ctx.restore();return true;
}
const has=(state,key)=>state.hasFlag?.(key)??(state.flags||[]).includes(key);
export function renderStorySprite(ctx,object,state,time) {
  if(!image.complete||!image.naturalWidth)return false;
  const {kind,x,y}=object,options=object.visualOptions||object;
  const bob=Math.sin(time*1.8)*.12;
  if(['woman','bird_woman','old_woman','umbrella_woman'].includes(kind)){
    const eastWoman=kind==='umbrella_woman'||object.id==='lancaster_gate:woman';
    return stamp(ctx,eastWoman?'umbrella_woman':options.alarm?'woman_alarm':options.give?'woman_give':'woman',x,y+bob,eastWoman?26:29,40);
  }
  if(kind==='boy'||kind==='teenager')return stamp(ctx,options.startled?'boy_startled':'boy',x,y+bob,27,35);
  if(kind==='birds'||kind==='pigeons'){
    for(let i=0;i<5;i++)stamp(ctx,'pigeon',x+(i*17)%36-18,y+(i*11)%22-11+Math.sin(time*3+i)*.2,10,8,{flip:i%2===0});
    return true;
  }
  if(kind==='pigeon')return stamp(ctx,Math.abs(options.flap||0)>.2?'pigeon_flap':'pigeon',x,y,12,options.flap?12:8,options);
  if(['roadrunner','large_bird','ruby_bird'].includes(kind)){
    const frame=Math.floor(time*11)%2;
    if(options.flying&&options.ruby)return stamp(ctx,'runner_flutter',x,y,37,23,options);
    return stamp(ctx,`runner${options.ruby?'_ruby':''}${frame}`,x,y,29,17,options);
  }
  if(kind==='ruby'||kind==='gem'){
    stamp(ctx,'ruby',x,y,8,8);
    if(Math.sin(time*3)>.85){ctx.fillStyle='#f9e4bd';ctx.fillRect(x-1,y-6,.7,2);ctx.fillRect(x-1.6,y-5.4,2,.7);}
    return true;
  }
  if(kind==='ball')return stamp(ctx,'ball',x,y,10,10);
  if(kind==='gnomon')return stamp(ctx,'gnomon',x,y,13,10,options);
  if(kind==='paper_boat')return stamp(ctx,'paper_bird',x,y,15,7,{rotation:.06});
  if(kind==='paper_bird'||kind==='paper')return stamp(ctx,has(state,'bird_unfolded')||options.unfold>.5?'paper_open':'paper_bird',x,y,has(state,'bird_unfolded')?18:15,11);
  if(kind==='bag')return stamp(ctx,'bag',x,y,13,12);
  if(kind==='missile')return stamp(ctx,'missile',x,y,56,33,options);
  if(kind==='umbrella'||kind==='umbrella_tree')return stamp(ctx,options.open?'umbrella_open':'umbrella',x,y,options.open?34:10,27,options);
  if(kind==='sundial'||kind==='dial')return stamp(ctx,'sundial',x,y,30,32);
  if(kind==='door'||kind==='white_door')return stamp(ctx,'white_door',x,y,25,46);
  if(kind==='pram'||kind==='perambulator'||kind==='carriage'){
    ctx.save();if(options.broken)ctx.rotate(.03);
    if(options.rider)paintCharacter(ctx,x,y-13,'#bca071','right',0,false,{time,blend:0});
    stamp(ctx,options.open||options.rider||has(state,'pram_open')?'pram_open':'pram',x,y+Math.sin(time*12)*(options.rolling?.25:0),42,31);
    if(options.sail)stamp(ctx,'umbrella_open',x+9,y-22,34,27,{rotation:-.2});
    ctx.restore();return true;
  }
  return false;
}
export function drawStoryPortrait(ctx,id,x=20,y=45,width=82,height=100) {
  if(!details.complete||!details.naturalWidth)return;
  const [sx,sy,sw,sh]=detailBounds[id==='umbrella_woman'?'umbrella_portrait':'seller_portrait'];
  ctx.save();ctx.fillStyle='#1b2b22ed';ctx.fillRect(x,y,width,height);ctx.imageSmoothingEnabled=true;
  const drawHeight=(width-6)*sh/sw;
  ctx.drawImage(details,sx,sy,sw,sh,x+3,y+height-drawHeight-3,width-6,drawHeight);ctx.strokeStyle='#c3a675';ctx.lineWidth=.7;ctx.strokeRect(x,y,width,height);ctx.restore();
}
export function spriteArtStatus(){return image.complete&&image.naturalWidth&&details.complete&&details.naturalWidth?'loaded':'loading';}
