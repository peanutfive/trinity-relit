import test from 'node:test';
import assert from 'node:assert/strict';
import {ROOMS} from '../../js/data/pacific.js';
import {GameState} from '../../js/engine.js';
import {filterVisualPresence} from '../visual-text-policy.js';

test('太平洋进场去掉解法广告与错误台地海岛定位，实际事件反馈保持原样',()=>{
  const state=new GameState();
  for(const [room,forbidden] of [['bottom_scaffold',/seven minutes|push the|七分钟|按下|打开它/],['west_beach',/dolphin|Point at|海豚|指向/],['mesa',/ocean|大洋|scaffold|脚手架/]]){
    state.room=room;const original=ROOMS[room].desc(state);
    const view=filterVisualPresence(original,{room,source:'room'});
    assert.doesNotMatch(view.text,forbidden);assert.ok(view.removed.length);
    assert.equal(filterVisualPresence(original,{room,source:'event'}).text,original);
  }
  for(const event of ROOMS.bottom_scaffold.events){
    if(typeof event.text==='string')assert.equal(filterVisualPresence(event.text,{room:'bottom_scaffold',source:'event'}).text,event.text);
  }
  for(const flag of ['pacific_box_open','pacific_switch_pushed'])state.setFlag(flag);
  assert.doesNotMatch(filterVisualPresence(ROOMS.bottom_scaffold.desc(state),{room:'bottom_scaffold',source:'room'}).text,/seven minutes|七分钟/);
});
