import assert from "node:assert/strict";
import test from "node:test";
import { createGame } from "./harness.mjs";

function treeEvent(eng) {
  return eng.rooms.lancaster_gate.events.find((event) => event.id === "throw_ball_tree");
}

function prepareTreePuzzle(game) {
  game.state.room = "lancaster_gate";
  game.state.take("ball");
  game.state.placeItem("umbrella", "lancaster_gate_tree");
}

test("旧对象形 match 保持兼容，只有声明的介词才参与校验", () => {
  const { eng } = createGame();
  const malformed = eng.parser.parse("throw ball with tree");

  assert.equal(eng._matchCommand(malformed, {
    verb: "throw", noun: "ball", noun2: "tree",
  }), true);
  assert.equal(eng._matchCommand(malformed, {
    verb: "throw", noun: "ball", prep: "at", noun2: "tree",
  }), false);
  assert.equal(eng._matchCommand(eng.parser.parse("throw ball at tree"), {
    verb: "throw", noun: "ball", prep: ["at", "toward"], noun2: "tree",
  }), true);
});

test("树谜题的 alternatives 明确区分目标和工具角色", () => {
  const { eng } = createGame();
  const match = treeEvent(eng).match;
  const accepted = [
    "throw ball at tree",
    "hit tree with ball",
    "用球打树",
    "用球砸伞",
  ];
  const rejected = [
    "throw ball with tree",
    "hit ball with tree",
    "用树砸球",
  ];

  for (const input of accepted) {
    const cmd = eng.parser.parse(input);
    assert.ok(cmd, `${input} 应被 parser 解析`);
    assert.equal(eng._matchCommand(cmd, match), true, `${input} 应匹配树谜题`);
  }
  for (const input of rejected) {
    const cmd = eng.parser.parse(input);
    assert.ok(cmd, `${input} 应被 parser 解析`);
    assert.equal(eng._matchCommand(cmd, match), false, `${input} 不应匹配树谜题`);
  }
});

for (const input of ["throw ball at tree", "hit tree with ball", "用球砸伞"]) {
  test(`树谜题可执行正确角色命令：${input}`, async () => {
    const game = createGame();
    prepareTreePuzzle(game);

    await game.eng.processInput(input);

    assert.equal(game.state.itemAt("ball"), "destroyed");
    assert.equal(game.state.itemAt("umbrella"), "lancaster_gate");
    assert.equal(game.state.hasFlag("ball_in_tree"), true);
  });
}

test("错误介词不会执行树谜题", async () => {
  const game = createGame();
  prepareTreePuzzle(game);

  await game.eng.processInput("throw ball with tree");

  assert.equal(game.state.itemAt("ball"), "inventory");
  assert.equal(game.state.itemAt("umbrella"), "lancaster_gate_tree");
  assert.equal(game.state.hasFlag("ball_in_tree"), false);
  assert.match(game.output.at(-1).text, /无法识别/);
});
