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
| 中英混合 parser | ✅ `parser.js`；语义兜底当前停用，相关文件保留待决策 |
| 核心机制：日晷、Klein 瓶翻转、6 扇蘑菇门、渡船、壁橱谜题、剪线结局 | ✅ 见 `prototype/MECHANISMS_VS_PLAN.md` |
| 章节规范静态校验 | ✅ `scripts/verify_chapters_rules.js` |
| 原版数据文件的版权隔离 | ✅ `.gitignore` 已排除 `.DAT` / 提取产物 |

### 发布收尾状态

| 项 | 现状 | 影响 |
|---|---|---|
| 在线试玩 | ✅ GitHub Pages，打开即玩 | 已完成阶段 1 |
| 通关测试 | ✅ `npm test`，199 回合真实输入走到剪线结局 | 详见阶段 2 的覆盖边界 |
| CI | `check.yml` + Pages 部署前复用检查 | 远端验收状态见阶段 2 |
| 存档 | 无 | 关闭标签页 = 数小时进度归零 |
| 提示系统 | 只有调试面板 | 日晷 / Klein 瓶 / 渡船三处是劝退点 |
| 版权说明 | README 一句话 + MIT | 原版文本无开源授权，公开仓库有风险 |

### 关键技术前提（已验证）

1. `GameEngine` 构造函数为依赖注入：`{ rooms, items, parser, embedding, ui, chapterLoader, preloadedChapters }`。
2. `engine.js` / `parser.js` 不含任何 `document` / `window` 调用。

   → **引擎可直接在 Node 中以 stub ui + stub embedding 运行，通关测试无需重构现有代码。**
3. `prototype/` 为纯静态 ES module，无构建步骤，可直接静态托管。
4. 保留的 embedding 模块使用外部 CDN；启动和通关测试均不加载模型，本仓库不含模型文件。

---

## 2. 阶段 0 — 修复已知缺陷 ✅

**目标**：让 `node scripts/verify_chapters_rules.js` 输出 0 项不符合。**已达成。**

起因是两条双向出口告警，排查后发现的问题远超预期。

### 根因

`verify_chapters_rules.js` 只能发现「两个房间互相矛盾」的出口。**两边一致地写错，它发现不了**，而章节数据里有相当一部分出口是推测填的，从未与 Z-machine 真值比对过。

### 新增工具

| 文件 | 作用 |
|---|---|
| `scripts/extract_exit_truth.py` | 从 `trinity_objects.json` 还原出口真值表 |
| `scripts/verify_exits_vs_zmachine.js` | 把章节数据与真值逐条比对 |

真值表的可信度由脚本自检：421 条已解析出口中 290 条形成完美双向对（68.9%），其余多为反向是 routine 无法判定，真正矛盾的仅 3 条。若格式解读有误不可能出现此互洽率。

出口属性取值有三种形式：`len==2` 为直接出口（值即目标房间对象号）；`len==6` 为条件出口（**前 2 字节是目标房间对象号**，后续为消息）；其余为纯 routine，不反汇编无法确定目标。

### 已修正

1. **房间判定条件有误**。`CHAPTER_RULES.md` 记的是 `parent==88 且 attrs 含 37 和 44`，但属性 `37` 是「有光照」而非房间标志。这导致 `Top of Arbor`、`Underground ×3`、`Underwater` 这 5 个**黑暗房间**从未进入真值表。房间总数由 129 修正为 **134**。
2. **方向键名失效**。`orbit.js` 的零重力出口与 `japan.js` 的避难所出口写作 `up` / `down`，而 parser 只产出 `u` / `d`，这些出口在游戏中永远匹配不到。校验脚本已加方向键名白名单防止复发。
3. **wabe 连通错误**。`cottage.w` 指向 `promontory`，真值为 `bluff`；`bluff` 补回 `e` / `in`，`cottage` 与 `barrow` 补回 `out`；`promontory.e` 是凭空出口，已删除。

### 保留的有意偏离

`cottage.s -> cemetery` 经核查**不是笔误**。真值里没有任何已解析出口指向 Cemetery，其入口藏在未反汇编的 routine 中。删掉它会使 Barrow 与 Ossuary 蘑菇门所在的 **Underground 整章不可达**。已保留并登记进 `verify_exits_vs_zmachine.js` 的 `EXIT_DEVIATIONS`，定位到真实入口后应替换。

---

## 2.5 阶段 0.5 — 真值偏差评估（新增，待决策）

真值比对目前报告 **115 项偏差**：

| 类别 | 数量 | 含义 |
|---|---|---|
| 出口缺失 | 76 | 真值有、实现没有。玩家走不通原版存在的路 |
| 凭空出口 | 23 | 实现有、真值没有。多出了原版没有的捷径 |
| 目标错误 | 16 | 方向存在但通向错误的房间 |

重灾区是 `ranch.js`（11 项目标错误），整个牧场的室内布局与原版不一致；`desert.js` 塔区有大量缺失出口，原版是全方向连通的网格，实现只做了部分方向。

**这些偏差是否阻塞主线通关，目前没有证据**——需要阶段 2 的通关测试才能回答。在那之前不要凭感觉判断严重性。

### 已知的工具局限

- **通用阻挡 routine 未识别**。`454f0000` 一类 routine 在大量房间的多个方向上重复出现，实为「你不能往那走」。脚本目前对所有 routine 方向一律宽容跳过，因此**真实偏差数可能高于 115**。改进方法：统计 routine hex 的出现频次，高频者判为通用阻挡。
- **desert 的 18 个同名房间未比对**。`CHAPTER_PLAN.md` 中 `paved_road_*` / `desert_*` / `foothills_*` 是通配行，obj# 与后缀序号的对应关系不明，脚本选择跳过而非猜测。
- **真值表不入库**。`scripts/exit_truth.json` 派生自受版权保护的 `TRINITY.DAT`，已按项目既有策略加入 `.gitignore`。**后果是 CI 跑不了这项比对**，需要时可考虑提交去掉 `name` 字段的脱敏版。

### 建议

不要在阶段 1（上线）之前逐条修 115 项。地图还原度是打磨项，「没人能玩到」是生存项。建议顺序：阶段 1 上线 → 阶段 2 通关测试摸清哪些偏差真的阻塞主线 → 再按影响排序修复。

---

## 3. 阶段 1 — 上线可玩 ✅

**目标**：README 第一行是一个点开就能玩的链接。**已达成。**

游戏地址：**https://peanutfive.github.io/trinity-relit/**

### 核心发现：游戏此前根本打不开

计划原本假设「上线」只是加配置文件。实际打开后发现游戏卡在加载遮罩上失败，排查出的根因与预期完全不同：

`boot()` 会 `await` 一个约 130MB 的嵌入模型下载，**而这个模型没有任何调用方**。`engine.processInput` 早在 `2e00d0a` 就改成只走 parser 结构化匹配，事件靠 `ev.match` 命中，`this.embedding` 只被赋值、全文从未调用。engine 改了，`main.js` 没有跟着清理。

也就是说，游戏为了一个不会被使用的模型，阻塞在一个必然失败的下载上。

修复是让启动路径不再加载模型。`embedding.js` 与 `embedding-worker.js` 保留完好。

### 待决事项 A 的结论：三个方案都不适用

原计划在 A1（保持现状）/ A2（镜像回退）/ A3（自托管）之间选。实测数据推翻了整个问题框架：

| 源 | 文件 | 速度 |
|---|---|---|
| huggingface.co | model_quantized.onnx | 38 KB/s |
| huggingface.co | model.onnx | 48 KB/s |
| hf-mirror.com | model_quantized.onnx | 40 KB/s |
| hf-mirror.com | model.onnx | 39 KB/s |

**镜像并不比官方源快**，A2 无效；A3 受限于 GitHub Pages 的 100MB 单文件上限，模型约 120MB 放不进去。

但这些都不重要——模型本来就不需要下载。**正确的解法是不下载它**，而不是优化它的下载。

### 已完成的改动

| 文件 | 内容 |
|---|---|
| `package.json` | 零运行时依赖，提供 `dev` / `verify` / `verify:exits` / `truth`。**未设 `type: module`**，否则现有 CommonJS 脚本会全部失效；新脚本一律用 `.mjs` |
| `scripts/serve.mjs` | 零依赖静态服务器，含路径穿越防护 |
| `.github/workflows/deploy.yml` | 先跑章节规范校验再发布 Pages，校验不过不部署 |
| `README.md` | 首屏为在线试玩链接；补文档索引与版权声明；更正语义兜底的描述 |
| `prototype/index.html` | `100dvh` 避开移动端地址栏；输入框 16px 防 iOS 聚焦缩放；小屏 padding 与安全区适配 |
| `prototype/js/main.js` | 移除启动时的模型加载 |
| `prototype/js/parser.js` | META 补全「看看四周」等说法 |
| `prototype/js/engine.js` | examine 未知物品改为「你没有看到那样东西。」 |

部署选择了 GitHub Pages 而非计划中的 Netlify：仓库已在 GitHub，不需要再注册第三方账号，推送即发布。

### 顺带修掉的可用性问题

`看看四周` 这类开局最可能输入的指令会被判为「这句话无法识别」。`META` 表里有 `看看` 和 `环顾四周`，偏偏没有这个组合，于是落到中文动词前缀匹配被拆成 `看` + `四周`，再当作 examine 一个不存在的物品处理。

更普遍的问题在 `_genericExamine`：examine 任何不在场的东西都返回 `false`，最终显示成「这句话无法识别」，让玩家以为是语法不对而反复换说法。已改为「你没有看到那样东西。」

### 验收结果

线上版本已验证：打开即玩无需等待、无 JavaScript 错误、开局在 Palace Gate、房间移动与指令输入正常、`看手表` 等 examine 指令未被新增的 `看` 吞掉。

**阶段 1 当时尚未验证**：序章走到 The Wabe 与后续章节懒加载。阶段 2 实际发现了预加载列表错误；修复和本地浏览器完整通关结果见下文。线上版本需随该修复部署后更新。

### 新增待决事项：语义兜底是否恢复

语义兜底是 README 与 `ARCHITECTURE.md` 里重点介绍的特色，现已停用。需要确认这是有意的产品决策还是无意的回归：

- **不恢复**：保持打开即玩，删掉 `embedding*.js` 与各章节数据里的 `triggers` 字段，同步修订文档。代价是失去项目的差异化卖点。
- **恢复**：改为 parser 命中失败后按需懒加载，并给出明确的加载提示。但 40KB/s 的实测速度意味着等待仍然漫长，需要先解决模型体积或来源问题。

---

## 4. 阶段 2 — 通关测试与 CI（本地完成，远端 CI 待验收）

**目标**：一条命令验证从 Kensington Gardens 到剪线结局的完整主线未断。

参照 [zork 的 campaign.test.ts](https://github.com/emollick/zork-underground-empire/blob/codex/public-release/tests/campaign.test.ts) 的 `go()`：BFS 仅走真实存在且条件满足的出口，逐步调用玩家输入接口，不直接修改房间、物品、flags 或解谜结果。

### 已实现

| 文件 | 实际实现 |
|---|---|
| `tests/harness.mjs` | 无 DOM 的真实 GameEngine + Parser；收集 text/system/location/userInput/inventory；embedding 永远返回未命中 |
| `tests/walkthrough.test.mjs` | 一个连续游戏，8 个顺序子阶段，失败即停止；逐章断言位置、关键物品、flags、分数、计时器和结局 |
| `tests/graph.test.mjs` | 动态 import 全部 11 章；检查全局房间 ID、事件 ID、12 个方向键、出口目标、物品引用、onTurn 守卫；遍历七个符号、翻转、物品和 flags 开关 |
| `tests/harness.test.mjs` | 防止懒加载章节再次被误标为已加载；验证全部出口方向能被 parser 识别 |
| `prototype/js/chapters.mjs` | 从 main 抽出共用章节注册与装配，浏览器和测试使用同一条加载路径；每局独立 rooms 容器 |
| `package.json` / `package-lock.json` | `npm test` 使用 Node 内置 runner，无新增依赖；锁文件使零依赖项目也可执行 `npm ci` |
| `.github/workflows/check.yml` | push / pull_request / workflow_dispatch / workflow_call；只读权限、并发取消、超时、action SHA 锁定；Node 22 执行 `npm ci → npm test → npm run verify` |
| `.github/workflows/deploy.yml` | 部署前复用 check，通关测试失败不能发布 Pages |

`go()` 以当前状态的只读候选房间视图评估 `exits` / `when`，每走一步重新 BFS，以纳入翻转、计时器等变化。寻路不调用 `act`、不提前加载章节；跨章目的地可作为路径终点，实际方向输入触发真实动态 import。

### 测试发现并修复的两个阻断

1. **所有章节被误标为预加载**：原先 `preload !== false` 将没有声明 preload 的懒加载章节也放进 `loadedChapters`。进入白门时 `activateChapter` 直接返回成功，却没有房间数据。现仅 `preload === true` 计入首屏；先复现红测再修复。
2. **`in` / `out` 在 parser 中缺失**：数据和校验白名单接受这两个方向，parser 却不产出它们，蘑菇门及牧场入口不可走。现补上标准方向及里/外别名；完整通关直接发送这些输入验证。

### 实际验收

- `npm ci && npm test && npm run verify` 通过：**16 个测试，0 失败、0 跳过**。
- 单局 **199 回合、73 个不同房间、21/100 分**：序章 → Wabe → Japan → Underground → Orbit → Pacific → Tundra → Islet → Desert → Ranch → Desert 剪线 → Palace Gate；每一步均检查未死亡。
- 覆盖六扇蘑菇门首次懒加载、关闭门拒绝通行、肥皂泡门槛、Klein 翻转、地下光源、太平洋计时、吉普车离开后下塔，以及章节往返。
- 在临时副本中分别删除 Wabe 的六扇开放蘑菇门，六次通关测试都在对应入口报“没有满足条件的出口路径”。真实工作区未受故障注入影响。
- **本地浏览器完整输入 199 条相同指令**，逐步核对房间，看到剪线结局和 21/100 分；页面无游戏错误，控制台无 warning/error。
- GitHub CI：待本次分支推送后填写实际运行结果。

### 与原计划不符的地方及原因

- 测试文件使用 **`.mjs`**，不是早期草案的 `.js`；**没有给根 package.json 添加 `type: module`**。Node **≥22.7** 的语法检测可直接 import 既有浏览器 ES module，原 CommonJS 校验脚本保持可用。运行可能显示 `MODULE_TYPELESS_PACKAGE_JSON` 提示，这是已知兼容提示，不按其建议更改根包类型。
- **结局不进入 finale.js**：实际剪线事件在 desert，直接回到 prologue；通关测试遵循真实路径，图测试仍加载并检查 finale 的 `the_end`。
- **当前分数为 21/100，并非满分**：序章 15、Japan 4、Underground 2。分数是这条可执行路线的回归基线，不代表原版全部谜题完成。
- **银币、鸟笼没有取得路径**：二者 `start: null`，当前章节代码没有放置/取得它们的入口。故付费渡船、旅鼠入笼、壁橱放旅鼠事件虽存在，却不能按文档所说完成。当前 Islet 白门不要求付费，剪线也不依赖壁橱事件，因此这条路线仍能通关。测试没有凭空赋予物品，也没有擅自增加通关门槛；后续修复范围需用户决定。
- 机制表所称的 Underground “木片引出石龙子”事件也未出现在当前模块中，不能计为已验证；本次覆盖的是有实际代码的光源和灯笼流程。
- 旧校验脚本的物品扫描对 event 使用 `JSON.stringify`，会丢掉函数；onTurn 的短源码窗口也可能漏检。图测试改为直接遍历函数源码和所有真实 onTurn，补齐这些盲点；旧脚本继续作为兼容检查保留。

**对 115 项偏差的结论边界**：现在有证据证明“现有地图上存在一条经过全部六扇蘑菇门、牧场并到达结局的路线”；不能据此断言所有原版路线、谜题或偏差都无害。本阶段未修改任何章节出口、原版文本、真值豁免或语义兜底策略。

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
| ~~国内用户加载不了模型~~ | — | — | 已消除：启动不再加载模型 |
| ~~130MB 首次加载劝退~~ | — | — | 已消除：同上 |
| ~~`findMatch` 串行 `await embed()` 慢~~ | — | — | 暂不适用：语义兜底当前未启用。若恢复需一并改批量推理 |
| 章节懒加载失效 | 已发现并修复 | 高 | 阶段 2 通过 Node 和本地浏览器完整通关；待随分支部署到线上 |
| 存档格式发布后需变更 | 中 | 中 | 从第一版就带 `version` 字段 |
| 原版文本版权 | 低 | 高 | 阶段 5 |

---

## 10. 执行顺序与验收总表

| 阶段 | 内容 | 完成标志 |
|---|---|---|
| 0 ✅ | 建立 Z-machine 真值比对，修出口与方向键名 | 校验脚本 0 项不符合 |
| 0.5 | 评估 115 项真值偏差 | 建议排在阶段 2 之后 |
| 1 ✅ | 构建入口 + Pages 部署 + 移动端适配 | 有可点击的在线试玩链接 |
| 2 | 通关测试 + 图测试 + CI | 本地 16 测试通过；远端 CI 待验收 |
| 3 | 存档 | 刷新页面进度不丢；存档可导出导入 |
| 4 | 三级提示 + 日志 | 三个主卡点均可靠提示走出 |
| 5 | CREDITS.md | 授权边界清晰 |

---

## 进度跟踪

- [x] 阶段 0：修复已知缺陷 — 2026-09-18（建立 Z-machine 真值比对；修正房间判定条件、方向键名、wabe 连通）
- [ ] 阶段 0.5：真值偏差评估（115 项，建议排在阶段 2 之后）
- [x] 阶段 1：上线可玩 — 2026-09-20（GitHub Pages 部署；根因是启动时加载了一个无调用方的 130MB 模型）
- [ ] 阶段 2：通关测试与 CI — 本地 16 测试、浏览器 199 回合、六扇门删除实验通过；待远端 CI 验收
- [ ] 阶段 3：存档
- [ ] 阶段 4：提示与日志
- [ ] 阶段 5：版权合规
