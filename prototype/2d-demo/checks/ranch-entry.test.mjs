import {installCarriedGnomon} from './vertex-install-fixture.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createPrologueSession } from '../engine-adapter.js';
import { ferryView } from '../ferry-state.js';
import { sceneExits } from '../scene-manifest.js';

// Begin with the same possessions, time and chapter registration as a new game.
test('正常进度从浅坑进牧场并原路返回，两程各走一回合且只描述目标一次', async () => {
  const arrivals = [];
  const quiet = () => {};
  const engine = createPrologueSession({ui:{
    text: quiet, system: quiet, userInput: quiet, inventory: quiet,
    location: (name, cn) => arrivals.push(cn),
  }});
  engine.moveTo(engine.state.room);
  async function play(commands) {
    for (const command of commands) {
      await engine.processInput(command);
      assert.equal(engine.state.dead, false, command);
    }
  }
  await play(['e','take ball','nw','unscrew gnomon','take gnomon','n','take paper bird',
    'open paper bird','w','buy crumbs','feed birds','take ruby','n','push pram','push pram',
    'wait','throw ball at tree','take umbrella','push pram','open pram','enter pram',
    'open umbrella','take paper bird','take gnomon','enter water','enter door','e','u']);
  assert.equal(engine.state.room, 'vertex');
  await installCarriedGnomon(engine);
  for (let i=0; i<7 && engine.state.sundialSymbol!==1; i++) await play(['turn ring']);
  await play(['d','e','e','in','wait','give umbrella to girl','e','take spade',
    'give paper to girl','w','ride bird','n','nw','sw','sw','w','n']);
  assert.equal(engine.state.room,'cemetery');
  await play(['open crypt with spade','take shroud','wear shroud','take bandage','take silver coin',
    's','e','e','u','push lever','turn ring to seventh symbol','d','se']);
  for(let i=0;i<12 && !ferryView(engine.state).docked;i++) await play(['look']);
  await play(['enter dory','give silver coin to oarsman']);
  assert.equal(engine.state.room,'sand_bar');
  await play(['s','enter door']);
  assert.equal(engine.state.room,'shack');
  await play(['w','d','d','se']);
  const state = engine.state;
  assert.equal(state.room, 'shallow_crater');
  assert.equal(state.itemAt('gnomon'),'vertex_socket');
  assert.ok(state.has('shroud'));
  assert.equal(engine.loadedChapters.has('ranch'), false);
  for (const [dir, target, chapter, label] of [
    ['se', 'nw_ranch', 'ranch', '牧场西北'], ['nw', 'shallow_crater', 'desert', '浅坑'],
  ]) {
    const road = sceneExits(state.room, state, engine.rooms).find(exit => exit.dir===dir);
    assert.equal(road?.target, target);
    assert.ok(road.label.includes(label));
    const count = arrivals.length, turns = state.turns;
    await play([dir]);
    assert.equal(state.room, target);
    assert.equal(state.chapter, chapter);
    assert.ok(state.hasFlag('chapter_'+chapter+'_entered'));
    assert.equal(state.turns, turns+1);
    assert.equal(state.itemAt('gnomon'),'vertex_socket');
    assert.ok(state.has('shroud'));
    assert.deepEqual(arrivals.slice(count), [label]);
  }
});
