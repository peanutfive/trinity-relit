# REA 适配与证据边界

本模块是开发工具，不进入浏览器启动路径，不改变游戏状态、章节、parser 或物品。

## 两种身份，不能混用

- 研究参考仓库：<https://github.com/peanutfive/rea>，固定提交 `d901561640121272bf1498d85e38e1ac8b3f5793`。
- 已实际运行的发布工具：npm `rea-agents@6.4.0`。包内 repository 字段指向 `morluto/rea`。

两者的版本字符串同为 6.4.0，**不代表源码或构建相同**。例如参考提交文档列出的 `REA_DARWIN_MODULE_CACHE_PATH` / `REA_DARWIN_SWIFTC_PATH` 在本次 npm 发布包的 helper 中尚未实现。适配器 `doctor` 分开显示参考提交与安装版本，将源码身份标为 `not_verified_by_version`。`adapter_node` 是研究适配器自身的 Node；显式传入 `--node` 时，`rea_node` 通过实际执行所选 Node 的 `--version` 取得，省略时标为 `unknown`，不根据适配器运行时或 shebang 猜测。使用 fork 构建时请显式选择其 CLI 路径，并另存构建来源与工具指纹；不自动替换工具。

## 安装与运行

REA 需要支持的 Node：`^22.19.0 || ^24.11.0 || >=26.0.0`。系统 Node 23 不受其支持。先选择合适的 Node，再手动安装到独立目录（不是游戏运行时依赖）：

```sh
npm install --prefix /tmp/trinity-rea-tools --no-audit --no-fund --omit=optional rea-agents@6.4.0
node scripts/original-research/rea.mjs doctor \
  --rea /tmp/trinity-rea-tools/node_modules/rea-agents/scripts/rea.mjs \
  --node /absolute/path/to/supported/node
```

不必运行 `rea setup`，不用修改全局 Codex / MCP 配置，也不用安装 Hopper、Ghidra、Frida 或其他深度分析 provider。发布包自身的依赖与平台 PTY 包由 npm 安装；适配器不自动运行 npm / npx，不自动访问网络。

```sh
node scripts/original-research/rea.mjs capture \
  --scenario /tmp/scenario.json --out /tmp/capture.json \
  --rea /tmp/trinity-rea-tools/node_modules/rea-agents/scripts/rea.mjs \
  --node /absolute/path/to/supported/node

node scripts/original-research/rea.mjs compare \
  --left /tmp/authority.json --right /tmp/reconstruction.json \
  --out /tmp/comparison.json \
  --rea /tmp/trinity-rea-tools/node_modules/rea-agents/scripts/rea.mjs \
  --node /absolute/path/to/supported/node
```

如 `rea` 已在 PATH 中，可省略 `--rea` / `--node`。指定 `--node` 时，两者必须为绝对路径。底层调用使用参数数组和 `shell:false`，实际接口是 `--format json`；不要使用参考文档某些示例中的 `--json`。支持比较时用 `--trace FILE` 传入精确 trace specification。

`capture` 执行 scenario 指定的本机程序。REA 继承宿主环境，这不是沙箱；观测路径也不限制子进程的读写。只运行自己已检查的 scenario。本适配器把终端进度送到 stderr，把上游原始 Evidence JSON 保存在仓库之外；输出文件必须不存在，避免误覆盖。输出与输入不能相同，路径检查会解析父目录 symlink。

## macOS 前提与实测

需要原生 `@lydell/node-pty` 平台包和 Apple `xcrun swiftc`，后者编译进程身份检查器。捕获还需要允许只读进程表检查。在严格沙箱下，npm 6.4.0 可能因 Swift 共享缓存不能写入而失败；不能通过跳过进程身份检查来“修复”。应授权适当环境运行，或验证含缓存路径配置的 fork 构建。`doctor` 仅证明 CLI 命令存在，只有成功采集及其 cleanup 记录才证明本机实际能力。

2026-10-16，在 macOS arm64、Node 24.19.0、npm REA 6.4.0、Homebrew dfrotz 下已实际采集启动、`look`、`quit` / `y`，观察到正常退出及 owned process group / renderer / temporary root 清理成功。第一次沙箱内运行明确返回 Swift cache 权限失败；在允许缓存与进程检查的运行环境中通过。原版输出与本机绝对路径只保存在 `/tmp`，不提交入库。

**dfrotz 的开局键必须与第一条游戏指令分开。** 本机即使传 `-q -p` 仍显示 `[Press any key to begin.]`；先发单独的 `\r`，再发 `look\r` 等命令。否则第一条“look”可能只用于开始游戏，导致错误声称指令已执行。定时事件不以游戏回合计时；应检查 interaction 已派发和输出中实际观察到的响应。

## 什么能证明，什么仍未知

REA 采集终端 raw / rendered 帧、定时输入派发、退出、采样进程与选定文件快照。它不直接读取 Z-machine flags、物品位置、计时器，也不原生反汇编 Z-machine。没有选定文件观测时，文件副作用仍为未知；采样也可能遗漏短命进程。

原版与重制版比较必须保持比较合同一致：同一绝对 cwd、显式环境、输入事件与时间、终端、观测路径、normalization、timeouts 和 limits。可执行程序与参数可以不同。双语 UI 与终端原版的外观本来不同，逐字终端比较不适合直接宣称游戏完全等价，应另做行为断言并保留文字差异。

上游 `unknown`、truncation、cleanup 状态原样保留。CLI 的成功输出另附操作摘要（退出、清理、截断、剩余未知项），原始 Evidence 文件保持不变；模块也提供 `summarizeCapture()` 只读投影。适配器不把 CLI 成功或匹配部分文本转换为完整等价证明，不把超时当成正常完成。命令解析失败、非 JSON、上游错误与本地字节预算超出不会保存成有效 Evidence。

适配器外层有 120 秒等待预算，正常 scenario 应设置更短的自身 timeout 并给清理预留空间；长场景请通过模块的 `timeoutMs` 显式增加预算。适配器取消会把取消传给 REA；中断后要核对上游清理状态再重试。


## 本轮两次独立场景采集

2026-10-16，生成 `woman_help` 的相同定时场景后分别采集两次（非自比较），两次正常退出且无截断。REA 默认比较报告 changed，首处为终端帧时间10ms/0ms，输入派发时间也有差异；独立拼接所有原始帧后，原始终端字节摘要完全一致。保留上游结果，不把 changed 自动改为等价。filesystem/process 仍 unknown；第一次采集还记录数个无关进程的身份无法验证，未触碰它们。


第二轮新增长路线含原版输出门控的过场按键。直接REA定时scenario无法表达这项前置，生成器会拒绝而不是静默丢掉按键；这些路线使用研究工具的提示符capture/正常检查点验证。REA原始Evidence与普通转录的来源仍分开记录。
