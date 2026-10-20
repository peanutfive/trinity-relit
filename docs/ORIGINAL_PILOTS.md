# 原版行为研究：三个试点

2026-10-19。本文件用于指导后续章节迁移，不修改游戏规则。机器可读场景见 [pilots.json](../research/pilots.json)，总计划见 [ORIGINAL_RESEARCH_PLAN.md](ORIGINAL_RESEARCH_PLAN.md)，实施顺序见 [迁移规格](ORIGINAL_MIGRATION.md)。

## 证据基线与结论边界

- 目标是本地 `TRINITY.DAT` 的 Release 12 / Serial 860926；实际文件指纹由研究工具另存本地。
- 源码固定为 historicalsource/trinity 的 `16a024ce6bc5b9da85f42e65d7f9fd93b32c808c`。下面的行号均属于该提交。开发快照不能自动代表发行版，真机复现过的行为才标记 `runtime-verified`。
- 已在 `dfrotz` 通过正常指令从开局复现41个场景：前轮29个，加12条风车物品/动物组合。未覆盖的深层或混合组合保留2组`static-only`，不计入动态验证。
- 仓库只保存指令、符号和中文分析。源码、原版响应、运行输出和索引保存在 `.local-research/` 或仓库外；不要把本地转录复制进提交。
- 当前350项自动检查通过：304项源码片段、46项score/moves数值。条件检查绑定具体字面量摘要；对讲机干态声音允许源码表中明确的4种替代表述，湿态仍指定专属片段。片段只能证明相关文字出现，数值只能证明对应可见分数/回合，不能证明全部前置条件、隐藏标志或完整分支覆盖。人工逐项核对的背包集合仍单列，未冒充自动对象集合断言。
- `dfrotz` 启动需要单独输入按键；不要让第一条场景指令被启动画面吞掉。运行器统一处理启动与退出，JSON 的 `commands` 从实际游戏指令开始。

### 2026-10-20 M4补充观察（独立统计）

正常fresh路线创建带满袋检查点后，6条恢复观察/71检查通过，证据`.local-research/t20-m4-preflight-2026-10-20/`。它们不混入上面的41个fresh场景：有内容纸袋入口袋被拒；袋先入口袋时须先取出再装卡；湿袋新装卡再次入水仍保留；首次普通入水后不可访问的卡第二次也不恢复；三袋拒绝关闭；有内容袋的EMPTY默认将内容逐项取到手中；已湿袋含卡再坍塌仍可回收卡。

另用正常路线独立核对WTK装空纸袋：空EBAG可装下WTK并实际取回，和口袋/鸟笼的专属拒绝不同。有效证据`.local-research/t21-wtk-bag-2026-10-20/checkpoint-v3/`及`probe-v3-observation.json`；v1/v2探索未正常到达目标，保留失败且不作为Ranch证据。这个恢复观察同样不增加41个fresh场景数。

容量必须按原版WEIGHT/专用例程实现，不能以物品数量或SIZE简单求和代替：普通放入失败条件为`WEIGHT(dst)+WEIGHT(src)-SIZE(dst)>CAPACITY(dst)`；鸟笼有先开门/非动物SIZE限制并绕过通用容量，口袋另拒满袋、有内容纸袋与折叠纸鸟。关闭三种纸袋只给拒绝，不产生封闭纸袋状态。

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

T18迁移补核：`open/take/hold umbrella`接近场景均从3→4moves；`help woman`仍不推进。`PARASOL-F`虽然内部调用人物检查，但外层显式返回RTRUE，不能继承嵌套例程RFATAL。严格补充报告`.local-research/t18-woman-turn-audit-v2-2026-10-19/report.json`为3场景/9检查；这一审查修正已用于运行时和回归，不改原有文字。它是独立审查证据，未混入上面的41场景统计。

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

## 试点三：Ranch 水库、物品与风车

### 房间和动作线索

| 原版对象 | 当前项目 ID | 源码中的行为线索 |
|---|---|---|
| `SCIST` | `south_reservoir` | `north/up` 经 `ENTER-RESERVOIR` 到边缘。 |
| `ON-CIST` | `edge_reservoir` | `north/in` 经 `INTO-RESERVOIR` 入水；`south/down` 下台阶；其余多个方向有专用失败响应。 |
| `IN-CIST` | `reservoir` | `south/up/out` 回边缘；`down/in` 下潜；其余水平出口限制。 |
| `UNDER-WATER` | `underwater` | 水平八方向撞壁、继续向下受阻；`up/out` 上浮并取消屏息计时。 |

这里只列四个试点房间对应关系，不是全地图真值表。基础进出、下潜、上浮与方向失败已在目标发行版执行核验；物品与风车的具体动态范围见第三轮表格。

`INTO-RESERVOIR` 除移动外还检查玩家携带的物品及一层容器：`WTK` 设置 `CHILLY`；`BAG/EBAG` 可能替换为 `SOGGY`，并涉及食欲/计数变量。携带 `CAGE` 会调用 `DO-DROWN`。必须逐一核对物品位置与替换，不要只验证能否进出水库。

`WTK` 上的 `CHILLY` 在源码注释中指受潮；`WTK-F` 有相应外观及收听条件，`HEAR-BAKER?` 也排除受潮设备。不能仅凭该标志就断言已经验证永久损坏、可修复性或后续通关后果。

**`DO-DROWN` 不是玩家死亡。** 该源码例程逐项检查笼中 `LEM/MAGPIE/MEEP` 并替换为对应死亡对象。类似地，`I-HOLD-BREATH` 耗尽后源码安排自动回到水面，并非直接杀死玩家。语义名称不能代替阅读例程。

`IN-CIST-D` 在尚未屏息时设置 `BREATH-HELD? = 4` 并排队 `I-HOLD-BREATH`；后者递减、警告、到期上浮。目标版已验证：携带正常取得的发光木片下潜后，第一条 `wait` 出现警告，第二条自动浮回水面。`V-WAIT` 源码默认推进多个计时步，不能把屏息4次计数解释为4条wait。其他光照条件仍需分别复现。

`SPILL-MILL` 是风车台面坍塌后的复杂分支，包含笼中动物后果、`WTK/BAG/EBAG` 处理、物品落水、`MEEP` 替换、视线物品和呼吸状态。第三轮已验证平台计时、取镜立即坍塌、落水与部分物品可见后果；未携带的受潮物品及笼中动物组合仍未知，不能由坍塌公共尾声命中推出。

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

### 第三轮：已独立验证的条件

下表均由主代理正式采集器从全新开局重跑，完整身份、指令、过场、退出、原始响应绑定与全部声明检查通过。指令数包括观察命令；最后一栏为分数/moves，不是攻略步数。

| 场景 | 指令数 | 自动检查 | 末尾数值 |
|---|---:|---:|---|
| `reservoir_wtk_wet` | 167 | 4 | 34 / 221 |
| `reservoir_full_bag_wet` | 143 | 4 | 30 / 196 |
| `reservoir_empty_bag_content_wet` | 144 | 8 | 30 / 196 |
| `reservoir_empty_bag_pocket_wet` | 144 | 4 | 30 / 197 |
| `reservoir_full_bag_pocket_rejected` | 140 | 6 | 30 / 193 |
| `reservoir_full_bag_cage_wet` | 161 | 4 | 31 / 211 |
| `reservoir_empty_bag_nested_content_wet` | 164 | 9 | 31 / 213 |
| `reservoir_wtk_container_rejected` | 122 | 5 | 28 / 117 |
| `reservoir_caged_magpie` | 151 | 7 | 31 / 201 |
| `reservoir_caged_roadrunner` | 155 | 9 | 31 / 205 |
| `reservoir_caged_lemming` | 183 | 10 | 32 / 232 |
| `reservoir_mill_timer` | 145 | 10 | 30 / 236 |
| `reservoir_mill_recover` | 143 | 12 | 31 / 233 |
| `reservoir_mill_pause` | 140 | 6 | 30 / 216 |
| `reservoir_mill_accelerate` | 135 | 5 | 30 / 209 |
| `reservoir_mill_held_breath` | 137 | 5 | 30 / 210 |
| `reservoir_mill_take_turns` | 139 | 12 | 30 / 209 |

物品：对讲机正常开启时有声音，入水后明确显示受潮且收听为安静；满袋直接持有或装入闭笼、空袋装入口袋都能观察到湿袋替换。装有信用卡的空袋直接携带或再装笼，入水后新湿袋不显示卡片，拿卡片报告不可见。否定、视觉片段与物品名分别检查，避免仅匹配公共尾句。转录只证明本次不可访问，不能断言卡片在VM中的最终位置。原版普通入水的EBAG分支没有风车坍塌中的`MOVE-ALL`，这是源码解释线索，尚不能据此宣称全部内部后果。

容器限制：满袋放入口袋要求先清空；已实际持有的对讲机放入口袋、打开的鸟笼都因大小被拒。后一场景止于Underground，没有入水；不能把源码的一层容器遍历等同于所有组合正常可达。真正跑通的嵌套案是玩家→笼→空袋→卡片，并未验证任意深度递归。

动物：喜鹊、走鹃、旅鼠分别有正常取得、装笼与入水路线；入水前活体、入水后对应死亡对象和溺水专属片段均有可见证据。`DO-DROWN`自身没有文字，未设置虚假的例程输出断言。不能用与火化共用的长尾句代替溺水条件片段，也不将这些路径等同全部动物状态覆盖。

风车：首次登台的吱响后，三个wait依次产生呻吟、危险下垂和坍塌；离台三次wait后返回仍继续原来的警告序列。后者证明这条固定序列的可见时间关系，不是读取内部计时器。聆听平台一次出现两级警告，下一wait坍塌；首次取镜立即坍塌。坍塌后玩家在水面，水底能看见镜子并回收得1分、随后佩戴；坏平台不能再登。手持bandage/splinter/spade落到水底、穿戴物和口袋卡片保留为人工逐项观察，自动检查未声称核对了完整对象集合。地面走鹃仍活着，不能据此判断被携带或装笼的坍塌后果。

回合：独立插入score探针，取镜坍塌前后都是30分207moves，随后下潜208、主动上浮209。坍塌前已屏息时，下一次下潜同一响应先到水底再自动上浮。后续引擎迁移必须区分“已处理但不推进普通回合”和普通动作，避免多跑一次回合处理改变气息状态；不能据此推广到所有坍塌入口。

可重复性：最初3次wait的Japan到达前缀受喜鹊随机事件影响，4条末尾moves少1，严格报告正确失败。源码`V-WAIT`遇任一事件返回真值会提前结束。带笼路线改用6次单回合look保证女孩到场，六条修改路线在独立重复中数值一致，之后按新路线重新绑定并全量采集。4次look不足的失败探索也保留，没有通过放宽回合范围掩盖差异。专门研究风车/屏息的wait仍保留；其他随机性未固定。

最终本地证据：`.local-research/t17-accepted-2026-10-19/`。失败和探索保留在`t17-acceptance-*`、`t17-route-refinement-*`、`t17-route-six-look-*`、`t17-six-look-repeat/`，不混入最终报告。

### 第四轮：风车物品与笼中动物组合（T19）

六种对象各自验证玩家持有、先放平台两种正常路径；均从新游戏独立重采集，合计新增12场景/170检查。平台路径先look确认位置；动物在坍塌前确认活体，水面不可见的检查同时包含否定、视觉和对象名，随后下潜发现、取回并检查对应溺水对象。

| 对象与case中段 | held / platform指令数 | 检查数 | held / platform末尾分数、moves |
|---|---|---|---|
| EBAG含信用卡：`mill_ebag` | 149 / 151 | 11 / 13 | 30、219 / 30、221 |
| 满BAG：`mill_bag` | 145 / 147 | 7 / 8 | 30、215 / 30、217 |
| WTK：`mill_wtk` | 172 / 174 | 8 / 9 | 34、243 / 34、245 |
| 喜鹊：`mill_magpie` | 158 / 160 | 18 / 20 | 31、225 / 31、227 |
| 走鹃：`mill_roadrunner` | 162 / 164 | 18 / 20 | 31、229 / 31、231 |
| 旅鼠：`mill_lemming` | 190 / 192 | 18 / 20 | 32、256 / 32、258 |

完整case为`reservoir_`加表中段再加`_held`或`_platform`。最终报告`.local-research/t19-accepted-2026-10-19/report.json`：41 captured /41 verified /0 failed /0 unknown /2 static-only，350检查全部通过。

关键差异已动态验证：风车坍塌将空袋内容物移到湿袋，信用卡仍可实际取回；普通入水的既有路径则不可访问卡片。满袋坍塌后变湿袋，WTK取回显示受潮且无声。三种笼内动物的持有/平台放置路径均替换为对应溺水对象。这里证明的是各条可见路径，不是全部容器、动物或隐藏状态。首批运行时M1–M3只移动扁平物品，尚未实现这些容器/动物条件。

### 仍未验证的水库条件

1. 其他正常可达容器中的WTK、更多嵌套层级、受潮设备能否修复及所有后续用途。
2. 风车坍塌的深层嵌套、混合动物/物品、空笼/开笼、不同穿戴条件，以及相同对象仅由计时坍塌触发的全部变体；已验证12案不能代替这些组合。
3. 黑暗/光源前置、替代到达路线、全部动物/物品状态、随机性与内部状态观察。

T18首批运行时已接入平台与屏息的局部副作用；完整物品/容器/动物及光照仍按迁移规格推进。不把全部源码分支视为与当前发行版一致。

## 下一轮章节开发的输入

三个试点形成的是证据台账与候选行为规格。下一轮应先把每个已核实的动作和失败分支转成章节计划，明确原文片段、对象转换与回合结算，再申请/登记所需章节和核心文件范围。研究工具的片段匹配、重制版通关和一次剧情成功都不能替代这一验收。
