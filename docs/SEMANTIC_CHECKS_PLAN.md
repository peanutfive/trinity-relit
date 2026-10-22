# T27 语义资源与正式页面验收

目标：新工作树缺资源时能明确诊断，仓库中的语义验收可直接重跑，真实输入框从正常开局验证模型建议与确认边界。沿用T25的已确认问题和T26通关基线，不修改游戏机制。

- [x] P0 同步并核对基线：main57c5f9d，dev和制作分支bea10ac；确认旧lifecycle对intentProgress返回值的假设过时。
- [x] P1 本地资产预检：新增check:models命令，明确缺失/空文件/非文件；开发服务器只提示不阻止标准命令，不自动下载。合成夹具验证缺失及无效资产不会误报就绪，不提交实际模型。
- [x] P2 修复既有模型语料/生命周期/同意窗口脚本：可选--channel；lifecycle进度探针用当前semanticProgress接口，保留各自验收边界。
- [x] P3 正式main页面：通过输入框正常执行前20步，不注入进度；同意前不下载，未知自然表达提出撑伞候选；取消与确认前完整状态不变，连续识别及刷新复用缓存；确认后21回合到Round Pond。只允许同源推理资源，记录console/page错误与资源响应；失败须覆盖本次结果，不复用旧成功收据。
- [x] P4 本地验收：check:models正负例、三个原有真实模型脚本、新main流程；npm test/verify通过，出口不新增；截图/文本人工检查、文档/任务更新。交付仅开发分支，不合并main或部署。

文件范围与持有者见TASKS T27。服务器提示仅在开发终端，不放到游戏界面；检查“存在且非空”不构成模型内容完整性或上游签名认证。真实模型脚本需要独立安装的Playwright和浏览器，不加入游戏运行时依赖。所有浏览器使用隔离上下文，不操作玩家当前存档。

已确认的下一批迁移候选：M5动物推动的Ranch门flag与其他玩家出口条件未完全统一。仅开展源码/缺口核对，不能把该研究直接扩展成受保护运行时文件的修改授权。

## 可重复执行

先在被服务的工作树运行`npm run prepare:models`、`npm run check:models`并启动服务器。以下示例使用8083；可按实际端口改`--url`。脚本默认加载独立安装的`playwright`和其Chromium；已有外部安装时加`--playwright /absolute/path/to/playwright/index.mjs`，使用已安装Chrome时加`--channel chrome`。

```sh
node scripts/verify_intent_browser.mjs --url http://127.0.0.1:8083/ --output /tmp/trinity-intent-corpus.json
node scripts/verify_intent_lifecycle_browser.mjs --url http://127.0.0.1:8083/ --output-dir /tmp/trinity-intent-lifecycle
node scripts/verify_intent_notice_browser.mjs --url http://127.0.0.1:8083/ --output-dir /tmp/trinity-intent-notice
node scripts/verify_intent_main_browser.mjs --url http://127.0.0.1:8083/ --output-dir /tmp/trinity-intent-main
```

三个旧脚本分别检查语料、resolver生命周期和说明/同意层，其中会构造专用测试状态，不代替真实主页面。新增main脚本从独立新游戏通过输入框执行测试指南前20条；随后用实际“导出存档”按钮读取活状态，另读自动存档，比较完整state。取消、确认和刷新续玩均不注入进度。脚本在导入依赖前先写入本次未通过收据，失败时覆盖错误，避免旧成功结果残留。main脚本先对实际服务目录的11个必需资源做HTTP预检；文件就绪命令不证明服务器指向同一工作树。

## 2026-10-22 验收与边界

- 自动测试325/325，章节规范通过。出口校验返回既有43项偏差，与`/tmp/pr6-base-exits.log`逐字一致，没有新增；不把非零退出码说成全图通过。
- 4组合成资源测试覆盖全缺、缺分词配置、空文件、同名目录及CLI退出码。真实完整资源与无资源的临时服务器均返回首页HTTP200；后者明确提示准备命令，新main脚本在HTTP404处失败并写本次失败收据，没有开始模型请求。
- 真实语料13/13，其中10次模型推理、3条规则澄清；lifecycle下载1次/Worker2个，notice下载1次/Worker1个且确认结算1回合。三个旧入口无需临时副本。
- 实际main：标准前20输入与征求同意阶段没有加载推理资源；“撑开伞”提出“撑伞”，确认前及取消后活状态和磁盘state都不变。连续识别复用Worker；刷新续玩新建Worker，中文权重仍总计请求1次。确认后21回合、Round Pond，保存一致、无死亡。11项服务资源HTTP200，JS/WASM/中文ONNX实际加载HTTP200；外部推理请求、页面异常和console.error均为0。
- 四个入口的缺失Playwright失败试验均覆盖旧成功收据，返回失败。独立代码审查无阻断，修复了测试路径含空格时的URL转换。
- 实际候选、刷新及确认截图和DOM已查看。标准游戏技能客户端也已运行并查看截图，仅有既存favicon404，无新增JS异常。产物仅`/tmp/trinity-t27-*`，不入库，不触碰玩家当前浏览器或存档。

这是本机同源资源和固定表达的复跑结果，不能解释为全游戏语义准确率、手机性能或公网冷下载承诺。11文件检查只涵盖当前运行必需子集，不替代prepare清单中的许可证/来源记录、内容校验或真实模型加载。

后续Ranch门迁移须先补正常原版观察：7条外门/纱门/室外门出口与1条东南房间前门出口尚未按flag阻挡；玩家开关与动物推门对内外两个原版对象的同步方式可能不同。先核实关闭方向、实际穿越、回合及旧档影响，再制定运行时计划；本轮未改这些机制。
