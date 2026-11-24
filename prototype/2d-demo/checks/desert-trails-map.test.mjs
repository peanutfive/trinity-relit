import test from 'node:test';
import assert from 'node:assert/strict';
import {ROOMS} from '../../js/data/desert.js';
import {buildChapterMap} from '../chapter-map.js';
import {illustratedMapNodes, chartConnection} from '../map-geography.js';
import {terrainMarkup} from '../chapter-map-art.js';

const desertIds = Array.from({length:9}, (_,index) => 'desert_' + (index + 1));
const foothillIds = ['foothills_1', 'foothills_2', 'foothills_3'];
const roadIds = Array.from({length:6}, (_,index) => 'paved_road_' + (index + 1));
const rooms = [...desertIds, 'shallow_crater', ...foothillIds];
const scenes = Object.fromEntries([...rooms,...roadIds].map(id => [id,{chapter:'desert'}]));
function chart(visited) {
  const state = {chapter:'desert',room:'shallow_crater',visited};
  const model = buildChapterMap({state,rooms:ROOMS,scenes});
  return {model,nodes:illustratedMapNodes(model)};
}

test('沙漠地形逐地揭名，东西沙路与南北山麓保留方向，折向支路作为示意', () => {
  const {model,nodes} = chart(rooms);
  const at = Object.fromEntries(nodes.map(node => [node.id,node]));
  assert.equal(nodes.length,13);
  const first = chart(['shallow_crater']);
  assert.equal(first.nodes.length,1);
  assert.deepEqual([first.nodes[0].x,first.nodes[0].y],[at.shallow_crater.x,at.shallow_crater.y]);
  assert.equal(first.model.edges.length,0);
  assert.match(terrainMarkup('desert','map-test',first.nodes),/map-desert-foothills/);

  const westToEast = [...desertIds.slice(0,5),'shallow_crater',...desertIds.slice(5)];
  for (let i=1;i<westToEast.length;i++) assert.ok(at[westToEast[i-1]].x < at[westToEast[i]].x);
  assert.ok(at.foothills_1.y < at.foothills_2.y && at.foothills_2.y < at.foothills_3.y);
  for (const edge of model.edges) {
    const folded = [edge.from,edge.to].some(id => ['foothills_2','foothills_3'].includes(id))
      && [edge.from,edge.to].some(id => ['desert_4','desert_7'].includes(id));
    const connection = chartConnection(edge,nodes,'desert',model.edges);
    assert.equal(connection.schematic,folded,edge.id);
  }
});

test('六段公路依次向北，三处山麓连接按各自实际出口与地图方位绘制', () => {
  const {model,nodes} = chart([...rooms,...roadIds]);
  assert.equal(nodes.length,19);
  const edgesFrom = (from,to) => model.edges.filter(edge => edge.from===from && edge.to===to);
  const at = Object.fromEntries(nodes.map(node => [node.id,node]));
  for (const [index,id] of roadIds.entries()) {
    if (index === 0) continue;
    const south = roadIds[index-1];
    assert.ok(at[south].y > at[id].y);
    const [northlink] = edgesFrom(south,id);
    assert.equal(northlink.direction,'n');
    assert.ok(chartConnection(northlink,nodes,'desert',model.edges).road);
  }
  for (const [index,road] of ['paved_road_2','paved_road_4','paved_road_5'].entries()) {
    const foothill = foothillIds[index];
    const [east] = edgesFrom(road,foothill), [west] = edgesFrom(foothill,road);
    assert.equal(east.direction,'e');
    assert.equal(west.direction,'w');
    for (const edge of [east,west]) {
      assert.equal(chartConnection(edge,nodes,'desert',model.edges).road,index===1);
    }
  }
});
