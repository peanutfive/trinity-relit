import test from 'node:test';
import assert from 'node:assert/strict';
import { ROOMS } from '../ranch-story.js';
import { RANCH_PERIMETER_LAYOUT } from '../ranch-perimeter-layout.js';
import { RANCH_RESERVOIR_LAYOUT } from '../ranch-reservoir-layout.js';
import { roomArrival } from '../arrivals.js';
import { sceneBoundaries, sceneExits } from '../scene-manifest.js';
import { approachingExit, findPath, isBlocked, isSegmentWalkable } from '../world.js';

const rooms = {...RANCH_PERIMETER_LAYOUT, ...RANCH_RESERVOIR_LAYOUT};
const state = {hasFlag: () => false};
const links = [
  ['ne_ranch', 'e', 'north_reservoir', 'w'],
  ['front_yard', 'ne', 'north_reservoir', 'sw'],
  ['front_yard', 'se', 'south_reservoir', 'nw'],
  ['se_ranch', 'e', 'south_reservoir', 'w'],
  ['north_reservoir', 'se', 'under_windmill', 'nw'],
  ['south_reservoir', 'ne', 'under_windmill', 'sw'],
  ['south_reservoir', 'u', 'edge_reservoir', 'd'],
];

test('绕水库的七段道路按所在岸和真实来向可双向通行', () => {
  for (const [a, outbound, b, back] of links) {
    for (const [from, dir, to, entrance] of [[a, outbound, b, back], [b, back, a, outbound]]) {
      const scene = rooms[from], next = rooms[to], mark = from + ' ' + dir;
      const exit = sceneExits(from, state, ROOMS).find(route => route.dir === dir);
      assert.equal(exit?.target, to, mark);
      assert.deepEqual([exit.x, exit.y], scene.exitAnchors[dir], mark);
      assert.ok(findPath(scene, scene.spawn, exit).length, mark);
      const returns = sceneExits(to, state, ROOMS);
      const arrival = roomArrival(next, {fromRoom:from, direction:dir, exits:returns});
      assert.ok(arrival?.matched, mark);
      assert.equal(arrival.entrance, entrance, mark);
      assert.deepEqual([arrival.x,arrival.y], [next.sourceArrivals[from].x,next.sourceArrivals[from].y], mark);
      assert.equal(isBlocked(next, arrival.x, arrival.y), false, mark);
      assert.ok(findPath(next, arrival, next.spawn).length, mark);
      assert.ok(returns.every(route => Math.hypot(arrival.x-route.x, arrival.y-route.y) > route.radius), mark);
    }
  }
});

test('一段水泥阶只显示一个交互点，踏向阶梯不会自动进出，临水与登梯方向保留', () => {
  for (const [id, to, command, alias] of [
    ['south_reservoir', 'edge_reservoir', 'u', 'n'], ['edge_reservoir', 'south_reservoir', 'd', 's'],
  ]) {
    const room = rooms[id], original = ROOMS[id].exits(state);
    assert.equal(original[command], to);
    assert.equal(original[alias], to);
    const stairs = sceneExits(id, state, ROOMS).filter(exit => exit.target === to);
    assert.equal(stairs.length,1);
    assert.equal(stairs[0].dir,command);
    assert.equal(stairs[0].interactionOnly,true);
    assert.deepEqual(room.exitAnchors[command],room.exitAnchors[alias]);
    assert.equal(approachingExit(stairs[0], {x:stairs[0].x,y:stairs[0].y+1}, stairs[0]),false);
  }
  for (const broken of [false,true]) {
    const windmillState = {hasFlag:() => broken};
    const exits = sceneExits('under_windmill', windmillState, ROOMS);
    assert.deepEqual(exits.map(exit => exit.dir).sort(), broken ? ['nw','sw'] : ['nw','sw','u']);
    if(!broken)assert.equal(exits.find(exit=>exit.dir==='u').interactionOnly,true);
    const stops = sceneBoundaries('under_windmill', windmillState, ROOMS);
    assert.deepEqual(stops.map(stop => stop.dir), []);
  }
  assert.deepEqual(sceneExits('edge_reservoir',state,ROOMS).map(exit => exit.dir),['d','n']);
  assert.deepEqual(sceneBoundaries('edge_reservoir',state,ROOMS).map(stop => stop.dir),[]);
});

test('沿两岸真实路面转弯、绕过库壁和风车脚，临水干岸可达', () => {
  const samples = {
    north_reservoir: [
      [[211,102],[143,101],[76,92],[40,89],[16,89]],
      [[211,102],[150,102],[122,114],[100,139],[83,164],[67,189],[52,219],[38,249],[23,275]],
      [[211,102],[307,105],[347,110],[378,125],[400,151],[421,184],[439,221],[457,258],[464,275]],
    ],
    south_reservoir: [
      [[213,157],[145,167],[87,167],[43,168],[16,167]],
      [[213,157],[131,167],[106,146],[82,117],[65,90],[48,60],[29,20]],
      [[213,157],[278,153],[319,143],[359,125],[391,102],[416,75],[438,45],[455,18]],
      [[213,157],[235,151],[235,139],[235,132]],
    ],
    under_windmill: [
      [[223,151],[215,122],[199,102],[178,82],[150,67],[117,53],[83,40],[52,28],[36,18]],
      [[223,151],[211,183],[187,204],[156,223],[121,243],[94,260],[69,275]],
    ],
    edge_reservoir: [[[234,163],[234,190],[234,201],[234,205]]],
  };
  const blocked = {
    north_reservoir:[[245,174],[171,136]], south_reservoir:[[246,68],[185,101]],
    under_windmill:[[111,131],[246,157],[313,164]], edge_reservoir:[[237,110],[116,185]],
  };
  for (const [id, paths] of Object.entries(samples)) {
    const scene = rooms[id];
    for (const path of paths) {
      for (let i = 1; i < path.length; i++) {
        assert.ok(isSegmentWalkable(scene, path[i-1], path[i]), id + ' ' + path[i]);
      }
    }
    for (const point of blocked[id]) assert.equal(isBlocked(scene,...point), true, id + ' ' + point);
    for (const point of Object.values(scene.exitAnchors)) {
      assert.ok(findPath(scene,scene.spawn,point).length, id + ' ' + point);
    }
    const [x,y] = scene.looseAnchor;
    for (let i = 0; i < 8; i++) {
      assert.equal(isBlocked(scene, x+(i%3-1)*9, y+Math.floor(i/3)*7), false, id);
    }
  }
});
