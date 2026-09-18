# Trinity Relit — 发布收尾计划

> 本文档是**内容开发完成之后**的权威路线图，与 `prototype/CHAPTER_PLAN.md`（章节内容路线图）并列。
> 章节内容已全部完成，本文档只处理「让别人能玩到、能玩完、能玩下去」这三件事。
> 参照项目：[emollick/zork-underground-empire](https://github.com/emollick/zork-underground-empire)

---

## 1. 现状盘点

### 已完成

| 项 | 状态 |
|---|---|
| 11 个章节、约 130 个房间 | ✅ 全部完成，见 `prototype/CHAPTER_PLAN.md` |
| 引擎：移动 / 物品 / 事件 / 计时器 / 死亡 / 章节异步加载 | ✅ `prototype/js/engine.js` |
| 中英混合 parser + 语义向量兜底 | ✅ `parser.js` + `embedding-worker.js` |
| 核心机制：日晷、Klein 瓶翻转、6 扇蘑菇门、渡船、壁橱谜题、剪线结局 | ✅ 见 `prototype/MECHANISMS_VS_PLAN.md` |
| 章节规范静态校验 | ✅ `scripts/verify_chapters_rules.js` |
| 原版数据文件的版权隔离 | ✅ `.gitignore` 已排除 `.DAT` / 提取产物 |

### 缺失（本计划要补的）

| 项 | 现状 | 影响 |
|---|---|---|
| 在线试玩 | 无。README 要求 `python3 -m http.server` | **绝大多数人不会玩到这个游戏** |
| 通关测试 | 只有静态规范校验 | 改一处可能悄悄断掉某条主线，无人发现 |
| CI | 无 `.github/` | 校验脚本靠人记得跑 |
| 存档 | 无 | 关闭标签页 = 数小时进度归零 |
| 提示系统 | 只有调试面板 | 日晷 / Klein 瓶 / 渡船三处是劝退点 |
| 版权说明 | README 一句话 + MIT | 原版文本无开源授权，公开仓库有风险 |

### 关键技术前提（已验证）

1. `GameEngine` 构造函数为依赖注入：`{ rooms, items, parser, embedding, ui, chapterLoader, preloadedChapters }`。
2. `engine.js` / `parser.js` 不含任何 `document` / `window` 调用。

   → **引擎可直接在 Node 中以 stub ui + stub embedding 运行，通关测试无需重构现有代码。**
3. `prototype/` 为纯静态 ES module，无构建步骤，可直接静态托管。
4. transformers.js 与模型权重均来自外部 CDN（jsdelivr / HuggingFace），本仓库不含模型文件。

---

## 2. 阶段 0 — 修复已知缺陷

**目标**：让 `node scripts/verify_chapters_rules.js` 输出 0 项不符合。

当前输出：

```
[双向出口] wabe.js: cemetery --s--> cottage，但 cottage 缺少反方向 n --> cemetery（当前 n=无）
[双向出口] wabe.js: cottage --s--> cemetery，但 cemetery 缺少反方向 n --> barrow
```

**做法**：以 `zparse.py` 提取的 Z-machine 出口数据为准（`CHAPTER_RULES.md` 冲突解决协议第 1 条：Z-machine 数据 > dfrotz 文本 > 推测），确认 cemetery / cottage / barrow 三者的真实连通关系，再修正 `prototype/js/data/wabe.js`。

**注意**：`cemetery` 的 `n` 当前指向 `barrow`，不是缺失而是冲突，需要先判断是校验脚本对「一个方向只能有一个反向」的假设过严，还是数据确实错了。

**验收**：校验脚本 0 项不符合。

---

## 3. 阶段 1 — 上线可玩

**目标**：README 第一行是一个点开就能玩的链接。

**参照**：zork 项目的 `package.json`（21 行）+ `netlify.toml`（6 行）+ README 开头的 "Play in your browser"。

### 改动

1. **新增仓库根目录 `package.json`**
   - `"type": "module"`（Node 才能直接 import `prototype/js/*.js`，阶段 2 的测试依赖此项）
   - `scripts`：`dev`（起本地静态服务器）、`verify`（跑现有校验脚本）、`test`（阶段 2 补）
   - 无运行时依赖。开发依赖最多一个静态服务器，能不加则不加。

2. **新增 `netlify.toml`**
   - 无 build 命令，`publish = "prototype"`。
   - 若后续需要 WASM 多线程（SharedArrayBuffer），再通过 `_headers` 补 COOP/COEP；当前单线程 WASM 不需要，**不要提前加**，COEP 会连带阻断跨域 CDN 请求。

3. **改写 `README.md`**
   - 顶部放在线试玩链接。
   - 说明首次加载约 130MB 模型、需要联网、之后浏览器缓存可离线。
   - 保留方案 A / 方案 B 的结构，但把方案 B 提到前面作为主线。

### 待决事项 A：模型加载渠道（需你拍板）

目标用户是中文用户，而 jsdelivr 与 HuggingFace CDN 在国内均不稳定。三个方案：

| 方案 | 做法 | 优点 | 代价 |
|---|---|---|---|
| A1 保持现状 | 继续用 jsdelivr + HF | 零成本，立刻能上线 | 国内用户可能直接卡在加载页 |
| A2 加镜像回退 | 首选 HF，超时回退 `hf-mirror.com`；transformers.js 同时配 npmmirror 源 | 成本小，覆盖大部分国内用户 | 需要写重试逻辑；镜像可用性不由你控制 |
| A3 自托管模型 | 把 onnx 权重放进部署产物，`env.allowLocalModels = true` | 最稳，真正离线可用 | 约 120MB 静态资源。Netlify 免费额度 100GB/月，约 800 次首访即耗尽；且不宜入 git，需走 LFS 或 CI 下载 |

**建议**：阶段 1 先按 A1 上线拿到可玩链接，同期按 A2 补回退。A3 等确认有真实流量再说。

**验收**：在无本地缓存的浏览器中打开线上地址，能完成序章并进入 The Wabe。

---

## 4. 阶段 2 — 通关测试与 CI

**目标**：一条命令验证从 Kensington Gardens 到剪线结局的完整主线未断。

**参照**：zork 项目 `tests/campaign.test.ts`。其核心是一个 `go()` 辅助函数，在房间图上 BFS 找路，**只走真实存在且 `requires` 条件已满足的出口**，逐个调用 `travel()` 真的走过去，绝不直接赋值 `state.room` 或 flags。整套测试从开局一路打到十九个宝藏上交。这是它敢大改 `world.ts` 而不怕弄坏主线的底气。

### 改动

1. **新增 `tests/harness.js`** — 无 DOM 环境的引擎装配
   - `stubUi`：把 `text` / `system` / `location` / `userInput` 收集进数组，供断言检查文本。
   - `stubEmbedding`：`findMatch()` 恒定返回未命中。**测试只允许走 parser 结构化路径**，语义兜底是模糊的，不适合作为回归基线。
   - `createGame()`：装配 rooms / items / parser / chapterLoader（用真实动态 import），返回 `{ eng, state, output }`。

2. **新增 `tests/walkthrough.test.js`** — 主线通关
   - `go(eng, targetRoom)`：BFS + 真实 `processInput` 方向指令，禁止直接改 state。
   - 按 `CHAPTER_PLAN.md` 的章节顺序推进：序章 → Wabe → 各分支章节 → Islet → Desert → Ranch → 剪线结局。
   - 断言终局：`state.dead === false`、结局文本已输出、分数符合预期。

3. **新增 `tests/graph.test.js`** — 图完整性（把现有校验脚本的检查项测试化）
   - 所有 `exit.to` 存在于对应章节的 ROOMS 中。
   - 所有事件引用的 item id 存在于 `items.js`。
   - 同房间内事件 id 唯一。
   - 每个 `onTurn` 以房间守卫开头。

4. **新增 `.github/workflows/check.yml`**
   - 参照 zork 的写法：`push` + `pull_request` + `workflow_dispatch`，`permissions: contents: read`，`concurrency` 取消重复运行，action 用 commit SHA 锁定版本。
   - 步骤：`npm ci` → `npm test` → `npm run verify`。
   - 单 OS（ubuntu）即可，本项目无 Windows 特定逻辑。

**验收**：`npm test` 本地与 CI 均通过；故意删掉 wabe 的一扇蘑菇门，测试必须失败。

---

## 5. 阶段 3 — 存档

**目标**：关闭浏览器后能接着玩；能把存档搬到另一台设备。

**参照**：zork 的 `serialize` / `deserialize` + 暂停菜单的导出/导入，以及它在 README 里明确写的「线上版、开发版、本地版存档相互独立」。

### 改动

1. **`engine.js` 增加 `serialize()` / `deserialize()`**
   - `GameState` 需要处理两处非 JSON 原生类型：`flags`（Set）与 `visited`（Set），存为数组。
   - 其余字段（`room` / `itemLoc` / `counters` / `score` / `turns` / `chapter` / `timer` / `flipped` / `sundialSymbol` / `leverPulled` / `dead`）可直接序列化。
   - **必须带 `version` 字段**。存档格式一旦发布就需要向后兼容，参照 zork `GameState.version`。
   - **反序列化时必须先 `activateChapter(state.chapter)`**，否则读档进入懒加载章节会找不到房间。

2. **自动存档时机**：每回合结束（`postTurn` 之后）写 localStorage。130 房间的状态量很小，无性能顾虑。

3. **UI**：开场增加「继续上次冒险」；增加存档导出/导入（JSON 文件）。

**验收**：通关中途刷新页面，进度、物品、日晷符号、已触发 flag 全部保留；导出的存档在另一浏览器导入后可继续。

---

## 6. 阶段 4 — 提示与日志

**目标**：卡住的玩家能自己走出来，而不是关掉页面。

**参照**：zork 的三级提示（暗示 → 引导 → 直接给答案），以及记录已发现线索的日志。

### 优先处理的卡点

按劝退风险排序，这三处必须有提示：

1. **日晷符号 → 蘑菇门映射**（Wabe）。七个天文符号对六扇门，玩家没有任何线索知道 Mars 对应 Japan。
2. **Arboretum 的 Klein 瓶翻转**。翻转后方向关系改变，不提示几乎不可能自己发现。
3. **渡船需要银币**（Islet）。

其次：Orbit 需要先在 Cottage 拿肥皂泡；Underground 必须带光源；Pacific 的七分钟计时。

### 改动

1. 事件数据结构增加可选 `hints: [string, string, string]` 字段（三级）。放在事件上而非房间上，因为 Trinity 的卡点是事件级的。
2. `engine.js` 增加 `hint` 指令：按当前房间 + 已触发 flag 找出「当前应该做但还没做」的事件，逐级给出提示。
3. 日志：记录已访问房间、已获得物品、已解开的谜题，作为 `日志` / `journal` 指令。这部分数据存档里已有（`visited` / `itemLoc` / `flags`），只是没展示。

**验收**：在三个主卡点各输入 `提示`，三级提示依次给出，第三级给出可直接执行的指令。

---

## 7. 阶段 5 — 版权合规

**目标**：公开仓库的授权边界写清楚。

**背景**：zork 项目能大段引用原文，是因为微软已将 Zork I 源码以 MIT 释出，它在 `licenses/ZORK-MIT.txt` 与 `CREDITS.md` 中逐项交代了代码、散文、贴图、字体、运行时各自的授权。

**Trinity (1986) 没有等价的开源授权**，而 `CHAPTER_RULES.md` 第 0 条明确要求「所有英文文本必须来自原版，禁止原创」。这是本仓库最大的非技术风险。

### 改动

1. **新增 `CREDITS.md`**，逐项说明：
   - 本项目代码：MIT。
   - 原版文本：版权归 Infocom / Activision，本项目为非商业的独立致敬与可访问性实验，不主张任何权利。
   - 中文翻译的性质与归属。
   - 明确不含、也不分发原版游戏数据文件（`.DAT` / `.z5` 等），`.gitignore` 已做隔离。
   - 依赖：transformers.js、multilingual-e5-small 模型各自的授权。
2. **README 增加简短声明并链接 `CREDITS.md`**，参照 zork README 末尾「independent adaptation, with no official endorsement」的写法。

### 待决事项 B：仓库公开范围（需你拍板）

| 方案 | 代价 |
|---|---|
| 保持公开 + 完整 CREDITS | 风险仍在但已尽到说明义务；Infocom 同人项目历史上极少被追究 |
| 公开代码、文本另行处理 | 工程上很麻烦，等于废掉当前架构 |
| 转为私有仓库，只公开在线版 | 最保守，但失去开源价值 |

**验收**：`CREDITS.md` 存在且被 README 链接；`git ls-files` 中无任何原版数据文件。

---

## 8. 明确不做

- **3D 化**。Trinity 的价值在 Moriarty 的散文与核时代隐喻——广岛的纸鹤、冥河的船夫，靠的是文字留白。Zork 的地下帝国本就是空间探索型，天然适合 3D；Trinity 不是。做 3D 是用最强项换一个打不过对方的弱项。
- **把 parser 换成情境化交互**。zork 用「走近按 E」替换 parser 是为了适配 3D 第一人称。你的「中英 parser + 语义向量兜底」是本项目独有的价值，Zork 那个项目没有。
- **补齐 `MECHANISMS_VS_PLAN.md` 中标 ⬜ 的机制**（零重力、游泳/潜水、吉普车驾驶、核爆倒计时、finale 的 halfway / thin_air 房间）。这些是锦上添花，在「没人能玩到」被解决之前不具优先级。

---

## 9. 风险登记

| 风险 | 概率 | 影响 | 应对 |
|---|---|---|---|
| 国内用户加载不了模型 | 高 | 致命 | 待决事项 A |
| 130MB 首次加载劝退 | 中 | 高 | 加载页说明预期耗时；考虑先让玩家读开场文本再后台加载 |
| `findMatch` 对每个 trigger 串行 `await embed()`，首次匹配慢 | 中 | 中 | 阶段 1 后实测；必要时改批量推理 |
| 存档格式发布后需变更 | 中 | 中 | 从第一版就带 `version` 字段 |
| 原版文本版权 | 低 | 高 | 阶段 5 |

---

## 10. 执行顺序与验收总表

| 阶段 | 内容 | 完成标志 |
|---|---|---|
| 0 | 修 wabe 双向出口 | 校验脚本 0 项不符合 |
| 1 | package.json + netlify.toml + README | 有可点击的在线试玩链接 |
| 2 | 通关测试 + 图测试 + CI | `npm test` 通过；CI 绿 |
| 3 | 存档 | 刷新页面进度不丢；存档可导出导入 |
| 4 | 三级提示 + 日志 | 三个主卡点均可靠提示走出 |
| 5 | CREDITS.md | 授权边界清晰 |

---

## 进度跟踪

- [ ] 阶段 0：修复 wabe 双向出口
- [ ] 阶段 1：上线可玩
- [ ] 阶段 2：通关测试与 CI
- [ ] 阶段 3：存档
- [ ] 阶段 4：提示与日志
- [ ] 阶段 5：版权合规
