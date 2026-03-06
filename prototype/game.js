import { pipeline, env } from "https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2";

env.allowLocalModels = false;

// ═══════════════════════════════════════════════════
//  Trinity 场景与事件数据
// ═══════════════════════════════════════════════════

const SCENES = {
  palace_gate: {
    name: "Palace Gate",
    name_cn: "宫门",
    description:
      "超级大国之间剑拔弩张。坦克开进了东柏林。BBC 报道卫星中断的传闻。这足以毁掉你的欧式早餐。\n\n" +
      "但世界得等一等。今天是你 599 美元伦敦旅行套餐的最后一天，你决心尽可能多地浸泡在正宗的英伦氛围中。" +
      "你丢下了旅行巴士，甩掉了相机，逃到海德公园，在肯辛顿花园里悠然漫步。\n\n" +
      "一股婴儿车的潮流沿着拥挤的 Broad Walk 向北(n)涌去。" +
      "树荫下的林间空地向东北(ne)延伸，一抹色彩标记着 Flower Walk 的西(w)侧。",
    events: [
      {
        id: "go_north",
        triggers: [
          "go north", "north", "n", "walk north",
          "往北走", "北", "向北", "去北边", "沿大道走",
        ],
        action: { type: "move", target: "broad_walk" },
        response: "你汇入了沿 Broad Walk 向北的人潮之中。",
      },
      {
        id: "go_northeast",
        triggers: [
          "go northeast", "northeast", "ne",
          "往东北走", "东北", "向东北", "去林荫小路", "走向林间",
        ],
        action: { type: "move", target: "lancaster_walk" },
        response: "你穿过人群，朝东北方向树荫下的林间空地走去。",
      },
      {
        id: "go_west",
        triggers: [
          "go west", "west", "w", "walk west",
          "往西走", "西", "向西", "去花径", "走向花径",
        ],
        action: { type: "move", target: "flower_walk" },
        response: "你朝西边 Flower Walk 的色彩走去。",
      },
      {
        id: "look",
        triggers: ["look", "look around", "l", "看", "看看", "环顾", "环顾四周", "观察周围"],
        action: { type: "redescribe" },
        response: null,
      },
      {
        id: "examine_perambulators",
        triggers: [
          "examine strollers", "look at baby carriages", "look at perambulators",
          "看婴儿车", "观察婴儿车", "查看推车",
        ],
        action: { type: "message" },
        response:
          "各式各样的婴儿车在 Broad Walk 上推来推去，形成一条缓慢移动的河流。" +
          "年轻的母亲们边推车边聊天，丝毫不在意收音机里那些令人不安的新闻。",
      },
      {
        id: "examine_self",
        triggers: [
          "examine myself", "look at myself",
          "检查自己", "看看自己",
        ],
        action: { type: "message" },
        response: "你是一个普通的美国游客，口袋里只有回程机票和几英镑零钱。今天是伦敦假期的最后一天。",
      },
      {
        id: "wait",
        triggers: ["wait", "z", "等", "等待", "等一等"],
        action: { type: "message" },
        response: "时间悄然流逝。远处的交通声和孩子们的笑声混在一起，构成了一幅典型的伦敦午后景象。",
      },
    ],
  },

  broad_walk: {
    name: "Broad Walk",
    name_cn: "大道",
    description:
      "宽阔的大道向南北延伸，两旁是修剪整齐的树篱。婴儿车和散步的人群让这条路热闹非凡。\n\n" +
      "南边(s)是你来时的 Palace Gate。大道继续向北(n)延伸。" +
      "东边(e)可以看到一片闪闪发光的水面——那是 Round Pond。\n\n" +
      "一位老太太正坐在路边的长椅上喂鸽子。",
    events: [
      {
        id: "go_south",
        triggers: ["go south", "south", "s", "往南走", "南", "向南", "回去", "回到宫门"],
        action: { type: "move", target: "palace_gate" },
        response: "你沿着 Broad Walk 往南走，回到了 Palace Gate。",
      },
      {
        id: "go_north_bw",
        triggers: ["go north", "north", "n", "continue", "往北走", "北", "继续向北", "往前走"],
        action: { type: "message" },
        response: "你沿着 Broad Walk 继续向北走了一段。前方被一群聚在一起的游客挡住了，你决定不挤过去。",
      },
      {
        id: "go_east_bw",
        triggers: [
          "go east", "east", "e", "go to pond",
          "往东走", "东", "向东", "去池塘", "走向水面",
        ],
        action: { type: "move", target: "round_pond" },
        response: "你离开大道，穿过草地走向那片闪光的水面。",
      },
      {
        id: "look_bw",
        triggers: ["look", "look around", "l", "看", "看看", "环顾四周"],
        action: { type: "redescribe" },
        response: null,
      },
      {
        id: "examine_old_lady",
        triggers: [
          "examine old lady", "look at woman", "talk to old lady",
          "看老太太", "观察老太太", "和老太太说话", "跟老太太聊天",
        ],
        action: { type: "message" },
        response:
          "那位老太太穿着一件褪色的花布外套，正从纸袋里掏出面包屑撒给鸽子。" +
          "她完全沉浸在自己的世界里，对周围的喧嚣浑然不觉。",
      },
      {
        id: "examine_pigeons",
        triggers: [
          "examine pigeons", "look at birds",
          "看鸽子", "观察鸽子", "看那些鸟",
        ],
        action: { type: "message" },
        response:
          "一群肥胖的伦敦鸽子围在老太太脚边，为面包屑争来争去。" +
          "它们灰蓝色的羽毛在阳光下泛着微微的虹彩。",
      },
      {
        id: "wait_bw",
        triggers: ["wait", "z", "等", "等待"],
        action: { type: "message" },
        response: "你在大道旁停下脚步，看着人来人往。一架飞机从头顶掠过，留下一道白色尾迹。",
      },
    ],
  },

  lancaster_walk: {
    name: "Lancaster Walk",
    name_cn: "兰开斯特小径",
    description:
      "你站在一条幽静的林间小路上。高大的榆树在头顶交织成绿色拱顶，筛下斑驳的光影。\n\n" +
      "与刚才热闹的 Broad Walk 相比，这里安静得出奇。西南(sw)可以回到 Palace Gate。" +
      "小路向北(n)深处延伸，隐约可见一座石头日晷立在林间空地上。\n\n" +
      "一把白色的遮阳伞被遗忘在一条长椅旁边。",
    events: [
      {
        id: "go_southwest_lw",
        triggers: ["go southwest", "southwest", "sw", "go back", "往西南走", "西南", "回去", "回到宫门"],
        action: { type: "move", target: "palace_gate" },
        response: "你沿着小路走回了 Palace Gate。",
      },
      {
        id: "go_north_lw",
        triggers: [
          "go north", "north", "n", "go to sundial",
          "往北走", "北", "去看日晷", "继续走", "深入小路",
        ],
        action: { type: "message" },
        response:
          "你沿着林间小路向北走去。石头日晷越来越近，上面刻着你看不懂的符号。" +
          "阳光透过树叶在日晷表面投下移动的光斑。一种奇异的感觉涌上心头——仿佛时间本身在这里放慢了脚步。",
      },
      {
        id: "look_lw",
        triggers: ["look", "look around", "l", "看", "看看", "环顾四周"],
        action: { type: "redescribe" },
        response: null,
      },
      {
        id: "take_umbrella",
        triggers: [
          "take umbrella", "get umbrella", "pick up umbrella",
          "拿伞", "拿起伞", "捡起伞", "拿白色的伞", "取伞", "捡起白伞",
        ],
        action: { type: "take_item", item: "white_umbrella" },
        response:
          "你拿起了那把白色遮阳伞。它出奇地轻，伞柄上刻着精致的花纹。握在手里有一种微微的温热感。",
      },
      {
        id: "examine_umbrella",
        triggers: [
          "examine umbrella", "look at umbrella",
          "检查伞", "仔细看伞", "观察伞", "看那把伞", "看白伞",
        ],
        action: { type: "message" },
        response:
          "一把优雅的白色遮阳伞，静静地靠在长椅旁。伞面是半透明的白色丝绸，" +
          "伞柄末端嵌着一颗似乎会发光的小珠子。它看上去不像属于这个时代的东西。",
      },
      {
        id: "examine_sundial",
        triggers: [
          "examine sundial", "look at sundial",
          "检查日晷", "看日晷", "观察日晷", "仔细看日晷",
        ],
        action: { type: "message" },
        response:
          "一座古老的石头日晷，表面被岁月侵蚀得有些模糊。" +
          "上面刻着一圈奇怪的符号——既不是数字，也不是你认识的任何文字。指针的影子指向一个你无法辨认的方位。",
      },
      {
        id: "examine_trees",
        triggers: [
          "examine trees", "look at trees", "look up",
          "看树", "观察树木", "抬头看", "仰头",
        ],
        action: { type: "message" },
        response:
          "高大的英国榆树在头顶形成翠绿的隧道。树干粗壮而古老，树皮布满岁月的纹路。" +
          "一只松鼠从一根树枝跳到另一根，然后消失在树叶间。",
      },
      {
        id: "wait_lw",
        triggers: ["wait", "z", "等", "等待"],
        action: { type: "message" },
        response: "微风穿过树叶，发出轻柔的沙沙声。远处传来一声布谷鸟的叫声。时间在这里流淌得格外缓慢。",
      },
    ],
  },

  flower_walk: {
    name: "Flower Walk",
    name_cn: "花径",
    description:
      "你漫步在 Flower Walk 上。两旁花坛里盛开着各色花朵——红玫瑰、紫薰衣草、金水仙，还有你叫不出名的奇异植物。\n\n" +
      "空气中弥漫着甜蜜花香。东边(e)可以回到 Palace Gate。\n\n" +
      "一只蝴蝶在花丛中翩翩起舞。花坛尽头有一扇小小的白色铁门(n)，半掩着，门后似乎是另一个花园。",
    events: [
      {
        id: "go_east_fw",
        triggers: ["go east", "east", "e", "go back", "往东走", "东", "回去", "回到宫门"],
        action: { type: "move", target: "palace_gate" },
        response: "你离开花径，回到了 Palace Gate。",
      },
      {
        id: "go_through_gate",
        triggers: [
          "go north", "north", "n", "go through gate", "open gate", "enter gate",
          "往北走", "北", "进门", "开门", "穿过门", "打开铁门", "过去",
        ],
        action: {
          type: "check_item",
          item: "white_umbrella",
          success_scene: "secret_garden",
          success_response:
            "你推开那扇白色铁门。当你踏过门槛的那一瞬间，手中的白色遮阳伞突然发出柔和的光芒——\n\n然后，一切都变了。",
          fail_response:
            "你推了推那扇白色铁门，但它纹丝不动。门上有一行几乎看不见的小字：\n\n「唯持光者可入。」\n\n也许你需要找到什么特别的东西。",
        },
      },
      {
        id: "look_fw",
        triggers: ["look", "look around", "l", "看", "看看", "环顾四周"],
        action: { type: "redescribe" },
        response: null,
      },
      {
        id: "examine_flowers",
        triggers: [
          "examine flowers", "look at flowers", "smell flowers",
          "看花", "观察花", "闻花", "赏花",
        ],
        action: { type: "message" },
        response:
          "花坛里的花种类繁多。你凑近一朵深红玫瑰——花瓣上还挂着露珠。" +
          "奇怪的是，有些花你从未在任何图鉴上见过：一种螺旋形的蓝色花朵在微风中缓缓旋转，像一个小小的银河。",
      },
      {
        id: "examine_butterfly",
        triggers: [
          "examine butterfly", "look at butterfly",
          "看蝴蝶", "观察蝴蝶", "抓蝴蝶",
        ],
        action: { type: "message" },
        response:
          "那只蝴蝶翅膀的颜色你从未见过——在阳光下不断变幻，" +
          "一会儿像碎虹，一会儿又像液态金属。它对你的注视毫不在意，优雅地从一朵花飞向另一朵。",
      },
      {
        id: "examine_gate",
        triggers: [
          "examine gate", "look at gate", "look at door",
          "看门", "查看门", "观察铁门", "检查白色铁门", "仔细看那扇门",
        ],
        action: { type: "message" },
        response:
          "一扇精致的白色铸铁小门，不过一米多高，嵌在花坛尽头的矮墙里。" +
          "门上缠绕着铁艺藤蔓和花朵图案。门缝里透出一缕奇异的光——不是阳光，而是一种更柔和、更古老的光。",
      },
      {
        id: "wait_fw",
        triggers: ["wait", "z", "等", "等待"],
        action: { type: "message" },
        response: "你在花丛间驻足。花香让你一瞬恍惚，仿佛这座花园并不完全属于伦敦，不完全属于 1986 年。",
      },
    ],
  },

  round_pond: {
    name: "Round Pond",
    name_cn: "圆池塘",
    description:
      "你来到了 Round Pond 边。这座椭圆形的池塘静静地躺在花园中心，水面如镜，倒映着天空中缓缓移动的云。\n\n" +
      "几个小男孩在池塘边放遥控帆船。一位穿着考究的绅士独自坐在对岸读《泰晤士报》。\n\n" +
      "西边(w)可以回到 Broad Walk。",
    events: [
      {
        id: "go_west_rp",
        triggers: ["go west", "west", "w", "go back", "往西走", "西", "回去", "回到大道"],
        action: { type: "move", target: "broad_walk" },
        response: "你离开池塘边，走回了 Broad Walk。",
      },
      {
        id: "look_rp",
        triggers: ["look", "look around", "l", "看", "看看", "环顾四周"],
        action: { type: "redescribe" },
        response: null,
      },
      {
        id: "examine_pond",
        triggers: [
          "examine pond", "look at water", "look at pond",
          "看池塘", "观察水面", "看水",
        ],
        action: { type: "message" },
        response:
          "池水清澈得出奇。你隐约看到水底的石子和几条锦鲤悠闲的身影。" +
          "水面偶尔漾起涟漪——不是风吹的，像是什么东西从水下触碰了水面。",
      },
      {
        id: "examine_boys",
        triggers: [
          "examine boys", "look at children",
          "看男孩", "观察小孩", "看那些孩子",
        ],
        action: { type: "message" },
        response:
          "三个男孩正专注地操控遥控帆船。最小那个男孩的帆船是鲜红色的，在一群白帆中格外醒目。" +
          "他每次按下遥控器都会兴奋地跳脚。",
      },
      {
        id: "examine_gentleman",
        triggers: [
          "examine gentleman", "look at man", "talk to man",
          "看绅士", "观察那个人", "和他说话", "看读报的人",
        ],
        action: { type: "message" },
        response:
          "那位绅士穿着灰色三件套西装，戴着礼帽。他的《泰晤士报》头版写着关于苏联的大字标题。" +
          "他偶尔放下报纸，忧虑地望向天空，然后又继续阅读。",
      },
      {
        id: "wait_rp",
        triggers: ["wait", "z", "等", "等待"],
        action: { type: "message" },
        response:
          "池塘上的帆船随风摇摆。天空中一架飞机的轰鸣声渐渐远去。绅士翻了一页报纸。" +
          "一切看起来如此平静，但空气中隐隐有一种不安的气息。",
      },
    ],
  },

  secret_garden: {
    name: "???",
    name_cn: "???",
    description:
      "光芒消散后，你发现自己站在一个完全不同的地方。\n\n" +
      "这是一座不可能存在的花园。巨大的蘑菇如树木般高耸，菌盖下投下斑斓的阴影。" +
      "天空是你从未见过的颜色——不是蓝色，也不是紫色，而是某种介于两者之间、在你的语言中没有名字的颜色。\n\n" +
      "空气中飘浮着发光的孢子。远处传来低沉的、有节奏的嗡鸣，像是大地本身的心跳。" +
      "你手中的白色遮阳伞温热地发着微光，似乎在告诉你：你来对了地方。\n\n" +
      "一条小路(n)蜿蜒向北。南边(s)有一扇门——你来时的门。",
    events: [
      {
        id: "go_south_sg",
        triggers: ["go south", "south", "s", "go back", "往南走", "南", "回去", "穿过门"],
        action: { type: "message" },
        response: "你转身想回到花径，但身后的门已经消失了。那里只有一面长满苔藓的古老石墙。看来，你暂时回不去了。",
      },
      {
        id: "go_north_sg",
        triggers: ["go north", "north", "n", "follow path", "往北走", "北", "沿小路走", "继续", "向前"],
        action: { type: "message" },
        response:
          "你沿着小路向北走去。巨大的蘑菇在两侧如卫兵般矗立。每走一步，空气中发光的孢子就像受惊的萤火虫四散飞开，" +
          "然后又缓缓聚拢。远处的嗡鸣声越来越清晰了……\n\n" +
          "—— 本原型演示到此结束。感谢体验！——",
      },
      {
        id: "look_sg",
        triggers: ["look", "look around", "l", "看", "看看", "环顾四周"],
        action: { type: "redescribe" },
        response: null,
      },
      {
        id: "examine_mushrooms",
        triggers: [
          "examine mushrooms", "look at mushrooms",
          "看蘑菇", "观察蘑菇", "检查蘑菇",
        ],
        action: { type: "message" },
        response:
          "这些蘑菇有三四米高，菌盖像巨伞。表面有珍珠般的光泽，颜色在白色和淡紫色之间缓缓变化。" +
          "你伸手触碰了最近的菌柄——它是温暖的，而且你发誓感到了一下脉搏。",
      },
      {
        id: "examine_umbrella_sg",
        triggers: [
          "examine umbrella", "look at umbrella",
          "看伞", "检查伞", "观察伞",
        ],
        action: { type: "message" },
        response:
          "白色遮阳伞现在发出柔和的珍珠色光芒。伞柄末端那颗珠子的光更亮了，像一颗微型星星。" +
          "你有一种感觉——这把伞不仅仅是工具，它是一把钥匙，通向某些……其他的地方。",
      },
      {
        id: "examine_sky_sg",
        triggers: [
          "examine sky", "look up", "look at sky",
          "看天空", "抬头看", "仰头",
        ],
        action: { type: "message" },
        response:
          "天空是一种让你头晕目眩的颜色。没有太阳，但光线从四面八方而来。" +
          "你看到了几颗星星——在白昼中可见的星星。它们的排列方式你从未在任何天文书上见过。",
      },
      {
        id: "wait_sg",
        triggers: ["wait", "z", "等", "等待"],
        action: { type: "message" },
        response:
          "你站在原地，让这个不可思议的世界慢慢渗入感官。远处的嗡鸣声似乎有了旋律。" +
          "一颗发光的孢子飘到你手背上，像一个温柔的吻，然后消散了。",
      },
    ],
  },
};

// ═══════════════════════════════════════════════════
//  嵌入引擎
// ═══════════════════════════════════════════════════

function cosineSimilarity(a, b) {
  let dot = 0, nA = 0, nB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    nA += a[i] * a[i];
    nB += b[i] * b[i];
  }
  return dot / (Math.sqrt(nA) * Math.sqrt(nB));
}

class EmbeddingEngine {
  constructor() {
    this.extractor = null;
    this.cache = new Map();
  }

  async init(progressCb) {
    this.extractor = await pipeline(
      "feature-extraction",
      "Xenova/multilingual-e5-small",
      { progress_callback: progressCb }
    );
  }

  async embed(text) {
    const key = `query: ${text}`;
    if (this.cache.has(key)) return this.cache.get(key);
    const out = await this.extractor(key, { pooling: "mean", normalize: true });
    const vec = Array.from(out.data);
    this.cache.set(key, vec);
    return vec;
  }

  async precompute(scenes, progressCb) {
    const allTriggers = [];
    for (const scene of Object.values(scenes)) {
      for (const ev of scene.events) {
        for (const t of ev.triggers) allTriggers.push(t);
      }
    }
    for (let i = 0; i < allTriggers.length; i++) {
      await this.embed(allTriggers[i]);
      progressCb?.(i + 1, allTriggers.length);
    }
  }

  async findMatch(input, scene) {
    const inputVec = await this.embed(input);
    let best = { event: null, score: -1, trigger: "" };
    const scores = [];

    for (const ev of scene.events) {
      let evBest = -1;
      let evTrigger = "";
      for (const t of ev.triggers) {
        const tVec = this.cache.get(`query: ${t}`);
        if (!tVec) continue;
        const s = cosineSimilarity(inputVec, tVec);
        if (s > evBest) { evBest = s; evTrigger = t; }
      }
      scores.push({ id: ev.id, score: evBest, trigger: evTrigger });
      if (evBest > best.score) {
        best = { event: ev, score: evBest, trigger: evTrigger };
      }
    }

    scores.sort((a, b) => b.score - a.score);
    return { ...best, topMatches: scores.slice(0, 5) };
  }
}

// ═══════════════════════════════════════════════════
//  游戏状态
// ═══════════════════════════════════════════════════

class GameState {
  constructor() {
    this.scene = "palace_gate";
    this.inventory = new Set();
    this.visited = new Set(["palace_gate"]);
    this.turns = 0;
  }
}

// ═══════════════════════════════════════════════════
//  UI 控制
// ═══════════════════════════════════════════════════

const $ = (sel) => document.querySelector(sel);

const ui = {
  appendHTML(html) {
    const el = document.createElement("div");
    el.innerHTML = html;
    $("#output").appendChild(el);
    $("#output").scrollTop = $("#output").scrollHeight;
  },

  location(name, nameCn) {
    this.appendHTML(`<div class="location">${name}（${nameCn}）</div>`);
  },

  text(t) {
    this.appendHTML(`<div class="scene-text">${t}</div>`);
  },

  userInput(t) {
    this.appendHTML(`<div class="user-input">${t}</div>`);
  },

  system(t) {
    this.appendHTML(`<div class="system-msg">${t}</div>`);
  },

  debug(topMatches) {
    const lines = topMatches
      .map((m) => `${m.id}: ${m.score.toFixed(3)} (← "${m.trigger}")`)
      .join("<br>");
    const visible = document.querySelector("#debug-toggle").textContent.includes("开");
    this.appendHTML(
      `<div class="debug-info ${visible ? "visible" : ""}">${lines}</div>`
    );
  },

  setLoading(status, progress) {
    const s = $("#loading-status");
    const p = $("#loading-progress");
    if (s) s.textContent = status;
    if (p && progress != null) p.style.width = `${progress}%`;
  },

  hideLoading() {
    const el = $("#loading");
    if (el) el.style.display = "none";
  },

  enableInput(handler) {
    const input = $("#input");
    input.disabled = false;
    input.focus();
    input.addEventListener("keydown", async (e) => {
      if (e.key !== "Enter") return;
      const val = input.value.trim();
      if (!val) return;
      input.value = "";
      input.disabled = true;
      await handler(val);
      input.disabled = false;
      input.focus();
    });
  },
};

// ═══════════════════════════════════════════════════
//  主游戏逻辑
// ═══════════════════════════════════════════════════

const THRESHOLD_HIGH = 0.65;
const THRESHOLD_MED = 0.45;

const engine = new EmbeddingEngine();
const state = new GameState();

function showScene() {
  const scene = SCENES[state.scene];
  ui.location(scene.name, scene.name_cn);
  ui.text(scene.description);
}

function showInventory() {
  if (state.inventory.size === 0) {
    ui.system("你两手空空，什么也没带。");
  } else {
    const items = {
      white_umbrella: "白色遮阳伞",
    };
    const list = [...state.inventory].map((i) => items[i] || i).join("、");
    ui.appendHTML(`<div class="inventory-display">背包: ${list}</div>`);
  }
}

function executeEvent(event) {
  const action = event.action;
  switch (action.type) {
    case "move":
      ui.text(event.response);
      state.scene = action.target;
      state.visited.add(action.target);
      showScene();
      break;

    case "message":
      ui.text(event.response);
      break;

    case "redescribe":
      showScene();
      break;

    case "take_item":
      if (state.inventory.has(action.item)) {
        ui.system("你已经拿着这个东西了。");
      } else {
        state.inventory.add(action.item);
        ui.appendHTML(`<div class="item-gained">+ ${event.response}</div>`);
      }
      break;

    case "check_item":
      if (state.inventory.has(action.item)) {
        ui.text(action.success_response);
        state.scene = action.success_scene;
        state.visited.add(action.success_scene);
        showScene();
      } else {
        ui.text(action.fail_response);
      }
      break;
  }
  state.turns++;
}

async function handleInput(input) {
  ui.userInput(input);

  const lower = input.toLowerCase().trim();
  if (["帮助", "help", "?", "？"].includes(lower)) {
    ui.system(
      "方向: 北/南/东/西/上/下/东北/西南… | 动作: 看、拿、检查、打开 | 系统: 背包、帮助\n" +
      "也可以输入自由的中文句子，如「我想看看那把白色的伞」。"
    );
    return;
  }
  if (["背包", "物品", "inventory", "i"].includes(lower)) {
    showInventory();
    return;
  }

  const scene = SCENES[state.scene];
  const result = await engine.findMatch(input, scene);

  ui.debug(result.topMatches);

  if (result.score >= THRESHOLD_HIGH && result.event) {
    executeEvent(result.event);
  } else if (result.score >= THRESHOLD_MED && result.event) {
    ui.system(
      `你的意思是不是「${result.trigger}」？(相似度 ${(result.score * 100).toFixed(0)}%) 试试更明确的说法。`
    );
  } else {
    ui.system("你的话似乎没有产生任何效果。试试「看」「北」「拿伞」等指令，或输入「帮助」查看更多。");
  }
}

// ═══════════════════════════════════════════════════
//  启动
// ═══════════════════════════════════════════════════

async function boot() {
  ui.setLoading("正在加载嵌入模型 (multilingual-e5-small, 首次约 130MB)…", 0);

  await engine.init((p) => {
    if (p.status === "progress" && p.progress) {
      ui.setLoading(
        `下载模型: ${p.name ?? ""}  ${Math.round(p.progress)}%`,
        p.progress
      );
    }
  });

  ui.setLoading("正在预计算事件向量…", 0);
  const total = Object.values(SCENES).reduce(
    (n, s) => n + s.events.reduce((m, e) => m + e.triggers.length, 0), 0
  );
  await engine.precompute(SCENES, (done, _total) => {
    const pct = Math.round((done / _total) * 100);
    ui.setLoading(`预计算事件向量: ${done}/${_total}`, pct);
  });

  ui.hideLoading();
  ui.system(
    "欢迎来到 Trinity (1986) 中文原型。这是一个用嵌入模型进行语义匹配的实验。\n" +
    "你可以用自由的中文输入指令。右上角可以打开调试面板查看匹配分数。\n" +
    "输入「帮助」查看指令提示。\n"
  );
  showScene();
  ui.enableInput(handleInput);
}

boot().catch((err) => {
  ui.setLoading(`启动失败: ${err.message}`, 0);
  console.error(err);
});
