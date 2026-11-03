import test from 'node:test';
import assert from 'node:assert/strict';
import {GameState} from '../../js/engine.js';
import {getPacificHotspots} from '../pacific-actions.js';
import {keyboardInteraction} from '../interaction-context.js';

test('手持物品不会把控制箱徒手操作误标为使用物品，提示与实际F命令一致',()=>{
  const state=new GameState();state.chapter='pacific';state.room='bottom_scaffold';
  const box=getPacificHotspots(state).find(o=>o.kind==='pacific_box');
  const observed=new Set([box.id]),options={heldItem:'gnomon',observed};
  assert.equal(keyboardInteraction(state,box,options).command,'open box');
  assert.equal(keyboardInteraction(state,box,options).hint,'打开');
  state.setFlag('pacific_box_open');
  let target=getPacificHotspots(state).find(o=>o.kind==='pacific_switch');
  assert.equal(keyboardInteraction(state,target,options).command,'push switch');
  assert.equal(keyboardInteraction(state,target,options).hint,'按下');
  state.setFlag('pacific_switch_pushed');target=getPacificHotspots(state).find(o=>o.kind==='pacific_button');
  assert.equal(keyboardInteraction(state,target,options).command,'push button');
  assert.equal(keyboardInteraction(state,target,options).hint,'按下');
});
