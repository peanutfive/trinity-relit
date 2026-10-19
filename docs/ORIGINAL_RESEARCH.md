# 原版研究工具使用说明

工具只在开发期运行，入口是 `npm run research -- ...`。完整开发计划见 [ORIGINAL_RESEARCH_PLAN.md](ORIGINAL_RESEARCH_PLAN.md)，三个试点的故事关系、谜题条件、剧情触发及未验证项见 [ORIGINAL_PILOTS.md](ORIGINAL_PILOTS.md)。

## 从源码到可重复的原版证据

需要 Node、已安装的 `dfrotz` 和自行提供的目标 `TRINITY.DAT`。下载公开源码时另需可访问 GitHub 的 `gh`；源码准备完成后，索引和原版场景采集可离线运行。目标固定为 Z-machine v4 / Release 12 / Serial 860926，并核对完整文件SHA256；同头部或同16位校验和但内容不同的文件也会被拒绝。

在仓库根目录执行：

```sh
npm run research -- fetch-source --out .local-research/source
npm run research -- run \
  --dat '/absolute/path/to/TRINITY.DAT' \
  --source .local-research/source \
  --out .local-research/run
```

第一条固定获取 `historicalsource/trinity@16a024ce6bc5b9da85f42e65d7f9fd93b32c808c` 的 ZIL 文件和档案说明，检查 Git blob 摘要并生成本地来源清单。不会获取未知启动脚本或执行档案中的程序。第二条批量执行：

1. 验证游戏文件头、长度、校验和，记录 SHA-256；核对源码文件与本地来源清单。
2. 生成所有 ZIL 文件的定义、词法引用、字符串来源及出口分类索引。
3. 从新游戏独立执行所有 `runtime-verified` 场景，按提示符边界关联每条命令与响应。长路线的过场按键只在声明行摘要命中后发送，并单独记录。
4. 检查指定响应中的源码字面量与score/moves数值，输出分场景报告；未验证的物品、动物与坍塌组合保留静态状态。

所有研究输出采用独占新建，不覆盖已有证据或输入文件；每次运行请选择新的输出目录。源码拉取目标必须不存在或为空。默认 `dfrotz` 从 PATH 寻找，必要时加 `--dfrotz /absolute/path/to/dfrotz`。运行器单独处理开局按键和退出确认，场景里不包含这两项。超时、缺失提示符、启动错误、截断和非正常退出不会标记 `complete:true`；已经采集的局部证据仍会保存，便于排查。

主要本地产物：

| 文件 | 内容 |
|---|---|
| `source/provenance.json` | 固定档案提交、Git blob 与文件 SHA-256 |
| `run/baseline.json` | 发行版身份、校验和、源码清单核对与 REA 参考身份 |
| `run/index.json` | 定义、词法引用、字符串、源码跨度、出口分类；含原版内容 |
| `run/captures/*.json` | 每个场景的输入、逐命令响应、完整转录、退出与完整性 |
| `run/report.json` | 指定片段命中、缺失或未知，静态场景及证据限制 |

来源清单是由固定提交拉取操作产生的本地证据，不是对源码与发行版完全相同的证明。索引统计包含档案里的历史稿和替代入口，不能用定义数量宣称游戏里有同样数量的活跃对象。`PER` 只说明存在例程出口，不能自行判定为无条件直连。索引保留注释/引号/嵌套上下文，不执行宏或拼接最终英文。

## 单独执行与报告更新

```sh
npm run research -- baseline \
  --dat '/absolute/path/to/TRINITY.DAT' \
  --source .local-research/source --out .local-research/baseline.json

npm run research -- capture \
  --dat '/absolute/path/to/TRINITY.DAT' \
  --case woman_help --out .local-research/single-case/woman_help.json

npm run research -- report \
  --index .local-research/run/index.json \
  --captures .local-research/run/captures \
  --out .local-research/report-review.json
```

`report` 核对精确原版指纹、manifest/场景指纹、正常退出、无截断、指令数量/顺序/index、逐字对应原始转录的连续响应跨度、以及过场控制。重复case证据直接拒绝。`captured`表示过程与身份完整，`verified`仅表示声明的可见检查通过；错误、缺证据或检查失败使验收命令非零。更改场景或检查后必须重新采集，不能复用旧指纹。

`source-output`默认检查指定命令响应是否包含该例程的某个足够长字面量。第三轮加入可选`literalSha256`：先把源码字符串中的`|`替换为换行，再用工具的`normalize()`折叠空白，计算UTF-8 SHA256；检查只能命中所选文件/符号内这一规范化文字。同例程其他文字不会替代它。源码中不存在该摘要、或片段短于`minLength`时属于配置/来源未知；合格片段存在但响应未见才是失败。需要检查短条件片段时，显式降低`minLength`并配合较长上下文片段；不能靠公共尾句区分溺水与其他死亡状态。

已确认的随机表述可使用互斥的`literalSha256AnyOf`，列1–32个唯一摘要；所有备选都必须在指定来源内存在且达到长度门槛，响应命中其中之一才通过。不存在的备选仍为unknown，不静默缩小集合。当前仅对WTK干态声音的4条源码表述使用此方式；湿态与死亡条件仍绑定专属片段。这不是忽略差异或允许任意输出。

片段检查不证明全部分支、隐藏状态或完整文本已还原，静默例程应通过后续可见观察核验，不对无文字的例程虚设匹配。`score-output`只从明确的score命令响应解析唯一的分数/回合数，不解释其他隐藏状态。不同版本和随机输出导致未命中时，应保留差异继续研究，不自动补写原文。

## REA 接入

REA 是显式选择的开发工具；基本研究流程不依赖安装它。实际验证的发布工具为 npm `rea-agents@6.4.0`，参考仓库 `peanutfive/rea` 固定提交另行记录，二者不能凭版本号视为同一构建。完整安装、Node 与 macOS Swift/PTY 前提见 [REA_ADAPTER.md](REA_ADAPTER.md)。

先用受支持的 Node 运行 doctor，随后生成原版场景：

```sh
npm run research -- rea doctor \
  --rea /absolute/path/to/rea-agents/scripts/rea.mjs \
  --node /absolute/path/to/supported/node

npm run research -- scenario \
  --dat '/absolute/path/to/TRINITY.DAT' \
  --dfrotz /absolute/path/to/dfrotz \
  --case woman_help --cwd /tmp --out /tmp/trinity-scenario.json

npm run research -- rea capture \
  --scenario /tmp/trinity-scenario.json --out /tmp/trinity-first.json \
  --rea /absolute/path/to/rea-agents/scripts/rea.mjs \
  --node /absolute/path/to/supported/node

npm run research -- rea capture \
  --scenario /tmp/trinity-scenario.json --out /tmp/trinity-second.json \
  --rea /absolute/path/to/rea-agents/scripts/rea.mjs \
  --node /absolute/path/to/supported/node

npm run research -- rea compare \
  --left /tmp/trinity-first.json --right /tmp/trinity-second.json \
  --out /tmp/trinity-comparison.json \
  --rea /absolute/path/to/rea-agents/scripts/rea.mjs \
  --node /absolute/path/to/supported/node
```

REA 输出路径采用更严格规则：必须位于所有 Git checkout 之外，且文件尚不存在。重跑时换新的输出文件名。不同可执行程序可以比较，但 cwd、定时输入、环境、终端与限额等比较合同必须相同。原版终端与双语网页本来存在展示差异，应先用同场景验证采集，再另设计原版/重制版行为断言。REA 的 `unknown`、截断、清理记录保持原样，成功运行 CLI 不等于游戏完全等价。

`scenario` 使用显式定时输入；提示符运行器则逐步等待。REA 采集后必须检查输入派发、退出和终端中实际观察到的响应，不能因为派发过输入就推断指令已被游戏执行。未捕获的 VM 内部状态始终是未知。

## 本地隔离和下一步

源码、DAT、转录、索引与 REA Evidence 均保留在 `.local-research/` 或仓库外。研究工具拒绝向可提交目录输出原版派生证据，包括常见符号链接绕过；测试只使用合成夹具。工具不会修改游戏文件、配置全局 MCP 或把原版资料加入提交。

第四轮已扩展至41个原版场景、350项可见检查（304片段、46数值），加入风车持有/平台放置的物品与三种笼中动物路径；未覆盖的深层与混合组合仍为2组静态。完整结论与[迁移规格](ORIGINAL_MIGRATION.md)逐项列出边界；源码与发行版全面对应、固定随机性、VM内部状态及全章覆盖尚未完成。

[原版检查点](ORIGINAL_CHECKPOINTS.md)只用于正常探索；最终报告从新游戏重采集。REA定时scenario不能执行带输出摘要门控的过场，生成器会明确拒绝此类场景；使用提示符capture或checkpoint，不丢弃按键。继续按计划逐章扩展正常/失败/重复/计时分支及证据，再进入重制版内容迁移。
