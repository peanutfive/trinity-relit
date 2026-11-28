import {installCarriedGnomon} from './vertex-install-fixture.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createPrologueSession } from '../engine-adapter.js';
import { getHotspots, getInventoryActions } from '../interaction-catalog.js';
import { getHotspots as getPrologueHotspots } from '../prologue-actions.js';
import { WABE_SLICE_ROOMS } from '../wabe-actions.js';
import { ROOMS } from '../../js/data/wabe.js';
import { ROOMS as VISUAL_ROOMS } from '../cemetery-story.js';

function createGame() {
  const output = [];
  const ui = Object.fromEntries(['text', 'system', 'inventory', 'location', 'userInput'].map(name => [name, (...args) => output.push(args.join('\n'))]));
  const engine = createPrologueSession({ ui });
  engine.moveTo(engine.state.room);
  return { engine, output };
}
async function command(game, input) {
  const from = game.output.length;
  await game.engine.processInput(input);
  assert.equal(game.engine.state.dead, false, input);
  assert.doesNotMatch(game.output.slice(from).join('\n'), /这句话无法识别|错误：|尚未开放/, input);
}
async function choose(game, input) {
  const state = game.engine.state;
  const actions = [...getHotspots(state).flatMap(object => object.actions), ...state.inventoryList().flatMap(({ id }) => getInventoryActions(id, state))];
  assert.ok(actions.some(action => action.command === input), `${state.room}: 图形目录缺少 ${input}`);
  await command(game, input);
}
async function finishPrologue(game) {
  const steps = [
    ['e'], ['take ball', true], ['nw'], ['unscrew gnomon', true], ['take gnomon', true],
    ['n'], ['take paper bird', true], ['open paper bird', true], ['w'], ['buy crumbs', true],
    ['feed birds', true], ['take ruby', true], ['n'], ['push pram', true], ['push pram', true],
    ['wait', true], ['throw ball at tree', true], ['take umbrella', true], ['push pram', true],
    ['open pram', true], ['enter pram', true], ['open umbrella', true],
    ['take paper bird', true], ['take gnomon', true], ['enter water', true], ['enter door', true],
  ];
  for (const [input, fromCatalog] of steps) await (fromCatalog ? choose(game, input) : command(game, input));
  assert.equal(game.engine.state.room, 'meadow');
  assert.equal(game.engine.state.chapter, 'wabe');
  assert.equal(game.engine.state.score, 15);
}

test('统一目录保留序章，未制作章节与房间不暴露可执行传送动作', async () => {
  const { engine } = createGame();
  assert.deepEqual(getHotspots(engine.state), getPrologueHotspots(engine.state));
  await engine.activateChapter('wabe');
  engine.state.chapter = 'wabe';
  engine.state.room = 'the_river';
  engine.state.sundialSymbol = 2;
  assert.ok(getHotspots(engine.state).some(object=>object.eventId==='examine_river'));
  assert.ok(getHotspots(engine.state).every(object=>object.actions.every(action=>action.command!=='in')));
  engine.state.room = '__unmade__';
  assert.deepEqual(getHotspots(engine.state), []);
  assert.deepEqual(getInventoryActions('umbrella', engine.state), []);
  engine.state.chapter = '__unsupported__';
  assert.deepEqual(getHotspots(engine.state), []);
});

test('Wabe已制作房间目录只读，所有专用事件可由合法命令访问，in只接实际入口', async () => {
  const { engine } = createGame();
  await engine.activateChapter('wabe');
  engine.state.chapter = 'wabe';
  const parser = engine.parser;
  const covered = new Set();
  const scenarios = [...WABE_SLICE_ROOMS.map(room=>({room})),{room:'south_bog',movedLog:true},{room:'vertex',mount:true}];
  for (const {room,mount,movedLog} of scenarios) {
    engine.state.room = room;
    if(movedLog)await engine.processInput('move log');
    if(mount) {
      engine.state.take('gnomon');
      await installCarriedGnomon(engine);
    }
    if(room==='barrow')engine.state.placeItem('key_barrow','inventory');
    const before = engine.state.serialize();
    const objects = getHotspots(engine.state);
    assert.deepEqual(engine.state.serialize(), before);
    assert.equal(objects.length, new Set(objects.map(object => object.id)).size);
    for (const object of objects) {
      assert.ok(object.x >= 12 && object.x <= 468 && object.y >= 12 && object.y <= 276);
      if (object.eventId) assert.ok(VISUAL_ROOMS[room].events.some(event => event.id === object.eventId));
      for (const action of object.actions) {
        const parsed = parser.parse(action.command);
        assert.ok(parsed, action.command);
        if(parsed.dir==='in')assert.ok(['moor','under_cliff','barrow','ossuary','waterfall'].includes(room));
        const event = ROOMS[room].events.find(event => event.match?.verb.includes(parsed.verb) && event.match.noun?.includes(parsed.noun));
        if (event) covered.add(event.id);
      }
    }
    if (room === 'vertex') {
      assert.equal(objects.filter(object => object.itemId === 'sundial').length, 1);
      assert.equal(objects.filter(object => object.itemId === 'ring').length, 1);
      const mounted=engine.state.itemAt('gnomon')==='vertex_socket';
      assert.equal(objects.some(object=>object.id==='vertex:hole'),!mounted);
      assert.equal(objects.some(object=>object.id==='vertex:lever'),mounted);
      const pointer=objects.find(object=>object.id==='vertex:fixed-gnomon');
      if(mounted) {
        assert.ok(pointer.actions.some(action=>action.command==='unscrew gnomon'));
        assert.ok(!pointer.actions.some(action=>action.command==='take gnomon'));
      } else assert.equal(pointer,undefined);
    }
  }
  assert.deepEqual([...covered].sort(), WABE_SLICE_ROOMS.flatMap(room => ROOMS[room].events.map(event => event.id)).sort());
});

test('真实序章后走完全部已制作Wabe房间、转环七次、拾取放下木片并读档继续', async () => {
  const g = createGame();
  await finishPrologue(g);
  const state = g.engine.state;
  await choose(g, 'examine sundial');
  await command(g, 'n'); assert.equal(state.room, 'summit');
  await command(g, 'e'); assert.equal(state.room, 'forest_clearing');
  await command(g, 'n'); assert.equal(state.room, 'south_bog');
  await choose(g, 'examine log');
  await choose(g, 'move log');
  await choose(g, 'examine splinter');
  await choose(g, 'take splinter');
  assert.ok(state.has('splinter'));
  assert.equal(getHotspots(state).some(object => object.itemId === 'splinter'), false);
  await choose(g, 'drop splinter');
  assert.equal(state.itemAt('splinter'), 'south_bog');
  assert.ok(getHotspots(state).some(object => object.itemId === 'splinter'));
  await choose(g, 'take splinter');
  await command(g, 'n'); assert.equal(state.room, 'north_bog');
  await command(g, 'se'); assert.equal(state.room, 'bottom_of_stairs');
  await choose(g, 'u'); assert.equal(state.room, 'vertex');
  await choose(g, 'examine sundial');
  await choose(g, 'examine ring');
  await choose(g, 'examine gnomon');
  const initial = state.sundialSymbol;
  for (let index = 0; index < 7; index++) {
    await choose(g, 'turn ring');
    assert.equal(state.sundialSymbol, (initial + index) % 7 + 1);
  }
  assert.equal(state.sundialSymbol, initial);
  await choose(g, 'd'); assert.equal(state.room, 'bottom_of_stairs');
  for(const cmd of ['w','w','search waterfall','w','out','n','n','in','out','s','s','e','e']) await command(g,cmd);
  await command(g, 'e'); assert.equal(state.room,'the_bend');
  await command(g, 'e'); assert.equal(state.room,'moor');
  for(const c of ['nw','e','d','u','nw','e','w','se','s'])await command(g,c);
  assert.equal(state.room,'moor');
  await command(g, 'w'); await command(g,'sw'); assert.equal(state.room,'trellises');
  for(const c of ['se','w','n','u','take axe','s','d','s','u','n','d','w','ne','nw','w','ne','sw','e','se'])await command(g,c);
  await command(g, 'w'); assert.equal(state.room, 'forest_clearing');
  for(const c of ['n','n','n','se','ne','e','e','w','w','sw','se','s','w','w'])await command(g,c);
  assert.equal(state.room,'forest_clearing');
  assert.ok(WABE_SLICE_ROOMS.every(room => state.visited.has(room)));
  assert.equal(state.score, 16);
  await choose(g, 'drop splinter');
  const save = JSON.parse(JSON.stringify(g.engine.serialize()));
  const resumed = createGame();
  await resumed.engine.deserialize(save);
  assert.deepEqual(resumed.engine.state.serialize(), state.serialize());
  assert.ok(getHotspots(resumed.engine.state).some(object => object.itemId === 'splinter'));
  await choose(resumed, 'take splinter');
  assert.ok(resumed.engine.state.has('splinter'));
  assert.equal(resumed.engine.state.sundialSymbol, initial);
});
