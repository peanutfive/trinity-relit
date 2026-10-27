# 序章手表与长水湖：原版核实及实现

2026-10-27，T19。人类要求先核实原版，再按原版制作；本轮只解除序章时间、涉水与白门时序部分的暂缓，不扩大为全章规则重写。文字版与2D共用这些规则，存档入口仍分别保存。

## 原版结论

纸鸟上的“四点钟”不是“只有16:00才准许进入长水湖”的条件。用原版正常推车路线提前到湖，以及在出发前多等十二分钟，均可继续。抵达湖边时，剧情把手表设为下午3:59:45并停住秒数；导弹与白门事件仍继续。通路首先受婴儿车/风向/涉水等行为条件影响，不能拿现实时间或手表显示值制造一扇四点整才开的门。

| 项目 | 本地DAT实测及原始程序互证 |
|---|---|
| 开局手表 | 下午3:30:00 |
| 一般有效动作 | 结算15秒；查看手表先显示动作前的时间，再结算 |
| WAIT | 请求四个时钟周期，即平静状态60秒；显著事件可提前打断 |
| TIME | 查询不结算时间；背包、分数、帮助与未识别输入也不推动该时钟 |
| 防空警报 | 检查3:57:45时触发第一阶段，该次动作结算后显示3:58:00；八次警报后第九阶段死亡 |
| 撞车抵湖 | 立即设为3:59:45、停表；撞车本身不执行第一个湖边事件 |
| 湖岸下水 | SWIM、WADE、ENTER WATER，以及岸上的E/IN均可涉水；不必先等白门出现 |
| 向陆地方向离开 | 仍留岸，直接推进湖上奇景；首次会跳过静寂直接看到导弹。S不是下水通道 |
| 门尚未出现时输入ENTER DOOR | 不移动、不推进事件，并提示看不到门 |
| 门已出现但站在岸边 | 不能隔岸穿门；有效尝试仍推进危险 |
| 进入Wabe | 原版手表数字随机闪烁，伦敦湖边倒计时结束 |

抵湖后的有效周期依次为：

1. 风停、静寂。
2. 导弹进入视野。
3. 发现导弹缓慢下落，白门显现。
4. 一群乌鸦穿门，仅一次。
5. 天鹅和鸭子穿门。
6. 鸭子推着载有动物和走鹃的圆木穿门。
7. 导弹触门，玩家死亡。

`SWIM → WAIT → WAIT → ENTER DOOR`是一条原版成功序列。第六阶段之后入门时，走鹃已随圆木离去，不能在过门文本和动画里再飞一次。湖岸/水中往返也不能重置危险。

## 证据和复验

本地原版为Z-machine v4、release12、serial860926，DAT SHA-256：
`c49ce555bf4a9f0703587ff3462a7cb998c82ef9d72e461b18e5444dc6d6ac35`。
解释器为`/opt/homebrew/bin/dfrotz` 2.55。对象表提取确认Long Water #121、Wading #438；方向属性中的E/IN、陆地方向和返回口均为条件例程，不能把例程地址解释成房间号。

原始转录及注释保存在本地`/tmp/trinity-clock-probe-*`。以下只记录哈希和实验目的，不附原文或派生对象数据：

| transcript文件后缀 | SHA-256 | 实验 |
|---|---|---|
| cadence | `6cb24b7377cc2b5f5ff7239271498a7beb3af1a56247db078d007c24737d9491` | 连续看表、WAIT、背包、分数、未知输入 |
| canonical | `9ce1b9a84a8ed46d4489bbb35f15a5aeb967d4451fa5aafa6864ced5ddf3e959` | 正常路线、涉水、两次等待、过门、Wabe看表 |
| crash-clock | `91de6a56a9564279a86ddbe48c6bb8555583cc0f07cef740c7702919353f8dea` | 抵湖、停表和有限事件窗口 |
| fast-delay | `b6b233c20404bc230c4c6cec0e9f73ef993eb16a650425fbd3348272b1b54be0` | 提前/延迟抵湖对照 |
| early-failed-door | `89794a5c82564cf382ff6b15ef94be7d0d6bd6c884057bd45fadc16f43fd6fce` | 不可见白门的失败动作不推进时间 |
| watch-deadline | `5fa61f80f9f047a4b88b6df7abd31196099ba428e9a00d84635fac3f412975fe` | 普通时钟、防空警报与死亡边界 |

这些临时文件可能被系统清理。复验时以仓库`scripts/commands_prologue.txt`路线为基础：先在原版`VERBOSE`，买鸟食后单独`TAKE BAG`，抵湖后分别运行`TIME`、`SWIM/WAIT/WAIT/ENTER DOOR`、持续`WAIT`、提前`ENTER DOOR`、岸边`S/E/ENTER WATER`和涉水后`OUT`等独立分支。测试时的看表命令也可能消耗周期，不能把它当无副作用的调试探针；需要自由查询时用`TIME`。

另以公开的[Trinity原始程序存档](https://github.com/historicalsource/trinity)交叉检查，原文件只存于`/tmp`：

- [events.zil](https://github.com/historicalsource/trinity/blob/master/events.zil)：CLOCKER、I-AIR-RAID、I-LONDON-HOLE。
- [things.zil](https://github.com/historicalsource/trinity/blob/master/things.zil)：WRISTWATCH-F、GO-TO-LONG-WATER、GO-INTO-LWDOOR。
- [places.zil](https://github.com/historicalsource/trinity/blob/master/places.zil)：SWIM-IN-LWATER、DONT-MISS-MISSILE、WADING。
- [verbs.zil](https://github.com/historicalsource/trinity/blob/master/verbs.zil)与[misc.zil](https://github.com/historicalsource/trinity/blob/master/misc.zil)：WAIT、TIME、自由命令与显示格式。

版本对应的行为以本地DAT实测为准。未提交DAT、JSON真值表、原始源码或转录。提交前Git直连fetch失败，已通过GitHub API确认main仍为57c5f9d、开发分支父提交仍为22d0e97，再以已核实的origin/main同步；不把网络失败写作fetch通过。

## 实现与问题根因

旧手表用总回合数乘30秒拼出时间，小时固定为3；另一个80回合计时器控制警报，两者没有共用时间。到湖后计时器停止，湖岸onTurn又另算两步，返回岸边会重置；涉水每回合重复打印乌鸦。因此看表、白门和危险窗口彼此矛盾。

现在`js/prologue-time.js`保存独立的秒数和湖边阶段，仍使用已有GameState的counter、flag及可恢复的TIMERS回调。没有修改`engine.js`。时间与事件先后按原版处理；WAIT可被现有NPC输出/警报中断。撞车保留身上佩戴的手表。源已核实的长入门段落保留，走鹃按逃离阶段显示。

2D新增T看表、R等待，可在Esc中改键。L环顾提交真正LOOK。F仍负责对象操作、下水与穿门；湖岸E/IN与下水热点共用一个可见入口。物理走动的帧数、读文字、播放/跳过动画、地图、暂停不额外结算原版周期，换房或执行剧情命令才交规则层结算。

两个入口读档后均调用章节时钟恢复，不重放onEnter。新档保存精确秒数与事件阶段；旧档缺少这些字段，只能按旧计时器/已见导弹/白门估算并标记`prologue_clock_estimated`，无法倒推出历史上未保存的准确时间。不能承诺旧档与原版从头游玩的时刻完全相同。

章节校验工具原先把export剥掉再用普通函数加载，无法支持真实模块依赖；出口检查还会吞掉加载错误后继续报告。经人类追加授权，三个校验器改用真实ES module加载，语法失败必须失败；不修改出口真值、白名单或判断标准。补齐CHAPTER_PLAN中的11个序章对象号，避免序章被当作未映射房间跳过。出口act检查同时改为限定实际exits函数，避免误把后续事件的moveTo当成出口行为。

## 本批验收和边界

- 项目95项、2D159项检查通过；章节规范与Wabe专用校验通过。故意加入错误出口moveTo、目标错误或坏依赖，校验均失败。
- 出口真值检查实际覆盖111房/499出口，仍报告43项既有偏差，退出码1；未新增偏差。条件例程不是这个静态比较器的完整覆盖范围，湖边行为另由上述原版实验和专项测试核对。
- 23个2D场景、34个默认热点、82个已绘制出口结构检查通过；道路美术仍是逐房待审，未升级为全部批准。
- `tools/browser-clock.mjs`实际检查T/R/L、正常帧率、暂停/M、不变的3:59:45、门前/门后、F下水/过门、刷新续玩、超时死亡和活档保护，页面错误0。完整`browser-smoke.mjs`和`browser-japan.mjs`流程亦通过。
- 已运行开发技能规定的客户端并检视截图/状态；时钟专项、涉水、白门显现、Wabe及后续章节截图也已逐一检查。验收产物仅保存在`/tmp`。

这不是全游戏时间系统验真：其他历史章节的钟表/天象尚未逐章核实；通用失败动作的原版计时分类仍不完整；涉水后的E/IN方向入门别名尚待与既有跨章移动协议一起处理，本轮可用F/ENTER DOOR通路。鸟食领取/保留、池塘揭示、Wabe首次行动中断等旧债仍暂缓。乌鸦/水禽/圆木的专用演出及完整球壳坍缩动画尚未制作，文本按已核实阶段推进，不能把素材未完成与规则未核实混写。

后续制作先核实原版“计时周期、自由动作、等待中断、入口触发、读档恢复”，再接表现层；不要再从纸条字面推导时间锁，也不要让渲染帧或动画长度成为剧情计时依据。
