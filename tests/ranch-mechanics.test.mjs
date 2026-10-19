import assert from 'node:assert/strict';
import test from 'node:test';
import { createGame, command } from './harness.mjs';

// 单章夹具只验证已迁移的局部机制，不当作原版正常路线证据。
async function ranch(room = 'under_windmill', options = {}) {
  const game = createGame(options);
  game.state.setFlag('prologue_done');
  game.state.clearTimer();
  await game.eng.transitionChapter({ to: 'ranch', roomCandidates: [room] });
  return game;
}

const saved = game => JSON.parse(JSON.stringify(game.eng.serialize()));
async function restore(game) {
  const next = createGame();
  await next.eng.deserialize(saved(game));
  return next;
}

test('首次登台警告后，三个 WAIT 分别呻吟、下垂和坍塌', async () => {
  const game = await ranch();
  assert.match(await command(game, 'up'), /The landing creaks under your weight/);
  assert.equal(game.state.cnt('ranch_landing_life'), 3);
  for (const [message, life] of [
    [/The landing emits a wooden moan of discomfort/, 2],
    [/The landing is sagging dangerously/, 1],
    [/CRACK! The landing tips wildly under your feet/, 0],
  ]) {
    const turns = game.state.turns;
    assert.match(await command(game, 'wait'), message);
    assert.equal(game.state.turns, turns + 1, '平台事件使原版 WAIT 每次只推进一 tick');
    assert.equal(game.state.cnt('ranch_landing_life'), life);
  }
  assert.equal(game.state.room, 'reservoir');
  assert.equal(game.state.itemAt('binoculars'), 'underwater');
});

test('离台等待不耗平台寿命；存档恢复后返台继续而不重置', async () => {
  const game = await ranch();
  await command(game, 'up');
  await command(game, 'down');
  for (let index = 0; index < 3; index++) await command(game, 'wait');
  assert.equal(game.state.cnt('ranch_landing_life'), 3);
  const next = await restore(game);
  assert.match(await command(next, 'up'), /wooden moan of discomfort/);
  assert.equal(next.state.cnt('ranch_landing_life'), 2);
  assert.match(await command(next, 'wait'), /sagging dangerously/);
  assert.match(await command(next, 'wait'), /CRACK!/);
});

test('聆听平台主动触发一次警告，普通回合再触发一次', async () => {
  const game = await ranch();
  await command(game, 'up');
  const turns = game.state.turns;
  const response = await command(game, 'listen to the landing');
  assert.match(response, /wooden moan of discomfort[\s\S]*sagging dangerously/);
  assert.equal(game.state.turns, turns + 1);
  assert.equal(game.state.cnt('ranch_landing_life'), 1);
  assert.match(await command(game, 'wait'), /CRACK!/);
});

test('首次取镜立即坍塌且不增加普通回合；落物、口袋、穿戴及其他计时器独立', async () => {
  const saves = [];
  const game = await ranch('under_windmill', { onAutosave: data => saves.push(data) });
  game.state.take('bandage');
  game.state.take('splinter');
  game.state.take('spade');
  game.state.wear('shroud');
  game.state.toPocket('credit_card');
  game.state.placeItem('ball', 'windmill');
  await command(game, 'up');
  const turns = game.state.turns;
  const writes = saves.length;
  const response = await command(game, 'take binoculars');
  assert.match(response, /A loud, plaintive CREAK[\s\S]*Slowly, carefully[\s\S]*CRACK!/);
  assert.equal(game.state.turns, turns);
  assert.equal(game.state.room, 'reservoir');
  assert.equal(saves.length, writes + 1, '免推进动作仍保存坍塌状态');
  assert.equal(saves.at(-1).state.room, 'reservoir');
  for (const id of ['bandage', 'splinter', 'spade', 'ball', 'binoculars']) {
    assert.equal(game.state.itemAt(id), 'underwater', id);
  }
  assert.equal(game.state.itemAt('shroud'), 'worn');
  assert.equal(game.state.itemAt('credit_card'), 'pocket');
  assert.equal(game.state.itemAt('watch'), 'worn');
  assert.equal(game.state.score, 0);
});

test('水底回收镜子首取加1、重复不加；可佩戴，坍塌存档保留坏平台', async () => {
  let game = await ranch();
  await command(game, 'up');
  await command(game, 'take binoculars');
  game = await restore(game);
  await command(game, 'down');
  assert.match(await command(game, 'take binoculars'), /Taken/);
  assert.equal(game.state.score, 1);
  await command(game, 'up');
  assert.match(await command(game, 'wear binoculars'), /You put on the pair of binoculars/);
  assert.ok(game.state.wearing('binoculars'));
  assert.match(await command(game, 'examine binoculars'), /The binoculars are of standard Army issue, with a strap for wearing/);
  assert.match(await command(game, 'wear binoculars'), /You're already wearing the pair of binoculars/);
  await command(game, 'south');
  await command(game, 'down');
  await command(game, 'ne');
  assert.match(await command(game, 'up'), /The landing overhead is broken/);
  assert.equal(game.state.room, 'under_windmill');
  // 合法的水底重复取回：从佩戴状态放回水库，再下潜拾取。
  await command(game, 'sw');
  await command(game, 'up');
  await command(game, 'in');
  await command(game, 'down');
  await command(game, 'drop binoculars');
  assert.match(await command(game, 'wear binoculars'), /You're not holding the pair of binoculars/);
  await command(game, 'take binoculars');
  assert.equal(game.state.score, 1);
});

test('水底回收镜子尊重引擎携带上限，腾出位置后才拿到并首次计分', async () => {
  const game = await ranch('underwater');
  game.state.placeItem('binoculars', 'underwater');
  const held = Object.keys(game.eng.items).filter(id => id !== 'binoculars').slice(0, 8);
  for (const id of held) game.state.take(id);
  assert.equal(game.eng.hasCarrySpace(), false);
  assert.match(await command(game, 'take binoculars'), /你拿不下更多东西了/);
  assert.equal(game.state.itemAt('binoculars'), 'underwater');
  assert.equal(game.state.score, 0);
  game.state.drop(held[0]);
  assert.equal(game.eng.hasCarrySpace(), true);
  await command(game, 'take binoculars');
  assert.equal(game.state.itemAt('binoculars'), 'inventory');
  assert.equal(game.state.score, 1);
});

test('自动屏息：下潜当回合从4减3，WAIT先警告再自动上浮', async () => {
  const game = await ranch('reservoir');
  const descent = await command(game, 'down');
  assert.match(descent, /\[holding your breath first\][\s\S]*You sink below the surface/);
  assert.equal(game.state.room, 'underwater');
  assert.equal(game.state.cnt('ranch_breath_remaining'), 3);
  const turns = game.state.turns;
  assert.match(await command(game, 'wait'), /You can't hold your breath much longer/);
  assert.equal(game.state.turns, turns + 2);
  assert.equal(game.state.cnt('ranch_breath_remaining'), 1);
  assert.equal(game.state.room, 'underwater');
  const surfaced = await command(game, 'wait');
  assert.match(surfaced, /You claw your way to the surface as your breath gives out/);
  assert.equal(game.state.turns, turns + 3);
  assert.equal(game.state.room, 'reservoir');
  assert.equal(game.state.cnt('ranch_breath_remaining'), 0);
  assert.equal(game.state.dead, false);
});

test('水下九个失败方向与未知词均不推进、不给计时器tick；主动上浮清理屏息', async () => {
  const game = await ranch('reservoir');
  await command(game, 'down');
  const before = saved(game);
  for (const dir of ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw', 'd']) {
    const output = await command(game, dir);
    assert.match(output, dir === 'd' ? /already at the bottom/ : /hit your head/);
    assert.deepEqual(saved(game).state, before.state, dir);
  }
  await game.eng.processInput('xyzzyfoo');
  assert.deepEqual(saved(game).state, before.state);
  assert.match(await command(game, 'up'), /You rise to the surface, gasping for air/);
  assert.equal(game.state.cnt('ranch_breath_remaining'), 0);
  assert.equal(game.state.room, 'reservoir');
  assert.doesNotMatch(await command(game, 'wait'), /breath|gasp/);
});

test('预先屏息取镜坍塌不tick，保存恢复后下潜同响应气尽上浮', async () => {
  let game = await ranch();
  await command(game, 'up');
  assert.match(await command(game, '屏息'), /You take a deep breath/);
  assert.equal(game.state.cnt('ranch_breath_remaining'), 3);
  const turns = game.state.turns;
  await command(game, 'take binoculars');
  assert.equal(game.state.turns, turns);
  assert.equal(game.state.cnt('ranch_breath_remaining'), 1);
  game = await restore(game);
  const response = await command(game, 'down');
  assert.doesNotMatch(response, /holding your breath first/);
  assert.match(response, /You sink below the surface[\s\S]*You claw your way to the surface/);
  assert.equal(game.state.room, 'reservoir');
  assert.equal(game.state.cnt('ranch_breath_remaining'), 0);
  assert.equal(game.state.turns, turns + 1);
});

test('先登台再屏息：聆听的普通tick坍塌保留一口气，下潜同响应上浮', async () => {
  let game = await ranch();
  await command(game, 'up');
  await command(game, 'hold breath');
  assert.equal(game.state.hasFlag('ranch_mill_before_breath'), false);
  game = await restore(game);
  const turns = game.state.turns;
  const response = await command(game, 'listen to landing');
  assert.match(response, /sagging dangerously[\s\S]*CRACK!/);
  assert.doesNotMatch(response, /involuntary gasp/);
  assert.equal(game.state.turns, turns + 1, 'LANDING-F 返回 RTRUE，聆听仍推进普通回合');
  assert.equal(game.state.room, 'reservoir');
  assert.equal(game.state.cnt('ranch_breath_remaining'), 1);
  const descent = await command(game, 'down');
  assert.doesNotMatch(descent, /holding your breath first/);
  assert.match(descent, /You sink below the surface[\s\S]*You claw your way to the surface/);
  assert.equal(game.state.room, 'reservoir');
});

test('先屏息再登台：平台tick先执行，坍塌同回合气尽，下一下潜重新屏息', async () => {
  let game = await ranch();
  await command(game, 'hold breath');
  await command(game, 'up');
  assert.equal(game.state.hasFlag('ranch_mill_before_breath'), true);
  game = await restore(game);
  const turns = game.state.turns;
  const listening = await command(game, 'listen to landing');
  assert.match(listening, /wooden moan[\s\S]*sagging dangerously[\s\S]*can't hold your breath/);
  assert.equal(game.state.turns, turns + 1);
  const collapse = await command(game, 'wait');
  assert.match(collapse, /CRACK![\s\S]*With an involuntary gasp/);
  assert.equal(game.state.cnt('ranch_breath_remaining'), 0);
  assert.match(await command(game, 'down'), /holding your breath first/);
  assert.equal(game.state.room, 'underwater');
  assert.equal(game.state.cnt('ranch_breath_remaining'), 3);
});

test('屏息耗尽后再次hold复用旧槽次序，离台与存档不重排回调', async () => {
  let game = await ranch();
  for (const input of ['hold breath', 'up', 'down', 'wait', 'up']) await command(game, input);
  assert.equal(game.state.cnt('ranch_breath_remaining'), 0);
  assert.equal(game.state.cnt('ranch_landing_life'), 2);
  assert.equal(game.state.hasFlag('ranch_mill_before_breath'), true);
  game = await restore(game);
  await command(game, 'hold breath');
  assert.equal(game.state.hasFlag('ranch_mill_before_breath'), true);
  assert.match(await command(game, 'wait'), /CRACK![\s\S]*With an involuntary gasp/);
  assert.equal(game.state.cnt('ranch_breath_remaining'), 0);
  assert.match(await command(game, 'down'), /holding your breath first/);
  assert.equal(game.state.room, 'underwater');
});

test('首次登台前屏息已耗尽，再次屏息采用登台后的次序并随存档保留', async () => {
  let game = await ranch();
  for (const input of ['hold breath', 'look', 'look', 'look']) await command(game, input);
  assert.equal(game.state.cnt('ranch_breath_remaining'), 0);
  await command(game, 'up');
  await command(game, 'hold breath');
  game = await restore(game);
  const listening = await command(game, 'listen to landing');
  assert.match(listening, /sagging dangerously[\s\S]*CRACK!/);
  assert.doesNotMatch(listening, /involuntary gasp/);
  assert.equal(game.state.cnt('ranch_breath_remaining'), 1);
  const descent = await command(game, 'down');
  assert.doesNotMatch(descent, /holding your breath first/);
  assert.match(descent, /You claw your way to the surface/);
  assert.equal(game.state.room, 'reservoir');
});

test('聆听act直接坍塌仍推进一次，水面postTurn消耗余气，不套用取镜免回合', async () => {
  const game = await ranch();
  for (const input of ['up', 'wait', 'hold breath']) await command(game, input);
  assert.equal(game.state.cnt('ranch_landing_life'), 1);
  const turns = game.state.turns;
  assert.match(await command(game, 'listen to landing'), /CRACK![\s\S]*With an involuntary gasp/);
  assert.equal(game.state.turns, turns + 1);
  assert.equal(game.state.room, 'reservoir');
  assert.equal(game.state.cnt('ranch_breath_remaining'), 0);
  assert.match(await command(game, 'down'), /holding your breath first/);
  assert.equal(game.state.room, 'underwater');
});

test('离台后屏息仍衰减；警告存档恢复，使用flags/counters不覆盖既有timer', async () => {
  let game = await ranch();
  let timerTicks = 0;
  game.state.startTimer(20, 'test-independent', () => timerTicks++);
  await command(game, 'up');
  await command(game, 'hold breath');
  const remaining = game.state.timer.remaining;
  await command(game, 'down');
  assert.equal(game.state.cnt('ranch_breath_remaining'), 2);
  assert.equal(game.state.timer.remaining, remaining - 1);
  assert.equal(timerTicks, 3);
  assert.match(await command(game, 'nw'), /can't hold your breath much longer/);
  assert.equal(game.state.cnt('ranch_breath_remaining'), 1);
  game.state.clearTimer(); // 独立测试timer未登记，不作为存档夹具内容。
  game = await restore(game);
  assert.match(await command(game, 'w'), /With an involuntary gasp/);
  assert.equal(game.state.room, 'ne_ranch');
  assert.equal(game.state.cnt('ranch_breath_remaining'), 0);
});

test('旧档缺镜子位置按start补齐，destroyed保持，旧坏平台flag和无计数平台档可继续', async () => {
  const game = await ranch();
  const old = saved(game);
  delete old.state.itemLoc.binoculars;
  const next = createGame();
  await next.eng.deserialize(old);
  assert.equal(next.state.itemAt('binoculars'), 'windmill');
  old.state.itemLoc.binoculars = 'destroyed';
  old.state.flags.push('binoculars_broken');
  await next.eng.deserialize(old);
  assert.equal(next.state.itemAt('binoculars'), 'destroyed');
  assert.match(await command(next, 'up'), /landing overhead is broken/);

  old.state.itemLoc.binoculars = 'windmill';
  old.state.room = 'windmill';
  old.state.flags = old.state.flags.filter(flag => flag !== 'binoculars_broken');
  await next.eng.deserialize(old);
  assert.match(await command(next, 'wait'), /landing creaks under your weight/);
  assert.equal(next.state.cnt('ranch_landing_life'), 3);
});

test('两条Ranch出章出口成功后清理本批屏息；失败过渡保留原状态', async () => {
  for (const [dir, target] of [['nw', 'shallow_crater'], ['n', 'behind_shed']]) {
    const game = await ranch('nw_ranch');
    await command(game, 'hold breath');
    assert.equal(game.state.cnt('ranch_breath_remaining'), 3);
    const exit = game.eng.rooms.nw_ranch.exits(game.state)[dir];
    const before = saved(game).state;
    await exit.act(game.state, { transitionChapter: async () => false });
    assert.deepEqual(saved(game).state, before, '失败不清屏息或改其他状态');
    await command(game, dir);
    assert.equal(game.state.room, target);
    assert.equal(game.state.chapter, 'desert');
    assert.equal(game.state.cnt('ranch_breath_remaining'), 0);
  }
});
