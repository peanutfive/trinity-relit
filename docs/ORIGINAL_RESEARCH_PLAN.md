# Trinity 原版研究工具开发计划

2026-10-16。人类要求先写计划，再按计划实施，允许子代理协作。本轮交付是可重复运行的原版研究工具链和三个谜题试点；全章内容迁移另按试点结果排期。

## 目标和范围

从 ZIL 源码、目标发行版字节码及原版运行结果形成可追溯的行为规格，辅助故事、谜题、剧情与文本还原。REA 负责开发期运行采集与比较；Z-machine 专用工具负责原版格式。所有结论保留证据和未知项。

- 基线游戏：Z-machine v4 / Release 12 / Serial 860926 / header checksum 0x16ab；另记录实际 SHA-256 与校验和验证。
- ZIL 档案：historicalsource/trinity，固定提交 16a024ce6bc5b9da85f42e65d7f9fd93b32c808c；开发快照与发行版一致性默认未证实。
- REA 参考：peanutfive/rea，固定提交 d901561640121272bf1498d85e38e1ac8b3f5793；安装时另记录实际 CLI 版本、包来源和 Node 版本，不能以相似版本号宣称源码完全一致。
- 仓库交付：计划、通用工具、合成测试夹具、指令场景、中文研究报告与来源索引。原版 DAT、ZIL、响应转录、源码索引和 REA Evidence 全部在 `.local-research/` 或仓库外，不提交。
- 游戏运行时、章节、地图 ID 和语义模型均不在本轮修改范围。研究结论经验证后，另按既有章节工作流迁移。

## 阶段和验收

| 阶段 | 工作 | 验收标准 |
|---|---|---|
| P0 基线与边界 | 同步 main、登记任务、固定来源、记录原版身份与工作目录 | 可重复执行的基线命令；有摘要、版本和版权隔离检查；原工作树未被覆盖 |
| P1 源码索引 | 解析 ZIL 结构；索引定义、调用、源码位置、文本片段、静态出口分类 | 嵌套、注释和字符串测试通过；实际源码可索引；未知宏/条件出口不误判为直连 |
| P2 原版运行器 | 启动 dfrotz，按命令边界采集、超时/退出处理、可重跑的 JSON 证据 | 原版真实场景运行成功；记录输入/输出与完整性，不把超时/截断记为成功；不依赖网络运行原版 |
| P3 REA 接入 | 固定 CLI 调用，生成 capture-process 场景，验证采集与比较 | 在支持的 Node 下真实执行一次 REA 采集和比较；检查退出、截断、unknown；缺工具有明确诊断，不伪造 Evidence |
| P4 三个试点 | 老妇人、纸鸟、水库：源码分支清单、指令、真机证据、与重制版差异 | 三个试点均有可定位资料；每个分支标明静态/运行验证/未验证；至少序章两例有成功和失败/重复路径的实际原版证据；水库若路径未跑到必须保留未知并提供后续路径 |
| P5 整合交付 | 一键研究入口、使用说明、测试、既有验证、版权与变更检查 | 新工具测试和全套 npm test 通过；npm run verify 通过；出口无新增偏差；按计划逐项填写结果和限制 |

## 具体交付与分工

- 主代理：`docs/ORIGINAL_RESEARCH_PLAN.md`、`scripts/original-research/{cli,baseline,fetch-source,capture,scenario,report}.mjs`、`scripts/original-research/lib/{common,capture}.mjs`、`tests/original-research.test.mjs`、`.gitignore`、package.json 研究命令、README、TASKS、SHIP_PLAN、progress；负责整合与本地证据。
- 子代理 zil_index：`scripts/original-research/{index}.mjs`、`scripts/original-research/lib/zil.mjs`、`tests/original-research-zil.test.mjs`。不动共享文档。
- 子代理 rea_adapter：`scripts/original-research/{rea}.mjs`、`scripts/original-research/lib/rea.mjs`、`tests/rea-adapter.test.mjs`、`docs/REA_ADAPTER.md`。安装和证据只写 `.local-research/` 或 /tmp。
- 子代理 pilot_specs：`research/pilots.json`、`docs/ORIGINAL_PILOTS.md`。原版运行产物只写 /tmp；不动章节或共享工具。

## 研究规格

每条行为包含：稳定 ID、目标版本、房间/对象映射、前置条件、指令、正常/失败/重复结果、状态变化（只有实际可观察时）、回合/计时、源码符号与位置、运行证据路径和摘要、未知项。分清“故事资料”“谜题依赖”和“剧情触发”，不能以一次通关或故事摘要代替分支覆盖。

证据优先级：目标发行版的可复现行为 > 已与该版本核对的静态数据 > 尚未匹配的源码线索 > 推断。仅终端采集不能证明隐藏状态、全部解法或所有文本分支；随机事件与排版差异要显式说明。禁止自动忽略任何剧情/失败响应以制造比较一致。

## 后续全章路线（不混同本轮完成标准）

试点验收后，按序章 → Wabe → Ranch → Desert/Pacific → 其余章节逐章扩展分支台账；每章先补证据，再形成谜题依赖图、剧情触发表和文本来源表，最后修改重制版并回归。未达到的水库支路、版本差异、随机性和内存状态可观测性列为研究欠账，不声称全原版已还原。

## 执行记录

- [x] P0 基线与隔离
- [x] P1 源码索引
- [x] P2 原版运行器
- [x] P3 REA 实际接入
- [x] P4 三个试点
- [x] P5 整合验收


## 2026-10-16 本轮验收结果

- 基线 main 57c5f9d。Git HTTPS 同步两次失败后，使用 GitHub API 获取原 merge commit 的签名与原始 payload，重建并逐字节验证 Git commit SHA，再同步 origin/main。未覆盖原工作树；计划在 `codex/original-research` 分支执行。
- 原版身份通过：Release 12 / Serial 860926 / v4 / checksum 0x16ab，声明长度与校验和有效；SHA-256 在本地 baseline.json。源码固定提交下载14个文件（13个ZIL＋README），Git blob及本地文件清单验证通过。
- 索引结果：13文件、3328定义、81624词法引用、7721字符串、1139出口分类、0诊断。这些是全部档案文件统计，不能等同当前游戏的活跃定义数量。
- 9个原版场景按提示符完整执行；19/19 指定命令响应的源码片段命中。水库6个场景仅完成源码规格与后续路线，未获得原版正常到达路线，不计入运行验证。
- REA npm6.4.0 在Node24.19.0下完成两次独立的老妇人场景采集，均正常退出、无截断，owned process group验证与临时目录移除成功。第一次额外报告4个无关进程无法验证，已原样保留并未触碰这些进程。
- REA比较原样返回 changed：第一处差异是终端帧时间 10ms vs 0ms，输入时序也有差异；拼接原始终端字节的 SHA-256 完全一致。filesystem/process仍为unknown。这证明采集和比较接口工作，不能宣称全程序等价，也没有为得到一致结果而删除原版响应。
- 完整测试105/105、章节规范通过；出口检查仍为旧43项，报告与main基线逐字一致。新增测试覆盖ZIL注释/转义、误覆盖输出、悬空symlink、截断/超时、来源与场景绑定，以及REA错误/清理边界。
- 真实证据：`.local-research/final-2026-10-16/`；REA两次证据和比较在 `/tmp/trinity-rea-woman-{first,second,comparison}.json`。原版与派生内容未纳入提交。本轮仅本地开发交付，没有推送或部署。

P0–P5 完成指本轮研究工具与试点交付；水库动态验证、全章故事/谜题/剧情台账与内容迁移仍按后续路线推进。
