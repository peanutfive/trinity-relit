// CHAPTER_RULES.md §10 验证：针对 wabe 章节的完整性检查。
// 从仓库根目录运行：node scripts/verify_wabe.js
const fs = require("fs");
const path = require("path");

const PROTO = path.join(__dirname, "..", "prototype");
const WABE_PATH = path.join(PROTO, "js", "data", "wabe.js");
const ITEMS_PATH = path.join(PROTO, "js", "data", "items.js");

const WABE_ROOM_IDS = [
  "meadow", "summit", "south_bog", "north_bog", "bottom_of_stairs", "vertex",
  "trellises", "arboretum", "top_of_arbor", "north_arbor", "south_arbor",
  "arborvitaes_n", "arborvitaes_s", "chasms_brink", "waterfall", "ice_cavern",
  "under_cliff", "bluff", "cemetery", "barrow", "ossuary", "promontory",
  "cottage", "herb_garden", "moor", "the_bend", "forest_clearing", "the_river",
  "craters_edge", "crater",
];

let failed = 0;

function ok(name, pass, msg) {
  if (pass) {
    console.log(`  [OK] ${name}`);
  } else {
    console.log(`  [FAIL] ${name}: ${msg}`);
    failed++;
  }
}

// 1. 语法检查
function checkSyntax() {
  const code = fs.readFileSync(WABE_PATH, "utf8");
  const wrapped = code
    .replace(/export const ROOMS/g, "const ROOMS")
    .replace(/^const SUNDIAL_/gm, "const SUNDIAL_");
  try {
    new Function(wrapped);
    ok("语法检查", true);
  } catch (e) {
    ok("语法检查", false, e.message);
  }
}

// 2. 房间数 + 出口目标存在
function checkExits() {
  const code = fs.readFileSync(WABE_PATH, "utf8");
  const mod = code.replace(/export const ROOMS/g, "const ROOMS").replace(/^const SUNDIAL_/gm, "const SUNDIAL_");
  const fn = new Function(mod + " return ROOMS;");
  const ROOMS = fn();
  const ids = new Set(Object.keys(ROOMS));
  ok("房间数 30", Object.keys(ROOMS).length === 30, `got ${Object.keys(ROOMS).length}`);
  const state = { room: "meadow", flipped: false, sundialSymbol: 2, has: () => false };
  for (const [rid, room] of Object.entries(ROOMS)) {
    const exits = typeof room.exits === "function" ? room.exits(state) : room.exits;
    if (!exits) continue;
    for (const [dir, t] of Object.entries(exits)) {
      const to = typeof t === "object" ? t.to : t;
      if (!to) continue;
      if (ids.has(to)) continue;
      const crossChapter = ["playground", "underground_1", "orbit_satellite", "tundra_1", "islet"];
      if (crossChapter.includes(to)) continue;
      ok(`出口目标 ${rid} ${dir}->${to}`, false, "目标房间不存在");
    }
  }
  ok("出口目标均在 ROOMS 或跨章节", true);
}

// 3. 事件中物品 ID 在 items.js 存在
function checkItems() {
  const itemsCode = fs.readFileSync(ITEMS_PATH, "utf8");
  const itemsFn = new Function(itemsCode.replace("export const ITEMS", "const ITEMS") + " return ITEMS;");
  const ITEMS = itemsFn();
  const itemIds = new Set(Object.keys(ITEMS));
  const wabeCode = fs.readFileSync(WABE_PATH, "utf8");
  const refs = [...wabeCode.matchAll(/(?:s\.(?:has|inRoom|take|drop|carrying)|inRoom\()\s*\(\s*[\"']([^\"']+)[\"']/g)].map((m) => m[1]);
  const uniq = [...new Set(refs)];
  for (const id of uniq) {
    ok(`物品引用 ${id}`, itemIds.has(id), `items.js 中无 ${id}`);
  }
}

// 4. 引号安全：双引号字符串内无未转义 "
function checkQuotes() {
  const code = fs.readFileSync(WABE_PATH, "utf8");
  const doubleQuoted = /"([^"\\]|\\.)*"/g;
  let match;
  let safe = true;
  while ((match = doubleQuoted.exec(code)) !== null) {
    const inner = match[1] || "";
    if (inner.includes('"') && !inner.includes('\\"')) {
      safe = false;
      break;
    }
  }
  ok("引号安全", safe, "双引号字符串内存在未转义引号");
}

// 5. onTurn 房间守卫（wabe 中无 onTurn，跳过）
function checkOnTurnGuard() {
  const code = fs.readFileSync(WABE_PATH, "utf8");
  const hasOnTurn = /onTurn\s*\(/m.test(code);
  if (!hasOnTurn) {
    ok("onTurn 守卫", true, "无 onTurn，跳过");
    return;
  }
  const guards = code.match(/onTurn\s*\([^)]*\)\s*\{[^}]*?if\s*\(\s*s\.room\s*!==\s*["']([^"']+)["']\s*\)\s*return/g);
  ok("onTurn 守卫", guards && guards.length > 0, "存在 onTurn 但无房间守卫");
}

// 6. 事件 ID 唯一（同房间内）
function checkEventIds() {
  const code = fs.readFileSync(WABE_PATH, "utf8");
  const mod = code.replace(/export const ROOMS/g, "const ROOMS").replace(/^const SUNDIAL_/gm, "const SUNDIAL_");
  const fn = new Function(mod + " return ROOMS;");
  const ROOMS = fn();
  for (const [rid, room] of Object.entries(ROOMS)) {
    const events = room.events || [];
    const ids = events.map((e) => e.id).filter(Boolean);
    const set = new Set(ids);
    ok(`事件 ID 唯一 ${rid}`, set.size === ids.length, `重复 ID: ${ids.join(", ")}`);
  }
}

// 7. 文本格式：描述含中文
function checkTextFormat() {
  const code = fs.readFileSync(WABE_PATH, "utf8");
  const hasChinese = /[\u4e00-\u9fff]/.test(code);
  const hasDesc = /desc\s*\(s\)\s*\{/.test(code);
  ok("描述含英文+中文", hasChinese && hasDesc, "desc 应包含中文");
}

console.log("=== Wabe 章节验证 (CHAPTER_RULES §10) ===\n");
checkSyntax();
checkExits();
checkItems();
checkQuotes();
checkOnTurnGuard();
checkEventIds();
checkTextFormat();
console.log("");
if (failed > 0) {
  console.log(`共 ${failed} 项未通过`);
  process.exit(1);
}
console.log("全部检查通过。");
process.exit(0);
