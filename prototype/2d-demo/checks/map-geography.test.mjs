import test from 'node:test';
import assert from 'node:assert/strict';
import { buildChapterMap } from '../chapter-map.js';
import { illustratedMapNodes, chartConnection, chartRoadPath } from '../map-geography.js';
import { terrainMarkup } from '../chapter-map-art.js';
import { ROOMS } from '../../js/data/prologue.js';
import { SCENES } from '../scene-manifest.js';

const input=visited=>({state:{room:'palace_gate',chapter:'prologue',visited,flags:[],counters:{},itemLoc:{}},rooms:ROOMS,scenes:SCENES});

test('新档已有地形轮廓，探索只增加地点标记，不会移动已知地点或披露其他名称',()=>{
  const first=buildChapterMap(input(['palace_gate'])),full=buildChapterMap(input(Object.keys(ROOMS)));
  const start=illustratedMapNodes(first),all=illustratedMapNodes(full);
  assert.equal(start.length,1);assert.equal(start[0].cn,'宫殿门');
  assert.deepEqual(start.map(({id,x,y})=>({id,x,y})),all.filter(node=>node.id==='palace_gate').map(({id,x,y})=>({id,x,y})));
  const terrain=terrainMarkup('prologue','fixture',start);
  assert.ok(terrain.includes('map-landscape'));assert.ok(terrain.includes('fixture-water'));assert.ok(terrain.includes('map-mist'));
  for(const room of Object.values(ROOMS)){assert.equal(terrain.includes(room.cn),false);assert.equal(terrain.includes(room.name),false);}
  assert.equal(first.nodes.some(node=>node.id==='round_pond'),false);
});

test('地图的地理绘制只读真实连线，不因地形底稿补造路线',()=>{
  const model=buildChapterMap(input(Object.keys(ROOMS))),before=JSON.stringify(model),nodes=illustratedMapNodes(model);
  for(const edge of model.edges){const connection=chartConnection(edge,nodes,'prologue',model.edges);assert.ok(connection);chartRoadPath(connection.from,connection.to,'prologue');}
  assert.equal(JSON.stringify(model),before);
  assert.equal(chartConnection({from:'palace_gate',to:'unvisited',direction:'e'},nodes,'prologue',[]),null);
  const oneWay={from:'palace_gate',to:'flower_walk',direction:'e'};
  assert.equal(chartConnection(oneWay,nodes,'prologue',[oneWay]).road,false,'未核实反向关系的连接不能画成普通道路');
});

test('异常方位、高低、异境连接保持虚线示意，不能用绘图位置掩盖原版方位',()=>{
  const nodes=[{id:'a',x:100,y:100},{id:'b',x:100,y:200}],south={from:'a',to:'b',direction:'s'},north={from:'b',to:'a',direction:'n'};
  assert.equal(chartConnection(south,nodes,'prologue',[south,north]).road,true);
  assert.equal(chartConnection({...south,direction:'w'},nodes,'prologue',[south,north]).schematic,true);
  assert.equal(chartConnection({...south,direction:'u'},nodes,'prologue',[south,north]).schematic,true);
  assert.equal(chartConnection(south,nodes,'wabe',[south,north]).schematic,true);
});

test('完整序章标记与名称保持可辨间距，圆池塘各入口沿岸绘制',()=>{
  const model=buildChapterMap(input(Object.keys(ROOMS))),nodes=illustratedMapNodes(model);
  for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++){
    const a=nodes[i],b=nodes[j];assert.ok(Math.abs(a.x-b.x)>145||Math.abs(a.y-b.y)>75,`${a.id}/${b.id}标记与名称过近`);
  }
  const pond=nodes.find(node=>node.id==='round_pond'),terrace=nodes.find(node=>node.id==='inverness_terrace');
  const route=chartRoadPath(pond,terrace,'prologue');
  assert.ok(route.includes(' C '),'南岸到北路必须沿岸转弯，不能画成穿越池水的直线');
});
