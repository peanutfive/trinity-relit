import test from 'node:test';
import assert from 'node:assert/strict';
import {createPrologueSession} from '../engine-adapter.js';
import {SCENES, sceneExits, sceneBoundaries} from '../scene-manifest.js';
import {getHotspots} from '../interaction-catalog.js';
import {findPath, isBlocked, approachingExit} from '../world.js';
import {roomArrival} from '../arrivals.js';
import {createCliffPassage, sampleCliffPassage} from '../cliff-motion.js';
import {createNarrativeDirector} from '../narrative.js';

// Independent foot-level samples from the delivered PNGs, in 480 x 288 space.
// Do not derive these from a layout polygon: the artwork is the navigation
// promise. Orbit is intentionally absent; vacuum has no painted ground roads.
const PAINTED_ROADS = {
  trellises: {
    n: [[240,155],[237,118],[236,72],[237,16]],
    ne: [[240,155],[325,118],[392,62],[436,16]],
    e: [[240,155],[360,147],[464,146]],
    se: [[240,155],[325,190],[405,240],[457,273]],
    sw: [[240,155],[175,184],[99,228],[28,275]],
    w: [[240,155],[122,146],[16,146]],
    nw: [[240,155],[152,118],[76,59],[42,16]],
    u: [[250,147],[278,131],[290,104],[299,80],[320,50],[342,33]],
  },
  south_bog: {
    n: [[240,153],[241,81],[240,16]],
    ne: [[240,153],[301,118],[361,72],[413,16]],
    e: [[240,153],[278,158],[350,164],[420,154],[464,148]],
    se: [[240,153],[307,201],[360,241],[418,275]],
    s: [[240,153],[238,222],[237,275]],
    w: [[240,153],[120,143],[16,135]],
  },
  north_bog: {
    n: [[240,167],[235,83],[231,16]],
    e: [[240,167],[359,141],[464,123]],
    se: [[240,167],[358,215],[464,232]],
    s: [[240,167],[240,227],[240,275]],
    sw: [[240,167],[151,214],[70,258],[27,275]],
  },
  forest_clearing: {
    n: [[240,154],[247,99],[249,16]],
    ne: [[240,154],[315,111],[359,72],[413,16]],
    e: [[240,154],[349,167],[464,144]],
    nw: [[240,154],[179,101],[121,71],[77,16]],
  },
  arboretum: {
    e: [[240,185],[360,185],[464,185]],
    w: [[240,185],[120,185],[16,185]],
  },
  top_of_arbor: {
    n: [[248,135],[233,109],[231,91],[244,69],[245,51],[230,21],[234,16]],
    s: [[248,135],[247,156],[238,179],[245,213],[268,240],[278,275]],
    d: [[248,135],[218,140],[183,149],[161,168],[141,183],[97,197]],
  },
  north_arbor: {
    s: [[240,149],[248,174],[268,199],[270,220],[250,255],[231,275]],
  },
  south_arbor: {
    n: [[240,181],[263,142],[271,113],[258,87],[236,38],[242,16]],
  },
  arborvitaes_n: {
    nw: [[267,184],[251,153],[216,134],[184,115],[154,91],[131,71],[111,40],[95,16]],
    w: [[267,184],[222,183],[137,179],[72,176],[16,174]],
  },
  arborvitaes_s: {
    ne: [[220,158],[220,131],[241,111],[264,94],[304,60],[316,16]],
    e: [[220,158],[242,176],[363,176],[464,174]],
  },
  waterfall: {
    ne: [[330,185],[332,160],[349,143],[360,90],[352,16]],
    e: [[330,185],[350,185],[388,160],[417,150],[464,146]],
    se: [[330,185],[350,223],[372,252],[391,275]],
    in: [[330,185],[315,183],[313,160],[333,142],[350,140]],
  },
};

const VIEW_ROOMS = Object.keys(PAINTED_ROADS);
const PROLOGUE = [
  'e','take ball','nw','unscrew gnomon','take gnomon','n','take paper bird','open paper bird',
  'w','buy crumbs','feed birds','take ruby','n','push pram','push pram','wait','throw ball at tree',
  'take umbrella','push pram','open pram','enter pram','open umbrella','take paper bird','take gnomon',
  'enter water','enter door','n','ne','take splinter','e','s',
];

async function ready() {
  const e = createPrologueSession();
  e.moveTo(e.state.room);
  for (const input of PROLOGUE) {
    await e.processInput(input);
    assert.equal(e.state.dead, false, input);
  }
  assert.equal(e.state.room, 'trellises');
  return e;
}

function view(state, room) {
  return Object.assign(Object.create(state), {room});
}

function densePath(scene, path, receipt, resolution = .25) {
  assert.ok(path.length >= 2, `${receipt}: empty path`);
  for (let index = 1; index < path.length; index++) {
    const a = path[index - 1], b = path[index];
    const steps = Math.max(1, Math.ceil(Math.hypot(b[0]-a[0], b[1]-a[1]) / resolution));
    for (let sample = 0; sample <= steps; sample++) {
      const t = sample / steps, x = a[0] + (b[0]-a[0])*t, y = a[1] + (b[1]-a[1])*t;
      assert.equal(isBlocked(scene, x, y), false,
        `${receipt}: painted/returned path blocked at ${x.toFixed(3)},${y.toFixed(3)}`);
    }
  }
}

function gateScene(state) {
  const scene = SCENES.waterfall;
  const gate = getHotspots(view(state, 'waterfall')).find(object => object.kind === 'mushroom_gate');
  assert.ok(gate);
  // The actual runtime body is 16 x 5 from its centre, in addition to the
  // player's full foot ellipse; checking only the gate's centre misses jams.
  return {...scene, obstacles: [...scene.obstacles,
    {x: gate.x-16, y: gate.y-5, w: 32, h: 10}]};
}

test('11张新制/重制地面图的38条绘画道路逐0.25像素连续可走', () => {
  let roads = 0;
  for (const [room, exits] of Object.entries(PAINTED_ROADS)) {
    assert.equal(SCENES[room].terrain.status, 'art-ground-trace-v2');
    for (const [direction, path] of Object.entries(exits)) {
      densePath(SCENES[room], path, `${room}.${direction}`);
      roads++;
    }
  }
  assert.equal(roads, 38);
});

test('南侧藤架真实卡点的寻路每段逐0.1像素复检，不容许窄接缝被采样跳过', () => {
  const scene = SCENES.south_arbor, start = {x: 248.3118, y: 46.0089}, target = {x: 262, y: 142};
  assert.equal(isBlocked(scene, start.x, start.y), false);
  assert.equal(isBlocked(scene, target.x, target.y), false);
  densePath(scene, findPath(scene, start, target), 'south_arbor: browser corner regression', .1);
});

test('绘画里的水潭、沼水、藤墙、前景和侧藤架尽头拒绝落脚，不生成假路', () => {
  const solid = [
    ['trellises',240,246],['trellises',170,70],['trellises',240,275],
    ['south_bog',140,100],['south_bog',100,200],['south_bog',315,132],
    ['north_bog',170,100],['north_bog',310,235],
    ['forest_clearing',240,235],['forest_clearing',120,150],
    ['arboretum',240,110],['arboretum',240,245],
    ['top_of_arbor',100,120],['top_of_arbor',400,180],
    ['north_arbor',240,80],['south_arbor',240,240],
    ['arborvitaes_n',140,115],['arborvitaes_n',250,240],['arborvitaes_n',430,170],
    ['arborvitaes_s',350,120],['arborvitaes_s',190,160],['arborvitaes_s',280,230],
    ['waterfall',200,160],['waterfall',100,100],['waterfall',270,230],['waterfall',430,100],
  ];
  for (const [room,x,y] of solid) assert.equal(isBlocked(SCENES[room],x,y),true,`${room}: ${x},${y}`);
});

test('两种翻转状态下每条画面道路均有出口或制作边界，内部门只由F触发', async () => {
  const e = await ready();
  for (const flipped of [false,true]) {
    if (flipped) for (const input of ['u','n','s','d']) await e.processInput(input);
    assert.equal(e.state.flipped, flipped);
    const before = e.state.serialize();
    for (const room of VIEW_ROOMS) {
      const s = view(e.state, room), scene = SCENES[room];
      const exits = sceneExits(room,s,e.rooms), boundaries = sceneBoundaries(room,s,e.rooms);
      assert.deepEqual([...exits,...boundaries].map(exit=>exit.dir).sort(),
        Object.keys(PAINTED_ROADS[room]).sort(), `${room}: all painted roads represented`);
      assert.equal(isBlocked(scene,...scene.spawn), false, `${room}: spawn`);
      for (const exit of [...exits,...boundaries]) {
        assert.equal(isBlocked(scene,exit.x,exit.y), false, `${room}.${exit.dir}: foot anchor`);
        densePath(scene,findPath(scene,scene.spawn,[exit.x,exit.y]),`${room}.${exit.dir}: spawn to opening`);
      }
      for (const exit of exits.filter(exit=>exit.interactionOnly))
        assert.equal(approachingExit(exit,{x:exit.x,y:exit.y+5},{x:exit.x,y:exit.y}),false,
          `${room}.${exit.dir}: walking must not auto-enter an internal door`);
    }
    assert.deepEqual(e.state.serialize(),before);
  }
});

test('全部受影响新旧场景连接按来源落在安全内侧，两态连续寻路不能切过地形', async () => {
  const e = await ready();
  let checked = 0;
  for (const flipped of [false,true]) {
    if (flipped) for (const input of ['u','n','s','d']) await e.processInput(input);
    assert.equal(e.state.flipped,flipped);
    const before = e.state.serialize();
    for (const room of Object.keys(SCENES)) {
      if (!e.rooms[room]) continue;
      const state = view(e.state,room);
      for (const exit of sceneExits(room,state,e.rooms)) {
        if (exit.target === room || (!VIEW_ROOMS.includes(room) && !VIEW_ROOMS.includes(exit.target))) continue;
        const target = SCENES[exit.target], returns = sceneExits(exit.target,view(e.state,exit.target),e.rooms);
        const landing = roomArrival(target,{fromRoom:room,direction:exit.dir,exits:returns});
        const receipt = `${flipped?'flipped':'normal'} ${room}.${exit.dir} -> ${exit.target}`;
        assert.ok(landing,receipt);
        assert.equal(isBlocked(target,landing.x,landing.y),false,receipt);
        densePath(target,findPath(target,landing,target.spawn),receipt);
        for (const sensor of returns)
          assert.ok(Math.hypot(landing.x-sensor.x,landing.y-sensor.y)>=sensor.radius+8-.001,
            `${receipt}: newly arrived feet must clear ${sensor.dir}'s exit sensor`);
        checked++;
      }
    }
    assert.deepEqual(e.state.serialize(),before);
  }
  assert.ok(checked >= 80,`need incoming old-room connections as well as default exits; got ${checked}`);
});

test('瀑布蘑菇门使用完整实体占地后，三条岸路与观察站位仍可互通', async () => {
  const e = await ready(), scene = gateScene(e.state), start = SCENES.waterfall.spawn;
  assert.equal(isBlocked(scene,350,170),true,'角色不能站进蘑菇门底座');
  for (const destination of [[352,16],[464,146],[391,275],[300,170]])
    densePath(scene,findPath(scene,start,destination),`waterfall bank around 32x10 gate -> ${destination}`);
  // Crossing directly through the gate's foot must be rejected even if both
  // endpoints lie on the broad painted bank.
  let blocked = false;
  for(let x=320;x<=380;x+=.25)if(isBlocked(scene,x,170))blocked=true;
  assert.ok(blocked);
});

test('登藤/越顶/返程短演出逐点接地，冻结/跳过/结束仅改变呈现且不再翻转或提交回合', async () => {
  const e = await ready(), director = createNarrativeDirector();
  const snap = () => ({...e.state.serialize(),visual:{room:e.state.room,
    player:{x:SCENES[e.state.room].spawn[0],y:SCENES[e.state.room].spawn[1]}}});
  for(const input of ['u','n','s','s','n','d']) {
    director.skip();
    const before=snap();
    await e.processInput(input);
    const after=snap(), committed=e.state.serialize(), motion=createCliffPassage(before,after);
    assert.ok(motion,`${before.room}.${input}`);
    for(const key of ['n','s']) {
      if(before.room==='top_of_arbor'&&input===key)assert.notEqual(after.flipped,before.flipped);
    }
    densePath(SCENES[before.room],motion.path,`${before.room}.${input}: ground motion`);
    const steps=Math.max(1,Math.ceil(motion.distance/.25));
    for(let i=0;i<=steps;i++) {
      const {actor}=sampleCliffPassage(motion,motion.walkDuration*i/steps);
      assert.equal(isBlocked(SCENES[before.room],actor.x,actor.y),false,
        `${before.room}.${input}: actor ${actor.x},${actor.y}`);
    }
    director.onCommand(before,after,input);
    assert.equal(director.getState().currentEvent,'cliff_passage');
    assert.equal(director.getState().sceneRoom,before.room);
    assert.equal(director.getState().hidePlayer,true);
    director.update(.12);
    const frozen=director.getState();
    for(let i=0;i<5;i++){director.update(0);assert.deepEqual(director.getState(),frozen);}
    assert.deepEqual(e.state.serialize(),committed);
    director.update(motion.duration);
    assert.equal(director.getState().currentEvent,null);
    director.skip();
    assert.deepEqual(e.state.serialize(),committed);
  }
  assert.equal(e.state.room,'trellises');
  assert.equal(e.state.flipped,false);
});
