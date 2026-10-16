# 原版研究工具使用说明

工具只在开发期运行，入口是 `npm run research -- ...`。完整开发计划见 [ORIGINAL_RESEARCH_PLAN.md](ORIGINAL_RESEARCH_PLAN.md)，三个试点的故事关系、谜题条件、剧情触发及未验证项见 [ORIGINAL_PILOTS.md](ORIGINAL_PILOTS.md)。

## 从源码到可重复的原版证据

需要 Node、已安装的 `dfrotz` 和自行提供的目标 `TRINITY.DAT`。下载公开源码时另需可访问 GitHub 的 `gh`；源码准备完成后，索引和原版场景采集可离线运行。目标固定为 Z-machine v4 / Release 12 / Serial 860926。

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
3. 从新游戏独立执行所有 `runtime-verified` 场景，按提示符边界关联每条命令与响应。
4. 检查指定响应中的源码字面量，输出分场景报告；水库的 `static-only` 场景保留静态状态。

默认 `dfrotz` 从 PATH 寻找，必要时加 `--dfrotz /absolute/path/to/dfrotz`。运行器单独处理开局按键和退出确认，场景里不包含这两项。超时、缺失提示符、启动错误、截断和非正常退出不会标记 `complete:true`；已经采集的局部证据仍会保存，便于排查。

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
  --case woman_help --out .local-research/run/captures/woman_help.json

npm run research -- report \
  --index .local-research/run/index.json \
  --captures .local-research/run/captures \
  --out .local-research/run/report.json
```

`report` 把每个场景绑定到转录文件摘要，并重新核对场景指令序列；更改场景后不能把旧转录算作新场景已完成。`source-output` 仅检查指定命令响应是否包含该例程的某个足够长字面量，ZIL 的显式换行映射为空白再比较。它不证明全部分支、隐藏状态、回合数或完整文本已还原。不同版本和随机输出导致未命中时，应保留差异继续研究，不自动补写原文。

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

本轮没有解决水库的完整原版到达路线、源码与发行版的全面对应、随机性的固定、VM 内部状态观测及全章行为覆盖。继续开发时按计划逐章扩展场景，把正常/失败/重复/计时分支及其证据分别登记，再进入重制版内容迁移。
