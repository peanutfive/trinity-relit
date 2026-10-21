# Trinity Relit：手工试玩测试指南

这是给测试者单独阅读的指南，不会显示在游戏内。

适用：GitHub 测试分支 `dev`（制作源分支 `codex/animal-mechanics`），本地试玩 <http://127.0.0.1:8083/>。制作基线为 `9aaf471`；已在该版本从全新开局实际核对。

目标：**217 条输入、217 回合、访问 74 间、27/100 分，触发时间循环结局并回到宫殿门。** 这是当前重制版的回归路线，包含六扇蘑菇门和牧场蛇谜题，不是原版 100 分攻略，也没有覆盖风车、水下、完整走鹃跟随或独立 Finale 章节。

## 怎么用

1. 想从头测试：先点击“导出存档”保留现有进度，再自行选择“重新开始”。本指南不会替你操作当前存档。
2. **按表格一行一次输入，只输入“指令”栏里的内容，不输入编号、反引号或说明。** 英文指令和表内几条中文指令均已实际验证；不需要语义模型参与。
3. 可以停下来读指南，实际等待时间不会让游戏走回合。但额外输入 `look`、`examine`、`wait` 等可能推进剧情；`i`、`score`、`help` 也会增加当前版本的回合计数。想严格对照 217 回合，就不要额外输入查询。可以点“导出存档”留检查点。
4. 如果你已在中途：根据房间和阶段条件查对应部分。下面的固定方向及转环次数只对“从头按表走”保证成立，不能从任意旧存档直接跳入。若曾改过日晷，从已有输出确认符号，再转到本阶段目标；不要机械照抄次数。
5. 位置或物品明显对不上时先停下，记录当前房间、刚才的输入和返回文字；不要靠连续 `wait` 试着推进。先与本段检查点核对。

### 方向速查

| 输入 | 含义 | 输入 | 含义 |
|---|---|---|---|
| `n` | 北 | `s` | 南 |
| `e` | 东 | `w` | 西 |
| `ne` | 东北 | `nw` | 西北 |
| `se` | 东南 | `sw` | 西南 |
| `u` | 上 | `d` | 下 |
| `in` | 进入 | `out` | 出去 |

### 全程检查点

分数是阶段参考，不要求在输入框额外输入 `score`。若额外查询过，最终回合数会变化。

| 阶段 | 步数 | 结束位置 | 参考分数 | 关键结果 |
|---|---:|---|---:|---|
| 1 序章 | 1–27 | 草地 Meadow | 15 | 通过白门；纸鸟与日晷指针已从长水湖重新取回 |
| 2 小屋鸟笼 | 28–36 | 小屋 Cottage | 16 | 前后门打开；喜鹊飞走；携带关闭的空笼 |
| 3 Japan | 37–60 | 荒野 Moor | 20 | 给伞、拿铲，纸鸟重新折好并带你返回 |
| 4 Underground | 61–87 | 纳骨堂 Ossuary | 22 | 带回点亮的灯笼和对讲机 |
| 5 Orbit | 88–121 | 瀑布 Waterfall | 22 | 肥皂泡破裂返回；按表放下斧头 |
| 6 Pacific | 122–143 | 深渊边缘 Chasm's Brink | 22 | 及时按下按钮并返回 |
| 7 Tundra | 144–166 | 药草园 Herb Garden | 23 | 关闭的笼中装着活旅鼠 |
| 8 牧场蛇谜题 | 167–200 | 棚屋后 Behind Shed | 26 | 旅鼠被蛇吃掉，蛇离开，安全退出牧场 |
| 9 结局 | 201–217 | 宫殿门 Palace Gate | 27 | 吉普车离开，取宝石、拉闸、剪线，显示循环结局 |

> 三次“走不进去/下不去”是故意安排的测试：调日晷前在荒野输入 `in`、拿泡泡前在瀑布输入 `in`、吉普车离开前在塔台输入 `d`。相应行会标“预期阻挡”，看到提示后继续下一行。

## 1. 序章：足球、指针、纸鸟、风向与婴儿车

步骤 **1–27**。

这里有回合倒计时，先照表完成，回头再做自由探索。先拿足球与指针，展开纸鸟；购买面包屑、喂鸟、拿红宝石会改变风向。雨伞被吹上树后用足球取下。

**若你已经拿到雨伞、正卡在怎么继续：** 还需要完成拿红宝石改变风向，并把婴儿车推进兰开斯特小路；再依次 `open pram` → `enter pram` → `open umbrella`。只站在路上撑伞会被风吹走。撞到长水湖后，按表重新拿回纸鸟和指针。

| 步骤 | 指令 | 执行后位置／关键提示 |
|---:|---|---|
| 1 | `看看四周` | 宫殿门（Palace Gate） |
| 2 | `e` | 花径（Flower Walk） |
| 3 | `拿足球` | 花径（Flower Walk） |
| 4 | `nw` | 日晷草地（The Wabe） |
| 5 | `unscrew gnomon` | 日晷草地（The Wabe） |
| 6 | `take gnomon` | 日晷草地（The Wabe） |
| 7 | `n` | 圆池塘（Round Pond） |
| 8 | `捡起折纸鸟` | 圆池塘（Round Pond） |
| 9 | `open paper bird` | 圆池塘（Round Pond） |
| 10 | `w` | 大道（Broad Walk） |
| 11 | `buy crumbs` | 大道（Broad Walk） |
| 12 | `feed birds` | 大道（Broad Walk） |
| 13 | `take ruby` | 大道（Broad Walk）；触发风向改变，继续推车路线 |
| 14 | `n` | 黑狮门（Black Lion Gate） |
| 15 | `push pram` | 因弗内斯台（Inverness Terrace） |
| 16 | `push pram` | 兰开斯特门（Lancaster Gate） |
| 17 | `wait` | 兰开斯特门（Lancaster Gate）；老妇人的伞被风吹上树 |
| 18 | `throw ball at tree` | 兰开斯特门（Lancaster Gate） |
| 19 | `拿雨伞` | 兰开斯特门（Lancaster Gate） |
| 20 | `push pram` | 兰开斯特小路（Lancaster Walk） |
| 21 | `open pram` | 兰开斯特小路（Lancaster Walk） |
| 22 | `enter pram` | 兰开斯特小路（Lancaster Walk） |
| 23 | `open umbrella` | 长水湖（Long Water）；从婴儿车冲入长水湖；接下来重新捡物 |
| 24 | `take paper bird` | 长水湖（Long Water） |
| 25 | `take gnomon` | 长水湖（Long Water） |
| 26 | `s` | 涉水（Wading） |
| 27 | `enter door` | 草地（Meadow） |

**检查点：** 结束应在草地（Meadow），15分。已过序章白门，纸鸟和指针重新拿回；不要在长水湖漏捡。

## 2. Wabe：取鸟笼，先放走喜鹊

步骤 **28–36**。

先开小屋前门，再拿笼、开笼。喜鹊会从敞开的门飞走；随后关上空笼并打开后门，为后续路线准备。不要把喜鹊一直关在笼中带去抓旅鼠。

| 步骤 | 指令 | 执行后位置／关键提示 |
|---:|---|---|
| 28 | `s` | 南沼泽（South Bog） |
| 29 | `ne` | 深渊边缘（Chasm's Brink） |
| 30 | `ne` | 断崖（Bluff） |
| 31 | `open front door` | 断崖（Bluff） |
| 32 | `e` | 小屋（Cottage） |
| 33 | `take cage` | 小屋（Cottage） |
| 34 | `open cage` | 小屋（Cottage）；喜鹊从敞开的门飞走 |
| 35 | `close cage` | 小屋（Cottage） |
| 36 | `open back door` | 小屋（Cottage） |

**检查点：** 结束应在小屋（Cottage），16分。手中是关闭的空鸟笼，喜鹊已飞走，前后门已打开。

## 3. Japan：日晷设为火星，帮女孩并乘纸鸟返回

步骤 **37–60**。

本段先故意验证关着的蘑菇门，再返回日晷。当前初始刻度需要连续转六次才到火星，这是表中六条 `turn ring` 的原因。进入日本后，先给女孩雨伞，再到避难所拿铲子并交纸，最后返回操场乘纸鸟。

| 步骤 | 指令 | 执行后位置／关键提示 |
|---:|---|---|
| 37 | `w` | 断崖（Bluff） |
| 38 | `se` | 陨石坑边缘（Crater's Edge） |
| 39 | `s` | 荒野（Moor） |
| 40 | `in` | 荒野（Moor）；**预期阻挡：蘑菇门紧闭；继续下一行** |
| 41 | `w` | 弯道（The Bend） |
| 42 | `w` | 楼梯底部（Bottom of Stairs） |
| 43 | `u` | 日晷顶点（Vertex） |
| 44 | `turn ring` | 日晷顶点（Vertex）；当前日晷：水星 |
| 45 | `turn ring` | 日晷顶点（Vertex）；当前日晷：海王星 |
| 46 | `turn ring` | 日晷顶点（Vertex）；当前日晷：天秤座 |
| 47 | `turn ring` | 日晷顶点（Vertex）；当前日晷：阿尔法 |
| 48 | `turn ring` | 日晷顶点（Vertex）；当前日晷：第七符号 |
| 49 | `turn ring` | 日晷顶点（Vertex）；当前日晷：火星 |
| 50 | `d` | 楼梯底部（Bottom of Stairs） |
| 51 | `ne` | 悬崖下（Under Cliff） |
| 52 | `se` | 荒野（Moor） |
| 53 | `in` | 游乐场（Playground） |
| 54 | `wait` | 游乐场（Playground）；等待女孩出现 |
| 55 | `把雨伞给女孩` | 游乐场（Playground） |
| 56 | `e` | 避难所（Shelter） |
| 57 | `take spade` | 避难所（Shelter） |
| 58 | `give paper to girl` | 避难所（Shelter） |
| 59 | `out` | 游乐场（Playground） |
| 60 | `ride bird` | 荒野（Moor） |

**检查点：** 结束应回到荒野（Moor），20分。已有铲子；纸鸟已重新折好。雨伞已经交给女孩，不必再去找原来的伞。

## 4. Underground：日晷设为冥王星，带光源取物

步骤 **61–87**。

进入地下前先取得发光木片。**命令保持 `turn lantern` 原样，不要改写成 `turn on lantern`。** 到中洞先放下已经点亮的灯笼，再放木片；返程经过中洞时取回灯笼。不要提前把两种光源都丢在别处。

| 步骤 | 指令 | 执行后位置／关键提示 |
|---:|---|---|
| 61 | `w` | 弯道（The Bend） |
| 62 | `w` | 楼梯底部（Bottom of Stairs） |
| 63 | `u` | 日晷顶点（Vertex） |
| 64 | `turn ring` | 日晷顶点（Vertex）；当前日晷：冥王星 |
| 65 | `d` | 楼梯底部（Bottom of Stairs） |
| 66 | `w` | 南沼泽（South Bog） |
| 67 | `take splinter` | 南沼泽（South Bog） |
| 68 | `ne` | 深渊边缘（Chasm's Brink） |
| 69 | `ne` | 断崖（Bluff） |
| 70 | `e` | 小屋（Cottage） |
| 71 | `s` | 墓地（Cemetery） |
| 72 | `n` | 古墓（Barrow） |
| 73 | `in` | 纳骨堂（Ossuary） |
| 74 | `in` | 地下（Underground） |
| 75 | `e` | 地下（Underground） |
| 76 | `take walkie-talkie` | 地下（Underground） |
| 77 | `e` | 地下（Underground） |
| 78 | `take lantern` | 地下（Underground） |
| 79 | `turn lantern` | 地下（Underground） |
| 80 | `w` | 地下（Underground） |
| 81 | `drop lantern` | 地下（Underground） |
| 82 | `drop splinter` | 地下（Underground） |
| 83 | `w` | 地下（Underground） |
| 84 | `e` | 地下（Underground） |
| 85 | `take lantern` | 地下（Underground） |
| 86 | `w` | 地下（Underground） |
| 87 | `w` | 纳骨堂（Ossuary） |

**检查点：** 结束应回到纳骨堂（Ossuary），22分。持有对讲机和点亮的灯笼。

## 5. Orbit：日晷设为水星，准备肥皂泡后进入

步骤 **88–121**。

第一次在瀑布输入 `in` 应提示需要肥皂泡。按表去取斧头和泡泡，再回来进门；途中空间翻转是当前路线的一部分，继续跟表即可。太空中 `u`、`d` 后，用斧头戳破泡泡返回，最后放下斧头。

| 步骤 | 指令 | 执行后位置／关键提示 |
|---:|---|---|
| 88 | `out` | 古墓（Barrow） |
| 89 | `s` | 墓地（Cemetery） |
| 90 | `s` | 小屋（Cottage） |
| 91 | `w` | 断崖（Bluff） |
| 92 | `se` | 陨石坑边缘（Crater's Edge） |
| 93 | `sw` | 弯道（The Bend） |
| 94 | `w` | 楼梯底部（Bottom of Stairs） |
| 95 | `u` | 日晷顶点（Vertex） |
| 96 | `turn ring` | 日晷顶点（Vertex）；当前日晷：水星 |
| 97 | `d` | 楼梯底部（Bottom of Stairs） |
| 98 | `sw` | 林中空地（Forest Clearing） |
| 99 | `nw` | 瀑布（Waterfall） |
| 100 | `in` | 瀑布（Waterfall）；**预期阻挡：需要肥皂泡；继续下一行** |
| 101 | `e` | 南沼泽（South Bog） |
| 102 | `se` | 棚架（Trellises） |
| 103 | `u` | 藤架顶部（Top of Arbor） |
| 104 | `take axe` | 藤架顶部（Top of Arbor） |
| 105 | `n` | 北侧藤架（North Arbor） |
| 106 | `s` | 藤架顶部（Top of Arbor） |
| 107 | `d` | 棚架（Trellises） |
| 108 | `ne` | 弯道（The Bend） |
| 109 | `ne` | 陨石坑边缘（Crater's Edge） |
| 110 | `nw` | 断崖（Bluff） |
| 111 | `e` | 小屋（Cottage） |
| 112 | `take soap bubble` | 小屋（Cottage） |
| 113 | `w` | 断崖（Bluff） |
| 114 | `sw` | 深渊边缘（Chasm's Brink） |
| 115 | `sw` | 南沼泽（South Bog） |
| 116 | `w` | 瀑布（Waterfall） |
| 117 | `in` | 地球轨道·卫星上（Earth Orbit! on a satellite） |
| 118 | `u` | 地球轨道（Earth Orbit） |
| 119 | `d` | 地球轨道·卫星上（Earth Orbit! on a satellite） |
| 120 | `break bubble with axe` | 瀑布（Waterfall） |
| 121 | `drop axe` | 瀑布（Waterfall） |

**检查点：** 结束应在瀑布（Waterfall），22分。肥皂泡已经破掉，斧头按表放下。

## 6. Pacific：日晷设为海王星，及时按按钮

步骤 **122–143**。

**到脚手架底部后，`open box` → `push switch` → `push button` 连续执行。** 开关启动倒计时，按按钮前不要探索海滩。按钮成功后再按表游览四处海滩、拿起并放下椰子。

| 步骤 | 指令 | 执行后位置／关键提示 |
|---:|---|---|
| 122 | `ne` | 北沼泽（North Bog） |
| 123 | `se` | 楼梯底部（Bottom of Stairs） |
| 124 | `u` | 日晷顶点（Vertex） |
| 125 | `turn ring` | 日晷顶点（Vertex）；当前日晷：海王星 |
| 126 | `d` | 楼梯底部（Bottom of Stairs） |
| 127 | `ne` | 悬崖下（Under Cliff） |
| 128 | `w` | 深渊边缘（Chasm's Brink） |
| 129 | `in` | 台地（Mesa） |
| 130 | `s` | 脚手架（Scaffold） |
| 131 | `d` | 脚手架底部（Bottom of Scaffold） |
| 132 | `open box` | 脚手架底部（Bottom of Scaffold） |
| 133 | `push switch` | 脚手架底部（Bottom of Scaffold）；开始倒计时；下一条立即按按钮 |
| 134 | `push button` | 脚手架底部（Bottom of Scaffold）；及时发出信号，取消倒计时 |
| 135 | `s` | 南海滩（South Beach） |
| 136 | `w` | 西海滩（West Beach） |
| 137 | `n` | 北海滩（North Beach） |
| 138 | `e` | 东海滩（East Beach） |
| 139 | `take coconut` | 东海滩（East Beach） |
| 140 | `drop coconut` | 东海滩（East Beach） |
| 141 | `w` | 脚手架（Scaffold） |
| 142 | `u` | 台地（Mesa） |
| 143 | `out` | 深渊边缘（Chasm's Brink） |

**检查点：** 结束应回到深渊边缘（Chasm's Brink），22分。按钮已及时按下，倒计时取消。

## 7. Tundra：日晷设为天秤座，捕获活旅鼠

步骤 **144–166**。

**从检查裂缝开始，连续执行：** `look in fissure` → `open cage` → `take lemming` → `put lemming in cage` → `close cage`。

拿旅鼠后、装笼后都不要插入 `look`、`examine`、`wait` 等额外有效动作，否则它可能逃跑。离开冻原时笼子必须关着，里面必须是活旅鼠。到本段结束可导出一份存档，方便单独复测牧场。

| 步骤 | 指令 | 执行后位置／关键提示 |
|---:|---|---|
| 144 | `e` | 悬崖下（Under Cliff） |
| 145 | `sw` | 楼梯底部（Bottom of Stairs） |
| 146 | `u` | 日晷顶点（Vertex） |
| 147 | `turn ring` | 日晷顶点（Vertex）；当前日晷：天秤座 |
| 148 | `d` | 楼梯底部（Bottom of Stairs） |
| 149 | `ne` | 悬崖下（Under Cliff） |
| 150 | `e` | 陨石坑边缘（Crater's Edge） |
| 151 | `nw` | 断崖（Bluff） |
| 152 | `e` | 小屋（Cottage） |
| 153 | `e` | 药草园（Herb Garden） |
| 154 | `in` | 冻原（Tundra） |
| 155 | `ne` | 平台下方（Under Platform） |
| 156 | `u` | 平台（Platform） |
| 157 | `n` | 悬崖边（Cliff Edge） |
| 158 | `look in fissure` | 悬崖边（Cliff Edge） |
| 159 | `open cage` | 悬崖边（Cliff Edge） |
| 160 | `take lemming` | 悬崖边（Cliff Edge）；拿到旅鼠；下一条立即装笼 |
| 161 | `put lemming in cage` | 悬崖边（Cliff Edge）；旅鼠装笼；下一条立即关笼 |
| 162 | `close cage` | 悬崖边（Cliff Edge）；关笼保住活旅鼠 |
| 163 | `s` | 平台（Platform） |
| 164 | `d` | 平台下方（Under Platform） |
| 165 | `sw` | 冻原（Tundra） |
| 166 | `out` | 药草园（Herb Garden） |

**检查点：** 结束应在药草园（Herb Garden），23分。活旅鼠在关闭的鸟笼中。

## 8. Islet、Desert 与 Ranch：白门和牧场蛇谜题

步骤 **167–200**。

小岛按表走白门，不走银币渡船路线。经沙漠进入牧场后，去西北房间。

**从西北房间开始，连续执行：** `e` → `n` → `close door` → `open cage` → `open door`。先进入壁橱关门，再放旅鼠，最后开门让它去引走蛇。中间不要停留查询；被咬后下一有效回合会死亡。

成功后应看到蛇吞旅鼠并离开，旅鼠不会变成溺尸。此后按表退出牧场，回到棚屋后。**本路线不去风车、水库或水下：带着活旅鼠入水会破坏后面的蛇解法。**

| 步骤 | 指令 | 执行后位置／关键提示 |
|---:|---|---|
| 167 | `w` | 小屋（Cottage） |
| 168 | `w` | 断崖（Bluff） |
| 169 | `se` | 陨石坑边缘（Crater's Edge） |
| 170 | `sw` | 弯道（The Bend） |
| 171 | `w` | 楼梯底部（Bottom of Stairs） |
| 172 | `u` | 日晷顶点（Vertex） |
| 173 | `turn ring` | 日晷顶点（Vertex）；当前日晷：阿尔法 |
| 174 | `d` | 楼梯底部（Bottom of Stairs） |
| 175 | `se` | 河流（The River） |
| 176 | `in` | 小岛（Islet） |
| 177 | `n` | 沙洲（Sand Bar） |
| 178 | `enter door` | 浅坑（Shallow Crater） |
| 179 | `w` | 沙漠（Desert） |
| 180 | `w` | 沙漠（Desert） |
| 181 | `s` | 山麓（Foothills） |
| 182 | `n` | 山麓（Foothills） |
| 183 | `w` | 铺设道路（Paved Road） |
| 184 | `s` | 铺设道路（Paved Road） |
| 185 | `nw` | 棚屋后（Behind the Shed） |
| 186 | `s` | 牧场西北（Northwest of Ranch） |
| 187 | `se` | 后院（Back Yard） |
| 188 | `e` | 备用房间（Spare Room） |
| 189 | `s` | 西北房间（Northwest Room） |
| 190 | `e` | 组装室（Assembly Room） |
| 191 | `n` | 壁橱（Closet） |
| 192 | `close door` | 壁橱（Closet） |
| 193 | `open cage` | 壁橱（Closet） |
| 194 | `open door` | 壁橱（Closet）；蛇吞掉旅鼠并离开，累计26分 |
| 195 | `s` | 组装室（Assembly Room） |
| 196 | `w` | 西北房间（Northwest Room） |
| 197 | `n` | 备用房间（Spare Room） |
| 198 | `w` | 后院（Back Yard） |
| 199 | `nw` | 牧场西北（Northwest of Ranch） |
| 200 | `n` | 棚屋后（Behind the Shed） |

**检查点：** 结束应在棚屋后（Behind Shed），26分。蛇已经离开，旅鼠被吃掉，角色仍存活。

## 9. Desert：让吉普车离开，再下塔触发结局

步骤 **201–217**。

第一趟到塔台输入 `d` 是故意验证“不能安全下塔”。之后找到吉普车并 `turn dial`，再返回塔台下去。到塔底取红宝石，随后按表拉闸、剪红线。最后两步前可以导出检查点，但不要改成别的颜色。

| 步骤 | 指令 | 执行后位置／关键提示 |
|---:|---|---|
| 201 | `e` | 十字路口（Crossroads） |
| 202 | `in` | 小屋（Shack） |
| 203 | `w` | 塔台（Tower Platform） |
| 204 | `d` | 塔台（Tower Platform）；**预期阻挡：吉普车未离开，不能安全下塔** |
| 205 | `e` | 小屋（Shack） |
| 206 | `out` | 十字路口（Crossroads） |
| 207 | `n` | 塔南（South of Tower） |
| 208 | `in` | 吉普车内（Jeep） |
| 209 | `turn dial` | 塔南（South of Tower）；吉普车离开，可以重新下塔 |
| 210 | `n` | 塔底（Base of Tower） |
| 211 | `u` | 塔台平台（Tower Landing） |
| 212 | `u` | 塔台（Tower Platform） |
| 213 | `d` | 塔台平台（Tower Landing） |
| 214 | `d` | 塔底（Base of Tower） |
| 215 | `take ruby` | 塔底（Base of Tower） |
| 216 | `pull breaker` | 塔底（Base of Tower） |
| 217 | `cut wire with red` | 宫殿门（Palace Gate）；时间循环结局；回到宫殿门，27/100分 |

**检查点：** 结束应回到宫殿门（Palace Gate），出现时间循环闭合的结局说明，最终27/100分。若没有额外输入，全程217回合。

## 单独测试语义识别

请先在上述路线的适当检查点导出存档，再另做这一轮，不把它计入217输入主线。

| 场景 | 自然表达例子 | 应检查什么 |
|---|---|---|
| 圆池塘，纸鸟尚未拿走 | `把水面上那只折出来的小鸟捞起来` | 模型提出“拿纸鸟”；选择前不执行，确认后才拿取 |
| 兰开斯特门，老妇人剧情尚未结束 | `帮她撑伞` | 只能提出当前已实现的老妇人帮助动作，不应生成新剧情 |
| 兰开斯特小路，自己持有雨伞 | `撑开伞` | 提出“撑伞”；选中后仍由风向、是否坐在婴儿车中决定结果 |
| 任一候选窗口 | 点“都不是，重新输入” | 不执行候选、不推进剧情 |
| 同一场景重复自然表达 | 取消后再输入相同表达 | 已就绪模型应复用，不应反复下载权重 |

这些是语义专项检查，不承诺在任意房间都有同样候选。正常主线表格中的命令可直接解析，不依赖模型。若显示组件加载失败，先刷新续玩；不要靠重复输入推进剧情。

## 对不上时怎么记录

记录“第几步＋当前房间＋输入＋实际返回”，并保留存档。最值得截取的点是：序章撑伞前、地下取灯后、冻原装笼后、壁橱开门前、最终剪线前。

不要仅用“没有得到27分”判断所有谜题失败：本指南没有涵盖全部得分。若从任意中途存档接入、额外查询或探索过，房间路线与回合数也可能变化；先核对阶段条件。

---

核验依据：当前分支的 `tests/walkthrough.test.mjs` 正常新游戏流程。217条实际输入重新录制；本文件逐行指令与录制结果一致。又从本文件提取全部指令，在独立浏览器全新开局逐条执行至结局：217回合、74间、27分，无页面异常。指南与临时验证不接触玩家正在使用的存档，也不向游戏界面添加帮助或攻略。
