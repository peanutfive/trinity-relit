#!/usr/bin/env node
/*
 * Deterministic, read-only inventory and advisory review queue for the local
 * bilingual chapter text. It deliberately parses source literals rather than
 * importing chapter modules, so review never invokes game code.
 */
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const REPOSITORY_ROOT = path.resolve(__dirname, "..");
const DEFAULT_INPUT = path.join(REPOSITORY_ROOT, "prototype", "js", "data");
const JEV_MODEL = "typesafe/jev-1.13";

const RUBRICS = Object.freeze([
  { id: "negation", question: "Do both languages preserve negation, prohibition, and impossibility?" },
  { id: "direction", question: "Do directions, relative positions, and movement destinations agree?" },
  { id: "object", question: "Do named physical objects and their attributes refer to the same thing?" },
  { id: "puzzle_clue", question: "Do conditions, sequencing, tools, and consequences preserve the playable clue?" },
]);

const SIGNALS = Object.freeze({
  negation: {
    en: /\b(?:no|not|never|neither|nor|cannot|can't|won't|don't|doesn't|didn't|without)\b/gi,
    zh: /不要|不能|不可|无法|没有|未|无|别|不(?=[^\s])/g,
  },
  direction: {
    en: /\b(?:north|south|east|west|northeast|northwest|southeast|southwest|up|down|inside|outside|left|right)\b/gi,
    zh: /东北|西北|东南|西南|北|南|东|西|上|下|里|外|左|右/g,
  },
  object: {
    en: /\b(?:umbrella|door|bird|paper|spade|shovel|ruby|watch|bell|wire|radio|dial|key|box|ball|axe|sword|rope|map|book|coin)\b/gi,
    zh: /雨伞|伞|门|鸟|纸鹤|纸鸟|纸|铲子|铲|红宝石|手表|铃|电线|无线电|旋钮|钥匙|盒|球|斧|剑|绳|地图|书|硬币/g,
  },
  puzzle_clue: {
    en: /\b(?:if|unless|only|before|after|when|until|must|need|require|requires|unlock|open|close|give|use|place|turn|fatal|die|discovered)\b/gi,
    zh: /如果|除非|只有|之前|之后|当|直到|必须|需要|打开|关闭|给|使用|用|放|转|致命|死亡|发现/g,
  },
});

function walkJavaScriptFiles(inputPath) {
  const stat = fs.statSync(inputPath);
  if (stat.isFile()) return inputPath.endsWith(".js") ? [inputPath] : [];
  return fs.readdirSync(inputPath, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name))
    .flatMap((entry) => walkJavaScriptFiles(path.join(inputPath, entry.name)));
}

function lineAt(source, offset) {
  return source.slice(0, offset).split("\n").length;
}

function decodeEscape(source, index) {
  const code = source[index];
  const simple = { n: "\n", r: "\r", t: "\t", b: "\b", f: "\f", v: "\v", 0: "\0" };
  if (Object.hasOwn(simple, code)) return { value: simple[code], end: index + 1 };
  if (code === "\n") return { value: "", end: index + 1 };
  if (code === "\r") return { value: "", end: source[index + 1] === "\n" ? index + 2 : index + 1 };
  if (code === "x" && /^[0-9a-f]{2}$/i.test(source.slice(index + 1, index + 3))) {
    return { value: String.fromCodePoint(parseInt(source.slice(index + 1, index + 3), 16)), end: index + 3 };
  }
  if (code === "u") {
    if (source[index + 1] === "{") {
      const close = source.indexOf("}", index + 2);
      const digits = close === -1 ? "" : source.slice(index + 2, close);
      if (/^[0-9a-f]{1,6}$/i.test(digits)) return { value: String.fromCodePoint(parseInt(digits, 16)), end: close + 1 };
    }
    if (/^[0-9a-f]{4}$/i.test(source.slice(index + 1, index + 5))) {
      return { value: String.fromCharCode(parseInt(source.slice(index + 1, index + 5), 16)), end: index + 5 };
    }
  }
  return { value: code, end: index + 1 };
}

function readQuotedLiteral(source, start) {
  const quote = source[start];
  let value = "";
  let index = start + 1;
  while (index < source.length) {
    const char = source[index];
    if (char === quote) return { end: index + 1, value, dynamic: false };
    if (char === "\\") {
      const decoded = decodeEscape(source, index + 1);
      value += decoded.value;
      index = decoded.end;
      continue;
    }
    value += char;
    index += 1;
  }
  return { end: source.length, value: "", dynamic: true };
}

function skipTemplateExpression(source, start) {
  let depth = 1;
  let index = start;
  while (index < source.length && depth > 0) {
    if (source[index] === "'" || source[index] === '"') {
      index = readQuotedLiteral(source, index).end;
    } else if (source[index] === "`") {
      index = readTemplateLiteral(source, index).end;
    } else if (source[index] === "{") {
      depth += 1;
      index += 1;
    } else if (source[index] === "}") {
      depth -= 1;
      index += 1;
    } else {
      index += 1;
    }
  }
  return index;
}

function readTemplateLiteral(source, start) {
  let value = "";
  let index = start + 1;
  let dynamic = false;
  while (index < source.length) {
    const char = source[index];
    if (char === "`") return { end: index + 1, value, dynamic };
    if (char === "\\") {
      const decoded = decodeEscape(source, index + 1);
      value += decoded.value;
      index = decoded.end;
    } else if (char === "$" && source[index + 1] === "{") {
      dynamic = true;
      index = skipTemplateExpression(source, index + 2);
    } else {
      value += char;
      index += 1;
    }
  }
  return { end: source.length, value: "", dynamic: true };
}

function collectStaticLiterals(source) {
  const literals = [];
  let index = 0;
  while (index < source.length) {
    if (source.startsWith("//", index)) {
      index = source.indexOf("\n", index + 2);
      if (index === -1) break;
    } else if (source.startsWith("/*", index)) {
      const end = source.indexOf("*/", index + 2);
      index = end === -1 ? source.length : end + 2;
    } else if (source[index] === "'" || source[index] === '"' || source[index] === "`") {
      const start = index;
      const literal = source[index] === "`" ? readTemplateLiteral(source, index) : readQuotedLiteral(source, index);
      if (!literal.dynamic) literals.push({ start, value: literal.value });
      index = literal.end;
    } else {
      index += 1;
    }
  }
  return literals;
}

function hasEnglish(text) { return /[A-Za-z]/.test(text); }
function hasChinese(text) { return /[\u3400-\u9fff]/.test(text); }
function normalizeText(text) { return text.replace(/\r\n/g, "\n").trim().replace(/\s+/g, " "); }

function splitBilingualPairs(value) {
  const segments = value.split(/\n[ \t]*\n+/).map((segment) => segment.trim()).filter(Boolean);
  const pairs = [];
  for (let index = 0; index < segments.length - 1; index += 1) {
    if (hasEnglish(segments[index]) && hasChinese(segments[index + 1])) {
      pairs.push({ english: segments[index], chinese: segments[index + 1] });
      index += 1;
    }
  }
  return pairs;
}

function matches(pattern, text) {
  pattern.lastIndex = 0;
  return [...text.matchAll(pattern)].map((match) => match[0]);
}

function reviewSignals(english, chinese) {
  const rubrics = [];
  for (const [rubric, patterns] of Object.entries(SIGNALS)) {
    const en = matches(patterns.en, english);
    const zh = matches(patterns.zh, chinese);
    if (en.length || zh.length) rubrics.push({ rubric, evidence: { english: en, chinese: zh } });
  }
  return rubrics;
}

function makeId(file, english, chinese) {
  const key = [file, normalizeText(english), normalizeText(chinese)].join("\0");
  return `bi_${crypto.createHash("sha256").update(key).digest("hex").slice(0, 16)}`;
}

function auditBilingualContent(inputPath = DEFAULT_INPUT, rootDir = REPOSITORY_ROOT) {
  const items = [];
  for (const filePath of walkJavaScriptFiles(inputPath)) {
    const source = fs.readFileSync(filePath, "utf8");
    const file = path.relative(rootDir, filePath).split(path.sep).join("/");
    for (const literal of collectStaticLiterals(source)) {
      const pairs = splitBilingualPairs(literal.value);
      pairs.forEach((pair, pairIndex) => {
        const id = makeId(file, pair.english, pair.chinese);
        const signals = reviewSignals(pair.english, pair.chinese);
        items.push({
          id,
          source: { file, line: lineAt(source, literal.start), pair: pairIndex + 1 },
          english: pair.english,
          chinese: pair.chinese,
          reviewRubrics: signals.map((signal) => signal.rubric),
          signals,
        });
      });
    }
  }
  items.sort((a, b) => a.source.file.localeCompare(b.source.file) || a.source.line - b.source.line || a.source.pair - b.source.pair || a.id.localeCompare(b.id));
  const seenIds = new Map();
  for (const item of items) {
    const occurrence = seenIds.get(item.id) || 0;
    seenIds.set(item.id, occurrence + 1);
    if (occurrence) item.id = `${item.id}_${occurrence + 1}`;
  }
  const reviewQueue = items.filter((item) => item.reviewRubrics.length > 0).map((item) => ({
    id: item.id,
    source: item.source,
    english: item.english,
    chinese: item.chinese,
    reviewRubrics: item.reviewRubrics,
    signals: item.signals,
    disposition: "advisory_review_required",
  }));
  return {
    schemaVersion: 1,
    scope: "local static JavaScript bilingual literals",
    rubrics: RUBRICS,
    limitations: [
      "Signals select review candidates; they do not decide semantic equivalence.",
      "This report neither rewrites text nor certifies translation fidelity.",
      "Dynamic template expressions and non-JavaScript sources are outside this extractor's scope.",
    ],
    items,
    reviewQueue,
  };
}

function buildJevDryRunRequest(report, { offset = 0, limit = 10 } = {}) {
  const records = report.reviewQueue.slice(offset, offset + limit);
  const stateRecords = Object.fromEntries(records.map((item) => [item.id, {
    source: item.source,
    english: item.english,
    chinese: item.chinese,
    selectedRubrics: item.reviewRubrics,
    lexicalSignals: item.signals,
  }]));
  const rubricQuestions = Object.fromEntries(report.rubrics.map((rubric) => [rubric.id, rubric.question]));
  const questions = {};
  for (const item of records) {
    for (const rubric of item.reviewRubrics) {
      questions[`${item.id}__${rubric}`] = {
        type: "choice",
        instructions: `Evaluate only state.records.${item.id} for the ${rubric} rubric. Judge the supplied bilingual pair, not the lexical signal itself. Return an advisory assessment only: do not rewrite text and do not certify translation fidelity.`,
        criteria: {
          consistent: "The supplied English and Chinese preserve the relevant meaning; no material discrepancy is evident in this isolated pair.",
          possible_mismatch: "The supplied pair appears to differ in the relevant meaning and needs human editorial follow-up.",
          insufficient_context: "The isolated pair does not provide enough context to assess this rubric reliably.",
        },
      };
    }
  }
  return {
    model: JEV_MODEL,
    state: {
      goal: "Assess selected local bilingual pairs as an advisory review queue. Do not modify source content.",
      constraints: [
        "Evaluate only the stated rubric for each record.",
        "A result is advisory and requires human editorial review before any content change.",
        "Do not generate replacement translation text or certify fidelity.",
      ],
      rubrics: rubricQuestions,
      records: stateRecords,
      missingEvidence: "No broader story context is supplied beyond each extracted bilingual pair and its lexical signals.",
    },
    questions,
  };
}

// Kept as a small compatibility alias for local callers of the initial script.
function buildDryRunRequest(report, options) { return buildJevDryRunRequest(report, options); }

function parseNonNegativeInteger(value, flag) {
  if (!/^\d+$/.test(value)) throw new Error(`${flag} requires a non-negative integer`);
  return Number(value);
}

function parseArgs(args) {
  const options = { input: DEFAULT_INPUT, output: null, dryRun: null, reviewOffset: 0, reviewLimit: 10 };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--input" || arg === "--out" || arg === "--dry-run" || arg === "--review-offset" || arg === "--review-limit") {
      const value = args[++index];
      if (!value) throw new Error(`${arg} requires a path`);
      if (arg === "--input") options.input = path.resolve(value);
      if (arg === "--out") options.output = path.resolve(value);
      if (arg === "--dry-run") options.dryRun = path.resolve(value);
      if (arg === "--review-offset") options.reviewOffset = parseNonNegativeInteger(value, arg);
      if (arg === "--review-limit") options.reviewLimit = parseNonNegativeInteger(value, arg);
    } else if (arg === "--help") {
      return { help: true };
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return options;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    process.stdout.write("Usage: node scripts/audit_bilingual_content.js [--input path] [--out report.json] [--dry-run request.json] [--review-offset n] [--review-limit n]\n");
    return;
  }
  const report = auditBilingualContent(options.input);
  const json = `${JSON.stringify(report, null, 2)}\n`;
  if (options.output) fs.writeFileSync(options.output, json);
  else process.stdout.write(json);
  if (options.dryRun) {
    const request = buildJevDryRunRequest(report, { offset: options.reviewOffset, limit: options.reviewLimit });
    fs.writeFileSync(options.dryRun, `${JSON.stringify(request, null, 2)}\n`);
  }
}

if (require.main === module) {
  try { main(); } catch (error) { process.stderr.write(`${error.message}\n`); process.exitCode = 1; }
}

module.exports = { auditBilingualContent, buildDryRunRequest, buildJevDryRunRequest, collectStaticLiterals, splitBilingualPairs };
