// ═══════════════════════════════════════════════════
//  Islet — 过渡小岛  2 rooms
//  From The River (Alpha α). White door → New Mexico Desert.
// ═══════════════════════════════════════════════════

export const ROOMS = {
  islet: {
    name: "Islet",
    cn: "小岛",

    desc(s) {
      return "You are on an islet. A ferry sometimes arrives; the oarsman will take you across for a silver coin. The white door leads to the New Mexico desert and the tower.\n\n你在小岛上。渡船时而靠岸；船夫会收一枚银币载你过河。白门通向新墨西哥沙漠与高塔。";
    },

    onEnter(s) {
      s.chapter = "islet";
    },

    exits() {
      return { out: "the_river", s: "sand_bar" };
    },

    events: [
      {
        id: "enter_door_to_desert",
        match: { verb: ["enter", "go"], noun: ["door", "门", "white door", "白门"] },
        triggers: ["enter door", "穿过白门", "go through door"],
        when: (s) => s.room === "islet",
        async act(s, eng) {
          const ok = await eng.activateChapter("desert");
          if (ok) {
            s.chapter = "desert";
            eng.moveTo("shack");
          }
        },
        text: "You step through the white door. The world shifts to the New Mexico desert.\n\n你穿过白门。世界陡然一变，来到新墨西哥沙漠。",
      },
    ],
  },

  sand_bar: {
    name: "Sand Bar",
    cn: "沙洲",

    desc(s) {
      return "You are on a sand bar. A white door here leads to the New Mexico desert and the tower. North is the islet.\n\n你在沙洲上。这里的白门通向新墨西哥沙漠与高塔。北面是小岛。";
    },

    onEnter(s) {
      s.chapter = "islet";
    },

    exits() {
      return { n: "islet" };
    },

    events: [
      {
        id: "enter_door_to_desert_sb",
        match: { verb: ["enter", "go"], noun: ["door", "门", "white door", "白门"] },
        triggers: ["enter door", "穿过白门"],
        when: (s) => s.room === "sand_bar",
        async act(s, eng) {
          const ok = await eng.activateChapter("desert");
          if (ok) {
            s.chapter = "desert";
            eng.moveTo("shack");
          }
        },
        text: "You step through the white door. The world shifts to the New Mexico desert.\n\n你穿过白门。世界陡然一变，来到新墨西哥沙漠。",
      },
    ],
  },
};
