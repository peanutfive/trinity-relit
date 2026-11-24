import test from 'node:test';
import assert from 'node:assert/strict';
import { ROOMS } from '../../js/data/desert.js';
import { GameState } from '../../js/engine.js';
import { SCENES, sceneBoundaries } from '../scene-manifest.js';
import { roomArrival } from '../arrivals.js';
import { isBlocked, findPath, approachingExit } from '../world.js';

const roads = Array.from({ length: 6 }, (_, i) => `paved_road_${i + 1}`);

test('铺装路及土路分岔可以落脚，岩壁、灌木与地平线外保持阻挡', () => {
  // Samples read from the 480 × 288 rendered art, independently of the navigation polygons.
  const samples = [
    { on: [[240,85],[236,208],[118,95],[385,200]], off: [[65,165],[355,100]] },
    { on: [[163,83],[166,199],[315,129]], off: [[38,145],[322,196]] },
    { on: [[251,88],[209,210]], off: [[90,175],[346,113]] },
    { on: [[221,84],[204,201],[361,137]], off: [[57,123],[411,218]] },
    { on: [[180,82],[232,205],[339,129]], off: [[73,148],[332,205]] },
    { on: [[235,85],[232,203]], off: [[61,130],[394,102]] },
  ];
  for (const [index, {on, off}] of samples.entries()) {
    const scene = SCENES[roads[index]];
    assert.ok(scene, roads[index]);
    for (const [x, y] of on) assert.equal(isBlocked(scene, x, y), false, `${roads[index]} 图中路面 ${x},${y}`);
    for (const [x, y] of [...off, [115,18]]) assert.equal(isBlocked(scene, x, y), true, `${roads[index]} 图外 ${x},${y}`);
  }
});

test('六段铺装路的每个路口都是当前可达的出口或制作边界', () => {
  for (const id of roads) {
    const scene = SCENES[id];
    assert.ok(scene, id);
    const state = new GameState();
    state.room = id;
    state.chapter = 'desert';
    const routes = [...scene.exits, ...sceneBoundaries(id, state)];
    assert.equal(routes.length, Object.keys(ROOMS[id].exits(state)).length);
    for (const [dir, target] of Object.entries(ROOMS[id].exits(state))) {
      const route = routes.find(candidate => candidate.dir === dir);
      assert.equal(route?.target, target, `${id}.${dir}`);
      assert.equal(scene.exits.includes(route), Boolean(SCENES[target]));
      assert.ok(findPath(scene, scene.spawn, route).length, `${id}.${dir} 到不了图中的路口`);
    }
  }
});

test('三条路肩支路双向通行，按真实来源落脚并清出路口感应带', () => {
  for (const [index, road] of [2, 4, 5].entries()) {
    const foothill = `foothills_${index + 1}`, id = `paved_road_${road}`;
    for (const [source, target, dir, entrance] of [
      [foothill, id, 'w', 'e'], [id, foothill, 'e', 'w'],
    ]) {
      assert.equal(SCENES[source].exits.find(exit => exit.dir === dir)?.target, target);
      const scene = SCENES[target], arrival = roomArrival(scene, { fromRoom: source, direction: dir, exits: scene.exits });
      assert.equal(arrival?.entrance, entrance);
      assert.equal(arrival.matched, true);
      assert.equal(isBlocked(scene, arrival.x, arrival.y), false);
      assert.ok(scene.exits.every(exit => Math.hypot(arrival.x - exit.x, arrival.y - exit.y) > exit.radius));
      assert.ok(findPath(scene, arrival, scene.spawn).length);
    }
  }
});

test('沿东支路最后一段向右或斜向右上走都能跨房', () => {
  for (const id of ['paved_road_2', 'paved_road_5']) {
    const exit = SCENES[id].exits.find(route => route.dir === 'e');
    for (const dy of [0, -1]) {
      const start = { x: exit.x - 10, y: exit.y + 6 };
      assert.ok(approachingExit(exit, start, { x: start.x + 1, y: start.y + dy }), id);
    }
  }
});
