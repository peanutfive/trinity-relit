import test from 'node:test';
import assert from 'node:assert/strict';
import {buildChapterMap} from '../chapter-map.js';
import {illustratedMapNodes,chartConnection,chartRoadPath,MAP_SIZE} from '../map-geography.js';
import {terrainMarkup,mapIconPath} from '../chapter-map-art.js';
import {ROOMS as WABE_ROOMS} from '../../js/data/wabe.js';
import {ROOMS as ORBIT_ROOMS} from '../../js/data/orbit.js';

const arbor=['trellises','arboretum','top_of_arbor','north_arbor','south_arbor','arborvitaes_n','arborvitaes_s','waterfall'];
const orbit=Object.keys(ORBIT_ROOMS);
const scenes=Object.fromEntries([...arbor,...orbit].map(id=>[id,{chapter:orbit.includes(id)?'orbit':'wabe'}]));
const state=(room,visited=[room])=>({room,visited,chapter:orbit.includes(room)?'orbit':'wabe',
  flags:[],counters:{turns:17},timers:[],itemLoc:{axe:'inventory',soap_bubble:'inventory'},flipped:false,sundialSymbol:3});

test('轨道地图默认识别章节归属，单次到达不披露另一视点或未探索章节',()=>{
  const progress=state('orbit_satellite'),before=structuredClone(progress);
  const map=buildChapterMap({state:progress,scenes}),nodes=illustratedMapNodes(map);
  assert.equal(map.chapter,'orbit');assert.equal(map.chapterLabel,'地球轨道');
  assert.deepEqual(map.chapters.map(chapter=>chapter.id),['orbit']);
  assert.deepEqual(nodes.map(node=>node.id),['orbit_satellite']);assert.equal(nodes[0].cn,ORBIT_ROOMS.orbit_satellite.cn);
  assert.equal(JSON.stringify(map).includes('orbit_space'),false);assert.deepEqual(map.edges,[]);
  const plate=terrainMarkup('orbit','first',nodes);
  assert.ok(plate.includes('map-orbit-chart'));assert.ok(plate.includes('first-planet'));
  for(const room of Object.values(ORBIT_ROOMS)){assert.equal(plate.includes(room.name),false);assert.equal(plate.includes(room.cn),false);}
  assert.deepEqual(progress,before);
});

test('轨道两个视点保留全部方向及来源，按章隔离瀑布，读图不执行破泡或磁吸',()=>{
  const progress=state('orbit_space',[...orbit,'waterfall']),before=structuredClone(progress);
  const map=buildChapterMap({state:progress,scenes}),nodes=illustratedMapNodes(map);
  assert.deepEqual(map.nodes.map(node=>node.id),['orbit_satellite','orbit_space']);
  assert.deepEqual(map.chapters.map(chapter=>chapter.id),['orbit','wabe']);
  assert.equal(map.edges.length,22);assert.ok(map.edges.every(edge=>orbit.includes(edge.from)&&orbit.includes(edge.to)));
  assert.deepEqual(map.nodes.find(node=>node.id==='orbit_satellite').exits.map(exit=>exit.direction),['n','ne','e','se','s','sw','w','nw','u','d','in']);
  assert.deepEqual(map.nodes.find(node=>node.id==='orbit_space').exits.map(exit=>exit.direction),['n','ne','e','se','s','sw','w','nw','u','d','out']);
  for(const edge of map.edges){const link=chartConnection(edge,nodes,'orbit',map.edges);assert.equal(link.road,false);assert.equal(link.schematic,true);}
  assert.deepEqual(progress,before);assert.equal(progress.itemLoc.soap_bubble,'inventory');
  const wabe=buildChapterMap({state:progress,scenes,chapter:'wabe'});
  assert.deepEqual(wabe.nodes.map(node=>node.id),['waterfall']);assert.deepEqual(wabe.edges,[]);
});

test('轨道标记固定在地球弧面上方，多方向只共用漂行弧线，不画成地面道路',()=>{
  const full=buildChapterMap({state:state('orbit_space',orbit),scenes}),nodes=illustratedMapNodes(full);
  const first=illustratedMapNodes(buildChapterMap({state:state('orbit_satellite'),scenes}))[0];
  assert.deepEqual(nodes.find(node=>node.id===first.id),{...first,current:false,exits:full.nodes.find(node=>node.id===first.id).exits});
  for(const node of nodes){assert.ok(node.x>100&&node.x<MAP_SIZE.width-100);assert.ok(node.y>80&&node.y<350);}
  assert.notEqual(nodes[0].icon,nodes[1].icon);assert.notEqual(mapIconPath('satellite'),mapIconPath('place'));
  const curve=chartRoadPath(nodes[0],nodes[1],'orbit');assert.ok(curve.includes(' C '));assert.equal(chartRoadPath(nodes[1],nodes[0],'orbit'),curve);
  const plate=terrainMarkup('orbit','orbit<script>',nodes);
  assert.equal(plate.includes('<script>'),false);assert.ok(plate.includes('orbit-script-planet')===false);
  assert.ok(plate.includes('orbitscript-planet'));assert.equal(plate.includes('map-road'),false);assert.equal(plate.includes('>北</text>'),false);
});

test('藤架翻转只切换真实植物园东西出口，不执行顶部出口动作或补造侧面道路',()=>{
  const progress=state('arboretum',[...arbor,'palace_gate']),before=structuredClone(progress);
  const plain=buildChapterMap({state:progress,scenes}),a=plain.nodes.find(node=>node.id==='arboretum');
  assert.deepEqual(a.exits.map(exit=>[exit.direction,exit.to]),[['e','arborvitaes_n'],['w','arborvitaes_s']]);
  assert.deepEqual(plain.nodes.find(node=>node.id==='north_arbor').exits.map(exit=>[exit.direction,exit.to]),[['s','top_of_arbor']]);
  assert.deepEqual(plain.nodes.find(node=>node.id==='south_arbor').exits.map(exit=>[exit.direction,exit.to]),[['n','top_of_arbor']]);
  assert.deepEqual(progress,before,'地图不得执行顶部出口 act 来改变 flipped');
  progress.flipped=true;const flippedBefore=structuredClone(progress),flipped=buildChapterMap({state:progress,scenes});
  assert.deepEqual(flipped.nodes.find(node=>node.id==='arboretum').exits.map(exit=>[exit.direction,exit.to]),[['e','arborvitaes_s'],['w','arborvitaes_n']]);
  assert.deepEqual(progress,flippedBefore);assert.equal(flipped.nodes.length,arbor.length);
  const positions=model=>illustratedMapNodes(model).map(({id,x,y})=>({id,x,y}));assert.deepEqual(positions(plain),positions(flipped));
  assert.ok(flipped.edges.every(edge=>edge.to!=='palace_gate'&&edge.from!=='palace_gate'));
});

test('新增藤架地点有独立标记间距与真实名称，静态底稿不泄露未来地点',()=>{
  const model=buildChapterMap({state:state('arboretum',arbor),scenes}),nodes=illustratedMapNodes(model);
  assert.equal(nodes.length,arbor.length);assert.ok(nodes.every(node=>node.cn===WABE_ROOMS[node.id].cn));
  for(const node of nodes){assert.ok(node.x>30&&node.x<MAP_SIZE.width-30);assert.ok(node.y>50&&node.y+40<MAP_SIZE.height);}
  for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++){
    const a=nodes[i],b=nodes[j];assert.ok(Math.abs(a.x-b.x)>105||Math.abs(a.y-b.y)>65,`${a.id}/${b.id} 标记过近`);
  }
  const plate=terrainMarkup('wabe','arbor',nodes);
  for(const room of Object.values(WABE_ROOMS)){assert.equal(plate.includes(room.cn),false);assert.equal(plate.includes(room.name),false);}
  assert.deepEqual(model.warnings,[]);
});
