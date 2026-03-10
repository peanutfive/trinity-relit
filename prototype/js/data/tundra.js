// ═══════════════════════════════════════════════════
//  Russian Tundra — 苏联冻原  11 rooms
//  From Herb Garden (Libra ♎). Cliff edge fissure: lemming in cage.
// ═══════════════════════════════════════════════════

export const ROOMS = {
  tundra_1: {
    name: "Tundra",
    cn: "冻原",
    desc(s) {
      return "You are on the Russian tundra. The wind cuts like a knife. When the sundial pointed to Libra, the white door brought you here.\n\n你在苏联冻原上。寒风如刀。当日晷指向天秤座时，白门将你带到了这里。";
    },
    onEnter(s) {
      s.chapter = "tundra";
      if (!s.hasFlag("tundra_lemming_placed")) {
        s.placeItem("lemming", "cliff_edge");
        s.setFlag("tundra_lemming_placed");
      }
    },
    exits() {
      return { out: "herb_garden", e: "tundra_2" };
    },
    events: [],
  },
  tundra_2: {
    name: "Tundra",
    cn: "冻原",
    desc(s) {
      return "The tundra stretches away in all directions. Snow and wind dominate the landscape.\n\n冻原向四周延伸。冰雪与寒风主宰着这片土地。";
    },
    onEnter(s) { s.chapter = "tundra"; },
    exits() {
      return { w: "tundra_1", e: "tundra_3" };
    },
    events: [],
  },
  tundra_3: {
    name: "Tundra",
    cn: "冻原",
    desc(s) {
      return "The tundra stretches away in all directions. Snow and wind dominate the landscape.\n\n冻原向四周延伸。冰雪与寒风主宰着这片土地。";
    },
    onEnter(s) { s.chapter = "tundra"; },
    exits() {
      return { w: "tundra_2", e: "tundra_4" };
    },
    events: [],
  },
  tundra_4: {
    name: "Tundra",
    cn: "冻原",
    desc(s) {
      return "The tundra stretches away in all directions. Snow and wind dominate the landscape.\n\n冻原向四周延伸。冰雪与寒风主宰着这片土地。";
    },
    onEnter(s) { s.chapter = "tundra"; },
    exits() {
      return { w: "tundra_3", e: "tundra_5" };
    },
    events: [],
  },
  tundra_5: {
    name: "Tundra",
    cn: "冻原",
    desc(s) {
      return "The tundra stretches away in all directions. Snow and wind dominate the landscape.\n\n冻原向四周延伸。冰雪与寒风主宰着这片土地。";
    },
    onEnter(s) { s.chapter = "tundra"; },
    exits() {
      return { w: "tundra_4", e: "tundra_6" };
    },
    events: [],
  },
  tundra_6: {
    name: "Tundra",
    cn: "冻原",
    desc(s) {
      return "The tundra stretches away in all directions. Snow and wind dominate the landscape.\n\n冻原向四周延伸。冰雪与寒风主宰着这片土地。";
    },
    onEnter(s) { s.chapter = "tundra"; },
    exits() {
      return { w: "tundra_5", e: "tundra_7" };
    },
    events: [],
  },
  tundra_7: {
    name: "Tundra",
    cn: "冻原",
    desc(s) {
      return "The tundra stretches away in all directions. Snow and wind dominate the landscape.\n\n冻原向四周延伸。冰雪与寒风主宰着这片土地。";
    },
    onEnter(s) { s.chapter = "tundra"; },
    exits() {
      return { w: "tundra_6", e: "tundra_8" };
    },
    events: [],
  },
  tundra_8: {
    name: "Tundra",
    cn: "冻原",
    desc(s) {
      return "The tundra stretches away in all directions. Snow and wind dominate the landscape.\n\n冻原向四周延伸。冰雪与寒风主宰着这片土地。";
    },
    onEnter(s) { s.chapter = "tundra"; },
    exits() {
      return { w: "tundra_7", s: "under_platform" };
    },
    events: [],
  },
  under_platform: {
    name: "Under Platform",
    cn: "平台下方",
    desc(s) {
      return "You are under the platform. The platform is above you.\n\n你在平台下方。平台在你上方。";
    },
    onEnter(s) { s.chapter = "tundra"; },
    exits() {
      return { n: "tundra_8", u: "platform", ne: "cliff_edge" };
    },
    events: [],
  },
  cliff_edge: {
    name: "Cliff Edge",
    cn: "悬崖边",
    desc(s) {
      let d = "You are at the cliff edge. The platform is to the south. A fissure is here.\n\n你在悬崖边缘。平台在南面。这里有一道裂缝。";
      if (s.inRoom("lemming")) {
        d += "\n\nA lemming is in the fissure.\n\n裂缝里有一只旅鼠。";
      }
      return d;
    },
    onEnter(s) { s.chapter = "tundra"; },
    exits() {
      return { s: "platform", sw: "under_platform" };
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
  platform: {
    name: "Platform",
    cn: "平台",
    desc(s) {
      return "You are on the platform. The cliff edge is north; the space below is down.\n\n你在平台上。悬崖边在北面；下方是空处。";
    },
    onEnter(s) { s.chapter = "tundra"; },
    exits() {
      return { n: "cliff_edge", d: "under_platform" };
    },
    events: [],
  },
};
