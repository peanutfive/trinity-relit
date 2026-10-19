import assert from 'node:assert/strict';
import test from 'node:test';
import { GameEngine } from '../prototype/js/engine.js';
import { Parser } from '../prototype/js/parser.js';
import { stubUi } from './harness.mjs';

function fixture({ events = [], exits = {}, onWait, onTurn, onEnter, intentResolver } = {}) {
  const output = [], saves = [], observed = [];
  const room = {
    name: '测试房间', cn: '测试房间', desc: '测试描述。', events, exits, onWait,
    onTurn(s, eng) { observed.push(s.turns); onTurn?.(s, eng); },
  };
  const eng = new GameEngine({
    rooms: { palace_gate: room, destination: { ...room, events: [], onEnter } },
    items: {}, parser: new Parser(), ui: stubUi(output), intentResolver,
    onAutosave: save => saves.push(save),
  });
  let timerTicks = 0;
  eng.state.startTimer(20, 'fixture', () => timerTicks++);
  return { eng, state: eng.state, output, saves, observed, get timerTicks() { return timerTicks; } };
}

const event = patch => ({
  id: 'stone', match: { verb: ['push'], noun: ['stone'] }, triggers: ['push stone', '推石头'],
  act(s) { s.setFlag('stone_changed'); }, text: '', ...patch,
});

test('事件声明免推进：动作看见暂增回合，但落盘回合、onTurn和计时器不推进', async () => {
  let seen;
  const game = fixture({ events: [event({ advancesTurn: false, act(s) { seen = s.turns; s.setFlag('changed'); return true; } })] });
  game.state.turns = 7;
  assert.equal(await game.eng._runCommandTurn({ type: 'simple', verb: 'push', noun: 'stone' }), true);
  assert.equal(seen, 8);
  assert.equal(game.state.turns, 7);
  assert.equal(game.state.hasFlag('changed'), true);
  assert.deepEqual(game.observed, []);
  assert.equal(game.timerTicks, 0);
  assert.equal(game.state.timer.remaining, 20);
  assert.equal(game.saves.length, 1);
  assert.equal(game.saves[0].state.turns, 7);
  assert.ok(game.saves[0].state.flags.includes('changed'));
});

test('旧事件仍推进一次，act返回false或免推进结构均不覆盖事件声明', async () => {
  for (const returned of [undefined, false, { handled: true, advancesTurn: false }]) {
    const game = fixture({ events: [event({ act() { return returned; } })] });
    await game.eng.processInput('push stone');
    assert.equal(game.state.turns, 1);
    assert.deepEqual(game.observed, [1]);
    assert.equal(game.timerTicks, 1);
    assert.equal(game.saves.length, 1);
  }
});

test('条件出口免推进适用于成功移动和when阻挡，成功onEnter保持旧的暂增观察值', async () => {
  for (const allowed of [true, false]) {
    let seen;
    const game = fixture({
      exits: { n: { to: 'destination', advancesTurn: false, when: () => allowed, fail: '暂时不能通过。' } },
      onEnter(s) { seen = s.turns; s.setFlag('entered'); },
    });
    await game.eng.processInput('north');
    assert.equal(game.state.room, allowed ? 'destination' : 'palace_gate');
    assert.equal(game.state.turns, 0);
    assert.equal(seen, allowed ? 1 : undefined);
    assert.equal(game.timerTicks, 0);
    assert.deepEqual(game.observed, []);
    assert.equal(game.saves.length, 1);
    assert.equal(game.saves[0].state.turns, 0);
  }
});

test('旧直连与条件出口仍各结算一次回合，出口act返回值不参与回合决策', async () => {
  for (const exit of ['destination', { to: 'destination', act: () => ({ handled: true, advancesTurn: false }) },
    { to: 'destination', when: () => false, fail: '暂时不能通过。' }]) {
    const game = fixture({ exits: { n: exit } });
    await game.eng.processInput('north');
    assert.equal(game.state.turns, 1);
    assert.equal(game.timerTicks, 1);
    assert.deepEqual(game.observed, [1]);
  }
});

test('语义确认通过同一免推进执行入口，只保存一次真实状态', async () => {
  let resolved = 0, confirmed = 0;
  const game = fixture({
    events: [event({ advancesTurn: false })],
    intentResolver: { async resolve() { resolved++; return { kind: 'suggest', candidateIds: ['event:stone'] }; } },
  });
  game.eng.ui.chooseIntent = choices => { confirmed++; assert.equal(game.state.turns, 0); return choices[0].id; };
  await game.eng.processInput('将旁边那块大岩石挪一挪');
  assert.equal(resolved, 1);
  assert.equal(confirmed, 1);
  assert.equal(game.state.hasFlag('stone_changed'), true);
  assert.equal(game.state.turns, 0);
  assert.equal(game.timerTicks, 0);
  assert.equal(game.saves.length, 1);
});

test('未知动作不推进、不保存，也不会执行onTurn或计时器', async () => {
  const game = fixture();
  const before = game.eng.serialize().state;
  assert.equal(await game.eng._runCommandTurn(null), false);
  await game.eng.processInput('open nonexistent');
  assert.deepEqual(game.eng.serialize().state, before);
  assert.deepEqual(game.observed, []);
  assert.equal(game.timerTicks, 0);
  assert.equal(game.saves.length, 0);
});

test('免推进致死事件输出死亡提示，保留最后活存档且不运行回调', async () => {
  const game = fixture({ events: [event({ advancesTurn: false, act(s) { s.dead = true; } })] });
  await game.eng.processInput('look');
  assert.equal(game.saves.length, 1);
  const saved = game.saves[0].state;
  await game.eng.processInput('push stone');
  assert.equal(game.state.dead, true);
  assert.equal(game.state.turns, 1);
  assert.equal(game.saves.length, 1);
  assert.equal(saved.dead, false);
  assert.match(game.output.map(entry => entry.text).join('\n'), /你死了/);
  assert.deepEqual(game.observed, [1]);
  assert.equal(game.timerTicks, 1);
});

test('WAIT显式批次逐tick结算并保存，不重复调用onWait', async () => {
  let calls = 0;
  const game = fixture({ onWait(s) { calls++; assert.equal(s.turns, 1); return { handled: true, maxTurns: 3 }; } });
  await game.eng.processInput('wait');
  assert.equal(calls, 1);
  assert.equal(game.state.turns, 3);
  assert.deepEqual(game.observed, [1, 2, 3]);
  assert.equal(game.timerTicks, 3);
  assert.deepEqual(game.saves.map(save => save.state.turns), [1, 2, 3]);
});

test('WAIT在每tick完成后检查提前停止条件，并保留中间可恢复的存档', async () => {
  let predicates = 0;
  const game = fixture({ onWait: () => ({ handled: true, maxTurns: 3,
    stopAfterTurn(s, eng) { predicates++; assert.equal(eng.state, s); return s.turns === 2; },
  }) });
  await game.eng.processInput('wait');
  assert.equal(game.state.turns, 2);
  assert.deepEqual(game.observed, [1, 2]);
  assert.equal(predicates, 2);
  assert.equal(game.timerTicks, 2);
  assert.deepEqual(game.saves.map(save => save.state.turns), [1, 2]);
  const restored = fixture();
  restored.eng.registerTimerHandlers({ fixture: () => {} });
  await restored.eng.deserialize(game.saves[0]);
  assert.equal(restored.eng.state.turns, 1);
  assert.equal(restored.eng.state.timer.remaining, 19);
});

test('WAIT批次死亡时立即停止，死亡tick不覆盖最后活存档', async () => {
  let predicateCalls = 0;
  const game = fixture({ onWait: () => ({ handled: true, maxTurns: 3,
    stopAfterTurn() { predicateCalls++; return false; },
  }), onTurn(s) { if (s.turns === 2) s.dead = true; } });
  await game.eng.processInput('wait');
  assert.equal(game.state.turns, 2);
  assert.equal(game.state.dead, true);
  assert.equal(predicateCalls, 1);
  assert.equal(game.timerTicks, 2);
  assert.deepEqual(game.saves.map(save => save.state.turns), [1]);
  assert.equal(game.output.filter(entry => /你死了/.test(entry.text)).length, 1);
});

test('旧onWait返回undefined/boolean仍一次，非法批次上限不增加执行次数', async () => {
  for (const result of [undefined, false, true, { handled: true, maxTurns: 0 },
    { handled: true, maxTurns: 4 }, { handled: true, maxTurns: Infinity },
    { handled: true, maxTurns: 2.5 }]) {
    const game = fixture({ onWait: () => result });
    await game.eng.processInput('wait');
    assert.equal(game.state.turns, 1);
    assert.equal(game.timerTicks, 1);
    assert.equal(game.saves.length, 1);
  }
});

test('WAIT的免推进结构仍保存动作变化，不运行批次或停止条件', async () => {
  const game = fixture({ async onWait(s) { s.setFlag('wait_seen'); return {
    handled: true, advancesTurn: false, maxTurns: 3, stopAfterTurn: () => assert.fail('免推进不能检查tick'),
  }; } });
  await game.eng.processInput('wait');
  assert.equal(game.state.turns, 0);
  assert.equal(game.state.hasFlag('wait_seen'), true);
  assert.equal(game.timerTicks, 0);
  assert.equal(game.saves.length, 1);
  assert.equal(game.saves[0].state.turns, 0);
});

test('动作异常撤销未提交tick并释放输入锁，不自动保存部分修改', async () => {
  const game = fixture({ events: [event({ async act() { throw new Error('动作失败'); } })] });
  await assert.rejects(game.eng.processInput('push stone'), /动作失败/);
  assert.equal(game.state.turns, 0);
  assert.equal(game.eng._inputBusy, false);
  assert.equal(game.timerTicks, 0);
  assert.equal(game.saves.length, 0);
});

test('WAIT中间回调异常只撤销未结算tick，保留已完成tick及对应存档', async () => {
  const game = fixture({ onWait: () => ({ handled: true, maxTurns: 3 }),
    onTurn(s) { if (s.turns === 2) throw new Error('回合失败'); },
  });
  await assert.rejects(game.eng.processInput('wait'), /回合失败/);
  assert.equal(game.state.turns, 1);
  assert.equal(game.eng._inputBusy, false);
  assert.equal(game.timerTicks, 1);
  assert.deepEqual(game.saves.map(save => save.state.turns), [1]);
});

test('WAIT停止条件异常不撤销已经完成并保存的tick', async () => {
  const game = fixture({ onWait: () => ({ handled: true, maxTurns: 3,
    stopAfterTurn() { throw new Error('停止条件失败'); },
  }) });
  await assert.rejects(game.eng.processInput('wait'), /停止条件失败/);
  assert.equal(game.state.turns, 1);
  assert.equal(game.timerTicks, 1);
  assert.deepEqual(game.saves.map(save => save.state.turns), [1]);
});

test('公共携带容量判断与普通拿取一致，只计手持物，不计穿戴和口袋', async () => {
  const game = fixture();
  for (let i = 0; i < 8; i++) game.state.take(`held_${i}`);
  game.state.wear('worn');
  game.state.toPocket('pocket');
  game.eng.items.stone = { cn: '石头', aliases: ['stone'] };
  game.state.placeItem('stone', 'palace_gate');
  assert.equal(game.eng.hasCarrySpace(), false);
  await game.eng.processInput('take stone');
  assert.equal(game.state.itemAt('stone'), 'palace_gate');
  game.state.drop('held_0');
  assert.equal(game.eng.hasCarrySpace(), true);
  await game.eng.processInput('take stone');
  assert.equal(game.state.carrying('stone'), true);
  assert.equal(game.eng.hasCarrySpace(), false);
});
