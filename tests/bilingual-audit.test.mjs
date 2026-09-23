import assert from "node:assert/strict";
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
  assert.deepEqual(Object.keys(request.questions), [
    "bi_d3c7a0ce6b152ac6__negation",
    "bi_d3c7a0ce6b152ac6__direction",
    "bi_d3c7a0ce6b152ac6__object",
    "bi_d3c7a0ce6b152ac6__puzzle_clue",
  ]);
  for (const question of Object.values(request.questions)) {
    assert.equal(question.type, "choice");
    assert.match(question.instructions, /do not rewrite/i);
    assert.match(question.instructions, /do not certify/i);
    assert.deepEqual(Object.keys(question.criteria), ["consistent", "possible_mismatch", "insufficient_context"]);
  }
});
