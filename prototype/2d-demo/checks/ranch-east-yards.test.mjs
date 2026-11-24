import test from 'node:test';
import assert from 'node:assert/strict';
import { GameState } from '../../js/engine.js';
import { ROOMS } from '../ranch-story.js';
import { getRanchHotspots } from '../ranch-actions.js';
import { SCENES, sceneBoundaries, sceneExits } from '../scene-manifest.js';
import { roomArrival } from '../arrivals.js';
import { findPath, isBlocked, isSegmentWalkable } from '../world.js';

function ranchState(room) {
  const state = new GameState();
  state.room = room;
  state.chapter = 'ranch';
  return state;
}

test('前廊两端和东南铁门都是双向步行路口，通过后落在正确的一侧', () => {
  for (const [first, firstDir, second, secondDir] of [
    ['front_deck','n','ne_yard','s'],
    ['front_deck','s','se_yard','n'],
    ['se_yard','se','se_ranch','nw'],
  ]) {
    for (const [from, dir, to, reverse] of [
      [first,firstDir,second,secondDir], [second,secondDir,first,firstDir],
    ]) {
      const scene = SCENES[from], next = SCENES[to];
      const exits = sceneExits(from, ranchState(from), ROOMS).filter(exit => exit.target === to);
      assert.equal(exits.length, 1, from + ' 同一通路只显示一次');
      const [exit] = exits;
      assert.equal(exit.dir, dir);
      assert.equal(exit.interactionOnly, false);
      assert.ok(findPath(scene, scene.spawn, exit).length);
      const returns = sceneExits(to, ranchState(to), ROOMS);
      const arrival = roomArrival(next, {fromRoom:from, direction:dir, exits:returns});
      assert.ok(arrival?.matched);
      assert.equal(arrival.entrance, reverse);
      assert.ok(returns.every(route => Math.hypot(arrival.x-route.x,arrival.y-route.y)>route.radius));
      assert.ok(findPath(next, arrival, next.spawn).length);
    }
  }
});

test('东北院外门初始闭合，开门状态可以存读，东南院西侧保留室外制作边界', () => {
  const id = 'ne_yard', flag = 'ne_yard_outside_door_open';
  const closed = ranchState(id);
  for (const dir of ['w','in']) {
    const door = ROOMS[id].exits(closed)[dir];
    assert.equal(door.to,id);
    assert.equal(door.when(closed),false);
  }
  const actions = state => getRanchHotspots(state).filter(object => object.kind==='ranch_outside_door')
    .flatMap(object => object.actions.map(action => action.command));
  assert.deepEqual(actions(closed),['open outside door']);
  closed.setFlag(flag);
  const reopened = GameState.deserialize(closed.serialize());
  assert.deepEqual(actions(reopened),['close outside door']);
  for (const route of sceneExits(id,reopened,ROOMS)) assert.notEqual(route.target,'bedroom');
  const boundary = sceneBoundaries('se_yard',ranchState('se_yard'),ROOMS).filter(exit=>exit.dir==='w');
  assert.equal(boundary.length,1);
  assert.equal(boundary[0].target,'sw_yard');
  assert.ok(findPath(SCENES.se_yard,SCENES.se_yard.spawn,boundary[0]).length);
});

test('两幅庭院图上能穿过门洞、走上木台，到达墙边后在实墙前停下', () => {
  const shots = [
    ['ne_yard', [
      [[217,135],[195,173],[178,199],[172,222],[173,266]],
      [[217,135],[159,143],[125,153]],
    ], [[245,46],[425,133],[82,145]]],
    ['se_yard', [
      [[227,146],[205,102],[182,78],[181,61],[180,30]],
      [[227,146],[287,160],[338,178],[361,194],[374,201],[397,222]],
      [[227,146],[164,145],[113,142],[60,143],[22,144]],
    ], [[240,238],[399,120],[326,196]]],
  ];
  for (const [id,paths,barriers] of shots) {
    const scene = SCENES[id];
    for (const path of paths) {
      for (let i=1;i<path.length;i++) assert.ok(isSegmentWalkable(scene,path[i-1],path[i]),id+' '+path[i]);
    }
    for (const [x,y] of barriers) assert.ok(isBlocked(scene,x,y),id+' '+[x,y]);
  }
});
