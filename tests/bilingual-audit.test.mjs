import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { auditBilingualContent, buildJevDryRunRequest } = require("../scripts/audit_bilingual_content.js");
const root = path.resolve(".");
const fixture = path.join(root, "tests", "fixtures", "bilingual-audit-source.js");

test("双语审查提取具确定性，并为高语义风险文本建立 advisory 队列", () => {
  const first = auditBilingualContent(fixture, root);
  const second = auditBilingualContent(fixture, root);

  assert.deepEqual(first, second);
  assert.equal(first.items.length, 3);
  assert.equal(first.reviewQueue.length, 2);
  assert.deepEqual(first.reviewQueue[0].reviewRubrics, ["negation", "direction", "object", "puzzle_clue"]);
  assert.deepEqual(first.reviewQueue[1].reviewRubrics, ["object", "puzzle_clue"]);
  assert.match(first.items[0].id, /^bi_[0-9a-f]{16}$/);
  assert.equal(first.items[1].reviewRubrics.length, 0);
  assert.equal(first.reviewQueue[0].disposition, "advisory_review_required");
  assert.match(first.limitations.join(" "), /do not decide semantic equivalence/);
});

test("Jev dry-run 请求是有界的原生咨询审查，并不自动改写或认证", () => {
  const request = buildJevDryRunRequest(auditBilingualContent(fixture, root), { limit: 1 });
  assert.equal(request.model, "typesafe/jev-1.13");
  assert.equal(Object.keys(request.state.records).length, 1);
  assert.equal(Object.keys(request.questions).length, 4);
  const id = Object.keys(request.state.records)[0];
  assert.deepEqual(Object.keys(request.questions), ["negation", "direction", "object", "puzzle_clue"].map((rubric) => `${id}__${rubric}`));
  for (const question of Object.values(request.questions)) {
    assert.equal(question.type, "choice");
    assert.match(question.instructions, /do not rewrite/i);
    assert.match(question.instructions, /do not certify/i);
    assert.deepEqual(Object.keys(question.criteria), ["consistent", "possible_mismatch", "insufficient_context"]);
  }
});

test("拼接字符串和单换行的双语段落会被审查，重复来源不改变内容 ID", () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "trinity-bilingual-"));
  const file = path.join(temp, "sample.js");
  try {
    const text = 'const first = "Go north.\\n" + "向北走。";\n';
    fs.writeFileSync(file, text);
    const original = auditBilingualContent(file, temp);
    assert.equal(original.items.length, 1);
    assert.equal(original.items[0].english, "Go north.");
    assert.equal(original.items[0].chinese, "向北走。");
    fs.writeFileSync(file, 'const inserted = "Go north.\\n向北走。";\n' + text);
    const withCopy = auditBilingualContent(file, temp);
    assert.equal(withCopy.items.length, 1);
    assert.equal(withCopy.items[0].id, original.items[0].id);
    assert.equal(withCopy.items[0].occurrences.length, 2);
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});

test("真实章节中的跨字面量描述进入双语清单", () => {
  const report = auditBilingualContent(path.join(root, "prototype", "js", "data"), root);
  assert.ok(report.items.some((item) => item.english.includes("A tide of perambulators surges north")));
  assert.ok(report.items.some((item) => item.english.includes("This grassy clearing is only twenty feet across")));
  assert.ok(report.items.some((item) => item.english.includes("You see nothing unusual about the soccer ball")));
});
