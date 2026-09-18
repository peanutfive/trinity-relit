// 把各章节的 exits 与 Z-machine 出口真值表逐条比对。
//
// verify_chapters_rules.js 只能发现「两个房间互相矛盾」的出口；
// 两边一致地写错（例如凭空造一条出口）它是发现不了的。本脚本用
// TRINITY.DAT 解析出的真值做外部校验，补上这个缺口。
//
// 前置：python3 scripts/extract_exit_truth.py --json scripts/exit_truth.json
// 运行：node scripts/verify_exits_vs_zmachine.js [章节名...]

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const DATA = path.join(ROOT, "prototype", "js", "data");
const TRUTH = path.join(__dirname, "exit_truth.json");
const PLAN = path.join(ROOT, "prototype", "CHAPTER_PLAN.md");

const CHAPTERS = ["prologue", "wabe", "japan", "underground", "orbit", "pacific", "tundra", "islet", "desert", "ranch", "finale"];
const filter = process.argv.slice(2);

// 真值表用 up/down（Z-machine 属性名），章节数据用 u/d（parser 归一化后的键）。
const TRUTH_TO_DATA = { up: "u", down: "d" };
const normalize = (dir) => TRUTH_TO_DATA[dir] || dir;

// 有意偏离真值的出口，格式 "roomA:dir:roomB"。每一条都必须写明理由，
// 并在数据文件的对应位置留注释。这里不是「已知问题」的堆放处——只收
// 为了保持可达性而不得不加的补救路径。
const EXIT_DEVIATIONS = new Map([
  ["cottage:s:cemetery", "Cemetery 的原版入口在未反汇编的 routine 中；无此路则 Underground 章节不可达"],
  ["cemetery:s:cottage", "同上，补救路径的返回方向"],
]);

if (!fs.existsSync(TRUTH)) {
  console.error(`缺少 ${path.relative(ROOT, TRUTH)}。先运行:\n  python3 scripts/extract_exit_truth.py --json scripts/exit_truth.json`);
  process.exit(2);
}
const truth = JSON.parse(fs.readFileSync(TRUTH, "utf8"));

// ── obj# ↔ room id 映射 ──
// 唯一来源是 CHAPTER_PLAN.md 的房间表。通配行（desert 的同名房间）
// 无法确定 obj# 与后缀序号的对应关系，跳过而非猜测。
function loadRoomMap() {
  const map = {}, skipped = [];
  for (const line of fs.readFileSync(PLAN, "utf8").split("\n")) {
    const match = line.match(/^\s*\|\s*([0-9,\s]+?)\s*\|\s*`([^`]+)`\s*\|/);
    if (!match) continue;
    const [, objects, roomId] = match;
    // 文档开头的章节概览表也是「| 序号 | `id` |」的形状，第一列是 1..11 的
    // 序号而非 obj#。不排除会把 obj#1~#11 错误映射成章节 id。
    if (CHAPTERS.includes(roomId)) continue;
    if (objects.includes(",") || roomId.includes("*")) {
      skipped.push(`${objects.trim()} -> ${roomId}`);
      continue;
    }
    map[roomId] = Number(objects);
  }
  return { map, skipped };
}

// ── 章节 ROOMS 加载（与 verify_chapters_rules.js 同法）──
function loadChapterRooms(chapter) {
  const filepath = path.join(DATA, `${chapter}.js`);
  if (!fs.existsSync(filepath)) return {};
  let code = fs.readFileSync(filepath, "utf8").replace(/^export\s+/gm, "");
  try {
    return new Function(code + " return typeof ROOMS !== 'undefined' ? ROOMS : {};")();
  } catch (error) {
    console.error(`[语法] ${chapter}.js: ${error.message}`);
    return {};
  }
}

// 出口可能是函数且依赖 state。用一个宽松 stub 取「默认分支」的出口集合，
// 这与 verify_chapters_rules.js 的做法一致：只校验无条件可见的那些出口。
function getExits(room, roomId) {
  if (!room || !room.exits) return {};
  const stub = {
    room: roomId, flipped: false, sundialSymbol: 2, chapter: "",
    has: () => false, hasFlag: () => false, inRoom: () => false, carrying: () => false,
  };
  try {
    return typeof room.exits === "function" ? room.exits(stub) : room.exits;
  } catch {
    return {};
  }
}

const exitTarget = (value) => (value && typeof value === "object" ? value.to : value);

const { map: roomToObj, skipped } = loadRoomMap();
const objToRoom = Object.fromEntries(Object.entries(roomToObj).map(([id, num]) => [num, id]));

const issues = [];
const record = (kind, chapter, message) => issues.push({ kind, chapter, message });

let checkedRooms = 0, checkedExits = 0;
const unmapped = [], deviations = [];

for (const chapter of CHAPTERS) {
  if (filter.length && !filter.includes(chapter)) continue;
  const rooms = loadChapterRooms(chapter);

  for (const [roomId, room] of Object.entries(rooms)) {
    const objNum = roomToObj[roomId];
    if (!objNum) { unmapped.push(`${chapter}:${roomId}`); continue; }
    const reference = truth[objNum];
    if (!reference) { record("映射失效", chapter, `${roomId} 映射到 #${objNum}，但真值表中无此房间`); continue; }

    checkedRooms++;
    const exits = getExits(room, roomId) || {};

    // 真值里已解析的出口，按归一化方向建索引
    const expected = {};
    for (const [dir, target] of Object.entries(reference.exits)) expected[normalize(dir)] = target;
    const opaque = new Set(Object.keys(reference.opaque).map(normalize));

    // 1) 实现里有、真值里没有的方向 —— 凭空造的出口
    for (const dir of Object.keys(exits)) {
      checkedExits++;
      const target = exitTarget(exits[dir]);

      // parser 只产出 u/d（见 parser.js 的 DIRECTIONS 表）。写成 up/down
      // 的出口在游戏里永远匹配不到，是键名 bug 而非数据错误。
      if (dir === "up" || dir === "down") {
        record("方向键名", chapter,
          `${roomId}(#${objNum}) 出口键写作 "${dir}"，parser 只认 "${TRUTH_TO_DATA[dir]}"，该出口永远走不通`);
        continue;
      }
      // 条件出口未满足时惯例指向自身，不是真实出口
      if (target === roomId) continue;
      if (dir in expected || opaque.has(dir)) continue;
      const deviation = EXIT_DEVIATIONS.get(`${roomId}:${dir}:${target}`);
      if (deviation) { deviations.push(`${roomId} ${dir} -> ${target}：${deviation}`); continue; }
      record("凭空出口", chapter,
        `${roomId}(#${objNum}) 有出口 ${dir} -> ${target}，但原版该房间没有 ${dir} 方向`);
    }

    // 2) 方向存在但目标不同 —— 指错房间
    for (const [dir, expectedObj] of Object.entries(expected)) {
      const actual = exitTarget(exits[dir]);
      if (actual == null) continue;               // 缺失单独归类，见 3)
      const expectedId = objToRoom[expectedObj];
      if (!expectedId) continue;                  // 目标房间未建立映射，无法比对
      if (actual !== expectedId) {
        record("目标错误", chapter,
          `${roomId}(#${objNum}) ${dir} -> ${actual}，真值为 ${expectedId}(#${expectedObj})`);
      }
    }

    // 3) 真值里有、实现里没有 —— 漏掉的出口
    for (const [dir, expectedObj] of Object.entries(expected)) {
      if (exitTarget(exits[dir]) != null) continue;
      const expectedId = objToRoom[expectedObj];
      if (!expectedId) continue;
      record("出口缺失", chapter,
        `${roomId}(#${objNum}) 缺少出口 ${dir} -> ${expectedId}(#${expectedObj})`);
    }
  }
}

// ── 报告 ──
console.log("=== 出口 vs Z-machine 真值 比对 ===\n");
console.log(`已比对房间: ${checkedRooms}    已比对出口: ${checkedExits}`);
if (unmapped.length) console.log(`无 obj# 映射、已跳过: ${unmapped.length} 个房间`);
if (skipped.length) {
  console.log(`CHAPTER_PLAN 中的通配行（obj# 与序号对应关系不明，未比对）:`);
  for (const line of skipped) console.log(`    ${line}`);
}
if (deviations.length) {
  console.log(`有意偏离真值（已登记，不计入偏差）:`);
  for (const line of deviations) console.log(`    ${line}`);
}
console.log();

if (!issues.length) {
  console.log("未发现偏差。");
  process.exit(0);
}

const byKind = {};
for (const issue of issues) (byKind[issue.kind] ||= []).push(issue);
console.log(`共 ${issues.length} 项偏差:\n`);
for (const [kind, list] of Object.entries(byKind)) {
  console.log(`  [${kind}] ${list.length} 项`);
  for (const issue of list) console.log(`    ${issue.chapter}.js: ${issue.message}`);
  console.log();
}
process.exit(1);
