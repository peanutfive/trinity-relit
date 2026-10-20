// ═══════════════════════════════════════════════════
//  Russian Tundra — 苏联冻原  11 rooms
//  From Herb Garden (Libra ♎) via mushroom door. Return via white door.
//  Soviet nuclear test site in Arctic tundra.
//  All English text from original Infocom Trinity (1986).
// ═══════════════════════════════════════════════════

import { discoverLemming } from "../animal-rules.js";

const TUNDRA_DESC = "The frozen earth stretches flat in all directions. Snow and wind dominate the landscape. Guards patrol somewhere in the distance.\n\n冰冻的大地向四面八方平坦延伸。冰雪与寒风主宰着这片土地。远处有卫兵巡逻。";

export const ROOMS = {

  // ─── 1. tundra_1 (obj#56) ───
  tundra_1: {
    name: "Tundra",
    cn: "冻原",

    desc(s) {
      return "You are on the Russian tundra. The wind cuts like a knife. When the sundial pointed to Libra, the white door brought you here.\n\n" +
        "你在苏联冻原上。寒风如刀。当日晷指向天秤座时，白门将你带到了这里。";
    },

    exits(s) {
      const ex = {
        n: "tundra_3",
        ne: "under_platform",
        e: "tundra_8",
        out: {
          to: "herb_garden",
          when: () => true,
          async act(s2, eng) {
            await eng.transitionChapter({
              to: "wabe",
              roomCandidates: ["herb_garden"],
            });
          },
          text: "You step through the white door. The world shifts. You are back in the Herb Garden.\n\n你穿过白门。世界陡然一变。你回到了药草园。",
        },
      };
      return ex;
    },

    events: [],
  },

  // ─── 2. tundra_2 (obj#119) ───
  tundra_2: {
    name: "Tundra",
    cn: "冻原",

    desc() { return TUNDRA_DESC; },

    exits() {
      return {
        n: "tundra_4",
        s: "tundra_7",
        sw: "tundra_8",
        w: "under_platform",
        nw: "tundra_5",
      };
    },

    events: [],
  },

  // ─── 3. tundra_3 (obj#188) ───
  tundra_3: {
    name: "Tundra",
    cn: "冻原",

    desc() { return TUNDRA_DESC; },

    exits() {
      return {
        n: "tundra_6",
        ne: "tundra_5",
        e: "under_platform",
        se: "tundra_8",
        s: "tundra_1",
      };
    },

    events: [],
  },

  // ─── 4. tundra_4 (obj#254) ───
  tundra_4: {
    name: "Tundra",
    cn: "冻原",

    desc() { return TUNDRA_DESC; },

    exits() {
      return {
        s: "tundra_2",
        sw: "under_platform",
        w: "tundra_5",
      };
    },

    events: [],
  },

  // ─── 5. tundra_5 (obj#320) ───
  tundra_5: {
    name: "Tundra",
    cn: "冻原",

    desc() { return TUNDRA_DESC; },

    exits() {
      return {
        e: "tundra_4",
        se: "tundra_2",
        s: "under_platform",
        sw: "tundra_3",
        w: "tundra_6",
      };
    },

    events: [],
  },

  // ─── 6. tundra_6 (obj#380) ───
  tundra_6: {
    name: "Tundra",
    cn: "冻原",

    desc(s) {
      return "The frozen earth slopes north to meet a gray wall of ice.\n\n冰冻的大地向北倾斜，与一道灰色的冰墙相接。";
    },

    exits() {
      return {
        e: "tundra_5",
        se: "under_platform",
        s: "tundra_3",
      };
    },

    events: [],
  },

  // ─── 7. tundra_7 (obj#509) ───
  tundra_7: {
    name: "Tundra",
    cn: "冻原",

    desc() { return TUNDRA_DESC; },

    exits() {
      return {
        n: "tundra_2",
        w: "tundra_8",
        nw: "under_platform",
      };
    },

    events: [],
  },

  // ─── 8. tundra_8 (obj#585) ───
  tundra_8: {
    name: "Tundra",
    cn: "冻原",

    desc() { return TUNDRA_DESC; },

    exits() {
      return {
        n: "under_platform",
        ne: "tundra_2",
        e: "tundra_7",
        w: "tundra_1",
        nw: "tundra_3",
      };
    },

    events: [],
  },

  // ─── 9. under_platform (obj#488) ───
  under_platform: {
    name: "Under Platform",
    cn: "平台下方",

    desc(s) {
      return "You are under the platform. The platform is above you.\n\n你在平台下方。平台在你上方。";
    },

    exits(s) {
      const ex = {
        n: "tundra_5",
        ne: "tundra_4",
        e: "tundra_2",
        se: "tundra_7",
        s: "tundra_8",
        sw: "tundra_1",
        w: "tundra_3",
        nw: "tundra_6",
        u: {
          to: "platform",
          when: () => true,
          text: "You climb up onto the platform.\n\n你爬上了平台。",
        },
      };
      return ex;
    },

    events: [],
  },

  // ─── 10. cliff_edge (obj#43) — Arctic cliff overlooking sea, fissure ───
  cliff_edge: {
    name: "Cliff Edge",
    cn: "悬崖边",

    desc() {
      return "The river bed ends here, on a cliff overlooking an Arctic sea. But where ancient waters once fell, there now pours a living stream of lemmings. Driven by mindless instinct, too stupid or frightened to turn away, they plunge by the hundreds into the crashing waves below.\n\nThe ground underfoot is split by a narrow fissure, almost hidden by the scrambling lemmings.\n\n河床在此终止于俯瞰北冰洋的悬崖。然而古时水流曾坠落的地方，如今倾泻着由活旅鼠组成的洪流。它们受盲目本能驱使，愚蠢或惊恐得无法回头，成百上千地跃入下方轰鸣的海浪。\n\n脚下的地面裂开了一道狭窄的缝隙，几乎被奔窜的旅鼠遮住。";
    },

    exits() {
      return {
        s: "platform",
      };
    },

    events: [
      {
        id: "look_in_fissure",
        match: { verb: ["look", "examine", "look_in", "search"], noun: ["fissure", "crevice", "cleft", "hole", "裂缝", "缝隙"] },
        triggers: ["look in fissure", "examine fissure", "search fissure", "看裂缝", "查看裂缝里面", "搜索裂缝"],
        act(s, eng) { discoverLemming(s, eng); },
        text: "",
      },
    ],
  },

  // ─── 11. platform (obj#199) — Soviet test platform, enclosure ───
  platform: {
    name: "Platform",
    cn: "平台",

    desc(s) {
      return "You are on the platform. A metal enclosure holds the Soviet nuclear device. The cliff edge is north; the space below is down.\n\n你在平台上。一个金属围栏里放着苏联核装置。悬崖边在北面；下方是空处。";
    },

    exits() {
      return {
        n: "cliff_edge",
        d: "under_platform",
      };
    },

    events: [],
  },
};
