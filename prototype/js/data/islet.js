// ═══════════════════════════════════════════════════
//  Islet — 过渡小岛  2 rooms
//  From The River (Alpha α) via ferry. White door → New Mexico Desert.
//  All English text from original Infocom Trinity (1986).
// ═══════════════════════════════════════════════════

export const ROOMS = {
  islet: {
    name: "Islet",
    cn: "小岛",

    desc(s) {
      let d = "It's impossible to see more than a dozen yards on this fogbound islet. The damp air makes your footsteps sound unnaturally loud as you trudge across the sand at the river's edge.\n\n" +
        "在这座雾霭笼罩的小岛上，你无法看清十几码以外。潮湿的空气让你踩在河边沙地上的脚步声显得异常响亮。\n\n";
      d += "A lone toadstool grows here.\n\n一株孤零零的毒菌生长在这里。\n\n";
      d += "At first glance, this isolated spit seems hopelessly mired in the fog blowing in off the surrounding river. But the sand looks a bit firmer to the north.\n\n";
      d += "乍看之下，这片孤立的沙嘴似乎无可救药地困在从周围河面吹来的雾气中。但北面的沙地看起来更坚实一些。";
      return d;
    },

    exits() {
      return { n: "sand_bar" };
    },

    events: [
      {
        id: "enter_door_to_desert",
        match: { verb: ["enter", "go"], noun: ["door", "门", "white door", "白门"] },
        triggers: ["enter door", "go through door", "进入白门"],
        when: (s) => s.room === "islet",
        async act(s, eng) {
          s.setFlag("islet_done");
          eng.print("You step through the white door...\n\n你穿过白门...");
          await eng.transitionChapter({ to: "desert", roomCandidates: ["shallow_crater"] });
        },
        text: "",
      },
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
    ],
  },

  sand_bar: {
    name: "Sand Bar",
    cn: "沙洲",

    desc(s) {
      return "The sand bar extends into the foggy river. The white door to New Mexico Desert is here. The oarsman's dory arrives here.\n\n" +
        "沙洲延伸进雾蒙蒙的河面。通往新墨西哥沙漠的白门就在这里。船夫的平底船在此靠岸。";
    },

    exits(s) {
      const ex = { s: "islet" };
      if (s.hasFlag("ferry_paid")) {
        ex.out = {
          to: "the_river",
          when: () => true,
          async act(s2, eng) {
            eng.print("You board the dory. The oarsman rows you back across the river.\n\n你登上平底船。船夫把你划回彼岸。");
            await eng.transitionChapter({ to: "wabe", roomCandidates: ["the_river"] });
          },
          text: "",
        };
      }
      return ex;
    },

    events: [
      {
        id: "enter_door_to_desert_sb",
        match: { verb: ["enter", "go"], noun: ["door", "门", "white door", "白门"] },
        triggers: ["enter door", "go through door", "进入白门"],
        when: (s) => s.room === "sand_bar",
        async act(s, eng) {
          s.setFlag("islet_done");
          eng.print("You step through the white door...\n\n你穿过白门...");
          await eng.transitionChapter({ to: "desert", roomCandidates: ["shallow_crater"] });
        },
        text: "",
      },
      {
        id: "give_coin_to_oarsman_sb",
        match: { verb: ["give", "hand", "pay"], noun: ["silver_coin", "silver coin", "银币", "coin"], noun2: ["oarsman", "ferryman", "船夫"] },
        triggers: ["give silver coin to oarsman", "付银币给船夫", "pay oarsman"],
        when: (s) => (s.room === "islet" || s.room === "sand_bar") && s.has("silver_coin") && !s.hasFlag("ferry_paid"),
        act(s) {
          s.placeItem("silver_coin", "destroyed");
          s.setFlag("ferry_paid");
        },
        text: "The oarsman takes the silver coin and nods. You may cross when the door is open.\n\n船夫收下银币，点了点头。门开时你可以过河。",
      },
    ],
  },
};
