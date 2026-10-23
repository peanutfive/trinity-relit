import test from 'node:test';
import assert from 'node:assert/strict';
import { SCENES } from '../scene-manifest.js';
import { isBlocked, isSegmentWalkable, nearestWalkable, findPath, approachingExit } from '../world.js';

const calibrated = ['palace_gate', 'broad_walk', 'flower_walk', 'round_pond'];

test('实景地面限制：池塘水面、花坛、门柱、雕像及长椅不能穿过', () => {
  assert.ok(isBlocked(SCENES.round_pond, 310, 125), '湖心水面不可行走');
  assert.ok(isBlocked(SCENES.round_pond, 420, 145), '湖面右侧不可行走');
  assert.ok(isBlocked(SCENES.round_pond, 352, 260), '南岸花境不可行走');
  assert.ok(isBlocked(SCENES.flower_walk, 320, 105), '上花坛不可行走');
  assert.ok(isBlocked(SCENES.flower_walk, 320, 210), '下花坛不可行走');
  assert.ok(isBlocked(SCENES.palace_gate, 186, 163), '门柱不可行走');
  assert.ok(isBlocked(SCENES.palace_gate, 152, 40), '宫殿建筑和植被不是地面');
  assert.ok(isBlocked(SCENES.broad_walk, 360, 158), '雕像基座不可行走');
  assert.ok(isBlocked(SCENES.broad_walk, 145, 153), '长椅不可穿过');
  assert.equal(isBlocked(SCENES.round_pond, 300, 205), false, '下岸步道可以行走');
  assert.equal(isBlocked(SCENES.flower_walk, 310, 150), false, '两花坛之间的地面可以接近足球');
});

test('脚底椭圆跨可走区域接缝，而不是用整张人物贴图碰撞', () => {
  const scene = {
    obstacles: [], footprint: { rx: 6, ry: 3 },
    walkablePolygons: [[[20, 20], [70, 20], [70, 100], [20, 100]], [[70, 20], [120, 20], [120, 100], [70, 100]]],
  };
  assert.equal(isBlocked(scene, 70, 60), false, '相邻区域的联合接缝可通行');
  assert.equal(isBlocked(scene, 24, 60), true, '中心在地上但脚已超出边界时应阻挡');
  assert.equal(isBlocked(scene, 26, 60), false);
  scene.obstacles = [{ x: 60, y: 40, w: 20, h: 20 }];
  assert.equal(isBlocked(scene, 54, 37), false, '椭圆角外不使用粗糙包围矩形误拦');
  assert.equal(isBlocked(scene, 56, 38), true, '椭圆实际接触障碍时阻挡');
});

test('宫殿门柱只阻挡基座，东向岔路可从门后宽松通过',()=>{
  const scene=SCENES.palace_gate;
  for(const y of [150,158,166])assert.equal(isSegmentWalkable(scene,[280,y],[450,y]),true,`东向通道y=${y}`);
  assert.equal(isBlocked(scene,306,224),true,'石柱实体基座仍占地');
  assert.equal(isBlocked(scene,306,158),false,'石柱上半部仅遮挡，不把后方路面封死');
});

test('花径旧落点位于西出口内时，按D向右远离出口不能退回宫殿门',()=>{
  const exit=SCENES.flower_walk.exits.find(value=>value.dir==='w');
  assert.equal(approachingExit(exit,{x:32,y:162},{x:32.8,y:162}),false);
  assert.equal(approachingExit(exit,{x:34,y:162},{x:32,y:162}),true);
  assert.equal(approachingExit(exit,{x:16,y:162},{x:17,y:162}),false);
  assert.equal(approachingExit(exit,{x:16,y:162},{x:15,y:162}),true);
});

test('所有方向的出口都不因远离或静止而自动切房',()=>{
  const vectors={n:[0,-1],ne:[1,-1],e:[1,0],se:[1,1],s:[0,1],sw:[-1,1],w:[-1,0],nw:[-1,-1],u:[0,-1],d:[0,1],in:[1,0],out:[-1,0]};
  for(const [dir,[dx,dy]]of Object.entries(vectors)){
    const exit={dir,x:240,y:150,radius:17},from={x:240-dx*8,y:150-dy*8};
    assert.equal(approachingExit(exit,from,{x:from.x-dx*.8,y:from.y-dy*.8}),false,`${dir}远离`);
    assert.equal(approachingExit(exit,from,{x:from.x+dx*.8,y:from.y+dy*.8}),true,`${dir}靠近`);
    assert.equal(approachingExit(exit,from,from),false,`${dir}静止`);
  }
});

test('按北直行不会被主路中段的东北/西北出口抢走',()=>{
  for(const [room,dir]of [['palace_gate','ne'],['broad_walk','ne'],['flower_walk','nw']]){
    const exit=SCENES[room].exits.find(value=>value.dir===dir);
    assert.equal(approachingExit(exit,{x:exit.x,y:exit.y+10},{x:exit.x,y:exit.y+8}),false,room);
    const dx=dir==='ne'?1:-1;
    assert.equal(approachingExit(exit,{x:exit.x-dx*8,y:exit.y+8},{x:exit.x-dx*7,y:exit.y+7}),true,`${room}明确斜向`);
  }
});

test('未校准场景保留旧边界与矩形膨胀行为', () => {
  const scene = { obstacles: [{ x: 100, y: 100, w: 20, h: 20 }] };
  assert.equal(isBlocked(scene, 94, 105), true);
  assert.equal(isBlocked(scene, 93, 105), false);
  assert.equal(isBlocked(scene, 12, 12), false);
  assert.equal(isBlocked(scene, 11, 12), true);
  assert.equal(isBlocked(scene, NaN, 100), true);
});

test('四个场景的出生点、所有出口和物件均可从合法地面接近', () => {
  for (const id of calibrated) {
    const scene = SCENES[id];
    assert.equal(isBlocked(scene, ...scene.spawn), false, `${id} 出生点`);
    for (const target of [...scene.exits, ...scene.objects]) {
      const safe = nearestWalkable(scene, [target.x, target.y], { from: scene.spawn });
      assert.ok(safe, `${id} ${target.id || target.dir}`);
      assert.ok(Math.hypot(safe.x - target.x, safe.y - target.y) < target.radius, `${id} ${target.id || target.dir} 未达到互动距离`);
      const path = findPath(scene, scene.spawn, safe);
      assert.ok(path.length >= 1, `${id} ${target.id || target.dir} 没有地面路径`);
      for (let step = 1; step < path.length; step++) assert.ok(isSegmentWalkable(scene, path[step - 1], path[step]));
    }
  }
});

test('圆池塘点击寻路沿岸绕行，不跨水面或切过角落', () => {
  const scene = SCENES.round_pond;
  const from = [240, 16], to = [465, 211];
  assert.equal(isSegmentWalkable(scene, from, to), false, '两端之间直线会穿过水面');
  const path = findPath(scene, from, to);
  assert.ok(path.length > 2, '必须有沿岸转折');
  assert.deepEqual(path[0], from);
  assert.deepEqual(path.at(-1), to);
  for (let step = 1; step < path.length; step++) assert.ok(isSegmentWalkable(scene, path[step - 1], path[step]));
  assert.deepEqual(findPath(scene, from, [320, 125]), [], '不可走目标默认不创建路径');
  const bank = nearestWalkable(scene, 300, 176, { from: scene.spawn });
  assert.ok(bank && Math.hypot(bank.x - 300, bank.y - 176) < 37, '岸边即可接近纸鸟');
  assert.equal(isBlocked(scene, bank.x, bank.y), false);
});

test('圆池塘北岸按素材可走到右上东北小径，不借左上文字箭头传送',()=>{
  const scene=SCENES.round_pond,path=[[236,36],[272,36],[315,37],[355,38],[394,40],[418,36],[425,22]];
  for(let i=0;i<path.length;i++){
    assert.equal(isBlocked(scene,...path[i]),false,`北岸${path[i]}`);
    if(i)assert.equal(isSegmentWalkable(scene,path[i-1],path[i]),true,`北岸连续段${i}`);
  }
  const exit=scene.exits.find(value=>value.dir==='ne');
  assert.deepEqual([exit.x,exit.y],[425,22]);
  assert.ok(findPath(scene,scene.spawn,[exit.x,exit.y]).length>2);
  assert.equal(isBlocked(scene,355,60),true,'下方池水仍禁止行走');
});

test('圆池塘左上弯道用连续带宽接合，不靠尖角拼接勉强绕行',()=>{
  const path=[[100,160],[90,140],[76,120],[80,99],[100,87],[122,75],[150,63],[180,52],[211,43],[240,35]];
  for(let index=1;index<path.length;index++)assert.equal(isSegmentWalkable(SCENES.round_pond,path[index-1],path[index]),true,`弯道${index}`);
  assert.equal(isBlocked(SCENES.round_pond,92,84),false,'接缝不再出现碎片化站立孤点');
});

test('独立地面岛屿不可达，最近地面可受当前连通分量约束', () => {
  const scene = {
    obstacles: [], footprint: { rx: 4, ry: 2 },
    walkablePolygons: [[[20, 20], [100, 20], [100, 100], [20, 100]], [[200, 20], [280, 20], [280, 100], [200, 100]]],
  };
  assert.deepEqual(findPath(scene, [60, 60], [240, 60]), []);
  const nearest = nearestWalkable(scene, [240, 60], { from: [60, 60] });
  assert.ok(nearest.x < 100, '不吸附到玩家无法抵达的另一片地面');
});
