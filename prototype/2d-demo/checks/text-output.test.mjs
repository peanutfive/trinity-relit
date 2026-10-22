import test from 'node:test';
import assert from 'node:assert/strict';
import { isRepeatedItemDescription } from '../text-output.js';
import { ROOMS } from '../../js/data/prologue.js';
import { ITEMS } from '../../js/data/items.js';
import { GameState } from '../../js/engine.js';

test('花径已包含足球的中英说明，不再重复追加物品注释', () => {
  const state = new GameState();
  state.room = 'flower_walk';
  state.itemLoc.ball = 'flower_walk';
  assert.equal(isRepeatedItemDescription(ITEMS.ball.roomDesc, ROOMS.flower_walk.desc(state), [ITEMS.ball.roomDesc]), true);
});

test('房间尚未描述该物品时保留注释', () => {
  const state = new GameState();
  state.room = 'flower_walk';
  state.itemLoc.ball = 'inventory';
  assert.equal(isRepeatedItemDescription(ITEMS.ball.roomDesc, ROOMS.flower_walk.desc(state), [ITEMS.ball.roomDesc]), false);
});

test('不删除无关叙事或只匹配一半的双语说明', () => {
  const [english, chinese] = ITEMS.ball.roomDesc.split('\n');
  assert.equal(isRepeatedItemDescription(ITEMS.ball.roomDesc, english, [ITEMS.ball.roomDesc]), false);
  assert.equal(isRepeatedItemDescription(ITEMS.ball.roomDesc, chinese, [ITEMS.ball.roomDesc]), false);
  assert.equal(isRepeatedItemDescription(chinese, chinese, []), false);
});
