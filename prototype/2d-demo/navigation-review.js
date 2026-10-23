// Manual review of painted routes against the current visual scene geometry.
// This is a production gate, separate from runtime-reference/reachability tests.
// Never mark a scene approved merely because every text-arrow hotspot is reachable.
export const NAVIGATION_REVIEW = Object.freeze({
  palace_gate:{status:'revise',issues:['NE在北路中段，与N共用直路；NE缺独立可读分岔。','素材南端有开放道路，但没有可用S出口。'],fixed:['门柱只按基座碰撞，后方东路不再被柱身轮廓截断。','北行不被NE出口抢走。']},
  broad_walk:{status:'revise',issues:['NE(246,68)在N直路上，SE(267,246)在S直路上。','E(291,198)停在雕像旁内侧，图中未画出独立通往圆池塘的完整支路。']},
  flower_walk:{status:'revise',issues:['NW(246,92)在N直路上，没有独立西北分岔。','画面南侧延伸道路，但当前运行时没有S出口。'],fixed:['来源入口内侧落点与向出口靠近判断，防止按D向右却触发W返回。']},
  the_wabe:{status:'revise',issues:['四条斜路的传送点都在画面内部，素材道路继续延伸。','南侧素材有第六条路，但运行时只有N与四个斜向出口。']},
  round_pond:{status:'revise',issues:['西北入场、左岸转弯与北岸到NE已完成键盘专项；六个入口仍须逐一完成隐藏箭头的双向验收。'],fixed:['从黑狮门返回时落在NW入口内侧，保持原方向/目标。','补北岸真实步道与左上连续带宽，NE从错误的左上曲路184,52移至右上小径425,22，保留原目标兰开斯特门。']},
  black_lion_gate:{status:'revise',issues:['SE(277,199)在通往E的横路中段，没有可区分的东南岔路。','画面北侧门路和左侧横路没有对应可用出口，需用构图明确通行边界。']},
  inverness_terrace:{status:'revise',issues:['SW(165,211)在通向S的弯路中段，缺少独立分岔。','E/SE在素材道路尚未走完时切房。'],fixed:['婴儿车移至宽露台，不封住南侧狭路。']},
  lancaster_gate:{status:'revise',issues:['W(156,183)在西侧路的中段，SW(203,212)又位于主南路上。','画面向北延伸，但当前运行时没有N出口。']},
  lancaster_walk:{status:'revise',issues:['NW(233,90)与N共用北直路，SW(213,240)与S共用南直路；四向十字路素材不足以区分六个出口。']},
  long_water:{status:'revise',issues:['S(202,247)在岸路内部；素材表现为沿岸继续走，规则动作却切入涉水，需要明确的下水接点。','可见北岸延伸目前没有可执行通行出口，不应像正常通路。']},
  wading:{status:'revise',issues:['返回岸边的W(76,245)位于浅水内部，与画面岸线缺少明确接点。','深浅水边界主要由碰撞数据表达，素材水色不足以独立说明哪些区域可走。']},
  meadow:{status:'revise',issues:['E(360,179)/W(111,176)临树林，没有清晰的东西支路；素材主要是南北贯通。','现有运行时出口另有已记录原版偏差，原规则修正仍暂缓，不能靠箭头掩盖。']},
  summit:{status:'revise',issues:['NE(388,63)在右侧绕行小径内部，尚未走到素材北端就切房；需把接点与完整道路端点统一。']},
  south_bog:{status:'revise',issues:['E(266,177)、S(292,239)、SE(331,271)依次放在同一条蜿蜒路上，素材没有画出三个分岔。'],fixed:['移开E文字标记，避免覆盖木片；只解决命中遮挡，未解决路网。']},
  north_bog:{status:'revise',issues:['SE(240,202)在通向S的同一条路中段；画面北端路却没有当前可用N出口。']},
  bottom_of_stairs:{status:'revise',issues:['SW(149,242)在通向W的同一横路上，NW(206,212)在楼梯口附近；独立支路不足。','素材东侧横路可见但当前没有对应E出口。']},
  vertex:{status:'sample',issues:['唯一D接点与下方石阶基本一致；仍需完成实体/前景与实际双向行走验收，未作发布批准。'],fixed:['铜环与固定指针按可见图案命中。']},
  forest_clearing:{status:'revise',issues:['N(246,111)与E(372,164)在空地/树边，缺少对应的清晰道路口。','NE在素材道路中段切房；南侧素材有道路，运行时没有S出口。']},
  trellises:{status:'revise',issues:['NW(232,104)在N的同一棚架走廊内部，没有独立西北分岔。','素材南侧和东侧继续延伸，但当前没有对应可用出口。']},
});
