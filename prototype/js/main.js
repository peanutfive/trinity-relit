// ═══════════════════════════════════════════════════
//  Trinity Relit — 入口文件
// ═══════════════════════════════════════════════════

import { GameEngine } from "./engine.js";
import { Parser } from "./parser.js";
import { ui } from "./ui.js";
import { ITEMS } from "./data/items.js";
import { createChapterSource } from "./chapters.mjs";

async function boot() {
  ui.setLoading("正在载入…", 0);

  const parser = new Parser();
  const engine = new GameEngine({
    ...createChapterSource(),
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
