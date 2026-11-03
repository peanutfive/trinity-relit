import test from 'node:test';
import assert from 'node:assert/strict';
import {buildChapterMap} from '../chapter-map.js';
import {illustratedMapNodes,chartConnection} from '../map-geography.js';
import {terrainMarkup} from '../chapter-map-art.js';
import {SCENES} from '../scene-manifest.js';
import {ROOMS} from '../../js/data/pacific.js';
const state=visited=>({room:'mesa',chapter:'pacific',visited,flags:[],itemLoc:{},counters:{},sundialSymbol:4});

test('太平洋初见已有岛岸与工棚轮廓，只揭示已到地点，台地不画进海岛',()=>{
  const start=buildChapterMap({state:state(['mesa']),scenes:SCENES});
  const full=buildChapterMap({state:state(Object.keys(ROOMS)),scenes:SCENES});
  assert.equal(start.chapterLabel,'太平洋小岛');assert.equal(start.nodes.length,1);
  const first=illustratedMapNodes(start),all=illustratedMapNodes(full);
  assert.deepEqual(first.map(({id,x,y})=>({id,x,y})),all.filter(n=>n.id==='mesa').map(({id,x,y})=>({id,x,y})));
  const terrain=terrainMarkup('pacific','pacific-test',first);
  assert.match(terrain,/map-pacific-chart/);assert.doesNotMatch(terrain,/map-orbit-chart/);
  for(const room of Object.values(ROOMS)){assert.equal(terrain.includes(room.cn),false);assert.equal(terrain.includes(room.name),false);}
  assert.ok(first[0].x<250,'原版Wabe石台与海岛分开');
  assert.ok(all.find(n=>n.id==='scaffold').y<all.find(n=>n.id==='bottom_scaffold').y);
  for(let i=0;i<all.length;i++)for(let j=i+1;j<all.length;j++)assert.ok(Math.abs(all[i].x-all[j].x)>145||Math.abs(all[i].y-all[j].y)>75);
  for(const edge of full.edges)assert.equal(chartConnection(edge,all,'pacific',full.edges).road,false,'当前别名/高低连接保持示意，不伪装成平面实际道路');
});
