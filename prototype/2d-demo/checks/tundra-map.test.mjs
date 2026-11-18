import test from 'node:test';
import assert from 'node:assert/strict';
import {buildChapterMap} from '../chapter-map.js';
import {illustratedMapNodes,chartConnection} from '../map-geography.js';
import {terrainMarkup} from '../chapter-map-art.js';
import {SCENES} from '../scene-manifest.js';
import {ROOMS} from '../../js/data/tundra.js';
import {filterVisualPresence} from '../visual-text-policy.js';
import {GameState} from '../../js/engine.js';

test('冻原地图以方位区分八同名区域，位置稳定，平台高低示意不伪造平面道路',()=>{
 const state=visited=>({room:'tundra_1',chapter:'tundra',visited,flags:[],counters:{},itemLoc:{}});
 const one=buildChapterMap({state:state(['tundra_1']),scenes:SCENES}),full=buildChapterMap({state:state(Object.keys(ROOMS)),scenes:SCENES});
 assert.equal(one.nodes.length,1);assert.equal(full.nodes.length,11);assert.equal(one.chapterLabel,'北极冻原');
 const nodes=illustratedMapNodes(full),first=illustratedMapNodes(one)[0],same=nodes.find(n=>n.id===first.id);
 assert.deepEqual([first.x,first.y],[same.x,same.y]);assert.equal(new Set(nodes.map(n=>n.cn)).size,11);
 for(const node of nodes){assert.equal(node.name,ROOMS[node.id].name);assert.ok(node.visual);}
 for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++)assert.ok(Math.abs(nodes[i].x-nodes[j].x)>145||Math.abs(nodes[i].y-nodes[j].y)>75);
 const terrain=terrainMarkup('tundra','tundra-fixture',nodes);assert.match(terrain,/map-tundra-chart/);
 for(const node of nodes)assert.equal(terrain.includes(node.cn),false,'地形底稿不泄露地点标记');
 for(const edge of full.edges)assert.equal(chartConnection(edge,nodes,'tundra',full.edges).schematic,true);
});

test('裂缝自动文案不点名隐藏旅鼠，主动查看与声音线索保留，显示层不改原章',()=>{
 const state=new GameState();state.room='cliff_edge';state.placeItem('lemming','cliff_edge');
 const original=ROOMS.cliff_edge.desc(state),before=state.serialize(),objects=[{kind:'tundra_fissure'}];
 const view=filterVisualPresence(original,{room:state.room,objects,source:'room'});
 assert.doesNotMatch(view.text,/lemming|旅鼠/);assert.match(view.text,/北冰洋/);
 assert.equal(filterVisualPresence(original,{room:state.room,objects,source:'event'}).text,original);
 assert.deepEqual(state.serialize(),before);
});
