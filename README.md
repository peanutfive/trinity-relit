# Trinity Relit

让经典 Infocom 文字冒险游戏重新可玩。

---

## 为什么是 Trinity

`Trinity (1986)` 由 Brian Moriarty 编写、Infocom 出版，被广泛认为是 Infocom 最优秀的作品之一。游戏融合了历史与奇幻元素，以散文诗般的笔触探讨原子弹的毁灭性力量与核时代战争的徒劳。Trinity 之名，取自 1945 年 7 月人类第一次核爆炸试验的代号。

今天能玩到它的人很少了——需要安装解释器、在终端操作、用英文输入指令。门槛不在于游戏本身，在于运行环境和语言。Trinity Relit 从这里出发，试验几种降低门槛的方式。

---

## 方案说明

### 方案 A：保留原作，加一层中文接口

`trinity_cn.py` 不动原版游戏逻辑，只在外面包一层 Gemini API：游戏输出翻译成中文，玩家的中文输入翻译成游戏命令。

```bash
# 需要: dfrotz, python3, google-genai, Gemini API Key
python3 trinity_cn.py
```

- 游戏输出实时翻译成简体中文
- 支持中文指令输入（"往北走"、"拿起伞"）
- 输入 `/原文` 显示上次英文原文

### 方案 B：浏览器端语义匹配原型（主开发线）

`prototype/` 完全在浏览器本地运行，不需要服务器，不需要 API Key。

核心思路：文字冒险的事件空间是有限的，玩家输入不需要生成式回答，只需要找到语义最接近的已知事件并执行。用 `multilingual-e5-small` 嵌入模型（~130MB）计算余弦相似度来做匹配，离线可用。

**当前进度**：全流程章节骨架已就位，约 130 个房间，支持从序章经 The Wabe 枢纽到各分支（日本、地下、轨道、太平洋、冻原等）及主线沙漠/牧场/终章。序章与 The Wabe 等章节可完整游玩，其余章节按 `CHAPTER_PLAN.md` 逐步填充。

```bash
cd prototype
python3 -m http.server 8080
# 浏览器打开 http://localhost:8080
```

- 无服务器、无 API Key，完全离线可用
- 中/英文指令均支持，解析器 + 语义兜底
- 章节懒加载，首屏只加载序章
- 内置调试面板，可查看语义匹配分数

---

## 项目结构（方案 B）

| 文件 / 目录 | 说明 |
|-------------|------|
| `prototype/ARCHITECTURE.md` | 架构说明：入口、分层、事件执行、章节切换协议 |
| `prototype/CHAPTER_PLAN.md` | 章节开发总计划（房间列表、机制、依赖） |
| `prototype/CHAPTER_RULES.md` | 章节编写规范、API、校验清单 |
| `prototype/js/data/*.js` | 各章节房间与事件数据（prologue、wabe、japan…） |
| `prototype/js/engine.js` | 游戏状态与引擎（勿随意修改） |
| `prototype/js/parser.js` | 中英混合命令解析 |
| `prototype/js/embedding.js` + `embedding-worker.js` | 语义匹配（Web Worker） |
| `scripts/` | 辅助脚本：Z-machine 描述提取、wabe 出口提取、转录解析与验证等 |
| `zparse.py` | 从原版 `TRINITY.DAT` 提取地图与数据的 Z-machine 解析器 |

新增或修改章节时：先看 `CHAPTER_PLAN.md` 确定房间与机制，再按 `CHAPTER_RULES.md` 编写并校验，以 `prologue.js` 为参考实现。

---

## 游戏文件

出于版权原因，仓库不包含原版游戏文件。运行方案 A 需要自行准备 `TRINITY.DAT` 并放到对应目录。方案 B 的英文描述均来自原版，地图与出口以 `zparse.py` 提取结果为准。

---

## License

MIT
