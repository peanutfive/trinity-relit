// ═══════════════════════════════════════════════════
//  Trinity Relit — 入口文件
// ═══════════════════════════════════════════════════

import { GameEngine } from "./engine.js";
import { Parser } from "./parser.js";
import { EmbeddingEngine } from "./embedding.js";
import { ui } from "./ui.js";
import { ITEMS } from "./data/items.js";
import { ROOMS as PROLOGUE } from "./data/prologue.js";

// 按章节注册房间。preload: true 的章节随首屏加载；
// 其余章节通过 loader 函数懒加载（动态 import）。
const CHAPTERS = [
  { id: "prologue", rooms: PROLOGUE, preload: true },
  // 后续章节按此格式追加：
  // { id: "wabe", loader: () => import("./data/wabe.js") },
];

const CHAPTER_REGISTRY = new Map(CHAPTERS.map((c) => [c.id, c]));
const PRELOADED_CHAPTERS = CHAPTERS.filter((c) => c.preload !== false).map((c) => c.id);

const ALL_ROOMS = CHAPTERS.filter((c) => c.preload !== false).reduce((acc, chapter) => {
  if (chapter.rooms) Object.assign(acc, chapter.rooms);
  return acc;
}, {});

async function boot() {
  ui.setLoading("正在加载嵌入模型 (首次约 130MB)…", 0);

  const embedding = new EmbeddingEngine();
  await embedding.init((p) => {
    if (p.status === "progress" && p.progress) {
      ui.setLoading(`下载模型: ${p.name ?? ""} ${Math.round(p.progress)}%`, p.progress);
    }
  });

  ui.setLoading("正在预计算事件向量…", 0);
  await embedding.precomputeAll(ALL_ROOMS, (done, total) => {
    ui.setLoading(`预计算: ${done}/${total}`, Math.round((done / total) * 100));
  });

  ui.hideLoading();

  const parser = new Parser();
  const engine = new GameEngine({
    rooms: ALL_ROOMS,
    items: ITEMS,
    parser,
    embedding,
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
