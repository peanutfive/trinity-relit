// ═══════════════════════════════════════════════════
//  McDonald Ranch — 主线  骨架（关键房间）
//  Entry from Desert (behind_shed → nw_ranch). Assembly Room = Gadget core.
// ═══════════════════════════════════════════════════

export const ROOMS = {

  nw_ranch: {
    name: "Northwest of Ranch",
    cn: "牧场西北",
    desc(s) {
      return "You are northwest of the McDonald Ranch. A gate is here. The ranch house lies to the southeast.\n\n你在麦克唐纳牧场西北。这里有一扇门。牧场主宅在东南。";
    },
    onEnter(s) {
      s.chapter = "ranch";
    },
    exits(s) {
      return {
        n: {
          to: "behind_shed",
          when: () => true,
          text: "You head north back toward the desert.\n\n你向北返回沙漠。",
          async act(s2, eng) {
            const ok = await eng.activateChapter("desert");
            if (ok) s2.chapter = "desert";
          },
        },
        se: "front_yard",
      };
    },
    events: [],
  },

  front_yard: {
    name: "Front Yard",
    cn: "前院",
    desc(s) {
      return "You are in the front yard of the McDonald Ranch. The hallway is inside.\n\n你在麦克唐纳牧场前院。走廊在室内。";
    },
    onEnter(s) {
      s.chapter = "ranch";
    },
    exits() {
      return { nw: "nw_ranch", in: "hallway", w: "sw_yard", e: "ne_yard" };
    },
    events: [],
  },

  hallway: {
    name: "Hallway",
    cn: "走廊",
    desc(s) {
      return "You are in the hallway of the ranch house. Rooms lead off in several directions. The assembly room is to the east.\n\n你在牧场主宅的走廊里。房间向多个方向延伸。组装室在东面。";
    },
    onEnter(s) {
      s.chapter = "ranch";
    },
    exits() {
      return { n: "nw_ranch", e: "assembly_room", w: "kitchen", s: "spare_room", nw: "nw_room", se: "se_room" };
    },
    events: [],
  },

  assembly_room: {
    name: "Assembly Room",
    cn: "组装室",
    desc(s) {
      return "You are in the assembly room. This is where the core of the Gadget was assembled. A workbench is here. A rattlesnake is here; caution is fatal. The closet is to the north.\n\n你在组装室。这里曾组装「小玩意」的核心。有一张工作台。一条响尾蛇在此；小心致命。壁橱在北面。";
    },
    onEnter(s) {
      s.chapter = "ranch";
    },
    exits() {
      return { w: "hallway", n: "closet", e: "front_yard" };
    },
    events: [],
  },

  closet: {
    name: "Closet",
    cn: "壁橱",
    desc(s) {
      return "You are in the closet. Close the door and open the cage—the lemming will leave. Then open the door; the snake kills the lemming. Drop the cage and return south.\n\n你在壁橱里。关上门，打开笼子——旅鼠会离开。然后打开门；蛇会杀死旅鼠。放下笼子，向南返回。";
    },
    onEnter(s) {
      s.chapter = "ranch";
    },
    exits() {
      return { s: "assembly_room" };
    },
    events: [],
  },

  kitchen: {
    name: "Kitchen",
    cn: "厨房",
    desc(s) {
      return "You are in the kitchen. A knife is here. The hallway is to the east.\n\n你在厨房。这里有一把刀。走廊在东面。";
    },
    onEnter(s) {
      s.chapter = "ranch";
    },
    exits() {
      return { e: "hallway", n: "assembly_room" };
    },
    events: [],
  },

  spare_room: {
    name: "Spare Room",
    cn: "备用房间",
    desc(s) {
      return "You are in a spare room.\n\n你在备用房间里。";
    },
    onEnter(s) {
      s.chapter = "ranch";
    },
    exits() {
      return { n: "hallway" };
    },
    events: [],
  },

  nw_room: {
    name: "Northwest Room",
    cn: "西北房间",
    desc(s) {
      return "You are in the northwest room.\n\n你在西北房间。";
    },
    onEnter(s) {
      s.chapter = "ranch";
    },
    exits() {
      return { se: "hallway" };
    },
    events: [],
  },

  se_room: {
    name: "Southeast Room",
    cn: "东南房间",
    desc(s) {
      return "You are in the southeast room.\n\n你在东南房间。";
    },
    onEnter(s) {
      s.chapter = "ranch";
    },
    exits() {
      return { nw: "hallway" };
    },
    events: [],
  },

  sw_yard: {
    name: "Southwest Yard",
    cn: "西南院子",
    desc(s) {
      return "You are in the southwest yard. The front yard is to the east.\n\n你在西南院子。前院在东面。";
    },
    onEnter(s) {
      s.chapter = "ranch";
    },
    exits() {
      return { e: "front_yard" };
    },
    events: [],
  },

  ne_yard: {
    name: "Northeast Yard",
    cn: "东北院子",
    desc(s) {
      return "You are in the northeast yard. The front yard is to the west.\n\n你在东北院子。前院在西面。";
    },
    onEnter(s) {
      s.chapter = "ranch";
    },
    exits() {
      return { w: "front_yard" };
    },
    events: [],
  },

  back_yard: {
    name: "Back Yard",
    cn: "后院",
    desc(s) {
      return "You are in the back yard. The reservoir is to the south.\n\n你在后院。水库在南面。";
    },
    onEnter(s) {
      s.chapter = "ranch";
    },
    exits() {
      return { s: "north_reservoir", n: "hallway" };
    },
    events: [],
  },

  north_reservoir: {
    name: "North of Reservoir",
    cn: "水库北",
    desc(s) {
      return "You are north of the reservoir. The edge of the reservoir is to the south.\n\n你在水库北侧。水库边缘在南面。";
    },
    onEnter(s) {
      s.chapter = "ranch";
    },
    exits() {
      return { n: "back_yard", s: "edge_reservoir" };
    },
    events: [],
  },

  edge_reservoir: {
    name: "Edge of Reservoir",
    cn: "水库边缘",
    desc(s) {
      return "You are at the edge of the reservoir. You can dive in. The windmill is to the north.\n\n你在水库边缘。你可以潜入水中。风车在北面。";
    },
    onEnter(s) {
      s.chapter = "ranch";
    },
    exits() {
      return { n: "north_reservoir", d: "reservoir", u: "windmill" };
    },
    events: [],
  },

  reservoir: {
    name: "Reservoir",
    cn: "水库",
    desc(s) {
      return "You are in the reservoir. Underwater is below.\n\n你在水库中。水下在下方。";
    },
    onEnter(s) {
      s.chapter = "ranch";
    },
    exits() {
      return { u: "edge_reservoir", d: "underwater" };
    },
    events: [],
  },

  underwater: {
    name: "Underwater",
    cn: "水下",
    desc(s) {
      return "It is normally totally dark here underwater, but the lantern lets you see. Binoculars are here.\n\n水下通常一片漆黑，但灯笼让你能看见。这里有一副望远镜。";
    },
    onEnter(s) {
      s.chapter = "ranch";
    },
    exits() {
      return { u: "reservoir" };
    },
    events: [],
  },

  windmill: {
    name: "Windmill",
    cn: "风车",
    desc(s) {
      return "You are at the windmill. The edge of the reservoir is below.\n\n你在风车处。水库边缘在下方。";
    },
    onEnter(s) {
      s.chapter = "ranch";
    },
    exits() {
      return { d: "edge_reservoir" };
    },
    events: [],
  },
};
