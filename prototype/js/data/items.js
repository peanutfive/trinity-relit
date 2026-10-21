// ═══════════════════════════════════════════════════
//  Trinity 全部物品定义
// ═══════════════════════════════════════════════════

export const ITEMS = {

  // ── 序章：肯辛顿花园 ──
  coin: {
    en: "seven-sided coin", size: 0, mass: 0,
    cn: "七边硬币", aliases: ["coin","seven-sided coin","50p","硬币","钱币","五十便士"],
    desc: "A seven-sided coin — a British 50 pence piece.\n\n一枚七边形硬币——英国五十便士。",
    start: "pocket",
  },
  credit_card: {
    en: "credit card", size: 0, mass: 0,
    cn: "信用卡", aliases: ["credit card","card","信用卡","卡"],
    desc: "Your American Express card.\n\n你的美国运通信用卡。",
    start: "pocket",
  },
  watch: {
    en: "wristwatch", size: 1, mass: 1,
    cn: "手表", aliases: ["watch","wristwatch","手表","表"],
    desc(s) {
      const t = Math.floor(30 + (s.turns || 0) * 0.5);
      const min = t % 60;
      const hr = 3;
      return `Your wristwatch says it's ${hr}:${String(min).padStart(2,"0")} pm.\n\n你的手表显示现在是下午${hr}:${String(min).padStart(2,"0")}。`;
    },
    start: "worn", fixed: false,
  },
  ball: {
    en: "soccer ball", size: 7, mass: 5,
    cn: "足球", aliases: ["ball","soccer ball","足球","球"],
    desc: "You see nothing unusual about the soccer ball.\n\n你没看出这个足球有什么不寻常的。",
    start: "flower_walk",
    roomDesc: "You can see a soccer ball half-hidden among the blossoms.\n\n你可以看到一个足球半隐在花丛中。",
  },
  umbrella: {
    en: "umbrella", size: 10, mass: 7,
    cn: "雨伞", aliases: ["umbrella","伞","雨伞"],
    desc: 'The closed umbrella\'s handle is carved in the shape of a parrot\'s head.\n\n合拢的雨伞手柄雕成了鹦鹉头的形状。',
    start: "lancaster_gate_tree",
  },
  gnomon: {
    en: "gnomon", size: 4, mass: 4,
    cn: "日晷指针", aliases: ["gnomon","指针","日晷指针"],
    desc: "It's a triangular piece of metal, about a quarter-inch thick and four inches long.\n\n一块三角形的金属片，大约四分之一英寸厚、四英寸长。",
    start: "the_wabe",
  },
  bag: {
    en: "bag of crumbs", size: 3, mass: 2, capacity: 0, container: true, open: true,
    cn: "面包屑袋", aliases: ["bag","crumbs","bag of crumbs","sack","bread","面包屑","面包袋","袋子","袋"],
    desc: "It looks as if the bag of crumbs is open.\n\n面包屑袋看起来开着。",
    roomDesc: "bag of crumbs\n\n面包屑袋",
    start: null,
  },
  empty_bag: {
    en: "paper bag", size: 3, mass: 1, capacity: 3, container: true, open: true,
    cn: "空纸袋", aliases: ["paper bag","empty bag","bag","sack","纸袋","空袋","空纸袋","袋子","袋"],
    desc: "It looks as if the paper bag is open.\n\n纸袋看起来开着。",
    roomDesc: "paper bag\n\n空纸袋",
    start: null,
  },
  soggy_bag: {
    en: "soggy bag", size: 3, mass: 1, capacity: 3, container: true, open: true,
    cn: "湿纸袋", aliases: ["soggy bag","wet bag","bag","sack","crumbs","bread","湿纸袋","湿袋","纸袋","袋子","袋"],
    desc: "It looks as if the soggy bag is open.\n\n湿纸袋看起来开着。",
    roomDesc: "soggy bag\n\n湿纸袋",
    start: null,
  },
  small_coin: {
    en: "small coin", size: 0, mass: 0,
    cn: "小硬币", aliases: ["small coin","change","找零","小硬币","二十便士"],
    desc: "A small coin — twenty pence change.\n\n一枚小硬币——二十便士的找零。",
    start: null,
  },
  paper_bird: {
    en(s) { return s.hasFlag("bird_unfolded") ? "piece of paper" : "paper bird"; },
    size(s) { return s.hasFlag("bird_unfolded") ? 3 : 7; }, mass: 1,
    cn: "纸鸟", aliases: ["paper bird","paper","bird","纸鸟","折纸鸟","纸鹤","折纸","纸"],
    desc(s) { return s.hasFlag("bird_unfolded") ? 'The words "Long Water, Four O\'Clock" are scrawled on the piece of paper.\n\n纸上潦草地写着"Long Water, Four O\'Clock"（长水湖，四点钟）。' : "A folded paper bird.\n\n一只折纸鸟。"; },
    start: "round_pond",
    roomDesc: "",
  },
  ruby: {
    en: "ruby", size: 0, mass: 1,
    cn: "红宝石", aliases: ["ruby","红宝石","宝石","gem"],
    desc(s) { return s.hasFlag("roadrunner_tower_met") ? "Its finely cut edges sparkle with crimson fire.\n\n它精细切割的棱面闪烁着绯红的火光。" : "The ruby is bigger than a walnut, with finely cut facets that sparkle with crimson fire.\n\n这颗红宝石比核桃还大，精细切割的刻面闪烁着绯红的火光。"; },
    start: null,
  },

  // ── The Wabe ──
  sundial: {
    cn: "日晷",
    aliases: ["sundial", "dial", "日晷", "表盘"],
    desc: "The perimeter of the sundial is inscribed with seven curious symbols and a compass rose.\n\n日晷周边刻着七个奇特的符号和罗盘玫瑰。",
    start: "vertex",
    fixed: true,
    fixedMsg: "The sundial is too heavy to move.\n\n日晷太重，无法移动。",
  },
  ring: {
    cn: "符号环",
    aliases: ["ring", "symbol ring", "symbols", "符号环", "环"],
    desc: "A ring of seven astronomical symbols. You can turn it to point to different symbols.\n\n七个天文符号的环。你可以转动它指向不同符号。",
    start: "vertex",
    fixed: true,
    fixedMsg: "The ring is part of the sundial.\n\n符号环是日晷的一部分。",
  },
  soap_bubble: {
    cn: "肥皂泡",
    aliases: ["soap bubble", "bubble", "肥皂泡", "泡"],
    desc: "A fragile soap bubble, glistening in the light. It might protect you in harsh conditions.\n\n一个脆弱的肥皂泡，在光线下闪烁。它也许能在恶劣环境中保护你。",
    start: "cottage",
  },
  splinter: {
    en: "splinter", size: 5, mass: 3,
    cn: "木片", aliases: ["splinter","木片","碎片"],
    desc: "Its edges flicker with the eerie phosphorescence of decay.\n\n它的边缘闪烁着腐朽的诡异磷光。",
    start: "south_bog",
  },
  axe: {
    en: "axe", size: 7, mass: 7,
    cn: "斧头", aliases: ["axe","ax","斧头","斧"],
    desc: "A small but sharp-looking axe.\n\n一把小巧但锋利的斧头。",
    start: "top_of_arbor",
  },
  icicle: {
    cn: "冰锥", aliases: ["icicle","冰锥","冰柱","冰"],
    desc(s) { return s.hasFlag("icicle_hard") ? "A hard icicle, keeping its shape in the cold.\n\n一根坚硬的冰锥，在寒冷中保持着形状。" : "An icicle that is slowly melting. You'd better use it quickly.\n\n一根正在慢慢融化的冰锥。你得赶快用它。"; },
    start: null,
  },
  lump: {
    cn: "金属块", aliases: ["lump","metal","lump of metal","金属块","磁铁","块"],
    desc: "You feel a strong magnetic attraction.\n\n你感到强烈的磁力吸引。",
    start: "crater",
    fixed: true,
    fixedMsg: "The lump of metal is far too heavy and hot to carry.\n\n金属块太重太烫，无法搬运。",
  },
  garlic: {
    cn: "大蒜", aliases: ["garlic","大蒜","蒜"],
    desc: "A clove of fresh garlic with a pungent smell.\n\n一瓣新鲜的大蒜，散发着辛辣的气味。",
    start: "herb_garden",
  },
  thyme: {
    cn: "百里香", aliases: ["thyme","百里香","香草"],
    desc: "Better not. There isn't much thyme left.\n\n还是别了。百里香/时间所剩不多了。",
    start: "herb_garden",
    fixed: true,
    fixedMsg: "Better not. There isn't much thyme left.\n\n还是别了。百里香/时间所剩不多了。",
  },
  cage: {
    en: "birdcage", size: 10, mass: 6, capacity: 8, container: true, transparent: true,
    open(s) { return s.hasFlag("cage_open"); },
    cn: "鸟笼", aliases: ["cage","birdcage","笼子","鸟笼"],
    desc(s) { return `The ${s.hasFlag("cage_open") ? "open" : "closed"} birdcage is cunningly woven of brown and yellow wicker.\n\n${s.hasFlag("cage_open") ? "敞开" : "关闭"}的鸟笼由棕黄色柳条巧妙编成。`; },
    start: "cottage",
  },
  magpie: {
    en: "magpie", size: 0, mass: 0, animal: true, living: true,
    cn: "活喜鹊", aliases: ["live magpie", "magpie", "bird", "喜鹊", "活喜鹊", "鸟"],
    desc: "Its sharp little eyes stare back at you suspiciously.\n\n它锐利的小眼睛疑惑地回望着你。",
    start: "in:cage",
    fixed: true,
    fixedMsg: "The magpie won't let you near.\n\n喜鹊不让你靠近。",
  },
  key_barrow: {
    cn: "骸骨钥匙", aliases: ["skeleton key","key","钥匙","骸骨钥匙","骷髅钥匙"],
    desc: "A key carved from bone, cold and smooth to the touch.\n\n一把由骨头雕成的钥匙，冰冷而光滑。",
    start: "ossuary",
  },
  coconut: {
    cn: "椰子", aliases: ["coconut","椰子"],
    desc(s) { return s.hasFlag("coconut_cracked") ? "一个被劈开的椰子，还在渗出乳白色的椰奶。" : "一颗棕色的椰子，摇晃时能听到里面液体晃动的声音。"; },
    start: null,
  },
  emerald: {
    en: "emerald", size: 1, mass: 1,
    cn: "绿宝石", aliases: ["emerald","绿宝石"],
    desc: "一颗在大锅的烈焰中诞生的绿宝石，翠绿如春叶。",
    start: null,
  },
  spade: {
    en: "spade", size: 10, mass: 7,
    cn: "铲子", aliases: ["spade","铲子","铲","锹"],
    desc: "A small spade, suitable for digging.\n\n一把小铁铲，适合挖掘。",
    start: null,
  },
  shroud: {
    en: "burial shroud", size: 10, mass: 4,
    cn: "裹尸布", aliases: ["shroud","裹尸布","布"],
    desc: "一块灰白色的亚麻布，散发着古老的霉味。穿上它你看起来就像一具行走的尸体。",
    start: null,
  },
  bandage: {
    en: "bandage", size: 3, mass: 2,
    cn: "绷带", aliases: ["bandage","绷带"],
    desc: "一卷泛黄的绷带。",
    start: null,
  },
  boots: {
    cn: "靴子", aliases: ["boots","boot","靴子","靴"],
    desc(s) {
      const r = s.hasFlag("ruby_in_red_boot");
      const e = s.hasFlag("emerald_in_green_boot");
      let d = "一双神奇的靴子。左脚绿色，右脚红色。";
      if (r) d += " 红靴嵌着一颗红宝石，长出了小翅膀。";
      if (e) d += " 绿靴嵌着一颗绿宝石，长出了小翅膀。";
      if (r && e) d += " 穿上它们你可以跑得飞快。";
      return d;
    },
    start: null,
  },
  silver_coin: {
    en: "silver coin", size: 0, mass: 0,
    cn: "银币", aliases: ["silver coin","silver","银币"],
    desc: "一枚古老的银币，上面刻着你看不懂的符号。",
    start: null,
  },
  toadstool_islet: {
    cn: "毒菌", aliases: ["toadstool","mushroom","毒菌","蘑菇"],
    desc: "A lone toadstool with a white door that leads to the New Mexico desert.\n\n一株孤零零的毒菌，上面有一扇通向新墨西哥沙漠的白门。",
    start: "islet",
    fixed: true,
    fixedMsg: "The toadstool is rooted in the sand.\n\n毒菌扎根在沙地里。",
  },
  walnut: {
    cn: "核桃", aliases: ["walnut","核桃"],
    desc: "一颗核桃。",
    start: null,
  },

  // ── 日本 ──
  // (spade obtained here, umbrella & paper_bird lost)

  // ── 地下 ──
  lantern: {
    en: "lantern", size: 5, mass: 4,
    cn: "灯笼", aliases: ["lantern","灯笼","灯","提灯"],
    desc(s) { return s.hasFlag("lantern_on") ? "一盏正在发光的灯笼，照亮周围几米的范围。" : "一盏灭了的灯笼。"; },
    start: null,
  },
  walkie_talkie: {
    en: "walkie-talkie", size: 5, mass: 5, capacity: 0,
    cn: "对讲机", aliases: ["walkie-talkie","walkie","walkie talkie","talkie","radio","receiver","对讲机","无线电"],
    desc(s) {
      const wet = s.hasFlag("walkie_wet"), raised = s.hasFlag("walkie_antenna_up");
      return `The walkie-talkie${wet ? " is dripping wet. It" : ""} has a rocker switch, a numbered slider, a telescoping antenna (now ${raised ? "raised" : "lowered"}) and a large orange button.\n\n对讲机${wet ? "湿得直滴水。它" : ""}有一个翘板开关、一个带数字的滑块、一根伸缩天线（现在${raised ? "升起" : "收回"}了）和一个橙色大按钮。`;
    },
    start: null,
  },
  skink: {
    cn: "蜥蜴", aliases: ["skink","lizard","蜥蜴","石龙子"],
    desc(s) { return s.hasFlag("skink_dead") ? "一只死去的蜥蜴。" : "一只小小的石龙子蜥蜴，在你的口袋里不安地扭动。"; },
    start: null,
  },

  // ── 太平洋 ──
  // (coconut obtained here)

  // ── 俄罗斯 ──
  lemming: {
    en: "lemming", size: 4, mass: 3, animal: true, living: true,
    cn: "活旅鼠", aliases: ["live lemming", "lemming", "rodent", "animal", "旅鼠", "活旅鼠", "鼠"],
    desc: "The lemming looks something like a hamster, with long brown fur and beady eyes that glare at you defiantly.\n\n旅鼠看起来有点像仓鼠，披着棕色长毛，圆亮的小眼睛不服气地瞪着你。",
    start: null,
  },
  roadrunner: {
    en: "roadrunner", size: 5, mass: 5, animal: true, living: true,
    cn: "活走鹃", aliases: ["live roadrunner", "roadrunner", "bird", "走鹃", "活走鹃", "鸟"],
    desc: "The roadrunner resembles a gray pheasant, lean and streamlined, with bright eyes and a long tail splashed with color.\n\n走鹃像一只灰色雉鸡，身体瘦削而流畅，眼睛明亮，长尾上带着鲜艳的色彩。",
    start: null,
  },
  dead_lemming: {
    en: "dead lemming", size: 3, mass: 3, animal: true,
    cn: "死旅鼠", aliases: ["dead lemming", "drowned lemming", "lemming", "rodent", "animal", "死旅鼠", "溺死的旅鼠", "旅鼠", "鼠"],
    desc(s) { return s.animals?.deaths?.dead_lemming === "drowned" ? "It's dead. Drowned, as a matter of fact.\n\n它死了。确切地说，是淹死的。" : "It's dead.\n\n它死了。"; },
    start: null,
  },
  dead_magpie: {
    en: "dead magpie", size: 3, mass: 3, animal: true,
    cn: "死喜鹊", aliases: ["dead magpie", "drowned magpie", "magpie", "bird", "死喜鹊", "溺死的喜鹊", "喜鹊", "鸟"],
    desc(s) { return s.animals?.deaths?.dead_magpie === "drowned" ? "It's dead. Drowned, as a matter of fact.\n\n它死了。确切地说，是淹死的。" : "It's dead.\n\n它死了。"; },
    start: null,
  },
  dead_roadrunner: {
    en: "dead roadrunner", size: 5, mass: 5, animal: true,
    cn: "死走鹃", aliases: ["dead roadrunner", "drowned roadrunner", "roadrunner", "bird", "死走鹃", "溺死的走鹃", "走鹃", "鸟"],
    desc(s) { return s.animals?.deaths?.dead_roadrunner === "drowned" ? "It's dead. Drowned, as a matter of fact.\n\n它死了。确切地说，是淹死的。" : "It's dead.\n\n它死了。"; },
    start: null,
  },
  tower_box: {
    en: "box", cn: "木箱", aliases: ["wooden box", "box", "lid", "木箱", "箱子", "箱盖"],
    surface: true, fixed: true,
    desc: "The closed box is several feet in length, and secured with a steel padlock.\n\n关着的木箱有好几英尺长，用一把钢挂锁锁着。",
    start: "base_of_tower",
  },

  // ── 新墨西哥 ──
  knife: {
    en: "steak knife", size: 2, mass: 2,
    cn: "刀", aliases: ["knife","刀","刀子","牛排刀"],
    desc: "一把锋利的牛排刀。",
    start: null,
  },
  screwdriver: {
    en: "screwdriver", size: 3, mass: 3,
    cn: "螺丝刀", aliases: ["screwdriver","螺丝刀","改锥","起子"],
    desc: "一把十字螺丝刀。",
    start: null,
  },
  binoculars: {
    en: "pair of binoculars", size: 4, mass: 4,
    cn: "望远镜", aliases: ["binoculars","pair of binoculars","binocs","glasses","望远镜","双筒望远镜"],
    desc: "The binoculars are of standard Army issue, with a strap for wearing.\n\n这副双筒望远镜是军队的标准配备，带有供佩戴的背带。",
    roomDesc(s) {
      return s.itemAt("binoculars") === "windmill"
        ? "Somebody has left a nice pair of binoculars at the landing's edge.\n\n有人把一副不错的双筒望远镜留在了平台边缘。"
        : "pair of binoculars\n\n双筒望远镜";
    },
    start: "windmill",
  },
  key_padlock: {
    cn: "挂锁钥匙", aliases: ["padlock key","small key","挂锁钥匙","小钥匙"],
    desc: "一把小小的挂锁钥匙。",
    start: null,
  },
  slip: {
    cn: "纸条", aliases: ["slip","cardboard","纸条","硬纸片"],
    desc(s) { return "一张硬纸片，背面印着电线颜色的图例。"; },
    start: null,
  },
};
