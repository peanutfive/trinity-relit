// ═══════════════════════════════════════════════════
//  Russian Tundra — 苏联冻原  11 rooms
//  From Herb Garden (Libra ♎) via mushroom door. Return via white door.
//  Soviet nuclear test site in Arctic tundra.
//  All English text from original Infocom Trinity (1986).
// ═══════════════════════════════════════════════════

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

    onEnter(s, eng) {
      if (!s.hasFlag("tundra_lemming_placed")) {
        s.placeItem("lemming", "cliff_edge");
        s.setFlag("tundra_lemming_placed");
      }
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

    events: [
      {
        id: "put_lemming_in_cage_t1",
        match: { verb: ["put"], noun: ["lemming", "旅鼠"], noun2: ["cage", "鸟笼", "笼子"] },
        triggers: ["put lemming in cage", "把旅鼠放进笼子"],
        when: (s) => s.has("lemming") && s.has("cage") && !s.hasFlag("cage_has_lemming"),
        act(s) {
          s.placeItem("lemming", "cage");
          s.setFlag("cage_has_lemming");
          if (!s.hasFlag("scored_lemming_tundra")) {
            s.addScore(1);
            s.setFlag("scored_lemming_tundra");
          }
        },
        text: "You put the lemming in the cage. It settles in.\n\n你把旅鼠放进笼子。它安顿下来。",
      },
    ],
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

    desc(s) {
      let d = "You are at the cliff edge, overlooking an Arctic sea. A fissure is here.\n\n你在悬崖边缘，俯瞰着北冰洋。这里有一道裂缝。";
      if (s.inRoom("lemming")) {
        d += "\n\nA lemming is in the fissure.\n\n裂缝里有一只旅鼠。";
      }
      return d;
    },

    exits() {
      return {
        s: "platform",
      };
    },

    events: [
      {
        id: "look_in_fissure",
        match: { verb: ["look", "examine"], noun: ["fissure", "裂缝"] },
        triggers: ["look in fissure", "看裂缝"],
        when: (s) => s.room === "cliff_edge",
        text: "You look into the fissure. A small lemming is hiding there.\n\n你朝裂缝里看去。一只小旅鼠躲在里面。",
      },
      {
        id: "take_lemming_tundra",
        match: { verb: ["take", "get"], noun: ["lemming", "旅鼠"] },
        triggers: ["take lemming", "捉旅鼠"],
        when: (s) => s.room === "cliff_edge" && s.inRoom("lemming"),
        act(s) {
          s.take("lemming");
        },
        text: "You take the lemming.\n\n你捉住了旅鼠。",
      },
      {
        id: "put_lemming_in_cage",
        match: { verb: ["put"], noun: ["lemming", "旅鼠"], noun2: ["cage", "鸟笼", "笼子"] },
        triggers: ["put lemming in cage", "把旅鼠放进笼子"],
        when: (s) => s.has("lemming") && s.has("cage") && !s.hasFlag("cage_has_lemming"),
        act(s) {
          s.placeItem("lemming", "cage");
          s.setFlag("cage_has_lemming");
          if (!s.hasFlag("scored_lemming_tundra")) {
            s.addScore(1);
            s.setFlag("scored_lemming_tundra");
          }
        },
        text: "You put the lemming in the cage. It settles in.\n\n你把旅鼠放进笼子。它安顿下来。",
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
