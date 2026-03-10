// ═══════════════════════════════════════════════════
//  New Mexico Desert + Tower — 主线  骨架（关键房间）
//  Entry from Islet (white door → shack). Tower = Trinity Test; link to Ranch & Finale.
// ═══════════════════════════════════════════════════

export const ROOMS = {

  shack: {
    name: "Shack",
    cn: "小屋",
    desc(s) {
      return "You are in a shack at the edge of the desert. The tower is in the distance. A paperback book, a light bulb with chain, and a screwed panel are here.\n\n你在沙漠边缘的小屋里。高塔在远处。这里有一本平装书、一只带链子的灯泡和一块拧上的面板。";
    },
    onEnter(s) {
      s.chapter = "desert";
    },
    exits() {
      return { w: "tower_platform", out: "crossroads" };
    },
    events: [],
  },

  tower_platform: {
    name: "Tower Platform",
    cn: "塔台",
    desc(s) {
      return "You are on the tower platform. The base of the tower is below. You cannot go down safely until you hear and see the jeep leave to the south.\n\n你在塔台上。塔底在下方。在听到并看到吉普车向南离开之前，你不能安全地下塔。";
    },
    onEnter(s) {
      s.chapter = "desert";
    },
    exits() {
      return { d: "base_of_tower", e: "shack" };
    },
    events: [],
  },

  base_of_tower: {
    name: "Base of Tower",
    cn: "塔底",
    desc(s) {
      return "You are at the base of the tower. The Gadget—the bomb—is above. A padlocked box is here. Roads lead away in several directions.\n\n你在塔底。核弹「小玩意」在上方。这里有一个挂锁的箱子。道路向多个方向延伸。";
    },
    onEnter(s) {
      s.chapter = "desert";
    },
    exits() {
      return { u: "tower_platform", nw: "nw_of_tower", w: "west_of_tower", s: "south_of_tower", e: "east_of_tower", n: "north_of_tower", ne: "ne_of_tower", sw: "sw_of_tower", se: "crossroads" };
    },
    events: [
      {
        id: "pull_breaker",
        match: { verb: ["pull", "flip"], noun: ["breaker", "闸", "开关"] },
        triggers: ["pull breaker", "拉闸"],
        when: (s) => s.room === "base_of_tower",
        act(s) {
          s.setFlag("breaker_pulled");
        },
        text: "You pull the breaker. Note which line is mentioned over the walkie-talkie. You had better close it again immediately or you will be caught.\n\n你拉下闸刀。注意对讲机里提到哪条线。你最好立刻再合上，否则会被发现。",
      },
      {
        id: "cut_wire_finale",
        match: { verb: ["cut"], noun: ["wire", "电线"], noun2: ["red", "blue", "striped", "white", "红", "蓝", "条纹", "白"] },
        triggers: ["cut wire", "剪电线"],
        when: (s) => s.room === "base_of_tower" && s.hasFlag("breaker_pulled"),
        async act(s, eng) {
          eng.print("You cut the wire. The mysterious voice congratulates you, and says not to be worried about the apparent paradox you've created. The next thing you know, you're back at the Palace Gate in Kensington Park where this whole adventure started.\n\n你剪断了电线。神秘的声音祝贺你，并说不要为你造成的明显悖论担心。下一刻，你已回到肯辛顿公园的宫殿门——这场冒险开始的地方。");
          await eng.transitionChapter({ to: "prologue", roomCandidates: ["palace_gate"] });
        },
        text: "",
      },
    ],
  },

  nw_of_tower: {
    name: "Northwest of Tower",
    cn: "塔西北",
    desc(s) {
      return "You are northwest of the tower. The desert stretches away.\n\n你在高塔西北。沙漠向远处延伸。";
    },
    onEnter(s) {
      s.chapter = "desert";
    },
    exits() {
      return { se: "base_of_tower", nw: "paved_road_1", w: "west_of_tower" };
    },
    events: [],
  },

  west_of_tower: {
    name: "West of Tower",
    cn: "塔西",
    desc(s) {
      return "You are west of the tower.\n\n你在高塔西侧。";
    },
    onEnter(s) {
      s.chapter = "desert";
    },
    exits() {
      return { e: "base_of_tower", w: "outside_blockhouse", n: "nw_of_tower" };
    },
    events: [],
  },

  south_of_tower: {
    name: "South of Tower",
    cn: "塔南",
    desc(s) {
      return "You are south of the tower. The jeep is here.\n\n你在高塔南侧。吉普车在这里。";
    },
    onEnter(s) {
      s.chapter = "desert";
    },
    exits() {
      return { n: "base_of_tower", s: "crossroads", in: "jeep" };
    },
    events: [],
  },

  east_of_tower: {
    name: "East of Tower",
    cn: "塔东",
    desc(s) {
      return "You are east of the tower.\n\n你在高塔东侧。";
    },
    onEnter(s) {
      s.chapter = "desert";
    },
    exits() {
      return { w: "base_of_tower", e: "crossroads" };
    },
    events: [],
  },

  north_of_tower: {
    name: "North of Tower",
    cn: "塔北",
    desc(s) {
      return "You are north of the tower.\n\n你在高塔北侧。";
    },
    onEnter(s) {
      s.chapter = "desert";
    },
    exits() {
      return { s: "base_of_tower", n: "paved_road_1" };
    },
    events: [],
  },

  ne_of_tower: {
    name: "Northeast of Tower",
    cn: "塔东北",
    desc(s) {
      return "You are northeast of the tower.\n\n你在高塔东北。";
    },
    onEnter(s) {
      s.chapter = "desert";
    },
    exits() {
      return { sw: "base_of_tower", ne: "paved_road_1" };
    },
    events: [],
  },

  sw_of_tower: {
    name: "Southwest of Tower",
    cn: "塔西南",
    desc(s) {
      return "You are southwest of the tower.\n\n你在高塔西南。";
    },
    onEnter(s) {
      s.chapter = "desert";
    },
    exits() {
      return { ne: "base_of_tower", sw: "outside_blockhouse" };
    },
    events: [],
  },

  crossroads: {
    name: "Crossroads",
    cn: "十字路口",
    desc(s) {
      return "You are at a crossroads. Roads run north-south and east-west. The tower is to the northwest. The ranch lies to the southwest.\n\n你在十字路口。道路南北、东西延伸。高塔在西北，牧场在西南。";
    },
    onEnter(s) {
      s.chapter = "desert";
    },
    exits() {
      return { n: "south_of_tower", s: "paved_road_1", e: "east_of_tower", w: "behind_shed", in: "shack" };
    },
    events: [],
  },

  paved_road_1: {
    name: "Paved Road",
    cn: "铺设道路",
    desc(s) {
      return "You are on a paved road. The tower and the ranch are in different directions.\n\n你在铺设道路上。高塔与牧场在不同方向。";
    },
    onEnter(s) {
      s.chapter = "desert";
    },
    exits() {
      return { n: "north_of_tower", s: "crossroads", se: "nw_of_tower", nw: "behind_shed" };
    },
    events: [],
  },

  outside_blockhouse: {
    name: "Outside Blockhouse",
    cn: "碉堡外",
    desc(s) {
      return "You are outside the blockhouse. The tower is to the east.\n\n你在碉堡外。高塔在东面。";
    },
    onEnter(s) {
      s.chapter = "desert";
    },
    exits() {
      return { e: "west_of_tower", w: "sw_of_tower" };
    },
    events: [],
  },

  behind_shed: {
    name: "Behind the Shed",
    cn: "棚屋后",
    desc(s) {
      return "You are behind the shed. A thin man stands here. The crossroads are to the east. To the south you can head toward the ranch.\n\n你在棚屋后面。一个瘦削的男人站在这里。十字路口在东面。向南可前往牧场。";
    },
    onEnter(s) {
      s.chapter = "desert";
    },
    exits(s) {
      return {
        e: "crossroads",
        n: "paved_road_1",
        s: {
          to: "nw_ranch",
          when: () => true,
          text: "You head south toward the McDonald Ranch.\n\n你向南朝麦克唐纳牧场走去。",
          async act(s2, eng) {
            const ok = await eng.activateChapter("ranch");
            if (ok) s2.chapter = "ranch";
          },
        },
      };
    },
    events: [],
  },

  jeep: {
    name: "Jeep",
    cn: "吉普车内",
    desc(s) {
      return "You are inside the jeep. A radio and a dial are here. A wallet with a photo of a familiar-looking boy holding a wand is here.\n\n你在吉普车内。这里有无线电和旋钮。还有一个皮夹，里面有一张熟悉的男孩拿着魔杖的照片。";
    },
    onEnter(s) {
      s.chapter = "desert";
    },
    exits() {
      return { out: "south_of_tower" };
    },
    events: [],
  },
};
