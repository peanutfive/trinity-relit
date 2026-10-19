# 原版研究检查点

检查点使用原版正常 SAVE 和解释器正常 RESTORE，帮助研究人员重复到达已由真实命令走过的状态。它不修改 DAT、不设置 VM flags、不传送玩家，也不把未知进度包装成通关证据。

## 创建与恢复

```sh
node scripts/original-research/checkpoint.mjs create \
  --dat '/local/path/TRINITY.DAT' \
  --commands /tmp/route.json \
  --out /tmp/new-checkpoint-directory \
  --dfrotz /opt/homebrew/bin/dfrotz

node scripts/original-research/checkpoint.mjs restore \
  --dat '/local/path/TRINITY.DAT' \
  --checkpoint /tmp/new-checkpoint-directory/manifest.json \
  --commands /tmp/continuation.json \
  --out /tmp/new-restored-observation.json \
  --dfrotz /opt/homebrew/bin/dfrotz
```

也可以直接复用仓库已验证场景的前130条正常指令，无需手工制作路线文件：

```sh
npm run research -- checkpoint create \
  --dat '/absolute/path/to/TRINITY.DAT' \
  --case reservoir_enter_exit --prefix-count 130 \
  --out .local-research/new-reservoir-checkpoint

npm run research -- checkpoint restore \
  --dat '/absolute/path/to/TRINITY.DAT' \
  --checkpoint .local-research/new-reservoir-checkpoint/manifest.json \
  --out .local-research/new-reservoir-restored.json
```

`--case` 与 `--commands` 二选一，`--prefix-count` 只能用于创建并且不得超过场景完整路线长度；所选前缀和过场键仍全部从fresh执行并记录。恢复省略 `--commands` 时只执行自动score/inventory核验。

`--commands` 支持 JSON 数组（例如 `["north"]`）或 `{ "commands": [...], "continuations": [...] }`。过场控制使用既有采集协议：`commandIndex`、规范化完整提示行的 `lineSha256` 与显式 `key`（换行或空格）。控制键不算游戏指令，历史会单独记录它们、指纹以及实际观察到的提示行范围。恢复续行的索引相对于调用者给出的 commands，模块自动处理前置观察指令的偏移。

创建只允许 fresh start。目标目录必须不存在，且位于仓库之外或忽略的 `.local-research/`；恢复输出也必须是新文件。现存路径、软链接与硬链接不会被覆盖。普通历史中的 SAVE、RESTORE、RESTART、UNDO、QUIT 等会话控制及解释器转义指令会被拒绝，它们不能隐藏在 fresh 历史中。创建最多 497 条用户输入，恢复最多 498 条，为自动观察预留空间；可用 `--timeout-ms` 设置整体采集预算。

创建会执行完整路线，再依次执行 `look`、`inventory`、`score`，最后通过正常 SAVE 写入 `state.qzl`。这些观察指令也计入完整输入历史；SAVE 和文件名属于单独控制步骤。成功目录包含：

- `state.qzl`：原版解释器保存的 Quetzal 文件。
- `creation.json`：从开局到 SAVE 的完整终端转录、逐条响应范围、过场键及退出结果。
- `manifest.json`：绑定原版全文件 SHA256、版本头、解释器真实路径与二进制 SHA256 / 版本、存档 SHA256 / 大小 / IFhd、创建转录 SHA256，以及完整命令和过场历史指纹。

历史指纹对 UTF-8 的 `JSON.stringify({commands,continuations})` 结果计算 SHA256；另保留两个数组各自的指纹。源码提交仅是固定的历史研究参考，不能证明该源码编译出了这份发行版。失败采集可以留下 `creation.json` 供诊断，但不会生成成功 manifest；重试请选择新目录。

恢复首先复核原版全文件指纹、Quetzal IFhd、存档、转录、命令与过场历史、实际响应范围和解释器指纹。随后在新 dfrotz 进程中使用 `-L state.qzl`，确认原版 RESTORE 成功标记。**本机 dfrotz 2.55 的 `-L` 不需要开局按键**，不能额外发送会被当作游戏输入的空行。

恢复先运行 `score` 与 `inventory`，与保存前的对应响应逐字比较，随后才执行请求的续行指令。输出种类固定为 `trinity-checkpoint-restored-observation`、来源固定为 `restored-checkpoint`，并引用原始 manifest / save / transcript / history 指纹，不能作为 fresh-start 路线转录。

## 回合与证据限制

**原版 LOOK 会消耗一回合。** 因此恢复时不能先 LOOK 再比较保存前 SCORE，否则会制造一回合差异。自动恢复观察仅先执行 SCORE / INVENTORY；`-L` 自身会显示房间。需要额外 LOOK 时，把它列入续行 commands，其真实回合变化会保留在转录中。

`complete` 要求采集无超时、无截断、解释器正常退出、观察到 RESTORE 成功，且最初 SCORE / INVENTORY 与保存前一致。它证明这组有限观察已完成，不证明每一个 VM flag、计时器、随机状态与所有分支均已逐项核验。只有根解释器生命周期被管理，脱离进程的后代清理未观察。

Quetzal IFhd 只有 release / serial / checksum 等元数据，不能替代原版的完整 SHA256。检查点指纹用于绑定本地文件和发现改动，并非签名；一整套人为伪造的存档、转录与 manifest 不能靠自报 SHA 变成可信历史。只把工具实际从 fresh-start 产生的 bundle 当作研究证据，不给来源不明存档补写成功履历。

## 2026-10-16 本地实测

- 序章路线 `north`：正常创建检查点，保存前为 2 moves；另进程恢复的首次 SCORE 仍为 2 moves，随后 WAIT 的真实回合变化保留。
- 由原版正常走出的 130 条路线及一处显式过场键：到达 South of Reservoir 后正常保存，完整记录 133 条输入（含三条观察），30 分、187 moves。另进程恢复后首次 SCORE / INVENTORY 一致；请求的 LOOK 后 SCORE 为 188 moves。

实测存档、manifest 与原版转录全部只在 `/tmp`，不纳入 Git。原版文件始终保持固定 SHA256，未执行调试传送或修改存档进度。
