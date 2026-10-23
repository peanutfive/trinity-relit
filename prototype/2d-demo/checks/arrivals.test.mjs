import test from 'node:test';
import assert from 'node:assert/strict';
import {SCENES} from '../scene-manifest.js';
import {roomArrival} from '../arrivals.js';
import {findPath,isBlocked} from '../world.js';

test('黑狮门回圆池塘从西北路口入场，不回默认南岸起点',()=>{
  const scene=SCENES.round_pond,arrival=roomArrival(scene,{fromRoom:'black_lion_gate',direction:'se',exits:scene.exits});
  assert.equal(arrival.entrance,'nw');assert.equal(arrival.matched,true);
  assert.ok(arrival.x<70&&arrival.y<110,JSON.stringify(arrival));
  assert.ok(Math.hypot(arrival.x-scene.spawn[0],arrival.y-scene.spawn[1])>100);
  assert.equal(isBlocked(scene,arrival.x,arrival.y),false);
  assert.ok(findPath(scene,arrival,scene.spawn).length>0);
  assert.ok(scene.exits.every(exit=>Math.hypot(arrival.x-exit.x,arrival.y-exit.y)>exit.radius));
});

test('相邻房间往返选择对方的真实返回口，包含楼梯与非对称方向',()=>{
  assert.equal(roomArrival(SCENES.broad_walk,{fromRoom:'palace_gate',direction:'n',exits:SCENES.broad_walk.exits}).face,'up');
  for(const [from,scene]of Object.entries(SCENES))for(const exit of scene.exits){
    const destination=SCENES[exit.target],back=destination.exits.filter(value=>value.target===from);
    if(!back.length)continue;
    const arrival=roomArrival(destination,{fromRoom:from,direction:exit.dir,exits:destination.exits});
    assert.ok(arrival,`${from} ${exit.dir}`);assert.equal(arrival.matched,true);
    assert.ok(back.some(value=>value.dir===arrival.entrance));
    assert.equal(isBlocked(destination,arrival.x,arrival.y),false,`${from}→${exit.target}`);
    assert.ok(findPath(destination,arrival,destination.spawn).length,`${from}→${exit.target}落点须连通`);
  }
});

test('先按来源房间匹配，不能仅按反方向猜入口或新造出口',()=>{
  const scene={spawn:[120,120],obstacles:[],footprint:{rx:6,ry:3},walkablePolygons:[[[12,12],[220,12],[220,220],[12,220]]]},
    exits=[{dir:'e',target:'source',x:210,y:120,radius:17},{dir:'s',target:'other',x:120,y:210,radius:17}],before=structuredClone(exits);
  const arrival=roomArrival(scene,{fromRoom:'source',direction:'n',exits});
  assert.equal(arrival.entrance,'e');assert.ok(arrival.x>170);assert.equal(arrival.face,'left');
  assert.deepEqual(exits,before);
});

test('剧情运输保留专用落点，单向步行仅选择安全视觉入口而不创建返程',()=>{
  const scene=SCENES.meadow,exits=structuredClone(scene.exits);
  assert.equal(roomArrival(scene,{fromRoom:'wading',direction:'enter door',exits}),null);
  const arrival=roomArrival(scene,{fromRoom:'unlinked_room',direction:'e',exits});
  assert.ok(arrival);assert.equal(arrival.matched,false);assert.equal(isBlocked(scene,arrival.x,arrival.y),false);
  assert.deepEqual(exits,scene.exits);
});
