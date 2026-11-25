import test from 'node:test';
import assert from 'node:assert/strict';
import { SCENES } from '../scene-manifest.js';
import { roomArrival } from '../arrivals.js';
import { exitDistance, findPath, isBlocked } from '../world.js';
import { pointerTarget } from '../interaction-targets.js';
import { resolveInteraction } from '../interaction-intent.js';
import { towerClimb, towerClimbFrame } from '../shack-ladder-motion.js';

const passages=[
  ['shack','w','tower_platform','e'],
  ['tower_platform','d','tower_landing','u'],
  ['tower_landing','d','base_of_tower','u'],
  ['base_of_tower','se','shallow_crater','nw'],
];

test('两段梯子上下共用同一组梯级，经过中点时双脚仍在对应实景',()=>{
  for(const [upper,lower] of [['tower_platform','tower_landing'],['tower_landing','base_of_tower']]){
    const pose=room=>({room,visual:{player:{x:SCENES[room].spawn.x,y:SCENES[room].spawn.y,face:'up'}}});
    const down=towerClimb(pose(upper),pose(lower)),up=towerClimb(pose(lower),pose(upper));
    const start=towerClimbFrame(down,0),end=towerClimbFrame(down,down.duration);
    assert.equal(start.room,upper);
    assert.equal(end.room,lower);
    assert.equal(towerClimbFrame(up,up.duration).room,upper);
    const halfway=towerClimbFrame(down,down.duration/2),back=towerClimbFrame(up,up.duration/2);
    assert.equal(halfway.room,upper);
    assert.equal(halfway.actor.visualOptions.onRungs,true);
    assert.equal(halfway.actor.x,back.actor.x);
    assert.equal(halfway.actor.y,back.actor.y);
    assert.ok(Number.isFinite(halfway.actor.x) && Number.isFinite(halfway.actor.y));
  }
});

test('棚屋到浅坑的八个来向都落在对应开口内侧，能离开也能折返',()=>{
  for(const [a,dir,b,back] of passages){
    for(const [source,direction,target,reverse] of [[a,dir,b,back],[b,back,a,dir]]){
      const scene=SCENES[target];
      const exit=SCENES[source].exits.find(item=>item.dir===direction);
      assert.equal(exit.target,target);
      assert.ok(findPath(SCENES[source],SCENES[source].spawn,exit).length);
      const arrival=roomArrival(scene,{fromRoom:source,direction,exits:scene.exits});
      assert.equal(arrival.entrance,reverse);
      assert.ok(arrival.matched);
      for(const sensor of scene.exits)assert.ok(exitDistance(sensor,arrival)>sensor.radius+7,target+' '+sensor.dir);
      assert.ok(!isBlocked(scene,arrival.x,arrival.y) && findPath(scene,arrival,scene.spawn).length);
    }
  }
});

test('梯子与门洞都能通过实物点中，棚屋东门与通往平台的西口各自响应',()=>{
  for(const room of ['shack','tower_platform','tower_landing','base_of_tower']){
    const scene=SCENES[room];
    for(const object of scene.objects.filter(o=>o.kind==='passage'||o.kind==='shack_door')){
      const points=object.pointerShape.points;
      const middle={x:points.reduce((n,p)=>n+p[0],0)/points.length,y:points.reduce((n,p)=>n+p[1],0)/points.length};
      assert.equal(pointerTarget(scene.objects,middle)?.id,object.id);
      assert.equal(resolveInteraction({room},object,{heldItem:'spade'}),object.actions[0].command);
      assert.ok(findPath(scene,scene.spawn,object).length,object.id);
    }
  }
  assert.deepEqual(SCENES.shack.exits.map(exit=>exit.dir),['w']);
});
