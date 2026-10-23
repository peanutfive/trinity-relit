import test from 'node:test';
import assert from 'node:assert/strict';
import { GameState } from '../../js/engine.js';
import { createPrologueSession } from '../engine-adapter.js';
import { SCENES } from '../scene-manifest.js';
import { ROOMS as PROLOGUE_ROOMS } from '../../js/data/prologue.js';
import { buildChapterMap, layoutChapterMap } from '../chapter-map.js';

function fixture(){
  const state=new GameState();state.room='a';state.chapter='one';state.visited=new Set(['a','b']);
  const rooms={
    a:{chapter:'one',cn:'甲地',name:'Palace Gate',exits:()=>({n:'b',e:'secret'})},
    b:{chapter:'one',cn:'乙地',name:'Broad Walk',exits:()=>({e:'a'})},
    secret:{chapter:'one',cn:'未发现剧情名',name:'Secret',exits:()=>({w:'a'})},
    c:{chapter:'two',cn:'另章',name:'Meadow',exits:()=>({out:'a'})},
  };
  const scenes=Object.fromEntries(Object.entries(rooms).map(([id,room])=>[id,{chapter:room.chapter,label:room.cn}]));
  const input={state,rooms,scenes,chapterRooms:{}};
  return {state,rooms,scenes,input};
}

test('严格只显示visited与当前房间，不泄露未访问节点、名字、出口或总数量',()=>{
  const {state,rooms,input}=fixture();let hiddenRead=0;
  rooms.secret.exits=()=>{hiddenRead++;throw new Error('不应读取');};
  const map=buildChapterMap(input);
  assert.deepEqual(map.nodes.map(node=>node.id),['a','b']);
  assert.equal(map.nodes.find(node=>node.id==='a').current,true);
  assert.equal(map.edges.length,2);
  assert.equal(JSON.stringify(map).includes('secret'),false);
  assert.equal(JSON.stringify(map).includes('未发现剧情名'),false);
  assert.equal(hiddenRead,0);
  state.visited=new Set(['b']);
  assert.ok(buildChapterMap(input).nodes.some(node=>node.id==='a'),'当前房间即使未进入visited也必须显示');
});

test('条件出口用真实flags/items/counters求值，只读when，不执行出口act或房间描述',()=>{
  const {state,rooms,input}=fixture();let acted=0;
  rooms.a.desc=()=>{throw new Error('不得读取剧情');};
  rooms.a.onEnter=()=>{throw new Error('不得进入');};
  rooms.a.exits=s=>({n:{to:'b',when:q=>q.hasFlag('gate')&&q.has('coin')&&q.cnt('key')===2,
    act:()=>acted++,text:()=>{throw new Error('不得输出剧情');}}});
  assert.equal(buildChapterMap(input).edges.some(edge=>edge.from==='a'),false);
  state.setFlag('gate');state.itemLoc.coin='inventory';state.setCnt('key',2);
  const before=state.serialize(),map=buildChapterMap(input);
  assert.ok(map.edges.some(edge=>edge.from==='a'&&edge.direction==='n'&&edge.to==='b'));
  assert.equal(acted,0);assert.deepEqual(state.serialize(),before);
});

test('每间房间拥有独立只读room视图，过去房间inRoom条件不会错误读取当前房间',()=>{
  const {state,rooms,input}=fixture();state.itemLoc.marker='b';
  rooms.b.exits=s=>({s:{to:'a',when:q=>q.room==='b'&&q.inRoom('marker')}});
  assert.ok(buildChapterMap(input).edges.some(edge=>edge.from==='b'&&edge.direction==='s'));
  assert.equal(state.room,'a');
});

test('非对称边与同两房间的多方向边原样保留，不补反方向或抹平方向差异',()=>{
  const {rooms,input}=fixture();rooms.a.exits=()=>({n:'b',ne:'b'});rooms.b.exits=()=>({e:'a'});
  const map=buildChapterMap(input);
  assert.deepEqual(map.edges.map(edge=>[edge.from,edge.direction,edge.to]),[['a','n','b'],['a','ne','b'],['b','e','a']]);
  assert.equal(map.edges.some(edge=>edge.from==='b'&&edge.direction==='s'),false);
  assert.deepEqual(map.nodes.find(node=>node.id==='a').exits.map(exit=>exit.label),['北','东北']);
});

test('按章节分图，选项只含已探索章节；跨章出口不会接到另一章节点',()=>{
  const {state,rooms,input}=fixture();
  rooms.a.exits=()=>({n:'b',in:'c'});
  assert.deepEqual(buildChapterMap(input).chapters.map(chapter=>chapter.id),['one']);
  assert.equal(buildChapterMap({...input,chapter:'two'}).chapter,'one','未发现章节不可选择');
  state.visited.add('c');
  const first=buildChapterMap(input),second=buildChapterMap({...input,chapter:'two'});
  assert.deepEqual(first.chapters.map(chapter=>chapter.id),['one','two']);
  assert.equal(first.edges.some(edge=>edge.to==='c'),false);
  assert.deepEqual(second.nodes.map(node=>node.id),['c']);assert.deepEqual(second.edges,[]);
  assert.equal(second.nodes[0].current,false);
});

test('未制作视觉房间只标未知，不披露原房名或剧情；仍保留已知出口方向',()=>{
  const {rooms,scenes,input}=fixture();delete scenes.b;
  rooms.b.cn='不能提前披露的地方';rooms.b.name='Undisclosed';
  const map=buildChapterMap(input),unknown=map.nodes.find(node=>node.id==='b');
  assert.deepEqual([unknown.cn,unknown.name,unknown.unknownVisual],['未知地点','',true]);
  assert.equal(map.nodes.find(node=>node.id==='a').exits[0].cn,'未知地点');
  assert.equal(JSON.stringify(map).includes('不能提前披露'),false);
  assert.equal(JSON.stringify(map).includes('Undisclosed'),false);
  assert.ok(map.edges.some(edge=>edge.to==='b'));
});

test('异常出口不能修改活进度；状态方法及嵌套字段都不把写入传回引擎',()=>{
  const {state,rooms,input}=fixture(),before=state.serialize();
  rooms.a.exits=s=>{s.flags.add('bad');return {n:'b'};};
  rooms.b.exits=s=>{s.itemLoc.coin='destroyed';return {e:'a'};};
  const map=buildChapterMap(input);
  assert.deepEqual(state.serialize(),before);
  assert.deepEqual(map.edges,[]);assert.equal(map.warnings.length,2);
  rooms.a.exits=()=>({n:{to:'b',when:s=>{s.counters.turns=500;return true;}}});
  buildChapterMap(input);assert.deepEqual(state.serialize(),before);
});

test('布局确定、坐标有限，访问顺序不改变拓扑布局且不使用方向推导假地理网格',()=>{
  const {state,input}=fixture();state.visited=new Set(['b','a']);
  const first=buildChapterMap(input);state.visited=new Set(['a','b']);
  assert.deepEqual(buildChapterMap(input),first);
  const layout=layoutChapterMap(first.nodes,first.edges);
  assert.deepEqual(layout,first.nodes);
  for(const node of layout){assert.ok(Number.isFinite(node.x)&&node.x>=0&&node.x<=960);assert.ok(Number.isFinite(node.y)&&node.y>=0&&node.y<=570);}
  assert.deepEqual(layoutChapterMap([],[]),[]);
  assert.deepEqual(layoutChapterMap([{id:'single'}],[]),[{id:'single',x:480,y:285}]);
});

test('真实序章状态与序列化副本构建同一图，打开地图不推进turns/timer或触发onEnter',async()=>{
  const engine=createPrologueSession();engine.moveTo(engine.state.room);
  for(const command of ['n','n','e'])await engine.processInput(command);
  const before=engine.state.serialize(),input={state:engine.state,rooms:engine.rooms,scenes:SCENES};
  const live=buildChapterMap(input),plain=buildChapterMap({...input,state:before});
  assert.deepEqual(live,plain);assert.deepEqual(engine.state.serialize(),before);
  assert.deepEqual(live.nodes.map(node=>node.id).sort(),['palace_gate','broad_walk','black_lion_gate','inverness_terrace'].sort());
  assert.equal(live.nodes.find(node=>node.current).name,'Inverness Terrace');
  assert.equal(live.nodes.find(node=>node.current).cn,'因弗内斯台');
  assert.equal(live.nodes.some(node=>node.id==='lancaster_gate'),false);
});

test('默认章节归属覆盖已访问但未绘制的Wabe房间，不把原序章房间混入异境图',async()=>{
  const engine=createPrologueSession();await engine.activateChapter('wabe');
  engine.state.chapter='wabe';engine.state.room='top_of_arbor';
  engine.state.visited=new Set(['palace_gate','trellises','top_of_arbor']);
  const before=engine.state.serialize(),map=buildChapterMap({state:engine.state,rooms:engine.rooms,scenes:SCENES});
  assert.equal(map.chapter,'wabe');
  assert.deepEqual(map.nodes.map(node=>node.id),['top_of_arbor','trellises']);
  assert.equal(map.nodes.find(node=>node.id==='top_of_arbor').cn,'未知地点');
  assert.equal(map.edges.some(edge=>edge.from==='top_of_arbor'&&edge.direction==='d'&&edge.to==='trellises'),true);
  assert.deepEqual(engine.state.serialize(),before);
});

test('完整序章十一地点的名称卡片不重叠，密集有向道路仍使用独立真实边',()=>{
  const state={room:'palace_gate',chapter:'prologue',visited:Object.keys(PROLOGUE_ROOMS),
    flags:['white_door_visible'],counters:{},itemLoc:{}};
  const map=buildChapterMap({state,rooms:PROLOGUE_ROOMS,scenes:SCENES});
  assert.equal(map.nodes.length,11);
  assert.equal(new Set(map.edges.map(edge=>edge.id)).size,map.edges.length);
  for(let index=0;index<map.nodes.length;index++)for(let other=index+1;other<map.nodes.length;other++){
    const a=map.nodes[index],b=map.nodes[other];
    assert.ok(Math.abs(a.x-b.x)>=160||Math.abs(a.y-b.y)>=54,`${a.id}/${b.id}的地点名称卡片重叠`);
  }
});
