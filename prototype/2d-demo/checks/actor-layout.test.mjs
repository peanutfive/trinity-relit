import test from 'node:test';
import assert from 'node:assert/strict';
import { actorLayout, actorHitShape, actorIdentity, boyPoseFrame, umbrellaWomanPoseFrame } from '../actor-layout.js';

test('seated seller hips match the bench seat without changing the world anchor', () => {
  const object = { id: 'broad_walk:woman', kind: 'woman', x: 143, y: 166 };
  const layout = actorLayout(object);
  assert.equal(object.y + layout.yOffset + layout.seatOffset, 161);
  assert.ok(layout.height < 35, 'seated adult must stay shorter than standing hero');
  assert.equal(object.y, 166);
  const shape = actorHitShape(object);
  assert.ok(Math.abs(shape.y - (object.y + layout.yOffset - layout.height / 2)) < .01);
});

test('boy pose art is selected by narrative action rather than an independent animation clock', () => {
  assert.deepEqual(['dip','blow','admire','snap','startled'].map(pose => boyPoseFrame({pose})), [0,1,2,2,3]);
  assert.equal(boyPoseFrame({pose:'blow',startled:true}),3);
  assert.equal(boyPoseFrame({}),0);
  const boy=actorLayout({kind:'boy'});
  assert.ok(boy.cuePoints.dish[0] < 0, 'dish must stay on the reaching hand side in every seated pose');
  assert.ok(Math.abs(boy.cuePoints.wand[1]) < boy.height, 'bubble must originate at the visible mouth');
});

test('child and seller pointer targets track their actual seated silhouettes', () => {
  for (const object of [{kind:'boy',x:300,y:145},{kind:'woman',x:143,y:166}]) {
    const layout = actorLayout(object), shape = actorHitShape(object);
    const top = object.y + layout.yOffset - layout.height;
    assert.ok(Math.abs(shape.y - layout.hit.ry - top) <= 1.1);
    assert.ok(shape.ry < 18, 'short seated people must not inherit standing-adult hit ellipses');
  }
});

test('canonical actor identity survives kind aliases and explicit identity wins', () => {
  assert.equal(actorIdentity({kind:'woman',id:'lancaster_gate:woman'}),'lancaster_umbrella_woman');
  assert.equal(actorIdentity({kind:'woman',id:'lancaster_gate:woman',actorId:'bird_food_seller'}),'bird_food_seller');
  assert.equal(actorLayout({kind:'sundial'}),null);
  const original=actorLayout({kind:'boy'});
  original.hit.ry=100;
  assert.notEqual(actorLayout({kind:'boy'}).hit.ry,100);
});

test('umbrella loss changes to empty hands and all later actions retain the same actor', () => {
  assert.equal(umbrellaWomanPoseFrame({pose:'standing_umbrella',umbrella:true}),0);
  assert.equal(umbrellaWomanPoseFrame({action:'released',umbrella:false}),1);
  assert.equal(umbrellaWomanPoseFrame({action:'look_up',umbrella:false}),1);
  assert.equal(umbrellaWomanPoseFrame({action:'wipe',umbrella:false}),2);
  assert.equal(umbrellaWomanPoseFrame({action:'kick',umbrella:false}),3);
  assert.deepEqual([0,.15].map(progress=>umbrellaWomanPoseFrame({action:'leave',progress})),[4,5]);
  assert.ok(actorLayout({kind:'umbrella_woman'}).height<=35,'canopy must not make the adult body grow');
});
