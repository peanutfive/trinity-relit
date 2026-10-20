import test from "node:test";
import assert from "node:assert/strict";
import { createGame, command } from "./harness.mjs";
import { ITEMS } from "../prototype/js/data/items.js";
import { discoverLemming, prepareRoadrunnerForDesert, enterRoadrunnerTower, drownCage, drownRoadrunner, getAnimalActionCandidates } from "../prototype/js/animal-rules.js";

function lab(room = "animal_lab") {
  const game = createGame();
  game.state.timer = null;
  game.eng.rooms[room] = { name: "动物试验", cn: "动物试验", desc: "动物试验。", exits: {}, events: [] };
  game.state.room = room;
  return game;
}

function lemmingLab() {
  const game = lab();
  game.state.destroy("magpie");
  game.state.take("cage");
  game.state.setFlag("cage_open");
  game.state.placeItem("lemming", game.state.room);
  game.state.animals.lemming.active = true;
  return game;
}

test("笼初始关闭且有独立喜鹊，三尸体各有原版尺寸", () => {
  const { eng, state } = lab();
  assert.equal(state.itemAt("cage"), "cottage");
  assert.equal(state.containerOf("magpie"), "cage");
  assert.equal(eng.containerIsOpen("cage"), false);
  for (const [id, size] of [["dead_lemming", 3], ["dead_magpie", 3], ["dead_roadrunner", 5]]) {
    assert.equal(ITEMS[id].size, size); assert.equal(state.itemAt(id), undefined);
  }
});

test("鸟笼正常首取只加1分，放下再取不刷分", async () => {
  const game = lab();
  game.state.placeItem("cage", game.state.room);
  const before = game.state.score;
  await command(game, "take cage");
  assert.equal(game.state.score, before + 1);
  await command(game, "drop cage"); await command(game, "take cage");
  assert.equal(game.state.score, before + 1);
});

test("关闭小屋开喜鹊笼会捉回关笼，打开门后才飞走", async () => {
  const game = lab("cottage");
  assert.match(await command(game, "open cage"), /circles around the inside of the cottage/);
  assert.equal(game.state.containerOf("magpie"), "cage");
  assert.equal(game.state.hasFlag("cage_open"), false);
  game.state.setFlag("cottage_front_open");
  assert.match(await command(game, "open cage"), /soars through the open door/);
  assert.equal(game.state.itemAt("magpie"), "destroyed");
});

test("闭笼喜鹊可见不可取；开笼暗处仍留笼，亮处拒绝手拿", async () => {
  const game = lab("closet"); game.state.take("cage"); game.state.setFlag("closet_door_closed");
  assert.equal(game.eng.isVisible("magpie"), true);
  assert.match(await command(game, "take magpie"), /can't reach into the birdcage/);
  await command(game, "open cage");
  assert.equal(game.state.containerOf("magpie"), "cage");
  assert.match(await command(game, "take magpie"), /won't let you near/);
});

test("裂缝只发现一次，从裂缝拿旅鼠后同回合挣扎", async () => {
  const game = lab("cliff_edge");
  discoverLemming(game.state, game.eng);
  assert.equal(game.state.itemAt("lemming"), "cliff_edge");
  const response = await command(game, "take lemming from fissure");
  assert.match(response, /out of the fissure/); assert.match(response, /squirms violently/);
  game.state.destroy("lemming"); discoverLemming(game.state, game.eng);
  assert.equal(game.state.itemAt("lemming"), "destroyed");
});

test("旅鼠取装关窗口合法，首次装笼只加1分", async () => {
  const game = lemmingLab(), before = game.state.score;
  assert.match(await command(game, "take lemming"), /squirms violently/);
  assert.match(await command(game, "put lemming in cage"), /sinks its teeth/);
  assert.equal(game.state.containerOf("lemming"), "cage");
  assert.equal(game.state.score, before + 1);
  await command(game, "close cage");
  assert.equal(game.state.containerOf("lemming"), "cage");
  // A second physically valid insertion must retain the cage's original reward guard.
  game.state.setFlag("cage_open"); game.state.take("lemming");
  await command(game, "put lemming in cage");
  assert.equal(game.state.score, before + 1);
});

test("未知和免推进输入不消耗持有窗口，下一有效回合会逃", async () => {
  const game = lemmingLab();
  game.eng.rooms.animal_lab.events.push({ id: "free_glance", match: { verb: ["examine"], noun: ["mark"] }, advancesTurn: false, text: "标记。" });
  await command(game, "take lemming");
  const before = game.state.turns;
  await game.eng.processInput("未知的胡言乱语");
  await command(game, "examine mark");
  assert.equal(game.state.turns, before);
  assert.equal(game.state.carrying("lemming"), true);
  assert.match(await command(game, "look"), /wiggles from your grasp/);
  assert.equal(game.state.itemAt("lemming"), "destroyed");
});

test("开旅鼠笼立即逃，平台开笼独立产生水底溺尸", async () => {
  const game = lab("windmill");
  game.state.destroy("magpie"); game.state.take("cage"); game.state.putIn("lemming", "cage");
  game.state.animals.lemming.active = true;
  assert.match(await command(game, "open cage"), /leaps over the landing's edge/);
  assert.equal(game.state.itemAt("lemming"), "destroyed");
  assert.equal(game.state.itemAt("dead_lemming"), "underwater");
  assert.equal(game.state.animals.deaths.dead_lemming, "drowned");
});

test("见蛇开笼的旅鼠畏缩，闭门壁橱释放留地并触发共享接点", async () => {
  const game = lab("closet");
  game.state.destroy("magpie"); game.state.take("cage"); game.state.putIn("lemming", "cage");
  game.state.animals.lemming.active = true; game.state.setFlag("snake_started");
  assert.match(await command(game, "open cage"), /cowers in the cage/);
  assert.equal(game.state.containerOf("lemming"), "cage");
  await command(game, "close cage"); game.state.setFlag("closet_door_closed");
  let called = 0; game.eng.rooms.closet.onAnimalReleased = () => { called++; };
  await command(game, "open cage");
  assert.equal(game.state.itemAt("lemming"), "closet"); assert.equal(called, 1);
});

test("走鹃必须准备并首次塔底激活，重复进入和明确销毁不复活", () => {
  const game = lab("base_of_tower");
  assert.equal(prepareRoadrunnerForDesert(game.state), true);
  assert.equal(game.state.animals.roadrunner.active, false);
  assert.equal(enterRoadrunnerTower(game.state, game.eng), true);
  assert.equal(enterRoadrunnerTower(game.state, game.eng), false);
  assert.equal(game.state.animals.roadrunner.takeable, true);
  game.state.destroy("roadrunner");
  assert.equal(prepareRoadrunnerForDesert(game.state), false);
  assert.equal(game.state.itemAt("roadrunner"), "destroyed");
});

test("走鹃取装关短窗口使用活体尺寸特例，开笼跳地可再取", async () => {
  const game = lemmingLab(); game.state.destroy("lemming");
  game.state.placeItem("roadrunner", game.state.room);
  game.state.animals.roadrunner = { active: true, grace: 0, prepared: true, takeable: true };
  assert.match(await command(game, "take roadrunner"), /pecks angrily/);
  assert.match(await command(game, "put roadrunner in cage"), /pecks furiously/);
  assert.equal(game.state.containerOf("roadrunner"), "cage");
  await command(game, "close cage");
  assert.match(await command(game, "open cage"), /hops out of the birdcage/);
  assert.equal(game.state.itemAt("roadrunner"), game.state.room);
  await command(game, "take roadrunner");
  assert.match(await command(game, "examine cage"), /struggles out of your grasp/);
});

test("笼内三活体逐一替换溺尸，调用者不在范围时不会误杀", async () => {
  for (const id of ["magpie", "lemming", "roadrunner"]) {
    const game = lab(); game.state.take("cage"); game.state.destroy("magpie");
    game.state.putIn(id, "cage"); game.state.animals[id].active = true;
    const before = game.state.score;
    drownCage(game.state); drownCage(game.state);
    assert.equal(game.state.itemAt(id), "destroyed");
    assert.equal(game.state.containerOf(`dead_${id}`), "cage");
    assert.equal(game.state.animals[id].active, false);
    assert.equal(game.state.score, before); assert.equal(game.state.dead, false);
    assert.match(await command(game, `take dead ${id}`), /can't reach into the birdcage/);
    await command(game, "open cage"); await command(game, `take dead ${id}`);
    assert.equal(game.state.carrying(`dead_${id}`), true);
    assert.match(await command(game, `examine drowned ${id}`), /Drowned, as a matter of fact/);
    await command(game, `put dead ${id} in cage`);
    assert.equal(game.state.containerOf(`dead_${id}`), id === "roadrunner" ? null : "cage");
  }
});

test("直接走鹃坍塌替换尊重精确位置，不当作递归杀动物", () => {
  const game = lab(); game.state.placeItem("roadrunner", "windmill");
  drownRoadrunner(game.state, "inventory"); assert.equal(game.state.itemAt("roadrunner"), "windmill");
  drownRoadrunner(game.state, "windmill"); assert.equal(game.state.itemAt("dead_roadrunner"), "windmill");
  assert.equal(game.state.itemAt("roadrunner"), "destroyed");
});

test("动物take from拒绝错误来源，满手不提供拿取候选且显式候选失效不推进", async () => {
  const game = lemmingLab(); game.state.putIn("dead_lemming", "cage");
  await command(game, "take dead lemming from bag");
  assert.equal(game.state.containerOf("dead_lemming"), "cage");
  for (const id of ["bag", "empty_bag", "ball", "umbrella", "gnomon", "ruby", "spade"]) game.state.take(id);
  assert.ok(!getAnimalActionCandidates(game.eng).some(c => c.command.verb === "take"));
  assert.ok(!getAnimalActionCandidates(game.eng).some(c => c.command.verb === "drop"));
  const before = game.state.turns;
  await game.eng._runCommandTurn({ type: "simple", verb: "take", noun: "live lemming", itemId: "lemming" });
  assert.equal(game.state.turns, before); // Earlier wrong-from valid action already let the ground LEM escape.
});

test("EMPTY不能绕过活物拿取回调或直接手拿喜鹊", async () => {
  const game = lab("closet"); game.state.take("cage"); game.state.setFlag("closet_door_closed");
  await command(game, "open cage"); await command(game, "empty cage");
  assert.equal(game.state.containerOf("magpie"), "cage");
  assert.equal(game.state.has("magpie"), false);
});

test("死旅鼠和死喜鹊入口袋后可以通过take from正常取回", async () => {
  for (const id of ["dead_lemming", "dead_magpie"]) {
    const game = lab(); game.state.take(id);
    await command(game, `put ${ITEMS[id].aliases[0]} in pocket`);
    assert.equal(game.state.inPocket(id), true);
    assert.match(await command(game, `take ${ITEMS[id].aliases[0]} from pocket`), /out of your pocket/);
    assert.equal(game.state.carrying(id), true);
  }
});

test("鸟笼首取拒绝错误来源且不加分，正确来源才移动计分", async () => {
  const game = lab(); game.state.placeItem("cage", game.state.room);
  const score = game.state.score;
  await command(game, "take cage from pocket");
  assert.equal(game.state.inRoom("cage"), true); assert.equal(game.state.score, score);
  await command(game, "take cage from paper bag");
  assert.equal(game.state.inRoom("cage"), true); assert.equal(game.state.score, score);
  await command(game, "take cage"); assert.equal(game.state.score, score + 1);
});

test("裂缝发现尊重显式销毁或已存在的尸体，不重新创造旅鼠", () => {
  const game = lab("cliff_edge"); game.state.destroy("lemming");
  discoverLemming(game.state, game.eng); assert.equal(game.state.itemAt("lemming"), "destroyed");
  const other = lab("cliff_edge"); other.state.placeItem("dead_lemming", "cliff_edge");
  discoverLemming(other.state, other.eng); assert.equal(other.state.itemAt("lemming"), undefined);
});

test("小屋旅鼠逃逸会打开真实前门，走鹃在走廊逃逸按源回后院", async () => {
  const game = lab("cottage"); game.state.destroy("magpie"); game.state.take("lemming");
  game.state.animals.lemming.active = true;
  assert.match(await command(game, "look"), /nudges open the front door/);
  assert.equal(game.state.hasFlag("cottage_front_open"), true);
  const other = lab("hallway"); other.state.take("roadrunner");
  other.state.animals.roadrunner = { active: true, grace: 0, prepared: true, takeable: true };
  assert.match(await command(other, "look"), /scoots off down the hall/);
  assert.equal(other.state.itemAt("roadrunner"), "back_yard");
});

test("牧场室内走鹃按对应门状态逃到前院，旅鼠打开纱门与方向分支", async () => {
  const game = lab("kitchen"); game.state.take("roadrunner");
  game.state.animals.roadrunner = { active: true, grace: 0, prepared: true, takeable: true };
  assert.match(await command(game, "look"), /nudges open the outer door.*sly glance.*trots out of sight/s);
  assert.equal(game.state.hasFlag("ranch_outer_door_open"), true);
  assert.equal(game.state.itemAt("roadrunner"), "front_yard");
  const other = lab("spare_room"); other.state.take("lemming"); other.state.animals.lemming.active = true;
  assert.match(await command(other, "look"), /nudges open the screen door/);
  assert.equal(other.state.hasFlag("ranch_screen_door_open"), true);
  const third = lab("nw_room"); third.state.take("lemming"); third.state.animals.lemming.active = true;
  assert.match(await command(third, "look"), /scurries off to the north, where you hear a faint creak/);
  assert.equal(third.state.hasFlag("ranch_screen_door_open"), true);
});

test("未知死因尸体不接受溺死别名，也不推进动物回合", async () => {
  const game = lab(); game.state.placeItem("dead_lemming", game.state.room);
  const before = game.state.turns;
  await game.eng.processInput("examine drowned lemming");
  assert.equal(game.state.turns, before);
  assert.match(await command(game, "examine dead lemming"), /It's dead/);
});

test("卧室旅鼠推动第五扇外门，开门后复用原版出口响应", async () => {
  const game = lab("bedroom"); game.state.take("lemming"); game.state.animals.lemming.active = true;
  assert.match(await command(game, "look"), /nudges open the outside door\. Then it scurries out of sight/);
  assert.equal(game.state.hasFlag("ranch_outside_door_open"), true);
  assert.equal(game.state.itemAt("lemming"), "destroyed");
  const other = lab("bedroom"); other.state.setFlag("ranch_outside_door_open");
  other.state.take("lemming"); other.state.animals.lemming.active = true;
  assert.match(await command(other, "look"), /scurries out the open outside door/);
});

test("第五门独自开放也令浴室走鹃逃到前院，五门全闭才转卧室", async () => {
  for (const outsideOpen of [false, true]) {
    const game = lab("bathroom"); game.state.take("roadrunner");
    game.state.animals.roadrunner = { active: true, grace: 0, prepared: true, takeable: true };
    if (outsideOpen) game.state.setFlag("ranch_outside_door_open");
    assert.match(await command(game, "look"), /trots out of sight/);
    assert.equal(game.state.itemAt("roadrunner"), outsideOpen ? "front_yard" : "bedroom");
  }
});

test("花园天秤座白门分支移除旅鼠，不顺带开小屋门", async () => {
  const game = lab("herb_garden"); game.state.sundialSymbol = 5;
  game.state.take("lemming"); game.state.animals.lemming.active = true;
  assert.match(await command(game, "look"), /scurries through the open white door/);
  assert.equal(game.state.itemAt("lemming"), "destroyed");
  assert.equal(game.state.hasFlag("cottage_back_open"), false);
  assert.equal(game.state.hasFlag("cottage_front_open"), false);
});

test("花园白门未开放时旅鼠开后门并令关着的前门吱呀打开，已开不重播", async () => {
  for (const wasOpen of [false, true]) {
    const game = lab("herb_garden"); game.state.sundialSymbol = 0;
    if (wasOpen) { game.state.setFlag("cottage_back_open"); game.state.setFlag("cottage_front_open"); }
    game.state.take("lemming"); game.state.animals.lemming.active = true;
    const response = await command(game, "look");
    if (wasOpen) {
      assert.match(response, /scurries out the open back door/);
      assert.doesNotMatch(response, /faint creak/);
    } else assert.match(response, /nudges open the back door[\s\S]*You hear a faint creak in the cottage/);
    assert.equal(game.state.hasFlag("cottage_back_open"), true);
    assert.equal(game.state.hasFlag("cottage_front_open"), true);
    assert.equal(game.state.itemAt("lemming"), "destroyed");
  }
});
