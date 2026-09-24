# 可选上下文意图边界

浏览器入口没有启用此功能。`GameEngine` 只有在调用方显式传入 `contextualIntent: { select, candidates }` 时才会尝试选择；普通游戏继续使用本地解析器。此模块不访问网络或读取密钥。

`candidates` 由可信代码声明，每个候选绑定当前房间的一个真实事件或一个现有物品的 `take`、`drop`、`examine` 动作。仅在确定性解析无法解决输入时，模块向 `select(request, { signal })` 提供原话、当前房间名、可见物品、背包物品和当前合法候选的 ID/意图标签。它不提供房间描述、隐藏物品、旗标、分数、事件代码或历史记录。候选数量、输入长度、可见物品数和等待时间都有上限；超出范围直接回到原有解析结果。

选择器只能返回与请求 token 对应的 `{ requestToken, decision: "action", candidateId }`、`{ requestToken, decision: "none" }` 或 `{ requestToken, decision: "ask_user" }`。未知字段、未知 ID、过期状态、取消、超时及服务错误都会回到原有的本地反馈。执行动作前会重新检查房间、物品解析、事件前置条件和事件优先级。`ask_user` 只显示本地固定澄清文字，不推进游戏回合或计时器。

此处只是可测试接口。若将来使用真实 Jev 服务，需要先提供安全的服务端或本地 companion 密钥边界、明确的数据发送选择、可信候选清单、语义质量评估和独立产品决策。不能把 TypeSafe/OpenRouter 密钥放进静态浏览器代码。当前项目没有传输层，也不会从 `main.js` 调用外部服务。
