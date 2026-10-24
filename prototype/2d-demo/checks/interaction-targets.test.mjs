import test from 'node:test';
import assert from 'node:assert/strict';
import { nearbyTarget, pointerTarget, withinReach } from '../interaction-targets.js';
import { createPrologueSession } from '../engine-adapter.js';
import { getHotspots } from '../interaction-catalog.js';

const prop = (id, x, y, extra = {}) => ({ id, x, y, kind: 'ball', radius: 37,
  actions: [{ command: 'examine ball' }], ...extra });

test('F faces the intended object instead of selecting a closer object behind the player', () => {
  const front = prop('front', 100, 73), back = prop('back', 100, 112);
  const player = { x: 100, y: 100, face: 'up' };
  assert.equal(nearbyTarget([back, front], player), front);
  assert.equal(nearbyTarget([front], { ...player, face: 'down' }), undefined);
  assert.equal(nearbyTarget([prop('at-feet', 100, 103)], player)?.id, 'at-feet');
});

test('invisible placeholders and director-only actors never become keyboard or pointer targets', () => {
  const objects = [prop('invisible', 100, 90, { visual: false }),
    prop('decoration', 100, 90, { visualOnly: true }), prop('no-command', 100, 90, { actions: [] })];
  assert.equal(nearbyTarget(objects, { x: 100, y: 110, face: 'up' }), undefined);
  assert.equal(pointerTarget(objects, { x: 100, y: 85 }), undefined);
});

test('the actual palace self placeholder cannot hijack F', () => {
  const state = createPrologueSession().state;
  const objects = getHotspots(state).map(object => object.id === 'palace_gate:self' ? { ...object, visual: false } : object);
  assert.equal(nearbyTarget(objects, { x: 183, y: 244, face: 'up' }), undefined);
});

test('small item pointer boundaries follow the sprite, while touch gets limited extra tolerance', () => {
  const ball = prop('item:ball', 307, 139, { itemId: 'ball' });
  assert.equal(pointerTarget([ball], { x: 307, y: 134 }), ball);
  assert.equal(pointerTarget([ball], { x: 324, y: 139 }), undefined, 'bare ground must not inspect the nearby ball');
  assert.equal(pointerTarget([ball], { x: 319, y: 134 }), undefined);
  assert.equal(pointerTarget([ball], { x: 319, y: 134 }, { padding: 8 }), ball);
});

test('clicking a visible dish or headphones takes precedence over the overlapping boy body', () => {
  const boy = prop('boy', 300, 145, { kind: 'boy' });
  const dish = prop('dish', 293.5, 143.5, { kind: 'dish' });
  const phones = prop('headphones', 300, 132, { kind: 'headphones' });
  assert.equal(pointerTarget([boy, dish, phones], { x: 293.5, y: 142 }), dish);
  assert.equal(pointerTarget([boy, dish, phones], { x: 300, y: 132 }), phones);
  assert.equal(pointerTarget([boy, dish, phones], { x: 305, y: 138 }), boy);
});

test('distant landmark observation and the custom dial/ring/pointer shapes retain their calibrated reach', () => {
  const memorial = prop('memorial', 338, 90, { kind: 'memorial', radius: 125,
    pointerShape: { kind: 'ellipse', x: 338, y: 55, rx: 22, ry: 45, priority: 1 } });
  assert.equal(nearbyTarget([memorial], { x: 270, y: 170, face: 'up' }), memorial);
  assert.equal(pointerTarget([memorial], { x: 338, y: 30 }), memorial);
  const dial = prop('dial', 245, 140, { pointerShape: { kind: 'ellipse', x: 245, y: 132, rx: 37, ry: 24, priority: 1 } });
  const ring = prop('ring', 285, 175, { pointerShape: { kind: 'annulus', x: 245, y: 132, rx: 56, ry: 37, innerRx: 37, innerRy: 24, priority: 2 } });
  const pointer = prop('pointer', 218, 173, { pointerShape: { kind: 'polygon', points: [[232,110],[263,141],[232,138]], priority: 3 } });
  assert.equal(pointerTarget([dial, ring, pointer], { x: 245, y: 127 }), pointer);
  assert.equal(pointerTarget([dial, ring, pointer], { x: 295, y: 132 }), ring);
  assert.equal(pointerTarget([dial, ring, pointer], { x: 220, y: 132 }), dial);
});

test('explicit clicks and automatic arrival share the final distance boundary', () => {
  const ball = prop('ball', 100, 100);
  assert.equal(withinReach({ x: 137, y: 100 }, ball), false);
  assert.equal(withinReach({ x: 136.9, y: 100 }, ball), true);
  assert.equal(withinReach({ x: 136.9, y: 100 }, ball, 1), false);
  assert.equal(withinReach({ x: 135, y: 100 }, ball, 1), true);
  assert.equal(ball.radius, 37);
});

test('the open tree umbrella uses its canopy and handle shape rather than the folded umbrella silhouette', async () => {
  const engine = createPrologueSession(); engine.moveTo(engine.state.room);
  for (const command of ['n', 'ne', 'e', 'wait']) await engine.processInput(command);
  const umbrella = getHotspots(engine.state).find(object => object.id === 'lancaster_gate:umbrella-tree');
  assert.ok(umbrella);
  // Confirmed opaque pixels in the open umbrella art, including the handle.
  for (const point of [{ x: 338, y: 114 }, { x: 315, y: 114 }, { x: 325, y: 127 }])
    assert.equal(pointerTarget([umbrella], point), umbrella);
  assert.equal(pointerTarget([umbrella], { x: 350, y: 118 }), undefined);
});
