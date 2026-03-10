# Trinity Relit 架构梳理

## 1. 运行入口
- `prototype/index.html`
  - 负责页面结构、样式、调试开关。
  - 加载模块入口 `prototype/js/main.js`。
- `prototype/js/main.js`
  - 初始化嵌入模型与事件向量缓存。
  - 组装 `rooms + items + parser + embedding + ui` 并启动游戏。
  - 通过 `CHAPTERS` 注册章节数据，支持 `preload` 控制首屏预加载章节。

## 2. 分层结构
- 数据层
  - 房间/事件: `prototype/js/data/prologue.js`
  - 物品定义: `prototype/js/data/items.js`
  - 章节模板: `prototype/js/data/_chapter_template.js`
- 规则层
  - `prototype/js/parser.js`: 中英混合命令解析（方向、动词、复合句）
  - `prototype/js/engine.js`: GameState、移动、事件执行、通用 take/drop/examine、回合后处理
- 语义层
  - `prototype/js/embedding.js`: 主线程包装器，通过 `postMessage` 与 Worker 通信
  - `prototype/js/embedding-worker.js`: Web Worker，`multilingual-e5-small` 模型加载与推理全部在此执行
  - 模型推理在后台线程运行，主线程 UI 不阻塞（输入框、滚动始终响应）
  - 触发词向量按需懒计算（未预计算的 trigger 首次命中时自动补算并缓存）
- 展示层
  - `prototype/js/ui.js`: 文本输出、系统消息、背包、调试分数、输入控制
  - 输出日志节点上限裁剪，避免超长会话导致前端卡顿

## 3. 事件执行路径
1. 玩家输入
2. `engine.processInput()`（async）
3. 先走 parser 结构化匹配
4. 未命中时走 embedding 语义兜底
5. 命中事件后执行 `event.act/text`（支持 async act）
6. `postTurn` 执行回合钩子（房间 onTurn、计时器、死亡判定）

整条调用链支持 async/await：
```
processInput → _handleParsed → _handleAction → _executeEvent → event.act
```
事件的 `act` 函数可以是同步或 async，引擎会自动 await。

## 4. 章节切换协议

### 4.1 章节注册
在 `main.js` 的 `CHAPTERS` 数组中注册章节：
```js
const CHAPTERS = [
  { id: "prologue", rooms: PROLOGUE, preload: true },       // 预加载
  { id: "wabe",     loader: () => import("./data/wabe.js") }, // 懒加载
];
```
- `preload: true`：随首屏加载，合并进 `ALL_ROOMS`，嵌入向量一并预计算。
- `loader`：返回 `{ ROOMS }` 的动态 import 函数，首次进入该章节时自动调用。

### 4.2 异步加载流程
```
event.act() → await eng.transitionChapter()
  → await eng.activateChapter()
    → await chapterLoader(id)     // 动态 import
      → Object.assign(rooms)      // 新房间合并到全局 rooms
  → state.chapter = to            // 仅在加载成功后修改 state
  → eng.moveTo(startRoom)         // 显示新房间描述
```

### 4.3 状态变更时机
`transitionChapter` **先加载章节、确认成功后**才修改 state：
- `state.chapter = to`
- `state.setFlag("chapter_<id>_entered")`

加载失败时 state 不变，玩家保留在当前房间。

### 4.4 未实现章节的 fallback
当目标章节尚未开发时，`transitionChapter` 返回 `false` 并输出系统提示：
```
—— 章节「wabe」尚未开放，敬请期待。——
当前进度已保留，后续更新后可继续游戏。
```
调用方（event.act）可根据返回值决定是否做额外处理。

### 4.5 物品系统与章节的关系
`items.js` 统一定义全部物品，`start` 字段指定初始位置：
- 位于已加载房间的物品立即可见。
- 位于未加载房间的物品在 `itemLoc` 中存在但不可达，章节加载后自动可见。
- `start: null` 的物品通过事件 `act` 在游戏过程中放置。

不需要按章节拆分物品初始化逻辑。

### 4.6 语义匹配与新章节
新章节的 trigger 向量在首次命中时懒计算并缓存（Worker 内部 `embed()`）。
如需提前预计算，可在章节加载后调用 `embedding.precomputeRooms()`。

### 4.7 Web Worker 架构
嵌入推理通过 Web Worker 在后台线程执行，主线程 UI 始终不阻塞：
```
主线程 (embedding.js)          Worker 线程 (embedding-worker.js)
─────────────────────          ──────────────────────────────────
  init(progressCb)  ──msg──▶   加载 multilingual-e5-small 模型
                    ◀──msg──   init-progress / init-done

  precomputeAll()   ──msg──▶   批量计算 trigger 向量并缓存
                    ◀──msg──   precompute-progress / precompute-done

  findMatch()       ──msg──▶   计算 input 向量 + 余弦匹配 + 排序
                    ◀──msg──   match-result (bestId, score, topMatches)
```
- 主线程通过 id 匹配请求和响应，支持并发请求
- Worker 内维护独立的向量缓存（`Map`），生命周期与会话一致
- 公共 API 不变：`init` / `precomputeAll` / `precomputeRooms` / `findMatch`

## 5. 章节扩展步骤
新增一个章节的标准流程：
1. 复制 `prototype/js/data/_chapter_template.js` 到 `prototype/js/data/<chapter>.js`
2. 在 dfrotz 中用 `script` 命令记录该章节的所有原版文本
3. 将原版文本填入 `ROOMS` 的 `desc` / `events.text` 字段，添加中文翻译
4. 为每个事件编写 `triggers`（中英文各 10-15 条），覆盖高频玩家表述
5. 导出 `ROOMS`，每个 room 至少包含：`name`、`cn`、`desc`、`exits`、`events`
6. 在 `main.js` 的 `CHAPTERS` 中注册：`{ id: "<id>", loader: () => import("./data/<id>.js") }`
7. 如有新物品，在 `items.js` 中添加定义并设置 `start`
8. 为关键解谜链添加 `state.flags` 和分数点，避免重复加分
9. 在切章事件中调用 `await eng.transitionChapter({ to, roomCandidates })`

## 6. 当前状态与下一步
- 序章（prologue）已完整可玩，11 个房间。
- 章节基建已完成：异步加载、切换协议、fallback、模板。
- 下一步：按章节扩展步骤，从 The Wabe 开始逐章提取原版内容并还原。
- 语义触发覆盖与阈值调优：每场景补 20-30 条高频 trigger，复杂场景可微调阈值。

## 7. 旧版实现说明
- `prototype/game.js` 是历史单文件原型（可运行，但不再作为主入口）。
- 后续开发集中在 `prototype/js/*` 模块化代码上，避免双轨维护。
