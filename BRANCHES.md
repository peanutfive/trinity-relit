# 分支与归档索引

更新：2026-10-26。仓库：`peanutfive/trinity-relit`。本次只整理引用、文档和本地元数据，没有合并开发线或部署。

人类同日确认维护两个产品版本：原版式文字版与HD-2D改编版。文字版保留命令输入和原作规则还原路线；2D版沿当前画风逐章开发。两个版本分别有入口与存档，分支只是协作方式，不把`dev`与2D当前状态混作同一成品。

## 当前远端分支

| 分支 | 用途 | 本次核对的提交 | 与发布线的关系 |
|---|---|---|---|
| `main` | 正式发布；更新会触发 Pages | `57c5f9d` | PR #3～#6 已合并 |
| `dev` | 原版研究、牧场/容器/动物规则与文字试玩的集成 | `e62be7a` | 基于 main，另有10个提交；尚未发布 |
| `codex/2d-garden-demo` | 当前 HD-2D 场景、动画、探索交互与独立存档 | 本次清理前 `e059032`，之后仅增加仓库整理文档 | 基于 main；清理前8个提交，未整合 dev 的规则变化 |
| `codex/phase-2-walkthrough-ci` | 旧混合提案，等待拆分裁决 | `0e435e9` | [草稿 PR #1](https://github.com/peanutfive/trinity-relit/pull/1)；仍有4个不等价的独有提交 |

2D 后续工作从 `codex/2d-garden-demo` 继续；原版规则研究从 `dev` 继续。两者不能因同基于 main 就视为已经互相整合。旧 PR #1 包含额外的运行时/解析/语义接线，不能把已拆入 main 的通关测试当作整份提案已合并。

## 已归档的远端分支

以下分支已从分支列表移除。每个旧 tip 均先保存并验证为同仓库标签：`archive/2026-10-26/<原分支名>`，可从 GitHub 的 Tags 页面查找；提交历史没有重写。

| 原分支 | 完整旧 tip | 清理依据 |
|---|---|---|
| `claude/cleanup-and-decisions` | `d245664022a5e5132353ec0eb42490e34c8dd7e9` | 已包含于 main |
| `claude/rewrite-ranch` | `1a2bf37f4d15b5cccf67d94e6a414f714bd72067` | [PR #3](https://github.com/peanutfive/trinity-relit/pull/3) 已合并，tip 为 main 祖先 |
| `claude/save-system` | `420b0fa15099124c0df4c3c497531f355cda8e1c` | 原提交不在 main 祖先链，但8/8稳定补丁 ID 均与 main 中的整合提交一致 |
| `codex/fix-intent-loading` | `4d759f4618039f3516816b3a0dbc59ffe7440326` | [PR #4](https://github.com/peanutfive/trinity-relit/pull/4) 已合并，tip 为 main 祖先 |
| `codex/fix-intent-progress` | `10a6d3d48ee81dd3dbaca500c7f9d5b8ef5fd299` | [PR #5](https://github.com/peanutfive/trinity-relit/pull/5) 已合并，tip 为 main 祖先 |
| `codex/original-research` | `ad19d9a035995ecedc61ea21fd5496dc855f3d0b` | 已完整包含于 dev |
| `codex/ranch-mechanics` | `d8a2f33fda13ef070b72994637e091664a4fb8e9` | 已完整包含于 dev |
| 远端 `codex/animal-mechanics` | `5bd524cc8bc965d83b0400d8db96ceee7f953a2b` | 已包含于 dev；dev 还保留其后4个提交 |

例如恢复一个旧的本地分支，不必切换当前工作区：

```sh
git branch claude/save-system archive/2026-10-26/claude/save-system
```

## 本地工作树与暂存

本地 `main` 已从 `1a1e849` 快进至 `origin/main`。其余已集成的闲置本地分支已清理；本地保留5条分支，包括两个现有工作树的检出分支：

| 工作树 | 保留的本地分支 | 处理 |
|---|---|---|
| 当前仓库根目录 | `codex/2d-garden-demo` | 继续当前2D开发 |
| `.claude/worktrees/original-research` | `codex/animal-mechanics` | tip 与 dev 同为 `e62be7a`，改为跟踪 `origin/dev`；没有删掉额外4个提交 |
| `.claude/worktrees/read-agents-tasks-07ad6e` | `codex/fix-intent-progress` | 保留干净的既有检出，取消已归档的上游；未删除工作树 |

本地另外保留 `main` 和旧提案分支。没有切换或修改另外两个工作树的文件。原版文件、模型、测试产物和本地 `.agents/` 均保留在原处；`.agents/` 仅通过本仓库的 `.git/info/exclude` 排除，不改变项目共享的忽略规则。

两份旧 stash 的新增内容已经分别保留在当前2D进度或 dev 中；本次只从暂存列表归档移除。完整备份在本地 Git 公共目录下的 `cleanup-backups/2026-10-26/`：

- `pre-cleanup.bundle`：清理前全部分支和两份 stash 的可达对象，已通过 `git bundle verify`。
- `manifest.json`、`remote-plan.json`、`remote-result.json`：原引用、上游、工作树及远端归档收据。
- `stash-0.patch`、`stash-1.patch`：便于查阅的旧暂存差异。
- `refs/backup/repository-cleanup/2026-10-26/stash-0` 和 `stash-1`：完整 stash 的本地恢复引用。

需要重新放回 stash 列表时，例如：

```sh
git stash store -m '恢复2026-10-22的旧进度暂存' refs/backup/repository-cleanup/2026-10-26/stash-0
```

完整备份包含原有历史内容，只留本地，不提交或上传。不要用 `push --mirror` 全量同步本地恢复引用；本次只上传上述8个明确指定的归档标签，后续普通提交也显式指定目标分支。

## 后续维护

完成任务后先核对 PR/包含关系，归档确认后再清理旧分支；仍被工作树检出的本地分支单独处理。业务变更继续使用 agent 前缀的任务分支，按 AGENTS.md 经审查合并。`main`、`dev` 与2D线的整合和发布须作为独立任务处理。
