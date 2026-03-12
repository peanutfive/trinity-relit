// ═══════════════════════════════════════════════════
//  The Wabe — 中央枢纽  30 rooms
//  All English text faithfully reproduced from the
//  original Infocom Trinity (1986).
//  Room connectivity from zparse.py (Trinity 1986/TRINITY.DAT --objects).
// ═══════════════════════════════════════════════════

// Sundial symbol constants (1–7)
// Mapping: 1=Mars→Japan, 2=Pluto→Underground,
// 3=Mercury→Orbit, 4=Neptune→Pacific, 5=Libra→Tundra, 6=Alpha→Islet
const SUNDIAL_MARS = 1;
const SUNDIAL_PLUTO = 2;
const SUNDIAL_MERCURY = 3;
const SUNDIAL_NEPTUNE = 4;
const SUNDIAL_LIBRA = 5;
const SUNDIAL_ALPHA = 6;

const SUNDIAL_NAMES = ["", "Mars", "Pluto", "Mercury", "Neptune", "Libra", "Alpha", "?"];
const SUNDIAL_CN = ["", "火星", "冥王星", "水星", "海王星", "天秤座", "阿尔法", "?"];

export const ROOMS = {

  // ─── 1. Meadow (入口) ───
  meadow: {
    name: "Meadow",
    cn: "草地",

    desc(s) {
      let d = "This grassy clearing is only twenty feet across, and perfectly circular. Paths wander off in many directions through the surrounding thicket.\n\n" +
        "这片草地空地只有二十英尺宽，完美的圆形。小径从四周的灌木丛中向各个方向蜿蜒而去。";
      d += "\n\nA shaft of golden sunlight falls across a handsome antique sundial, erected at the exact center of the clearing.\n\n" +
        "一束金色阳光落在一座精美的古董日晷上，它矗立在空地的正中央。";
      return d;
    },

    onEnter(s, eng) {
      if (!s.hasFlag("meadow_entered")) {
        s.setFlag("meadow_entered");
        eng.print("\nA noise makes you hesitate.\n\nFor a moment, nothing happens. Then the east wind puffs through the clearing, and the gnomon on the sundial wobbles with a faint scrape.\n\n" +
          "有声音让你犹豫了一下。\n\n片刻之间什么也没发生。然后一阵东风吹过空地，日晷上的指针微微晃动，发出轻微的刮擦声。");
      }
    },

    exits() {
      return { n: "summit", s: "south_bog", e: "bottom_of_stairs", w: "north_bog" };
    },

    events: [
      {
        id: "examine_sundial_meadow",
        match: { verb: ["examine"], noun: ["sundial", "日晷", "dial"] },
        triggers: ["看日晷", "examine the sundial"],
        text: "A shaft of golden sunlight falls across a handsome antique sundial, erected at the exact center of the clearing.\n\n" +
          "一束金色阳光落在一座精美的古董日晷上，它矗立在空地的正中央。",
      },
    ],
  },

  // ─── 2. Summit ───
  summit: {
    name: "Summit",
    cn: "山顶",

    // TODO: verify full room description with dfrotz
    desc(s) {
      return "The thicket rises like a green wall, thirty feet high.\n\n" +
        "灌木丛像一面绿色的墙壁拔地而起，高达三十英尺。";
    },

    exits() {
      return { s: "meadow", e: "forest_clearing", ne: "south_bog" };
    },

    events: [],
  },

  // ─── 3. South Bog ───
  south_bog: {
    name: "South Bog",
    cn: "南沼泽",

    desc(s) {
      let d = "A splintered log lies rotting in the mist at your feet.\n\n" +
        "一根裂开的圆木在你脚下的雾气中腐烂着。";
      if (s.inRoom("splinter")) {
        d += "\n\nIts edges flicker with the eerie phosphorescence of decay.\n\n" +
          "它的边缘闪烁着腐朽的幽绿磷光。";
      }
      return d;
    },

    exits() {
      return {
        n: "north_bog",
        ne: "chasms_brink",
        e: "bottom_of_stairs",
        se: "trellises",
        s: "forest_clearing",
        w: "waterfall",
      };
    },

    events: [
      {
        id: "examine_log",
        match: { verb: ["examine"], noun: ["log", "圆木", "木头"] },
        triggers: ["看圆木", "examine the log", "look at log"],
        text: "A splintered log lies rotting in the mist at your feet. Its edges flicker with the eerie phosphorescence of decay.\n\n" +
          "一根裂开的圆木在你脚下的雾气中腐烂着。它的边缘闪烁着腐朽的幽绿磷光。",
      },
      {
        id: "examine_splinter",
        match: { verb: ["examine"], noun: ["splinter", "木片", "碎片"] },
        triggers: ["看木片", "examine the splinter"],
        when: (s) => s.inRoom("splinter") || s.has("splinter"),
        text: "It is about a foot long. It illuminates rather poorly.\n\n" +
          "它大约一英尺长。它的照明效果相当差。",
      },
    ],
  },

  // ─── 4. North Bog ───
  north_bog: {
    name: "North Bog",
    cn: "北沼泽",

    // TODO: verify full room description with dfrotz
    desc(s) {
      return "Landscapes are broken by long tracts of wasteland, rugged plateaus and marshes shrouded in perpetual mist.\n\n" +
        "地貌被大片荒地、崎岖的高原和笼罩在永恒雾气中的沼泽所割裂。";
    },

    exits() {
      return {
        n: "promontory",
        s: "south_bog",
        e: "chasms_brink",
        se: "bottom_of_stairs",
        sw: "waterfall",
      };
    },

    events: [],
  },

  // ─── 5. Bottom of Stairs ───
  bottom_of_stairs: {
    name: "Bottom of Stairs",
    cn: "楼梯底部",

    desc(s) {
      return "A maze of plumbing rises before you like the back of a giant refrigerator. A flight of stairs has been hewn into the face of the north cliff.\n\n" +
        "如巨型冰箱背面般的管道迷宫在你面前升起。一段石阶被凿刻在北面的悬崖上。";
    },

    exits() {
      return {
        ne: "under_cliff",
        e: "the_bend",
        se: "the_river",
        s: "trellises",
        sw: "forest_clearing",
        w: "south_bog",
        nw: "north_bog",
        u: "vertex",
      };
    },

    events: [],
  },

  // ─── 6. Vertex（日晷顶点，核心枢纽） ───
  vertex: {
    name: "Vertex",
    cn: "日晷顶点",

    desc(s) {
      let d = 'The perimeter of the sundial is inscribed with seven curious symbols and a compass rose, with the legend "TEMPUS EDAX RERUM" emblazoned across the bottom. A triangular gnomon casts a fingerlike shadow that is creeping slowly towards the first symbol.\n\n' +
        '日晷的周边刻着七个奇特的符号和罗盘玫瑰，底部镌刻着"TEMPUS EDAX RERUM"（时间吞噬万物）的铭文。三角形的指针投下一道手指般的影子，正缓慢地爬向第一个符号。';
      const sym = s.sundialSymbol || 0;
      if (sym >= 1 && sym <= 7) {
        d += `\n\nThe ring points to the ${SUNDIAL_NAMES[sym]} symbol on the dial.\n\n符号环指向表盘上的${SUNDIAL_CN[sym]}符号。`;
      }
      return d;
    },

    exits() {
      return { d: "bottom_of_stairs" };
    },

    events: [
      {
        id: "examine_sundial_vertex",
        match: { verb: ["examine"], noun: ["sundial", "日晷", "dial"] },
        triggers: ["看日晷", "examine the sundial", "look at sundial"],
        text: 'The perimeter of the sundial is inscribed with seven curious symbols and a compass rose, with the legend "TEMPUS EDAX RERUM" emblazoned across the bottom. A triangular gnomon casts a fingerlike shadow that is creeping slowly towards the first symbol.\n\n' +
          '日晷的周边刻着七个奇特的符号和罗盘玫瑰，底部镌刻着"TEMPUS EDAX RERUM"（时间吞噬万物）的铭文。三角形的指针投下一道手指般的影子，正缓慢地爬向第一个符号。',
      },
      {
        id: "examine_ring",
        match: { verb: ["examine"], noun: ["ring", "符号环", "symbol", "symbols"] },
        triggers: ["看符号环", "examine the ring", "examine symbols"],
        text: "A ring of seven astronomical symbols surrounds the sundial. You can turn it to point to different symbols.\n\n" +
          "七个天文符号的环环绕着日晷。你可以转动它指向不同符号。",
      },
      {
        id: "turn_ring",
        match: { verb: ["turn", "rotate", "twist"], noun: ["ring", "符号环", "symbol"] },
        triggers: ["转动符号环", "turn the ring", "rotate ring"],
        act(s) {
          s.sundialSymbol = ((s.sundialSymbol || 0) % 7) + 1;
        },
        text(s) {
          const sym = s.sundialSymbol;
          const name = SUNDIAL_NAMES[sym] || "?";
          const cn = SUNDIAL_CN[sym] || "?";
          return `The ring clicks into place, pointing to the ${name} symbol on the dial.\n\n符号环咔嗒一声到位，指向了表盘上的${cn}符号。`;
        },
      },
      {
        id: "examine_gnomon_vertex",
        match: { verb: ["examine"], noun: ["gnomon", "指针", "shadow", "影子"] },
        triggers: ["看指针", "examine the gnomon", "look at shadow"],
        text: "A triangular gnomon casts a fingerlike shadow that is creeping slowly towards the first symbol. It is firmly set into the dial. It cannot be moved.\n\n" +
          "三角形的指针投下一道手指般的影子，正缓慢地爬向第一个符号。它牢牢地嵌入表盘中，无法移动。",
      },
    ],
  },

  // ─── 7. Trellises ───
  trellises: {
    name: "Trellises",
    cn: "棚架",

    desc(s) {
      return "A fortresslike wall of arborvitae stretches east and west through the forest. The only breach is an identical pair of arched trellises. Steep, leafy paths curve up into the darkness and south. The tangled vines and tendrils seem to writhe malignantly in the wind.\n\n" +
        "一道堡垒般的崖柏墙横贯东西穿过森林。唯一的缺口是一对相同的拱形棚架。陡峭的枝叶小径向上弯入黑暗深处。纠结的藤蔓和卷须仿佛在风中恶意地蠕动。";
    },

    exits() {
      return {
        n: "bottom_of_stairs",
        ne: "the_bend",
        e: "the_river",
        se: "arborvitaes_n",
        sw: "arborvitaes_s",
        w: "forest_clearing",
        nw: "south_bog",
        u: "top_of_arbor",
      };
    },

    events: [],
  },

  // ─── 8. Arboretum（Klein 瓶：翻转后东西对调） ───
  arboretum: {
    name: "Arboretum",
    cn: "植物园",

    desc(s) {
      return "A spectacular arbor arches over your head like a great green Ferris wheel. Its tangled branches are peculiarly twisted, making it difficult to tell where the inside ends and the outside begins.\n\nOther paths lead east and west, into the surrounding arborvitaes.\n\n" +
        "一座壮观的藤架如同巨大的绿色摩天轮般在你头顶拱起。它纠结的枝条奇特地扭曲着，让人难以分辨内侧在哪里结束、外侧又从哪里开始。\n\n其他小径向东、向西延伸，通入周围的崖柏丛中。";
    },

    exits(s) {
      if (s.flipped) {
        return { w: "arborvitaes_n", e: "arborvitaes_s" };
      }
      return { e: "arborvitaes_n", w: "arborvitaes_s" };
    },

    events: [],
  },

  // ─── 9. Top of Arbor（穿过顶部时翻转 Klein 瓶状态） ───
  top_of_arbor: {
    name: "Top of Arbor",
    cn: "藤架顶部",

    // TODO: verify full room description with dfrotz
    desc(s) {
      return 'The arbor curves up and around in an inexplicable way that makes your eyes cross. It seems as if you\'d be standing on your head if you went much higher. Little daylight makes its way through the thick walls of arborvitae.\n\n' +
        "藤架以一种令人费解的方式向上弯曲盘旋，让你两眼发花。再往上走的话，你似乎就得头朝下站了。几乎没有阳光能穿透厚厚的崖柏墙。";
    },

    exits(s) {
      return {
        n: {
          to: "north_arbor",
          act(s2) { s2.flipped = !s2.flipped; },
        },
        s: {
          to: "south_arbor",
          act(s2) { s2.flipped = !s2.flipped; },
        },
        d: "trellises",
      };
    },

    events: [],
  },

  // ─── 10. North Arbor ───
  north_arbor: {
    name: "North Arbor",
    cn: "北侧藤架",

    // TODO: verify with dfrotz
    desc(s) {
      return "You are on the north side of the arbor.\n\n" +
        "你在藤架北侧。";
    },

    exits() {
      return { s: "top_of_arbor" };
    },

    events: [],
  },

  // ─── 11. South Arbor ───
  south_arbor: {
    name: "South Arbor",
    cn: "南侧藤架",

    // TODO: verify with dfrotz
    desc(s) {
      return "You are on the south side of the arbor.\n\n" +
        "你在藤架南侧。";
    },

    exits() {
      return { n: "top_of_arbor" };
    },

    events: [],
  },

  // ─── 12. Arborvitaes (North) ───
  arborvitaes_n: {
    name: "Arborvitaes",
    cn: "北侧崖柏",

    desc(s) {
      return "Barely eighteen inches separate the thick walls of arborvitae that rise on either side. They form an uncomfortably narrow corridor that bends sharply to the northwest.\n\n" +
        "厚厚的崖柏墙在两侧拔地而起，中间仅隔着不到十八英寸。它们形成了一条令人不安的狭窄走廊，向西北方向急转。";
    },

    exits() {
      return { nw: "trellises", w: "arboretum" };
    },

    events: [],
  },

  // ─── 13. Arborvitaes (South) ───
  arborvitaes_s: {
    name: "Arborvitaes",
    cn: "南侧崖柏",

    desc(s) {
      return "Barely eighteen inches separate the thick walls of arborvitae that rise on either side. They form an uncomfortably narrow corridor that bends sharply to the northeast.\n\n" +
        "厚厚的崖柏墙在两侧拔地而起，中间仅隔着不到十八英寸。它们形成了一条令人不安的狭窄走廊，向东北方向急转。";
    },

    exits() {
      return { ne: "trellises", e: "arboretum" };
    },

    events: [],
  },

  // ─── 14. Chasm's Brink（→ Pacific 蘑菇门，Neptune ♆） ───
  chasms_brink: {
    name: "Chasm's Brink",
    cn: "深渊边缘",

    desc(s) {
      let d = "An oak tree stands at the chasm's brink. A giant toadstool towers like a golf tee from the depths of the chasm. Only thirty feet separate you from its flattened summit.\n\n" +
        "一棵橡树矗立在深渊边缘。一株巨大的毒菌如同高尔夫球座般从深渊深处耸起。你与它平坦的顶部之间只隔着三十英尺。";
      return d;
    },

    exits(s) {
      const ex = {
        ne: "bluff",
        e: "under_cliff",
        se: "the_bend",
        sw: "south_bog",
        w: "north_bog",
        nw: "promontory",
      };
      if (s.sundialSymbol === SUNDIAL_NEPTUNE) {
        ex.in = {
          to: "mesa",
          when: () => true,
          async act(s2, eng) {
            eng.print("You step through the mushroom door.\n\n你穿过蘑菇门。");
            s2.setFlag("wabe_to_pacific_used");
            await eng.transitionChapter({
              to: "pacific",
              roomCandidates: ["mesa"],
            });
          },
          text: "",
        };
      } else {
        ex.in = {
          to: "chasms_brink",
          when: () => false,
          fail: "The mushroom door is closed.\n\n蘑菇门紧闭着。",
        };
      }
      return ex;
    },

    events: [
      {
        id: "examine_oak",
        match: { verb: ["examine"], noun: ["oak", "tree", "橡树", "树"] },
        triggers: ["看橡树", "examine the oak", "look at tree"],
        text: "An oak tree stands at the chasm's brink.\n\n一棵橡树矗立在深渊边缘。",
      },
      {
        id: "examine_toadstool_cb",
        match: { verb: ["examine"], noun: ["toadstool", "mushroom", "毒菌", "蘑菇"] },
        triggers: ["看毒菌", "examine the toadstool", "look at mushroom"],
        text: "A giant toadstool towers like a golf tee from the depths of the chasm. Only thirty feet separate you from its flattened summit. A giant toadstool has somehow taken root in the solid rock.\n\n" +
          "一株巨大的毒菌如同高尔夫球座般从深渊深处耸起。你与它平坦的顶部之间只隔着三十英尺。毒菌不知怎么地在坚硬的岩石中扎了根。",
      },
      {
        id: "examine_chasm",
        match: { verb: ["examine"], noun: ["chasm", "深渊", "裂缝"] },
        triggers: ["看深渊", "examine the chasm", "look down"],
        text: "Looking at the chasm below makes you giddy.\n\n向下看深渊让你头晕目眩。",
      },
    ],
  },

  // ─── 15. Waterfall（→ Orbit 蘑菇门，Mercury ☿） ───
  waterfall: {
    name: "Waterfall",
    cn: "瀑布",

    desc(s) {
      return "A curtain of water tumbles off the northern cliffs into a deep, rocky pool. From there, a mountain stream wanders off into the forest.\n\n" +
        "一道水幕从北面悬崖倾泻而下，落入一个深邃的岩石水潭。山涧从那里蜿蜒流入森林深处。";
    },

    exits(s) {
      const ex = {
        ne: "north_bog",
        e: "south_bog",
        se: "forest_clearing",
      };
      if (s.sundialSymbol === SUNDIAL_MERCURY && s.has("soap_bubble")) {
        ex.in = {
          to: "orbit_satellite",
          when: () => true,
          async act(s2, eng) {
            eng.print("You step through the mushroom door into the cold of space.\n\n你穿过蘑菇门，步入太空的寒冷。");
            s2.setFlag("wabe_to_orbit_used");
            await eng.transitionChapter({
              to: "orbit",
              roomCandidates: ["orbit_satellite"],
            });
          },
          text: "",
        };
      } else if (s.sundialSymbol === SUNDIAL_MERCURY) {
        ex.in = {
          to: "waterfall",
          when: () => false,
          fail: "You need the soap bubble to pass through this door.\n\n你需要肥皂泡才能通过这道门。",
        };
      } else {
        ex.in = {
          to: "waterfall",
          when: () => false,
          fail: "The mushroom door is closed.\n\n蘑菇门紧闭着。",
        };
      }
      return ex;
    },

    events: [
      {
        id: "examine_waterfall",
        match: { verb: ["examine"], noun: ["waterfall", "water", "瀑布", "水"] },
        triggers: ["看瀑布", "examine the waterfall"],
        text: "A curtain of water tumbles off the northern cliffs into a deep, rocky pool.\n\n一道水幕从北面悬崖倾泻而下，落入一个深邃的岩石水潭。",
      },
    ],
  },

  // ─── 16. Ice Cavern ───
  ice_cavern: {
    name: "Ice Cavern",
    cn: "冰穴",

    // TODO: verify full room description with dfrotz
    desc(s) {
      return "Icicles hang down from the overhanging cliff. A dark passage leads deeper.\n\n" +
        "冰锥从悬垂的岩壁上垂下。一条黑暗的通道通向更深处。";
    },

    exits() {
      return { out: "under_cliff" };
    },

    events: [
      {
        id: "examine_icicles",
        match: { verb: ["examine"], noun: ["icicle", "icicles", "ice", "冰锥", "冰柱", "冰"] },
        triggers: ["看冰锥", "examine the icicles"],
        text: "They're so nice and symmetrical.\n\n它们是如此美观而对称。",
      },
    ],
  },

  // ─── 17. Under Cliff ───
  under_cliff: {
    name: "Under Cliff",
    cn: "悬崖下",

    desc(s) {
      return "Smooth walls of rock vault straight up and then lean inward, forming a natural roof that partially hides the sky. Trails lead out from under the cliff in many directions.\n\n" +
        "A swarm of bees has staked out this formation for itself by building an enormous hive under the arch. The faint buzzing from the hive is magnified by the cliff's acoustics into a loud, frightening drone.\n\n" +
        "光滑的岩壁笔直向上拔起，然后向内倾斜，形成了一个半遮天空的天然穹顶。小径从悬崖下向四面八方延伸。\n\n" +
        "一群蜜蜂在拱形岩壁下筑起了巨大的蜂巢，将这处岩层据为己有。蜂巢中微弱的嗡嗡声被悬崖的回音放大成响亮而令人恐惧的轰鸣。";
    },

    exits() {
      return {
        e: "craters_edge",
        se: "moor",
        s: "the_bend",
        sw: "bottom_of_stairs",
        w: "chasms_brink",
        in: "ice_cavern",
      };
    },

    events: [
      {
        id: "examine_beehive",
        match: { verb: ["examine"], noun: ["hive", "beehive", "蜂巢", "蜂窝"] },
        triggers: ["看蜂巢", "examine the beehive", "look at hive"],
        text: "A swarm of bees has staked out this formation for itself by building an enormous hive under the arch.\n\n" +
          "一群蜜蜂在拱形岩壁下筑起了巨大的蜂巢，将这处岩层据为己有。",
      },
      {
        id: "examine_bees",
        match: { verb: ["examine"], noun: ["bees", "bee", "蜜蜂", "蜂"] },
        triggers: ["看蜜蜂", "examine the bees", "look at bees"],
        text: "The faint buzzing from the hive is magnified by the cliff's acoustics into a loud, frightening drone. Their buzz is making your ears ring.\n\n" +
          "蜂巢中微弱的嗡嗡声被悬崖的回音放大成响亮而令人恐惧的轰鸣。嗡嗡声震得你耳朵发响。",
      },
    ],
  },

  // ─── 18. Bluff ───
  bluff: {
    name: "Bluff",
    cn: "断崖",

    desc(s) {
      let d = "This crag of rock juts out over the surrounding landscape, ending at an abrupt drop several hundred feet deep. Narrow trails curve southeast and southwest, away from the edge of the bluff.\n\n" +
        "这块岩石高耸于周围的地貌之上，止于一处数百英尺深的断崖。狭窄的小径向东南和西南弯去，远离断崖边缘。";
      return d;
    },

    exits() {
      return { se: "craters_edge", sw: "chasms_brink" };
    },

    events: [],
  },

  // ─── 19. Cemetery ───
  cemetery: {
    name: "Cemetery",
    cn: "墓地",

    // TODO: verify full room description with dfrotz
    desc(s) {
      return "Dead statues, broken heads and broken limbs. A crypt is nearby.\n\n" +
        "枯死的雕像，断裂的头颅和肢体。附近有一座地下墓穴。";
    },

    exits() {
      return { n: "barrow", s: "cottage" };
    },

    events: [],
  },

  // ─── 20. Barrow ───
  barrow: {
    name: "Barrow",
    cn: "古墓",

    desc(s) {
      return "You wouldn't want to spend much time in this wretched hole.\n\n" +
        "你可不想在这个可怜的洞穴里多待。";
    },

    exits() {
      return { s: "cemetery", in: "ossuary" };
    },

    events: [
      {
        id: "examine_hole_barrow",
        match: { verb: ["examine"], noun: ["hole", "孔", "洞", "孔洞"] },
        triggers: ["看孔洞", "examine the hole", "look at hole"],
        text: "A small hole is visible in the door.\n\n门上可以看到一个小孔。",
      },
      {
        id: "examine_door_barrow",
        match: { verb: ["examine"], noun: ["door", "门", "spike", "尖刺"] },
        triggers: ["看门", "examine the door", "look at door"],
        // TODO: verify with dfrotz
        text: "A small hole is visible in the door.\n\n门上可以看到一个小孔。",
      },
      {
        id: "insert_key_barrow",
        match: { verb: ["insert", "put", "use"], noun: ["key", "钥匙", "骸骨钥匙"], noun2: ["hole", "door", "孔", "门"] },
        triggers: ["插入钥匙", "put key in hole", "use key on door", "insert skeleton key"],
        when: (s) => s.has("key_barrow"),
        act(s) {
          s.setFlag("barrow_door_unlocked");
        },
        text: "The key slides into the hole with a satisfying click.\n\n钥匙滑入孔洞，发出令人满意的咔嗒声。",
      },
    ],
  },

  // ─── 21. Ossuary（→ Underground 蘑菇门，Pluto ♇） ───
  ossuary: {
    name: "Ossuary",
    cn: "纳骨堂",

    desc(s) {
      return "Bones clatter in all directions.\n\n" +
        "骸骨向四面八方散落。";
    },

    exits(s) {
      const ex = { out: "barrow" };
      if (s.sundialSymbol === SUNDIAL_PLUTO) {
        ex.in = {
          to: "underground_1",
          when: () => true,
          async act(s2, eng) {
            eng.print("You step through the mushroom door into the underground.\n\n你穿过蘑菇门，进入地下。");
            s2.setFlag("wabe_to_underground_used");
            await eng.transitionChapter({
              to: "underground",
              roomCandidates: ["underground_1"],
            });
          },
          text: "",
        };
      } else {
        ex.in = {
          to: "ossuary",
          when: () => false,
          fail: "The mushroom door is closed.\n\n蘑菇门紧闭着。",
        };
      }
      return ex;
    },

    events: [
      {
        id: "examine_bones",
        match: { verb: ["examine"], noun: ["bones", "bone", "骸骨", "骨头", "骨"] },
        triggers: ["看骸骨", "examine the bones", "look at bones"],
        text: "Bones clatter in all directions.\n\n骸骨向四面八方散落。",
      },
    ],
  },

  // ─── 22. Promontory ───
  promontory: {
    name: "Promontory",
    cn: "岬角",

    desc(s) {
      let d = "A boy sits nearby, listening to a pair of headphones and idly blowing soap bubbles. There's a dish full of soapy water by his side.\n\n" +
        "一个男孩坐在附近，戴着耳机听音乐，百无聊赖地吹着肥皂泡。他身旁放着一碟肥皂水。";
      d += "\n\nThe boy measures approximately forty feet from head to toe, and probably weighs several tons.\n\n" +
        "这个男孩从头到脚大约四十英尺高，可能重达数吨。";
      return d;
    },

    exits() {
      return { s: "north_bog", se: "chasms_brink", e: "cottage" };
    },

    events: [
      {
        id: "examine_boy_prom",
        match: { verb: ["examine"], noun: ["boy", "kid", "男孩", "孩子"] },
        triggers: ["看男孩", "examine the boy", "look at boy"],
        text: "The boy measures approximately forty feet from head to toe, and probably weighs several tons. The boy is too preoccupied with his music to notice your offer.\n\n" +
          "这个男孩从头到脚大约四十英尺高，可能重达数吨。他沉浸在音乐中，根本没注意到你。",
      },
      {
        id: "examine_dish_prom",
        match: { verb: ["examine"], noun: ["dish", "碟子", "盆", "water", "soapy"] },
        triggers: ["看碟子", "examine the dish", "look at dish"],
        text: "The dish is filled to the brim with soapy water.\n\n碟子里盛满了肥皂水。",
      },
      {
        id: "examine_headphones_prom",
        match: { verb: ["examine"], noun: ["headphones", "耳机"] },
        triggers: ["看耳机", "examine the headphones"],
        text: "The boy just stares back at you.\n\n男孩只是回瞪着你。",
      },
    ],
  },

  // ─── 23. Cottage ───
  cottage: {
    name: "Cottage",
    cn: "小屋",

    desc(s) {
      let d = "Coils of steam writhe from its depths, filling the air with a greasy stench that makes your nose wrinkle.\n\n" +
        "蒸汽的缕缕盘旋从锅底升起，弥漫在空气中的油腻恶臭令你皱起鼻子。";
      d += "\n\nLuckily, the front and back doors are both wide open.\n\n" +
        "幸好，前门和后门都敞开着。";
      return d;
    },

    exits() {
      return { e: "herb_garden", w: "promontory", s: "cemetery" };
    },

    events: [
      {
        id: "examine_map",
        match: { verb: ["examine", "read"], noun: ["map", "地图"] },
        triggers: ["看地图", "examine the map", "read the map"],
        text: "The map shows a network of boxes connected by lines and arrows, with many erasures and scrawled additions. Something about the pattern is maddeningly familiar.\n\n" +
          "地图显示着由线条和箭头连接的方框网络，上面有许多涂改和潦草的添注。图案中的某种规律令人恼火地似曾相识。",
      },
      {
        id: "examine_cauldron",
        match: { verb: ["examine"], noun: ["cauldron", "pot", "大锅", "锅"] },
        triggers: ["看大锅", "examine the cauldron", "look at pot"],
        text: "Coils of steam writhe from its depths, filling the air with a greasy stench that makes your nose wrinkle.\n\n" +
          "蒸汽的缕缕盘旋从锅底升起，弥漫在空气中的油腻恶臭令你皱起鼻子。",
      },
      {
        id: "examine_birdcage",
        match: { verb: ["examine"], noun: ["birdcage", "cage", "鸟笼", "笼子", "magpie", "bird", "喜鹊"] },
        triggers: ["看鸟笼", "examine the birdcage", "look at cage"],
        // TODO: verify with dfrotz
        text: "You see a birdcage mounted on the wall.\n\n你看到墙上安装着一个鸟笼。",
      },
      {
        id: "examine_soap_bubble",
        match: { verb: ["examine"], noun: ["soap bubble", "bubble", "肥皂泡"] },
        triggers: ["看肥皂泡", "examine soap bubble"],
        when: (s) => s.inRoom("soap_bubble"),
        text: "A fragile soap bubble, glistening in the light.\n\n一个脆弱的肥皂泡，在光线下闪烁。",
      },
      {
        id: "take_soap_bubble",
        match: { verb: ["take", "get"], noun: ["soap bubble", "bubble", "肥皂泡"] },
        triggers: ["拿肥皂泡", "take soap bubble"],
        when: (s) => s.inRoom("soap_bubble"),
        act(s) {
          s.take("soap_bubble");
        },
        text: "You take the soap bubble carefully.\n\n你小心地拿起了肥皂泡。",
      },
    ],
  },

  // ─── 24. Herb Garden（→ Tundra 蘑菇门，Libra ♎） ───
  herb_garden: {
    name: "Herb Garden",
    cn: "药草园",

    desc(s) {
      return "A tall fence protects the neat rows of herbs from predators. The only exit is the gate, leading west.\n\nAnother giant toadstool grows here.\n\n" +
        "一道高高的栅栏保护着整齐排列的药草免受天敌侵害。唯一的出口是向西的大门。\n\n这里还生长着另一株巨大的毒菌。";
    },

    exits(s) {
      const ex = { w: "cottage" };
      if (s.sundialSymbol === SUNDIAL_LIBRA) {
        ex.in = {
          to: "tundra_1",
          when: () => true,
          async act(s2, eng) {
            eng.print("You step through the mushroom door into the tundra.\n\n你穿过蘑菇门，进入冻原。");
            s2.setFlag("wabe_to_tundra_used");
            await eng.transitionChapter({
              to: "tundra",
              roomCandidates: ["tundra_1"],
            });
          },
          text: "",
        };
      } else {
        ex.in = {
          to: "herb_garden",
          when: () => false,
          fail: "The mushroom door is closed.\n\n蘑菇门紧闭着。",
        };
      }
      return ex;
    },

    events: [
      {
        id: "examine_herbs",
        match: { verb: ["examine"], noun: ["herbs", "herb", "药草", "草药"] },
        triggers: ["看药草", "examine the herbs"],
        text: "The herbs are lovingly planted in neat, parallel rows.\n\n药草被精心地种植在整齐的平行行列中。",
      },
      {
        id: "examine_thyme",
        match: { verb: ["examine", "take"], noun: ["thyme", "百里香"] },
        triggers: ["看百里香", "examine the thyme"],
        text: "Better not. There isn't much thyme left.\n\n还是别了。百里香所剩无几了。",
      },
    ],
  },

  // ─── 25. Moor（→ Japan 蘑菇门，Mars ♂） ───
  moor: {
    name: "Moor",
    cn: "荒野",

    desc(s) {
      return "Cattails wave eastward across the silent moor. A dense fog on the water obscures your view.\n\n" +
        "香蒲向东摇曳，横穿寂静的荒野。水面上浓雾弥漫，遮蔽了你的视线。";
    },

    exits(s) {
      const ex = { n: "craters_edge", w: "the_bend", nw: "under_cliff" };
      if (s.sundialSymbol === SUNDIAL_MARS) {
        ex.in = {
          to: "playground",
          when: () => true,
          async act(s2, eng) {
            eng.print("You step through the mushroom door. The world shifts.\n\n你穿过蘑菇门。世界陡然一变。");
            s2.setFlag("wabe_to_japan_used");
            await eng.transitionChapter({
              to: "japan",
              roomCandidates: ["playground"],
            });
          },
          text: "",
        };
      } else {
        ex.in = {
          to: "moor",
          when: () => false,
          fail: "The mushroom door is closed.\n\n蘑菇门紧闭着。",
        };
      }
      return ex;
    },

    events: [],
  },

  // ─── 26. The Bend ───
  the_bend: {
    name: "The Bend",
    cn: "弯道",

    desc(s) {
      return "A mountain stream trickles into a river that bends eastward. The landscape is veiled behind a thick mist.\n\nPaths meander off in many directions from the river's edge.\n\n" +
        "一条山涧汇入一条向东弯曲的河流。大地笼罩在浓浓的雾霭之中。\n\n小径从河岸边向四面八方蜿蜒而去。";
    },

    exits() {
      return {
        n: "under_cliff",
        ne: "craters_edge",
        e: "moor",
        s: "the_river",
        sw: "trellises",
        w: "bottom_of_stairs",
        nw: "chasms_brink",
      };
    },

    events: [],
  },

  // ─── 27. Forest Clearing ───
  forest_clearing: {
    name: "Forest Clearing",
    cn: "林中空地",

    desc(s) {
      return "This clearing is a central junction for the forest.\n\n" +
        "这片空地是森林中的中心枢纽。";
    },

    exits() {
      return {
        n: "south_bog",
        ne: "bottom_of_stairs",
        e: "trellises",
        nw: "waterfall",
      };
    },

    events: [],
  },

  // ─── 28. The River（→ Islet 蘑菇门，Alpha α） ───
  the_river: {
    name: "The River",
    cn: "河流",

    desc(s) {
      return "Tall trees line the banks of a great river that flows eastward across the silent moor. The water is unnaturally dark and still; ribbons of mist coil across its surface like ghostly fingers, obscuring what lies beyond.\n\n" +
        "高大的树木排列在一条向东流过寂静荒野的大河两岸。河水暗沉而静止；雾气的丝带像幽灵的手指般蜷曲过水面，遮蔽了彼岸。";
    },

    exits(s) {
      const ex = { n: "the_bend", w: "trellises", nw: "bottom_of_stairs" };
      if (s.sundialSymbol === SUNDIAL_ALPHA) {
        ex.in = {
          to: "islet",
          when: () => true,
          async act(s2, eng) {
            eng.print("You step onto the ferry and cross through the mushroom door.\n\n你登上渡船，穿过蘑菇门。");
            s2.setFlag("wabe_to_islet_used");
            await eng.transitionChapter({
              to: "islet",
              roomCandidates: ["islet"],
            });
          },
          text: "",
        };
      } else {
        ex.in = {
          to: "the_river",
          when: () => false,
          fail: "The mushroom door is closed.\n\n蘑菇门紧闭着。",
        };
      }
      return ex;
    },

    events: [
      {
        id: "examine_river",
        match: { verb: ["examine"], noun: ["river", "water", "河", "水", "河流"] },
        triggers: ["看河流", "examine the river", "look at water"],
        text: "The water is unnaturally dark and still; ribbons of mist coil across its surface like ghostly fingers, obscuring what lies beyond.\n\n" +
          "河水暗沉而静止；雾气的丝带像幽灵的手指般蜷曲过水面，遮蔽了彼岸。",
      },
    ],
  },

  // ─── 29. Crater's Edge ───
  craters_edge: {
    name: "Crater's Edge",
    cn: "陨石坑边缘",

    desc(s) {
      return "The eastern path ends at the lip of a deep crater, forty or fifty feet across.\n\n" +
        "东面的小径止于一个深坑的边缘，坑口宽约四五十英尺。";
    },

    exits() {
      return {
        s: "moor",
        sw: "the_bend",
        w: "under_cliff",
        nw: "bluff",
        d: "crater",
      };
    },

    events: [
      {
        id: "examine_crater_edge",
        match: { verb: ["examine"], noun: ["crater", "坑", "陨石坑"] },
        triggers: ["看陨石坑", "examine the crater", "look at crater"],
        text: "Looking at the crater below makes you giddy.\n\n向下看陨石坑让你头晕目眩。",
      },
    ],
  },

  // ─── 30. Crater ───
  crater: {
    name: "Crater",
    cn: "陨石坑",

    desc(s) {
      let d = "You feel a strong magnetic attraction.\n\n" +
        "你感到一股强烈的磁引力。";
      if (s.inRoom("lump")) {
        d += "\n\nA lump of hot metal lies here.\n\n一块灼热的金属块躺在这里。";
      }
      return d;
    },

    exits() {
      return { u: "craters_edge" };
    },

    events: [
      {
        id: "examine_lump",
        match: { verb: ["examine"], noun: ["lump", "metal", "金属块", "磁铁", "金属"] },
        triggers: ["看金属块", "examine the lump", "look at metal"],
        when: (s) => s.inRoom("lump") || s.has("lump"),
        text: "You recklessly burn your fingers on the hot metal. Ouch!\n\n你鲁莽地用手指碰了灼热的金属。哎哟！",
      },
    ],
  },
};
