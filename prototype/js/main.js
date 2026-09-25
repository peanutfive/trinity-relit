// ═══════════════════════════════════════════════════
//  Trinity Relit — 入口文件
// ═══════════════════════════════════════════════════

import { GameEngine } from "./engine.js";
import { Parser } from "./parser.js";
import { ui } from "./ui.js";
import { ITEMS } from "./data/items.js";
import { ROOMS as PROLOGUE } from "./data/prologue.js";

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
// 直接返回 true、loader 一次都不调用，章节房间永远进不到 rooms 里。
const PRELOADED = CHAPTERS.filter((c) => c.preload === true);
const PRELOADED_CHAPTERS = PRELOADED.map((c) => c.id);

const ALL_ROOMS = PRELOADED.reduce((acc, chapter) => {
  if (chapter.rooms) Object.assign(acc, chapter.rooms);
  return acc;
}, {});

async function boot() {
  ui.setLoading("正在载入…", 0);

  const parser = new Parser();
  const engine = new GameEngine({
    rooms: ALL_ROOMS,
    items: ITEMS,
    parser,
    // 语义兜底目前未启用：engine.processInput 只走 parser 结构化匹配，
    // 事件靠 ev.match 命中，不再调用 embedding.findMatch。
    //
    // 因此启动时不加载嵌入模型。此前 boot 会 await 一个约 130MB 的下载，
    // 而模型没有任何调用方——实测下行仅 40KB/s（官方源与国内镜像一样），
    // 下载要近一小时且必然中途失败，游戏根本打不开。
    //
    // embedding.js / embedding-worker.js 保留完好。若要恢复语义兜底，
    // 改成命中失败时按需懒加载，不要放回启动路径。
    embedding: null,
    ui,
    chapterLoader: async (id) => {
      const ch = CHAPTER_REGISTRY.get(id);
      if (!ch) return null;
      if (ch.rooms) return ch.rooms;
      if (ch.loader) {
        const mod = await ch.loader();
        ch.rooms = mod.ROOMS || null;
        return ch.rooms;
      }
      return null;
    },
    preloadedChapters: PRELOADED_CHAPTERS,
  });

  ui.hideLoading();

  ui.system(
    "欢迎来到 Trinity Relit — 经典 Infocom 文字冒险的中文重现。\n" +
    "你可以用中文或英文输入指令。输入「帮助」查看指令提示。\n"
  );

  engine.describeRoom();
  ui.enableInput((input) => engine.processInput(input));
}

boot().catch((err) => {
  ui.setLoading(`启动失败: ${err.message}`, 0);
  console.error(err);
});
