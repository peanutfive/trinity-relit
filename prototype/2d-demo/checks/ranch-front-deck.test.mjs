import test from 'node:test';
import assert from 'node:assert/strict';
import { GameState } from '../../js/engine.js';
import { ROOMS } from '../../js/data/ranch.js';
import { getRanchHotspots } from '../ranch-actions.js';
import { roomArrival } from '../arrivals.js';
import { SCENES, sceneExits } from '../scene-manifest.js';
import { approachingExit, findPath, isBlocked, isSegmentWalkable } from '../world.js';

function ranchState(room) {
  const state = new GameState();
  state.chapter = 'ranch';
  state.room = room;
  return state;
}

test('前院与前廊各有一个可按 F 的坡口，所有同义方向对应同一条缓坡', () => {
  const passages = [
    { from: 'front_yard', to: 'front_deck', canonical: 'w', aliases: ['w','u','in'] },
    { from: 'front_deck', to: 'front_yard', canonical: 'e', aliases: ['e','d'] },
  ];
  for (const {from, to, canonical, aliases} of passages) {
    const state = ranchState(from);
    const scene = SCENES[from];
    const routes = ROOMS[from].exits(state);
    for (const dir of aliases) assert.equal(routes[dir].to, to);
    const shown = sceneExits(from, state, ROOMS).filter(exit => exit.target === to);
    assert.equal(shown.length, 1, from);
    const exit = shown[0];
    assert.equal(exit.dir, canonical);
    assert.equal(exit.interactionOnly, true);
    assert.equal(approachingExit(exit, {x:exit.x + 1,y:exit.y}, exit), false);

    const objects = getRanchHotspots(state).filter(object =>
      object.actions.some(action => aliases.includes(action.command)));
    assert.equal(objects.length, 1, from + ' 坡道热点');
    assert.deepEqual(objects[0].actions.map(action => action.command), [canonical]);
    assert.deepEqual([objects[0].x,objects[0].y], [exit.x,exit.y]);
    assert.ok(findPath(scene, scene.spawn, exit).length);
  }
});

test('返程落在缓坡的场内一侧，回到场景后可以离开坡口', () => {
  for (const [from, to, dir, back] of [
    ['front_yard','front_deck','w','e'], ['front_deck','front_yard','e','w'],
  ]) {
    const scene = SCENES[to];
    const exits = sceneExits(to, ranchState(to), ROOMS);
    const entry = roomArrival(scene, {fromRoom:from, direction:dir, exits});
    assert.ok(entry?.matched, to);
    assert.equal(entry.entrance, back);
    assert.equal(isBlocked(scene, entry.x, entry.y), false);
    assert.ok(exits.every(exit => Math.hypot(entry.x - exit.x, entry.y - exit.y) > exit.radius));
    assert.ok(findPath(scene, entry, scene.spawn).length, to);
  }
});

test('前院缓坡穿过石墙缺口，前廊两端通向各自的院落', () => {
  const yard = SCENES.front_yard;
  const path = [[201,126],[178,122],[151,117],[128,112],[117,109]];
  for (let i = 1; i < path.length; i++) assert.ok(isSegmentWalkable(yard, path[i-1], path[i]));
  for (const [x,y] of [[151,90],[157,146]]) assert.equal(isBlocked(yard, x, y), true);
  const state = ranchState('front_deck');
  const routes = sceneExits('front_deck',state,ROOMS);
  for (const [dir, destination] of [['n','ne_yard'],['s','se_yard']]) {
    const route = routes.find(exit => exit.dir === dir);
    assert.equal(route?.target, destination);
    assert.ok(findPath(SCENES.front_deck, SCENES.front_deck.spawn, route).length);
  }
  assert.equal(ROOMS.front_deck.exits(state).out, undefined);
});

test('前廊成图能沿木板通往两端、坡道和两扇门前，脚底不能越过墙或坡边', () => {
  const scene = SCENES.front_deck;
  const paths = [
    [[172,129],[219,119],[243,120],[277,130],[309,134],[340,142],[369,147]],
    [[172,129],[171,78],[189,44],[195,17]],
    [[172,129],[163,198],[158,238],[153,273]],
    [[172,129],[110,100]],
    [[172,129],[85,207]],
  ];
  for (const path of paths) {
    for (let i = 1; i < path.length; i++) {
      assert.ok(isSegmentWalkable(scene, path[i-1], path[i]), '前廊路面 ' + path[i]);
    }
  }
  for (const [x,y] of [[90,83],[74,198],[290,92],[292,163],[345,79]]) {
    assert.equal(isBlocked(scene, x, y), true, '前廊障碍 ' + [x,y]);
  }
});
