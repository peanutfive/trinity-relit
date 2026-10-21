# TASKS.md — 并行任务看板

两个 agent 开工前都先读本文件。只改自己任务「涉及文件」内的文件。
状态：⬜ 未开始 / 🔨 进行中 / 👀 待审查 / ✅ 已合并

## 文件锁

同一时间只允许一个任务修改以下共享核心文件。改之前在这里登记，合并后清除。

| 文件 | 当前持有者 |
|---|---|
| `prototype/js/engine.js` | Codex（T23，m5_state_impact） |
| `prototype/js/parser.js` | Codex（T23，主代理） |
| `prototype/js/data/items.js` | Codex（T23，animal_runtime） |

## 进行中

### T1 阶段 2：通关测试 — Codex
- 分支：`codex/integrate-claude-tests`
- 状态：👀（本地整合与验证完成，尚未合并 main）
- 涉及文件：新建 `tests/`（`harness.js`、`walkthrough.test.js`、`graph.test.js`）、`package.json`（仅添加 `test` 脚本）、`.github/workflows/deploy.yml`（仅在 check job 中添加 `npm test` 一步）
- **不得修改**：`prototype/` 下任何文件。测试暴露出的缺陷记录在下方「发现的问题」，不要顺手修。
- 说明：CI 已存在于 `deploy.yml` 的 check job，扩展它即可，不要另建 `check.yml`。详见 `SHIP_PLAN.md` 阶段 2。
- 验收：`npm test` 通过；故意删掉 wabe 的一扇蘑菇门时测试失败。

**2026-10-08 人类裁决：`codex/phase-2-walkthrough-ci` 先拆分，不按现状合并。**

该分支实际改动 35 个文件，超出上方「涉及文件」范围，其中包含 `prototype/js/engine.js`
（文件锁持有者为 Claude）、`parser.js`、`main.js`、`data/prologue.js`，并新建了运行时模块
`contextual-intent.js`（256 行）与 `chapters.mjs`，以及 `.github/workflows/check.yml`。

拆法：
1. **范围内的测试与 CI 单独成支**，可独立评审合并。
2. **越界的运行时改动另作提案**，由人类逐项判断。其中 `contextual-intent.js` 对应
   `SHIP_PLAN.md` 阶段 1 末尾那条尚未拍板的待决事项「语义兜底是否恢复」，属产品决策。

合并时务必注意（否则会静默损坏）：`chapters.mjs` 的 `chapterLoader` 只返回 `.ROOMS`，
丢掉了 T2 在 `main.js` 里做的 `registerTimerHandlers(mod.TIMERS)` 登记。若该侧胜出，
计时器回调在读档后不会被装回——不报错、无测试失败、`npm run verify` 也抓不到，
只有玩家刷新页面后才暴露。必须把登记补进 `chapters.mjs` 的 loader。

衔接：T1 的通关测试落地后，可直接驱动 `scripts/capture_original_text.mjs` 取全部 129 个
房间的原版描述真值，用于 `scripts/audit_original_prose.mjs` 的 §0 审查。

### T2 阶段 3：存档 — Claude
- 分支：`claude/save-system`
- 状态：👀（已自测通过，等人类审查开 PR）
- 涉及文件：`prototype/js/engine.js`（仅新增 `serialize()` / `deserialize()` 及每回合自动存档钩子）、`prototype/js/ui.js`、`prototype/js/main.js`、`prototype/index.html`
- 说明：存档须带 `version` 字段；`flags` / `visited` 为 Set，存为数组；读档前先 `activateChapter(state.chapter)`。详见 `SHIP_PLAN.md` 阶段 3。
- 验收：中途刷新后进度、物品、日晷符号、flag 全部保留；导出存档可在另一浏览器导入继续。

## 排队中

### T3 阶段 4：提示与日志 — 待分配
- 依赖：T2 合并后（同样要改 `engine.js`）。有 T1 的通关测试兜底会更安全。
- 可拆分：`hints` 数据写进章节文件（可并行），`hint` / `journal` 指令写进 `engine.js`（须持有文件锁）。

### T4 阶段 0.5：115 项真值偏差评估 — 待分配
- 依赖：T1 合并后，用通关测试判断哪些偏差真正阻塞主线。

### T5 阶段 6：自动地图 — 待分配
- 依赖：T1（阶段 2）与 T2（阶段 3）都合并之后。地图状态取自 `visited`，需要存档先能持久化。
- 背景：2026-09-23 人类决定不做 3D 化，改做自动地图作为对症替代。理由见 `SHIP_PLAN.md` 第 8 节与 8.5 节。
- 涉及文件（预估）：新建 `prototype/js/map.js`、`prototype/js/ui.js`、`prototype/index.html`。**不需要改 `engine.js`**，数据全部从 `state.visited` + `room.exits()` 读。
- 关键约束：只画走过的房间；不能用刚性网格布局（真值只有 68.9% 双向自洽，且 Klein 瓶翻转会改方向关系），用力导向；按章节分图。

## 发现的问题
（任一 agent 在工作中发现的、超出自己任务范围的问题记在这里，由人类决定如何处理）

- **T1 分支已远超其「涉及文件」范围，且与 T2 有实质冲突**（2026-09-24 由 Claude 在 T2 收尾时发现，供人类裁决）。
  `origin/codex/phase-2-walkthrough-ci` 共 4 个提交、改动 35 个文件。T1 在本看板上的范围是「新建 `tests/`、`package.json` 仅加 test 脚本、`deploy.yml` 仅加一步」，并注明**不得修改 `prototype/` 下任何文件**。实际改动包含 `engine.js`（本表登记的文件锁持有者是 Claude）、`main.js`、`parser.js`、`prologue.js`，并新建了运行时模块 `prototype/js/contextual-intent.js`（256 行）与 `prototype/js/chapters.mjs`；另外新建了 `.github/workflows/check.yml`，而任务卡写的是「不要另建 check.yml，扩展 deploy.yml 即可」。**若这些是你后来另行授权的，忽略本条。**
  试合并（`git merge-tree`，未改动任何分支）结果：`SHIP_PLAN.md`、`engine.js`、`main.js` 三个文件共 4 处冲突，`prologue.js` 可自动合并。冲突本身不大，但有一处**必须人工判断，否则会静默坏掉**：
  Codex 把章节注册表抽到了新的 `chapters.mjs`，其 `chapterLoader` 只返回 `chapter.rooms || (await chapter.loader()).ROOMS`，**丢掉了 T2 在 `main.js` 里做的 `registerTimerHandlers(mod.TIMERS)` 登记**。如果合并时这一侧胜出，计时器回调在读档后不会被装回——不报错、不影响当前这局、`npm run verify` 也抓不到（该检查只管章节数据的写法，管不到 loader 的接线），只有玩家刷新页面后才暴露。合并 `chapters.mjs` 时必须把 TIMERS 登记补进它的 `chapterLoader`。
  另外 Codex 在 `engine.js` 的 `processInput` 里接入了 `ContextualIntentBoundary` 子系统。这与 `SHIP_PLAN.md` 阶段 1 末尾**尚未拍板的待决事项「语义兜底是否恢复」**相邻，属于产品决策，建议合并前先确认那是不是你要的方向。
- ~~**计时器回调跨不过读档**~~（T2 发现，**已于 2026-09-23 经人类授权修复**）。`state.timer.perTurn` 是闭包，JSON 存不下。解法：章节模块用 `export const TIMERS` 在模块层导出回调，引擎用 `registerTimerHandlers()` 按 id 登记，读档时装回。`prologue.js` / `pacific.js` 已改（超出 T2 原定「涉及文件」范围，已获授权）。
  **新章节若要用计时器，回调必须写进该章的 `TIMERS` 导出**，不能再写成 `startTimer` 的内联闭包，否则读档后失效。已写进 `CHAPTER_RULES.md`（§2、§4、§6、§10），并已在 `verify_chapters_rules.js` 加静态检查，CI 会拦（覆盖：内联闭包、键名与 id 不一致、TIMERS 缺键、跨章节 id 重复）。
- ~~**开局房间的 `onEnter` 从不触发**~~（T9 已修复，新开局进入房间、续玩不重放事件）（T2 发现，既有行为）。`main.js` 的 boot 用 `describeRoom()` 而非 `moveTo()` 进入首个房间，因此 `palace_gate.onEnter` 里启动 doomsday 计时器的那段，只有在玩家离开 Palace Gate 后再走回来时才会执行。读档路径沿用了同样的语义（读档只还原状态、不重放 `onEnter` 副作用）。若这是 bug，修它会改变开局节奏，需要通关测试兜底后再动。
- ~~**死亡提示宣称任意输入可重启**~~（T9 已修正提示，使用真实的页头重启按钮）（T2 发现，既有缺陷）。`engine.js` 里「输入任意内容重新开始」是空头支票，全仓库没有任何重启实现。T2 绕开的方式是：死亡状态不写存档（刷新即回到死前一回合）+ 头部提供「重新开始」按钮。引擎层的缺口仍在。
- ~~**存档往返自检应补进 `tests/`**~~（T1/T9 已覆盖往返、计时器、坏字段与浏览器导入导出）（T2 发现）。T2 期间用 scratchpad 里的临时脚本验证了 7 项（往返一致、读档后可继续、懒加载章节可读档、4 类坏存档被拒、死亡不写档），但 `tests/` 是 T1 的范围，没有入库。T1 合并后建议补一个 `tests/save.test.js`。

## 2026-10-08 Codex 整合验收

- 新分支以 `claude/cleanup-and-decisions` 为基础，合入 `claude/save-system`；旧 Codex 分支完整保留，没有整体合入。
- T1 拆入测试与既有 deploy.yml 的测试步骤；测试装配留在 tests/，没有引入 chapters.mjs 或 contextual-intent.js 到运行时。
- 人类本轮明确授权：修复 parser 的 in/out 及中文别名。首次测试在 Wabe 复现阻断，补两条 DIR_CORE 后完整通关。
- `npm test`：22/22，199 回合、73 房间、21/100 分；`npm run verify` 通过。
- 存档测试覆盖 JSON 往返、继续输入、懒加载、坏档拒绝、自动保存和死亡保护；另执行真实 main.js（只替换 UI 边界），验证 Pacific 续玩后的回调登记与到期副作用。尚未做本轮浏览器导出/导入交互验收。
- 临时副本中断开 Japan 蘑菇门，通关测试按预期失败。出口旧检查仍为 115 项；章节出口未改动。Claude 静态反汇编的更完整偏差统计仍应作为后续地图修复依据。
- 旧分支待单独提案：情境意图模块及 engine 接线；parser 其他语义与事件匹配改动；双语审查/转录/旧 CLI 改动。不因本次整合自动恢复。
- 本地完成不等于远端验收：尚未推送、开 PR 或部署，T2 文件锁保持原登记。

### T6 Ranch 出口与描述重写 — Codex（2026-10-09）
- 分支：`claude/rewrite-ranch`（沿用现有独立工作树）
- 状态：👀 本地计划与验证完成，待人类审查；未合并 `main`
- 涉及文件：保留 26 个原有房间 ID；在 `prototype/js/data/ranch.js` 补原版 `front_deck`、静态出口、描述与可在本章表达的门状态；`tests/ranch-rewrite.test.mjs`、`scripts/verify_chapters_rules.js`（仅原版不对称出口白名单）、`prototype/CHAPTER_PLAN.md`、`prototype/RANCH_REWRITE_PLAN.md`、`prototype/RANCH_REWRITE_GAPS.md`、本文件和 `SHIP_PLAN.md`。
- 当前：27/27 房间由玩家方向命令可达；静态出口已映射项 98/98 一致；9 条条件方向与 28 条跨章未映射目标单列。两扇平台门与室内前门同步并经存档测试。逐项证据与未完成条件见 `prototype/RANCH_REWRITE_PLAN.md`，不把 98/98 解释为全章机制已还原。

### T7 未知输入回合修复 — Codex（2026-10-09）
- 人类明确授权修改 `engine.js`，并核对帮助老妇人的原版响应。
- 范围：`prototype/js/engine.js`、`tests/input-turns.test.mjs`、TASKS/SHIP_PLAN/progress 文档。
- 状态：👀 本地修复与验证完成；沿用当前试玩工作树；2026-10-11 随本次进度提交交付。
- 计划：原版真机核对 → 修复未知输入回合结算 → 覆盖房间事件、计时器与自动存档 → 全套及浏览器验证。
- 验收：30/30 测试、verify 通过；出口仍为既有 43 项偏差（本次无章节/出口改动）。浏览器确认未知输入不推进，wait 正常触发事件，无页面异常。

### T8 小模型意图识别 — Codex（2026-10-10）
- 人类要求接入语义识别小模型并继续开发；本轮授权覆盖所需运行时接线。
- 范围：新建 `prototype/js/intent*.js`；`engine.js`、`main.js`、`ui.js`、`parser.js`、`data/prologue.js`（仅已核实的老妇人互动）、`prototype/index.html`；相关 `tests/`、验证脚本与开发文档。
- engine.js 本轮文件锁：Codex（T2 原改动保留）。
- 状态：👀 本地功能与验证完成；47/47自动测试、13条真实模型语料、真实页面交互通过。远端CI/部署未执行。详细阶段与限制见 `prototype/SEMANTIC_PLAN.md`。
- 加载实测暴露公共CDN不可用/慢下载；范围补充资源准备脚本、package.json、.gitignore、README.md、deploy.yml。部署时下载已开源模型资源到忽略目录，静态站同源分发，不提交模型二进制。

### T9 全项目评估与稳定性优化 — Codex（2026-10-11）
- 授权：人类要求“全面评估整个项目，继续优化”，延续已授权的运行时修复与语义接线；保留全部既有工作。
- 分支：沿用试玩工作树 `claude/rewrite-ranch`；已 fetch，当前包含 origin/main，工作区有未提交改动，不重写历史。
- 范围：`prototype/js/{engine,parser,main,ui}.js`、相关 `tests/` 与浏览器回归脚本；`PROJECT_REVIEW.md`、README、ARCHITECTURE、TASKS/SHIP_PLAN/progress。本轮不改章节、物品、房间 ID 或地图，不引入新服务。
- 状态：👀 本轮评估与限定稳定性优化已验证；54/54 测试、规范校验、浏览器存档/安全渲染/窄屏、13 条真实模型回归通过。旧出口偏差仍为 43，严格报告 129 条待核偏差未改；2026-10-11 随本次进度提交交付，未部署。
- 具体计划、证据与后续验收条件：见 `PROJECT_REVIEW.md`。

### 2026-10-11 进度提交
- 人类要求推送当前进度；交付分支为 `claude/rewrite-ranch`，包含 Ranch 整合、T7/T8/T9 和相关验收文档，不合并或推送 main。
- 提交前重新执行 `npm test`（54/54）和 `npm run verify`（通过）；原版数据、模型资源与浏览器验收产物不纳入提交。

### T10 线上语义加载与短指令反馈 — Codex（2026-10-12）
- 人类报告重复下载、没有选项，并要求继续；延续语义/运行时修复授权。
- 分支 `codex/fix-intent-loading`，基于已部署 main `5581f48`；开工 fetch 遇网络连接失败，提交前重试已成功，主线仍为 5581f48。
- 范围：`prototype/js/{engine,intent,intent-model,intent-worker,ui}.js`、相关 tests / 浏览器回归脚本；TASKS、SHIP_PLAN、progress、SEMANTIC_PLAN。
- 计划：复现超时销毁 Worker 与短指令失败 → 复用未完成下载、区分超时/取消/拒识 → 缺宾语列合法候选、条件不满足明确反馈 → 慢下载/重复请求/页面重载缓存与原有通关回归。
- 不新增原版对话、不改地图、物品或英文剧情。状态：本地修复与验证完成，59/59 测试、规范、13 条真实模型语料、慢下载/重试/刷新缓存和买→喂鸟交互通过；按此前人类的合并部署授权进入发布流程。

- T10 线上闭环：PR #4 已合并部署，公开站实际验证模型只下载一次、超时重试/刷新缓存/候选确认/买→喂鸟通过；59/59 远端测试。线上进一步发现“压缩传输提前显示 100%”，PR #5 修正为已接收字节量，并提供线上长等待验收参数。

### T11 语义失败可诊断与下载稳健性 — pi（2026-10-12，待审查）
- 背景：试玩反馈“模型加载失败时重试也无法恢复，也没有报错码可以辅助排查”，与上游 PR #4/#5 属于同一问题域，但上游只改了超时复用与进度文案，失败仍是无阶段的通用错误。
- 范围：`prototype/js/{intent-worker,intent-model,main,ui}.js`、`tests/intent.test.mjs`、`prototype/SEMANTIC_PLAN.md`。**不动 `engine.js`，不引入设置层/同意流程**（设置层见 T13）。
- 内容：失败阶段（runtime/download/initializing/infer/worker）+ 原始 message 经 `onFailure` 进调试面板；库内部未处理 rejection 不再升级成 Worker 死亡事件（否则会作废正在进行的下载，与 PR #4 目标相冲）；运行时 huggingface.co → hf-mirror.com 回退；进度补文件名与 initializing 阶段（替换按小文件 done 闪烁的写法，已就绪不再多闪“复用”）。
- 验收：`npm test` 63/63、`npm run verify` 通过；浏览器实测冷启动无假 100%、初始化阶段可见、不可达源时镜像提示与 `stage=download` 诊断可见。

### T12 语义失败归因与「更多」入口 — pi（2026-10-12，待审查）
- 范围：新建 `prototype/js/intent-notice.js`、`tests/intent-notice.test.mjs`；修改 `ui.js`、`engine.js`（仅两行 `semanticHint?.()` 钩子）、`main.js`、`index.html`、`tests/boot-save.test.mjs`（stub 补 `setSemanticControls`/`semanticDebug`）、文档。
- 内容：失败提示后的小字归因 + 「更多」弹窗（× 可关、可重复点开、失败类提供重试）；超时/取消不重复播报；弹窗里说明原版动词表限制。不改执行行为、不动设置层。
- 验收：`npm test` 71/71、`npm run verify` 通过；浏览器实测归因小字、弹窗内容与 ×/重开交互。

### T13 同意流程、设置层与取消语义 — pi（2026-10-12，待审查）
- 范围：新建 `prototype/js/settings.js`；修改 `prototype/js/intent-notice.js`、`prototype/js/ui.js`、`tests/intent-notice.test.mjs`、文档。**不需要再改 engine.js**（钩子 T12 已加）。
- 内容：设备级设置（默认 `ask`，与存档分离）；首次需要时先征求同意才下载；取消下载＝停止并写回 `off`；就绪后的取消只放弃当次；超时不改设置、不毁 Worker；「更多」菜单在开启态可关闭/重试。
- 产品影响：首次自然语言输入不再自动开始下载模型，需玩家确认；其他行为不变。
- 验收：`npm test` 77/77、`npm run verify` 通过；浏览器实测征求→拒绝→「更多」启用→自动重跑→候选确认执行。

### T14 PR #6 审查修复 — Codex（2026-10-13）
- 授权：人类要求“修复问题，再合并”，允许更新 Traveler0014 的 PR 并经检查合并部署。
- 范围：`prototype/js/{intent,intent-model,intent-worker,intent-notice,ui}.js`、相关 tests / 浏览器验证脚本；TASKS、SHIP_PLAN、SEMANTIC_PLAN、progress。
- 计划：取消保留已就绪模型与真实就绪通知 → 过期同意窗口失效、重试核对状态 → 修正原版动词说明 → 集成与浏览器回归 → CI → 合并部署。
- 状态：👀 修复与本地验收完成，82/82 测试、规范及真实模型浏览器回归通过；出口无新增偏差。PR #6 已于 2026-10-13 合并部署；不改章节、地图、物品或原版英文剧情。

### T15 原版研究与 REA 接入 — Codex（2026-10-16）
- 人类要求先生成开发计划并按计划实施，明确允许 subagents 协作。
- 分支：`codex/original-research`；基线 main 57c5f9d。
- 涉及文件：`docs/ORIGINAL_RESEARCH*.md`、`docs/{REA_ADAPTER,ORIGINAL_PILOTS}.md`、`scripts/original-research/`、`research/pilots.json`、相关 `tests/*research*` / `tests/rea-adapter.test.mjs`、package.json（仅研究命令）、.gitignore、README、TASKS、SHIP_PLAN、progress。
- 分工与 P0–P5 验收：见开发计划。子代理分别持有 ZIL 索引、REA 适配、试点规格；主代理持有公共入口、运行器、基线、报告与共享文档。
- 不涉及游戏运行时、章节、物品和地图；原版与源码/派生证据均不提交。
- 状态：👀 P0–P5 本地交付完成，105/105测试、规范与9原版场景通过，19项片段检查全命中，REA两次真实采集/比较已跑通；水库6场景仅静态。详细限制见计划与试点报告。本轮未推送、合并或部署。

### T16 原版研究第二轮 — Codex（2026-10-16）
- 人类要求“继续开发”，延续T15研究范围及子代理授权。
- 分支沿用codex/original-research；main经API确认仍为57c5f9d。
- 范围：原版研究脚本（含新checkpoint/checks模块）、research/pilots.json、相关研究测试和docs、README/TASKS/SHIP_PLAN/progress；不涉及游戏运行时与章节。
- 计划P6–P10：修复证据覆盖与身份校验 → 严格报告与score/moves断言 → 原版合法路线/检查点 → 水库动态验证 → 整合验收。详见开发计划第二轮。
- 状态：👀 P6–P10本地完成：130/130测试、规范通过；12个原版场景/60项可见检查全部通过，水库基本路径从fresh独立验证；正常检查点创建恢复通过。水库受潮/动物/坍塌3组保留static-only。待审阅，未推送或部署。

### T17 原版水库条件研究第三轮 — Codex（2026-10-19）
- 人类要求继续工作，延续T15/T16的研究工具范围与子代理授权。
- 分支：codex/original-research；持久工作树 `.claude/worktrees/original-research`，T16已提交09a1ab0。
- 范围：scripts/original-research/、research/pilots.json、相关研究tests、docs/ORIGINAL_*.md、README/TASKS/SHIP_PLAN/progress。仅研究和证据规格，不改游戏运行时、章节、物品或地图。
- 计划P11–P14：精确字面量检查 → 受潮/笼中动物/风车正常路径探索 → 正式采集器从全新开局独立验证 → 迁移规格、未知项与整体验收。详细标准见开发计划第三轮。
- 分工：pilot_specs研究受潮与容器；rea_adapter研究笼中动物；zil_index研究风车并独立审查检查强度；主代理实现检查、整合场景与文档并重采集。
- 状态：👀 P11–P14本地完成；134/134测试与规范通过，29个原版fresh场景/180项可见检查通过（新增17场景），剩余2组未覆盖组合继续静态。已写后续迁移规格，出口旧43项无新增，未修改运行时、推送或部署。

### T18 首批原版行为迁移 M1–M3 — Codex（2026-10-19）
- 人类明确授权修改engine.js、parser.js、items.js、prologue.js、ranch.js及相关测试/文档，实现动作回合区分、老妇人已核实的回合行为、风车坍塌取镜和水下呼吸；保留全部现有房间ID，不合并main或部署。
- 分支codex/ranch-mechanics，基于已上传ad19d9a。开工Git fetch连接失败，GitHub API核对main仍57c5f9d；提交前重试同步。
- 范围：上述5个运行时文件、tests/action-turns.test.mjs、tests/ranch-mechanics.test.mjs、tests/woman-intent.test.mjs及必要的现有回归调整、scripts/verify_ranch_mechanics_browser.mjs、prototype/{ARCHITECTURE,CHAPTER_RULES,CHAPTER_PLAN,RANCH_REWRITE_PLAN,RANCH_REWRITE_GAPS}.md、docs/ORIGINAL_MIGRATION.md、TASKS/SHIP_PLAN/progress。
- 分工：action_contract负责engine.js和动作测试；ranch_runtime负责ranch.js和机制测试；research_verify负责证据与独立审查；主代理负责parser/items/prologue、整合、文档和浏览器验收。共享文件未由多个代理同时修改。
- 验收按迁移规格M1–M3/M6：未知输入不推进；已处理不推进动作仍正确持久化；取镜坍塌/平台警告暂停/水底回收首次计分/穿戴；屏息警告、自动/主动上浮与失败方向时序；中途存档恢复；完整测试、规范、出口无新增及浏览器验证。
- 状态：👀 本地实现与验收完成，待审查。168/168测试、章节规范和7组真实页面流程通过，页面异常0；出口报告与main基线逐字一致，仍为既有43项。M1–M3和本批M6已完成，完整容器/动物/光照及全局跨章呼吸未实现；开发分支提交，不合并main或部署。

### T19 风车物品与动物组合证据 — Codex（2026-10-19）
- 延续T15–T17原版研究授权；仅scripts/original-research、research/pilots.json、相关研究tests和docs/README/TASKS/SHIP_PLAN/progress。不扩大运行时范围。
- pilot_specs研究BAG/EBAG/WTK的持有/平台坍塌组合；rea_adapter研究三种笼内动物持有/平台组合，探索证据只写.local-research；主代理最终独立fresh重采集后才更新清单。
- 状态：👀 正式fresh验收完成，待审查。新增12条持有/平台物品与笼内动物取镜坍塌路径，总计41场景/350检查全部通过（304源码片段、46数值）。2组深层/混合条件仍static-only；旧29场景/180检查基线和失败采集保持可追溯。原始数据仅在被忽略的.local-research中。

### T20 M4容器迁移预备与边界证据 — Codex（2026-10-20）
- 人类要求继续工作；先在既有研究授权内完成可审查方案、原版证据与影响核对，M4不自动继承T18首批运行时授权。
- 分支codex/ranch-mechanics，d8a2f33已上传；开工fetch/rebase完成，main仍57c5f9d。
- 当前涉及文件：docs/ORIGINAL_CONTAINERS_PLAN.md、docs/ORIGINAL_MIGRATION.md、docs/ORIGINAL_PILOTS.md、相关研究脚本/清单/测试（仅确有证据或工具修正时）、TASKS/SHIP_PLAN/progress；原始采集仅.local-research。运行时范围获确认前不修改prototype/js。
- 分工：m4_state_design只读核对容器/可见性/版本兼容及容量算法；m4_source_contract核对来源、口袋和重复受潮边界；主代理编写计划并独立验收。
- 运行时拟范围与P0–P5验收见docs/ORIGINAL_CONTAINERS_PLAN.md：engine、intent、parser、main、items、prologue、ranch、必要的共享item-rules模块及相关测试/文档。保留房间ID，不合并main或部署。
- 状态：👀 预备完成，6条恢复观察/71检查、原版容量算法及版本读取影响已核对。研究工具139字符目录创建/恢复通过；WTK空袋与Broad Walk倒空另补正常路线恢复证据。后续运行时人类已明确授权，转T21实施，41fresh场景统计不变。

### T21 M4容器与受潮迁移 — Codex（2026-10-20）
- 人类明确回复“授权M4容器迁移及所列文件”；完整计划docs/ORIGINAL_CONTAINERS_PLAN.md。分支codex/container-mechanics，基于d8a2f33；不合并main或部署。
- 范围：prototype/js/{engine,intent,parser,main,item-rules}.js、data/{items,prologue,ranch}.js；相关容器/存档/意图/主线测试及浏览器脚本；scripts/verify_chapters_rules.js和verify_exits_vs_zmachine.js（仅适配真实ES模块依赖加载，避免新共享规则导致漏检）；ARCHITECTURE/CHAPTER_RULES/CHAPTER_PLAN/RANCH_REWRITE_PLAN/GAPS、docs/ORIGINAL_*.md、TASKS/SHIP_PLAN/progress。研究检查点长路径缺口仍在T20研究脚本/测试范围内。
- 分工：m4_state_design独占engine/intent和tests/container-state.test.mjs；m4_source_contract独占item-rules/items/prologue及tests/item-rules.test.mjs；ranch_runtime独占ranch及tests/ranch-containers.test.mjs；主代理独占parser/main、版本启动/浏览器回归、研究工具修复与共享文档。交叉修改须先协调持有者。
- 状态：👀 P1–P5本地交付待审查：229/229测试、规范通过，出口报告主体与main基线逐字一致（仍既有43项）；容器8组、旧风车呼吸7组真实页面通过，页面异常0。保留27个Ranch ID。不扩大到动物生死、黑暗、全局跨章时钟或完整25负重；Ranch倒空的风/鸟条件只给中文边界反馈，未实现EMPTY INTO等变体不误执行。

### T22 M5动物迁移预备与证据 — Codex（2026-10-20）
- 人类要求继续工作。当前在已授权研究范围内做原版探测、影响核对和完整实施计划，M5运行时不继承T21限定的M4授权。
- 分支codex/container-mechanics，基于14ccebc。开工fetch连接超时，GitHub API确认main仍57c5f9d，已有origin/main基线rebase完成；提交前重试同步。
- 当前范围：docs/ORIGINAL_ANIMALS_PLAN.md、docs/ORIGINAL_MIGRATION.md、docs/ORIGINAL_PILOTS.md、研究脚本/清单/相关研究测试（仅有新证据或工具缺陷时）、TASKS/SHIP_PLAN/progress。原版及派生证据仅.local-research；运行时范围未确认前不改prototype/js。
- 分工：m5_source_contract只读核对对象、动作、计时及原文；m5_state_impact只读核对旧flag/位置、跨章引用及文件范围；m5_dynamic_probes补正常获取、开笼、取回及死亡对象的原版观察；主代理编写方案、核验和整合。
- 状态：👀 预备完成，正常来源/对象/窗口/小屋/Ruby/蛇证据已审计。首批84检查、窗口58、Ruby12独立重算154全过；蛇另54通过。原始均仅.local-research，41正式fresh基线不变。完整运行时已获人类授权，转T23实施。

### T23 M5动物与壁橱谜题迁移 — Codex（2026-10-20）
- 人类明确回复“授权按计划实施完整M5”，完整计划见docs/ORIGINAL_ANIMALS_PLAN.md；分支codex/animal-mechanics，基于14ccebc，开工fetch/rebase完成；提交前fetch两次超时，GitHub API核对main仍57c5f9d、与origin/main完全一致，再次rebase完成。不合并main、不部署。
- 范围：prototype/js/{engine,main,intent,parser,item-rules,animal-rules}.js、data/{items,wabe,tundra,prologue,islet,desert,ranch}.js；相关tests、浏览器验证脚本、ARCHITECTURE/CHAPTER_RULES/CHAPTER_PLAN/RANCH_REWRITE_PLAN/GAPS、docs/ORIGINAL_*.md、TASKS/SHIP_PLAN/progress。保留全部房间ID和现有地图。
- 分工：m5_state_impact独占engine/intent和动物状态迁移测试；animal_runtime独占animal-rules/item-rules/items及其专项测试；animal_chapters独占wabe/tundra/prologue/islet/desert与正常捕获测试；主代理独占main/parser/ranch、蛇证据与完整谜题、版本启动/浏览器及共享文档。交叉修改先协调。
- 状态：👀 P1–P5本地验收完成，开发分支交付待审查。311/311测试与规范通过，出口43旧项报告与main逐字一致；动物15/容器8/风车7真实页面及正常新游戏217输入通过，无页面异常。v3兼容v1/v2，27房间ID保留；完整全局走鹃/光照/时钟等边界见计划，不合并main或部署。

### T24 试玩中英缺译与逐段对照 — Codex（2026-10-20）
- 人类试玩指出循环叫卖漏中文及经常中英对照不上；本轮仅补译、纠正省译与整理段落，不修改原有英文、状态、地图或回合行为。分支沿用codex/animal-mechanics；fetch超时，GitHub API核对main仍57c5f9d，rebase完成。
- 涉及文件：prototype/js/data/{prologue,items,wabe,tundra,ranch}.js、prototype/js/{animal-rules,item-rules}.js（均仅文本）；tests/bilingual-output.test.mjs、scripts/verify_bilingual_browser.mjs、docs/BILINGUAL_OUTPUT_PLAN.md、TASKS/SHIP_PLAN/progress。engine/parser/main/ui不修改。
- 按docs/BILINGUAL_OUTPUT_PLAN.md执行：动态输出与来源审计 → 缺译/省译补齐 → 明确对应的长文逐段配对及单换行分隔修复 → 每条输出、条件变体和真实页面验证 → 全套/出口/英文不变审查。
- 分工：bilingual_audit独占prologue文本；bilingual_validation独占items/wabe/tundra/ranch/item-rules文本；主代理独占animal-rules、测试/浏览器与共享文档。只读审计后已协调文件锁。
- 状态：👀 2026-10-21本地验收完成、开发分支交付待审查。321/321测试、章节规范、九组真实页面与767组英文/状态差分通过；出口43旧项报告逐字不变。提交前fetch/rebase成功，main仍57c5f9d。不合并main或部署；未调用的nannyBlock和叫卖计数选择等机制另记，不混入本轮修复。完整验收与检查边界见计划。


### T25 本地试玩语义资源恢复 — Codex（2026-10-21）
- 人类报告8083输入“撑开伞”显示识别组件加载失败。本轮先恢复当前工作树缺失的忽略资产，使用现有真实模型/浏览器验收，不修改引擎、parser、章节或语义运行时代码。
- 范围：被忽略的prototype/vendor/intent/资源、README.md、prototype/SEMANTIC_PLAN.md、TASKS/SHIP_PLAN/progress；诊断/浏览器临时产物只放/tmp。
- 计划：P1确认缺失路径、来源版本与资源准备流程 → P2从本机已有同版本资产复用，运行prepare:models核对清单并验证HTTP → P3真实中英文13语料、当前中文表达/连续识别和缓存，检查失败不推进/候选确认 → P4记录工作树隔离原因与验收，不提交二进制，不合并main或部署。
- 分工：bilingual_regression_audit只读复核加载链与验收入口，主代理恢复资源、真实页面验证和文档。
- 状态：👀 本地资源/服务恢复并验收完成。清单16资产和复制摘要核对、prepare:models通过；真实模型13/13、实际main“撑开伞”候选/取消/确认和刷新缓存通过，同源权重只下载1次；lifecycle临时适配当前进度接口后通过、notice通过。全套321/321与规范通过。仅文档入库，资源仍忽略，不合并main或部署。
