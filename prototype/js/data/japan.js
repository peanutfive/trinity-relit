// ═══════════════════════════════════════════════════
//  Japanese Playground — 广岛  2 rooms
//  From Moor (Mars ♂). Paper crane puzzle; return via white door to Moor.
//  All English text from original Infocom Trinity (1986) / walkthrough.
// ═══════════════════════════════════════════════════

export const ROOMS = {

  // ─── 1. Playground（游乐场） ───
  playground: {
    name: "Playground",
    cn: "游乐场",

    desc(s) {
      return "You are in a playground, in a sandpile. Children and teachers are here. Do not go north toward the children or south toward the teachers—discovery would be fatal.\n\n你在游乐场的沙堆里。孩子们和老师们在这里。不要向北走向孩子或向南走向老师——被发现将是致命的。";
    },

    onEnter(s) {
      s.chapter = "japan";
      if (!s.hasFlag("japan_spade_placed")) {
        s.placeItem("spade", "shelter");
        s.setFlag("japan_spade_placed");
      }
    },

    exits(s) {
      const ex = {
        e: "shelter",
        out: "moor",
        in: "shelter",
        n: {
          to: "playground",
          when: () => true,
          act(s2, eng) {
            eng.die(
              "You walk toward the children. Your presence is noticed. The teachers rush over; your intrusion has been discovered. It is fatal.\n\n你走向孩子们。你被发现了。老师们冲了过来；你的闯入暴露了。这是致命的。"
            );
          },
        },
        s: {
          to: "playground",
          when: () => true,
          act(s2, eng) {
            eng.die(
              "You walk toward the teachers. Your presence is noticed. Discovery would be fatal.\n\n你走向老师们。你被发现了。被发现将是致命的。"
            );
          },
        },
      };
      return ex;
    },

    onWait(s, eng) {
      if (s.room !== "playground") return;
      if (!s.hasFlag("girl_found_playground")) {
        s.setFlag("girl_found_playground");
        eng.print(
          "A girl notices you and approaches cautiously.\n\n一个女孩注意到了你，小心翼翼地走了过来。"
        );
      }
    },

    events: [
      {
        id: "give_umbrella_to_girl",
        match: { verb: ["give", "hand"], noun: ["umbrella", "伞", "雨伞"], noun2: ["girl", "女孩"] },
        triggers: ["give umbrella to girl", "把雨伞给女孩", "给女孩雨伞"],
        when: (s) => s.room === "playground" && s.hasFlag("girl_found_playground") && s.has("umbrella"),
        act(s, eng) {
          s.placeItem("umbrella", "destroyed");
          s.setFlag("umbrella_given_to_girl");
        },
        text: "She takes the umbrella and goes into the Shelter.\n\n她接过雨伞，走进了避难所。",
      },
      {
        id: "ride_bird",
        match: { verb: ["ride", "mount", "board"], noun: ["paper_bird", "bird", "paper bird", "纸鸟", "纸鹤"] },
        triggers: ["ride bird", "骑纸鸟", "ride the paper bird"],
        when: (s) => s.room === "playground" && s.has("paper_bird"),
        async act(s, eng) {
          eng.print(
            "The paper bird enlarges to the size of a car!\n\n纸鸟变得像汽车一样大！"
          );
          eng.print(
            "You climb onto the giant paper bird. It carries you up and away. You pass through the white door and find yourself back on the Moor.\n\n你爬上巨大的纸鸟。它载着你飞起、远去。你穿过白门，回到了荒野上。"
          );
          s.chapter = "wabe";
          eng.moveTo("moor", true);
        },
        text: "",
      },
      {
        id: "enter_door_to_moor",
        match: { verb: ["enter", "go"], noun: ["door", "门", "white door", "白门"] },
        triggers: ["enter door", "go through door", "进门", "穿过白门"],
        when: (s) => s.room === "playground",
        act(s, eng) {
          s.chapter = "wabe";
          eng.moveTo("moor");
        },
        text: "You step through the white door. The world shifts. You are back on the Moor.\n\n你穿过白门。世界陡然一变。你回到了荒野。",
      },
    ],
  },

  // ─── 2. Shelter（避难所） ───
  shelter: {
    name: "Shelter",
    cn: "避难所",

    desc(s) {
      let d =
        "You are in a shelter. A spade is here. A girl may take your umbrella or paper here.\n\n你在避难所内。这里有一把铲子。一位女孩可能会在这里收下你的雨伞或纸。";
      if (s.hasFlag("umbrella_given_to_girl")) {
        d += "\n\nThe girl is here with the umbrella.\n\n女孩在这里，拿着那把雨伞。";
      }
      return d;
    },

    exits() {
      return { out: "playground", w: "playground" };
    },

    events: [
      {
        id: "take_spade_shelter",
        match: { verb: ["take", "get"], noun: ["spade", "铲子", "铲"] },
        triggers: ["take spade", "拿铲子", "get spade"],
        when: (s) => s.room === "shelter" && s.inRoom("spade"),
        act(s) {
          s.take("spade");
          if (!s.hasFlag("scored_spade_japan")) {
            s.addScore(1);
            s.setFlag("scored_spade_japan");
          }
        },
        text: "You take the spade.\n\n你拿起了铲子。",
      },
      {
        id: "give_paper_to_girl",
        match: { verb: ["give", "hand"], noun: ["paper_bird", "paper", "纸鸟", "纸", "纸鹤"], noun2: ["girl", "女孩"] },
        triggers: ["give paper to girl", "给女孩纸", "give paper bird to girl"],
        when: (s) =>
          s.room === "shelter" &&
          s.has("paper_bird") &&
          s.hasFlag("bird_unfolded"),
        act(s) {
          s.clearFlag("bird_unfolded");
          if (!s.hasFlag("scored_paper_to_girl")) {
            s.addScore(3);
            s.setFlag("scored_paper_to_girl");
          }
        },
        text: "She refolds the paper into a crane and hands it back to you. You have a paper bird again.\n\n她把纸重新折成鹤，递还给你。你又有了纸鸟。",
      },
    ],
  },
};
