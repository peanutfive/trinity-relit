// ═══════════════════════════════════════════════════
//  Underground — 地下  3 rooms
//  From Ossuary (Pluto ♇). Need light; wight in middle; crevice/skink at west end.
//  All English text from original Infocom Trinity (1986) / walkthrough.
// ═══════════════════════════════════════════════════

function hasLight(s) {
  if (s.has("splinter")) return true;
  if (s.has("lantern") && s.hasFlag("lantern_on")) return true;
  if (s.inRoom("lantern") && s.hasFlag("lantern_dropped_middle")) return true;
  return false;
}

export const ROOMS = {

  // ─── 1. Underground (east end) ───
  underground_1: {
    name: "Underground",
    cn: "地下通道",

    desc(s) {
      return "You are in the underground, at the east end. A cylinder is here; a lantern can be taken. You will need light.\n\n你在地下通道东端。这里有一个圆筒，可取得灯笼。你需要光源。";
    },

    onEnter(s) {
      s.chapter = "underground";
      if (!s.hasFlag("underground_placed")) {
        s.placeItem("lantern", "underground_1");
        s.placeItem("walkie_talkie", "underground_2");
        s.setFlag("underground_placed");
      }
    },

    exits() {
      return { out: "ossuary", w: "underground_2" };
    },

    events: [
      {
        id: "examine_cylinder",
        match: { verb: ["examine", "look"], noun: ["cylinder", "圆筒", "筒"] },
        triggers: ["examine cylinder", "看圆筒"],
        when: (s) => s.room === "underground_1",
        text: "A metal cylinder, perhaps a container. The lantern is inside.\n\n一个金属圆筒，或许是容器。灯笼在里面。",
      },
      {
        id: "turn_on_lantern_1",
        match: { verb: ["turn"], noun: ["lantern", "灯笼", "灯"] },
        triggers: ["turn on lantern", "打开灯笼"],
        when: (s) => s.room === "underground_1" && s.has("lantern") && !s.hasFlag("lantern_on"),
        act(s) { s.setFlag("lantern_on"); },
        text: "You turn on the lantern. It casts a warm glow.\n\n你打开了灯笼。它发出温暖的光。",
      },
      {
        id: "take_lantern_underground",
        match: { verb: ["take", "get"], noun: ["lantern", "灯笼", "灯"] },
        triggers: ["take lantern", "拿灯笼"],
        when: (s) => s.room === "underground_1" && s.inRoom("lantern"),
        act(s) {
          s.take("lantern");
          if (!s.hasFlag("scored_lantern_underground")) {
            s.addScore(1);
            s.setFlag("scored_lantern_underground");
          }
        },
        text: "You take the lantern from the cylinder.\n\n你从圆筒中取出了灯笼。",
      },
    ],
  },

  // ─── 2. Underground (middle) — wight; need light to pass ───
  underground_2: {
    name: "Underground",
    cn: "地下通道",

    desc(s) {
      let d =
        "You are in the underground, in the middle. Turn on the lantern and leave it; you must get past the wight again.\n\n你在地下通道中部。打开灯笼并留下；你还得再次经过尸妖。";
      if (s.inRoom("lantern") && s.hasFlag("lantern_dropped_middle")) {
        d += "\n\nThe lit lantern is here, casting a dim glow.\n\n点着的灯笼在这里，投下微弱的光。";
      }
      if (s.inRoom("walkie_talkie")) {
        d += "\n\nA walkie-talkie is here.\n\n这里有一部对讲机。";
      }
      return d;
    },

    onEnter(s, eng) {
      if (s.room !== "underground_2") return;
      if (!hasLight(s)) {
        eng.die(
          "It is pitch black. Something cold and deadly brushes past you—the barrow wight. You have no light; it attacks. It is fatal.\n\n一片漆黑。某种冰冷致命的东西掠过你——尸妖。你没有光源；它发动了攻击。这是致命的。"
        );
      }
    },

    exits() {
      return { e: "underground_1", w: "underground_3" };
    },

    events: [
      {
        id: "turn_on_lantern",
        match: { verb: ["turn"], noun: ["lantern", "灯笼", "灯"] },
        triggers: ["turn on lantern", "打开灯笼"],
        when: (s) => s.has("lantern") && !s.hasFlag("lantern_on"),
        act(s) { s.setFlag("lantern_on"); },
        text: "You turn on the lantern. It casts a warm glow.\n\n你打开了灯笼。它发出温暖的光。",
      },
      {
        id: "drop_lantern_middle",
        match: { verb: ["drop", "put"], noun: ["lantern", "灯笼", "灯"] },
        triggers: ["drop lantern", "放下灯笼"],
        when: (s) => s.room === "underground_2" && s.has("lantern") && s.hasFlag("lantern_on"),
        act(s) {
          s.drop("lantern");
          s.setFlag("lantern_dropped_middle");
        },
        text: "You leave the lit lantern here. You can get past the wight.\n\n你把点着的灯笼留在这里。你可以通过尸妖了。",
      },
      {
        id: "take_lantern_from_middle",
        match: { verb: ["take", "get"], noun: ["lantern", "灯笼", "灯"] },
        triggers: ["take lantern", "拿灯笼"],
        when: (s) => s.room === "underground_2" && s.inRoom("lantern"),
        act(s) {
          s.take("lantern");
          s.clearFlag("lantern_dropped_middle");
        },
        text: "You take the lantern.\n\n你拿起了灯笼。",
      },
      {
        id: "take_walkie_underground",
        match: { verb: ["take", "get"], noun: ["walkie_talkie", "walkie-talkie", "walkie", "对讲机"] },
        triggers: ["take walkie-talkie", "拿对讲机"],
        when: (s) => s.room === "underground_2" && s.inRoom("walkie_talkie"),
        act(s) {
          s.take("walkie_talkie");
          if (!s.hasFlag("scored_walkie_underground")) {
            s.addScore(1);
            s.setFlag("scored_walkie_underground");
          }
        },
        text: "You take the walkie-talkie.\n\n你拿起了对讲机。",
      },
    ],
  },

  // ─── 3. Underground (west end) — crevice, splinter, skink ───
  underground_3: {
    name: "Underground",
    cn: "地下通道",

    desc(s) {
      let d =
        "You are in the underground, at the west end. A crevice is here. Put the splinter into the crevice to catch the skink; you cannot hold the skink in the birdcage.\n\n你在地下通道西端。这里有一道裂缝。将木片放入裂缝可捉到石龙子；无法把石龙子关在鸟笼里。";
      if (s.itemAt("skink") === "underground_3") {
        d += "\n\nA small skink (a type of lizard) is here.\n\n一只小石龙子（一种蜥蜴）在这里。";
      }
      return d;
    },

    onEnter(s) {
      s.chapter = "underground";
    },

    exits() {
      return { e: "underground_2" };
    },

    events: [
      {
        id: "put_splinter_into_crevice",
        match: { verb: ["put"], noun: ["splinter", "木片"], noun2: ["crevice", "裂缝", "crevice"] },
        triggers: ["put splinter into crevice", "把木片放进裂缝"],
        when: (s) => s.room === "underground_3" && s.has("splinter") && s.itemAt("skink") !== "underground_3",
        act(s) {
          s.placeItem("splinter", "crevice");
          s.placeItem("skink", "underground_3");
        },
        text: "You push the splinter into the crevice. A small skink darts out and you catch it.\n\n你把木片塞进裂缝。一只小石龙子窜了出来，你捉住了它。",
      },
      {
        id: "take_splinter_crevice_fail",
        match: { verb: ["take", "get"], noun: ["splinter", "木片"] },
        triggers: ["take splinter", "拿木片"],
        when: (s) => s.room === "underground_3" && s.itemAt("splinter") === "crevice",
        text: "You can't. The crevice is too deep.\n\n你拿不出来。裂缝太深了。",
      },
      {
        id: "take_skink_underground",
        match: { verb: ["take", "get"], noun: ["skink", "蜥蜴", "石龙子"] },
        triggers: ["take skink", "拿石龙子"],
        when: (s) => s.room === "underground_3" && s.inRoom("skink"),
        act(s) {
          s.take("skink");
          if (!s.hasFlag("scored_skink_underground")) {
            s.addScore(3);
            s.setFlag("scored_skink_underground");
          }
        },
        text: "You take the skink. It won't stay in your hand, but it likes your pocket.\n\n你捉住了石龙子。它不肯老实待在手里，但喜欢待在你口袋里。",
      },
      {
        id: "put_skink_in_pocket",
        match: { verb: ["put"], noun: ["skink", "蜥蜴", "石龙子"], noun2: ["pocket", "口袋"] },
        triggers: ["put skink in pocket", "把石龙子放进口袋"],
        when: (s) => s.has("skink"),
        act(s) { s.toPocket("skink"); },
        text: "You put the skink in your pocket. It settles in.\n\n你把石龙子放进兜里。它安顿下来了。",
      },
    ],
  },
};
