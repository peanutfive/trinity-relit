// ═══════════════════════════════════════════════════
//  The Wabe — 中央枢纽  30 rooms
//  All English text to be filled from original Infocom Trinity (1986).
//  Room connectivity from zparse.py (Trinity 1986/TRINITY.DAT --objects).
//  Rooms with no 2-byte exits in Z-machine (meadow, vertex, etc.) keep inferred exits for playability.
// ═══════════════════════════════════════════════════

// Sundial symbol constants (1–7). Mapping: 1=Mars→Japan, 2=Pluto→Underground,
// 3=Mercury→Orbit, 4=Neptune→Pacific, 5=Libra→Tundra, 6=Alpha→Islet
const SUNDIAL_MARS = 1;
const SUNDIAL_PLUTO = 2;
const SUNDIAL_MERCURY = 3;
const SUNDIAL_NEPTUNE = 4;
const SUNDIAL_LIBRA = 5;
const SUNDIAL_ALPHA = 6;

export const ROOMS = {

  // ─── 1. Meadow (入口) ───
  meadow: {
    name: "Meadow",
    cn: "草地",

    desc(s) {
      return "Who just spoke to us? I have no idea, but that voice will return at odd moments during our journeys, whispering comments in our ear, like an unseen sidekick. The roadrunner is nowhere to be seen.\n\n不知是谁在说话？那声音会在旅途中不时响起，像无形的伙伴在耳畔低语。走鹃已不见踪影。";
    },

    exits() {
      return {
        n: "summit",
        s: "south_bog",
        e: "bottom_of_stairs",
        w: "north_bog",
      };
    },

    events: [],
  },

  // ─── 2. Summit ───
  summit: {
    name: "Summit",
    cn: "山顶",

    desc(s) {
      return "As will become obvious, the toadstools are a symbolic representation of the mushroom clouds that are caused by atomic blasts. And since the landscape is a huge sundial and its geography represents different moments of history, the increasing number of toadstools here in the west represent the increasing use of atomic bombs over time.\n\n显而易见，这些毒菌象征着原子弹爆炸形成的蘑菇云。这片土地本身就像一座巨大的日晷，地理对应着历史上的不同时刻，西边越来越多的毒菌正代表着原子弹日益频繁的使用。";
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
      return "The first thing you want is the splinter here; it's a lightsource. A bog stretches north and east; a log and splinter are nearby.\n\n你首先想要的是这里的木片——它是光源。沼泽向北、向东延伸，附近有一根圆木和木片。";
    },

    exits() {
      return {
        n: "north_bog",
        e: "bottom_of_stairs",
        ne: "chasms_brink",
        se: "trellises",
        s: "forest_clearing",
        w: "waterfall",
      };
    },

    events: [],
  },

  // ─── 4. North Bog ───
  north_bog: {
    name: "North Bog",
    cn: "北沼泽",

    desc(s) {
      return "Don't put anything into the flytrap; it swallows up anything and you'll never get it back. And you can't even cut it; the axe just bounces off of it!\n\n别往捕蝇草里放任何东西——它会吞掉一切且再也拿不回来。用斧头砍也没用，只会弹开。";
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
      return "A maze of plumbing rises before you like the back of a giant refrigerator. Stairs lead up to a circular platform high above.\n\n如巨型冰箱背面般的管道迷宫在你面前升起。石阶通向高处的圆形平台。";
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
      let d = "Also note that it's cold up here. The vertex of the sundial offers a commanding view; a ring of seven symbols surrounds the dial, and a lever and a hole await the gnomon's return.\n\n这里高处很冷。日晷的顶点视野开阔；七个符号环绕表盘，杠杆与孔洞静待指针归位。";
      if (s.sundialSymbol >= 1 && s.sundialSymbol <= 7) {
        d += "\n\n当前指向的符号随转动而改变。";
      }
      return d;
    },

    exits(s) {
      const ex = {
        d: "bottom_of_stairs",
        n: "trellises",
        ne: "arboretum",
        e: "herb_garden",
        se: "cottage",
        s: "cemetery",
        sw: "moor",
        w: "the_bend",
        nw: "craters_edge",
      };
      return ex;
    },

    events: [
      {
        id: "examine_sundial_vertex",
        match: { verb: ["examine"], noun: ["sundial", "日晷", "dial"] },
        triggers: ["看日晷", "examine the sundial"],
        text: "The perimeter of the sundial is inscribed with seven curious symbols and a compass rose.\n\n日晷周边刻着七个奇特的符号和罗盘玫瑰。",
      },
      {
        id: "examine_ring",
        match: { verb: ["examine"], noun: ["ring", "符号环", "symbol", "symbols"] },
        triggers: ["看符号环", "examine the ring", "examine symbols"],
        text: "A ring of seven astronomical symbols surrounds the sundial. You can turn it to point to different symbols.\n\n七个天文符号环绕日晷。你可以转动它指向不同符号。",
      },
      {
        id: "turn_ring",
        match: { verb: ["turn", "rotate", "twist"], noun: ["ring", "符号环", "symbol"] },
        triggers: ["转动符号环", "turn the ring", "rotate ring"],
        act(s) {
          s.sundialSymbol = (s.sundialSymbol % 7) + 1;
        },
        text(s) {
          const sym = s.sundialSymbol;
          const names = ["", "Mars", "Pluto", "Mercury", "Neptune", "Libra", "Alpha", "?"];
          return `You turn the ring. It now points to the symbol of ${names[sym] || "?"}.\n\n你转动了符号环。它现在指向${names[sym] || "?"}的符号。`;
        },
      },
    ],
  },

  // ─── 7. Trellises ───
  trellises: {
    name: "Trellises",
    cn: "棚架",

    desc(s) {
      return "Wooden trellises support a tangle of vines. Paths lead off in several directions.\n\n木棚架上藤蔓盘绕，小径向多个方向延伸。";
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
        s: "vertex",
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
      return "The arbor is a Klein bottle, as suggested by the sculpture and inscription. Passing through the top from one side to the other will flip you left-to-right.\n\n藤架正如雕塑与铭文所暗示，是一个克莱因瓶。从一侧穿过顶部到另一侧会使你左右颠倒。";
    },

    exits(s) {
      if (s.flipped) {
        return { w: "arborvitaes_n", e: "arborvitaes_s" };
      }
      return { w: "arborvitaes_s", e: "arborvitaes_n" };
    },

    events: [],
  },

  // ─── 9. Top of Arbor（穿过顶部时翻转 Klein 瓶状态） ───
  top_of_arbor: {
    name: "Top of Arbor",
    cn: "藤架顶部",

    desc(s) {
      return "You'll need a lightsource, such as the splinter, to see the axe here. You are at the top of the arbor, with North Arbor to the north and South Arbor to the south.\n\n你需要光源（例如木片）才能看到这里的斧头。你在藤架顶端，北侧藤架在北，南侧藤架在南。";
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

    desc(s) {
      return "You are on the north side of the arbor. The top of the arbor is above you.\n\n你在藤架北侧，藤架顶端在你上方。";
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

    desc(s) {
      return "You are on the south side of the arbor. The top of the arbor is above you.\n\n你在藤架南侧，藤架顶端在你上方。";
    },

    exits() {
      return { n: "top_of_arbor" };
    },

    events: [],
  },

  // ─── 12. Arborvitaes (North)（翻转时从 arboretum 的 e 进，故此处保持回 arboretum） ───
  arborvitaes_n: {
    name: "Arborvitaes",
    cn: "北侧崖柏",

    desc(s) {
      return "Arborvitaes block the way in places. To the northwest the trellises are visible; to the west lies the arboretum.\n\n崖柏在有些地方挡住去路。西北可见棚架，西面是植物园。";
    },

    exits(s) {
      return { nw: "trellises", w: "arboretum" };
    },

    events: [],
  },

  // ─── 13. Arborvitaes (South) ───
  arborvitaes_s: {
    name: "Arborvitaes",
    cn: "南侧崖柏",

    desc(s) {
      return "Arborvitaes block the way. The arboretum lies to the east, the trellises to the northeast.\n\n崖柏挡住去路。植物园在东，棚架在东北。";
    },

    exits(s) {
      return { e: "arboretum", ne: "trellises" };
    },

    events: [],
  },

  // ─── 14. Chasm's Brink（→ Pacific 蘑菇门，Neptune ♆） ───
  chasms_brink: {
    name: "Chasm's Brink",
    cn: "深渊边缘",

    desc(s) {
      return "You stand at the brink of a chasm. A fallen tree spans the gap to the north; a mesa rises in the distance. A toadstool with a white door grows here.\n\n你站在深渊边缘。一根倒下的树横跨北面的沟壑，远处台地耸立。一株带白门的毒菌生长于此。";
    },

    onEnter(s) {
      s.chapter = "wabe";
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
          text: "You step through the mushroom door. The world shifts to a small island in the ocean.\n\n你穿过蘑菇门。世界陡然一变，来到大洋中的一座小岛。",
          async act(s2, eng) {
            const ok = await eng.activateChapter("pacific");
            if (ok) {
              s2.chapter = "pacific";
              s2.setFlag("chapter_pacific_entered");
              s2.setFlag("wabe_to_pacific_used");
            }
          },
        };
      } else {
        ex.in = {
          to: "chasms_brink",
          when: () => false,
          fail: "The mushroom door is closed. Turn the sundial ring to Neptune to open it.\n\n蘑菇门关着。将日晷符号环转到海王星才能打开。",
        };
      }
      return ex;
    },

    events: [],
  },

  // ─── 15. Waterfall（→ Orbit 蘑菇门） ───
  waterfall: {
    name: "Waterfall",
    cn: "瀑布",

    desc(s) {
      return "A waterfall plunges into the chasm. When the sundial points to Mercury, the toadstool's white door opens—you will need the soap bubble from the cottage to pass through.\n\n瀑布泻入深渊。当日晷指向水星时，毒菌的白门会打开——你需要从小屋取得的肥皂泡才能通过。";
    },

    onEnter(s) {
      s.chapter = "wabe";
    },

    exits(s) {
      const ex = {
        e: "south_bog",
        ne: "north_bog",
        se: "forest_clearing",
      };
      if (s.sundialSymbol === SUNDIAL_MERCURY && s.has("soap_bubble")) {
        ex.in = {
          to: "orbit_satellite",
          when: () => true,
          text: "You step through the mushroom door into the cold of space.\n\n你穿过蘑菇门，步入太空的寒冷。",
          async act(s2, eng) {
            const ok = await eng.activateChapter("orbit");
            if (ok) {
              s2.chapter = "orbit";
              s2.setFlag("chapter_orbit_entered");
              s2.setFlag("wabe_to_orbit_used");
            }
          },
        };
      } else if (s.sundialSymbol === SUNDIAL_MERCURY && !s.has("soap_bubble")) {
        ex.in = {
          to: "waterfall",
          when: () => false,
          fail: "You need the soap bubble from the cottage to pass through this door.\n\n你需要从小屋取得的肥皂泡才能通过这道门。",
        };
      } else {
        ex.in = {
          to: "waterfall",
          when: () => false,
          fail: "The mushroom door is closed. Turn the sundial ring to Mercury to open it.\n\n蘑菇门关着。将日晷符号环转到水星才能打开。",
        };
      }
      return ex;
    },

    events: [],
  },

  // ─── 16. Ice Cavern ───
  ice_cavern: {
    name: "Ice Cavern",
    cn: "冰穴",

    desc(s) {
      return "You are in an ice cavern. Icicles hang from the ceiling. You can reach the cavern via the waterfall or the ossuary key.\n\n你在冰穴中，冰锥从洞顶垂下。可通过瀑布或纳骨堂的钥匙到达此处。";
    },

    exits() {
      return { out: "under_cliff" };
    },

    events: [],
  },

  // ─── 17. Under Cliff ───
  under_cliff: {
    name: "Under Cliff",
    cn: "悬崖下",

    desc(s) {
      return "Don't disturb the bees just yet. They're dangerous. You are under a cliff; a beehive is here.\n\n先别招惹蜜蜂，它们很危险。你在悬崖下，此处有一个蜂巢。";
    },

    exits() {
      return {
        e: "craters_edge",
        s: "the_bend",
        se: "moor",
        w: "chasms_brink",
        sw: "bottom_of_stairs",
        in: "ice_cavern",
        u: "bluff",
      };
    },

    events: [],
  },

  // ─── 18. Bluff ───
  bluff: {
    name: "Bluff",
    cn: "断崖",

    desc(s) {
      return "You are on a bluff. The cottage is visible to the southeast.\n\n你在断崖上，东南方向可见小屋。";
    },

    exits() {
      return { se: "craters_edge", sw: "chasms_brink", d: "under_cliff" };
    },

    events: [],
  },

  // ─── 19. Cemetery ───
  cemetery: {
    name: "Cemetery",
    cn: "墓地",

    desc(s) {
      return "A neglected cemetery. A crypt stands to the north; the barrow entrance is to the east. Bring a lightsource when visiting the barrow.\n\n荒凉的墓地。北面有一座墓穴，东边是古墓入口。进入古墓时请带上光源。";
    },

    exits() {
      return { n: "vertex", e: "barrow" };
    },

    events: [],
  },

  // ─── 20. Barrow ───
  barrow: {
    name: "Barrow",
    cn: "古墓",

    desc(s) {
      return "A spiked door can block the south exit. A barrow wight haunts this place—it will attack without light. A hole in the door awaits the skeleton key.\n\n尖刺门可挡住南侧出口。古墓尸妖在此出没——无光时会攻击。门上的孔洞等待骸骨钥匙。";
    },

    exits() {
      return { w: "cemetery", in: "ossuary" };
    },

    events: [],
  },

  // ─── 21. Ossuary（→ Underground 蘑菇门） ───
  ossuary: {
    name: "Ossuary",
    cn: "纳骨堂",

    desc(s) {
      return "Bones line the ossuary. Searching them yields the skeleton key. When the sundial points to Pluto, the toadstool's white door opens to the underground.\n\n纳骨堂内骸骨成列。搜寻可得骸骨钥匙。当日晷指向冥王星时，毒菌的白门会通向地下。";
    },

    onEnter(s) {
      s.chapter = "wabe";
    },

    exits(s) {
      const ex = { out: "barrow" };
      if (s.sundialSymbol === SUNDIAL_PLUTO) {
        ex.in = {
          to: "underground_1",
          when: () => true,
          text: "You step through the mushroom door into the underground.\n\n你穿过蘑菇门，进入地下。",
          async act(s2, eng) {
            const ok = await eng.activateChapter("underground");
            if (ok) {
              s2.chapter = "underground";
              s2.setFlag("chapter_underground_entered");
              s2.setFlag("wabe_to_underground_used");
            }
          },
        };
      } else {
        ex.in = {
          to: "ossuary",
          when: () => false,
          fail: "The mushroom door is closed. Turn the sundial ring to Pluto to open it.\n\n蘑菇门关着。将日晷符号环转到冥王星才能打开。",
        };
      }
      return ex;
    },

    events: [],
  },

  // ─── 22. Promontory ───
  promontory: {
    name: "Promontory",
    cn: "岬角",

    desc(s) {
      return "A much larger version of the boy from Inverness Terrace is here, wearing headphones and blowing soap bubbles. Climbing into his dish lets you float in a soap bubble.\n\n来自因弗内斯露台的男孩的放大版在这里，戴着耳机吹肥皂泡。爬进他的盆里就能在肥皂泡中漂浮。";
    },

    exits() {
      return { s: "north_bog", se: "chasms_brink", e: "cottage" };
    },

    events: [],
  },

  // ─── 23. Cottage（肥皂泡等） ───
  cottage: {
    name: "Cottage",
    cn: "小屋",

    desc(s) {
      return "A cottage with a map, a cauldron, a book on a pedestal, and a magpie in a cage. The back door leads to the herb garden. The soap bubble and wand are here.\n\n小屋内有地图、大锅、基座上的书和笼中喜鹊。后门通向药草园。肥皂泡与魔杖在此。";
    },

    exits() {
      return { nw: "vertex", w: "promontory" };
    },

    events: [
      {
        id: "examine_soap_bubble",
        match: { verb: ["examine"], noun: ["soap bubble", "bubble", "肥皂泡"] },
        triggers: ["看肥皂泡", "examine soap bubble"],
        when: (s) => s.inRoom("soap_bubble"),
        text: "A fragile soap bubble, glistening in the light. It might protect you in harsh conditions.\n\n一个脆弱的肥皂泡，在光线下闪烁。它或许能在严酷环境中保护你。",
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

  // ─── 24. Herb Garden（→ Tundra 蘑菇门） ───
  herb_garden: {
    name: "Herb Garden",
    cn: "药草园",

    desc(s) {
      return "The toadstools with white doors all look the same. Herbs, thyme, and garlic grow here. When the sundial points to Libra, the white door opens to the tundra.\n\n带白门的毒菌看起来都一样。这里种着香草、百里香和大蒜。当日晷指向天秤座时，白门会通向冻原。";
    },

    onEnter(s) {
      s.chapter = "wabe";
    },

    exits(s) {
      const ex = { w: "vertex" };
      if (s.sundialSymbol === SUNDIAL_LIBRA) {
        ex.in = {
          to: "tundra_1",
          when: () => true,
          text: "You step through the mushroom door into the tundra.\n\n你穿过蘑菇门，进入冻原。",
          async act(s2, eng) {
            const ok = await eng.activateChapter("tundra");
            if (ok) {
              s2.chapter = "tundra";
              s2.setFlag("chapter_tundra_entered");
              s2.setFlag("wabe_to_tundra_used");
            }
          },
        };
      } else {
        ex.in = {
          to: "herb_garden",
          when: () => false,
          fail: "The mushroom door is closed. Turn the sundial ring to Libra to open it.\n\n蘑菇门关着。将日晷符号环转到天秤座才能打开。",
        };
      }
      return ex;
    },

    events: [],
  },

  // ─── 25. Moor（→ Japan 蘑菇门） ───
  moor: {
    name: "Moor",
    cn: "荒野",

    desc(s) {
      return "A desolate moor. When the sundial points to Mars, the toadstool's white door opens to the Japanese playground.\n\n荒凉的荒野。当日晷指向火星时，毒菌的白门会通向日本游乐场。";
    },

    onEnter(s) {
      s.chapter = "wabe";
    },

    exits(s) {
      const ex = { n: "craters_edge", w: "the_bend", nw: "under_cliff" };
      if (s.sundialSymbol === SUNDIAL_MARS) {
        ex.in = {
          to: "playground",
          when: () => true,
          text: "You step through the mushroom door. The world shifts.\n\n你穿过蘑菇门。世界陡然一变。",
          async act(s2, eng) {
            const ok = await eng.activateChapter("japan");
            if (ok) {
              s2.chapter = "japan";
              s2.setFlag("chapter_japan_entered");
              s2.setFlag("wabe_to_japan_used");
            }
          },
        };
      } else {
        ex.in = {
          to: "moor",
          when: () => false,
          fail: "The mushroom door is closed. Turn the sundial ring to Mars to open it.\n\n蘑菇门关着。将日晷符号环转到火星才能打开。",
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
      return "The path bends here. The landscape winds toward the river, the moor, the crater's edge, and back to the stairs and trellises.\n\n小路在此弯折，通向河流、荒野、陨石坑边缘，并回到楼梯与棚架。";
    },

    exits() {
      return {
        n: "under_cliff",
        ne: "craters_edge",
        e: "moor",
        s: "the_river",
        w: "bottom_of_stairs",
        sw: "trellises",
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
      return "A clearing in the forest. Paths lead to the waterfall, the trellises, the bottom of the stairs, and the south bog.\n\n林间一片空地。小径通向瀑布、棚架、楼梯底部和南沼泽。";
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

  // ─── 28. The River（→ Islet 蘑菇门 / 渡船） ───
  the_river: {
    name: "The River",
    cn: "河流",

    desc(s) {
      return "A river flows through the landscape. A ferry sometimes appears. When the sundial points to Alpha, the white door opens to the islet.\n\n河流穿过这片土地。渡船时而出现。当日晷指向 Alpha 时，白门会通向小岛。";
    },

    onEnter(s) {
      s.chapter = "wabe";
    },

    exits(s) {
      const ex = { n: "the_bend", w: "trellises", nw: "bottom_of_stairs" };
      if (s.sundialSymbol === SUNDIAL_ALPHA) {
        ex.in = {
          to: "islet",
          when: () => true,
          text: "You step onto the ferry and cross through the mushroom door to the islet.\n\n你登上渡船，穿过蘑菇门来到小岛。",
          async act(s2, eng) {
            const ok = await eng.activateChapter("islet");
            if (ok) {
              s2.chapter = "islet";
              s2.setFlag("chapter_islet_entered");
              s2.setFlag("wabe_to_islet_used");
            }
          },
        };
      } else {
        ex.in = {
          to: "the_river",
          when: () => false,
          fail: "The mushroom door (ferry) is closed. Turn the sundial ring to Alpha to open it.\n\n蘑菇门（渡船）未开。将日晷符号环转到 Alpha 才能打开。",
        };
      }
      return ex;
    },

    events: [],
  },

  // ─── 29. Crater's Edge ───
  craters_edge: {
    name: "Crater's Edge",
    cn: "陨石坑边缘",

    desc(s) {
      return "You stand at the edge of a crater. The crater floor is below; the bluff and under cliff are to the northwest and west.\n\n你站在陨石坑边缘。坑底在下方，断崖与悬崖下在西北和西面。";
    },

    exits() {
      return {
        s: "moor",
        w: "under_cliff",
        sw: "the_bend",
        nw: "bluff",
        d: "crater",
      };
    },

    events: [],
  },

  // ─── 30. Crater ───
  crater: {
    name: "Crater",
    cn: "陨石坑",

    desc(s) {
      return "You are in the crater. A hot lump of metal lies here—a strong magnet. Objects containing iron are attracted to it.\n\n你在陨石坑底。一块灼热的金属块在此——强磁体，含铁之物会被吸引。";
    },

    exits() {
      return { n: "craters_edge", u: "craters_edge" };
    },

    events: [],
  },
};
