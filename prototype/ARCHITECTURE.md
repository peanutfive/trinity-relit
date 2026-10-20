# Trinity Relit 架构梳理

2026-10-19 更新；首批原版行为迁移见 `docs/ORIGINAL_MIGRATION.md`，其他未完成项见根目录 `PROJECT_REVIEW.md`。

## 1. 运行入口
- `prototype/index.html`
  - 负责页面结构、样式、调试开关。
  - 加载模块入口 `prototype/js/main.js`。
- `prototype/js/main.js`
  - 组装 `rooms + items + parser + intentResolver + ui`，初始化存档和计时器回调注册表。
  - 首屏只创建轻量语义包装器，不下载模型；新游戏调用 `moveTo` 执行首房间事件，续玩只还原状态和描述。
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
  - `intent.js`：从当前房间、物品与条件生成可执行的标准命令候选，并检查明确性。
  - `intent-model.js`：管理 Worker、进度、超时与取消。
  - `intent-worker.js` / `intent-ranking.js`：按语言懒加载 BGE Small ZH/EN，对候选排序和拒识。
  - 只返回候选 ID，不生成剧情或修改状态；玩家确认后重新校验候选并交回标准命令执行。
  - `embedding*.js` 是未启用的历史实现，不在启动路径。
- 展示层
  - `prototype/js/ui.js`: 文本输出、系统消息、背包、调试分数、输入控制
  - 外部文本统一转义后展示，只有 UI 自身生成布局标签。
  - 输出日志节点上限裁剪，避免超长会话导致前端卡顿

## 3. 事件执行路径
1. 玩家输入进入 `engine.processInput()`，输入期间加忙锁，UI 在 finally 恢复输入框。
2. 精确 parser 和事件/物品目标匹配成功时，执行标准动作。
3. 无法明确匹配时，语义层仅提供当前候选；否定、多动作等先要求澄清。
4. 玩家确认后，引擎检查状态未过期、候选仍有效，再调用 `_handleParsed`。
5. 普通动作推进回合并执行 `_postTurn()`。事件/条件出口可显式声明 `advancesTurn:false`：动作仍执行，保存状态并处理死亡反馈，但不增加回合、不运行onTurn或计时器。未知、拒识、取消、超时不执行这些结算或保存。
6. 为兼容旧act/onEnter，动作执行时暂增回合；统一边界在免推进、未处理或异常时撤销未提交tick。旧事件的act返回值仍不参与该决策。
7. `onWait`可返回 `{handled:true,maxTurns:1..3,stopAfterTurn}`，每一步统一推进、回调、保存，再判断停止或死亡。旧void/boolean onWait仍只推进一次；首批仅在Ranch屏息时使用多步等待。旧帮助/背包/分数命令的独立计数语义暂保留，不能宣称全游戏moves已和原版对齐。

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
- `preload: true`：随首屏加载，合并进 `ALL_ROOMS`，不预计算向量。
- `loader`：返回 `{ ROOMS, TIMERS? }` 的动态 import 函数，首次进入或恢复存档时调用；main 的 chapterLoader 必须登记 TIMERS，再返回 ROOMS。

### 4.2 异步加载流程
```
event.act() → await eng.transitionChapter()
  → await eng.activateChapter()
    → await chapterLoader(id)     // 动态 import
      → Object.assign(rooms)      // 新房间合并到全局 rooms
  → 确认有效目标房间
  → state.chapter = to            // 加载与目标检查都成功后修改 state
  → eng.moveTo(startRoom)         // 显示新房间描述
```

### 4.3 状态变更时机
`transitionChapter` **先加载章节、确认目标房间存在后**才修改 state：
- `state.chapter = to`
- `state.setFlag("chapter_<id>_entered")`

加载失败或没有有效目标时 state 不变，玩家保留在当前房间。成功加载的模块可留在缓存中。

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

### 4.6 语义资源与 Worker

模型候选来自场景中的真实动作和 aliases/triggers；新增章节不需要启动时预计算全部场景。Worker 分批计算候选向量，缓存有上限；推理期间允许取消。默认尝试部署准备好的同源资源，再回退公共源，详见 `SEMANTIC_PLAN.md`。

### 4.7 存档边界

`serialize()` 保存版本与纯状态；计时器只存 id/remaining，读档按注册表恢复函数。`_restoreSave()` 检查字段类型、房间和已登记计时器并构造新状态。`validateSave()` 可预检而不替换活状态；导入通过预检、玩家确认后才覆盖本地存档。`deserialize()` 在还原全部成功后一次性替换状态。

缺失的兼容字段采用默认值；已出现但错误的字段拒绝恢复。读档不会重放 onEnter；死亡不覆盖最后的活存档。坏档预检可能加载模块缓存，但不得改进度、计时器或物品。

当前M5使用存档v3，接受v1/v2迁移。`prepareSave()`在独立状态上校验/迁移并生成v3包，供导入确认前使用；`validateSave()`仍返回true。读取顺序为v3→v2→v1，仅较新键缺失时回退，坏v3/v2均不能静默取更旧进度。成功升级写v3并保留旧键；明确重开先清v1、v2再清v3，任何失败不重载。加载失败会提示并暂停自动保存，直到明确重开或导入，避免下一条指令覆盖原文件。

### 4.7.1 容器与共享物品规则

`itemLoc`仍为唯一物品位置来源，`in:<parentId>`表示直接父容器或surface（塔底箱面）；`contents/containerOf/putIn`查询或改变关系，拒绝自包含与循环。`has/inRoom/inventoryList`保持原有直接语义，避免容器内道具绕过旧章节前置。旧旅鼠的扁平`cage`位置在v1/v2迁移中变为`in:cage`，旧flag不再作为运行时位置真相。

引擎的`isVisible/isAccessible/visibleItemIds/containerIsOpen/itemProperty`统一执行和候选的判断；透明闭笼可见不可取，口袋中的袋子须先取出才能装物。背包列出可见的容器内容，8件上限只计算顶层手持；容器取出和口袋取出同样检查空位。完整原版25负重尚未启用。

房间`desc(state, eng)`可选接收引擎，用同一可见性判断局部光照；旧的单参数描述保持兼容。房间事件优先，其次`animal-rules.js`动物规则，再次`item-rules.js`共享物品规则，最后通用take/drop/examine。事件act可接收第三参原解析命令`cmd`，用于检验from/off等来源；原二参事件保持兼容，act返回值仍不决定回合。共享规则涵盖袋子替换、已核实容器容量/口袋/笼子优先规则、对讲机和两种一层受潮策略；`getItemActionCandidates()`复用同一判断，状态改变后旧建议仍由确认边界拒绝。普通入水EBAG不转移旧内容，坍塌先转移；SOGGY重复入水不会再次清空。可见性递归不代表受潮也递归。

### 4.8 Ranch局部时钟

平台寿命与呼吸采用持久化flags/counters，由各Ranch房间带守卫的onTurn推进，不占用其他章节的单一`state.timer`。等待至首个警告/气尽就停止；取镜的免推进坍塌不会额外消耗一次气息。平台与呼吸的回调先后关系按原版正常路径核验并持久化，读档不重置寿命。

本批屏息只注册在Ranch；成功离开章节时清理其计数。这是限定迁移的生命周期策略，尚未实现原版跨章持续的全局屏息队列。M4容器与M5动物/蛇已接入；完整黑暗与通用时钟仍有缺口，见迁移规格。

### 4.9 动物与蛇的生命周期

`state.animals`只保存三种动物的active/grace、走鹃prepared/takeable和三尸体死亡原因；位置仍只读itemLoc。初始笼在cottage、关闭且有magpie；旅鼠首次检查裂缝出现，走鹃由Islet成功切章准备、塔底首次进入激活。版本迁移不把新动物start通用灌入旧档；明确destroyed、旧蛇吃旅鼠与既有得分均有保护。v3拒绝同物种活体/尸体双重存在，允许物品留在已销毁父对象中而不可访问。

普通`_postTurn`先运行房间onTurn，再运行共享动物tick，再处理章节timer。开笼的立即旅鼠调用属于动作本身，和普通tick分开；未知/免推进不运行普通tick。离开Assembly重置蛇警告，关门壁橱隔绝蛇；开门先警告、再处理地面旅鼠并首次+3。蛇咬伤的下一有效回合由共享tick处理死亡，移动/刷新不清除伤势，不覆盖最后活档。

DO-DROWN调用者检查笼的直接位置，不能用递归可见性或包含pocket的has代替PLAYER谓词。普通入水/下潜仅inventory；坍塌接受inventory或windmill，并单独处理直接走鹃。动物退出撤销其active/grace；尸体开笼不逃、取回无奖励。完整随机鸣叫、走鹃食物/狗/跟随、全局光照/倒计时与死亡渡船过场仍未迁移，不把局部状态机说成全局Z-machine调度。

## 5. 章节扩展步骤
新增一个章节的标准流程：
1. 复制 `prototype/js/data/_chapter_template.js` 到 `prototype/js/data/<chapter>.js`
2. 在 dfrotz 中用 `script` 命令记录该章节的所有原版文本
3. 将原版文本填入 `ROOMS` 的 `desc` / `events.text` 字段，添加中文翻译
4. 为每个事件编写明确 `match`；为语义候选补有代表性的中英文 `triggers`，用实际语料验证，不用条数代替质量
5. 导出 `ROOMS`，每个 room 至少包含：`name`、`cn`、`desc`、`exits`、`events`
6. 在 `main.js` 的 `CHAPTERS` 中注册：`{ id: "<id>", loader: () => import("./data/<id>.js") }`
7. 如有新物品，在 `items.js` 中添加定义并设置 `start`
8. 为关键解谜链添加 `state.flags` 和分数点，避免重复加分
9. 在切章事件中调用 `await eng.transitionChapter({ to, roomCandidates })`

## 6. 当前状态与下一步

11 章、130 个房间已有实现；主线测试覆盖 77 间，不能代表所有原版机制已还原。基础修复与验收见 `PROJECT_REVIEW.md`；优先补地图映射、条件状态与原文证据，再扩展提示和地图界面。

## 7. 旧版实现说明
- `prototype/game.js` 是历史单文件原型（可运行，但不再作为主入口）。
- 后续开发集中在 `prototype/js/*` 模块化代码上，避免双轨维护。
