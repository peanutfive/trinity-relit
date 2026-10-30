import test from 'node:test';
import assert from 'node:assert/strict';
import {createOrbitPassage, sampleOrbitPassage} from '../orbit-motion.js';
import {ARBOR_ORBIT_REGIONS, renderArborOrbitSprite, renderOrbitPlayer} from '../arbor-orbit-art.js';

const snapshot = (room, x = 220, y = 180) => ({room, chapter: room === 'waterfall' ? 'wabe' : 'orbit',
  turns: 45, flags: ['flipped'], itemLoc: {axe: 'inventory', soap_bubble: 'inventory'},
  visual: {room, player: {x, y, face: 'left'}}});
function freeze(value) {
  Object.freeze(value); Object.values(value).forEach(v => {if (v && typeof v === 'object') freeze(v);}); return value;
}
test('轨道浮行只接受已提交的两房变化或卫星返程，不制造地面通道', () => {
  assert.equal(createOrbitPassage(snapshot('waterfall'), snapshot('orbit_satellite'), 'in'), null);
  assert.equal(createOrbitPassage(snapshot('orbit_space'), snapshot('waterfall'), 'out'), null);
  assert.equal(createOrbitPassage(snapshot('orbit_space'), snapshot('orbit_space'), 'look'), null);
  assert.equal(createOrbitPassage(snapshot('trellises'), snapshot('top_of_arbor'), 'u'), null);
  const before = freeze(snapshot('orbit_satellite', 462, 144)), after = freeze(snapshot('orbit_space'));
  const motion = createOrbitPassage(before, after, 'east');
  assert.equal(motion.type, 'orbit_drift'); assert.deepEqual(motion.from, {x: 462, y: 144});
  assert.ok(motion.to.x > 480); assert.equal(motion.to.y, 144);
  assert.ok(motion.duration >= .7 && motion.duration <= 1.4);
  for (const command of ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw', 'u', 'd', 'in', 'out']) {
    const m = createOrbitPassage(before, after, command), end = sampleOrbitPassage(m, m.duration);
    assert.equal(end.actor.kind, 'orbit_rider'); assert.equal(end.actor.visualOptions.burst, 0);
    assert.equal(end.actor.visualOptions.fade, 1); assert.equal(end.fade, 1);
    assert.ok(Number.isFinite(end.actor.x) && Number.isFinite(end.actor.y));
  }
});
test('动作暂停在同一时间得到相同画面；跳到结尾不修改房间、物品或翻转状态', () => {
  const before = freeze(snapshot('orbit_space', 208, 162)), after = freeze(snapshot('orbit_satellite'));
  const original = structuredClone({before, after}), motion = freeze(createOrbitPassage(before, after, 'northwest'));
  const frame = sampleOrbitPassage(motion, .35);
  for (let i = 0; i < 40; i++) assert.deepEqual(sampleOrbitPassage(motion, .35), frame);
  assert.deepEqual(sampleOrbitPassage(motion, -1), sampleOrbitPassage(motion, 0));
  const end = sampleOrbitPassage(motion, motion.duration);
  assert.deepEqual(sampleOrbitPassage(motion, motion.duration + 100), end);
  assert.deepEqual({before, after}, original);
  assert.ok(frame.actor.x < before.visual.player.x && frame.actor.y < before.visual.player.y);
});
test('卫星返程先破泡，再向白门浮去并淡出；渲染重采样不会再销毁泡或计回合', () => {
  const before = freeze(snapshot('orbit_satellite', 230, 190)), after = snapshot('waterfall');
  after.itemLoc.soap_bubble = null; freeze(after);
  const original = structuredClone({before, after}), motion = freeze(createOrbitPassage(before, after, 'break bubble with axe'));
  assert.equal(motion.type, 'orbit_return'); assert.deepEqual(motion.to, {x: 90, y: 155});
  const initial = sampleOrbitPassage(motion, 0), burst = sampleOrbitPassage(motion, .4);
  assert.equal(initial.actor.visualOptions.burst, 0); assert.equal(initial.actor.visualOptions.fade, 1);
  assert.ok(burst.actor.visualOptions.burst > .8); assert.ok(burst.actor.x < initial.actor.x);
  const final = sampleOrbitPassage(motion, motion.duration);
  assert.equal(final.actor.visualOptions.burst, 1); assert.equal(final.actor.visualOptions.fade, 0);
  assert.deepEqual([final.actor.x, final.actor.y], [90, 155]);
  assert.deepEqual({before, after}, original);
});
test('斧头与泡膜采样保留在原图内；漂浮主角没有接地影或距离步态', () => {
  for (const [key, [x, y, w, h]] of Object.entries(ARBOR_ORBIT_REGIONS)) {
    const [width, height] = key === 'axe' ? [1254, 1254] : [1983, 793];
    assert.ok(x >= 0 && y >= 0 && x + w <= width && y + h <= height);
  }
  const calls = [], context = new Proxy({globalAlpha: 1}, {get(target, key) {
    return key in target ? target[key] : (...args) => calls.push([key, ...args]);
  }});
  renderOrbitPlayer(context, {x: 220, y: 180, face: 'left'}, .5);
  assert.ok(!calls.some(([name]) => name === 'ellipse'), '空中角色不应投下脚底椭圆阴影');
  assert.ok(calls.filter(([name]) => name === 'translate').every(([, x, y]) => Number.isFinite(x) && Number.isFinite(y)));
  assert.equal(renderArborOrbitSprite(context, {kind: 'orbit_membrane'}, {}, 0), true);
  assert.equal(renderArborOrbitSprite(context, {kind: 'orbit_hull'}, {}, 0), true);
  assert.equal(renderArborOrbitSprite(context, {kind: 'arbor_waterfall'}, {}, 0), true);
  assert.equal(renderArborOrbitSprite(context, {kind: 'ordinary_prop'}, {}, 0), false);
});
