import test from "node:test";
import assert from "node:assert/strict";
import { createGame, command } from "./harness.mjs";
import { ITEMS } from "../prototype/js/data/items.js";
import { GameEngine } from "../prototype/js/engine.js";
import { Parser } from "../prototype/js/parser.js";
import { handleItemAction, getItemActionCandidates, wetItems } from "../prototype/js/item-rules.js";

function lab() {
  const game = createGame();
  game.state.timer = null;
  game.eng.rooms.container_lab = { name: "试验地点", cn: "试验地点", desc: "试验地点。", exits: {}, events: [] };
  game.state.room = "container_lab";
  return game;
}

test("三个原版袋对象保留独立属性，纸鸟展开后SIZE从7变3", () => {
  for (const [id, size, mass, capacity] of [["bag", 3, 2, 0], ["empty_bag", 3, 1, 3], ["soggy_bag", 3, 1, 3]]) {
    assert.equal(ITEMS[id].size, size); assert.equal(ITEMS[id].mass, mass); assert.equal(ITEMS[id].capacity, capacity);
  }
  const { eng, state } = lab();
  assert.equal(eng.itemProperty("paper_bird", "size"), 7);
  state.setFlag("bird_unfolded");
  assert.equal(eng.itemProperty("paper_bird", "size"), 3);
});

test("购买发放5把，首次喂鸟保留袋子，最后一把才换成空纸袋", async () => {
  const game = lab(); game.state.room = "broad_walk";
  await command(game, "buy bag");
  assert.equal(game.state.cnt("crumbs_remaining"), 5);
  await command(game, "feed birds");
  assert.equal(game.state.cnt("crumbs_remaining"), 4);
  assert.equal(game.state.carrying("bag"), true);
  assert.equal(game.state.hasFlag("ruby_visible"), true);
  for (let left = 3; left >= 0; left--) {
    const response = await command(game, "feed birds");
    assert.equal(game.state.cnt("crumbs_remaining"), left);
    assert.doesNotMatch(response, /glint of red|bigger than a walnut/);
  }
  assert.equal(game.state.itemAt("bag"), "destroyed");
  assert.equal(game.state.carrying("empty_bag"), true);
  assert.equal(game.state.score, 1);
});

test("旧档缺失面包屑计数时按5把开始，查看按原版显示剩余量", async () => {
  const game = lab(); game.state.take("bag");
  assert.match(await command(game, "look in bag"), /several handfuls/);
  game.state.setCnt("crumbs_remaining", 3);
  assert.match(await command(game, "look in bag"), /a couple of handfuls/);
  game.state.setCnt("crumbs_remaining", 1);
  assert.match(await command(game, "look in bag"), /only one more handful/);
});

test("倒空满袋原处换空袋，清空变量，掉地袋子不能隔空倒空", async () => {
  const game = lab(); game.eng.rooms.south_reservoir = game.eng.rooms.container_lab;
  game.state.room = "south_reservoir"; game.state.take("bag");
  game.state.setCnt("crumbs_appetite", 3);
  assert.match(await command(game, "empty bag"), /纸袋空了/);
  assert.equal(game.state.carrying("empty_bag"), true);
  assert.equal(game.state.cnt("crumbs_appetite"), 0);
  game.state.destroy("empty_bag"); game.state.placeItem("bag", "south_reservoir");
  assert.match(await command(game, "empty bag"), /You're not holding the bag of crumbs/);
  assert.equal(game.state.inRoom("bag"), true);
});

test("Broad Walk购买后直接EMPTY仍发现红宝石，拿宝石可继续触发风变", async () => {
  const game = lab(); game.state.room = "broad_walk";
  await command(game, "buy bag");
  const response = await command(game, "empty bag");
  assert.match(response, /a glint of red|bigger than a walnut/);
  assert.equal(game.state.hasFlag("ruby_visible"), true);
  assert.equal(game.state.carrying("empty_bag"), true);
  await command(game, "take ruby");
  assert.equal(game.state.hasFlag("wind_changed"), true);
});

test("EMPTY有卡空袋默认逐项拿到手，空EMPTY也推进一回合", async () => {
  const game = lab(); game.state.take("empty_bag"); game.state.putIn("credit_card", "empty_bag");
  const before = game.state.turns;
  assert.match(await command(game, "empty bag"), /The credit card: Taken/);
  assert.equal(game.state.carrying("credit_card"), true);
  assert.equal(game.state.turns, before + 1);
  assert.match(await command(game, "empty bag"), /There's nothing in the paper bag/);
  assert.equal(game.state.turns, before + 2);
});

test("EMPTY遵守8件顶层手持限制，不把拿不下的内容丢地", async () => {
  const game = lab(); game.state.take("empty_bag"); game.state.putIn("credit_card", "empty_bag");
  for (const id of ["bag", "ball", "umbrella", "gnomon", "ruby", "spade", "bandage"]) game.state.take(id);
  const result = await command(game, "empty paper bag");
  assert.match(result, /拿不下/);
  assert.equal(game.state.containerOf("credit_card"), "empty_bag");
});

test("满袋、空袋、湿袋关闭均有专用拒绝并推进，已开不能重复开", async () => {
  for (const id of ["bag", "empty_bag", "soggy_bag"]) {
    const game = lab(); game.state.take(id); const before = game.state.turns;
    assert.match(await command(game, `close ${ITEMS[id].aliases[0]}`), /refuses to stay closed/);
    assert.equal(game.state.turns, before + 1);
    assert.match(await command(game, `open ${ITEMS[id].aliases[0]}`), /It's already open/);
  }
});

test("装卡纸袋入口袋被拒，空袋可入口袋但必须先拿出再装卡", async () => {
  const game = lab(); game.state.take("empty_bag"); game.state.take("credit_card");
  await command(game, "put credit card in bag");
  assert.match(await command(game, "put bag in pocket"), /empty the paper bag/);
  assert.equal(game.state.carrying("empty_bag"), true);
  await command(game, "take credit card from bag");
  await command(game, "put bag in pocket");
  assert.match(await command(game, "put credit card in bag"), /take it out of your pocket first/);
  assert.equal(game.state.carrying("credit_card"), true);
  assert.match(await command(game, "look in bag"), /take it out of your pocket first/);
  await command(game, "take bag from pocket");
  await command(game, "put credit card in bag");
  assert.equal(game.state.containerOf("credit_card"), "empty_bag");
});

test("口袋拒满袋、未展开纸鸟和大物；展开纸片可放入", async () => {
  const game = lab(); game.state.take("bag"); game.state.take("walkie_talkie"); game.state.take("paper_bird");
  assert.match(await command(game, "put bag in pocket"), /empty the bag of crumbs/);
  assert.match(await command(game, "put walkie-talkie in pocket"), /too big to fit/);
  assert.match(await command(game, "put paper bird in pocket"), /would get crumpled/);
  game.state.setFlag("bird_unfolded");
  await command(game, "put paper in pocket");
  assert.equal(game.state.inPocket("paper_bird"), true);
});

test("透明闭笼可见但不能装取，打开可装小袋且大WTK仍拒绝", async () => {
  const game = lab(); game.state.take("cage"); game.state.take("empty_bag"); game.state.take("walkie_talkie");
  assert.match(await command(game, "put paper bag in cage"), /open the birdcage/);
  await command(game, "open cage"); await command(game, "put paper bag in cage");
  assert.match(await command(game, "put walkie-talkie in cage"), /too big to fit/);
  await command(game, "close cage");
  assert.match(await command(game, "look in cage"), /paper bag/);
  assert.equal(game.eng.isVisible("empty_bag"), true);
  assert.equal(game.eng.isAccessible("empty_bag"), false);
  await command(game, "take paper bag from cage");
  assert.equal(game.state.containerOf("empty_bag"), "cage");
  await command(game, "open cage"); await command(game, "take paper bag from cage");
  assert.equal(game.state.carrying("empty_bag"), true);
});

test("按WEIGHT公式允许WTK装空袋，叠加质量超过容量后拒绝", async () => {
  const game = lab(); game.state.take("empty_bag"); game.state.take("walkie_talkie"); game.state.take("bandage");
  // 1 + 5 - SIZE(3) == CAPACITY(3): independent original restored probe passed.
  await command(game, "put walkie-talkie in paper bag");
  assert.equal(game.state.containerOf("walkie_talkie"), "empty_bag");
  assert.match(await command(game, "put walkie-talkie in paper bag"), /already in the paper bag/);
  assert.match(await command(game, "put bandage in paper bag"), /isn't enough room/);
  assert.equal(game.state.carrying("bandage"), true);
  await command(game, "take walkie-talkie from paper bag");
  assert.equal(game.state.carrying("walkie_talkie"), true);
});

test("未知物品属性不默认为0，容量拒绝且不提供装入候选", () => {
  const output = [];
  const eng = new GameEngine({ rooms: { palace_gate: { desc: "", exits: {} } }, items: {
    ...ITEMS, unknown: { en: "test token", cn: "未核实物品", aliases: ["token"], start: "inventory" },
  }, parser: new Parser(), ui: { text: v => output.push(v), system: v => output.push(v) } });
  eng.state.take("empty_bag");
  assert.equal(handleItemAction(eng, { verb: "put", noun: "token", prep: "in", noun2: "bag" }), true);
  assert.match(output.join(""), /暂时无法把这件物品放入这个容器/);
  assert.equal(eng.state.carrying("unknown"), true);
  assert.ok(!getItemActionCandidates(eng).some(c => c.id === "item:unknown:put:empty_bag"));
});

test("普通入水不转移EBAG旧内容，坍塌转移且只有一层受潮", () => {
  for (const mode of ["enter", "mill"]) {
    const game = lab(); game.state.take("empty_bag"); game.state.putIn("credit_card", "empty_bag");
    wetItems(game.state, { mode });
    assert.equal(game.state.itemAt("empty_bag"), "destroyed");
    assert.equal(game.state.carrying("soggy_bag"), true);
    assert.equal(game.state.containerOf("credit_card"), mode === "enter" ? "empty_bag" : "soggy_bag");
    assert.equal(game.eng.isVisible("credit_card"), mode === "mill");
  }
  const game = lab(); game.state.take("cage"); game.state.putIn("empty_bag", "cage");
  game.state.putIn("walkie_talkie", "empty_bag"); wetItems(game.state, { mode: "enter" });
  assert.equal(game.state.hasFlag("walkie_wet"), false);
  assert.equal(game.state.itemAt("empty_bag"), "destroyed");
});

test("已湿袋重复入水不再次替换，新装卡仍能取出", async () => {
  const game = lab(); game.state.take("empty_bag"); wetItems(game.state, { mode: "enter" });
  game.state.take("credit_card"); await command(game, "put credit card in bag");
  wetItems(game.state, { mode: "enter" }); wetItems(game.state, { mode: "mill" });
  assert.equal(game.state.containerOf("credit_card"), "soggy_bag");
  await command(game, "take credit card from bag"); assert.equal(game.state.carrying("credit_card"), true);
});

test("对讲机干态开关和收听、湿态外观及静音分别持久化", async () => {
  const game = lab(); game.state.take("walkie_talkie");
  assert.match(await command(game, "listen to walkie-talkie"), /is silent/);
  assert.match(await command(game, "turn on walkie-talkie"), /You turn on the rocker switch/);
  assert.match(await command(game, "listen to walkie-talkie"), /burst of static/);
  wetItems(game.state, { mode: "enter" });
  assert.match(await command(game, "examine walkie-talkie"), /is dripping wet/);
  assert.match(await command(game, "listen to walkie-talkie"), /is silent/);
  assert.equal(game.state.hasFlag("walkie_on"), true);
  assert.match(await command(game, "turn off walkie-talkie"), /falls silent/);
  assert.equal(game.state.hasFlag("walkie_on"), false);
});

test("shared装入候选在口袋/容量改变后消失，闭容器不泄漏内容", async () => {
  const game = lab(); game.state.take("empty_bag"); game.state.take("credit_card");
  assert.ok(getItemActionCandidates(game.eng).some(c => c.id === "item:credit_card:put:empty_bag"));
  game.state.toPocket("empty_bag");
  assert.ok(!getItemActionCandidates(game.eng).some(c => c.id === "item:credit_card:put:empty_bag"));
  game.eng.items = { ...game.eng.items, box: { en: "box", cn: "箱子", aliases: ["box"], container: true, open: false, size: 3, mass: 1, capacity: 3 } };
  game.state.take("box"); game.state.putIn("credit_card", "box");
  assert.match(await command(game, "look in box"), /is closed/);
  assert.equal(game.eng.isVisible("credit_card"), false);
});

test("未实现的EMPTY INTO不改写成默认拿取，不移动内容物或推进回合", async () => {
  const game = lab(); game.state.take("empty_bag"); game.state.take("cage");
  game.state.putIn("credit_card", "empty_bag");
  const before = game.state.turns;
  await game.eng.processInput("empty bag into cage");
  assert.equal(game.state.containerOf("credit_card"), "empty_bag");
  assert.equal(game.state.turns, before);
});

test("v2旧旅鼠位置迁移为笼内容，闭笼可见而拿取被拒绝", async () => {
  const game = lab(); game.state.take("cage");
  game.state.setFlag("cage_has_lemming"); game.state.moveItem("lemming", "cage");
  const old = { ...game.eng.serialize(), version: 2 };
  delete old.state.animals;
  await game.eng.deserialize(old);
  assert.match(await command(game, "look in cage"), /lemming/);
  assert.equal(game.state.itemAt("lemming"), "in:cage");
  assert.equal(game.state.hasFlag("cage_has_lemming"), false);
  assert.match(await command(game, "take lemming"), /closed/);
  assert.equal(game.state.itemAt("lemming"), "in:cage");
});
