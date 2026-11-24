import test from 'node:test';
import assert from 'node:assert/strict';
import { SCENES, sceneBoundaries } from '../scene-manifest.js';
import { roomArrival } from '../arrivals.js';
import { findPath, isBlocked } from '../world.js';
import { GameState } from '../../js/engine.js';

test('山麓弯道按真实来向从侧路落地，不能按罗盘取反方向', () => {
  for (const [foothill, sand] of [['foothills_2', 'desert_4'], ['foothills_3', 'desert_7']]) {
    for (const [fromRoom, direction, target, entrance] of [
      [foothill, 'e', sand, 's'], [sand, 's', foothill, 'e'],
    ]) {
      const origin = SCENES[fromRoom], destination = SCENES[target];
      const road = origin.exits.find(exit => exit.dir === direction);
      assert.equal(road?.target, target);
      const arrival = roomArrival(destination, { fromRoom, direction, exits: destination.exits });
      assert.equal(arrival?.entrance, entrance);
      assert.equal(arrival.matched, true);
      assert.equal(isBlocked(destination, arrival.x, arrival.y), false);
      assert.ok(findPath(destination, arrival, destination.spawn).length);
    }
  }
});

test('山麓三个西口沿原有路面接入对应铺装路', () => {
  for (const [room, expected] of [
    ['foothills_1', 'paved_road_2'], ['foothills_2', 'paved_road_4'], ['foothills_3', 'paved_road_5'],
  ]) {
    const scene = SCENES[room];
    const state = new GameState();
    state.room = room;
    state.chapter = 'desert';
    const exit = scene.exits.find(exit => exit.dir === 'w');
    assert.equal(exit?.target, expected);
    assert.equal(sceneBoundaries(room, state).some(boundary => boundary.dir === 'w'), false);
    assert.ok(findPath(scene, scene.spawn, exit).length);
  }
});
