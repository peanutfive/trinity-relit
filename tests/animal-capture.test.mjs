import assert from 'node:assert/strict';
import test from 'node:test';
import { createGame, command, go } from './harness.mjs';

// Only this helper constructs the route from the actual initial state. Later
// chapter fixtures isolate reload and failure boundaries, without claiming to
// be additional original-game fresh-start evidence.
async function newWabe() {
  const game = createGame();
  const act = input => command(game, input);
  await go(game, 'flower_walk');
  await act('take ball');
  await go(game, 'the_wabe');
  await act('unscrew gnomon');
  await act('take gnomon');
  await go(game, 'round_pond');
  await act('take paper bird');
  await act('open paper bird');
  await go(game, 'broad_walk');
  await act('buy crumbs');
  await act('feed birds');
  await act('take ruby');
  await go(game, 'black_lion_gate');
  await act('push pram');
  await act('push pram');
  await act('wait');
  await act('throw ball at tree');
  await act('take umbrella');
  await act('push pram');
  await act('open pram');
  await act('enter pram');
  await act('open umbrella');
  await act('take paper bird');
  await act('take gnomon');
  await go(game, 'wading');
  await act('enter door');
  assert.equal(game.state.chapter, 'wabe');
  assert.equal(game.state.score, 15);
  return game;
}

async function chapter(id, room, options = {}) {
  const game = createGame(options);
  game.state.clearTimer();
  game.state.setFlag('prologue_done');
  assert.equal(await game.eng.transitionChapter({ to: id, roomCandidates: [room] }), true);
  return game;
}

async function restored(game) {
  const next = createGame();
  await next.eng.deserialize(JSON.parse(JSON.stringify(game.eng.serialize())));
  return next;
}

test('正常新游戏：原版初始鸟笼和喜鹊，首次取笼后发现、捕获、关笼带回旅鼠', async () => {
  let game = await newWabe();
  assert.equal(game.state.itemAt('cage'), 'cottage');
  assert.equal(game.state.itemAt('magpie'), 'in:cage');
  assert.equal(game.eng.containerIsOpen('cage'), false);
  assert.equal(game.state.itemAt('lemming'), undefined);
  assert.equal(game.state.itemAt('roadrunner'), undefined);
  assert.equal(game.state.hasFlag('ruby_snatched'), true);
  await go(game, 'vertex');
  for (let guard = 0; game.state.sundialSymbol !== 5; guard++) {
    assert.ok(guard < 7);
    await command(game, 'turn ring');
  }
  await go(game, 'bluff');
  await command(game, 'e');
  assert.equal(game.state.room, 'bluff');
  await command(game, 'open front door');
  await command(game, 'e');
  assert.equal(game.state.room, 'cottage');
  assert.match(await command(game, 'examine cage'), /closed birdcage.*magpie/s);
  await command(game, 'take cage');
  assert.equal(game.state.score, 16);
  await command(game, 'drop cage');
  await command(game, 'take cage');
  assert.equal(game.state.score, 16);
  assert.match(await command(game, 'open cage'), /soars through the open door/);
  assert.equal(game.state.itemAt('magpie'), 'destroyed');
  await command(game, 'open back door');
  await command(game, 'e');
  await go(game, 'tundra_1');
  assert.equal(game.state.itemAt('lemming'), undefined);
  await go(game, 'cliff_edge');
  assert.equal(game.state.itemAt('lemming'), undefined);
  assert.match(await command(game, 'look in fissure'), /A trapped lemming glares up at you defiantly/);
  assert.equal(game.state.itemAt('lemming'), 'cliff_edge');
  assert.match(await command(game, 'take lemming'), /out of the fissure/);
  assert.equal(game.state.has('lemming'), true);
  const turns = game.state.turns;
  await game.eng.processInput('这是无法理解的句子');
  assert.equal(game.state.turns, turns);
  assert.equal(game.state.has('lemming'), true);
  await command(game, 'put lemming in cage');
  assert.equal(game.state.itemAt('lemming'), 'in:cage');
  assert.equal(game.state.score, 17);
  await command(game, 'close cage');
  assert.equal(game.eng.containerIsOpen('cage'), false);
  game = await restored(game);
  await command(game, 'search fissure');
  assert.equal(game.state.itemAt('lemming'), 'in:cage');
  await go(game, 'tundra_1');
  await go(game, 'herb_garden');
  assert.equal(game.state.chapter, 'wabe');
  assert.equal(game.state.itemAt('lemming'), 'in:cage');
  assert.equal(game.state.score, 17);
});

test('封闭小屋开喜鹊笼会重新关笼；开后门后再打开笼子才飞离', async () => {
  const game = await chapter('wabe', 'cottage');
  assert.equal(game.state.hasFlag('cottage_front_open'), false);
  assert.equal(game.state.hasFlag('cottage_back_open'), false);
  await command(game, 'take cage');
  assert.match(await command(game, 'open cage'), /circles around the inside of the cottage.*slam the door shut/s);
  assert.equal(game.state.itemAt('magpie'), 'in:cage');
  assert.equal(game.eng.containerIsOpen('cage'), false);
  assert.match(await command(game, 'look'), /front and back doors are both closed/);
  await command(game, 'open back door');
  assert.match(await command(game, 'open cage'), /soars through the open door/);
  assert.equal(game.state.itemAt('magpie'), 'destroyed');
  assert.equal(game.eng.containerIsOpen('cage'), true);
});

test('小屋前后门状态对两侧通行和存档恢复一致，方向目标不变', async () => {
  let game = await chapter('wabe', 'bluff');
  assert.match(await command(game, 'in'), /front door is closed/);
  assert.equal(game.state.room, 'bluff');
  await command(game, 'open front door');
  await command(game, 'in');
  assert.equal(game.state.room, 'cottage');
  assert.match(await command(game, 'e'), /back door is closed/);
  assert.equal(game.state.room, 'cottage');
  await command(game, 'open back door');
  await command(game, 'e');
  await command(game, 'close back door');
  assert.match(await command(game, 'w'), /back door is closed/);
  game = await restored(game);
  assert.equal(game.state.hasFlag('cottage_front_open'), true);
  assert.equal(game.state.hasFlag('cottage_back_open'), false);
  await command(game, 'open back door');
  await command(game, 'w');
  await command(game, 'out');
  assert.equal(game.state.room, 'bluff');
});

for (const room of ['islet', 'sand_bar']) {
  test(`${room}成功进入Desert才准备走鹃，首次塔底相遇放宝石于箱面并可捕获`, async () => {
    let game = await chapter('islet', room);
    await command(game, 'enter door');
    assert.equal(game.state.chapter, 'desert');
    assert.equal(game.state.room, 'shallow_crater');
    assert.equal(game.state.animals.roadrunner.prepared, true);
    assert.equal(game.state.animals.roadrunner.active, false);
    assert.equal(game.state.itemAt('roadrunner'), 'base_of_tower');
    await go(game, 'base_of_tower');
    assert.equal(game.state.animals.roadrunner.active, true);
    assert.equal(game.state.itemAt('ruby'), 'in:tower_box');
    assert.equal(game.eng.isVisible('ruby'), true);
    assert.equal(game.eng.isAccessible('ruby'), true);
    const meetings = () => game.output.filter(row => row.text.includes('A familiar roadrunner is eyeing')).length;
    assert.equal(meetings(), 1);
    game.state.take('cage'); // chapter fixture: ownership path tested separately above.
    await command(game, 'open cage');
    await command(game, 'take roadrunner');
    await command(game, 'put roadrunner in cage');
    await command(game, 'close cage');
    assert.equal(game.state.itemAt('roadrunner'), 'in:cage');
    const beforeRuby = game.state.score;
    assert.match(await command(game, 'examine ruby'), /Its finely cut edges sparkle with crimson fire/);
    assert.match(await command(game, 'take ruby from cage'), /不在指定/);
    assert.equal(game.state.itemAt('ruby'), 'in:tower_box');
    assert.equal(game.state.score, beforeRuby);
    assert.match(await command(game, room === 'islet' ? 'take ruby from box' : 'take ruby off box'), /You take the ruby off the box/);
    assert.equal(game.state.itemAt('ruby'), 'inventory');
    assert.equal(game.state.score, beforeRuby + 1);
    await command(game, 'drop ruby');
    assert.match(await command(game, 'take ruby from box'), /不在指定/);
    assert.equal(game.state.itemAt('ruby'), 'base_of_tower');
    assert.equal(game.state.score, beforeRuby + 1);
    assert.match(await command(game, 'take ruby'), /You take the ruby\./);
    assert.equal(game.state.score, beforeRuby + 1);
    game = await restored(game);
    assert.equal(meetings(), 0, '恢复状态不得重放首次相遇');
    await go(game, 'east_of_tower');
    await go(game, 'base_of_tower');
    assert.equal(meetings(), 0);
    assert.equal(game.state.itemAt('ruby'), 'inventory');
    assert.equal(game.state.itemAt('roadrunner'), 'in:cage');
  });

  test(`${room}切章失败不准备或生成走鹃`, async () => {
    const game = await chapter('islet', room);
    game.eng.chapterLoader = async () => null;
    await game.eng.processInput('enter door');
    assert.equal(game.state.chapter, 'islet');
    assert.equal(game.state.room, room);
    assert.equal(game.state.animals.roadrunner.prepared, false);
    assert.equal(game.state.itemAt('roadrunner'), undefined);
    assert.equal(game.state.hasFlag('islet_done'), false);
  });
}

test('已移除的走鹃不会因重新成功进入Desert而复活', async () => {
  const game = await chapter('islet', 'islet');
  game.state.destroy('roadrunner');
  await command(game, 'enter door');
  assert.equal(game.state.itemAt('roadrunner'), 'destroyed');
  await go(game, 'base_of_tower');
  assert.equal(game.state.hasFlag('roadrunner_tower_met'), false);
  assert.equal(game.state.itemAt('ruby'), undefined);
});
