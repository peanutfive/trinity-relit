import assert from 'node:assert/strict';
import test from 'node:test';
import { Parser } from '../prototype/js/parser.js';
import { createGame } from './harness.mjs';

test('英文冠词只在名词短语开头消除，复合指令两侧同样处理', () => {
  const parser = new Parser();
  for (const article of ['the', 'a', 'an']) {
    assert.equal(parser.parse(`take ${article} paper bird`).noun, 'paper bird');
  }
  assert.deepEqual(parser.parse('throw the ball at the umbrella'), {
    type: 'compound', verb: 'throw', noun: 'ball', prep: 'at', noun2: 'umbrella',
  });
  assert.equal(parser.parse('examine the sign of the times').noun, 'sign of the times');
});

test('含冠词的纸鸟和老妇人指令直接执行，离线也不需要模型确认', async () => {
  for (const [room, input, flag] of [
    ['round_pond', 'pick up the paper bird', 'paper_bird_taken'],
    ['lancaster_gate', 'help the old woman', 'umbrella_woman_done'],
  ]) {
    const game = createGame({intentResolver: {resolve() { assert.fail('明确命令不得调用模型'); }}});
    game.eng.moveTo(room);
    await game.eng.processInput(input);
    assert.equal(game.state.turns, room === 'lancaster_gate' ? 0 : 1);
    if (room === 'round_pond') assert.ok(game.state.has('paper_bird'));
    else assert.ok(game.state.hasFlag(flag));
  }
});

test('听平台与屏息的中英文命令使用同一标准动作', () => {
  const parser = new Parser();
  for (const input of ['listen to the landing', 'listen landing', '听平台', '聆听平台']) {
    const parsed = parser.parse(input);
    assert.equal(parsed.type, 'simple');
    assert.equal(parsed.verb, 'listen');
    assert.equal(parsed.noun, input.includes('平台') ? '平台' : 'landing');
  }
  for (const input of ['hold breath', 'hold the breath', '屏息', '憋气', '屏住呼吸']) {
    assert.deepEqual(parser.parse(input), { type: 'simple', verb: 'hold', noun: 'breath' });
  }
});

test('容器的中英文操作保留取出来源、查看内部及对讲机开关语义', () => {
  const parser = new Parser();
  assert.deepEqual(parser.parse('从袋子里拿出信用卡'), { type: 'compound', verb: 'take', noun: '信用卡', prep: 'from', noun2: '袋子' });
  assert.deepEqual(parser.parse('take the card from the bag'), { type: 'compound', verb: 'take', noun: 'card', prep: 'from', noun2: 'bag' });
  for (const input of ['empty out the bag', '清空袋子', '倒空纸袋']) assert.equal(parser.parse(input).verb, 'empty');
  for (const input of ['look in the bag', 'look inside the bag', '查看袋子里面']) assert.equal(parser.parse(input).verb, 'look_in');
  for (const input of ['turn on the walkie-talkie', 'switch the walkie-talkie on', '打开对讲机']) assert.equal(parser.parse(input).verb, 'turn_on');
  for (const input of ['turn off the walkie-talkie', 'switch the walkie-talkie off', '关闭对讲机']) assert.equal(parser.parse(input).verb, 'turn_off');
});
