// Checks runtime references and visual reachability; does NOT certify original-game truth.
import assert from 'node:assert/strict';
import { isBlocked as blocked, isSegmentWalkable } from '../world.js';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { SCENES, SCENE_SCHEMA_VERSION, LOGICAL_SIZE } from '../scene-manifest.js';
import { GameState } from '../../js/engine.js';
import { ITEMS } from '../../js/data/items.js';
import { getHotspots } from '../interaction-catalog.js';
const chapters = ['prologue', 'wabe', 'japan', 'underground', 'orbit', 'pacific', 'tundra', 'islet', 'desert', 'ranch', 'finale'];
const modules = await Promise.all(chapters.map(id => import(`../../js/data/${id}.js`)));
const rooms = Object.assign({}, ...modules.map(module => module.ROOMS));
const ids = modules.flatMap(module => Object.keys(module.ROOMS));
assert.equal(new Set(ids).size, ids.length, '运行时房间 ID 重复');
function reachable(scene) {
  const seen = new Set(), queue = [scene.spawn];
  const key = (x,y) => `${Math.round(x)},${Math.round(y)}`;
  seen.add(key(...scene.spawn));
  for (let i=0;i<queue.length;i++) for (const [dx,dy] of [[6,0],[-6,0],[0,6],[0,-6]]) {
    const [x,y]=queue[i], nx=x+dx,ny=y+dy,id=key(nx,ny);
    if (!seen.has(id) && !blocked(scene,nx,ny) && isSegmentWalkable(scene,[x,y],[nx,ny])) { seen.add(id);queue.push([nx,ny]); }
  }
  return queue;
}
const objectIds = new Set();
for (const [id,scene] of Object.entries(SCENES)) {
  assert.ok(rooms[id], `未知房间 ${id}`);
  assert.equal(scene.roomId,id);
  assert.ok(existsSync(fileURLToPath(new URL(scene.background.image,new URL('../',import.meta.url)))), `${id} 美术缺失`);
  assert.ok(!blocked(scene,...scene.spawn),`${id} 出生点不可达`);
  const state=new GameState();state.room=id;state.chapter=scene.chapter;
  state.itemLoc=Object.fromEntries(Object.entries(ITEMS).filter(([,item])=>item.start).map(([key,item])=>[key,item.start]));
  assert.deepEqual(scene.objects,getHotspots(state),`${id} 场景热点与章节目录不同步`);
  const exits=rooms[id].exits(state), points=reachable(scene);
  for(const exit of scene.exits) {
    assert.equal(typeof exits[exit.dir]==='string'?exits[exit.dir]:exits[exit.dir]?.to,exit.target,`${id}.${exit.dir} 目标与运行时不符`);
    assert.ok(SCENES[exit.target],`${id} 目标没有视觉配置`);
    assert.ok(!blocked(SCENES[exit.target],...exit.spawn),`${id} 出口落点被阻挡`);
    assert.ok(reachable(SCENES[exit.target]).some(([x,y])=>Math.hypot(x-exit.spawn[0],y-exit.spawn[1])<=6),`${id} 出口落点不在目标可达区域`);
    assert.ok(points.some(([x,y])=>Math.hypot(x-exit.x,y-exit.y)<exit.radius),`${id} 出口无法走到`);
  }
  for(const object of scene.objects) {
    assert.ok(!objectIds.has(object.id),`重复互动 ID ${object.id}`);objectIds.add(object.id);
    if(object.eventId) assert.ok(rooms[id].events.some(event=>event.id===object.eventId),`${id} 事件缺失 ${object.eventId}`);
    if(object.itemId)assert.ok(ITEMS[object.itemId],`${id} 物品缺失`);
    assert.ok(points.some(([x,y])=>Math.hypot(x-object.x,y-object.y)<object.radius),`${id} 互动不可达 ${object.id}`);
  }
}
console.log(`场景协议 v${SCENE_SCHEMA_VERSION}：${Object.keys(SCENES).length} 场景、${objectIds.size} 热点；引用、出生点、${Object.values(SCENES).reduce((sum,scene)=>sum+scene.exits.length,0)} 条已绘制出口与互动可达检查通过。`);
console.log(`运行时清点：${chapters.length} 章、${ids.length} 房间。`);
console.log(chapters.map((id,i)=>`${id}: ${Object.keys(modules[i].ROOMS).length}`).join(' · '));
console.log('忠实性状态：本检查仅覆盖现有运行时结构与默认状态可达性，不验证原版地图/文本；序章差异见 PROLOGUE_PRODUCTION.md。Wabe Meadow 的现有 s/e/w 出口与已记录真机证据存在偏差，用户暂缓规则修正，本轮仅做2D表现适配。');
