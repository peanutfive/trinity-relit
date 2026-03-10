// ═══════════════════════════════════════════════════
//  Earth Orbit — 地球轨道  2 rooms
//  From Waterfall (Mercury ☿, need soap bubble). Skink/lump/axe; break bubble to return.
//  All English text from original Infocom Trinity (1986) / walkthrough.
// ═══════════════════════════════════════════════════

export const ROOMS = {

  orbit_satellite: {
    name: "Earth Orbit! on a satellite",
    cn: "地球轨道·卫星上",

    desc(s) {
      return "You are in Earth orbit, on a satellite. The cold of space surrounds you. You arrived inside the soap bubble; remember the magpie's clue about the crescent moon.\n\n你在地球轨道上，在一颗卫星上。太空的寒冷包围着你。你是乘肥皂泡来的；记得喜鹊关于新月之光的提示。";
    },

    onEnter(s) {
      s.chapter = "orbit";
    },

    exits() {
      return { out: "waterfall", in: "orbit_space" };
    },

    events: [
      {
        id: "examine_satellite",
        match: { verb: ["examine", "look"], noun: ["satellite", "卫星", "卫星体"] },
        triggers: ["examine satellite", "看卫星"],
        when: (s) => s.room === "orbit_satellite" && s.has("lump"),
        act(s) {
          s.placeItem("lump", "orbit_satellite");
        },
        text: "The lump attaches itself to the hull of the satellite. It is a powerful magnet.\n\n那块金属牢牢吸在卫星外壳上。那是一块强磁铁。",
      },
      {
        id: "break_bubble_axe",
        match: { verb: ["break", "hit", "cut"], noun: ["bubble", "肥皂泡", "泡"], noun2: ["axe", "斧", "斧头"] },
        triggers: ["break bubble with axe", "用斧头打破肥皂泡"],
        when: (s) => s.room === "orbit_satellite" && s.has("axe"),
        async act(s, eng) {
          s.chapter = "wabe";
          s.destroy("soap_bubble");
          eng.print("You break the bubble with the axe. You are thrown through the door at the last possible moment!\n\n你用斧头打破肥皂泡。你在最后一刻被抛出了门！");
          eng.moveTo("waterfall", true);
        },
        text: "",
      },
    ],
  },

  orbit_space: {
    name: "Earth Orbit",
    cn: "地球轨道",

    desc(s) {
      return "You are in Earth orbit. The void of space stretches in every direction.\n\n你在地球轨道上。虚空向四面八方延伸。";
    },

    onEnter(s) {
      s.chapter = "orbit";
    },

    exits() {
      return { out: "orbit_satellite" };
    },

    events: [],
  },
};
