import assert from 'node:assert/strict';
import test from 'node:test';
import { GameState } from '../../js/engine.js';
import { roomArrival } from '../arrivals.js';
import { buildChapterMap } from '../chapter-map.js';
import { createPrologueSession } from '../engine-adapter.js';
import { resolveInteraction } from '../interaction-intent.js';
import { pointerTarget } from '../interaction-targets.js';
import { createNavigationSceneCache } from '../navigation-scene.js';
import { getRanchHotspots, ranchDoors } from '../ranch-actions.js';
import { ROOMS } from '../ranch-story.js';
import { SCENES, sceneBoundaries, sceneExits } from '../scene-manifest.js';
import { findPath, isBlocked, isSegmentWalkable } from '../world.js';

const yardDoor = 'ne_yard_outside_door_open';
const southGate = 'sw_yard_iron_gate_open';
const northGate = 'back_yard_iron_gate_open';
const screenDoor = 'back_yard_screen_door_open';
const hallDoor = 'hallway_outer_door_open';

function stateAt(room, open = []) {
  const state = new GameState();
  state.room = room;
  state.chapter = 'ranch';
  for (const flag of open) state.setFlag(flag);
  return state;
}

// Chapter fixtures isolate the door rules. The browser journey starts at the
// normal game entrance and exercises physical passage, F and save restoration.
async function houseSession(room) {
  const printed = [];
  const quiet = () => {};
  const engine = createPrologueSession({ui:{
    text: text => printed.push(text), system: quiet, location: quiet, inventory: quiet, userInput: quiet,
  }});
  await engine.activateChapter('ranch');
  engine.state.chapter = 'ranch';
  engine.moveTo(room);
  async function enter(command, expected) {
    printed.length = 0;
    const before = engine.state.turns;
    await engine.processInput(command);
    assert.equal(engine.state.room, expected, command);
    assert.equal(engine.state.turns, before + 1, command);
    return printed.join('\n');
  }
  return {engine, enter};
}

test('内外共用一扇门，合门立即挡住两个方向别名，再开门后可原路返回', async () => {
  for (const [first, next, name, flag, out, back] of [
    ['ne_yard','bedroom','outside door',yardDoor,['w','in'],['e']],
    ['sw_yard','sw_ranch','iron gate',southGate,['sw','out'],['ne','in']],
    ['back_yard','nw_ranch','iron gate',northGate,['nw','out'],['se','in']],
    ['back_yard','spare_room','screen door',screenDoor,['e'],['w']],
  ]) {
    const {engine,enter} = await houseSession(first);
    for (const dir of out) assert.match(await enter(dir, first), /关着/);
    await enter('open ' + name, first);
    await enter(out[0], next);
    const saved = engine.serialize();
    await enter('close ' + name, next);
    for (const dir of back) assert.match(await enter(dir, next), /关着/);
    await engine.deserialize(saved);
    assert.ok(engine.state.hasFlag(flag));
    await enter(back[0], first);
    await enter('close ' + name, first);
    assert.equal(engine.state.hasFlag(flag), false);
  }
});

test('两扇铁门、后院纱门和通廊外门可分别操作', async () => {
  const {engine,enter} = await houseSession('sw_yard');
  await enter('open iron gate', 'sw_yard');
  await enter('in', 'hallway');
  await enter('open outer door', 'hallway');
  await enter('n', 'back_yard');
  assert.match(await enter('nw','back_yard'), /关着/);
  assert.match(await enter('e','back_yard'), /关着/);
  await enter('open screen door','back_yard');
  assert.match(await enter('out','back_yard'), /关着/);
  await enter('open iron gate','back_yard');
  await enter('nw','nw_ranch');
  await enter('close iron gate','nw_ranch');
  assert.ok(engine.state.hasFlag(southGate));
  assert.ok(engine.state.hasFlag(hallDoor));
  assert.ok(engine.state.hasFlag(screenDoor));
  await enter('s','sw_ranch');
  await enter('ne','sw_yard');
});

test('地板旧痕与墙上挂图可以主动查看，挂图保持固定', async () => {
  const {engine,enter} = await houseSession('bedroom');
  const possessions = engine.state.inventoryList();
  const floor = getRanchHotspots(engine.state).find(item=>item.kind==='ranch_floor_mark');
  assert.ok(floor?.baked);
  assert.match(await enter(floor.actions[0].command, 'bedroom'), /床垫/);
  await enter('w','spare_room');
  const map = getRanchHotspots(engine.state).find(item=>item.kind==='ranch_wall_map');
  assert.ok(map?.baked);
  assert.match(await enter('examine map','spare_room'), /地图/);
  assert.match(await enter('take map','spare_room'), /墙/);
  assert.deepEqual(engine.state.inventoryList(), possessions);
  assert.equal(getRanchHotspots(engine.state).filter(item=>item.id===map.id).length, 1);
  await enter('e','bedroom');
});

test('新路口从对应来向入场，玩家可从落脚点走进房间，也可原路折返', () => {
  const links = [
    ['ne_yard','w','bedroom','e',yardDoor],
    ['bedroom','w','spare_room','e'],
    ['spare_room','w','back_yard','e',screenDoor],
    ['back_yard','nw','nw_ranch','se',northGate],
    ['back_yard','s','hallway','n'],
    ['hallway','s','sw_yard','n'],
    ['sw_yard','sw','sw_ranch','ne',southGate],
  ];
  for (const [left,forward,right,reverse,flag] of links) {
    const open = flag ? [flag] : [];
    for (const [from,dir,to,back] of [[left,forward,right,reverse],[right,reverse,left,forward]]) {
      const scene = SCENES[from];
      const target = SCENES[to];
      const exits = sceneExits(from,stateAt(from,open),ROOMS).filter(route=>route.target===to);
      assert.deepEqual(exits.map(exit=>exit.dir), [dir], from+'→'+to);
      assert.ok(findPath(scene,scene.spawn,exits[0]).length, from+' 的门口要有路');
      const returns = sceneExits(to,stateAt(to,open),ROOMS);
      const entry = roomArrival(target,{fromRoom:from,direction:dir,exits:returns});
      assert.equal(entry?.entrance,back,to);
      assert.ok(entry.matched,to+' 来向错误');
      assert.ok(returns.every(exit=>Math.hypot(entry.x-exit.x,entry.y-exit.y)>exit.radius),to+' 落脚不能触发返程');
      assert.ok(findPath(target,entry,target.spawn).length,to+' 落脚点要连通');
    }
  }
});

test('未制作的相邻房间只标到边界，已关上的通廊外门遮住对应提示', () => {
  function boundaries(room, flags=[]) {
    const state = stateAt(room,flags);
    return sceneBoundaries(room,state,ROOMS).map(route=>route.dir).sort();
  }
  assert.deepEqual(boundaries('spare_room'), ['n','s']);
  assert.deepEqual(boundaries('hallway'), ['w']);
  assert.deepEqual(boundaries('hallway',[hallDoor]), ['e','w']);
  for (const room of ['back_yard','spare_room','hallway','bedroom','sw_yard']) {
    const signs = sceneExits(room,stateAt(room),ROOMS);
    assert.ok(signs.every(sign=>sign.target!==room), room+' 的实墙不能挂上指回本地的路牌');
  }
});

test('地图只记住穿过的门，合门后保留闭门标记且存读后不丢失', () => {
  for (const [a,forward,b,reverse,flag] of [
    ['ne_yard','w','bedroom','e',yardDoor],
    ['sw_yard','sw','sw_ranch','ne',southGate],
    ['back_yard','nw','nw_ranch','se',northGate],
    ['back_yard','e','spare_room','w',screenDoor],
  ]) {
    let state = stateAt(a);
    state.visited.add(b);
    function check(expected) {
      const before = state.serialize();
      const model = buildChapterMap({state,rooms:ROOMS,scenes:SCENES,chapter:'ranch'});
      assert.deepEqual(state.serialize(),before,'查看地图不能改变进度');
      for (const [from,dir,to] of [[a,forward,b],[b,reverse,a]]) {
        const stamp = model.edges.find(edge=>edge.from===from && edge.to===to && edge.direction===dir);
        const place = model.nodes.find(node=>node.id===from);
        assert.ok(place,'来过的房间应保留');
        const exit = place.exits.find(edge=>edge.direction===dir && edge.to===to);
        for (const found of [stamp,exit]) {
          if (expected==='unknown') assert.equal(found,undefined,from+' 尚未穿过这扇门');
          else {
            assert.ok(found,from+' 地图丢失了通路');
            assert.equal(Boolean(found.closed),expected==='closed');
          }
        }
      }
    }
    check('unknown'); // Both sides were reached by different paths.
    state.setFlag(flag);
    check('open');
    state.clearFlag(flag); // Opening a door alone does not discover the route.
    check('unknown');

    // The browser test covers setting this flag on an actual crossing. Verify
    // the persisted map contract for every pair, including the two iron gates.
    state.setFlag(flag+'_crossed');
    check('closed');
    state = GameState.deserialize(state.serialize());
    check('closed');
    const blocked = ROOMS[a].exits(state)[forward];
    assert.equal(blocked.rememberedTo,b);
    assert.equal(blocked.when(state),false);
    assert.equal(blocked.to,a);
    assert.ok(!sceneExits(a,state,ROOMS).some(route=>route.target===b));
    state.setFlag(flag);
    check('open');
  }
});

test('门槛、走廊和脚下土路与五幅原画的实际位置吻合', () => {
  // These are foot positions sampled from the final 480 × 288 backgrounds,
  // independent of the navigation polygons and authored room transitions.
  const samples = [
    ['bedroom', [
      [[39,157],[110,157],[236,160],[340,160],[434,155]],
      [[236,160],[176,130],[135,106]],
    ], [[224,32],[14,187],[457,106]]],
    ['sw_yard', [
      [[201,51],[201,95],[220,123],[290,111],[400,99],[461,92]],
      [[220,123],[170,147],[136,174],[100,209]],
    ], [[251,24],[231,229],[47,220]]],
    ['hallway', [
      [[234,271],[232,195],[238,128],[237,67],[237,18]],
      [[224,158],[170,165],[129,174],[99,180]],
    ], [[69,181],[130,108],[344,123]]],
    ['back_yard', [
      [[237,270],[235,198],[238,130],[169,90],[117,70],[90,60]],
      [[238,130],[305,138],[366,147],[405,158]],
    ], [[244,14],[25,118],[454,166]]],
    ['spare_room', [
      [[228,43],[227,111],[230,149],[230,206],[230,271]],
      [[53,165],[124,155],[230,149],[339,150],[420,144]],
    ], [[121,33],[29,184],[448,100]]],
  ];
  for (const [room,paths,walls] of samples) {
    const scene = SCENES[room];
    for (const path of paths) {
      for (let index=1;index<path.length;index++) {
        assert.ok(isSegmentWalkable(scene,path[index-1],path[index]),room+' 地面 '+path[index]);
      }
    }
    for (const [x,y] of walls) assert.ok(isBlocked(scene,x,y),room+' 墙面 '+[x,y]);
  }
});

test('点击已推开的门扇关门，点击空出的门洞穿行，两处脚点都能到达', async () => {
  // Samples lie on the visible open leaves and clear openings in the final
  // art. They do not come from the clickable polygons being tested.
  const samples = [
    ['ne_yard',yardDoor,[100,143],[89,144],'bedroom'],
    ['bedroom',yardDoor,[440,137],[431,134],'ne_yard'],
    ['sw_yard',southGate,[86,172],[103,195],'sw_ranch'],
    ['sw_ranch',southGate,[234,81],[244,101],'sw_yard'],
    ['back_yard',northGate,[121,50],[88,49],'nw_ranch'],
    ['nw_ranch',northGate,[253,136],[231,127],'back_yard'],
    ['back_yard',screenDoor,[395,141],[409,143],'spare_room'],
    ['spare_room',screenDoor,[63,149],[49,154],'back_yard'],
    ['hallway',hallDoor,[307,153],[319,153],null],
  ];
  const navigation = createNavigationSceneCache();
  for (const [room,flag,leafPoint,holePoint,target] of samples) {
    const {engine,enter} = await houseSession(room);
    const scene = SCENES[room], doors = ranchDoors(scene);
    const door = doors.find(candidate=>candidate.flag===flag);
    const openingId = door.id+':opening';
    assert.ok(!getRanchHotspots(engine.state).some(object=>object.id===openingId));
    const open = 'open '+door.noun;
    await enter(open,room);
    const objects = getRanchHotspots(engine.state);
    const bodies = doors.flatMap(candidate=>engine.state.hasFlag(candidate.flag)
      ? candidate.openObstacles||[] : candidate.closedObstacles||[]);
    const walkable = navigation(scene,bodies);
    function pick([x,y],expectedId) {
      for (const padding of [0,8]) {
        assert.equal(pointerTarget(objects,{x,y},{padding})?.id,expectedId,room+' 图上 '+[x,y]);
      }
      const object = objects.find(item=>item.id===expectedId);
      assert.ok(findPath(walkable,scene.spawn,object).length,room+' 无法走到 '+expectedId);
      return resolveInteraction(engine.state,object);
    }
    const close = pick(leafPoint,door.id);
    assert.equal(close,'close '+door.noun);
    const passage = target ? pick(holePoint,openingId) : null;
    if (!target) {
      assert.ok(!objects.some(object=>object.id===openingId),'厨房尚无可穿过的门洞');
      assert.notEqual(pointerTarget(objects,{x:holePoint[0],y:holePoint[1]})?.kind,'passage');
    }
    await enter(close,room);
    assert.equal(engine.state.hasFlag(flag),false);
    if (passage) {
      await enter(open,room);
      await enter(passage,target);
    }
  }
});
