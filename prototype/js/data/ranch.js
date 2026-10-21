// ═══════════════════════════════════════════════════
//  McDonald Ranch — 原有 26 个 ID 不变，另补原版 Front Deck (#6)。
//  未映射的 Desert / Foothills 边界列在 prototype/RANCH_REWRITE_GAPS.md。
// ═══════════════════════════════════════════════════

import { wetItems } from "../item-rules.js";
import { drownCage, drownRoadrunner, initializeAnimals } from "../animal-rules.js";

// 阻挡原文均来自 TRINITY.DAT 的字符串或无条件出口例程。
// 虚拟目标只让引擎走 fail 分支；静态出口检查忽略指向自身的目标。
const FAIL_TEXT = {
  in_ambiguous: "[Which way do you want to go in?]\n\n[你想从哪边进去？]",
  out_ambiguous: "[Which way do you want to go out?]\n\n[你想从哪边出去？]",
  wall: "The stone wall blocks your path.\n\n石墙挡住了去路。",
  reservoir_wall: "The reservoir blocks your path.\n\n水库挡住了去路。",
  no_entrance: "There's no entrance that way.\n\n那边没有入口。",
  closet_end: "You're in the closet as far as you can go.\n\n你在壁橱里已经走到尽头。",
  no_entrances: "There aren't any entrances here.\n\n这里没有入口。",
  underwater_wall: "You hit your head against the side of the reservoir.\n\n你的头撞上了水库侧壁。",
  underwater_bottom: "You're already at the bottom of the reservoir.\n\n你已经在水库底部。",
  reservoir_only_south: "The only way out is to the south.\n\n唯一的出口在南边。",
  reservoir_edge: "You'd fall over the edge of the reservoir if you went that way.\n\n那样走会从蓄水池边缘跌落。",
  broken_landing: "The landing overhead is broken. You can't climb up to it anymore.\n\n头顶的平台已经损坏。你再也无法爬上去了。",
};
function blocked(room, reason) {
  return {
    to: room, when: () => false, fail: FAIL_TEXT[reason],
    // UNDER-WATER 的 SORRY 出口不执行 CLOCKER（fresh 场景 reservoir_walls）。
    ...(room === "underwater" ? { advancesTurn: false } : {}),
  };
}

// Release 12 / 860926：I-MILL、SPILL-MILL、I-HOLD-BREATH。
// 只使用可序列化的计数/标志；不占用其他章节的单个 state.timer。
function landingBroken(s) {
  return s.hasFlag("ranch_landing_collapsed") || s.hasFlag("binoculars_broken");
}

function spillMill(s, eng) {
  s.setFlag("ranch_landing_collapsed");
  s.setCnt("ranch_landing_life", 0);
  // SPILL-MILL 转移空袋内容；普通 INTO-RESERVOIR 不做该转移。
  wetItems(s, { mode: "mill" });
  if (["inventory", "windmill"].includes(s.itemAt("cage"))) drownCage(s);
  drownRoadrunner(s, "inventory");
  drownRoadrunner(s, "windmill");
  for (const { id, loc } of s.inventoryList()) {
    if (loc === "inventory") s.placeItem(id, "underwater");
  }
  for (const id of s.roomItems()) s.placeItem(id, "underwater");
  if (s.cnt("ranch_breath_remaining") > 0) s.setCnt("ranch_breath_remaining", 1);
  eng.print("CRACK! The landing tips wildly under your feet. You manage a brief, hysterical shriek...\n\n咔嚓！平台在你脚下猛烈倾斜。你勉强发出一声短促、歇斯底里的尖叫……\n\n... and your mouth fills with water.\n\n……接着，水灌进了你的嘴里。");
  eng.moveTo("reservoir");
}

function startMill(s) {
  if (!s.hasFlag("ranch_landing_started")) {
    s.setFlag("ranch_landing_started");
    s.setCnt("ranch_landing_life", 4);
    // 原版新入队的 I-MILL 位于已有屏息回调之前；屏息以后重新入队
    // 会复用原来的槽位，不因新一次 hold 调换两者次序。仅记录本批两回调。
    if (s.cnt("ranch_breath_remaining") > 0) s.setFlag("ranch_mill_before_breath");
  }
}

function millTick(s, eng) {
  if (landingBroken(s)) return;
  // 旧存档可能已在平台上，恢复不会重放 onEnter。
  startMill(s);
  const life = s.cnt("ranch_landing_life") - 1;
  s.setCnt("ranch_landing_life", life);
  if (life <= 0) { spillMill(s, eng); return; }
  const warnings = {
    3: "The landing creaks under your weight. It isn't in very good shape.\n\n平台在你的重量下吱呀作响。它的状况很不好。",
    2: "The landing emits a wooden moan of discomfort.\n\n平台发出木头不堪重负的呻吟。",
    1: "The landing is sagging dangerously. It's not going to last much longer!\n\n平台危险地下垂着。它撑不了多久了！",
  };
  eng.print(warnings[life]);
}

function breathTick(s, eng) {
  const remaining = s.cnt("ranch_breath_remaining");
  if (remaining <= 0) return;
  s.setCnt("ranch_breath_remaining", remaining - 1);
  if (remaining === 2) {
    eng.print("You can't hold your breath much longer.\n\n你无法再屏息多久了。");
  } else if (remaining === 1) {
    if (s.room === "underwater") {
      eng.print("You claw your way to the surface as your breath gives out.\n\n气息耗尽时，你拼命划向水面。");
      eng.moveTo("reservoir");
    } else {
      eng.print("With an involuntary gasp, you begin to breathe normally.\n\n你不由自主地吸了一口气，开始正常呼吸。");
    }
  }
}

function breathWait(s) {
  if (s.cnt("ranch_breath_remaining") <= 0) return;
  return {
    handled: true, maxTurns: 3,
    stopAfterTurn: (state) => state.cnt("ranch_breath_remaining") <= 1,
  };
}

function enterReservoir(s) {
  wetItems(s, { mode: "enter" });
  if (s.carrying("cage")) drownCage(s);
}

function dive(s, eng) {
  if (s.carrying("cage")) drownCage(s);
  if (s.cnt("ranch_breath_remaining") <= 0) {
    s.setCnt("ranch_breath_remaining", 4);
    eng.print("[holding your breath first]\n\n[先屏住呼吸]");
  }
  eng.print("You sink below the surface.\n\n你沉入水面之下。");
}

function surface(s, eng) {
  s.setCnt("ranch_breath_remaining", 0);
  eng.print("You rise to the surface, gasping for air.\n\n你浮到水面，大口喘气。");
}

// 原版 6 字节门出口先检查 #26/#39 的 open 属性，再送往目标房间。
function deckDoor(target, flag, side) {
  return {
    to: target,
    when: (s) => s.hasFlag(flag),
    fail: `The ${side} door is closed.\n\n${side === "left" ? "左" : "右"}边的门关着。`,
  };
}

// R12 NEROOM-F / I-SNAKE: leaving Assembly resets its warning window.
function snakeVisible(s) {
  return !s.hasFlag("snake_gone") && (s.room === "assembly_room" ||
    (s.room === "closet" && !s.hasFlag("closet_door_closed")));
}
function startSnake(s, eng) {
  if (s.hasFlag("snake_gone") || s.hasFlag("snake_started")) return;
  s.setFlag("snake_started");
  s.setCnt("snake_delay", 1);
  eng.print("You turn to face an urgent noise behind you. Your heart skips a beat. Two tiny eyes, bright with hunger, black with menace, are glaring at you from only a few feet away.\n\n你转身面对身后急促的声响，心头一紧。几英尺外，两只小眼睛正瞪着你，闪着饥饿的光，透着阴森的威胁。\n\nYou hear the noise again. It's like a pebble in an empty can.\n\n你又听到了那声音，像一颗小石子在空罐里晃动。");
}
function retreatSnake(s, eng) {
  if (!s.hasFlag("snake_started") || s.hasFlag("snake_gone")) return;
  s.setCnt("snake_delay", 1);
  eng.print("You beat a hasty retreat from the rattlesnake.\n\n你急忙从响尾蛇身边退开。");
}
function consumeLemming(s) {
  s.destroy("lemming");
  const a = initializeAnimals(s).lemming;
  a.active = false; a.grace = 0;
  s.setFlag("snake_gone");
  s.clearFlag("lemming_loose_in_closet");
  if (!s.hasFlag("snake_lemming_scored")) {
    s.setFlag("snake_lemming_scored"); s.addScore(3);
  }
}
const SNAKE_LUNCH_TAIL = "scrambles through the open closet door, straight into the fangs of the rattlesnake.\n\nThe lemming twitches for a while as the venom takes effect. Then the snake drags its prize across the floor, shakes its tail once for effect and slithers out of sight.";
const SNAKE_LUNCH_CN = "窜过敞开的壁橱门，直奔响尾蛇的毒牙。\n\n毒液开始发作，旅鼠抽搐了一阵。随后蛇将猎物拖过地板，炫耀似地摇了一下尾巴，滑出了视野。";
function releasedInCloset(s, eng, id) {
  if (id !== "lemming" || !snakeVisible(s)) return null;
  consumeLemming(s);
  return { en: ". Then it " + SNAKE_LUNCH_TAIL, cn: "随后，它" + SNAKE_LUNCH_CN };
}
function snakeTick(s, eng) {
  if (s.hasFlag("snake_gone")) return;
  if (s.room === "assembly_room") startSnake(s, eng);
  if (!s.hasFlag("snake_started")) return;
  if (!snakeVisible(s)) { s.setCnt("snake_delay", 1); return; }
  if (s.cnt("snake_delay") > 0) {
    s.setCnt("snake_delay", 0);
    const where = s.room === "closet" ? " lurks just outside the open door" : " rears its wedge-shaped head";
    eng.print("The rattlesnake" + where + ". It looks as if it's about to strike!\n\n响尾蛇" +
      (s.room === "closet" ? "潜伏在敞开的门外" : "昂起楔形的头") + "，看起来就要扑过来了！");
  } else {
    s.setFlag("snake_gone");
    s.setFlag("snake_bitten");
    s.setCnt("snake_bite_turn", s.turns);
    eng.print("The rattlesnake strikes your ankle like lightning, recoils in an instant and slithers out of sight.\n\n响尾蛇闪电般咬住你的脚踝，瞬间缩回身子，滑出了视野。\n\nSobbing with pain and shock, you peer at the tender wound. It's already beginning to swell.\n\n你痛苦而惊恐地啜泣，低头查看柔嫩的伤口。它已经开始肿起来了。");
    return;
  }
  if (s.itemAt("lemming") === "closet" && s.room === "closet") {
    consumeLemming(s);
    const en = ("The lemming " + SNAKE_LUNCH_TAIL).split("\n\n");
    const cn = ("旅鼠" + SNAKE_LUNCH_CN).split("\n\n");
    eng.print(en.flatMap((paragraph, index) => [paragraph, cn[index]]).join("\n\n"));
  }
}
function closetLight(s, eng) {
  return !s.hasFlag("closet_door_closed") || (eng ? eng.isVisible("splinter") :
    s.carrying("splinter") || s.inRoom("splinter"));
}
function closetDoor(target, retreat = false, closed = false) {
  return { to: target, when: s => !s.hasFlag("closet_door_closed"), advancesTurn: !closed,
    fail: "The closet door is closed.\n\n壁橱门关着。",
    ...(retreat ? { act: retreatSnake } : {}),
  };
}
function closetDoorEvents(room) {
  return [
    { id: room + "_close_closet_door", match: { verb: ["close"], noun: ["door", "closet door", "门", "壁橱门"] },
      triggers: ["close closet door", "关上壁橱门"], when: s => s.room === room,
      act(s, eng) {
        if (s.hasFlag("closet_door_closed")) eng.print("It's already closed.\n\n它已经关上了。");
        else { s.setFlag("closet_door_closed"); eng.print("You close the closet door.\n\n你关上了壁橱的门。");
          if (room === "closet" && !closetLight(s, eng)) eng.print("It's completely dark.\n\n这里一片漆黑。"); }
      }, text: "" },
    { id: room + "_open_closet_door", match: { verb: ["open"], noun: ["door", "closet door", "门", "壁橱门"] },
      triggers: ["open closet door", "打开壁橱门"], when: s => s.room === room,
      act(s, eng) {
        if (!s.hasFlag("closet_door_closed")) eng.print("It's already open.\n\n它已经打开了。");
        else { s.clearFlag("closet_door_closed"); eng.print("You open the closet door.\n\n你打开了壁橱的门。"); }
      }, text: "" },
  ];
}
function snakeEvents(room) {
  const nouns = ["snake", "rattlesnake", "rattler", "蛇", "响尾蛇"];
  return [
    { id: room + "_snake_gone", match: { verb: ["examine", "listen", "take", "hit", "kill"], noun: nouns },
      when: s => s.room === room && s.hasFlag("snake_gone"), advancesTurn: false,
      text: "The rattlesnake isn't here anymore.\n\n响尾蛇已经不在这里了。" },
    { id: room + "_snake_behind_door", match: { verb: ["examine", "listen", "take", "hit", "kill"], noun: nouns },
      when: s => s.room === room && room === "closet" && s.hasFlag("closet_door_closed"), advancesTurn: false,
      text: "Luckily, the rattlesnake is on the other side of the closet door.\n\n幸好，响尾蛇在壁橱门的另一边。" },
    { id: room + "_examine_snake", match: { verb: ["examine"], noun: nouns }, when: s => s.room === room,
      text: "All you can see are those tiny black eyes, glaring.\n\n你只能看见那双瞪着你的小黑眼睛。" },
    { id: room + "_listen_snake", match: { verb: ["listen"], noun: nouns }, when: s => s.room === room,
      text: "You hear the noise again. It's like a pebble in an empty can.\n\n你又听到了那声音，像一颗小石子在空罐里晃动。" },
    { id: room + "_take_snake", match: { verb: ["take"], noun: nouns }, when: s => s.room === room,
      text: "You reach out to grasp the angry reptile.\n\n你伸出手去抓这条愤怒的爬行动物。" },
    { id: room + "_hit_snake", match: { verb: ["hit", "kill"], noun: nouns }, when: s => s.room === room,
      act(s, eng, cmd) {
        if (cmd?.noun2) {
          const tool = eng.matchingItemIds(cmd.noun2).find(id => s.has(id));
          if (!tool || !s.has(tool)) { eng.ui.system("你没有拿着指定的工具。"); return; }
          const name = eng.itemProperty(tool, "en");
          if (!name) { eng.ui.system("你举起工具，准备出击。"); return; }
          eng.print(`You draw closer to the rattlesnake, ${name} poised to strike.\n\n你举起${eng.items[tool].cn}，向响尾蛇靠近，准备出击。`);
        } else eng.print("You draw closer to the rattlesnake, your hand poised to strike.\n\n你向响尾蛇靠近，举手准备出击。");
      }, text: "" },
  ];
}

export const ROOMS = {

  nw_ranch: {
    name: "Northwest of Ranch",
    cn: "牧场西北",
    onTurn(s, eng) {
      if (s.room !== "nw_ranch") return;
      breathTick(s, eng);
    },
    onWait: breathWait,
    desc(s) {
      return "You're at the northwest corner of a stone wall. A closed iron gate leads in to a dilapidated ranch house.\n\n你来到一堵石墙的西北角。一扇关闭的铁门通向破败的牧场屋内。\n\nA paved road bears northwest into the desert. Other paths curve east and south, along the wall's perimeter.\n\n一条铺设道路向西北延伸进入沙漠。其他小路沿墙的外围向东和南蜿蜒。";
    },
    exits() {
      return {
        e: "ne_ranch",
        se: "back_yard",
        s: "sw_ranch",
        nw: {
          to: "shallow_crater", when: () => true,
          async act(s2, eng) {
            if (await eng.transitionChapter({ to: "desert", roomCandidates: ["shallow_crater"] })) {
              s2.setCnt("ranch_breath_remaining", 0);
            }
          },
        },
        in: "back_yard",
        n: {
          to: "behind_shed", when: () => true,
          async act(s2, eng) {
            if (await eng.transitionChapter({ to: "desert", roomCandidates: ["behind_shed"] })) {
              s2.setCnt("ranch_breath_remaining", 0);
            }
          },
        },
      };
    },
    events: [],
  },

  front_yard: {
    name: "Front Yard",
    cn: "前院",
    onTurn(s, eng) {
      if (s.room !== "front_yard") return;
      breathTick(s, eng);
    },
    onWait: breathWait,
    desc(s) {
      return "This patch of ground lies between the ranch house to the west, and a huge cement reservoir to the east. Well-worn paths curve north and south, around the stone wall enclosing the house. Other trails skirt the reservoir on either side.\n\n这片地位于西面的牧场屋和东面的巨大水泥蓄水池之间。踩踏已久的小径沿围住房屋的石墙向南北两侧弯去。其他小路沿蓄水池两边延伸。\n\nA ramp slopes up through a gap in the stone wall, ending on a raised deck.\n\n一道斜坡穿过石墙的缺口向上，通到一处高起的平台。";
    },
    exits() {
      return {
        n: "ne_ranch",
        ne: "north_reservoir",
        se: "south_reservoir",
        s: "se_ranch",
        e: blocked("front_yard", "reservoir_wall"),
        sw: blocked("front_yard", "wall"),
        nw: blocked("front_yard", "wall"),
        w: { to: "front_deck", text: "You ascend the ramp.\n\n你走上斜坡。" },
        u: { to: "front_deck", text: "You ascend the ramp.\n\n你走上斜坡。" },
        in: { to: "front_deck", text: "You ascend the ramp.\n\n你走上斜坡。" },
      };
    },
    events: [],
  },

  front_deck: {
    name: "Front Deck",
    cn: "前平台",
    onTurn(s, eng) {
      if (s.room !== "front_deck") return;
      breathTick(s, eng);
    },
    onWait: breathWait,
    desc(s) {
      const left = s.hasFlag("front_deck_left_door_open");
      const right = s.hasFlag("front_deck_right_door_open");
      const en = "You're on a raised deck attached to the east side of the ranch house. Two " +
        (left && right ? "open " : !left && !right ? "closed " : "") +
        "doors, " + (left === right ? "" : `a${left ? "n open" : " closed"} `) +
        "one at the deck's left corner and " +
        (left === right ? "" : `a${right ? "n open" : " closed"} `) +
        "one at the right, lead inside. A gentle ramp slopes down to the front yard.";
      const cn = "你站在牧场屋东侧的一处高起的平台上。两扇" +
        (left && right ? "敞开的" : !left && !right ? "关闭的" : "") +
        "门，一扇在平台左角" + (left === right ? "" : left ? "，开着" : "，关着") +
        "，另一扇在右边" + (left === right ? "" : right ? "，开着" : "，关着") +
        "，通往屋内。一道平缓的斜坡通向下面的前院。";
      return en + "\n\n" + cn;
    },
    exits(s) {
      const left = s.hasFlag("front_deck_left_door_open");
      const right = s.hasFlag("front_deck_right_door_open");
      const inside = {
        to: left ? "se_room" : "assembly_room",
        when: () => left !== right,
        fail: left && right
          ? "[Which way do you want to go in, northwest or southwest?]\n\n[你想从哪边进去，西北还是西南？]"
          : "Both of the doors are closed.\n\n两扇门都关着。",
        text: "You step inside the ranch house.\n\n你走进牧场屋。",
      };
      return {
        n: { to: "ne_yard", text: "You climb off the deck.\n\n你从平台上下来。" },
        ne: blocked("front_deck", "wall"),
        e: { to: "front_yard", text: "You descend the ramp.\n\n你走下斜坡。" },
        se: blocked("front_deck", "wall"),
        s: { to: "se_yard", text: "You climb off the deck.\n\n你从平台上下来。" },
        sw: deckDoor("se_room", "front_deck_left_door_open", "left"),
        w: inside,
        nw: deckDoor("assembly_room", "front_deck_right_door_open", "right"),
        d: { to: "front_yard", text: "You descend the ramp.\n\n你走下斜坡。" },
        in: inside,
      };
    },
    events: [
      {
        id: "front_deck_open_left_door",
        match: { verb: ["open"], noun: ["left door", "左门", "左边的门"] },
        when: (s) => s.room === "front_deck" && !s.hasFlag("front_deck_left_door_open"),
        act(s) { s.setFlag("front_deck_left_door_open"); },
        text: "You open the left door.\n\n你打开左边的门。",
      },
      {
        id: "front_deck_close_left_door",
        match: { verb: ["close"], noun: ["left door", "左门", "左边的门"] },
        when: (s) => s.room === "front_deck" && s.hasFlag("front_deck_left_door_open"),
        act(s) { s.clearFlag("front_deck_left_door_open"); },
        text: "You close the left door.\n\n你关上左边的门。",
      },
      {
        id: "front_deck_open_right_door",
        match: { verb: ["open"], noun: ["right door", "右门", "右边的门"] },
        when: (s) => s.room === "front_deck" && !s.hasFlag("front_deck_right_door_open"),
        act(s) { s.setFlag("front_deck_right_door_open"); },
        text: "You open the right door.\n\n你打开右边的门。",
      },
      {
        id: "front_deck_close_right_door",
        match: { verb: ["close"], noun: ["right door", "右门", "右边的门"] },
        when: (s) => s.room === "front_deck" && s.hasFlag("front_deck_right_door_open"),
        act(s) { s.clearFlag("front_deck_right_door_open"); },
        text: "You close the right door.\n\n你关上右边的门。",
      },
    ],
  },

  hallway: {
    name: "Hallway",
    cn: "走廊",
    onTurn(s, eng) {
      if (s.room !== "hallway") return;
      breathTick(s, eng);
    },
    onWait: breathWait,
    desc(s) {
      return "This short hallway opens outdoors to the north and south. A" + (s.hasFlag("ranch_outer_door_open") ? "n open" : " closed") + " outer door leads east into a kitchen. Turning west, you see a stairway descending into darkness.\n\n这条短走廊向南北两侧通往户外。一扇" + (s.hasFlag("ranch_outer_door_open") ? "敞开" : "关闭") + "的外门向东通往厨房。转向西面，可以看到一道通入黑暗的楼梯。";
    },
    exits() {
      return {
        n: "back_yard",
        e: "kitchen",
        s: "sw_yard",
        w: "icehouse",
        d: "icehouse",
        in: blocked("hallway", "in_ambiguous"),
        out: blocked("hallway", "out_ambiguous"),
      };
    },
    events: [],
  },

  assembly_room: {
    name: "Assembly Room",
    cn: "组装室",
    onEnter: startSnake,
    onTurn(s, eng) {
      if (s.room !== "assembly_room") return;
      snakeTick(s, eng);
      breathTick(s, eng);
    },
    onWait: breathWait,
    desc(s) {
      const closed = s.hasFlag("closet_door_closed");
      const frontOpen = s.hasFlag("front_deck_right_door_open");
      const en = "Whoever used this room was paranoid about dirt. The floor is swept spotless, and the edges of both windows are carefully sealed with tape. A" +
        (frontOpen ? "n open" : " closed") + " front door leads east, and there's a" +
        (closed ? " closed" : "n open closet") + " door in the north wall. Other exits lead south and west.";
      const cn = "曾使用这间房的人对灰尘近乎偏执。地板被扫得一尘不染，两扇窗的边缘都仔细贴了胶带。一扇" +
        (frontOpen ? "敞开的" : "关闭的") + "前门向东，北墙上还有一扇" +
        (closed ? "关闭的门" : "敞开的壁橱门") + "。其他出口通往南面和西面。";
      return en + "\n\n" + cn;
    },
    exits(s) {
      return {
        n: closetDoor("closet", true, s.hasFlag("closet_door_closed")),
        e: { to: "front_deck", advancesTurn: s.hasFlag("front_deck_right_door_open"), when: s => s.hasFlag("front_deck_right_door_open"), fail: "The front door is closed.\n\n前门关着。", act: retreatSnake },
        s: { to: "se_room", act: retreatSnake },
        w: { to: "nw_room", act: retreatSnake },
        in: blocked("assembly_room", "in_ambiguous"),
        out: blocked("assembly_room", "out_ambiguous"),
      };
    },
    events: [
      {
        id: "assembly_open_front_door",
        match: { verb: ["open"], noun: ["front door", "前门"] },
        when: (s) => s.room === "assembly_room" && !s.hasFlag("front_deck_right_door_open"),
        act(s) { s.setFlag("front_deck_right_door_open"); },
        text: "You open the front door.\n\n你打开前门。",
      },
      {
        id: "assembly_close_front_door",
        match: { verb: ["close"], noun: ["front door", "前门"] },
        when: (s) => s.room === "assembly_room" && s.hasFlag("front_deck_right_door_open"),
        act(s) { s.clearFlag("front_deck_right_door_open"); },
        text: "You close the front door.\n\n你关上前门。",
      },
      ...closetDoorEvents("assembly_room"),
      ...snakeEvents("assembly_room"),
    ],
  },

  closet: {
    name: "Closet",
    cn: "壁橱",
    animalLight: closetLight,
    onAnimalReleased: releasedInCloset,
    onTurn(s, eng) {
      if (s.room !== "closet") return;
      snakeTick(s, eng);
      breathTick(s, eng);
    },
    onWait: breathWait,
    desc(s, eng) {
      if (!closetLight(s, eng)) return "It's completely dark.\n\n这里一片漆黑。";
      const closed = s.hasFlag("closet_door_closed");
      return `There's barely enough room to turn around in this puny closet. Its single ${closed ? "closed" : "open"} door is in the south wall.\n\n这个小壁橱仅容你勉强转身。唯一一扇${closed ? "关闭" : "敞开"}的门位于南墙。`;
    },
    exits(s) {
      return {
        s: closetDoor("assembly_room", false, s.hasFlag("closet_door_closed")),
        out: closetDoor("assembly_room", false, s.hasFlag("closet_door_closed")),
        in: blocked("closet", "closet_end"),
      };
    },
    events: [...closetDoorEvents("closet"), ...snakeEvents("closet")],
  },

  kitchen: {
    name: "Kitchen",
    cn: "厨房",
    onTurn(s, eng) {
      if (s.room !== "kitchen") return;
      breathTick(s, eng);
    },
    onWait: breathWait,
    desc(s) {
      // 原版 GET_CHILD(cupboard) 非空时由 13d98 输出清单；当前物品层
      // 没有 cupboard 容器，只有显式放在该位置的刀可还原单物品分支。
      const hasKnife = s.itemAt("knife") === "cupboard";
      const en = "Disconnected stove pipes and an open cupboard" +
        (hasKnife ? " with a steak knife in it" : "") +
        " are the only evidence of this room's identity. A" +
        (s.hasFlag("ranch_outer_door_open") ? "n open" : " closed") + " outer door in the west wall leads out to a hallway. Other exits lead north and east.";
      const cn = "拆开的炉管和一个敞开的橱柜" +
        (hasKnife ? "，里面有一把牛排刀，" : "") +
        "是这间房用途仅存的线索。西墙上一扇" + (s.hasFlag("ranch_outer_door_open") ? "敞开" : "关闭") + "的外门通往走廊。其他出口通往北面和东面。";
      return en + "\n\n" + cn;
    },
    exits() {
      return {
        n: "nw_room",
        e: "se_room",
        w: "hallway",
        in: blocked("kitchen", "in_ambiguous"),
        out: blocked("kitchen", "out_ambiguous"),
      };
    },
    events: [],
  },

  spare_room: {
    name: "Spare Room",
    cn: "备用房间",
    onTurn(s, eng) {
      if (s.room !== "spare_room") return;
      breathTick(s, eng);
    },
    onWait: breathWait,
    desc(s) {
      return "Aside from a" + (s.hasFlag("ranch_screen_door_open") ? "n open" : " closed") + " screen door to the west, this squarish room offers no amenities. Other exits lead north and east.\n\n除了西面一扇" + (s.hasFlag("ranch_screen_door_open") ? "敞开" : "关闭") + "的纱门，这间方形房间没有任何设施。其他出口通往北面和东面。";
    },
    exits() {
      return {
        n: "bathroom",
        e: "bedroom",
        s: "nw_room",
        w: "back_yard",
        in: blocked("spare_room", "in_ambiguous"),
        out: blocked("spare_room", "out_ambiguous"),
      };
    },
    events: [],
  },

  nw_room: {
    name: "Northwest Room",
    cn: "西北房间",
    onTurn(s, eng) {
      if (s.room !== "nw_room") return;
      breathTick(s, eng);
    },
    onWait: breathWait,
    desc(s) {
      return "The original purpose of this stark room is uncertain; it might have been used for dining. Exits lead north, south and east.\n\n这间空荡房间原本的用途并不明确；它也许曾用作餐厅。出口通往北、南、东三个方向。";
    },
    exits() {
      return {
        n: "spare_room",
        e: "assembly_room",
        s: "kitchen",
        in: blocked("nw_room", "in_ambiguous"),
        out: blocked("nw_room", "out_ambiguous"),
      };
    },
    events: [],
  },

  se_room: {
    name: "Southeast Room",
    cn: "东南房间",
    onTurn(s, eng) {
      if (s.room !== "se_room") return;
      breathTick(s, eng);
    },
    onWait: breathWait,
    desc(s) {
      const open = s.hasFlag("front_deck_left_door_open");
      return "Something about this room gives you the impression that it was hastily vacated. The front door in the east wall is " +
        (open ? "wide open" : "closed") + ". Other exits lead north and west.\n\n这间房给人一种匆忙撤离的感觉。东墙上的前门" +
        (open ? "敞开着" : "关着") + "。其他出口通往北面和西面。";
    },
    exits() {
      return {
        n: "assembly_room",
        e: "front_deck",
        w: "kitchen",
        in: blocked("se_room", "in_ambiguous"),
        out: blocked("se_room", "out_ambiguous"),
      };
    },
    events: [
      {
        id: "se_room_open_front_door",
        match: { verb: ["open"], noun: ["front door", "前门", "door", "门"] },
        when: (s) => s.room === "se_room" && !s.hasFlag("front_deck_left_door_open"),
        act(s) { s.setFlag("front_deck_left_door_open"); },
        text: "You open the front door.\n\n你打开前门。",
      },
      {
        id: "se_room_close_front_door",
        match: { verb: ["close"], noun: ["front door", "前门", "door", "门"] },
        when: (s) => s.room === "se_room" && s.hasFlag("front_deck_left_door_open"),
        act(s) { s.clearFlag("front_deck_left_door_open"); },
        text: "You close the front door.\n\n你关上前门。",
      },
    ],
  },

  sw_yard: {
    name: "Southwest Yard",
    cn: "西南院子",
    onTurn(s, eng) {
      if (s.room !== "sw_yard") return;
      breathTick(s, eng);
    },
    onWait: breathWait,
    desc(s) {
      return "This is the southwest corner of the ranch house, just inside the stone wall. A hallway opens north into the house, and a closed iron gate in the wall leads southwest.\n\n这里是牧场屋的西南角，就在石墙里面。一条走廊向北进入屋内，墙上的一扇关闭的铁门通往西南。";
    },
    exits() {
      return {
        e: "se_yard",
        sw: "sw_ranch",
        out: "sw_ranch",
        n: "hallway",
        in: "hallway",
        ne: blocked("sw_yard", "no_entrance"),
        se: blocked("sw_yard", "wall"),
        s: blocked("sw_yard", "wall"),
        w: blocked("sw_yard", "wall"),
        nw: blocked("sw_yard", "wall"),
      };
    },
    events: [],
  },

  ne_yard: {
    name: "Northeast Yard",
    cn: "东北院子",
    onTurn(s, eng) {
      if (s.room !== "ne_yard") return;
      breathTick(s, eng);
    },
    onWait: breathWait,
    desc(s) {
      return "There aren't any openings in this corner of the stone wall. A raised deck stands immediately to the south, and a" + (s.hasFlag("ranch_outside_door_open") ? "n open" : " closed") + " outside door leads west, into the ranch.\n\n石墙这一角没有开口。南边紧挨着一处高起的平台，一扇" + (s.hasFlag("ranch_outside_door_open") ? "敞开" : "关闭") + "的外门向西通往牧场屋内。";
    },
    exits() {
      return {
        w: "bedroom",
        in: "bedroom",
        s: { to: "front_deck", text: "You stride onto the deck.\n\n你大步走上平台。" },
        u: { to: "front_deck", text: "You stride onto the deck.\n\n你大步走上平台。" },
        n: blocked("ne_yard", "wall"),
        ne: blocked("ne_yard", "wall"),
        e: blocked("ne_yard", "wall"),
        se: blocked("ne_yard", "wall"),
        sw: blocked("ne_yard", "no_entrance"),
        nw: blocked("ne_yard", "wall"),
      };
    },
    events: [],
  },

  back_yard: {
    name: "Back Yard",
    cn: "后院",
    onTurn(s, eng) {
      if (s.room !== "back_yard") return;
      breathTick(s, eng);
    },
    onWait: breathWait,
    desc(s) {
      return "This patch of dust lies within the elbow of the ranch house, and is enclosed by a stone wall to the north and west.\n\n这片尘土位于牧场屋的转角内，北面和西面被石墙围住。\n\nAn open hallway leads south, into the house. There's also a" + (s.hasFlag("ranch_screen_door_open") ? "n open" : " closed") + " screen door to the east, and a closed iron gate in the northwest corner of the stone wall.\n\n敞开的走廊向南通往屋内。东面还有一扇" + (s.hasFlag("ranch_screen_door_open") ? "敞开" : "关闭") + "的纱门，石墙西北角有一扇关闭的铁门。";
    },
    exits() {
      return {
        e: "spare_room",
        nw: "nw_ranch",
        out: "nw_ranch",
        s: "hallway",
        n: blocked("back_yard", "wall"),
        ne: blocked("back_yard", "wall"),
        se: blocked("back_yard", "no_entrance"),
        sw: blocked("back_yard", "wall"),
        w: blocked("back_yard", "wall"),
        in: blocked("back_yard", "in_ambiguous"),
      };
    },
    events: [],
  },

  bathroom: {
    name: "Bathroom",
    cn: "浴室",
    onTurn(s, eng) {
      if (s.room !== "bathroom") return;
      breathTick(s, eng);
    },
    onWait: breathWait,
    desc(s) {
      return "An old porcelain sink, broken and faucetless, is the only fixture left in this tiny chamber. The south exit doesn't even have a door.\n\n一个破损且没有水龙头的旧瓷洗手池是这间小屋仅存的设施。南边的出口甚至没有门。";
    },
    exits() {
      return {
        s: "spare_room",
        in: "spare_room",
        out: "spare_room",
      };
    },
    events: [],
  },

  bedroom: {
    name: "Bedroom",
    cn: "卧室",
    onTurn(s, eng) {
      if (s.room !== "bedroom") return;
      breathTick(s, eng);
    },
    onWait: breathWait,
    desc(s) {
      return "This room is stripped bare of all furnishings. Only a rectangular area in the corner, lighter than the floor around it, belies the former presence of a mattress.\n\n这间屋子里的家具已被搬空。只有角落里一块比周围地板颜色浅的矩形区域，表明这里曾放过床垫。\n\nA" + (s.hasFlag("ranch_outside_door_open") ? "n open" : " closed") + " outside door in the east wall leads outside. Another exit opens west, into the ranch house.\n\n东墙上一扇" + (s.hasFlag("ranch_outside_door_open") ? "敞开" : "关闭") + "的外门通往屋外。另一出口向西通往牧场屋内。";
    },
    exits() {
      return {
        e: "ne_yard",
        w: "spare_room",
        in: "spare_room",
        out: blocked("bedroom", "out_ambiguous"),
      };
    },
    events: [],
  },

  se_yard: {
    name: "Southeast Yard",
    cn: "东南院子",
    onTurn(s, eng) {
      if (s.room !== "se_yard") return;
      breathTick(s, eng);
    },
    onWait: breathWait,
    desc(s) {
      return "You're just inside the stone wall, near the ranch house's southeast corner. A raised deck stands immediately to the north, and an open iron gate in the wall leads southeast.\n\n你在石墙内侧，靠近牧场屋的东南角。北边紧挨着一处高起的平台，墙上一扇敞开的铁门通往东南。";
    },
    exits() {
      return {
        se: "se_ranch",
        w: "sw_yard",
        out: "se_ranch",
        n: { to: "front_deck", text: "You stride onto the deck.\n\n你大步走上平台。" },
        u: { to: "front_deck", text: "You stride onto the deck.\n\n你大步走上平台。" },
        ne: blocked("se_yard", "wall"),
        e: blocked("se_yard", "wall"),
        s: blocked("se_yard", "wall"),
        sw: blocked("se_yard", "wall"),
        nw: blocked("se_yard", "no_entrances"),
        in: blocked("se_yard", "no_entrances"),
      };
    },
    events: [],
  },

  icehouse: {
    name: "Icehouse",
    cn: "冰库",
    onTurn(s, eng) {
      if (s.room !== "icehouse") return;
      breathTick(s, eng);
    },
    onWait: breathWait,
    desc(s) {
      return "The walls of this underground chamber are cool and clammy to your touch. It feels as if nobody's been down here for a long time.\n\n这间地下室的墙壁摸起来冰凉潮湿。似乎很久没有人下来过。\n\nGray light seeps in from a stairway climbing east.\n\n灰色的光从东面向上的楼梯渗进来。";
    },
    exits() {
      return {
        e: "hallway",
        u: "hallway",
        out: "hallway",
      };
    },
    events: [],
  },

  se_ranch: {
    name: "Southeast of Ranch",
    cn: "牧场东南",
    onTurn(s, eng) {
      if (s.room !== "se_ranch") return;
      breathTick(s, eng);
    },
    onWait: breathWait,
    desc(s) {
      return "The low stone wall enclosing this dilapidated ranch house has an open iron gate leading inside. Paths follow the wall's perimeter to the north and west, and another curves east along a cement reservoir.\n\n围着破败牧场屋的低矮石墙上有一扇敞开的铁门通向里面。小路沿墙向北和西延伸，另一条沿水泥蓄水池向东弯去。";
    },
    exits() {
      return {
        n: "front_yard",
        e: "south_reservoir",
        w: "sw_ranch",
        nw: "se_yard",
        in: "se_yard",
        ne: blocked("se_ranch", "reservoir_wall"),
      };
    },
    events: [],
  },

  sw_ranch: {
    name: "Southwest of Ranch",
    cn: "牧场西南",
    onTurn(s, eng) {
      if (s.room !== "sw_ranch") return;
      breathTick(s, eng);
    },
    onWait: breathWait,
    desc(s) {
      return "The low stone wall before you is almost as run-down as the ranch house inside it. Paths follow the wall's perimeter to the north and east, and a closed iron gate leads northeast into a dusty yard.\n\n眼前的低矮石墙和墙内的牧场屋一样破败。小路沿墙向北和东延伸，一扇关闭的铁门通向东北面满是尘土的院子。";
    },
    exits() {
      return {
        n: "nw_ranch",
        ne: "sw_yard",
        e: "se_ranch",
        in: "sw_yard",
      };
    },
    events: [],
  },

  ne_ranch: {
    name: "Northeast of Ranch",
    cn: "牧场东北",
    onTurn(s, eng) {
      if (s.room !== "ne_ranch") return;
      breathTick(s, eng);
    },
    onWait: breathWait,
    desc(s) {
      return "A dilapidated ranch house stands nearby, bounded by dusty patches of ground and a low stone wall. Paths lead south and east, on either side of a cement reservoir. A paved road bends off to the west.\n\n附近立着一座破败的牧场屋，周围是尘土地和低矮的石墙。小路沿水泥蓄水池两侧向南和东延伸。一条铺设道路向西弯去。";
    },
    exits() {
      return {
        e: "north_reservoir",
        s: "front_yard",
        w: "nw_ranch",
        se: blocked("ne_ranch", "reservoir_wall"),
        sw: blocked("ne_ranch", "wall"),
        in: blocked("ne_ranch", "in_ambiguous"),
      };
    },
    events: [],
  },

  under_windmill: {
    name: "Under the Windmill",
    cn: "风车下",
    onTurn(s, eng) {
      if (s.room !== "under_windmill") return;
      breathTick(s, eng);
    },
    onWait: breathWait,
    desc(s) {
      // 原版根据望远镜的 broken 属性切换这两个逐字片段。
      const broken = landingBroken(s);
      const en = "A squat wooden windmill rises overhead, its dark timbers tapering up to a " +
        (broken ? "broken landing that's tilted over" : "square landing that overlooks") +
        " the east side of an adjacent reservoir.";
      const cn = "一座矮胖的木风车耸立头顶，深色木架向上收束到" +
        (broken ? "一处破损的平台，向旁边蓄水池东侧倾斜" : "一处方形平台，俯瞰旁边蓄水池的东侧") +
        "。";
      return en + "\n\n" + cn + "\n\nThe bottom rungs of a ladder are just within reach.\n\n梯子的最低几级刚好够得着。";
    },
    exits(s) {
      return {
        sw: "south_reservoir",
        nw: "north_reservoir",
        u: landingBroken(s)
          ? blocked("under_windmill", "broken_landing")
          : { to: "windmill", text: "The ladder squeaks and complains as you ascend.\n\n你爬上梯子，梯子吱呀作响。" },
        w: blocked("under_windmill", "reservoir_wall"),
      };
    },
    events: [],
  },

  south_reservoir: {
    name: "South of Reservoir",
    cn: "水库南",
    onTurn(s, eng) {
      if (s.room !== "south_reservoir") return;
      breathTick(s, eng);
    },
    onWait: breathWait,
    desc(s) {
      return "You're near the south side of a big cement reservoir. Dusty paths lead west and northwest around a ranch house. Another curves northeast, to the base of a windmill.\n\n你在一座大型水泥蓄水池的南侧附近。尘土小路绕着牧场屋向西和西北延伸。另一条向东北弯到风车脚下。\n\nA stairway climbs up to the reservoir's edge.\n\n一道楼梯通向蓄水池边缘。";
    },
    exits() {
      return {
        ne: "under_windmill",
        w: "se_ranch",
        nw: "front_yard",
        n: "edge_reservoir",
        u: "edge_reservoir",
      };
    },
    events: [],
  },

  north_reservoir: {
    name: "North of Reservoir",
    cn: "水库北",
    onTurn(s, eng) {
      if (s.room !== "north_reservoir") return;
      breathTick(s, eng);
    },
    onWait: breathWait,
    desc(s) {
      return "You're resting at the north side of a big cement reservoir. Dusty paths curve west and southwest around a ranch house, and a trail leads southeast to the base of a windmill.\n\n你停在一座大型水泥蓄水池的北侧。尘土小路绕着牧场屋向西和西南弯去，另一条向东南通往风车脚下。";
    },
    exits() {
      return {
        se: "under_windmill",
        sw: "front_yard",
        w: "ne_ranch",
        s: blocked("north_reservoir", "reservoir_wall"),
      };
    },
    events: [],
  },

  edge_reservoir: {
    name: "Edge of Reservoir",
    cn: "水库边缘",
    onTurn(s, eng) {
      if (s.room !== "edge_reservoir") return;
      breathTick(s, eng);
    },
    onWait: breathWait,
    desc(s) {
      return "You're on the edge of a big concrete reservoir, filled with dark water. A short flight of steps leads down to the ground.\n\n你站在一座盛满深色水的大型混凝土蓄水池边缘。短短一段台阶向下通往地面。";
    },
    exits() {
      return {
        s: "south_reservoir",
        d: "south_reservoir",
        n: { to: "reservoir", act: enterReservoir },
        in: { to: "reservoir", act: enterReservoir },
        ne: blocked("edge_reservoir", "reservoir_edge"),
        e: blocked("edge_reservoir", "reservoir_edge"),
        se: blocked("edge_reservoir", "reservoir_edge"),
        sw: blocked("edge_reservoir", "reservoir_edge"),
        w: blocked("edge_reservoir", "reservoir_edge"),
        nw: blocked("edge_reservoir", "reservoir_edge"),
      };
    },
    events: [],
  },

  reservoir: {
    name: "Reservoir",
    cn: "水库",
    onTurn(s, eng) {
      if (s.room !== "reservoir") return;
      breathTick(s, eng);
    },
    onWait: breathWait,
    desc(s) {
      return "You're treading water in a big cement reservoir, too deep for your feet to touch bottom.\n\n你在一座大型水泥蓄水池里踩水，水深得脚无法触底。";
    },
    exits() {
      return {
        s: "edge_reservoir",
        u: "edge_reservoir",
        out: "edge_reservoir",
        d: { to: "underwater", act: dive },
        in: { to: "underwater", act: dive },
        n: blocked("reservoir", "reservoir_only_south"),
        ne: blocked("reservoir", "reservoir_only_south"),
        e: blocked("reservoir", "reservoir_only_south"),
        se: blocked("reservoir", "reservoir_only_south"),
        sw: blocked("reservoir", "reservoir_only_south"),
        w: blocked("reservoir", "reservoir_only_south"),
        nw: blocked("reservoir", "reservoir_only_south"),
      };
    },
    events: [],
  },

  underwater: {
    name: "Underwater",
    cn: "水下",
    onTurn(s, eng) {
      if (s.room !== "underwater") return;
      breathTick(s, eng);
    },
    onWait: breathWait,
    desc(s) {
      return "Suspended particles of muck swirl in the beam of the lantern. It's impossible to see more than a few feet.\n\n悬浮的污泥颗粒在灯笼光束里旋转。几英尺外便什么也看不清了。";
    },
    exits() {
      return {
        u: { to: "reservoir", act: surface },
        out: { to: "reservoir", act: surface },
        n: blocked("underwater", "underwater_wall"),
        ne: blocked("underwater", "underwater_wall"),
        e: blocked("underwater", "underwater_wall"),
        se: blocked("underwater", "underwater_wall"),
        s: blocked("underwater", "underwater_wall"),
        sw: blocked("underwater", "underwater_wall"),
        w: blocked("underwater", "underwater_wall"),
        nw: blocked("underwater", "underwater_wall"),
        d: blocked("underwater", "underwater_bottom"),
      };
    },
    events: [
      {
        id: "underwater_take_binoculars",
        match: { verb: ["take"], noun: ["binoculars"] },
        triggers: ["拿望远镜", "捡起双筒望远镜", "take binoculars", "take the binoculars"],
        when: (s) => s.inRoom("binoculars"),
        act(s, eng) {
          if (!eng.hasCarrySpace()) {
            eng.print("你拿不下更多东西了。");
            return;
          }
          s.take("binoculars");
          eng.print("Taken.\n\n拿到了。");
          if (!s.hasFlag("ranch_binoculars_scored")) {
            s.setFlag("ranch_binoculars_scored");
            s.addScore(1);
          }
        },
        text: "",
      },
    ],
  },

  windmill: {
    name: "Windmill",
    cn: "风车",
    onTurn(s, eng) {
      if (s.room !== "windmill") return;
      startMill(s);
      if (s.hasFlag("ranch_mill_before_breath")) {
        millTick(s, eng);
        breathTick(s, eng);
      } else {
        breathTick(s, eng);
        millTick(s, eng);
      }
    },
    onWait() { return { handled: true, maxTurns: 1 }; },
    desc(s) {
      return "You're on a square landing near the top of the windmill. The rotting planks underfoot creak ominously as you stand on them.\n\n你站在风车顶部附近的一处方形平台。脚下腐朽的木板在你站立时发出不祥的吱呀声。\n\nA rickety ladder leads downward.\n\n一道摇晃的梯子通向下方。";
    },
    exits() {
      return {
        d: { to: "under_windmill", text: "The ladder groans under your weight.\n\n梯子在你的重量下发出呻吟。" },
        out: { to: "under_windmill", text: "The ladder groans under your weight.\n\n梯子在你的重量下发出呻吟。" },
      };
    },
    onEnter(s) {
      if (!landingBroken(s)) startMill(s);
    },
    events: [
      {
        id: "windmill_take_binoculars",
        match: { verb: ["take"], noun: ["binoculars"] },
        triggers: ["拿望远镜", "捡起双筒望远镜", "take binoculars", "take the binoculars"],
        when: (s) => s.inRoom("binoculars") && !landingBroken(s),
        advancesTurn: false,
        act(s, eng) {
          // reservoir_mill_recover 的已验证 ALL-IS-STILL 变体。
          eng.print("A loud, plaintive CREAK makes you draw your hand back in alarm. You hold your breath as the landing sways uncertainly for a moment, back and forth. Then all is still.\n\n一声响亮而哀怨的吱嘎声让你惊恐地缩回了手。平台来回摇晃了一阵，你屏住呼吸。随后，一切归于静止。\n\nSlowly, carefully, you stretch your arm towards the pair of binoculars...\n\n慢慢地，小心地，你朝那副双筒望远镜伸出手……");
          spillMill(s, eng);
        },
        text: "",
      },
      {
        id: "windmill_listen_landing",
        match: { verb: ["listen"], noun: ["landing", "platform", "planks", "plank", "平台", "木板"] },
        triggers: ["听平台", "聆听平台", "听木板", "listen to landing", "listen to the landing", "listen to planks"],
        when: (s) => !landingBroken(s),
        act(s, eng) { millTick(s, eng); },
        text: "",
      },
    ],
  },
};

// BREATH 是原版全局对象；本批迁移仅在 Ranch 注册其动作。
// 每个房间有独立 ID，动作数据复用不携带闭包游戏状态。
for (const [roomId, room] of Object.entries(ROOMS)) {
  room.events.push({
    id: `${roomId}_hold_breath`,
    match: { verb: ["hold", "take"], noun: ["breath", "your breath", "呼吸", "气"] },
    triggers: ["屏息", "憋气", "屏住呼吸", "hold breath", "hold your breath"],
    act(s, eng) {
      if (s.cnt("ranch_breath_remaining") > 0) {
        eng.print("You're already holding your breath.\n\n你已经屏住呼吸了。");
      } else {
        s.setCnt("ranch_breath_remaining", 4);
        eng.print("You take a deep breath.\n\n你深吸了一口气。");
      }
    },
    text: "",
  }, {
    id: `${roomId}_binoculars_already_worn`,
    match: { verb: ["wear"], noun: ["binoculars"] },
    triggers: ["戴上望远镜", "佩戴双筒望远镜", "wear binoculars", "put on binoculars"],
    when: (s) => s.wearing("binoculars"),
    text: "You're already wearing the pair of binoculars.\n\n你已经戴着这副双筒望远镜了。",
  }, {
    id: `${roomId}_wear_binoculars`,
    match: { verb: ["wear"], noun: ["binoculars"] },
    triggers: ["戴上望远镜", "佩戴双筒望远镜", "wear binoculars", "put on binoculars"],
    when: (s) => s.has("binoculars") && !s.wearing("binoculars"),
    act(s) { s.wear("binoculars"); },
    text: "You put on the pair of binoculars.\n\n你戴上这副双筒望远镜。",
  }, {
    id: `${roomId}_binoculars_not_held`,
    match: { verb: ["wear"], noun: ["binoculars"] },
    triggers: ["戴上望远镜", "佩戴双筒望远镜", "wear binoculars", "put on binoculars"],
    when: (s) => s.inRoom("binoculars"),
    text: "You're not holding the pair of binoculars.\n\n你没有拿着这副双筒望远镜。",
  });
}
