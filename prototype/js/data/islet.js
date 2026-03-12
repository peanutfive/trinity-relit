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
        id: "give_coin_to_oarsman_islet",
        match: { verb: ["give", "hand", "pay"], noun: ["silver_coin", "silver coin", "银币", "coin"], noun2: ["oarsman", "ferryman", "船夫"] },
        triggers: ["give silver coin to oarsman", "付银币给船夫", "pay oarsman"],
        when: (s) => (s.room === "islet" || s.room === "sand_bar") && s.has("silver_coin") && !s.hasFlag("ferry_paid"),
        act(s) {
          s.placeItem("silver_coin", "destroyed");
          s.setFlag("ferry_paid");
        },
        text: "The oarsman takes the silver coin and nods. You may cross when the door is open.\n\n船夫收下银币，点了点头。门开时你可以过河。",
      },
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
        id: "give_coin_to_oarsman_sb",
        match: { verb: ["give", "hand", "pay"], noun: ["silver_coin", "silver coin", "银币", "coin"], noun2: ["oarsman", "ferryman", "船夫"] },
        triggers: ["give silver coin to oarsman", "付银币给船夫"],
        when: (s) => s.room === "sand_bar" && s.has("silver_coin") && !s.hasFlag("ferry_paid"),
        act(s) {
          s.placeItem("silver_coin", "destroyed");
          s.setFlag("ferry_paid");
        },
        text: "The oarsman takes the silver coin and nods. You may cross when the door is open.\n\n船夫收下银币，点了点头。门开时你可以过河。",
      },
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
