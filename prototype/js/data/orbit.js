// ═══════════════════════════════════════════════════
//  Earth Orbit — 地球轨道  2 rooms
//  From Waterfall (Mercury ☿) via mushroom door. Need soap bubble.
//  Zero gravity: all exits conditional. Return via white door (break bubble with axe).
//  All English text from original Infocom Trinity (1986).
// ═══════════════════════════════════════════════════

// Zero-gravity: any direction floats between satellite and space
const FLOAT_TO_SPACE = {
  n: "orbit_space", ne: "orbit_space", e: "orbit_space", se: "orbit_space",
  s: "orbit_space", sw: "orbit_space", w: "orbit_space", nw: "orbit_space",
  up: "orbit_space", down: "orbit_space", in: "orbit_space",
};

const FLOAT_TO_SATELLITE = {
  n: "orbit_satellite", ne: "orbit_satellite", e: "orbit_satellite", se: "orbit_satellite",
  s: "orbit_satellite", sw: "orbit_satellite", w: "orbit_satellite", nw: "orbit_satellite",
  up: "orbit_satellite", down: "orbit_satellite", out: "orbit_satellite",
};

export const ROOMS = {

  // ─── 1. Earth Orbit! on a satellite — Z-machine obj #124 ───
  orbit_satellite: {
    name: "Earth Orbit! on a satellite",
    cn: "地球轨道·卫星上",

    desc(s) {
      return "You are in Earth orbit, on a satellite. The cold of space surrounds you. You arrived inside the soap bubble; remember the magpie's clue about the crescent moon.\n\n" +
        "你在地球轨道上，在一颗卫星上。太空的寒冷包围着你。你是乘肥皂泡来的；记得喜鹊关于新月之光的提示。";
    },

    onEnter(s) {},

    exits(s) {
      const ex = {};
      for (const [dir, to] of Object.entries(FLOAT_TO_SPACE)) {
        ex[dir] = {
          to,
          when: () => true,
          text: "The space around you articulates. You float in that direction.\n\n你周围的空间发出了关节般的声响。你向那个方向飘去。",
        };
      }
      ex.out = {
        to: "waterfall",
        when: (s2) => s2.has("axe"),
        fail: "You need the axe to break the soap bubble and escape through the white door.\n\n你需要用斧头打破肥皂泡才能通过白门逃脱。",
        act(s2, eng) {
          s2.destroy("soap_bubble");
          s2.chapter = "wabe";
        },
        text: "You break the bubble with the axe. You are thrown through the door at the last possible moment!\n\n你用斧头打破肥皂泡。你在最后一刻被抛出了门！",
      };
      return ex;
    },

    events: [
      {
        id: "examine_satellite",
        match: { verb: ["examine", "look"], noun: ["satellite", "卫星", "卫星体", "hull"] },
        triggers: ["examine satellite", "看卫星", "examine hull"],
        when: (s) => s.room === "orbit_satellite" && s.has("lump"),
        act(s) {
          s.placeItem("lump", "orbit_satellite");
        },
        text: "The lump attaches itself to the hull of the satellite. It is a powerful magnet.\n\n那块金属牢牢吸在卫星外壳上。那是一块强磁铁。",
      },
      {
        id: "break_bubble_axe",
        match: { verb: ["break", "hit", "cut", "pop"], noun: ["bubble", "肥皂泡", "泡", "soap bubble"], noun2: ["axe", "斧", "斧头"] },
        triggers: ["break bubble with axe", "用斧头打破肥皂泡", "hit bubble with axe"],
        when: (s) => s.room === "orbit_satellite" && s.has("axe"),
        async act(s, eng) {
          s.destroy("soap_bubble");
          eng.print("You break the bubble with the axe. You are thrown through the door at the last possible moment!\n\n你用斧头打破肥皂泡。你在最后一刻被抛出了门！");
          await eng.transitionChapter({ to: "wabe", roomCandidates: ["waterfall"] });
        },
        text: "",
      },
    ],
  },

  // ─── 2. Earth Orbit (floating in space) — Z-machine obj #425 ───
  orbit_space: {
    name: "Earth Orbit",
    cn: "地球轨道",

    desc(s) {
      return "You are in Earth orbit. The void of space stretches in every direction. The satellite is firm in the vacuum of space.\n\n" +
        "你在地球轨道上。虚空向四面八方延伸。卫星在太空的真空中稳固地悬浮着。";
    },

    onEnter(s) {},

    exits(s) {
      const ex = {};
      for (const [dir, to] of Object.entries(FLOAT_TO_SATELLITE)) {
        ex[dir] = {
          to,
          when: () => true,
          text: "The space around you articulates. You float in that direction.\n\n你周围的空间发出了关节般的声响。你向那个方向飘去。",
        };
      }
      return ex;
    },

    events: [],
  },
};
