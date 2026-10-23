import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_BINDINGS, defaultPreferences, loadPreferences, savePreferences } from '../settings.js';

function stored(saved,run){
  const prior=Object.getOwnPropertyDescriptor(globalThis,'localStorage');
  let text=saved===undefined?null:JSON.stringify(saved);
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:()=>text,setItem:(_,value)=>{text=value;}}});
  try{return run(()=>JSON.parse(text));}
  finally{if(prior)Object.defineProperty(globalThis,'localStorage',prior);else delete globalThis.localStorage;}
}

test('默认F互动与对话，全屏F11独立，不与移动/背包冲突',()=>stored(undefined,()=>{
  const preferences=loadPreferences();
  assert.equal(preferences.bindings.interact,'f');
  assert.equal(preferences.bindings.fullscreen,'F11');
  assert.equal(new Set(Object.values(preferences.bindings)).size,Object.keys(DEFAULT_BINDINGS).length);
}));

test('已有Z/F偏好升级为F/F11，保留其他改键及画面音频设置',()=>{
  const old=defaultPreferences();delete old.bindingsVersion;
  old.bindings.interact='z';old.bindings.fullscreen='f';old.bindings.inventory='b';
  old.video.brightness=115;old.audio.enabled=true;old.audio.master=31;
  stored(old,()=>{
    const next=loadPreferences();
    assert.equal(next.bindings.interact,'f');assert.equal(next.bindings.fullscreen,'F11');
    assert.equal(next.bindings.inventory,'b');assert.equal(next.video.brightness,115);
    assert.equal(next.audio.enabled,true);assert.equal(next.audio.master,31);
  });
});

test('升级后主动改键可保存及再加载，不被迁移逻辑反复改回',()=>stored(undefined,read=>{
  const changed=defaultPreferences();changed.bindings.interact='z';changed.bindings.fullscreen='f';
  savePreferences(changed);assert.equal(read().bindingsVersion,2);
  assert.deepEqual(loadPreferences().bindings,changed.bindings);
}));

test('损坏或冲突的映射整体回退到F默认，不覆盖合法音量',()=>{
  const bad=defaultPreferences();bad.bindings.inventory='f';bad.audio.master=24;
  stored(bad,()=>{assert.deepEqual(loadPreferences().bindings,DEFAULT_BINDINGS);assert.equal(loadPreferences().audio.master,24);});
});
