import test from 'node:test';
import assert from 'node:assert/strict';
import { SCENES, sceneBoundaries } from '../scene-manifest.js';
import { roomArrival } from '../arrivals.js';
import { findPath, isBlocked, isSegmentWalkable } from '../world.js';
import { GameState } from '../../js/engine.js';

test('渡口及白门的来向落点可步行离开，且不创建反向道路', () => {
  const passages = [
    ['the_river', 'in', 'islet', 'ferry'],
    ['islet', 'enter door', 'shallow_crater', 'door'],
    ['sand_bar', 'enter door', 'shallow_crater', 'door'],
  ];
  for (const [fromRoom, direction, target, entrance] of passages) {
    const scene = SCENES[target];
    const arrival = roomArrival(scene, { fromRoom, direction, exits: scene.exits });
    assert.equal(arrival?.entrance, entrance);
    assert.equal(arrival.fromRoom, fromRoom);
    assert.equal(isBlocked(scene, arrival.x, arrival.y), false);
    assert.ok(findPath(scene, arrival, scene.spawn).length, `${fromRoom}→${target}`);
    assert.equal(scene.exits.some(exit => exit.target === fromRoom), false);
  }
});

test('沙漠边界有明确路面但不生成可通行出口，浅坑两侧鞍口能实走', () => {
  for (const [room, dir, target] of [['desert_5', 'w', 'desert_4'], ['desert_6', 'e', 'desert_7']]) {
    const scene = SCENES[room];
    const state = new GameState();
    state.room = room;
    state.chapter = 'desert';
    const [boundary] = sceneBoundaries(room, state);
    assert.deepEqual({ dir: boundary?.dir, target: boundary?.target }, { dir, target });
    assert.equal(scene.exits.some(exit => exit.dir === dir), false);
    assert.ok(findPath(scene, scene.spawn, boundary).length, room);
  }
  const crater = SCENES.shallow_crater;
  assert.equal(isSegmentWalkable(crater, [30, 145], [16, 145]), true);
  assert.equal(isSegmentWalkable(crater, [444, 129], [458, 129]), true);
});
