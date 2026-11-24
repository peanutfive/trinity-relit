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

test('浅坑两侧鞍口保留原走法，已制作的沙路延伸可通行', () => {
  for (const [room, dir, target] of [['desert_5', 'w', 'desert_4'], ['desert_6', 'e', 'desert_7']]) {
    const scene = SCENES[room];
    const state = new GameState();
    state.room = room;
    state.chapter = 'desert';
    const exit = scene.exits.find(exit => exit.dir === dir);
    assert.equal(exit?.target, target);
    assert.equal(sceneBoundaries(room, state).some(boundary => boundary.dir === dir), false);
    assert.ok(findPath(scene, scene.spawn, exit).length, room);
  }
  const crater = SCENES.shallow_crater;
  assert.equal(isSegmentWalkable(crater, [30, 145], [16, 145]), true);
  assert.equal(isSegmentWalkable(crater, [444, 129], [458, 129]), true);
});
