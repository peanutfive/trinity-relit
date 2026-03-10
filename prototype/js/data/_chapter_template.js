// ═══════════════════════════════════════════════════
//  章节模板 — 新建章节时复制此文件
//  复制到 prototype/js/data/<chapter_id>.js
// ═══════════════════════════════════════════════════
//
// 使用步骤：
//   1. 复制此文件，重命名为章节 id（如 wabe.js、japan.js）
//   2. 在 dfrotz 中通关该章节，用 script 命令记录所有文本
//   3. 将原版文本填入 ROOMS 的 desc / events.text 等字段
//   4. 为每段文本添加中文翻译
//   5. 为每个事件设计中英文 triggers（语义匹配用）
//   6. 在 main.js 的 CHAPTERS 中注册：
//        { id: "<chapter_id>", loader: () => import("./data/<chapter_id>.js") }
//   7. 如有新物品，在 items.js 中添加定义
//
// dfrotz transcript 提取命令：
//   $ dfrotz "Trinity 1986/TRINITY.DAT"
//   > script on
//   （游玩并记录所有文本）
//   > script off
//

export const ROOMS = {

  // ────────────────────────────────────────────────
  //  房间模板
  // ────────────────────────────────────────────────
  //
  // example_room: {
  //   name: "English Room Name",        // 原版英文房间名
  //   cn:   "中文房间名",                // 中文翻译
  //
  //   // 房间描述。用 function 形式可根据 state 动态变化。
  //   desc(s) {
  //     let d = "原版英文描述的中文翻译。";
  //     if (s.hasFlag("some_flag")) {
  //       d += "\n\n根据游戏状态变化的额外描述。";
  //     }
  //     return d;
  //   },
  //
  //   // 出口。简单出口直接写 roomId，条件出口用对象。
  //   exits(s) {
  //     return {
  //       n: "adjacent_room",
  //       e: {
  //         to: "locked_room",
  //         when: (s2) => s2.hasFlag("door_unlocked"),
  //         fail: "门锁着。",
  //         text: "你推开门走了进去。",
  //         act(s2) { /* 通过时的副作用 */ },
  //       },
  //     };
  //   },
  //
  //   // 可选钩子
  //   onEnter(s, eng) { /* 进入房间时触发（仅首次或每次均可自行控制） */ },
  //   onTurn(s, eng)  { /* 每回合在此房间时触发 */ },
  //   onWait(s, eng)  { /* 玩家输入 wait/等待 时触发 */ },
  //
  //   events: [
  //     // ── 结构化匹配事件（parser 第一层）──
  //     {
  //       id: "unique_event_id",
  //       match: {
  //         verb: ["examine"],                    // 动词（英文）
  //         noun: ["thing", "东西", "item_id"],   // 名词（中英文 + 物品 id）
  //         // noun2: ["target"],                 // 复合句的第二名词（可选）
  //       },
  //       when: (s) => true,                      // 可选：事件前置条件
  //       act(s, eng) {                           // 可选：副作用（改 flag、移动物品等）
  //         s.setFlag("examined_thing");
  //       },
  //       text: "原版文本的中文翻译。",            // 或 text(s) { return "..."; }
  //     },
  //
  //     // ── 语义匹配事件（embedding 第二层）──
  //     // 没有 match 字段的事件只会走 embedding 匹配
  //     {
  //       id: "semantic_only_event",
  //       triggers: [
  //         // 20-30 条中英文触发词，覆盖玩家可能的各种表述
  //         "中文表述1", "中文表述2",
  //         "english phrase 1", "english phrase 2",
  //       ],
  //       when: (s) => true,
  //       act(s, eng) { eng.moveTo("somewhere"); },
  //       text: "响应文本。",
  //     },
  //   ],
  // },

};
