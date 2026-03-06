# Trinity Relit

让经典 Infocom 文字冒险游戏重新亮起来。

Infocom 在 1980 年代创作了许多出色的文字冒险游戏——Trinity、Zork、Wishbringer……这些游戏有着精妙的谜题设计和优美的文字，但今天几乎没有人再玩了。Trinity Relit 想改变这一点：**降低门槛，让更多人重新发现这些被遗忘的经典。**

## 这个项目做了什么

以 **Trinity (1986)** 为起点，探索用现代技术让老游戏复活的方式：

### 1. 中文翻译版 (`trinity_cn.py`)

通过 Google Gemini API 实时翻译，在终端里用中文玩原版 Trinity。

- 游戏输出自动翻译成中文
- 支持中文指令输入（"往北走"、"拿起伞"）
- 显示原文对照（输入 `/原文`）

```bash
# 需要: dfrotz, python3, google-genai, Gemini API Key
python3 trinity_cn.py
```

### 2. 浏览器端语义匹配原型 (`prototype/`)

一个完全在浏览器内运行的实验原型，不需要服务器、不需要 API Key：

- 使用 [multilingual-e5-small](https://huggingface.co/intfloat/multilingual-e5-small) 嵌入模型（~130MB）
- 用户输入中文 → 计算语义向量 → 余弦相似度匹配最近的游戏事件
- 包含 Trinity 开头的 6 个场景，有一条完整的通关路线
- 内置调试面板，可查看匹配分数

```bash
cd prototype
python3 -m http.server 8080
# 浏览器打开 http://localhost:8080
```

## 游戏文件

由于版权原因，仓库不包含 Trinity 原版游戏文件。你需要自行获取 `TRINITY.DAT` 并放到对应目录。

## 技术思路

```
方案 A: Gemini API 翻译（trinity_cn.py）
  用户中文输入 → Gemini 翻译成英文命令 → dfrotz 执行 → Gemini 翻译成中文 → 用户

方案 B: 浏览器端嵌入匹配（prototype/）
  用户中文输入 → 嵌入模型生成向量 → 余弦相似度匹配事件表 → 执行预写的中文回复
```

方案 B 的核心洞察：对于事件空间有限的文字冒险游戏，不需要生成式 AI——只需要一个能理解语义的嵌入模型做"最近邻搜索"就够了。这让完全离线、零成本的浏览器端体验成为可能。

## 愿景

世界上还有很多 Infocom 的经典作品等待被重新发现。如果这个项目能让哪怕一个游戏爱好者第一次玩到 Trinity，那就值了。

## License

MIT
