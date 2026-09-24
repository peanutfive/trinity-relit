#!/usr/bin/env node

// Development-time compatibility audit for authored event triggers.  It uses
// the production Parser and GameEngine matcher, but deliberately never calls
// event predicates or actions.
import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { CHAPTERS } from "../prototype/js/chapters.mjs";
import { ITEMS } from "../prototype/js/data/items.js";
import { GameEngine } from "../prototype/js/engine.js";
import { Parser } from "../prototype/js/parser.js";

const SCHEMA_VERSION = 1;

async function loadChapters() {
  return Promise.all(CHAPTERS.map(async (chapter) => ({
    id: chapter.id,
    rooms: chapter.rooms || (await chapter.loader()).ROOMS,
  })));
}

function createMatcher(parser) {
  // _matchCommand only needs the item table through _nounMatch.  Keeping the
  // real engine instance ensures this audit follows production matching code.
  return new GameEngine({
    rooms: {},
    items: ITEMS,
    parser,
    embedding: null,
    ui: {},
  });
}

function recordId(chapterId, roomId, eventId, triggerIndex) {
  return `${chapterId}/${roomId}/${eventId}/trigger-${triggerIndex}`;
}

function emptyCounts() {
  return {
    rooms: 0,
    events: 0,
    triggers: 0,
    auditedTriggers: 0,
    matched: 0,
    structuralMisses: 0,
    unparsed: 0,
    withoutMatchDefinition: 0,
  };
}

function countRecord(counts, status) {
  counts.triggers++;
  if (status === "no_match_definition") {
    counts.withoutMatchDefinition++;
    return;
  }
  counts.auditedTriggers++;
  if (status === "matched") counts.matched++;
  else if (status === "unparsed") counts.unparsed++;
  else counts.structuralMisses++;
}

export async function auditEventTriggers() {
  const parser = new Parser();
  const matcher = createMatcher(parser);
  const chapters = await loadChapters();
  const totals = emptyCounts();
  const chapterSummaries = [];
  const records = [];

  for (const chapter of chapters) {
    const counts = emptyCounts();
    const roomEntries = Object.entries(chapter.rooms);
    counts.rooms = roomEntries.length;
    totals.rooms += counts.rooms;

    for (const [roomId, room] of roomEntries) {
      for (const event of room.events || []) {
        counts.events++;
        totals.events++;
        for (const [triggerIndex, trigger] of (event.triggers || []).entries()) {
          if (typeof trigger !== "string") {
            throw new TypeError(`${chapter.id}/${roomId}/${event.id}: trigger ${triggerIndex} is not a string`);
          }
          const parsed = parser.parse(trigger);
          const status = !event.match ? "no_match_definition"
            : !parsed ? "unparsed"
            : matcher._matchCommand(parsed, event.match) ? "matched" : "structural_miss";
          countRecord(counts, status);
          countRecord(totals, status);
          records.push({
            id: recordId(chapter.id, roomId, event.id, triggerIndex),
            chapterId: chapter.id,
            roomId,
            eventId: event.id,
            triggerId: `trigger-${triggerIndex}`,
            trigger,
            parsed,
            status,
          });
        }
      }
    }
    chapterSummaries.push({ chapterId: chapter.id, ...counts });
  }

  const recordBytes = JSON.stringify(records);
  return {
    schemaVersion: SCHEMA_VERSION,
    audit: "parser_and_event_matcher_structural_compatibility",
    limitations: [
      "Does not evaluate event when predicates.",
      "Does not execute events or generic handlers.",
      "Does not assert gameplay success, availability, or semantic equivalence.",
    ],
    summary: {
      chapters: chapters.length,
      ...totals,
      unmatched: totals.structuralMisses + totals.unparsed,
      recordsSha256: createHash("sha256").update(recordBytes).digest("hex"),
    },
    chapters: chapterSummaries,
    records,
  };
}

export function formatSummary(result) {
  const { summary } = result;
  return [
    "Event trigger structural compatibility audit",
    `chapters=${summary.chapters} rooms=${summary.rooms} events=${summary.events} triggers=${summary.triggers} audited_triggers=${summary.auditedTriggers}`,
    `matched=${summary.matched} structural_misses=${summary.structuralMisses} unparsed=${summary.unparsed} unmatched=${summary.unmatched} without_match_definition=${summary.withoutMatchDefinition}`,
    `records_sha256=${summary.recordsSha256}`,
    "Scope: Parser.parse + GameEngine._matchCommand only; no predicates, execution, gameplay-success, availability, or semantic-equivalence assertions.",
  ].join("\n");
}

async function main(args) {
  let jsonPath = null;
  for (let index = 0; index < args.length; index++) {
    if (args[index] === "--json") jsonPath = args[++index];
    else if (args[index] === "--help") {
      console.log("Usage: node scripts/audit_event_triggers.mjs [--json <path|->]");
      return;
    } else {
      throw new Error(`Unknown argument: ${args[index]}`);
    }
  }
  if (args.includes("--json") && !jsonPath) throw new Error("--json requires a path or -");

  const result = await auditEventTriggers();
  const json = `${JSON.stringify(result, null, 2)}\n`;
  if (jsonPath === "-") {
    process.stdout.write(json);
    console.error(formatSummary(result));
  } else {
    if (jsonPath) await writeFile(jsonPath, json);
    console.log(formatSummary(result));
    if (jsonPath) console.log(`json=${jsonPath}`);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  });
}
