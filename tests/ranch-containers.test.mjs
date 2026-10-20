import assert from 'node:assert/strict';
import test from 'node:test';
import { createGame, command } from './harness.mjs';

// 单章状态夹具只验证迁移实现；原版正常路径证据另见 pilots.json。
async function ranch(room = 'edge_reservoir', options = {}) {
  const game = createGame(options);
  game.state.setFlag('prologue_done');
  game.state.clearTimer();
  await game.eng.transitionChapter({ to: 'ranch', roomCandidates: [room] });
  return game;
}

async function restore(game) {
  const restored = createGame();
  await restored.eng.deserialize(JSON.parse(JSON.stringify(game.eng.serialize())));
  return restored;
}

async function cardBag(game) {
  game.state.take('bag');
  await command(game, 'empty bag');
  await command(game, 'take credit card');
  await command(game, 'put credit card in bag');
  assert.equal(game.state.itemAt('credit_card'), 'in:empty_bag');
}

test('普通入水：手持满袋替换湿袋，口袋满袋拒绝后仍按手持入水', async () => {
  const game = await ranch();
  game.state.take('bag');
  await command(game, 'put bag in pocket');
  assert.equal(game.state.itemAt('bag'), 'inventory');
  const turns = game.state.turns;
  await command(game, 'in');
  assert.equal(game.state.turns, turns + 1);
  assert.equal(game.state.room, 'reservoir');
  assert.equal(game.state.itemAt('bag'), 'destroyed');
  assert.equal(game.state.itemAt('soggy_bag'), 'inventory');
  assert.deepEqual(game.state.contents('soggy_bag'), []);
});

test('普通入水：空袋中的卡片不转入湿袋，读档后仍不可访问而非销毁卡片', async () => {
  let game = await ranch();
  await cardBag(game);
  game = await restore(game);
  await command(game, 'n');
  assert.equal(game.state.itemAt('empty_bag'), 'destroyed');
  assert.equal(game.state.itemAt('soggy_bag'), 'inventory');
  assert.equal(game.state.itemAt('credit_card'), 'in:empty_bag');
  assert.equal(game.eng.isVisible('credit_card'), false);
  assert.equal(game.eng.isAccessible('credit_card'), false);
  game = await restore(game);
  assert.deepEqual(game.state.contents('soggy_bag'), []);
  await command(game, 'take credit card');
  assert.equal(game.state.itemAt('credit_card'), 'in:empty_bag');
  assert.equal(game.state.has('credit_card'), false);
});

test('普通入水：口袋空袋受潮后湿袋仍在口袋，能正常拿回', async () => {
  const game = await ranch();
  game.state.take('bag');
  await command(game, 'empty bag');
  await command(game, 'put bag in pocket');
  assert.equal(game.state.itemAt('empty_bag'), 'pocket');
  await command(game, 'in');
  assert.equal(game.state.itemAt('soggy_bag'), 'pocket');
  await command(game, 'take bag');
  assert.equal(game.state.itemAt('soggy_bag'), 'inventory');
});

test('普通入水：透明闭笼里的满袋可见不可取；受潮后开笼取回湿袋', async () => {
  const game = await ranch();
  game.state.take('bag');
  game.state.take('cage');
  await command(game, 'open cage');
  await command(game, 'put bag in cage');
  await command(game, 'close cage');
  assert.equal(game.eng.isVisible('bag'), true);
  assert.equal(game.eng.isAccessible('bag'), false);
  await command(game, 'take bag');
  assert.equal(game.state.itemAt('bag'), 'in:cage');
  await command(game, 'in');
  assert.equal(game.state.itemAt('soggy_bag'), 'in:cage');
  assert.equal(game.eng.isVisible('soggy_bag'), true);
  assert.equal(game.eng.isAccessible('soggy_bag'), false);
  await command(game, 'take bag');
  assert.equal(game.state.itemAt('soggy_bag'), 'in:cage');
  await command(game, 'open cage');
  await command(game, 'take bag');
  assert.equal(game.state.itemAt('soggy_bag'), 'inventory');
});

test('普通入水：笼中空袋按已核实一层受潮，第二层卡片仍留在旧袋且不可见', async () => {
  let game = await ranch();
  await cardBag(game);
  game.state.take('cage');
  await command(game, 'open cage');
  await command(game, 'put bag in cage');
  await command(game, 'close cage');
  game = await restore(game);
  await command(game, 'in');
  assert.equal(game.state.itemAt('soggy_bag'), 'in:cage');
  assert.equal(game.state.itemAt('credit_card'), 'in:empty_bag');
  await command(game, 'open cage');
  await command(game, 'take bag');
  assert.equal(game.state.itemAt('soggy_bag'), 'inventory');
  await command(game, 'take credit card');
  assert.equal(game.state.has('credit_card'), false);
});

test('普通入水：对讲机受潮后外观和收听变化，既有章节计时器不被替换', async () => {
  const game = await ranch();
  game.state.take('walkie_talkie');
  await command(game, 'turn on walkie-talkie');
  assert.equal(game.state.hasFlag('walkie_wet'), false);
  let ticks = 0;
  game.state.startTimer(9, 'ranch-test-independent', () => ticks++);
  await command(game, 'in');
  assert.equal(game.state.hasFlag('walkie_wet'), true);
  assert.equal(game.state.itemAt('walkie_talkie'), 'inventory');
  assert.equal(game.state.timer.id, 'ranch-test-independent');
  assert.equal(game.state.timer.remaining, 8);
  assert.equal(ticks, 1);
  assert.match(await command(game, 'examine walkie-talkie'), /dripping wet/);
  assert.match(await command(game, 'listen to walkie-talkie'), /silent/);
});

test('对讲机正常持有后放入口袋、打开的笼子仍按已验证大小拒绝', async () => {
  const game = await ranch();
  game.state.take('walkie_talkie');
  game.state.take('cage');
  await command(game, 'put walkie-talkie in pocket');
  assert.equal(game.state.itemAt('walkie_talkie'), 'inventory');
  await command(game, 'open cage');
  await command(game, 'put walkie-talkie in cage');
  assert.equal(game.state.itemAt('walkie_talkie'), 'inventory');
});

for (const mode of ['enter', 'mill']) {
  test(`一层纸袋容器里的对讲机：${mode}受潮与袋内容处理分别生效`, async () => {
    const game = await ranch(mode === 'enter' ? 'edge_reservoir' : 'under_windmill');
    game.state.take('bag');
    await command(game, 'empty bag');
    game.state.take('walkie_talkie');
    await command(game, 'put walkie-talkie in bag');
    assert.equal(game.state.itemAt('walkie_talkie'), 'in:empty_bag');
    if (mode === 'enter') await command(game, 'in');
    else {
      await command(game, 'up');
      await command(game, 'take binoculars');
    }
    assert.equal(game.state.hasFlag('walkie_wet'), true);
    assert.equal(game.state.itemAt('walkie_talkie'), mode === 'enter' ? 'in:empty_bag' : 'in:soggy_bag');
    assert.equal(game.state.itemAt('soggy_bag'), mode === 'enter' ? 'inventory' : 'underwater');
  });
}

for (const placement of ['held', 'platform']) {
  for (const kind of ['bag', 'empty_bag', 'walkie_talkie']) {
    test(`风车坍塌：${placement}/${kind}受潮落水；空袋卡片保留且能实际取回`, async () => {
      let game = await ranch('under_windmill');
      if (kind === 'empty_bag') await cardBag(game);
      else game.state.take(kind);
      game.state.toPocket('small_coin');
      game.state.wear('shroud');
      await command(game, 'up');
      if (placement === 'platform') {
        await command(game, kind === 'walkie_talkie' ? 'drop walkie-talkie' : 'drop bag');
        await command(game, 'look');
      }
      const beforeTurns = game.state.turns;
      await command(game, 'take binoculars');
      const target = kind === 'walkie_talkie' ? kind : 'soggy_bag';
      assert.equal(game.state.turns, beforeTurns, '受潮和落物不另耗回合');
      assert.equal(game.state.room, 'reservoir');
      assert.equal(game.state.itemAt(target), 'underwater');
      assert.equal(game.state.itemAt('small_coin'), 'pocket');
      assert.equal(game.state.itemAt('shroud'), 'worn');
      assert.equal(game.state.itemAt('watch'), 'worn');
      if (kind === 'walkie_talkie') assert.equal(game.state.hasFlag('walkie_wet'), true);
      else assert.equal(game.state.itemAt(kind), 'destroyed');
      if (kind === 'empty_bag') {
        assert.equal(game.state.itemAt('credit_card'), 'in:soggy_bag');
        assert.deepEqual(game.state.contents('soggy_bag'), ['credit_card']);
      }
      game = await restore(game);
      await command(game, 'down');
      await command(game, kind === 'walkie_talkie' ? 'take walkie-talkie' : 'take bag');
      assert.equal(game.state.itemAt(target), 'inventory');
      await command(game, 'up');
      assert.equal(game.state.cnt('ranch_breath_remaining'), 0);
      if (kind === 'empty_bag') {
        assert.equal(game.eng.isAccessible('credit_card'), true);
        await command(game, 'take credit card from bag');
        assert.equal(game.state.itemAt('credit_card'), 'inventory');
      }
      if (kind === 'walkie_talkie') {
        assert.match(await command(game, 'examine walkie-talkie'), /dripping wet/);
        assert.match(await command(game, 'listen to walkie-talkie'), /silent/);
      }
      assert.equal(game.state.score, 0, '回收袋子或设备不误用镜子的首次奖励');
      assert.equal(game.state.hasFlag('ranch_landing_collapsed'), true);
    });
  }
}

test('已湿袋携卡重复入水不重新替换，surface下潜也不再执行普通空袋受潮', async () => {
  let game = await ranch();
  game.state.take('bag');
  await command(game, 'in');
  await command(game, 'take credit card');
  await command(game, 'put credit card in bag');
  assert.equal(game.state.itemAt('credit_card'), 'in:soggy_bag');
  await command(game, 'out');
  game = await restore(game);
  await command(game, 'in');
  assert.equal(game.state.itemAt('credit_card'), 'in:soggy_bag');
  await command(game, 'down');
  assert.equal(game.state.cnt('ranch_breath_remaining'), 3);
  assert.equal(game.state.itemAt('credit_card'), 'in:soggy_bag');
  await command(game, 'up');
  await command(game, 'take credit card from bag');
  assert.equal(game.state.itemAt('credit_card'), 'inventory');

  // 下潜不是再次触发 INTO-RESERVOIR：从水面放置的新空袋保持原对象。
  game.state.destroy('soggy_bag');
  game.state.take('empty_bag');
  await command(game, 'down');
  assert.equal(game.state.itemAt('empty_bag'), 'inventory');
  assert.equal(game.state.itemAt('soggy_bag'), 'destroyed');
});

test('已湿袋携卡再经历风车坍塌保留父子关系，回收后实际拿到卡片', async () => {
  let game = await ranch();
  game.state.take('bag');
  await command(game, 'in');
  await command(game, 'take credit card');
  await command(game, 'put credit card in bag');
  await command(game, 'out');
  await command(game, 'down');
  await command(game, 'ne');
  await command(game, 'up');
  await command(game, 'take binoculars');
  assert.equal(game.state.itemAt('soggy_bag'), 'underwater');
  assert.equal(game.state.itemAt('credit_card'), 'in:soggy_bag');
  game = await restore(game);
  await command(game, 'down');
  await command(game, 'take bag');
  await command(game, 'up');
  await command(game, 'take credit card from bag');
  assert.equal(game.state.itemAt('credit_card'), 'inventory');
});
