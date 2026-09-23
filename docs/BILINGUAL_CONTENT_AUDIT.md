# 双语内容审查

`scripts/audit_bilingual_content.js` 从 `prototype/js/data/` 的静态 JavaScript 字符串中确定性提取英文段落及其紧随的中文段落。它不会 import 章节模块，因此不会运行游戏代码；也不会修改任何内容。

```bash
node scripts/audit_bilingual_content.js --out /tmp/bilingual-report.json
node scripts/audit_bilingual_content.js --out /tmp/bilingual-report.json --dry-run /tmp/bilingual-review-request.json
```

报告的 `id` 是相对源路径和规范化双语段落内容的 SHA-256 截断值。输出中没有时间戳，给定相同输入时内容与排序保持一致。相同文本在同一文件中重复时，后续记录加稳定的出现序号后缀以避免冲突。

`reviewQueue` 是待人工审查的 advisory queue。词法信号把可能影响可玩性的文本归入以下 rubrics：

- `negation`：否定、禁止和不可能性。
- `direction`：方向、相对位置和移动目的地。
- `object`：关键物体及其属性。
- `puzzle_clue`：条件、先后顺序、工具和后果。

信号只用于筛选，不能判断语义等价。报告不改写双语文本，也不认证翻译忠实度。

`--dry-run` 会写出一个原生 Jev 请求（`model`、`state`、`questions`），其中每个队列记录的每个 rubric 是一个独立的 `choice` 问题，选项为 `consistent`、`possible_mismatch` 和 `insufficient_context`。默认仅构建前 10 条候选记录以控制上下文；用 `--review-offset` 和 `--review-limit` 构建后续有界批次。脚本本身不保存 API 凭据、不发送网络请求。请求可通过 Jev 的本地 `decide request.json --dry-run` 校验，该模式同样不会分类或发出网络调用。

Jev 的任何结果都只是 advisory judgment，不能触发文本自动改写或构成翻译忠实度认证；`possible_mismatch` 和 `insufficient_context` 都应进入人工编辑复核。

当前提取范围是本地 `.js` 文件中的静态字符串。带插值的模板字符串以及其他格式的内容会被明确排除，以避免执行或猜测动态内容。
