import test from 'node:test';
import assert from 'node:assert/strict';
import {createPrologueSession} from '../engine-adapter.js';
import {getHotspots} from '../interaction-catalog.js';
import {keyboardInteraction, chapterObjective} from '../interaction-context.js';
import {resolveHeldSelf} from '../interaction-intent.js';

// Fixtures reach their chapters through commands, rather than modifying flags
// or item locations to make a visual interaction appear legal.
const PROLOGUE = [
  'e', 'take ball', 'nw', 'unscrew gnomon', 'take gnomon',
  'n', 'take paper bird', 'open paper bird', 'w', 'buy crumbs', 'feed birds',
  'take ruby', 'n', 'push pram', 'push pram', 'wait', 'throw ball at tree',
  'take umbrella', 'push pram', 'open pram', 'enter pram', 'open umbrella',
  'take paper bird', 'take gnomon', 'enter water',
];
const snapshot = engine => JSON.parse(JSON.stringify(engine.state.serialize()));
async function run(engine, commands) {
  for (const command of commands) {
    await engine.processInput(command);
    assert.equal(engine.state.dead, false, command);
  }
}
async function wading() {
  const engine = createPrologueSession();
  engine.moveTo(engine.state.room);
  await run(engine, PROLOGUE);
  assert.equal(engine.state.room, 'wading');
  return engine;
}
async function stairs() {
  const engine = await wading();
  await run(engine, ['enter door', 'n', 'ne', 'take splinter', 'e']);
  assert.equal(engine.state.room, 'bottom_of_stairs');
  return engine;
}
const target = (engine, kind) => {
  const result = getHotspots(engine.state).find(object => object.kind === kind);
  assert.ok(result, `${engine.state.room}: ${kind}`);
  return result;
};
function decide(engine, object, options) {
  const before = snapshot(engine);
  const result = keyboardInteraction(engine.state, object, options);
  assert.deepEqual(snapshot(engine), before, '查询F动作或提示不可提交回合、移动物品或改标记');
  return result;
}

test('携带指针的涉水白门仍先F观察、再F通行，提示与执行使用同一决定', async () => {
  const engine = await wading(), door = target(engine, 'door');
  assert.ok(engine.state.has('gnomon'));
  const observed = new Set();
  let decision = decide(engine, door, {heldItem: 'gnomon', observed});
  assert.equal(decision.type, 'target');
  assert.equal(decision.target, door);
  assert.equal(decision.hint, '观察');
  assert.equal(decision.command, 'examine door');
  await run(engine, [decision.command]);
  assert.equal(engine.state.room, 'wading');
  observed.add(door.id);
  decision = decide(engine, door, {heldItem: 'gnomon', observed});
  assert.equal(decision.hint, '通行');
  assert.equal(decision.command, 'enter door');
  await run(engine, [decision.command]);
  assert.equal(engine.state.room, 'meadow');
  assert.equal(engine.state.chapter, 'wabe');
  assert.ok(engine.state.has('gnomon'));
});

test('手持木片不会阻断Wabe上下石阶，F提示均为通行', async () => {
  const engine = await stairs();
  assert.ok(engine.state.has('splinter'));
  let decision = decide(engine, target(engine, 'stairs'), {heldItem: 'splinter'});
  assert.equal(decision.hint, '通行');
  assert.equal(decision.command, 'u');
  await run(engine, [decision.command]);
  assert.equal(engine.state.room, 'vertex');
  decision = decide(engine, target(engine, 'stairs'), {heldItem: 'splinter'});
  assert.equal(decision.hint, '通行');
  assert.equal(decision.command, 'd');
  await run(engine, [decision.command]);
  assert.equal(engine.state.room, 'bottom_of_stairs');
  assert.ok(engine.state.has('splinter'));
});

test('不匹配的持物组合不伪造命令或自动拾物，空处F也不新增观察', async () => {
  const engine = createPrologueSession();
  engine.moveTo(engine.state.room);
  await run(engine, ['e']);
  const ball = getHotspots(engine.state).find(object => object.itemId === 'ball');
  assert.ok(ball);
  assert.ok(engine.state.has('watch'));
  const decision = decide(engine, ball, {heldItem: 'watch'});
  assert.equal(decision.type, 'target');
  assert.equal(decision.command, null);
  assert.ok(!engine.state.has('ball'));
  assert.equal(decide(engine, null, {heldItem: 'watch'}), null);
});

test('地下未点亮灯笼的F使用与点亮后观察均只读，持灯白门仍显示通行', async () => {
  const engine = await stairs();
  await run(engine, ['u']);
  for (let count = 0; engine.state.sundialSymbol !== 2 && count < 7; count++)
    await run(engine, ['turn ring']);
  await run(engine, ['d', 'ne', 'e', 'nw', 'e', 's', 'n', 'in', 'in', 'e', 'e', 'take lantern']);
  assert.equal(engine.state.room, 'underground_3');
  assert.ok(engine.state.has('lantern'));
  const cylinder = target(engine, 'ug_cylinder');
  for (const object of [null, cylinder]) {
    const decision = decide(engine, object, {heldItem: 'lantern'});
    assert.equal(decision.type, 'self');
    assert.equal(decision.hint, '使用手中物品');
    assert.equal(resolveHeldSelf('lantern', engine.state), 'turn lantern');
  }
  await run(engine, [resolveHeldSelf('lantern', engine.state)]);
  assert.ok(engine.state.hasFlag('lantern_on'));
  assert.equal(decide(engine, null, {heldItem: 'lantern'}), null);
  assert.equal(decide(engine, cylinder, {heldItem: 'lantern'}).command, null);
  assert.equal(decide(engine, cylinder).hint, '观察');
  await run(engine, ['w', 'w']);
  const door = target(engine, 'passage');
  const decision = decide(engine, door, {heldItem: 'lantern'});
  assert.equal(decision.type, 'target');
  assert.equal(decision.hint, '通行');
  assert.equal(decision.command, 'w');
});

test('轨道持斧F使用泡膜、指向白门F通行；查询不破泡、不改变章节', async () => {
  const engine = await stairs();
  await run(engine, ['s', 'u', 'take axe', 'd', 'n', 'u']);
  for (let count = 0; engine.state.sundialSymbol !== 3 && count < 7; count++)
    await run(engine, ['turn ring']);
  await run(engine, ['d', 'ne', 'e', 'nw', 'e', 'take soap bubble', 'w', 'se', 'sw', 'w', 'w', 'w', 'in']);
  assert.equal(engine.state.room, 'orbit_satellite');
  assert.ok(engine.state.has('axe'));
  assert.ok(engine.state.has('soap_bubble'));
  for (const object of [null, target(engine, 'orbit_hull')]) {
    const decision = decide(engine, object, {heldItem: 'axe'});
    assert.equal(decision.type, 'self');
    assert.equal(decision.hint, '使用手中物品');
    assert.equal(resolveHeldSelf('axe', engine.state), 'break bubble with axe');
  }
  const doorDecision = decide(engine, target(engine, 'passage'), {heldItem: 'axe'});
  assert.equal(doorDecision.type, 'target');
  assert.equal(doorDecision.command, 'out');
  assert.equal(doorDecision.hint, '通行');
  assert.equal(engine.state.chapter, 'orbit');
  assert.ok(engine.state.has('soap_bubble'));
  await run(engine, [resolveHeldSelf('axe', engine.state)]);
  assert.equal(engine.state.room, 'waterfall');
  assert.equal(engine.state.itemAt('soap_bubble'), 'destroyed');
});

test('游乐场孩子的等待动作在空手和持伞时均显示等候，查询不提交回合', async () => {
  const engine = await stairs();
  await run(engine, ['u']);
  for (let count = 0; engine.state.sundialSymbol !== 1 && count < 7; count++)
    await run(engine, ['turn ring']);
  await run(engine, ['d', 'e', 'e', 'in']);
  assert.equal(engine.state.room, 'playground');
  assert.ok(engine.state.has('umbrella'));
  const children = target(engine, 'japan_children');
  for (const heldItem of [null, 'umbrella']) {
    for (const observed of [new Set(), new Set([children.id])]) {
      const decision = decide(engine, children, {heldItem, observed});
      assert.equal(decision.type, 'target');
      assert.equal(decision.command, 'wait');
      assert.equal(decision.hint, '等候');
    }
  }
});

test('地下和轨道探索目标按章提供环境观察，不残留林间指路或谜题答案', () => {
  const underground = chapterObjective('underground'), orbit = chapterObjective('orbit');
  assert.notEqual(underground, chapterObjective('wabe'));
  assert.notEqual(orbit, chapterObjective('wabe'));
  assert.match(underground, /通道|光线/);
  assert.match(orbit, /泡膜|卫星/);
  for (const text of [underground, orbit])
    assert.doesNotMatch(text, /林间小路|斧头|击破|打破|留下灯笼|转动符号环|需要|必须/);
});
