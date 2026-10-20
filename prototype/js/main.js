// ═══════════════════════════════════════════════════
//  Trinity Relit — 入口文件
// ═══════════════════════════════════════════════════

import { GameEngine, SAVE_VERSION } from "./engine.js";
import { Parser } from "./parser.js";
import { LocalIntentResolver } from "./intent-model.js";
import { createIntentNotice } from "./intent-notice.js";
import { ui } from "./ui.js";
import { ITEMS } from "./data/items.js";
import { ROOMS as PROLOGUE, TIMERS as PROLOGUE_TIMERS } from "./data/prologue.js";

// 按章节注册房间。preload: true 的章节随首屏加载；
// 其余章节通过 loader 函数懒加载（动态 import）。
const CHAPTERS = [
  { id: "prologue", rooms: PROLOGUE, preload: true },
  { id: "wabe", loader: () => import("./data/wabe.js") },
  { id: "japan", loader: () => import("./data/japan.js") },
  { id: "underground", loader: () => import("./data/underground.js") },
  { id: "orbit", loader: () => import("./data/orbit.js") },
  { id: "pacific", loader: () => import("./data/pacific.js") },
  { id: "tundra", loader: () => import("./data/tundra.js") },
  { id: "islet", loader: () => import("./data/islet.js") },
  { id: "desert", loader: () => import("./data/desert.js") },
  { id: "ranch", loader: () => import("./data/ranch.js") },
  { id: "finale", loader: () => import("./data/finale.js") },
];

const CHAPTER_REGISTRY = new Map(CHAPTERS.map((c) => [c.id, c]));

// 判定必须是 preload === true，不能写成 preload !== false。
// 懒加载章节根本没有 preload 字段，undefined !== false 为真，会把 11 章全部
// 算进 PRELOADED_CHAPTERS；引擎据此认为它们都已装载，activateChapter 于是
// 直接返回 true、loader 一次都不调用，房间永远进不到 rooms 里。表现为章节
// 切换时进不去，以及懒加载章节的存档读档报「房间不存在」。
const PRELOADED = CHAPTERS.filter((c) => c.preload === true);
const PRELOADED_CHAPTERS = PRELOADED.map((c) => c.id);

const ALL_ROOMS = PRELOADED.reduce((acc, chapter) => {
  if (chapter.rooms) Object.assign(acc, chapter.rooms);
  return acc;
}, {});

// ═══════════════════════════════════════════════════
//  存档层
// ═══════════════════════════════════════════════════
//
// 引擎只负责产出/吃进纯对象，落盘在这里。localStorage 天然按来源隔离，
// 线上版（github.io）、本地 dev 版（localhost）的存档互不干扰，不需要
// 额外做什么。当前写入最新版本；仅新键缺失时查找可迁移的旧键。

const SAVE_KEY = `trinity-relit:save:v${SAVE_VERSION}`;
const LEGACY_SAVE_KEY = "trinity-relit:save:v1";
let autosaveSuspended = false;

// 隐私模式、磁盘配额、被禁用的存储都会让这些调用直接抛异常，
// 一律降级为「没有存档」而不是让游戏打不开。
const saveStore = {
  read() {
    try {
      const current = localStorage.getItem(SAVE_KEY);
      const raw = current === null ? localStorage.getItem(LEGACY_SAVE_KEY) : current;
      return raw === null ? null : JSON.parse(raw);
    } catch (err) {
      throw new Error("本地存档无法读取或解析", { cause: err });
    }
  },
  write(save) {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(save));
      return true;
    } catch (err) {
      console.warn("写入存档失败", err);
      return false;
    }
  },
  clear() {
    // 先删旧键；若旧键删除失败，保留新键，避免下次启动退回旧进度。
    for (const key of new Set([LEGACY_SAVE_KEY, SAVE_KEY])) {
      try { localStorage.removeItem(key); } catch { return false; }
    }
    return true;
  },
};

const CHAPTER_CN = {
  prologue: "序章", wabe: "The Wabe", japan: "广岛", underground: "地下",
  orbit: "轨道", pacific: "太平洋", tundra: "苔原", islet: "小岛",
  desert: "沙漠", ranch: "牧场", finale: "终章",
};

function describeSave(save) {
  const st = save?.state || {};
  const chapter = CHAPTER_CN[st.chapter] || st.chapter || "未知章节";
  const when = save?.savedAt ? new Date(save.savedAt).toLocaleString() : "时间未知";
  return `${chapter}，第 ${st.turns ?? 0} 回合，${st.score ?? 0} 分（${when}）`;
}

// 导入的文件可能是任意东西。只在这里做浅校验，深校验交给 engine.deserialize。
function parseSaveFile(text) {
  let save;
  try {
    save = JSON.parse(text);
  } catch {
    throw new Error("这不是一个有效的 JSON 文件");
  }
  if (!save || typeof save !== "object" || !save.state) {
    throw new Error("文件里没有存档数据");
  }
  return save;
}

async function boot() {
  ui.setLoading("正在载入…", 0);

  const parser = new Parser();
  // 失败说明层包在 resolver 外面：只记录输入与判定结果，不改执行行为。
  const notice = createIntentNotice({
    ui,
    processInput: (input) => engine.processInput(input),
  });
  const engine = new GameEngine({
    rooms: ALL_ROOMS,
    items: ITEMS,
    parser,
    // 只创建轻量包装器；模型、CDN 和 WASM 在未识别输入后才按需加载。
    intentResolver: notice.wrap(new LocalIntentResolver({
      // 失败原因进调试面板（默认不可见），便于玩家/开发者排查网络、初始化或资源问题。
      onDebug: (message) => ui.semanticDebug(message),
      onFailure: ({ stage, message }) => ui.semanticDebug(`语义识别失败：stage=${stage || "?"} message=${message}`),
    })),
    embedding: null,
    ui,
    chapterLoader: async (id) => {
      const ch = CHAPTER_REGISTRY.get(id);
      if (!ch) return null;
      if (ch.rooms) return ch.rooms;
      if (ch.loader) {
        const mod = await ch.loader();
        ch.rooms = mod.ROOMS || null;
        // 章节自带的计时器回调，读档时引擎要按 id 取回。
        // 返回值仍只是 rooms，不改 chapterLoader 的契约。
        if (mod.TIMERS) engine.registerTimerHandlers(mod.TIMERS);
        return ch.rooms;
      }
      return null;
    },
    preloadedChapters: PRELOADED_CHAPTERS,
    // 每回合结束由引擎回调，引擎自己不认识 localStorage。
    onAutosave: (save) => !autosaveSuspended && saveStore.write(save),
  });

  // prologue 是预加载的，不经过 chapterLoader，它的计时器要在这里登记。
  engine.registerTimerHandlers(PROLOGUE_TIMERS);

  // 失败提示后的归因与「更多」入口由此取用。
  ui.setSemanticControls({
    onMore: () => notice.openMenu(),
    cause: () => notice.causeText(),
  });

  ui.hideLoading();

  ui.system(
    "欢迎来到 Trinity Relit — 经典 Infocom 文字冒险的中文重现。\n" +
    "你可以用中文或英文输入指令。输入「帮助」查看指令提示。\n" +
    "进度每回合自动保存，可随时关掉页面。\n"
  );

  await resumeOrStart(engine);

  ui.setSaveControls({
    onExport: () => {
      const save = engine.serialize();
      const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      ui.downloadJSON(`trinity-save-${stamp}-${engine.state.turns}turns.json`,
                      JSON.stringify(save, null, 2));
      ui.system("已导出存档文件。");
    },

    onImport: async () => {
      const text = await ui.pickJSONFile();
      if (text == null) return;
      let save;
      try {
        save = await engine.prepareSave(parseSaveFile(text));
      } catch (err) {
        ui.system(`导入失败：${err.message}`);
        return;
      }
      if (!ui.confirm(`导入这个存档会覆盖当前进度。\n\n${describeSave(save)}\n\n确定吗？`)) return;
      if (!saveStore.write(save)) {
        ui.system("导入失败：无法写入本地存储。");
        return;
      }
      // 直接重载而不是就地读档：否则屏幕上还留着上一局的文字，
      // 玩家分不清哪些是当前进度的。
      ui.reload();
    },

    onRestart: () => {
      if (!ui.confirm("重新开始会清除当前存档，且无法撤销。\n如果想留着，请先导出存档。\n\n确定吗？")) return;
      if (!saveStore.clear()) {
        ui.system("无法清除本地存档，尚未重新开始。原进度仍保留。");
        return;
      }
      ui.reload();
    },
  });

  ui.enableInput((input) => engine.processInput(input));
}

// 有存档就问，没有就直接开局。
async function resumeOrStart(engine) {
  let save;
  try { save = saveStore.read(); }
  catch (err) {
    autosaveSuspended = true;
    ui.system(`存档无法读取（${err.message}）。本页暂时从头开始，已暂停自动保存以保留原文件；请导出当前进度，或明确重新开始、导入有效存档。`);
    engine.moveTo(engine.state.room);
    return;
  }
  if (!save) { engine.moveTo(engine.state.room); return; }

  const choice = await ui.askResume(describeSave(save));
  if (choice !== "continue") {
    if (saveStore.clear()) {
      engine.moveTo(engine.state.room);
      return;
    }
    ui.system("无法清除旧存档，已保留并尝试继续原进度。");
  }

  try {
    await engine.deserialize(save);
  } catch (err) {
    // 存档读不了就说清楚原因并从头开始，不要卡在半截状态里。
    console.error("读档失败", err);
    autosaveSuspended = true;
    ui.system(`存档无法读取（${err.message}）。本页暂时从头开始，已暂停自动保存以保留原文件；请导出当前进度，或明确重新开始、导入有效存档。`);
    engine.moveTo(engine.state.room);
    return;
  }

  if (save.version !== SAVE_VERSION && !saveStore.write(engine.serialize())) {
    ui.system("旧存档已读取，但暂时无法保存升级后的进度；原存档仍保留。");
  }
  ui.system("—— 已回到上次离开的地方 ——");
  // 用 describeRoom 而非 moveTo：读档只还原状态，不重放 onEnter 的副作用。
  engine.describeRoom();
}

boot().catch((err) => {
  ui.setLoading(`启动失败: ${err.message}`, 0);
  console.error(err);
});
