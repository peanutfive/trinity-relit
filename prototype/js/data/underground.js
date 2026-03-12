// ═══════════════════════════════════════════════════
//  Underground — 地下  3 rooms
//  From Ossuary (Pluto ♇) via mushroom door. Nuclear test site.
//  All English text from original Infocom Trinity (1986).
// ═══════════════════════════════════════════════════

function hasLight(s) {
  if (s.has("splinter")) return true;
  if (s.has("lantern") && s.hasFlag("lantern_on")) return true;
  if (s.inRoom("lantern") && s.hasFlag("lantern_dropped_middle")) return true;
  return false;
}

export const ROOMS = {

  // ─── 1. Underground (first chamber) — obj #30 ───
  underground_1: {
    name: "Underground",
    cn: "地下",

    desc(s) {
      return "You're in a vast underground cavern. A crevice and a landslide are here.\n\n" +
        "你身处一个巨大的地下洞穴。这里有一道裂缝和一处滑坡。";
    },

    onEnter(s, eng) {
      if (!s.hasFlag("underground_items_placed")) {
        s.setFlag("underground_items_placed");
        s.placeItem("lantern", "underground_3");
        s.placeItem("walkie_talkie", "underground_2");
      }
    },

    exits(s) {
      return {
        e: "underground_2",
        out: "underground_2",
        w: {
          to: "ossuary",
          when: () => true,
          act(s2, eng) {
            s2.chapter = "wabe";
          },
          text: "You step through the white door back to the Ossuary.\n\n你穿过白门回到纳骨堂。",
        },
      };
    },

    events: [
      {
        id: "examine_crevice",
        match: { verb: ["examine", "look"], noun: ["crevice", "裂缝"] },
        triggers: ["examine crevice", "看裂缝"],
        when: (s) => s.room === "underground_1",
        text: "A deep crevice in the rock. You can't see the bottom.\n\n岩石中的一道深裂缝。你看不到底。",
      },
      {
        id: "examine_landslide",
        match: { verb: ["examine", "look"], noun: ["landslide", "滑坡"] },
        triggers: ["examine landslide", "看滑坡"],
        when: (s) => s.room === "underground_1",
        text: "A pile of rubble from a collapsed section of the tunnel.\n\n隧道坍塌处的一堆碎石。",
      },
    ],
  },

  // ─── 2. Underground (middle chamber) — obj #87 ───
  underground_2: {
    name: "Underground",
    cn: "地下",

    desc(s) {
      let d = "The walls of this underground chamber are cool and clammy to your touch.\n\n" +
        "这座地下洞穴的墙壁摸上去冰凉而潮湿。";
      if (s.inRoom("walkie_talkie")) {
        d += "\n\nA walkie-talkie is here.\n\n这里有一部对讲机。";
      }
      if (s.inRoom("lantern") && s.hasFlag("lantern_dropped_middle")) {
        d += "\n\nThe lit lantern is here, casting a dim glow.\n\n点着的灯笼在这里，投下微弱的光。";
      }
      return d;
    },

    onEnter(s, eng) {
      if (s.room !== "underground_2") return;
      if (!hasLight(s)) {
        eng.die(
          "It is pitch black. Something cold and deadly brushes past you—the barrow wight. You have no light; it attacks. It is fatal.\n\n" +
          "一片漆黑。某种冰冷致命的东西掠过你——尸妖。你没有光源；它发动了攻击。这是致命的。"
        );
      }
    },

    exits() {
      return { e: "underground_3", w: "underground_1", in: "underground_1" };
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

  // ─── 3. Underground (inner chamber) — obj #131 ───
  underground_3: {
    name: "Underground",
    cn: "地下",

    desc(s) {
      let d = "You're in a narrow underground chamber, illuminated by lantern light. A metal cylinder is here; the lantern can be taken from it.\n\n" +
        "你身处一个狭窄的地下洞穴，被灯笼照亮。这里有一个金属圆筒；可以从里面取出灯笼。";
      if (s.inRoom("lantern")) {
        d += "\n\nThe lantern is here.\n\n灯笼在这里。";
      }
      return d;
    },

    onEnter(s) {},

    exits(s) {
      return {
        w: "underground_2",
        e: {
          to: "underground_3",
          when: () => false,
          fail: "You can't go that way.\n\n你无法往那个方向走。",
        },
        in: {
          to: "underground_3",
          when: () => false,
          fail: "You can't go that way.\n\n你无法往那个方向走。",
        },
      };
    },

    events: [
      {
        id: "examine_cylinder",
        match: { verb: ["examine", "look"], noun: ["cylinder", "圆筒", "筒"] },
        triggers: ["examine cylinder", "看圆筒"],
        when: (s) => s.room === "underground_3",
        text: "A metal cylinder, perhaps a container. The lantern is inside.\n\n一个金属圆筒，或许是容器。灯笼在里面。",
      },
      {
        id: "turn_on_lantern_3",
        match: { verb: ["turn"], noun: ["lantern", "灯笼", "灯"] },
        triggers: ["turn on lantern", "打开灯笼"],
        when: (s) => s.room === "underground_3" && s.has("lantern") && !s.hasFlag("lantern_on"),
        act(s) { s.setFlag("lantern_on"); },
        text: "You turn on the lantern. It casts a warm glow.\n\n你打开了灯笼。它发出温暖的光。",
      },
      {
        id: "take_lantern_underground",
        match: { verb: ["take", "get"], noun: ["lantern", "灯笼", "灯"] },
        triggers: ["take lantern", "拿灯笼"],
        when: (s) => s.room === "underground_3" && s.inRoom("lantern"),
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
};
