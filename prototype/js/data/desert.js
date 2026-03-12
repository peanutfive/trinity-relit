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
    exits() {
      return { w: "tower_platform", out: "crossroads" };
    },
    events: [],
  },

  tower_platform: {
    name: "Tower Platform",
    cn: "塔台",
    desc(s) {
      if (s.hasFlag("jeep_departed")) {
        return "You're on the edge of a big concrete platform. The base of the tower is below. The jeep has left to the south; you can go down safely now.\n\n你在大型混凝土平台边缘。塔底在下方。吉普车已向南离开；你现在可以安全下塔了。";
      }
      return "You're on the edge of a big concrete platform. The base of the tower is below. You cannot go down safely until you hear and see the jeep leave to the south.\n\n你在大型混凝土平台边缘。塔底在下方。在听到并看到吉普车向南离开之前，你不能安全地下塔。";
    },
    exits(s) {
      const ex = { e: "shack" };
      if (s.hasFlag("jeep_departed")) {
        ex.d = "tower_landing";
      } else {
        ex.d = {
          to: "tower_platform",
          when: () => false,
          fail: "You cannot go down safely until the jeep leaves to the south. Get in the jeep and use the radio or turn the dial to send it away.\n\n吉普车向南离开之前你不能安全下塔。进吉普车用无线电或旋钮让它开走。",
        };
      }
      return ex;
    },
    events: [],
  },

  tower_landing: {
    name: "Tower Landing",
    cn: "塔台平台",
    desc(s) {
      return "You are on the tower landing. The platform is above; the base of the tower is below.\n\n你在塔台平台上。塔台在上方；塔底在下方。";
    },
    exits() {
      return { u: "tower_platform", d: "base_of_tower" };
    },
    events: [],
  },

  base_of_tower: {
    name: "Base of Tower",
    cn: "塔底",
    desc(s) {
      return "You are at the base of the tower. The Gadget—the bomb—is above. A padlocked box is here. Roads lead away in several directions.\n\n你在塔底。核弹「小玩意」在上方。这里有一个挂锁的箱子。道路向多个方向延伸。";
    },
    exits() {
      return { u: "tower_landing", nw: "nw_of_tower", w: "west_of_tower", s: "south_of_tower", e: "east_of_tower", n: "north_of_tower", ne: "ne_of_tower", sw: "sw_of_tower", se: "crossroads" };
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
        text: "You pull the breaker.\n\n你拉下闸刀。",
      },
      {
        id: "cut_wire_finale",
        match: { verb: ["cut"], noun: ["wire", "电线"], noun2: ["red", "blue", "striped", "white", "红", "蓝", "条纹", "白"] },
        triggers: ["cut wire", "剪电线"],
        when: (s) => s.room === "base_of_tower" && s.hasFlag("breaker_pulled"),
        async act(s, eng) {
          eng.print('You cut the wire. The mysterious voice congratulates you: "This gadget would\'ve blown New Mexico right off the map if you hadn\'t stopped it." It says not to be worried about the apparent paradox you\'ve created—the time loop closes; what was done is undone and yet remembered. The next thing you know, you\'re back at the Palace Gate in Kensington Park where this whole adventure started.\n\n你剪断了电线。神秘的声音祝贺你：「若不是你阻止，这小玩意会把新墨西哥从地图上抹掉。」它说不要为你造成的明显悖论担心——时间循环闭合；既已发生又被抹去，却仍被记得。下一刻，你已回到肯辛顿公园的宫殿门——这场冒险开始的地方。');
          eng.print(`Final score: ${s.score} / ${s.maxScore}.\n\n最终分数：${s.score} / ${s.maxScore}。`);
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
    exits() {
      return { e: "base_of_tower", w: "outside_blockhouse", n: "nw_of_tower" };
    },
    events: [],
  },

  south_of_tower: {
    name: "South of Tower",
    cn: "塔南",
    desc(s) {
      if (s.hasFlag("jeep_departed")) {
        return "You are south of the tower. The jeep has left for the crossroads to the south.\n\n你在高塔南侧。吉普车已向南往十字路口方向开走。";
      }
      return "You are south of the tower. The jeep is here.\n\n你在高塔南侧。吉普车在这里。";
    },
    exits(s) {
      const ex = { n: "base_of_tower", s: "crossroads" };
      if (!s.hasFlag("jeep_departed")) ex.in = "jeep";
      return ex;
    },
    events: [],
  },

  east_of_tower: {
    name: "East of Tower",
    cn: "塔东",
    desc(s) {
      return "You are east of the tower.\n\n你在高塔东侧。";
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
    exits() {
      return { s: "base_of_tower", n: "paved_road_6" };
    },
    events: [],
  },

  ne_of_tower: {
    name: "Northeast of Tower",
    cn: "塔东北",
    desc(s) {
      return "You are northeast of the tower.\n\n你在高塔东北。";
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
    exits() {
      return { n: "south_of_tower", s: "paved_road_1", e: "east_of_tower", w: "behind_shed", nw: "base_of_tower", in: "shack" };
    },
    events: [],
  },

  paved_road_1: {
    name: "Paved Road",
    cn: "铺设道路",
    desc(s) {
      return "You are on a paved road. The tower and the ranch are in different directions.\n\n你在铺设道路上。高塔与牧场在不同方向。";
    },
    exits() {
      return { n: "paved_road_2", s: "crossroads", se: "nw_of_tower", nw: "behind_shed" };
    },
    events: [],
  },

  paved_road_2: {
    name: "Paved Road",
    cn: "铺设道路",
    desc(s) {
      return "You are on a paved road. The tower is to the south; the road continues north.\n\n你在铺设道路上。高塔在南面；道路向北延伸。";
    },
    exits() {
      return { n: "paved_road_3", s: "paved_road_1", e: "foothills_1" };
    },
    events: [],
  },

  paved_road_3: {
    name: "Paved Road",
    cn: "铺设道路",
    desc(s) {
      return "You are on a paved road. Desert and foothills lie to the east.\n\n你在铺设道路上。沙漠与山麓在东面。";
    },
    exits() {
      return { n: "paved_road_4", s: "paved_road_2" };
    },
    events: [],
  },

  paved_road_4: {
    name: "Paved Road",
    cn: "铺设道路",
    desc(s) {
      return "You are on a paved road. The landscape stretches in all directions.\n\n你在铺设道路上。地势向四周延伸。";
    },
    exits() {
      return { n: "paved_road_5", s: "paved_road_3", e: "foothills_2" };
    },
    events: [],
  },

  paved_road_5: {
    name: "Paved Road",
    cn: "铺设道路",
    desc(s) {
      return "You are on a paved road. The tower is far to the south.\n\n你在铺设道路上。高塔远在南面。";
    },
    exits() {
      return { n: "paved_road_6", s: "paved_road_4", e: "foothills_3" };
    },
    events: [],
  },

  paved_road_6: {
    name: "Paved Road",
    cn: "铺设道路",
    desc(s) {
      return "You are on a paved road. The tower is to the south; north leads to the base.\n\n你在铺设道路上。高塔在南面；向北通往塔底方向。";
    },
    exits() {
      return { n: "north_of_tower", s: "paved_road_5" };
    },
    events: [],
  },

  foothills_1: {
    name: "Foothills",
    cn: "山麓",
    desc(s) {
      return "You are in the foothills. The paved road is to the west; desert lies to the north.\n\n你在山麓。铺设道路在西面；沙漠在北面。";
    },
    exits() {
      return { w: "paved_road_2", n: "desert_1", s: "foothills_2" };
    },
    events: [],
  },

  foothills_2: {
    name: "Foothills",
    cn: "山麓",
    desc(s) {
      return "You are in the foothills. Desert stretches to the north and south.\n\n你在山麓。沙漠向北、南延伸。";
    },
    exits() {
      return { w: "paved_road_4", n: "foothills_1", s: "foothills_3", e: "desert_4" };
    },
    events: [],
  },

  foothills_3: {
    name: "Foothills",
    cn: "山麓",
    desc(s) {
      return "You are in the foothills. The desert lies to the north.\n\n你在山麓。沙漠在北面。";
    },
    exits() {
      return { w: "paved_road_5", n: "foothills_2", e: "desert_7" };
    },
    events: [],
  },

  desert_1: {
    name: "Desert",
    cn: "沙漠",
    desc(s) {
      return "You are in the desert. The foothills are to the south. The desert continues east.\n\n你在沙漠中。山麓在南面。沙漠向东延伸。";
    },
    exits() {
      return { e: "desert_2", s: "foothills_1" };
    },
    events: [],
  },

  desert_2: {
    name: "Desert",
    cn: "沙漠",
    desc(s) {
      return "You are in the desert. Sand and scrub stretch in all directions.\n\n你在沙漠中。沙地与灌木向四周延伸。";
    },
    exits() {
      return { e: "desert_3", w: "desert_1" };
    },
    events: [],
  },

  desert_3: {
    name: "Desert",
    cn: "沙漠",
    desc(s) {
      return "You are in the desert. The tower is a distant landmark to the southwest.\n\n你在沙漠中。高塔在西南方远处。";
    },
    exits() {
      return { e: "desert_4", w: "desert_2" };
    },
    events: [],
  },

  desert_4: {
    name: "Desert",
    cn: "沙漠",
    desc(s) {
      return "You are in the desert. Foothills lie to the south.\n\n你在沙漠中。山麓在南面。";
    },
    exits() {
      return { e: "desert_5", w: "desert_3", s: "foothills_2" };
    },
    events: [],
  },

  desert_5: {
    name: "Desert",
    cn: "沙漠",
    desc(s) {
      return "You are in the desert. A shallow crater is visible to the east.\n\n你在沙漠中。东面可见一处浅坑。";
    },
    exits() {
      return { e: "shallow_crater", w: "desert_4" };
    },
    events: [],
  },

  desert_6: {
    name: "Desert",
    cn: "沙漠",
    desc(s) {
      return "You are in the desert. Sand and wind dominate the landscape.\n\n你在沙漠中。沙与风主宰着这片土地。";
    },
    exits() {
      return { e: "desert_7", w: "shallow_crater" };
    },
    events: [],
  },

  desert_7: {
    name: "Desert",
    cn: "沙漠",
    desc(s) {
      return "You are in the desert. The foothills are to the south.\n\n你在沙漠中。山麓在南面。";
    },
    exits() {
      return { e: "desert_8", w: "desert_6", s: "foothills_3" };
    },
    events: [],
  },

  desert_8: {
    name: "Desert",
    cn: "沙漠",
    desc(s) {
      return "You are in the desert. The desert continues east and west.\n\n你在沙漠中。沙漠向东、西延伸。";
    },
    exits() {
      return { e: "desert_9", w: "desert_7" };
    },
    events: [],
  },

  desert_9: {
    name: "Desert",
    cn: "沙漠",
    desc(s) {
      return "You are in the desert at the eastern edge of the test site. The desert stretches west.\n\n你在试验场东缘的沙漠中。沙漠向西延伸。";
    },
    exits() {
      return { w: "desert_8" };
    },
    events: [],
  },

  shallow_crater: {
    name: "Shallow Crater",
    cn: "浅坑",
    desc(s) {
      return "You are in a shallow crater. The desert lies to the west and east.\n\n你在浅坑中。沙漠在西面与东面。";
    },
    exits() {
      return { w: "desert_5", e: "desert_6" };
    },
    events: [],
  },

  outside_blockhouse: {
    name: "Outside Blockhouse",
    cn: "碉堡外",
    desc(s) {
      return "You are outside the blockhouse. The tower is to the east.\n\n你在碉堡外。高塔在东面。";
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
    exits(s) {
      return {
        e: "crossroads",
        n: "paved_road_1",
        s: {
          to: "nw_ranch",
          when: () => true,
          text: "You head south toward the McDonald Ranch.\n\n你向南朝麦克唐纳牧场走去。",
          async act(s2, eng) {
            await eng.transitionChapter({ to: "ranch", roomCandidates: ["nw_ranch"] });
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
    exits() {
      return { out: "south_of_tower" };
    },
    events: [
      {
        id: "jeep_use_radio",
        match: { verb: ["use", "turn", "operate"], noun: ["radio", "无线电", "dial", "旋钮"] },
        triggers: ["use radio", "turn dial", "用无线电", "拧旋钮"],
        when: (s) => s.room === "jeep" && !s.hasFlag("jeep_departed"),
        act(s, eng) {
          s.setFlag("jeep_departed");
          eng.print("You turn the dial. The engine starts; the jeep drives away to the south. You jump out at the last moment.\n\n你拧动旋钮。引擎发动，吉普车向南开去。你在最后一刻跳下了车。");
          eng.moveTo("south_of_tower");
        },
        text: "",
      },
    ],
  },
};
