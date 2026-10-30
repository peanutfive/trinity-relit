import test from 'node:test';
import assert from 'node:assert/strict';
import {findPath, nearestWalkable, isSegmentWalkable, isBlocked} from '../world.js';

const rectangle = (x,y,w,h) => [[x,y],[x+w,y],[x+w,y+h],[x,y+h]];
function detour() {
  return {walkablePolygons:[rectangle(20,20,200,180)], blockedPolygons:[],
    obstacles:[{x:110,y:20,w:12,h:110}],footprint:{rx:2,ry:1},pathResolution:.25};
}
function bridge() {
  return {walkablePolygons:[rectangle(20,20,70,100),rectangle(130,20,70,100),rectangle(80,55,60,10)],
    blockedPolygons:[],obstacles:[],footprint:{rx:2,ry:2},pathResolution:.1};
}
function verifyPath(scene,path) {
  assert.ok(path.length >= 2);
  for (let index=1;index<path.length;index++) {
    assert.equal(isSegmentWalkable(scene,path[index-1],path[index]),true);
  }
}
function observed(scene) {
  let reads=0;
  const polygons=scene.walkablePolygons;
  Object.defineProperty(scene,'walkablePolygons',{enumerable:true,get(){reads++;return polygons;}});
  return {scene,reset(){reads=0;},get reads(){return reads;}};
}

test('等价场景包装复用寻路工作，仍逐段通过同一脚底/精度检查',()=>{
  const watch=observed(detour()),from=[50,65],target=[185,65];
  const query=scene=>{
    const destination=nearestWalkable(scene,target,{from});
    return findPath(scene,from,destination);
  };
  const first=query(watch.scene),coldReads=watch.reads;
  verifyPath(watch.scene,first);
  watch.reset();
  // Preserve accessor instrumentation while changing object identity, as the
  // runtime does when composing the same static scene and dynamic obstacles.
  const clone=Object.create(Object.getPrototypeOf(watch.scene),Object.getOwnPropertyDescriptors(watch.scene));
  const again=query(clone),warmReads=watch.reads;
  assert.deepEqual(again,first);
  assert.ok(coldReads>warmReads*5,`collision reads ${coldReads} -> ${warmReads}`);
  verifyPath(clone,again);
  assert.deepEqual(clone.obstacles,[{x:110,y:20,w:12,h:110}],'queries must not edit geometry');
});

test('目标在独立岛屿时只吸附当前连通地面，不把缓存当作跨岛道路',()=>{
  const scene={walkablePolygons:[rectangle(20,20,80,80),rectangle(200,20,80,80)],
    blockedPolygons:[],obstacles:[],footprint:{rx:2,ry:1},pathResolution:.1};
  for(const wrapped of [scene,{...scene},{...scene}]) {
    assert.deepEqual(findPath(wrapped,[60,60],[240,60]),[]);
    assert.ok(nearestWalkable(wrapped,[240,60],{from:[60,60]}).x<100);
    assert.ok(nearestWalkable(wrapped,[60,60],{from:[240,60]}).x>200);
  }
  for(const target of [[233.1,61.1],[233.2,61.2],[240,85],[240,32]]) {
    const nearest=nearestWalkable(scene,target,{from:[60,60]});
    assert.ok(nearest.x<100);
    let expectedDistance=Infinity;
    for(let y=12;y<=276;y+=4)for(let x=12;x<100;x+=4)if(!isBlocked(scene,x,y)) {
      expectedDistance=Math.min(expectedDistance,(x-target[0])**2+(y-target[1])**2);
    }
    assert.equal((nearest.x-target[0])**2+(nearest.y-target[1])**2,expectedDistance,
      'a cached exhausted component must choose against each exact target');
  }
});

test('原地改变障碍与禁行多边形后失效，恢复旧几何不会读取被修改的旧引用',()=>{
  const scene=detour(),original=structuredClone(scene),from=[50,65],target=[185,65];
  verifyPath(scene,findPath(scene,from,target));
  scene.obstacles[0].h=180;
  assert.deepEqual(findPath(scene,from,target),[],'full wall must invalidate cached edges/search');
  assert.ok(nearestWalkable(scene,target,{from}).x<110);
  verifyPath(original,findPath(original,from,target),'old structural key is still valid');
  scene.obstacles=[];
  scene.blockedPolygons.push(rectangle(110,20,12,180));
  assert.deepEqual(findPath(scene,from,target),[]);
  scene.blockedPolygons[0][1][0]=115;
  scene.blockedPolygons[0][2][0]=115;
  assert.deepEqual(findPath(scene,from,target),[]);
  scene.blockedPolygons=[];
  verifyPath(scene,findPath(scene,from,target));
});

test('窄桥脚底与地面多边形原地修改不会沿用旧的可通结果',()=>{
  const scene=bridge(),original=structuredClone(scene),from=[50,60],target=[170,60];
  assert.ok(nearestWalkable(scene,target,{from}).x>130);
  verifyPath(scene,findPath(scene,from,target));
  scene.footprint.ry=6;
  assert.ok(nearestWalkable(scene,target,{from}).x<90);
  assert.deepEqual(findPath(scene,from,target),[]);
  scene.footprint.ry=2;
  scene.walkablePolygons[2][2][1]=58;
  scene.walkablePolygons[2][3][1]=58;
  assert.ok(nearestWalkable(scene,target,{from}).x<90);
  assert.deepEqual(findPath(scene,from,target),[],'foot extends beyond the altered bridge');
  verifyPath(original,findPath(original,from,target),'compiled old bounds/vertices stay independent');
});

test('多接地点和其独立脚底的改变均参与缓存键，推行不能把轮脚留在桥外',()=>{
  const scene=bridge(),from=[50,60],target=[170,60];
  scene.contactOffsets=[{x:0,y:0,footprint:{rx:2,ry:2}},{x:0,y:0,footprint:{rx:2,ry:2}}];
  assert.ok(nearestWalkable(scene,target,{from}).x>130);
  verifyPath(scene,findPath(scene,from,target));
  scene.contactOffsets[1].y=10;
  assert.ok(nearestWalkable(scene,target,{from}).x<90);
  assert.deepEqual(findPath(scene,from,target),[]);
  scene.contactOffsets[1].y=0;
  scene.contactOffsets[1].footprint.ry=6;
  assert.ok(nearestWalkable(scene,target,{from}).x<90);
  assert.deepEqual(findPath(scene,from,target),[]);
  scene.contactOffsets[1].footprint.ry=2;
  verifyPath(scene,findPath(scene,from,target));
});

test('缓存路径按精确终点收尾，编译地面与后续原地编辑隔离且兼容空多边形',()=>{
  const scene=detour(),original=structuredClone(scene),from=[50,65];
  for(const target of [[185,65],[185.1,65.1]]) {
    const path=findPath(scene,from,target);
    verifyPath(scene,path);
    assert.deepEqual(path.at(-1),target,'two exact targets may share the nearest grid node');
  }
  scene.walkablePolygons[0][1][0]=100;
  scene.walkablePolygons[0][2][0]=100;
  assert.deepEqual(findPath(scene,from,[185,65]),[]);
  verifyPath(original,findPath(original,from,[185,65]),'old geometry cache contains a vertex snapshot');
  const legacy={obstacles:[{x:100,y:20,w:10,h:100}],walkablePolygons:null,blockedPolygons:null};
  verifyPath(legacy,findPath(legacy,[40,60],[180,60]));
  assert.ok(nearestWalkable(legacy,[180,60],{from:[40,60]}));
});

test('连续采样精度改变必须重测细障碍，网格端点不能代替路段碰撞',()=>{
  const scene={walkablePolygons:[rectangle(20,20,180,80)],blockedPolygons:[],
    obstacles:[{x:101.9,y:20,w:.05,h:80}],footprint:{rx:.001,ry:.001},pathResolution:2};
  const from=[40,60],target=[180,60];
  assert.equal(isSegmentWalkable(scene,from,target),true,'coarse historical sampling misses this thin strip');
  verifyPath(scene,findPath(scene,from,target));
  scene.pathResolution=.05;
  assert.equal(isSegmentWalkable(scene,from,target),false);
  assert.deepEqual(findPath(scene,from,target),[],'same grid nodes with finer segment sampling cannot cross');
  assert.equal(isBlocked(scene,101.92,60),true);
});

test('几何缓存有容量上限，旧场景被淘汰后仍能重新正确构建',()=>{
  const watch=observed(detour()),from=[50,65],target=[185,65];
  nearestWalkable(watch.scene,target,{from});
  watch.reset(); nearestWalkable(watch.scene,target,{from});
  const warmReads=watch.reads;
  for(let index=0;index<28;index++) {
    const next=detour();next.obstacles[0].w=13+index/10;
    nearestWalkable(next,target,{from});
  }
  watch.reset();
  const rebuilt=nearestWalkable(watch.scene,target,{from});
  assert.ok(watch.reads>warmReads*5,'evicted geometry must rebuild rather than retain all actor variants forever');
  assert.ok(rebuilt&&rebuilt.x>122);
  verifyPath(watch.scene,findPath(watch.scene,from,rebuilt));
});
