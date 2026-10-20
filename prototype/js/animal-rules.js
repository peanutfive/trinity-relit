// Target R12/860926: CAGE-F, LEM-F/FREE-LEM, I-LEM/I-TMEEP and DO-DROWN.
// Locations remain the only possession truth; these serializable fields are callbacks' phases.
export const ANIMAL_IDS = new Set(["lemming", "magpie", "roadrunner", "dead_lemming", "dead_magpie", "dead_roadrunner"]);
const LIVE = new Set(["lemming", "magpie", "roadrunner"]);
const DEAD = { lemming: "dead_lemming", magpie: "dead_magpie", roadrunner: "dead_roadrunner" };
const say = (eng, en, cn) => eng.print(`${en}\n\n${cn}`);

export function initializeAnimals(s) {
  s.animals ??= {};
  s.animals.lemming ??= { active: false, grace: 0 };
  s.animals.roadrunner ??= { active: false, grace: 0, prepared: false, takeable: false };
  s.animals.magpie ??= { active: true };
  s.animals.deaths ??= { dead_lemming: null, dead_magpie: null, dead_roadrunner: null };
  return s.animals;
}

function lit(eng) {
  const room = eng.currentRoom();
  if (typeof room.animalLight === "function") return !!room.animalLight(eng.state, eng);
  return eng.state.room !== "underwater" && !(eng.state.room === "closet" && eng.state.hasFlag("closet_door_closed"));
}

function seesSnake(s) {
  return s.hasFlag("snake_started") && !s.hasFlag("snake_gone")
    && (s.room === "assembly_room" || (s.room === "closet" && !s.hasFlag("closet_door_closed")));
}

function resolve(eng, noun, explicit) {
  const matches = typeof eng.matchingItemIds === "function" ? eng.matchingItemIds(noun)
    : Object.keys(eng.items).filter(id => id === noun || eng.items[id].aliases?.includes(noun));
  if (explicit) return matches.includes(explicit) && eng.isVisible(explicit) ? explicit : null;
  return matches.find(id => eng.isVisible(id)) || null;
}

function exitAnimal(s, id) {
  initializeAnimals(s)[id].active = false;
  if (id !== "magpie") s.animals[id].grace = 0;
  s.destroy(id);
}

function replaceDrowned(s, id, loc) {
  exitAnimal(s, id);
  s.moveItem(DEAD[id], loc);
  s.animals.deaths[DEAD[id]] = "drowned";
}

// Callers implement each original routine's *direct* CAGE location predicate.
export function drownCage(s) {
  initializeAnimals(s);
  for (const id of LIVE) if (s.containerOf(id) === "cage") replaceDrowned(s, id, "in:cage");
}

export function drownRoadrunner(s, loc) {
  if (s.itemAt("roadrunner") === loc) replaceDrowned(s, "roadrunner", loc);
}

export function discoverLemming(s, eng) {
  const animals = initializeAnimals(s);
  if (!s.hasFlag("animal_lemming_discovered")) {
    s.setFlag("animal_lemming_discovered");
    if (s.itemAt("lemming") || s.itemAt("dead_lemming")) {
      say(eng, "You see nothing unusual in the fissure.", "裂缝里没有什么特别的。");
      return;
    }
    s.placeItem("lemming", "cliff_edge");
    animals.lemming.active = true;
    animals.lemming.grace = 1;
    say(eng, "A trapped lemming glares up at you defiantly.", "一只被困的旅鼠不服气地瞪着你。");
  } else if (s.itemAt("lemming") === "cliff_edge") {
    say(eng, "You see a lemming in the fissure.", "你看到裂缝里有一只旅鼠。");
  } else say(eng, "You see nothing unusual in the fissure.", "裂缝里没有什么特别的。");
}

export function prepareRoadrunnerForDesert(s) {
  const animals = initializeAnimals(s);
  if (animals.roadrunner.prepared || s.itemAt("roadrunner") === "destroyed" || s.itemAt("dead_roadrunner")) return false;
  animals.roadrunner.prepared = true;
  animals.roadrunner.takeable = true;
  s.placeItem("roadrunner", "base_of_tower");
  return true;
}

export function enterRoadrunnerTower(s, eng) {
  const a = initializeAnimals(s).roadrunner;
  if (!a.prepared || a.active || s.itemAt("roadrunner") !== "base_of_tower" || s.hasFlag("roadrunner_tower_met")) return false;
  a.active = true;
  s.setFlag("roadrunner_tower_met");
  say(eng, "A familiar roadrunner is eyeing you from its perch on the box's lid. The ruby in its beak gleams in the early dawn.\n\nWith a skillful toss, the roadrunner deposits the ruby on the box. Then it leaps off and scampers eagerly around your feet. If you didn't know better, you'd swear it was glad to see you.",
    "一只熟悉的走鹃栖在箱盖上打量着你。它嘴里的红宝石在黎明中闪耀。\n\n走鹃熟练地一甩，将红宝石放到箱子上。接着它跳下来，兴奋地在你脚边跑来跑去。要不是你了解它，还真会以为它见到你很高兴。");
  return true;
}

function freeLemming(eng, prefix = "The lemming ", cnPrefix = "旅鼠") {
  const s = eng.state;
  let tail, zh;
  if (s.room === "closet") {
    s.placeItem("lemming", "closet");
    s.animals.lemming.grace = 1;
    tail = `${lit(eng) ? "plops" : "plop"} to the floor`; zh = "落到地板上";
    const follow = eng.currentRoom().onAnimalReleased?.(s, eng, "lemming");
    tail += follow?.en || "."; zh += follow?.cn || "。";
  } else if (s.room === "windmill") {
    replaceDrowned(s, "lemming", "underwater");
    tail = "leaps over the landing's edge.\n\nA moment later, you hear a faint splash."; zh = "跳过平台边缘。\n\n片刻后，你听到一声轻微的水响。";
  } else if (["cliff_edge", "tower_platform", "tower_landing"].includes(s.room)) {
    exitAnimal(s, "lemming");
    tail = s.room === "cliff_edge" ? "flings itself joyfully off the cliff." : "flings itself joyfully off the tower.";
    zh = s.room === "cliff_edge" ? "欢快地跳下悬崖。" : "欢快地跳下高塔。";
    if (s.room !== "cliff_edge") { s.placeItem("dead_lemming", "base_of_tower"); s.animals.deaths.dead_lemming = null; }
  } else if (s.room === "herb_garden") {
    exitAnimal(s, "lemming");
    // TS4-DOOR's NOALL visibility is not a separate state in this remake. Its
    // currently modeled open white-door branch is the Libra sundial position.
    if (s.sundialSymbol === 5) {
      tail = "scurries through the open white door."; zh = "穿过敞开的白门跑走了。";
    } else {
      tail = s.hasFlag("cottage_back_open") ? "scurries out the open back door." : "nudges open the back door. Then it scurries out of sight.";
      s.setFlag("cottage_back_open"); zh = "从后门跑走了。";
      if (!s.hasFlag("cottage_front_open")) {
        s.setFlag("cottage_front_open");
        tail += "\n\nYou hear a faint creak in the cottage.";
        zh += "\n\n你听到小屋里传来轻微的吱呀声。";
      }
    }
  } else if (["cottage", "se_room", "kitchen", "spare_room", "bedroom"].includes(s.room)) {
    exitAnimal(s, "lemming");
    const [flag, door] = s.room === "cottage" ? ["cottage_front_open", "front door"]
      : s.room === "se_room" ? ["front_deck_left_door_open", "front door"]
      : s.room === "kitchen" ? ["ranch_outer_door_open", "outer door"]
      : s.room === "spare_room" ? ["ranch_screen_door_open", "screen door"] : ["ranch_outside_door_open", "outside door"];
    const escape = s.hasFlag(flag) ? `scurries out the open ${door}.` : `nudges open the ${door}. Then it scurries out of sight.`;
    s.setFlag(flag);
    tail = s.room === "se_room" ? "races to the north exit. It skids to a stop at the threshold, flips over and " + escape : escape;
    zh = "从前门跑了出去。";
  } else if (["nw_room", "bathroom"].includes(s.room)) {
    exitAnimal(s, "lemming");
    tail = `scurries off to the ${s.room === "nw_room" ? "north" : "south"}${s.hasFlag("ranch_screen_door_open") ? "" : ", where you hear a faint creak"}.`;
    s.setFlag("ranch_screen_door_open"); zh = "向一侧跑走了。";
  } else {
    exitAnimal(s, "lemming");
    tail = "scurries out of sight."; zh = "跑出了视野。";
  }
  say(eng, prefix + tail, cnPrefix + zh);
}

function tickLemming(eng) {
  const s = eng.state, a = s.animals.lemming;
  if (!a.active || !eng.isVisible("lemming")) return;
  const loc = s.itemAt("lemming");
  if (loc === "inventory") {
    if (a.grace) { a.grace = 0; say(eng, "The lemming squirms violently in your hand.", "旅鼠在你手中拼命挣扎。"); }
    else freeLemming(eng, `With a desperate lurch, the lemming wiggles from your grasp and ${lit(eng) ? "" : "falls with a "}`, "旅鼠拼命一扭，挣脱你的手，");
  } else if (loc === "in:cage" && s.hasFlag("cage_open")) {
    if (seesSnake(s)) { a.grace = 0; say(eng, "The lemming cowers in the cage, trembling violently.", "旅鼠蜷缩在笼中，剧烈发抖。"); }
    else if (a.grace) { a.grace = 0; say(eng, lit(eng) ? "The lemming scampers uneasily around the cage." : "You hear the lemming scampering uneasily around the cage.", "旅鼠在笼中不安地跑来跑去。"); }
    else freeLemming(eng, lit(eng) ? "The lemming scrambles out of the cage and " : "You hear the lemming scramble out of the cage and ", "旅鼠爬出笼子，");
  } else if (loc !== "in:cage" && loc !== "cliff_edge" && loc !== "closet") freeLemming(eng);
}

function freeRoadrunner(eng, prefix, zh) {
  const s = eng.state;
  s.animals.roadrunner.grace = 0;
  let tail, cn;
  if (["edge_reservoir", "reservoir"].includes(s.room)) {
    s.placeItem("roadrunner", "south_reservoir"); tail = "flutters out of the reservoir and disappears."; cn = "扑腾着飞出水库，消失了。";
  } else if (s.room === "windmill") {
    s.placeItem("roadrunner", "under_windmill"); tail = "leaps over the landing's edge and flutters out of sight."; cn = "跳过平台边缘，扑腾着消失了。";
  } else if (seesSnake(s)) {
    s.placeItem("roadrunner", "se_room"); tail = "narrowly escapes the fangs of the rattlesnake. It races away with a fearful squawk."; cn = "险些落入响尾蛇的毒牙，惊恐地叫着跑开了。";
  } else if (["hallway", "icehouse"].includes(s.room)) {
    s.placeItem("roadrunner", "back_yard");
    tail = s.room === "hallway" ? "scoots off down the hall." : "scoots up the stairs."; cn = "沿通道跑走了。";
  } else if (["tower_platform", "tower_landing", "shack"].includes(s.room)) {
    s.placeItem("roadrunner", "base_of_tower");
    tail = `disappears ${s.room === "shack" ? "to the west" : "over the side of the platform"}.\n\nYou hear a flurry of wings that quickly fades.`; cn = "消失了。\n\n你听到一阵迅速远去的振翅声。";
  } else if (["assembly_room", "se_room", "kitchen", "bedroom", "spare_room", "nw_room", "bathroom"].includes(s.room) || (s.room === "closet" && !s.hasFlag("closet_door_closed"))) {
    const doors = { assembly_room: ["front_deck_right_door_open", "front door"], se_room: ["front_deck_left_door_open", "front door"], kitchen: ["ranch_outer_door_open", "outer door"], spare_room: ["ranch_screen_door_open", "screen door"] };
    const door = doors[s.room];
    tail = "";
    if (door && !s.hasFlag(door[0])) {
      s.setFlag(door[0]);
      tail = `nudges open the ${door[1]}. It gives you a sly glance before it `;
    }
    const ranchOpen = ["front_deck_right_door_open", "front_deck_left_door_open", "ranch_outer_door_open", "ranch_screen_door_open", "ranch_outside_door_open"].some(flag => s.hasFlag(flag));
    s.placeItem("roadrunner", ranchOpen ? "front_yard" : s.room === "bathroom" ? "bedroom" : "bathroom");
    tail += "trots out of sight."; cn = "跑出了视野。";
  } else {
    s.placeItem("roadrunner", s.room);
    tail = lit(eng) ? "looks up at you inquisitively." : "scratches around in the darkness.";
    cn = lit(eng) ? "好奇地抬头望着你。" : "在黑暗中刨动。";
  }
  say(eng, prefix + tail, zh + cn);
}

function tickRoadrunner(eng) {
  const s = eng.state, a = s.animals.roadrunner;
  if (!a.active || !eng.isVisible("roadrunner")) return;
  const loc = s.itemAt("roadrunner");
  // I-TMEEP's first branch applies to a free bird in these actual room IDs.
  if (loc === s.room && ["shack", "tower_platform", "tower_landing", "windmill", "reservoir", "edge_reservoir", "closet"].includes(s.room)) {
    freeRoadrunner(eng, "The roadrunner ", "走鹃");
    return;
  }
  if (loc === "inventory") {
    if (a.grace) { a.grace = 0; say(eng, "The roadrunner pecks angrily at your fingers with its sharp beak. Ouch!", "走鹃用尖喙愤怒地啄你的手指。哎哟！"); }
    else freeRoadrunner(eng, "The roadrunner struggles out of your grasp and ", "走鹃挣脱你的手，");
  } else if (s.containerOf("roadrunner") && eng.containerIsOpen(s.containerOf("roadrunner"))) {
    if (seesSnake(s)) { say(eng, "The roadrunner cowers in a corner of the cage, trembling violently.", "走鹃蜷在笼子一角，剧烈颤抖。"); }
    else if (loc === "in:cage" && a.grace) { a.grace = 0; say(eng, "The roadrunner flutters anxiously around the cage.", "走鹃在笼中焦躁地扑腾。"); }
    else freeRoadrunner(eng, `The roadrunner hops out of the ${eng.itemProperty(s.containerOf("roadrunner"), "en")} and `, "走鹃跳出容器，");
  }
}

export function tickAnimals(eng) {
  initializeAnimals(eng.state);
  if (tickSnakeBite(eng)) return;
  tickLemming(eng);
  tickRoadrunner(eng);
}

// I-BITTEN is a separate queued callback: it survives movement and chapter loading.
export function tickSnakeBite(eng) {
  const s = eng.state;
  if (s.dead || !s.hasFlag("snake_bitten") || s.turns <= s.cnt("snake_bite_turn")) return false;
  s.clearFlag("snake_bitten");
  const indoors = new Set(["hallway", "assembly_room", "closet", "kitchen", "spare_room", "nw_room", "se_room", "bathroom", "bedroom", "icehouse", "underwater"]);
  const outdoors = new Set(["nw_ranch", "front_yard", "front_deck", "sw_yard", "ne_yard", "back_yard", "se_yard", "se_ranch", "sw_ranch", "ne_ranch", "under_windmill", "south_reservoir", "north_reservoir", "edge_reservoir", "reservoir", "windmill"]);
  if (!indoors.has(s.room) && !outdoors.has(s.room)) {
    eng.die("脚踝的剧痛使你倒下。此处跨章节咬伤结局尚无已验证的原版文本。");
    return true;
  }
  const glare = ["closet", "icehouse"].includes(s.room) ? "cracks in the north wall are filled with light of startling intensity"
    : s.room === "hallway" ? "hallway is filled with light of startling intensity"
    : s.room === "underwater" ? "water around you is filled with light of startling intensity"
    : indoors.has(s.room) ? "windows are filled with light of startling intensity"
    : "desert around you disappears in a flash of startling brilliance";
  eng.die(`The throbbing fire in your ankle overcomes you. Moaning with despair, you sink helplessly to the ${indoors.has(s.room) ? "floor" : "ground"}.\n\nMinutes later, the ${glare}! You jam your hands over your eyes in the awful glare; never see the fireball closing in at many times the speed of sound; and never feel the stellar heat that annihilates much of the state of New Mexico.\n\n脚踝里灼烧般的剧痛吞没了你。你绝望地呻吟着，无助地倒下。\n\n几分钟后，刺目的光芒充满周围！你用双手遮住眼睛，没有看见以数倍音速逼近的火球，也没有感到那毁灭新墨西哥州大片土地的恒星般的高温。`);
  return true;
}

function openCage(eng) {
  const s = eng.state;
  if (s.hasFlag("cage_open")) { say(eng, "It's already open.", "它已经打开了。"); return true; }
  s.setFlag("cage_open");
  say(eng, "You open the birdcage.", "你打开了鸟笼。");
  if (s.containerOf("magpie") === "cage" && lit(eng)) {
    const trapped = s.room === "cottage" && !s.hasFlag("cottage_front_open") && !s.hasFlag("cottage_back_open");
    const closedCloset = s.room === "closet" && s.hasFlag("closet_door_closed");
    if (trapped || closedCloset) {
      s.clearFlag("cage_open");
      say(eng, `The magpie flutters out of the cage and circles around the inside of the ${trapped ? "cottage" : "closet"}. After considerable effort, you manage to stuff it back in the cage and slam the door shut.`,
        `喜鹊扑腾着飞出鸟笼，在${trapped ? "小屋" : "壁橱"}里绕圈。费了好大劲，你终于将它塞回笼子，砰地关上笼门。`);
    } else {
      say(eng, s.room === "cottage" ? "The magpie flutters out of the cage and soars through the open door." : "The magpie flutters out of the cage and soars out of sight.", "喜鹊扑腾着飞出鸟笼，展翅飞走了。");
      exitAnimal(s, "magpie");
    }
  } else if (s.containerOf("lemming") === "cage") {
    // CAGE-F invokes I-LEM immediately, then the ordinary command still has its tick.
    tickLemming(eng);
  }
  return true;
}

function touchable(eng, id) {
  if (eng.isAccessible(id)) return true;
  if (eng.state.containerOf(id) === "cage" && !eng.containerIsOpen("cage")) say(eng, "You can't reach into the birdcage. It's closed.", "你够不到鸟笼里面。它关着。");
  else eng.ui.system("你现在够不到那个东西，请先打开外层容器。");
  return false;
}

export function handleAnimalAction(eng, cmd) {
  const s = eng.state, a = initializeAnimals(s);
  const id = resolve(eng, cmd.noun, cmd.itemId);
  if (cmd.itemId && !id) { eng.ui.system("这个目标已经不在这里，请重新选择。"); return { handled: true, advancesTurn: false }; }
  if (id === "cage") {
    if (cmd.verb === "empty" && !cmd.noun2 && s.contents("cage").some(child => LIVE.has(child))) {
      if (!touchable(eng, id)) return true;
      if (!eng.containerIsOpen("cage")) { say(eng, "The birdcage is closed.", "鸟笼关着。"); return true; }
      for (const child of [...s.contents("cage")]) {
        if (child === "magpie") { say(eng, "The magpie: The magpie won't let you near.", "喜鹊：它不让你靠近。"); continue; }
        if (!eng.hasCarrySpace()) { eng.ui.system("你拿不下更多东西了。"); break; }
        if (!touchable(eng, child) || eng.items[child]?.fixed) continue;
        s.take(child);
        if (LIVE.has(child)) { a[child].active = true; a[child].grace = 1; }
        const name = eng.itemProperty(child, "en");
        if (name) say(eng, `The ${name}: Taken.`, `${eng.items[child].cn}：拿到了。`);
        else eng.ui.system(`你取出了${eng.items[child].cn}。`);
      }
      return true;
    }
    if (["open", "close"].includes(cmd.verb)) {
      if (!touchable(eng, id)) return true;
      if (cmd.verb === "open") return openCage(eng);
      if (!s.hasFlag("cage_open")) say(eng, "It's already closed.", "它已经关上了。");
      else { s.clearFlag("cage_open"); say(eng, "You close the birdcage.", "你关上了鸟笼。"); }
      return true;
    }
    if (cmd.verb === "take" && !s.has("cage")) {
      if (["from", "off"].includes(cmd.prep) && cmd.noun2) {
        const source = resolve(eng, cmd.noun2, cmd.targetItemId);
        if (!source || s.containerOf("cage") !== source) {
          eng.ui.system("鸟笼不在指定的物品里或上面。"); return true;
        }
      }
      if (!touchable(eng, id)) return true;
      if (!eng.hasCarrySpace()) { eng.ui.system("你拿不下更多东西了。"); return true; }
      s.take("cage");
      if (!s.hasFlag("cage_taken_scored")) { s.setFlag("cage_taken_scored"); s.addScore(1); }
      say(eng, "Taken.", "拿到了。"); return true;
    }
    if (cmd.verb === "examine") {
      const children = s.contents("cage").filter(child => eng.isVisible(child));
      const names = children.map(child => `a${/^[aeiou]/i.test(eng.itemProperty(child, "en")) ? "n" : ""} ${eng.itemProperty(child, "en")}`);
      if (names.some(value => value.endsWith("undefined"))) return false;
      const list = names.length < 2 ? names[0] : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
      say(eng, `The ${s.hasFlag("cage_open") ? "open" : "closed"} birdcage is cunningly woven of brown and yellow wicker.${names.length ? ` Peering between the slats, you see ${list}.` : ""}`,
        `${s.hasFlag("cage_open") ? "敞开" : "关闭"}的鸟笼由棕黄色柳条巧妙编成。${children.length ? `透过笼条，你看到${children.map(child => eng.items[child].cn).join("、")}。` : ""}`);
      return true;
    }
  }
  if (!ANIMAL_IDS.has(id)) return false;
  if (!LIVE.has(id) && /drowned|溺死/.test(cmd.noun || "") && a.deaths[id] !== "drowned") {
    say(eng, "You can't see that here.", "这里没有你说的那样东西。");
    return { handled: true, advancesTurn: false };
  }
  if (cmd.verb === "examine") {
    const desc = typeof eng.items[id].desc === "function" ? eng.items[id].desc(s) : eng.items[id].desc;
    eng.print(desc); return true;
  }
  if (cmd.verb === "take") {
    if (!LIVE.has(id)) {
      if (s.containerOf(id) === "cage" && !eng.containerIsOpen("cage")) { touchable(eng, id); return true; }
      return false; // Preserve shared pocket/source/capacity rules for ordinary dead objects.
    }
    if (["from", "off"].includes(cmd.prep) && cmd.noun2) {
      const source = resolve(eng, cmd.noun2, cmd.targetItemId);
      const fissure = id === "lemming" && s.itemAt(id) === "cliff_edge" && s.hasFlag("animal_lemming_discovered") && ["fissure", "crevice", "裂缝", "缝隙"].includes(cmd.noun2);
      if (!fissure && (!source || s.containerOf(id) !== source)) {
        eng.ui.system("那件东西不在指定的容器里。"); return true;
      }
    }
    if (!touchable(eng, id)) return true;
    if (id === "magpie") { say(eng, "The magpie won't let you near.", "喜鹊不让你靠近。"); return true; }
    if (id === "roadrunner" && !a.roadrunner.takeable) { eng.ui.system("你现在抓不到走鹃。"); return true; }
    if (s.has(id)) { say(eng, `You're already holding the ${eng.itemProperty(id, "en")}.`, `你已经拿着${eng.items[id].cn}了。`); return true; }
    if (!eng.hasCarrySpace()) { eng.ui.system("你拿不下更多东西了。"); return true; }
    const parent = s.containerOf(id);
    const fissure = id === "lemming" && s.itemAt(id) === "cliff_edge" && s.hasFlag("animal_lemming_discovered");
    s.take(id);
    if (LIVE.has(id)) { a[id].active = true; a[id].grace = 1; }
    say(eng, fissure ? "You take the lemming out of the fissure." : parent === "cage" ? `You take the ${eng.itemProperty(id, "en")} out of the birdcage.` : "Taken.", fissure ? "你从裂缝中取出旅鼠。" : parent === "cage" ? `你从鸟笼里取出${eng.items[id].cn}。` : "拿到了。");
    return true;
  }
  if (cmd.verb === "put" && ["in", "into"].includes(cmd.prep)) {
    const target = resolve(eng, cmd.noun2, cmd.targetItemId);
    if (target !== "cage" || !LIVE.has(id)) return false;
    if (!touchable(eng, id) || !touchable(eng, target)) return true;
    if (!eng.containerIsOpen("cage")) { say(eng, "You'd have to open the birdcage to do that.", "你得先打开鸟笼。"); return true; }
    if (!s.carrying(id)) { eng.ui.system(`你得先拿起${eng.items[id].cn}。`); return true; }
    if (id === "magpie") return false;
    s.putIn(id, "cage"); a[id].active = true; a[id].grace = 1;
    if (id === "lemming") {
      say(eng, "The lemming sinks its teeth into your thumb when it sees the cage. But you jam it inside anyway.", "旅鼠一见鸟笼便咬住你的拇指。但你还是把它塞了进去。");
      if (!s.hasFlag("cage_lemming_scored")) { s.setFlag("cage_lemming_scored"); s.addScore(1); }
    } else say(eng, "The roadrunner pecks furiously at your hand, but you grit your teeth and stuff the protesting bird into the cage.", "走鹃猛烈地啄你的手，但你咬紧牙关，把这只抗议的鸟塞进笼里。");
    return true;
  }
  if (["drop", "release"].includes(cmd.verb)) {
    if (cmd.verb === "release" && s.containerOf(id) === "cage") {
      if (!s.hasFlag("cage_open")) return openCage(eng);
      say(eng, "The birdcage isn't closed.", "鸟笼没有关着。"); return true;
    }
    if (cmd.verb === "release" && id === "lemming" && s.itemAt(id) === "cliff_edge" && s.hasFlag("animal_lemming_discovered")) {
      say(eng, "How do you intend to do that?", "你打算怎么做？"); return true;
    }
    if (!s.has(id)) {
      say(eng, `The ${eng.itemProperty(id, "en")} isn't confined by anything.`, `${eng.items[id].cn}没有被什么困住。`); return true;
    }
    s.drop(id);
    say(eng, "Dropped.", "放下了。");
    if (id === "lemming") freeLemming(eng);
    return true;
  }
  return false;
}

export function getAnimalActionCandidates(eng) {
  const s = eng.state, a = initializeAnimals(s), result = [];
  const add = (id, verb, examples, extra = {}) => result.push({ id: `animal:${id}:${verb}${extra.noun2 ? `:${extra.noun2}` : ""}`,
    command: { type: extra.noun2 ? "compound" : "simple", verb, noun: eng.items[id].aliases[0], itemId: id, ...extra }, examples });
  for (const id of eng.visibleItemIds().filter(id => ANIMAL_IDS.has(id))) {
    const cn = eng.items[id].cn;
    add(id, "examine", [`查看${cn}`, `examine ${eng.items[id].en}`]);
    if (eng.isAccessible(id) && id !== "magpie" && (id !== "roadrunner" || a.roadrunner.takeable)) {
      if (!s.has(id) && eng.hasCarrySpace()) add(id, "take", [`拿起${cn}`, `take ${eng.items[id].en}`]);
      else if (s.has(id)) {
        add(id, "drop", [`放下${cn}`, `drop ${eng.items[id].en}`]);
        if (LIVE.has(id) && eng.isAccessible("cage") && eng.containerIsOpen("cage")) add(id, "put", [`把${cn}放进鸟笼`], { prep: "in", noun2: "cage", targetItemId: "cage" });
      }
    }
    if (LIVE.has(id) && (s.has(id) || s.containerOf(id) === "cage")) add(id, "release", [`放生${cn}`, `release ${eng.items[id].en}`]);
  }
  return result;
}
