import assert from 'node:assert/strict';
import test from 'node:test';
import { createGame, command } from './harness.mjs';

// 单机制夹具，不作为原版正常路线的证据；新游戏捕获另由animal-capture覆盖。
async function fixture(room = 'nw_room', animal = 'lemming', light = true) {
  const g = createGame();
  g.state.setFlag('prologue_done'); g.state.clearTimer();
  g.state.take('cage'); g.state.setFlag('cage_taken_scored');
  for (const id of ['magpie', 'lemming', 'roadrunner']) {
    g.state.destroy(id); g.state.animals[id].active = false;
    if ('grace' in g.state.animals[id]) g.state.animals[id].grace = 0;
  }
  if (animal) {
    g.state.putIn(animal, 'cage'); g.state.animals[animal].active = true;
    if (animal === 'roadrunner') Object.assign(g.state.animals.roadrunner, { takeable: true, prepared: true });
  }
  if (light) g.state.take('splinter');
  await g.eng.transitionChapter({ to: 'ranch', roomCandidates: [room] });
  return g;
}
async function reload(g) {
  const next = createGame(); await next.eng.deserialize(JSON.parse(JSON.stringify(g.eng.serialize()))); return next;
}
const text = g => g.output.map(row => row.text).join('\n');

for (const light of [true, false]) {
  test(`闭门放旅鼠解决蛇，${light ? '有木片光' : '无光'}，原版顺序与一次+3`, async () => {
    let g = await fixture('nw_room', 'lemming', light);
    assert.match(await command(g, 'e'), /urgent noise[\s\S]*about to strike/);
    assert.match(await command(g, 'n'), /hasty retreat[\s\S]*lurks just outside/);
    await command(g, 'close door');
    g = await reload(g);
    const release = await command(g, 'open cage');
    assert.match(release, light ? /scrambles out of the cage and plops to the floor/ : /hear the lemming scramble out of the cage and plop to the floor/);
    assert.equal(g.state.itemAt('lemming'), 'closet');
    g = await reload(g);
    const before = g.state.score, response = await command(g, 'open door');
    assert.ok(response.indexOf('about to strike') < response.indexOf('straight into the fangs'));
    assert.equal(g.state.score, before + 3);
    assert.equal(g.state.itemAt('lemming'), 'destroyed');
    assert.equal(g.state.itemAt('dead_lemming'), undefined);
    assert.equal(g.state.hasFlag('snake_gone'), true);
    assert.equal(g.state.animals.lemming.active, false);
    await command(g, 'close cage'); await command(g, 'close door'); await command(g, 'open door');
    assert.equal(g.state.score, before + 3);
    await command(g, 's'); await command(g, 'wait');
    assert.equal(g.state.dead, false);
  });
}

test('未知输入和免推进动作不缩短蛇窗口；离开后重新警告', async () => {
  let g = await fixture();
  await command(g, 'e');
  const before = g.state.turns;
  await g.eng.processInput('这句不是命令');
  assert.equal(g.state.turns, before);
  assert.equal(g.state.hasFlag('snake_bitten'), false);
  g = await reload(g);
  await command(g, 'w'); await command(g, 'wait');
  assert.match(await command(g, 'e'), /about to strike/);
  assert.equal(g.state.hasFlag('snake_bitten'), false);
  await command(g, 'n'); await command(g, 'close door');
  const closed = g.state.turns;
  assert.match(await command(g, 'examine snake'), /other side of the closet door/);
  assert.equal(g.state.turns, closed);
  assert.equal(g.state.hasFlag('snake_bitten'), false);
});

test('停留被咬，咬伤读档后下一有效动作死亡且不覆盖最后活档', async () => {
  const g = await fixture('nw_room', null);
  const saves = []; g.eng.onAutosave = save => saves.push(save);
  await command(g, 'e'); await command(g, 'wait');
  assert.equal(g.state.hasFlag('snake_bitten'), true);
  assert.equal(g.state.dead, false);
  const injured = JSON.parse(JSON.stringify(g.eng.serialize()));
  const restored = createGame({ onAutosave: save => saves.push(save) });
  await restored.eng.deserialize(injured);
  const count = saves.length;
  await restored.eng.processInput('w');
  assert.equal(restored.state.room, 'nw_room');
  assert.equal(restored.state.dead, true);
  assert.match(text(restored), /throbbing fire in your ankle[\s\S]*the windows are filled with light/);
  assert.equal(saves.length, count);
});

test('壁橱门真实阻挡s/out；关门可安全等待，开门后留一回合警告', async () => {
  const g = await fixture('nw_room', null, false);
  await command(g, 'e'); await command(g, 'n'); await command(g, 'close door');
  for (const input of ['s', 'out', 'wait']) {
    const before = g.state.turns;
    await command(g, input); assert.equal(g.state.room, 'closet'); assert.equal(g.state.hasFlag('snake_bitten'), false);
    if (input !== 'wait') assert.equal(g.state.turns, before);
  }
  assert.match(await command(g, 'look'), /completely dark/);
  assert.match(await command(g, 'open door'), /about to strike/);
  await command(g, 'close door'); assert.equal(g.state.hasFlag('snake_bitten'), false);
});

for (const animal of ['magpie', 'lemming', 'roadrunner']) {
  for (const mode of ['enter', 'held-mill', 'platform-mill']) {
    test(`${animal} ${mode}：独立溺尸、回收、开笼取回及原因，刷新不复活`, async () => {
      let g = await fixture(mode === 'enter' ? 'edge_reservoir' : 'under_windmill', animal);
      const score = g.state.score;
      if (mode === 'enter') await command(g, 'in');
      else {
        await command(g, 'up');
        if (mode === 'platform-mill') await command(g, 'drop cage');
        const turns = g.state.turns;
        assert.match(await command(g, 'take binoculars'), /CRACK!/);
        assert.equal(g.state.turns, turns);
        assert.equal(g.state.itemAt('cage'), 'underwater');
        await command(g, 'down'); await command(g, 'take cage'); await command(g, 'up');
      }
      assert.equal(g.state.dead, false);
      assert.equal(g.state.itemAt(animal), 'destroyed');
      assert.equal(g.state.itemAt(`dead_${animal}`), 'in:cage');
      assert.equal(g.state.animals.deaths[`dead_${animal}`], 'drowned');
      g = await reload(g);
      assert.match(await command(g, `take dead ${animal}`), /closed/);
      await command(g, 'open cage'); await command(g, `take dead ${animal}`);
      assert.equal(g.state.itemAt(`dead_${animal}`), 'inventory');
      assert.match(await command(g, `examine dead ${animal}`), /It's dead[\s\S]*Drowned/);
      assert.equal(g.state.itemAt(animal), 'destroyed');
      assert.equal(g.state.score, score);
    });
  }
}

test('普通入水不递归处理位于更深容器的笼，坍塌单独处理直接走鹃', async () => {
  const g = await fixture('edge_reservoir', 'magpie');
  // 明确隔离谓词的状态夹具；不声称这种大笼嵌套可由正常容量动作形成。
  g.eng.items = { ...g.eng.items, carrier: { cn: '载具', en: 'carrier', container: true, open: true } };
  g.state.take('carrier'); g.state.putIn('cage', 'carrier');
  await command(g, 'in');
  assert.equal(g.state.itemAt('magpie'), 'in:cage');
  const h = await fixture('under_windmill', null);
  h.state.placeItem('roadrunner', 'windmill'); h.state.animals.roadrunner.active = false;
  await command(h, 'up'); await command(h, 'take binoculars');
  assert.equal(h.state.itemAt('roadrunner'), 'destroyed');
  assert.equal(h.state.itemAt('dead_roadrunner'), 'underwater');
});


test('组装室关闭前门的失败方向不推进蛇，源条件门失败为免回合', async () => {
  const g = await fixture('nw_room', null);
  await command(g, 'e'); const before = g.state.turns;
  assert.match(await command(g, 'e'), /front door is closed/);
  assert.equal(g.state.turns, before);
  assert.equal(g.state.hasFlag('snake_bitten'), false);
  await command(g, 'w'); assert.equal(g.state.dead, false);
});

for (const [room, flag, expected, other, otherExpected] of [
  ['kitchen', 'ranch_outer_door_open', /An open outer door/, 'hallway', /An open outer door/],
  ['spare_room', 'ranch_screen_door_open', /an open screen door/, 'back_yard', /an open screen door/],
  ['bedroom', 'ranch_outside_door_open', /An open outside door/, 'ne_yard', /an open outside door/],
]) {
  test(`旅鼠逃逸推动门后，${room}和另一侧描述同步`, async () => {
    const g = await fixture(room);
    assert.equal(g.state.hasFlag(flag), false);
    assert.match(await command(g, 'open cage'), /nudges open/);
    assert.equal(g.state.hasFlag(flag), true);
    assert.match(await command(g, 'look'), expected);
    g.eng.moveTo(other);
    assert.match(await command(g, 'look'), otherExpected);
  });
}

test('平台开笼的旅鼠先独立落水，随后取镜坍塌可回收原尸体', async () => {
  const g = await fixture('under_windmill');
  await command(g, 'up');
  const response = await command(g, 'open cage');
  assert.match(response, /leaps over the landing's edge[\s\S]*faint splash/);
  assert.equal(g.state.room, 'windmill');
  assert.equal(g.state.itemAt('lemming'), 'destroyed');
  assert.equal(g.state.itemAt('dead_lemming'), 'underwater');
  assert.equal(g.state.containerOf('dead_lemming'), null);
  await command(g, 'take binoculars'); await command(g, 'down');
  await command(g, 'take dead lemming');
  assert.equal(g.state.itemAt('dead_lemming'), 'inventory');
  assert.equal(g.state.animals.deaths.dead_lemming, 'drowned');
});

for (const animal of ['lemming', 'roadrunner']) {
  test(`实际Tower Landing ID开笼释放${animal}，按ON-TOWER分支落到塔底`, async () => {
    const g = await fixture('nw_room', animal);
    await g.eng.transitionChapter({ to: 'desert', roomCandidates: ['tower_landing'] });
    assert.equal(g.state.room, 'tower_landing');
    const response = await command(g, 'open cage');
    if (animal === 'lemming') {
      assert.match(response, /flings itself joyfully off the tower/);
      assert.equal(g.state.itemAt('lemming'), 'destroyed');
      assert.equal(g.state.itemAt('dead_lemming'), 'base_of_tower');
      assert.equal(g.state.animals.deaths.dead_lemming, null);
    } else {
      assert.match(response, /disappears over the side of the platform/);
      assert.equal(g.state.itemAt('roadrunner'), 'base_of_tower');
      assert.equal(g.state.itemAt('dead_roadrunner'), undefined);
    }
  });
}

test('ON-CIST实际水库边缘开笼，走鹃飞到南岸而非留在边缘', async () => {
  const g = await fixture('edge_reservoir', 'roadrunner');
  assert.match(await command(g, 'open cage'), /flutters out of the reservoir and disappears/);
  assert.equal(g.state.itemAt('roadrunner'), 'south_reservoir');
  assert.equal(g.state.itemAt('dead_roadrunner'), undefined);
});

test('走鹃落在水库边缘或塔梯平台地面时也执行原版即时离开分支', async () => {
  for (const room of ['edge_reservoir', 'tower_landing']) {
    const g = await fixture('nw_room', 'roadrunner');
    if (room === 'tower_landing') await g.eng.transitionChapter({ to: 'desert', roomCandidates: [room] });
    else g.eng.moveTo(room);
    // 独立动作夹具：从同回合TAKE开始，只通过正常DROP触发地面回调。
    g.state.take('roadrunner');
    const response = await command(g, 'drop roadrunner');
    assert.match(response, /flutters out of the reservoir|disappears over the side of the platform/);
    assert.equal(g.state.itemAt('roadrunner'), room === 'edge_reservoir' ? 'south_reservoir' : 'base_of_tower');
  }
});

test('活旅鼠与尸体的off来源和from一样核验，不从别处拿取', async () => {
  const live = await fixture('edge_reservoir'); live.state.take('empty_bag');
  assert.match(await command(live, 'take lemming off paper bag'), /不在指定/);
  assert.equal(live.state.itemAt('lemming'), 'in:cage');
  const dead = await fixture('edge_reservoir'); dead.state.take('empty_bag');
  await command(dead, 'in'); await command(dead, 'open cage');
  // 纸袋入水会换成湿袋，明确使用当前可见的不同父对象。
  assert.match(await command(dead, 'take dead lemming off soggy bag'), /不在指定/);
  assert.equal(dead.state.itemAt('dead_lemming'), 'in:cage');
});

test('重拿活旅鼠使用PRE-TAKE原文，仍正常推进到挣脱', async () => {
  const g = createGame(); g.state.setFlag('prologue_done'); g.state.clearTimer();
  await g.eng.transitionChapter({ to: 'tundra', roomCandidates: ['cliff_edge'] });
  await command(g, 'look in fissure'); await command(g, 'take lemming');
  const response = await command(g, 'take lemming');
  assert.match(response, /You're already holding the lemming/);
  assert.match(response, /wiggles from your grasp/);
  assert.equal(g.state.itemAt('lemming'), 'destroyed');
});
