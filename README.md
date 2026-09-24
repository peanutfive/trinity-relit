# Trinity Relit

让经典 Infocom 文字冒险游戏重新可玩。

**[在浏览器中开始游戏](https://peanutfive.github.io/trinity-relit/)** — 打开即玩，无需安装、无需账号、无需 API Key。

---

## 为什么是 Trinity

`Trinity (1986)` 由 Brian Moriarty 编写、Infocom 出版，被广泛认为是 Infocom 最优秀的作品之一。游戏融合了历史与奇幻元素，以散文诗般的笔触探讨原子弹的毁灭性力量与核时代战争的徒劳。Trinity 之名，取自 1945 年 7 月人类第一次核爆炸试验的代号。

今天能玩到它的人很少了——需要安装解释器、在终端操作、用英文输入指令。门槛不在于游戏本身，在于运行环境和语言。Trinity Relit 从这里出发，试验几种降低门槛的方式。

---

## 怎么玩

直接用中文或英文输入你想做的事，例如：

```
往北走          看看那只纸鹤          拿起雨伞
n               examine the bird      take umbrella
```

方向、动作、以及「把伞给女孩」「用斧头砍泡泡」这类复合句都能识别。输入「帮助」查看完整指令提示。

游戏内容为原版 11 个章节、约 130 个房间，从伦敦肯辛顿花园一路到新墨西哥的三位一体试验场。

---

## 两种实现

### 方案 B：浏览器端中英解析器（主开发线）

`prototype/` 完全在浏览器本地运行，不需要服务器，不需要 API Key，也不需要下载模型。

```bash
npm run dev
# 打开 http://127.0.0.1:8080/
```

- 纯静态 ES module，打开即玩，可离线
- 中/英文指令均支持，含把字句、用字句等复合结构
- 章节懒加载，首屏只加载序章

> 关于语义兜底：项目早期用 `multilingual-e5-small` 嵌入模型做「解析失败时找语义最接近的事件」。该路径目前**未启用**，引擎只走结构化匹配。`embedding.js` 与 `embedding-worker.js` 保留完好，恢复时应改为按需懒加载，而不是放在启动路径上阻塞开局。

### 方案 A：保留原作，加一层中文接口

`trinity_cn.py` 不动原版游戏逻辑，只在外面包一层 Gemini API：游戏输出翻译成中文。英文命令可以直接输入；中文方向等固定命令也可使用。复杂中文翻译需由集成方提供可信场景词表，当前 CLI 不自动启用这条路径。

```bash
# 需要: dfrotz, python3, google-genai, Gemini API Key
python3 trinity_cn.py
```

- 游戏输出实时翻译成简体中文
- 支持固定中文方向和系统指令；复杂中文动作编译接口需可信词表
- 输入 `/原文` 显示上次英文原文

---

## 开发

需要 Node.js ≥22.7（CI 使用 Node 22），无运行时或测试依赖。

```bash
npm ci                 # 使用零依赖锁文件初始化
npm test               # 无 DOM 的完整主线通关 + 图完整性测试
npm run dev            # 本地起服务器
npm run verify         # 章节规范校验（CHAPTER_RULES.md §10）
npm run truth          # 从 TRINITY.DAT 生成出口真值表（需自备游戏文件）
npm run verify:exits   # 把章节出口与 Z-machine 真值逐条比对
```

测试通过真实中英文指令走完六扇蘑菇门、牧场和剪线结局；不会直接改房间或 flags。当前路线为 199 回合、73 个房间、21/100 分，覆盖边界与已发现的谜题缺口见 `SHIP_PLAN.md` 阶段 2。

测试文件使用 `.mjs`；不要给根 `package.json` 添加 `"type": "module"`，否则既有 CommonJS 校验脚本会失效。Node 对浏览器 `.js` 模块可能输出 `MODULE_TYPELESS_PACKAGE_JSON` 提示，不影响测试。

文档索引：

| 文档 | 内容 |
|---|---|
| [`SHIP_PLAN.md`](./SHIP_PLAN.md) | 发布收尾路线图与当前进度 |
| [`prototype/ARCHITECTURE.md`](./prototype/ARCHITECTURE.md) | 分层结构、事件执行路径、章节切换协议 |
| [`prototype/CHAPTER_PLAN.md`](./prototype/CHAPTER_PLAN.md) | 章节内容路线图与房间清单 |
| [`prototype/CHAPTER_RULES.md`](./prototype/CHAPTER_RULES.md) | 章节编写规范与引擎 API |
| [`prototype/MECHANISMS_VS_PLAN.md`](./prototype/MECHANISMS_VS_PLAN.md) | 已实现机制对照表 |

---

## 游戏文件与版权

出于版权原因，**本仓库不包含原版游戏文件，也不分发任何原版游戏数据**。运行方案 A 需要自行准备 `TRINITY.DAT`。方案 B 的英文描述来自原版，地图与出口以 `zparse.py` 的解析结果为准。

Trinity (1986) 的著作权归属 Infocom / Activision。本项目是非商业的独立致敬与可访问性实验，与版权方无关，也未获其背书。

---

## License

项目代码采用 [MIT](./LICENSE)。原版文本的权利不在此授权范围内。
