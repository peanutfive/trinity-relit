# 已实现机制 vs 计划子任务 对照表

> 依据 `CHAPTER_PLAN.md` 逐章对照，随实现更新。  
> 验证命令：`node scripts/verify_chapters_rules.js`

---

## 章节 1：Prologue（序章）

| 计划机制/子任务 | 状态 | 说明 |
|-----------------|------|------|
| 11 房间、Kensington Gardens | ✅ | 11 间全部实现 |
| 婴儿车→长水湖、wading 过渡到 Wabe | ✅ | 条件出口 + transitionChapter 到 wabe meadow |
| paper_bird 取得/展开/阅读 | ✅ | take / open / read 事件 |
| enter_door 进白门到 Wabe | ✅ | 事件 + transitionChapter |
| 子任务 1.x（编写/验证） | ✅ | 已完成 |

---

## 章节 2：The Wabe（中央枢纽）

| 计划机制/子任务 | 状态 | 说明 |
|-----------------|------|------|
| **日晷系统**：Vertex 日晷+符号环，sundialSymbol 1–7 | ✅ | SUNDIAL_* 常量，vertex 事件改 s.sundialSymbol |
| **符号–门映射**：Mars→Japan, Pluto→Underground, Mercury→Orbit, Neptune→Pacific, Libra→Tundra, Alpha→Islet | ✅ | 各蘑菇门 when: s.sundialSymbol === SUNDIAL_* |
| **Klein 瓶 / Arboretum 翻转**：flipped 改变方向 | ✅ | arboretum/arbor 内 s.flipped 判断与翻转事件 |
| **蘑菇门**：条件出口 + activateChapter | ✅ | Moor / Ossuary / Waterfall / Herb Garden / The River / Chasm's Brink 共 6 扇 |
| **Waterfall→Orbit** 需肥皂泡 | ✅ | s.has("soap_bubble") 才可 in；无泡时 fail 提示 |
| **Cottage 肥皂泡/斧头** | ✅ | 取肥皂泡事件；斧头在 top_of_arbor（需光源） |
| 30 房间、出口连通 | ✅ | 30 间，验证通过 |
| 子任务 2.1–2.9（zparse/dfrotz/编写/items/main/验证） | ✅ | 房间与出口已做；items 有 sundial/ring/soap_bubble/axe 等 |

---

## 章节 3：Japanese Playground（广岛）

| 计划机制/子任务 | 状态 | 说明 |
|-----------------|------|------|
| 从 Moor 蘑菇门进入（Mars ♂） | ✅ | wabe moor in → activateChapter("japan") + moveTo playground |
| 纸鹤谜题、雨伞给女孩、铲子在 shelter | ✅ | give umbrella to girl；shelter 取铲子；give paper to girl 重折 |
| 向北/向南致命 | ✅ | n/s 条件出口 eng.die |
| 白门返回 Wabe（moor） | ✅ | ride_bird / enter_door → moveTo("moor")，s.chapter = "wabe" |
| 2 房间、子任务 3.1–3.6 | ✅ | playground + shelter，验证通过 |

---

## 章节 4：Underground（地下）

| 计划机制/子任务 | 状态 | 说明 |
|-----------------|------|------|
| 从 Ossuary 蘑菇门进入（Pluto ♇） | ✅ | wabe ossuary in → activateChapter("underground") |
| 需灯光、尸妖无光即死 | ✅ | hasLight(s)；underground_2 无光 eng.die |
| 灯笼开/关、放中间再过尸妖 | ✅ | turn on lantern；drop lantern 设 lantern_dropped_middle |
| 裂缝木片→石龙子、石龙子入口袋 | ✅ | put_splinter_into_crevice；take_skink；put_skink_in_pocket |
| 白门回 Ossuary | ✅ | underground_1 out → ossuary |
| 3 房间、子任务 4.1–4.4 | ✅ | 3 间，验证通过 |

---

## 章节 5：Earth Orbit（地球轨道）

| 计划机制/子任务 | 状态 | 说明 |
|-----------------|------|------|
| 从 Waterfall 蘑菇门进入（Mercury ☿，需 soap_bubble） | ✅ | 在 wabe 检查；orbit 由 waterfall in 进入 |
| 卫星上、肥皂泡、斧头破泡返回 | ✅ | break_bubble_axe：destroy soap_bubble + moveTo("waterfall") |
| lump 吸卫星（若有） | ✅ | examine_satellite 将 lump 放到 orbit_satellite |
| 零重力/肥皂泡包裹机制 | ⬜ | 计划🟡；当前仅房间+破泡返回，无零重力移动 |
| 2 房间、子任务 5.1–5.4 | ✅ | 2 间，验证通过 |

---

## 章节 6：Pacific Island（比基尼环礁）

| 计划机制/子任务 | 状态 | 说明 |
|-----------------|------|------|
| 从 Chasm's Brink 蘑菇门进入（Neptune ♆） | ✅ | wabe chasms_brink in → activateChapter("pacific") → mesa |
| 7 房间（mesa/scaffold/底部/四海滩） | ✅ | 7 间，出口连通 |
| **开箱 / 按开关 / 七分钟 / 按按钮** | ✅ | open box、push switch（startTimer 7）、push button（成功/太迟） |
| 信号弹/定时器 | ✅ | 七分钟计时 + perTurn 过期提示 |
| 子任务 6.1–6.4 | ✅ | 房间与事件完成，验证通过 |

---

## 章节 7：Russian Tundra（苏联冻原）

| 计划机制/子任务 | 状态 | 说明 |
|-----------------|------|------|
| 从 Herb Garden 蘑菇门进入（Libra ♎） | ✅ | wabe herb_garden in → activateChapter("tundra") |
| 11 房间（含 tundra_1–8, under_platform, cliff_edge, platform） | ✅ | 11 间 |
| 悬崖裂缝、旅鼠、笼子 | ✅ | cliff_edge 裂缝描述；lemming 放置；look/take/put_lemming_in_cage |
| 白门回 Herb Garden | ✅ | tundra_1 out → herb_garden |
| 隐蔽/时间限制机制 | ⬜ | 计划有；未单独实现 |
| 子任务 7.1–7.4 | ✅ | 验证通过 |

---

## 章节 8：Islet（过渡小岛）

| 计划机制/子任务 | 状态 | 说明 |
|-----------------|------|------|
| 从 The River 蘑菇门/渡船到达（Alpha α） | ✅ | wabe the_river in → activateChapter("islet")，文案为「渡船」 |
| **渡船/银币（Charon）** | ✅ | give silver coin to oarsman → ferry_paid，银币消耗 |
| 白门→New Mexico Desert | ✅ | enter_door → activateChapter("desert") + moveTo("shack") |
| 2 房间（islet, sand_bar） | ✅ | 2 间，两处均可进白门到 desert |
| 子任务 8.1–8.4 | ✅ | 验证通过 |

---

## 章节 9：New Mexico Desert + Tower（主线）

| 计划机制/子任务 | 状态 | 说明 |
|-----------------|------|------|
| 34 房间（塔区/道路/沙漠/山麓/特殊） | ✅ | tower_landing, paved_road_1–6, desert_1–9, foothills_1–3, shallow_crater, shack, jeep 等 |
| 塔/十字路口/棚屋后→Ranch | ✅ | behind_shed s → activateChapter("ranch") + nw_ranch |
| **拉闸 + 剪线结局** | ✅ | pull_breaker → cut_wire_finale → transitionChapter(prologue, palace_gate) |
| **吉普车离开逻辑** | ✅ | jeep 内 use radio/turn dial → jeep_departed，塔台可下、南侧描述与 in 出口更新 |
| 吉普车驾驶/移动模式（引擎扩展） | ⬜ | 计划🟡；当前为「旋钮触发离开」叙事，无驾驶移动 |
| 核爆倒计时 | ⬜ | 计划有；未实现 |
| 子任务 9.1–9.8 | ✅ | 房间与结局链完成，验证通过 |

---

## 章节 10：McDonald Ranch（牧场）

| 计划机制/子任务 | 状态 | 说明 |
|-----------------|------|------|
| 25 房间（室内/院子/水库/风车等） | ✅ | 实为 26 间（含 under_windmill），与计划一致 |
| 与 Desert 互通（nw_ranch ↔ behind_shed） | ✅ | nw_ranch n → desert；behind_shed s → ranch |
| Assembly Room、响尾蛇描述、壁橱 | ✅ | 描述中有 rattlesnake、closet 旅鼠/蛇谜题 |
| **壁橱谜题（关门→开笼→开门→蛇杀旅鼠）** | ✅ | close door、open cage、open door 事件链；蛇杀旅鼠后 assembly_room 描述更新 |
| 水库/水下/风车/风车下 | ✅ | 房间与出口均有；edge_reservoir u→windmill，windmill d→under_windmill |
| 游泳/潜水机制（引擎扩展） | ⬜ | 计划🟡；当前为房间切换，无单独游泳状态 |
| 子任务 10.1–10.7 | ✅ | 验证通过 |

---

## 章节 11：Finale（终章）

| 计划机制/子任务 | 状态 | 说明 |
|-----------------|------|------|
| 结局、回 Kensington Park | ✅ | 在 desert base_of_tower 剪线后 transitionChapter(prologue, palace_gate) |
| the_end 房间 | ✅ | finale.js 中 the_end（1 间） |
| **时间循环揭示 + 最终分数** | ✅ | 剪线文案含时间循环表述；剪线后输出 Final score / 最终分数 |
| 计划中的 halfway / thin_air 等（约 3 间） | ⬜ | 未单独实现；结局由剪线一步完成 |
| 子任务 | ✅ | 剪线→回 Prologue 的流程已实现 |

---

## 引擎扩展计划 vs 实现（CHAPTER_PLAN 表）

| 功能 | 计划章节 | 优先级 | 状态 |
|------|----------|--------|------|
| 日晷符号切换 | wabe | 🔴 | ✅ vertex 转环改 sundialSymbol |
| Klein 瓶翻转 | wabe | 🔴 | ✅ arboretum 内 flipped 与方向 |
| 蘑菇门条件出口模板 | wabe | 🔴 | ✅ 6 扇门 when + activateChapter |
| 肥皂泡包裹 / 零重力 | orbit | 🟡 | ⬜ 未实现 |
| 吉普车移动模式 | desert | 🟡 | ✅ 叙事层「旋钮触发离开」；无驾驶移动 |
| 游泳 / 潜水 | ranch | 🟡 | ⬜ 未实现 |
| 时间循环结局 | finale | 🔵 | ✅ 剪线文案 + 分数输出 |

---

## 图例

- ✅ 已实现（含叙事/事件/房间/出口）
- ⬜ 未实现或仅描述

更新本表后请运行：`node scripts/verify_chapters_rules.js`。
