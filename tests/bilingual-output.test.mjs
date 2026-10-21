import assert from "node:assert/strict";
import test from "node:test";
import { createGame, command } from "./harness.mjs";
import { CHAPTERS } from "./chapters.mjs";
import { ITEMS } from "../prototype/js/data/items.js";
import { tickAnimals, tickSnakeBite, prepareRoadrunnerForDesert, enterRoadrunnerTower } from "../prototype/js/animal-rules.js";
import { ui } from "../prototype/js/ui.js";

const CJK = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/;
function assertBilingual(text, label) {
  const paragraphs = text.trim().split(/\n{2,}/).filter(Boolean);
  for (let i = 0; i < paragraphs.length; i++) {
    const paragraph = paragraphs[i];
    if (!CJK.test(paragraph) && /[a-z]/i.test(paragraph)) {
      assert.ok(CJK.test(paragraphs[i + 1] || ""), `${label}：英文段后缺中文：${paragraph}`);
    } else if (CJK.test(paragraph)) {
      assert.ok(!paragraph.split("\n").some(line => /[a-z]/i.test(line) && !CJK.test(line)),
        `${label}：中英文须用空行分段：${paragraph}`);
    }
  }
}
function checkOutput(game) {
  for (const entry of game.output.filter(entry => entry.type === "text" && entry.text.trim())) {
    assertBilingual(entry.text, game.state.room);
  }
}
function findOutput(game, pattern) {
  const entry = game.output.find(entry => entry.type === "text" && pattern.test(entry.text));
  assert.ok(entry, `没有实际输出 ${pattern}`);
  assertBilingual(entry.text, String(pattern));
  return entry.text;
}
async function loadedGame(room) {
  const game = createGame();
  for (const chapter of CHAPTERS) await game.eng.activateChapter(chapter.id);
  game.state.clearTimer();
  game.state.room = room;
  game.output.length = 0;
  return game;
}
async function cagedAnimal(room, id, flags = []) {
  const game = await loadedGame(room);
  game.state.destroy("magpie");
  game.state.take("cage");
  game.state.putIn(id, "cage");
  game.state.setFlag("cage_open");
  for (const flag of flags) game.state.setFlag(flag);
  game.state.animals[id].active = true;
  game.state.animals[id].grace = 0;
  return game;
}

test("每条实际叫卖均有独立中文，不被wait或房间的其他中文掩盖", async () => {
  const game = createGame();
  for (const input of ["n", "wait", "look"]) {
    game.output.length = 0;
    await command(game, input);
    const cry = findOutput(game, /cries the bird woman/);
    assert.match(cry, /三十便士/);
    checkOutput(game);
  }
  const before = game.state.turns;
  game.state.setFlag("birds_fed");
  game.output.length = 0;
  await command(game, "wait");
  assert.equal(game.state.turns, before + 1);
  assert.doesNotMatch(game.output.map(e => e.text).join("\n"), /bird woman/);
});

test("叫卖现有六个文本变体都跟随中文，英文句式保留", async () => {
  const game = createGame();
  game.eng.moveTo("broad_walk");
  const cries = [
    ['"Feed the birds! Thirty p!" cries the bird woman.', /喂鸟吧！三十便士/],
    ['"Thirty p! Thirty p a bag!" hollers the bird woman.', /一袋三十便士/],
    ['"Feed the hungry birds!" calls the bird woman.', /饥饿/],
    ['"Thirty p for the starving birds!" yells the bird woman.', /饿/],
    ['"Thirty p!"', /三十便士/],
    ['"Feed the birds!" cries the bird woman.', /喂鸟/],
  ];
  for (const [i, [english, chinese]] of cries.entries()) {
    game.state.setCnt("turn", i); // 覆盖已有选择分支，不改变运行时的回合选择逻辑。
    game.output.length = 0;
    await command(game, "wait");
    const output = game.output.find(e => e.type === "text" && e.text.trim().startsWith(english));
    assert.ok(output, english);
    assertBilingual(output.text, english);
    assert.match(output.text, chinese);
  }
});

test("序章三处引语完整带作者中文，叙述与引语分别配对", async () => {
  const game = createGame();
  game.output.length = 0;
  game.state.timer.remaining = 11;
  await command(game, "wait");
  assert.match(findOutput(game, /Henry David Thoreau/), /梭罗/);
  game.state.clearTimer();
  game.eng.moveTo("the_wabe");
  game.output.length = 0;
  await command(game, "examine sundial");
  assert.match(findOutput(game, /Lewis Carroll/), /卡罗尔/);
  game.eng.moveTo("inverness_terrace");
  game.state.setCnt("boy_cycle", 1);
  game.output.length = 0;
  await command(game, "wait");
  assert.match(findOutput(game, /Alexander Pope/), /蒲柏/);
  checkOutput(game);
});

test("所有房间初始描述与静态事件逐段中英对照", async () => {
  const game = await loadedGame("palace_gate");
  for (const chapter of CHAPTERS) {
    const rooms = chapter.rooms || (await chapter.loader()).ROOMS;
    for (const [id, room] of Object.entries(rooms)) {
      game.state.room = id;
      assertBilingual(typeof room.desc === "function" ? room.desc(game.state, game.eng) : room.desc, `${id}.desc`);
      for (const event of room.events || []) {
        if (typeof event.text === "string" && event.text) assertBilingual(event.text, `${id}.${event.id}`);
      }
    }
  }
});

test("全部物品显示字段分别成段，纸鸟线索离开Round Pond后仍有译文", async () => {
  const game = await loadedGame("palace_gate");
  for (const unfolded of [false, true]) {
    if (unfolded) game.state.setFlag("bird_unfolded");
    for (const [id, item] of Object.entries(ITEMS)) {
      for (const field of ["desc", "roomDesc", "takeTxt", "fixedMsg"]) {
        const text = typeof item[field] === "function" ? item[field](game.state) : item[field];
        if (typeof text === "string" && text) assertBilingual(text, `${id}.${field}`);
      }
    }
  }
  game.state.take("paper_bird");
  game.output.length = 0;
  await command(game, "examine paper");
  assert.match(findOutput(game, /Long Water, Four O'Clock/), /长水湖，四点钟/);
  game.state.take("soap_bubble");
  game.output.length = 0;
  await command(game, "examine bubble");
  assert.match(findOutput(game, /It might protect you/), /恶劣.*保护/);
});

test("旅鼠逃走翻译保留开门条件、门型和方向", async () => {
  for (const [room, flag, doorCN] of [
    ["cottage", "cottage_front_open", "前门"],
    ["se_room", "front_deck_left_door_open", "前门"],
    ["kitchen", "ranch_outer_door_open", "外门"],
    ["spare_room", "ranch_screen_door_open", "纱门"],
    ["bedroom", "ranch_outside_door_open", "外门"],
    ["herb_garden", "cottage_back_open", "后门"],
  ]) {
    for (const wasOpen of [false, true]) {
      const game = await cagedAnimal(room, "lemming", wasOpen ? [flag] : []);
      tickAnimals(game.eng);
      const text = findOutput(game, /The lemming scrambles/);
      assert.ok(text.includes(doorCN));
      assert.match(text, wasOpen ? /敞开/ : /顶开/);
      if (room === "se_room") assert.match(text, /北.*门槛.*翻转/);
      assert.equal(game.state.hasFlag(flag), true);
      assert.equal(game.state.itemAt("lemming"), "destroyed");
    }
  }
  for (const [room, direction] of [["nw_room", "北"], ["bathroom", "南"]]) {
    for (const wasOpen of [false, true]) {
      const game = await cagedAnimal(room, "lemming", wasOpen ? ["ranch_screen_door_open"] : []);
      tickAnimals(game.eng);
      const text = findOutput(game, /The lemming scrambles/);
      assert.ok(text.includes(`向${direction}`));
      assert.equal(text.includes("吱呀"), !wasOpen);
    }
  }
});

test("走鹃逃走中文保留门型、回望、楼梯和平台/向西", async () => {
  for (const [room, english, chinese] of [
    ["kitchen", /nudges open the outer door/, /外门.*狡黠/],
    ["spare_room", /nudges open the screen door/, /纱门.*狡黠/],
    ["icehouse", /scoots up the stairs/, /沿楼梯跑上/],
    ["hallway", /scoots off down the hall/, /沿走廊/],
    ["shack", /disappears to the west/, /向西/],
    ["tower_platform", /over the side of the platform/, /越过平台边缘/],
  ]) {
    const game = await cagedAnimal(room, "roadrunner");
    tickAnimals(game.eng);
    const text = findOutput(game, english);
    assert.match(text, /走鹃跳出鸟笼/);
    assert.match(text, chinese);
    assert.equal(game.state.containerOf("roadrunner"), null);
  }
});

test("共享动物多段叙事与黑暗听觉分支分别配对", async () => {
  const tower = await loadedGame("base_of_tower");
  prepareRoadrunnerForDesert(tower.state);
  enterRoadrunnerTower(tower.state, tower.eng);
  assertBilingual(findOutput(tower, /A familiar roadrunner/), "塔底走鹃");
  const game = await cagedAnimal("closet", "lemming", ["closet_door_closed"]);
  game.state.animals.lemming.grace = 1;
  tickAnimals(game.eng);
  assert.match(findOutput(game, /You hear the lemming scampering/), /你听到旅鼠/);
});

test("蛇咬结局中不同位置的光源及倒地译文与英文一致", async () => {
  for (const [room, english, chinese, floor] of [
    ["closet", /cracks in the north wall/, /北墙的裂缝/, "地板"],
    ["hallway", /hallway is filled/, /走廊充满/, "地板"],
    ["underwater", /water around you/, /周围的水/, "地板"],
    ["kitchen", /windows are filled/, /窗户里/, "地板"],
    ["front_yard", /desert around you disappears/, /沙漠.*闪光中消失/, "地面"],
  ]) {
    const game = await loadedGame(room);
    game.state.setFlag("snake_bitten"); game.state.setCnt("snake_bite_turn", 0); game.state.turns = 1;
    assert.equal(tickSnakeBite(game.eng), true);
    const text = findOutput(game, english);
    assert.match(text, chinese);
    assert.ok(text.includes(floor));
    assert.equal(game.state.dead, true);
  }
});

test("真实UI把原文和译文分别标记，中文里的英文地名不改变语言分类", () => {
  const game = createGame();
  game.eng.moveTo("broad_walk");
  const text = game.eng.currentRoom().desc(game.state);
  let rendered = "";
  ui.text.call({ _append(html) { rendered = html; } }, text);
  const languages = [...rendered.matchAll(/class="scene-text lang-(en|zh)"/g)].map(match => match[1]);
  assert.ok(languages.length >= 6);
  assert.deepEqual(languages, languages.map((_, i) => i % 2 ? "zh" : "en"));
  ui.text.call({ _append(html) { rendered = html; } }, 'Broad Walk\n\n沿 Broad Walk 前进。');
  assert.match(rendered, /lang-en.*lang-zh/);
});
