import test from 'node:test';
import assert from 'node:assert/strict';
import { createPrologueSession } from '../engine-adapter.js';
import { getHotspots } from '../interaction-catalog.js';
import { SCENES } from '../scene-manifest.js';
import { isBlocked } from '../world.js';
import { createNarrativeDirector, drawStoryProp, setStorySpriteRenderer } from '../narrative.js';
import { createPramPushMotion, samplePramPushMotion } from '../pram-motion.js';
import { PRAM_GEOMETRY, PUSHER_GEOMETRY, PUSHER_ART_FRAMES, pusherFrameFor } from '../pram-art-layout.js';

// These are the actual chapter connections and painted entrances, independent
// of the animation's own route metadata. A correct endpoint alone cannot prove
// that the carriage entered along a road.
const legs = [
  {fromRoom:'black_lion_gate',room:'inverness_terrace',entrance:[16,95]},
  {fromRoom:'inverness_terrace',room:'lancaster_gate',entrance:[156,183]},
  {fromRoom:'lancaster_gate',room:'lancaster_walk',entrance:[239,16]},
  {fromRoom:'lancaster_walk',room:'flower_walk',entrance:[250,16]},
];
const distance = (a,b) => Math.hypot(a.x-b.x,a.y-b.y);
const inside = actor => actor.x>=12&&actor.x<=468&&actor.y>=12&&actor.y<=276;
const snapshot = engine => ({...engine.state.serialize(),visual:{room:engine.state.room,
  player:{x:SCENES[engine.state.room].spawn[0],y:SCENES[engine.state.room].spawn[1],face:'right'},
  hotspots:getHotspots(engine.state)}});

async function pushedLegs() {
  const engine=createPrologueSession();engine.moveTo(engine.state.room);
  for(const command of ['n','n'])await engine.processInput(command);
  const result=[];
  for(const leg of legs) {
    const before=snapshot(engine);await engine.processInput('push pram');
    const after=snapshot(engine),target=getHotspots(engine.state).find(object=>object.kind==='pram');
    assert.equal(before.room,leg.fromRoom);assert.equal(after.room,leg.room);
    assert.equal(after.turns,before.turns+1,'one push must remain one original-engine turn');
    assert.equal(after.dead,false);assert.ok(target,'the original pram must exist after moving');
    result.push({...leg,before,after,target});
  }
  return {engine,legs:result};
}

function samples(plan,step=.016) {
  const result=[];
  for(let elapsed=0;elapsed<plan.duration;elapsed+=step)
    result.push({elapsed,...samplePramPushMotion(plan,elapsed)});
  result.push({elapsed:plan.duration,...samplePramPushMotion(plan,plan.duration)});
  return result;
}

for(const leg of legs) test(`${leg.fromRoom} → ${leg.room}: 推车经过真实入口，车轮与推车人沿地面到达`,async()=>{
  const actual=(await pushedLegs()).legs.find(value=>value.room===leg.room);
  const plan=createPramPushMotion({fromRoom:leg.fromRoom,room:leg.room,target:actual.target});
  assert.equal(plan.room,leg.room);assert.equal(plan.fromRoom,leg.fromRoom);
  assert.ok(plan.path.length>=2);assert.ok(plan.distance>0);assert.ok(plan.duration>0);
  const frames=samples(plan),scene=SCENES[leg.room];
  assert.ok(frames.some(frame=>Math.hypot(frame.pram.x-leg.entrance[0],frame.pram.y-leg.entrance[1])<18),
    'must use the painted incoming connection, not slide in horizontally at the destination height');
  let visiblePram=0,visiblePusher=0;
  for(const frame of frames) {
    assert.equal(frame.pram.kind,'pram');assert.equal(frame.pusher.kind,'pusher');
    for(const actor of [frame.pram,frame.pusher]) {
      assert.ok(Number.isFinite(actor.x)&&Number.isFinite(actor.y));
      if(!inside(actor))continue; // Off-screen entrance extension is not playable ground.
      assert.equal(isBlocked(scene,actor.x,actor.y),false,
        `${actor.kind} must stay grounded at ${frame.elapsed.toFixed(3)}s: ${actor.x},${actor.y}`);
      if(actor.kind==='pram')visiblePram++;else visiblePusher++;
    }
    for(const [dx,dy] of PRAM_GEOMETRY[plan.facing].wheelContacts) {
      const wheel={x:frame.pram.x+dx,y:frame.pram.y+dy};
      if(!inside(wheel))continue;
      assert.equal(isBlocked({...scene,footprint:{rx:1.5,ry:.8}},wheel.x,wheel.y),false,
        `wheel contact must stay on the path at ${frame.elapsed.toFixed(3)}s: ${wheel.x},${wheel.y}`);
    }
  }
  assert.ok(visiblePram>20&&visiblePusher>20,'must show a sustained grounded push, not only its final frame');
  const last=frames.at(-1);
  assert.ok(distance(last.pram,actual.target)<1e-7,'static pram resumes exactly where the motion stops');
  assert.ok(distance(last.pusher,plan.landing)<1e-7,'player landing must equal the last visible pusher foot');
  assert.equal(isBlocked(scene,plan.landing.x,plan.landing.y),false,'control resumes on walkable ground');
});

test('推行按真实路程限速、起步和缓停；16毫秒内不再整张贴图冲过数个像素',async()=>{
  for(const leg of (await pushedLegs()).legs) {
    const plan=createPramPushMotion(leg),frames=samples(plan);
    assert.ok(plan.duration>=plan.distance/65,'long routes cannot retain the old fixed 1.05-second duration');
    let peak=0;
    for(let index=1;index<frames.length;index++) {
      const a=frames[index-1],b=frames[index],dt=b.elapsed-a.elapsed;
      const step=distance(a.pram,b.pram),speed=step/dt;
      peak=Math.max(peak,speed);
      assert.ok(speed<=65+.01,`${leg.room}: ${speed} world pixels/sec`);
      assert.ok(step<=1.05,`${leg.room}: no visible teleport between adjacent 16ms frames`);
      assert.ok(b.distance>=a.distance-1e-7,'travel mileage must never run backward');
    }
    const firstSpeed=distance(frames[0].pram,frames[1].pram)/.016;
    const last=frames.at(-1),previous=frames.at(-2);
    const finalSpeed=distance(previous.pram,last.pram)/(last.elapsed-previous.elapsed);
    assert.ok(peak>15,'the carriage must actually travel during the visible event');
    assert.ok(firstSpeed<peak*.25,'start with weight instead of instantly reaching cruising speed');
    assert.ok(finalSpeed<peak*.25,'roll to a stop instead of snapping from cruising speed to idle');
    assert.equal(last.pram.visualOptions.rolling,false);
    assert.equal(last.pusher.visualOptions.moving,false);
    assert.equal(samplePramPushMotion(plan,-1).progress,0);
    assert.equal(samplePramPushMotion(plan,plan.duration+10).progress,1);
  }
});

test('手掌始终握住实际车把，轮子按滚过的路程转动而非凭全局时钟空转',async()=>{
  for(const leg of (await pushedLegs()).legs) {
    const plan=createPramPushMotion(leg),frames=samples(plan,.057);
    const cart=PRAM_GEOMETRY[plan.facing],human=PUSHER_GEOMETRY[plan.facing];
    assert.ok(cart&&human,'pushing must use a calibrated view of both body and carriage');
    for(const frame of frames) {
      const cartHand={x:frame.pram.x+cart.grip[0],y:frame.pram.y+cart.grip[1]};
      const humanHand={x:frame.pusher.x+human.grip[0],y:frame.pusher.y+human.grip[1]};
      assert.ok(distance(cartHand,humanHand)<1e-6,'visible hands and handle must remain attached through bends and stops');
      assert.equal(frame.pram.visualOptions.facing,plan.facing);
      assert.equal(frame.pusher.visualOptions.facing,plan.facing);
      assert.ok(Math.abs(frame.pram.visualOptions.wheelPhase*cart.wheelRadius-frame.distance)<1e-6,
        'no wheel slipping: radius × angle must equal traveled distance');
      assert.ok(Number.isFinite(frame.pusher.visualOptions.phase),'walking pose is driven by traveled ground');
    }
    const stopped=samplePramPushMotion(plan,plan.duration),later=samplePramPushMotion(plan,plan.duration+10);
    assert.equal(later.pram.visualOptions.wheelPhase,stopped.pram.visualOptions.wheelPhase);
    assert.equal(later.pusher.visualOptions.phase,stopped.pusher.visualOptions.phase);
  }
});

function canvasStub() {
  return new Proxy({globalAlpha:1},{get:(target,key)=>key in target?target[key]:(()=>{}),
    set:(target,key,value)=>(target[key]=value,true)});
}

test('真实推车只结算一次；导演交出接地角色且不在前景层上重复绘制',async()=>{
  for(const leg of (await pushedLegs()).legs) {
    const director=createNarrativeDirector();
    assert.ok(director.onCommand(leg.before,leg.after,'push pram').includes('pram_push'));
    const committed=structuredClone(leg.after),during=director.getState(leg.after);
    assert.equal(during.currentEvent,'pram_push');assert.equal(during.hidePlayer,true);
    assert.ok(during.hiddenKinds.includes('pram'),'hide destination static pram while its moving counterpart is visible');
    assert.deepEqual(during.groundActors.map(actor=>actor.kind).sort(),['pram','pusher']);
    const calls=[],context=canvasStub();
    setStorySpriteRenderer((_,object)=>{calls.push(object);return true;});
    try {
      for(const object of leg.after.visual.hotspots)
        if(!during.hiddenKinds.includes(object.kind))drawStoryProp(context,object,leg.after,0);
      for(const object of during.groundActors)drawStoryProp(context,object,leg.after,0);
      assert.equal(calls.filter(actor=>actor.kind==='pram').length,1);
      assert.equal(calls.filter(actor=>actor.kind==='pusher').length,1);
      const beforeOverlay=calls.length;
      director.draw(context,leg.room,leg.after,0);
      assert.equal(calls.length,beforeOverlay,'event draw must not paint the grounded pair again above foregrounds');
      director.update(0);director.update(0);
      assert.equal(director.getState(leg.after).elapsed,0,'paused presentation has no movement');
      const finalPlan=createPramPushMotion(leg),end=samplePramPushMotion(finalPlan,finalPlan.duration);
      assert.ok(distance(during.playerLanding,end.pusher)<1e-7,'control landing is authored by the same final foot');
      director.skip();
      assert.equal(director.getState(leg.after).groundActors.length,0);
      assert.equal(director.getState(leg.after).hiddenKinds.includes('pram'),false);
      assert.deepEqual(leg.after,committed,'query, draw, pause and skip cannot mutate the committed engine snapshot');
    } finally {setStorySpriteRenderer(null);}
  }
});

test('撑伞后的风驱失控仍走原来的3.1秒演出，不误降为普通慢推',async()=>{
  const engine=createPrologueSession();engine.moveTo(engine.state.room);
  for(const command of ['e','take ball','nw','unscrew gnomon','take gnomon','n',
    'take paper bird','open paper bird','w','buy crumbs','feed birds','take ruby',
    'n','push pram','push pram','wait','throw ball at tree','take umbrella',
    'push pram','open pram','enter pram'])await engine.processInput(command);
  const before=snapshot(engine);await engine.processInput('open umbrella');const after=snapshot(engine);
  assert.equal(after.room,'long_water');assert.ok(after.flags.includes('pram_broken'));
  assert.equal(after.turns,before.turns+1);
  const director=createNarrativeDirector(),added=director.onCommand(before,after,'open umbrella');
  assert.ok(added.includes('pram_runaway'));assert.equal(added.includes('pram_push'),false);
  const story=director.getState(after);
  assert.equal(story.currentEvent,'pram_runaway');assert.equal(story.duration,3.1);
  assert.equal(story.hidePlayer,true);
  const committed=structuredClone(after);director.update(3.1);director.skip();
  assert.deepEqual(after,committed,'presentation must not replay the original runaway command');
});

// Record the real renderer's canvas transforms. This checks the delivered
// anatomical anchors, rather than only verifying the planner's object fields.
function recordingCanvas() {
  let transform=[1,0,0,1,0,0];const stack=[],images=[],rotations=[];
  const context=canvasStub();
  context.save=()=>stack.push([...transform]);
  context.restore=()=>{transform=stack.pop();};
  context.translate=(x,y)=>{const [a,b,c,d,e,f]=transform;transform=[a,b,c,d,e+a*x+c*y,f+b*x+d*y];};
  context.scale=(x,y)=>{const [a,b,c,d,e,f]=transform;transform=[a*x,b*x,c*y,d*y,e,f];};
  context.rotate=angle=>{
    rotations.push(angle);const [a,b,c,d,e,f]=transform,co=Math.cos(angle),si=Math.sin(angle);
    transform=[a*co+c*si,b*co+d*si,c*co-a*si,d*co-b*si,e,f];
  };
  context.drawImage=(source,...args)=>images.push({source:source.src,args,transform:[...transform]});
  return {context,images,rotations};
}
function paintedSourcePoint(draw,point) {
  const [sx,sy,sw,sh,dx,dy,dw,dh]=draw.args;
  const x=dx+(point[0]-sx)/sw*dw,y=dy+(point[1]-sy)/sh*dh;
  const [a,b,c,d,e,f]=draw.transform;
  return {x:a*x+c*y+e,y:b*x+d*y+f};
}

test('游戏实际绘制通路使用推车素材：手部固定、身体尺度一致、停后轮子不随时间空转',async()=>{
  const originalImage=globalThis.Image;
  globalThis.Image=class {complete=true;naturalWidth=1536;naturalHeight=1024;};
  try {
    const {renderStorySprite}=await import('../story-atlas.js');
    const {renderPramArt}=await import('../pram-art.js');
    const special=recordingCanvas();
    assert.equal(renderPramArt(special.context,{kind:'pram',x:240,y:180},{flags:['pram_broken']},0),false,
      'restored/finished broken carriage must keep its special fallback without needing an event option');
    assert.equal(special.images.length,0);
    const paint=(object,time=0)=>{
      const output=recordingCanvas();setStorySpriteRenderer(renderStorySprite);
      try {drawStoryProp(output.context,object,{},time);} finally {setStorySpriteRenderer(null);}
      return output;
    };
    for(const facing of ['right','down']) {
      const x=240,y=180,grip=PUSHER_GEOMETRY[facing].grip;
      for(let frameIndex=0;frameIndex<3;frameIndex++) {
        const frame=PUSHER_ART_FRAMES[facing][frameIndex];
        const result=paint({kind:'pusher',x,y,visualOptions:{facing,moving:true,pushFrame:frameIndex}});
        assert.equal(result.images.length,1);
        const draw=result.images[0];assert.ok(draw.source.endsWith('/assets/pram-pusher-v1.png'));
        const hand=paintedSourcePoint(draw,frame.grip),foot=paintedSourcePoint(draw,frame.foot);
        assert.ok(distance(hand,{x:x+grip[0],y:y+grip[1]})<1e-7,'all painted hands meet the same world handle');
        assert.ok(distance(foot,{x,y})<1,'sole lift stays below one logical pixel across stepping poses');
        const head=paintedSourcePoint(draw,[frame.foot[0],frame.head]);
        assert.ok(Math.abs(Math.abs(foot.y-head.y)-35)<1e-7,'gait does not resize the human');
      }
      const object={kind:'pram',x,y,visualOptions:{facing,rolling:false,wheelPhase:1.3}};
      const now=paint(object,0),later=paint(object,500);
      assert.ok(now.images.some(draw=>draw.source.endsWith('/assets/pram-views-v1.png')),
        'normal cart must not fall through to the old static atlas');
      assert.deepEqual(later.images,now.images,'wall-clock time cannot bob a parked carriage');
      assert.deepEqual(later.rotations,now.rotations,'wheel angles stay fixed while parked or paused');
      const turned=paint({...object,visualOptions:{...object.visualOptions,wheelPhase:2.1}});
      assert.deepEqual(turned.images,now.images,'rolling rotates the spokes without displacing the tyres');
      assert.notDeepEqual(turned.rotations,now.rotations,'mileage changes the actual wheel drawing');
    }
    assert.deepEqual([0,.25,.5,.75].map(cycle=>pusherFrameFor({moving:true,phase:cycle*Math.PI*2})),[0,1,0,2],
      'the renderer consumes the planner\'s radians as one walking cycle, not six fast cycles');
  } finally {
    if(originalImage===undefined)delete globalThis.Image;else globalThis.Image=originalImage;
    setStorySpriteRenderer(null);
  }
});
