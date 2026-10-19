# 原版行为研究：三个试点

2026-10-16。本文件用于指导后续章节迁移，不修改游戏规则。机器可读场景见 [pilots.json](../research/pilots.json)，总计划见 [ORIGINAL_RESEARCH_PLAN.md](ORIGINAL_RESEARCH_PLAN.md)。

## 证据基线与结论边界

- 目标是本地 `TRINITY.DAT` 的 Release 12 / Serial 860926；实际文件指纹由研究工具另存本地。
- 源码固定为 historicalsource/trinity 的 `16a024ce6bc5b9da85f42e65d7f9fd93b32c808c`。下面的行号均属于该提交。开发快照不能自动代表发行版，真机复现过的行为才标记 `runtime-verified`。
- 已在 `dfrotz` 通过正常指令从开局复现 9 个序章场景和 3 个水库场景。水库基本进出、屏息与方向阻挡已独立重采集；物品受潮、笼中动物及风车坍塌 3 组仍为 `static-only`，其中指令只是假定到场后的后缀。
- 仓库只保存指令、符号和中文分析。源码、原版响应、运行输出和索引保存在 `.local-research/` 或仓库外；不要把本地转录复制进提交。
- `source-output` 检查从本地源码取字面量，在指定 `commandIndex` 的原版响应中找匹配。它可以证明相关文字出现，不能单独证明回合未增加、隐藏标志正确、所有前置条件或完整分支均被覆盖。第二轮已增加14条score/moves数值自动断言，核对未知输入、重复计分及水库结尾计数；它们与46条源码片段检查共60项。其他仅人工观察的时序仍单独注明，不能冒称完整分支自动回归。
- `dfrotz` 启动需要单独输入按键；不要让第一条场景指令被启动画面吞掉。运行器统一处理启动与退出，JSON 的 `commands` 从实际游戏指令开始。

## 试点一：老妇人、吹伞与取伞

### 故事与触发关系

进入 `LAN-GATE` 首次看到 `JWOMAN` 时，`LAN-GATE-F` 设置首次见面状态，排队 `I-BLOW 2`，设置代词对象。`JWOMAN` 与卖鸟食的 `BWOMAN` 是两名人物，不能共用互动说明。

`JWOMAN-F` 对尚未离开的老妇人显示面容片段；普通接近与说话动作有不同开头，随后显式撤销排队并立即调用 `I-BLOW`，最终以 `RFATAL` 返回。向她输入 `help woman` 并非替她撑伞成功；原版是接近被场景打断。说话分支 `ask woman about umbrella` 也真实存在，因此不能声称原版没有询问动词。

`I-BLOW` 把伞移到树上、关闭伞、标记老妇人离开并更新代词。`TR?` 为真时还有回到开局后的结局分支，本轮未运行；不可把开局吹伞转录当作结局已验证。

### 已运行的路径

下表指令均在 `verbose` 后，从全新游戏执行。完整输入及动作对应的检查见 JSON。

| 场景 ID | 指令要点 | 人工观察 |
|---|---|---|
| `woman_help` | `n → ne → e → help woman → find woman` | 接近片段、面容、吹伞；最后寻找时已离开。最后 0 分、3 moves。 |
| `woman_ask` | `n → ne → e → ask woman about umbrella`，重复询问 | 说话受阻片段、面容、吹伞；第二次报告已离开。最后 0 分、3 moves。 |
| `woman_wait` | `n → ne → e → wait → find woman` | 等待直接吹伞，没有先显示面容。最后 0 分、4 moves。 |
| `woman_unknown` | 到场后 `score → xyzzyfoo → score → wait → score` | 未知词前后都是 3 moves，未吹伞；有效等待后 4 moves 并吹伞。 |
| `umbrella_early` | `e → take ball → n → n`，连续两次 `throw ball at umbrella` 后拿伞 | 第一次投球被伞仍在老妇人手中的接近场景取代；第二次才交换树上球和伞。最后 6 分。 |
| `umbrella_ball` | 取球到场后 `look → take umbrella → throw ball at umbrella → take umbrella → take umbrella` | 树上伞不能直接取；用球后能拿到；重复拿不重复加分。球 1 分、伞 5 分，最后 6 分、9 moves。 |

原版 `help` / `ask` 场景已发生剧情却没有增加常规回合；这与未知词不推进属于不同原因。后续不能用统一的“凡被识别即增加回合”规则代替各例程的执行语义。

### 源码依据与未覆盖项

- [people.zil:16，JWOMAN-F](https://github.com/historicalsource/trinity/blob/16a024ce6bc5b9da85f42e65d7f9fd93b32c808c/people.zil#L16)：离开、接近/说话、面容、立即吹伞及 `RFATAL`。
- [places.zil:415，LAN-GATE-F](https://github.com/historicalsource/trinity/blob/16a024ce6bc5b9da85f42e65d7f9fd93b32c808c/places.zil#L415)：首次入场与计时排队；同文件 `SEE-JWOMAN?` 为离开场景的拦截线索。
- [events.zil:133，I-BLOW](https://github.com/historicalsource/trinity/blob/16a024ce6bc5b9da85f42e65d7f9fd93b32c808c/events.zil#L133)：伞与人物状态及结局附加分支。
- [things.zil:2978，PARASOL-F](https://github.com/historicalsource/trinity/blob/16a024ce6bc5b9da85f42e65d7f9fd93b32c808c/things.zil#L2978) 与 [3217，TREE-SWITCH](https://github.com/historicalsource/trinity/blob/16a024ce6bc5b9da85f42e65d7f9fd93b32c808c/things.zil#L3217)：人物持伞时的拦截、树上伞、交换、首次拿伞加分。

尚未覆盖：每个说话/接触动词、东西风全部差异、返场结局、所有离开方向以及伞在其他章节的用途。“帮她撑伞”的中文归一化应指向经过产品选择的原版动作，不能据自然语言意图创造成功情节。

## 试点二：圆池塘纸鸟

### 谜题依赖与对象变化

`I-CRANE-APPEARS` 只在 `ROUND-POND` 生效，首次通过 `CRANE.NODESC` 争取一个有效回合；下一次合适的事件执行才把 `CRANE` 移到 `RPOND`。因此入场后连续尝试拿不可见纸鸟不会使其出现，而 `look` 可令排队事件继续。

首次拿 `CRANE` 成功加 3 分。折叠状态可以看外观，但阅读要求展开；展开要求持有，成功后删除 `CRANE` 并改为 `OCRANE`。玩家自己无法把纸重新折成鸟。`hit` 还可将折叠鸟变成 `BAD-CRANE`，皱纸仍能提供线索；这条替代状态不能被仅有 `bird_unfolded` 一个布尔值完整表达。

### 已运行的路径

| 场景 ID | 指令要点 | 人工观察 |
|---|---|---|
| `paper_timing` | `e → n → w → take paper bird → take paper bird → score` | 两次都不可见；最后 0 分、3 moves。 |
| `paper` | 同路到场 `look`；先读/展开，再拿/重复拿，再读/展开/重复展开/读/折叠 | 未持有展开失败，折叠时读要求展开；第一次拿 +3，重复无加分；展开对象变纸，重复展开无效，自行折回失败。最后 3 分、12 moves。 |
| `paper_damage` | 到场 `look → take paper bird → hit paper bird → read paper → fold paper` | 击打变皱纸，仍能读线索，折回失败。最后 3 分、8 moves。 |

### 源码依据与后续迁移

- [events.zil:222，I-CRANE-APPEARS](https://github.com/historicalsource/trinity/blob/16a024ce6bc5b9da85f42e65d7f9fd93b32c808c/events.zil#L222)：出现时机和对象移动。
- [things.zil:838，CRANE-F](https://github.com/historicalsource/trinity/blob/16a024ce6bc5b9da85f42e65d7f9fd93b32c808c/things.zil#L838)：展开、持有前置、首取计分、发光与破坏分支。
- [things.zil:935，HANDLE-OPEN-BIRD?](https://github.com/historicalsource/trinity/blob/16a024ce6bc5b9da85f42e65d7f9fd93b32c808c/things.zil#L935) 与 [966，FUMBLE](https://github.com/historicalsource/trinity/blob/16a024ce6bc5b9da85f42e65d7f9fd93b32c808c/things.zil#L966)：展开纸/皱纸的阅读、反向文字及重新折叠失败。

静态比较当前重制版可见：纸鸟当前入场即可出现并被取；展开用同一物品加 `bird_unfolded` 表示，未覆盖原版 `BAD-CRANE` 状态和完整失败响应。这是后续待核迁移清单，本轮没有改章节，也没有把“缺口识别”表述为已修复。

未覆盖发光状态、女孩折纸、乘鸟、`FLIPPED` 反向文字、所有破坏动作和全部放水中行为；此试点不能证明 Japan 纸鸟谜题已经完整。

## 试点三：Ranch 水库（基础路径已动态验证）

### 房间和动作线索

| 原版对象 | 当前项目 ID | 源码中的行为线索 |
|---|---|---|
| `SCIST` | `south_reservoir` | `north/up` 经 `ENTER-RESERVOIR` 到边缘。 |
| `ON-CIST` | `edge_reservoir` | `north/in` 经 `INTO-RESERVOIR` 入水；`south/down` 下台阶；其余多个方向有专用失败响应。 |
| `IN-CIST` | `reservoir` | `south/up/out` 回边缘；`down/in` 下潜；其余水平出口限制。 |
| `UNDER-WATER` | `underwater` | 水平八方向撞壁、继续向下受阻；`up/out` 上浮并取消屏息计时。 |

这里只列四个试点房间对应关系，不是全地图真值表。基础进出、下潜、上浮与方向失败已在目标发行版执行核验；物品条件仍未动态验证。

`INTO-RESERVOIR` 除移动外还检查玩家携带的物品及一层容器：`WTK` 设置 `CHILLY`；`BAG/EBAG` 可能替换为 `SOGGY`，并涉及食欲/计数变量。携带 `CAGE` 会调用 `DO-DROWN`。必须逐一核对物品位置与替换，不要只验证能否进出水库。

`WTK` 上的 `CHILLY` 在源码注释中指受潮；`WTK-F` 有相应外观及收听条件，`HEAR-BAKER?` 也排除受潮设备。不能仅凭该标志就断言已经验证永久损坏、可修复性或后续通关后果。

**`DO-DROWN` 不是玩家死亡。** 该源码例程逐项检查笼中 `LEM/MAGPIE/MEEP` 并替换为对应死亡对象。类似地，`I-HOLD-BREATH` 耗尽后源码安排自动回到水面，并非直接杀死玩家。语义名称不能代替阅读例程。

`IN-CIST-D` 在尚未屏息时设置 `BREATH-HELD? = 4` 并排队 `I-HOLD-BREATH`；后者递减、警告、到期上浮。目标版已验证：携带正常取得的发光木片下潜后，第一条 `wait` 出现警告，第二条自动浮回水面。`V-WAIT` 源码默认推进多个计时步，不能把屏息4次计数解释为4条wait。其他光照条件仍需分别复现。

`SPILL-MILL` 是风车台面坍塌后的复杂分支，包含笼中动物后果、`WTK/BAG/EBAG` 处理、物品落水、`MEEP` 替换、视线物品和呼吸状态。本轮只记录关联，未证明正常玩法的触发条件。

### 源码依据

- [places.zil:6419，SCIST 起](https://github.com/historicalsource/trinity/blob/16a024ce6bc5b9da85f42e65d7f9fd93b32c808c/places.zil#L6419)：上述房间、出口与 `ENTER-RESERVOIR` / `INTO-RESERVOIR` / `IN-CIST-D` / `RISE-TO-SURFACE`。
- [events.zil:662，I-HOLD-BREATH](https://github.com/historicalsource/trinity/blob/16a024ce6bc5b9da85f42e65d7f9fd93b32c808c/events.zil#L662)：警告与自动上浮。
- [things.zil:13279，RESERVOIR-F](https://github.com/historicalsource/trinity/blob/16a024ce6bc5b9da85f42e65d7f9fd93b32c808c/things.zil#L13279)：查看、投入物品、不同位置入水等上下文分支。
- [things.zil:14494，SPILL-MILL](https://github.com/historicalsource/trinity/blob/16a024ce6bc5b9da85f42e65d7f9fd93b32c808c/things.zil#L14494) 与 [14543，DO-DROWN](https://github.com/historicalsource/trinity/blob/16a024ce6bc5b9da85f42e65d7f9fd93b32c808c/things.zil#L14543)：坍塌和动物状态。
- [verbs.zil:3264，RESERVOIR-BLOCKS](https://github.com/historicalsource/trinity/blob/16a024ce6bc5b9da85f42e65d7f9fd93b32c808c/verbs.zil#L3264)：水库外围方向阻挡辅助例程。

### 正常到达路线与运行证据

第二轮已通过原版正常玩法获得完整路线：序章带走日晷指针和纸 → Klein翻转并安装指针 → Japan取得铲子、赠伞、折鸟返场 → South Bog取发光木片 → 墓穴取裹尸布和银币 → 渡河至Islet → 白门进入沙漠 → Ranch水库。路线没有使用调试传送、修改内存或重制版通关结果。

长路线包含一处原版无提示的过场按键，位于第31号指令后（0基索引）。它只在声明的原始完整横幅行摘要命中时发送，另记为control，不吞下一条游戏指令。摘要、完整commands、checks均在pilots.json；原文不提交。

| 场景 | 从全新开局的指令数 | 通过的自动检查 | 末尾原版数值 |
|---|---:|---|---|
| `reservoir_enter_exit` | 141 | 入水、下潜、主动上浮、离开边缘及对应原文片段 | 30分 / 194 moves |
| `reservoir_breath` | 142 | 自动上浮对应片段及最后分数回合；首次警告另经人工核对 | 30分 / 204 moves |
| `reservoir_walls` | 148 | 边缘/水面阻挡、水下八方向及底部失败片段；主动上浮 | 30分 / 192 moves |

子代理探索后，主代理用正式提示符采集器从fresh独立重跑三条完整路线，身份/指令/过场/退出/响应绑定及数值检查全部通过。水下连续方向失败后仍可主动上浮；不能把失败输入都当成有效屏息回合。

路线携带的是发光木片，实际没有灯笼；原版水下叙述仍固定提及灯笼。文字匹配不能用来反推背包里有何物品。后续迁移须保留原版描述及实际物品状态的区别，不能自行“修正文案”。

另已通过正常SAVE创建水库检查点，完整历史133条输入（含look/inventory/score观察），30分187moves。主代理在独立进程恢复后，最初score/inventory与保存前一致，续行look后188moves；恢复观察明确标为restored-checkpoint，不混入fresh场景报告。说明见[检查点文档](ORIGINAL_CHECKPOINTS.md)。

### 仍未验证的水库条件

1. 分别携带 `WTK`、`BAG`、`EBAG`、不同容器，核对受潮、替换和后续用途。
2. 携带笼中不同动物，检查死亡对象替换；不能把 `DO-DROWN` 当玩家死亡。
3. 独立复现风车坍塌，记录触发、物品落水、动物和呼吸后果。
4. 扩展黑暗/光源前置、替代到达路线、随机性及内部状态观察。

当前重制版相关房间的出口主要是固定目标、没有这些入水和屏息副作用。此处只是静态迁移缺口，不把全部源码分支视为与当前发行版一致，更不因此直接改运行时。

## 下一轮章节开发的输入

三个试点形成的是证据台账与候选行为规格。下一轮应先把每个已核实的动作和失败分支转成章节计划，明确原文片段、对象转换与回合结算，再申请/登记所需章节和核心文件范围。研究工具的片段匹配、重制版通关和一次剧情成功都不能替代这一验收。
