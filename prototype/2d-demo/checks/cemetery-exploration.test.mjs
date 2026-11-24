import assert from 'node:assert/strict';
import test from 'node:test';
import { GameState } from '../../js/engine.js';
import { SCENES } from '../scene-manifest.js';
import { getUndergroundHotspots } from '../underground-actions.js';
import { pointerTarget } from '../interaction-targets.js';
import { resolveInteraction } from '../interaction-intent.js';
import { CRYPT_OPEN } from '../cemetery-state.js';
import { findPath, isBlocked, isSegmentWalkable } from '../world.js';

function atCemetery() {
  const state=new GameState();
  state.chapter='wabe';
  state.room='cemetery';
  return state;
}

test('沿可见土路靠近地面石棺，北面的古墓隧道仍是独立通路', () => {
  const scene=SCENES.cemetery;
  const state=atCemetery();
  const objects=getUndergroundHotspots(state);
  const tomb=objects.find(object=>object.kind==='cemetery_tomb');
  const tunnel=objects.find(object=>object.kind==='passage');
  for (const padding of [0,8]) {
    assert.equal(pointerTarget(objects,{x:179,y:125},{padding})?.id,tomb.id);
    assert.equal(pointerTarget(objects,{x:240,y:62},{padding})?.id,tunnel.id);
  }
  for (const origin of [scene.spawn,scene.exitAnchors.n,scene.exitAnchors.s]) {
    assert.ok(findPath(scene,origin,tomb).length);
    assert.ok(findPath(scene,origin,tunnel).length);
  }
  const bend=[[242,251],[260,205],[225,163],[197,151]];
  for(let i=1;i<bend.length;i++)assert.ok(isSegmentWalkable(scene,bend[i-1],bend[i]));
  assert.ok(isBlocked(scene,175,133));
  assert.ok(isBlocked(scene,146,103));
});

test('棺盖、北面的门和棺内近看的键盘意图按实际状态决定', () => {
  const state=atCemetery();
  const subjects=()=>getUndergroundHotspots(state);
  const tomb=()=>subjects().find(object=>object.kind==='cemetery_tomb');
  const tunnel=subjects().find(object=>object.kind==='passage');
  const observed=new Set([tomb().id]);
  assert.equal(resolveInteraction(state,tomb()),'examine crypt');
  assert.equal(resolveInteraction(state,tomb(),{observed}),'open crypt');
  state.take('spade');
  assert.equal(resolveInteraction(state,tomb(),{heldItem:'spade'}),'open crypt with spade');
  assert.equal(resolveInteraction(state,tunnel,{heldItem:'spade'}),'n');
  state.setFlag(CRYPT_OPEN);
  assert.equal(resolveInteraction(state,tomb(),{observed,heldItem:'spade'}),'look in crypt');
});
