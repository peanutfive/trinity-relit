import assert from "node:assert/strict";
import test from "node:test";
import { Parser } from "../prototype/js/parser.js";

const parser = new Parser();

test("英文冠词只从名词槽位移除", () => {
  assert.deepEqual(parser.parse("take the ball"), { type: "simple", verb: "take", noun: "ball" });
  assert.deepEqual(parser.parse("examine an umbrella"), { type: "simple", verb: "examine", noun: "umbrella" });
  assert.deepEqual(parser.parse("put a ball in the box"), {
    type: "compound", verb: "put", noun: "ball", prep: "in", noun2: "box",
  });
  assert.deepEqual(parser.parse("take the"), { type: "simple", verb: "take", noun: "the" });
});

test("英文短语动词和环顾指令保留确定性含义", () => {
  assert.deepEqual(parser.parse("pick up the ball"), { type: "simple", verb: "take", noun: "ball" });
  assert.deepEqual(parser.parse("look at the soccer ball"), { type: "simple", verb: "examine", noun: "soccer ball" });
  assert.deepEqual(parser.parse("look around"), { type: "meta", cmd: "look" });
  assert.deepEqual(parser.parse("look around the tree"), {
    type: "simple", verb: "look", noun: "around the tree",
  });
});

test("明确的中文礼貌前缀和指示词会被规范化", () => {
  assert.deepEqual(parser.parse("请帮我捡起那个足球"), { type: "simple", verb: "take", noun: "足球" });
  assert.deepEqual(parser.parse("请你看这个球"), { type: "simple", verb: "examine", noun: "球" });
  assert.deepEqual(parser.parse("请把那个球扔向这个树"), {
    type: "compound", verb: "throw", noun: "球", prep: "at", noun2: "树",
  });
  assert.deepEqual(parser.parse("拿那个"), { type: "simple", verb: "take", noun: "那个" });
});

test("否定、未知礼貌语和混合输入不被吞掉或改写", () => {
  for (const input of [
    "do not take the ball", "don't pick up the ball",
    "不拿那个足球", "不要拿那个足球", "请不要拿那个足球", "请帮我不要捡起那个足球",
    "劳驾拿足球", "请 take the ball",
  ]) {
    assert.equal(parser.parse(input), null, input);
  }
});
