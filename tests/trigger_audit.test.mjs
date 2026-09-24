import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { auditEventTriggers, formatSummary } from "../scripts/audit_event_triggers.mjs";

const baseline = JSON.parse(await readFile(new URL("./fixtures/trigger-audit-baseline.json", import.meta.url)));

test("authored triggers retain the structural compatibility baseline", async () => {
  const audit = await auditEventTriggers();
  const ids = audit.records.map((record) => record.id);

  assert.equal(new Set(ids).size, ids.length, "trigger record IDs must be unique");
  assert.ok(audit.records.every((record) =>
    record.id === `${record.chapterId}/${record.roomId}/${record.eventId}/${record.triggerId}`),
  "record ID must preserve chapter, room, event, and trigger IDs");
  assert.deepEqual(
    {
      schemaVersion: audit.schemaVersion,
      summary: audit.summary,
    },
    baseline,
  );
});

test("audit summary states its structural-only scope", async () => {
  const summary = formatSummary(await auditEventTriggers());
  assert.match(summary, /Parser\.parse \+ GameEngine\._matchCommand only/);
  assert.match(summary, /no predicates, execution, gameplay-success, availability, or semantic-equivalence assertions/);
});
