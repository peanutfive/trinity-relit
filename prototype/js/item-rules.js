// Original container rules: things.zil BAG/EBAG/CAGE/WTK, misc.zil POCKET,
// verbs.zil V-PUT / WEIGHT / V-EMPTY. Room events retain precedence.
const BAGS = new Set(["bag", "empty_bag", "soggy_bag"]);
const POCKET = new Set(["pocket", "your pocket", "口袋", "衣袋"]);
const TOP_HELD = new Set(["inventory", "worn"]);
const text = (en, cn) => {
  const originals = en.split(/\n{2,}/), translations = cn.split(/\n{2,}/);
  // 只有段落能一一对应时才交错排列；不等长时保留两种语言的全部文本。
  if (originals.length !== translations.length) return `${en}\n\n${cn}`;
  return originals.flatMap((paragraph, index) => [paragraph, translations[index]]).join("\n\n");
};
const prop = (eng, id, key) => typeof eng.itemProperty === "function"
  ? eng.itemProperty(id, key)
  : typeof eng.items[id]?.[key] === "function" ? eng.items[id][key](eng.state) : eng.items[id]?.[key];
const name = (eng, id) => id === "pocket" ? "your pocket" : prop(eng, id, "en");
const cn = (eng, id) => id === "pocket" ? "口袋" : eng.items[id]?.cn || id;
const full = (eng, id) => id === "pocket" ? "your pocket" : `the ${name(eng, id)}`;
const article = value => /^[aeiou]/i.test(value) ? "an" : "a";
const contents = (s, id) => s.contents(id);
const open = (eng, id) => id === "pocket" || BAGS.has(id) || eng.containerIsOpen(id);
const print = (eng, en, zh) => eng.print(text(en, zh));

function resolve(eng, noun) {
  if (!noun) return null;
  const low = noun.toLowerCase();
  if (POCKET.has(low)) return "pocket";
  const ids = eng.visibleItemIds();
  return ids.find(id => id === low || eng.items[id]?.aliases?.some(alias => alias.toLowerCase() === low)) || null;
}

function englishList(eng, ids) {
  const parts = ids.map(id => { const n = name(eng, id); return n && `${article(n)} ${n}`; });
  if (parts.some(value => !value)) return null;
  return parts.length < 2 ? parts[0] || "" : `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}`;
}

// Missing metadata is unknown, never an implicit zero-mass object.
function weight(eng, id, seen = new Set()) {
  if (seen.has(id)) return null;
  seen.add(id);
  const own = id === "pocket" ? 0 : prop(eng, id, "mass");
  if (!Number.isFinite(own)) return null;
  let total = own;
  for (const child of contents(eng.state, id)) {
    const childWeight = weight(eng, child, new Set(seen));
    if (childWeight === null) return null;
    total += childWeight;
  }
  return total;
}

function putCheck(eng, id, target) {
  const s = eng.state;
  if (id === "pocket" || id === target) return { system: "不能把容器放进它自己。" };
  if (target !== "pocket" && !prop(eng, target, "container")) return null;
  if (s.containerOf(id) === target || (target === "pocket" && s.inPocket(id))) return {
    en: `The ${name(eng, id)} is already in ${full(eng, target)}.`, zh: `${cn(eng, id)}已经在${cn(eng, target)}里了。` };
  if (target !== "pocket" && !eng.isAccessible(target)) {
    if (s.inPocket(target)) return { en: "You'll have to take it out of your pocket first.", zh: "你得先把它从口袋里拿出来。" };
    return { system: "你现在够不到那个容器。" };
  }
  if (s.inPocket(target)) return { en: "You'll have to take it out of your pocket first.", zh: "你得先把它从口袋里拿出来。" };
  if (!eng.isAccessible(id)) return { system: "你现在拿不到那个东西。" };
  // Check cycles before any move, even when the carrying root is accessible.
  for (let parent = target; parent && parent !== "pocket"; parent = s.containerOf(parent)) {
    if (parent === id) return { system: "不能把容器放进它自己的内容物里。" };
  }
  if (target === "pocket") {
    if (id === "paper_bird" && !s.hasFlag("bird_unfolded")) return {
      en: "The paper bird would get crumpled if you did that.", zh: "那样会把纸鸟弄皱。" };
    if (id === "bag" || (BAGS.has(id) && contents(s, id).length)) return {
      en: `You'd have to empty ${full(eng, id)} to do that.`, zh: `你得先清空${cn(eng, id)}。` };
  }
  if (!open(eng, target)) return {
    en: `You'd have to open ${full(eng, target)} to do that.`, zh: `你得先打开${cn(eng, target)}。` };
  const size = prop(eng, id, "size");
  if (!Number.isFinite(size)) return { system: "暂时无法把这件物品放入这个容器。" };
  if ((target === "pocket" || target === "cage") && size > 3) return {
    en: `The ${name(eng, id)} is too big to fit in ${full(eng, target)}.`, zh: `${cn(eng, id)}太大，放不进${cn(eng, target)}。` };
  if (target === "bag") return {
    en: size > 1 ? "You'd have to empty out the bag of crumbs to do that."
      : `You'd probably lose ${full(eng, id)} in the crumbs if you did that.`,
    zh: size > 1 ? "你得先倒空面包屑袋。" : `那样可能会把${cn(eng, id)}弄丢在面包屑中。` };
  // CAGE-F precedes the generic mass/capacity check for accepted small objects.
  if (target !== "cage") {
    const destWeight = weight(eng, target), itemWeight = weight(eng, id);
    const shellSize = target === "pocket" ? 0 : prop(eng, target, "size");
    const capacity = target === "pocket" ? 4 : prop(eng, target, "capacity");
    if (![destWeight, itemWeight, shellSize, capacity].every(Number.isFinite)) return {
      system: "暂时无法把这件物品放入这个容器。" };
    if (destWeight + itemWeight - shellSize > capacity) return {
      en: `There isn't enough room in ${full(eng, target)}.`, zh: `${cn(eng, target)}里没有足够空间。` };
  }
  if (!s.carrying(id)) {
    const parent = s.containerOf(id) || (s.inPocket(id) ? "pocket" : null);
    return parent && name(eng, parent) ? {
      en: `Maybe you should take ${full(eng, id)} out of ${full(eng, parent)} first.`, zh: `也许你该先把${cn(eng, id)}从${cn(eng, parent)}里取出来。`
    } : { system: `你得先拿起${cn(eng, id)}。` };
  }
  return { allowed: true };
}

export function crumbsRemaining(s) {
  return Object.hasOwn(s.counters, "crumbs_remaining") ? s.cnt("crumbs_remaining") : 5;
}

export function emptyCrumbBag(s) {
  const loc = s.itemAt("bag");
  s.moveItem("empty_bag", loc);
  s.destroy("bag");
  s.setCnt("crumbs_remaining", 0);
  s.setCnt("crumbs_appetite", 0);
}

export function consumeCrumbs(s) {
  const left = Math.max(0, crumbsRemaining(s) - 1);
  s.setCnt("crumbs_remaining", left);
  if (!left) emptyCrumbBag(s);
  return left;
}

function lookInside(eng, id) {
  const s = eng.state;
  if (id !== "pocket" && s.inPocket(id)) {
    print(eng, "You'll have to take it out of your pocket first.", "你得先把它从口袋里拿出来。"); return true;
  }
  if (!open(eng, id) && !prop(eng, id, "transparent")) {
    if (name(eng, id)) print(eng, `The ${name(eng, id)} is closed.`, `${cn(eng, id)}关着。`);
    else eng.ui.system(`${cn(eng, id)}关着。`);
    return true;
  }
  if (id === "bag") {
    const left = crumbsRemaining(s);
    const en = left === 1 ? "There's only one more handful left in the bag of crumbs."
      : `There are ${left === 2 || left === 3 ? "a couple of" : "several"} handfuls left in the bag of crumbs.`;
    print(eng, en, `面包屑袋里还剩${left === 1 ? "最后一把" : left < 4 ? "几把" : "好几把"}面包屑。`);
    return true;
  }
  const ids = contents(s, id).filter(child => eng.isVisible(child));
  const list = englishList(eng, ids);
  if (ids.length && !list) { eng.ui.system(`里面有：${ids.map(child => cn(eng, child)).join("、")}。`); return true; }
  if (id === "pocket") {
    print(eng, ids.length ? `You have ${list} in your pocket.` : "There's nothing in your pocket.",
      ids.length ? `你的口袋里有${ids.map(child => cn(eng, child)).join("、")}。` : "你的口袋里没有东西。");
  } else {
    print(eng, ids.length ? `You see ${list} in ${full(eng, id)}.` : `You see nothing unusual in ${full(eng, id)}.`,
      ids.length ? `${cn(eng, id)}里有${ids.map(child => cn(eng, child)).join("、")}。` : `${cn(eng, id)}里没有什么特别的。`);
  }
  return true;
}

function spillCrumbs(eng) {
  const s = eng.state;
  emptyCrumbBag(s);
  if (["reservoir", "underwater"].includes(s.room)) {
    print(eng, "Bread crumbs fall out of the bag and disappear in the water.", "面包屑从袋子里掉出，消失在水中。");
  } else if (s.room === "broad_walk" && !s.hasFlag("ruby_visible") && !s.hasFlag("ruby_snatched")) {
    s.setFlag("ruby_visible"); s.setFlag("birds_fed");
    print(eng, "Bread crumbs fall out of the bag and tumble across the ground.\n\nAs the wild birds gobble down the crumbs, a glint of red catches your eye. Frowning, you stoop down for a closer look... and gasp with astonishment!\n\nThe ruby at your feet is bigger than a walnut, with finely cut facets that sparkle with crimson fire. It must have been in the bag of crumbs.",
      "面包屑从袋子里掉出，滚过地面。\n\n野鸟们吃着面包屑，一抹红光吸引了你的目光。你皱眉弯腰凑近一看，不禁惊呼！\n\n脚边的红宝石比核桃还大，精细刻面闪着绯红的火光。它一定原先就在面包屑袋里。");
  } else if (s.room === "broad_walk") {
    print(eng, "Bread crumbs fall out of the bag and tumble across the ground, where the breeze blows them all away.", "面包屑从袋子里掉出，滚过地面，被微风吹散了。");
  } else {
    // Wind/MEEP conditions are not modeled in M4: do not choose an English branch by room ID.
    eng.print("面包屑从袋子里倒出，纸袋空了。");
  }
  return true;
}

export function handleItemAction(eng, cmd) {
  // EMPTY-INTO has its own original branches. Never silently execute it as EMPTY-to-hands.
  if (cmd.verb === "empty" && cmd.noun2) return false;
  const s = eng.state, id = resolve(eng, cmd.noun);
  if (cmd.verb === "put" && ["in", "into"].includes(cmd.prep)) {
    const target = resolve(eng, cmd.noun2);
    if (!id || !target || !name(eng, id) || !name(eng, target)) return false;
    const check = putCheck(eng, id, target);
    if (!check) return false;
    if (!check.allowed) {
      if (check.system) eng.ui.system(check.system); else print(eng, check.en, check.zh);
      return true;
    }
    if (target === "pocket") s.toPocket(id); else s.putIn(id, target);
    print(eng, `You put ${full(eng, id)} ${target === "cage" ? "into" : "in"} ${full(eng, target)}.`,
      `你把${cn(eng, id)}放进${cn(eng, target)}。`);
    return true;
  }
  if (!id) return false;
  if ((cmd.verb === "look_in" || (id === "pocket" && cmd.verb === "examine"))
      && (id === "pocket" || prop(eng, id, "container"))) return lookInside(eng, id);
  if (BAGS.has(id) && ["open", "close"].includes(cmd.verb)) {
    if (!eng.isAccessible(id)) { eng.ui.system("你现在够不到那个容器，先打开外层容器再试。"); return true; }
    if (cmd.verb === "close") print(eng, `The ${name(eng, id)} refuses to stay closed.`, `${cn(eng, id)}怎么也关不住。`);
    else print(eng, "It's already open.", "它已经打开了。");
    return true;
  }
  if (cmd.verb === "empty" && (id === "pocket" || prop(eng, id, "container"))) {
    if (id !== "pocket" && (s.inPocket(id) || !eng.isAccessible(id))) {
      if (s.inPocket(id)) print(eng, "You'll have to take it out of your pocket first.", "你得先把它从口袋里拿出来。");
      else eng.ui.system("你现在够不到那个容器，先打开外层容器再试。");
      return true;
    }
    if (!open(eng, id)) { print(eng, `The ${name(eng, id)} is closed.`, `${cn(eng, id)}关着。`); return true; }
    if (id === "bag") {
      if (!s.carrying(id)) { print(eng, "You're not holding the bag of crumbs.", "你没有拿着面包屑袋。"); return true; }
      return spillCrumbs(eng);
    }
    const children = [...contents(s, id)];
    if (!children.length) print(eng, `There's nothing in ${full(eng, id)}.`, `${cn(eng, id)}里没有东西。`);
    for (const child of children) {
      if (!eng.hasCarrySpace()) { eng.ui.system("你拿不下更多东西了。"); break; }
      if (!eng.isAccessible(child) || eng.items[child]?.fixed || eng.items[child]?.living) { eng.ui.system(`你现在拿不出${cn(eng, child)}。`); continue; }
      s.take(child);
      if (name(eng, child)) print(eng, `The ${name(eng, child)}: Taken.`, `${cn(eng, child)}：拿到了。`);
      else eng.print(`你取出了${cn(eng, child)}。`);
    }
    return true;
  }
  if (id === "walkie_talkie" && ["turn_on", "turn_off", "listen"].includes(cmd.verb)) {
    if (!eng.isAccessible(id)) { eng.ui.system("你得先拿出对讲机。"); return true; }
    if (cmd.verb === "listen") {
      print(eng, s.hasFlag("walkie_on") && !s.hasFlag("walkie_wet")
        ? "The walkie-talkie emits a burst of static." : "At the moment, the walkie-talkie is silent.",
        s.hasFlag("walkie_on") && !s.hasFlag("walkie_wet") ? "对讲机发出一阵静电杂音。" : "此刻，对讲机没有声音。");
    } else {
      const on = cmd.verb === "turn_on";
      if (on === s.hasFlag("walkie_on")) print(eng, `The rocker switch is already ${on ? "on" : "off"}.`, `开关已经${on ? "打开" : "关闭"}了。`);
      else if (on) { s.setFlag("walkie_on"); print(eng, "You turn on the rocker switch.", "你打开了翘板开关。"); }
      else { s.clearFlag("walkie_on"); print(eng, "You turn off the rocker switch.\n\nThe walkie-talkie falls silent.", "你关掉翘板开关。\n\n对讲机安静下来。"); }
    }
    return true;
  }
  return false;
}

export function getItemActionCandidates(eng) {
  const candidates = [], ids = eng.visibleItemIds();
  const add = (id, verb, noun, examples, extra = {}) => candidates.push({ id, command: { type: extra.noun2 ? "compound" : "simple", verb, noun, ...extra }, examples });
  add("item:pocket:look_in", "look_in", "pocket", ["查看口袋", "look in pocket"]);
  for (const id of ids) {
    const label = eng.items[id]?.aliases?.[0] || id;
    if (prop(eng, id, "container")) add(`item:${id}:look_in`, "look_in", label, [`查看${cn(eng, id)}里面`, `look in ${label}`]);
    if (eng.isAccessible(id) && (BAGS.has(id) || id === "cage")) {
      if (id === "cage") add(`item:${id}:${open(eng, id) ? "close" : "open"}`, open(eng, id) ? "close" : "open", label, [`${open(eng, id) ? "关上" : "打开"}${cn(eng, id)}`]);
      if (open(eng, id) && !(id === "cage" && eng.state.contents(id).some(child => prop(eng, child, "living"))) && !eng.state.inPocket(id)) add(`item:${id}:empty`, "empty", label, [`倒空${cn(eng, id)}`, `empty ${label}`]);
    }
    if (id === "walkie_talkie" && eng.isAccessible(id)) {
      for (const verb of ["listen", eng.state.hasFlag("walkie_on") ? "turn_off" : "turn_on"]) add(`item:${id}:${verb}`, verb, label, [verb === "listen" ? "听对讲机" : eng.state.hasFlag("walkie_on") ? "关闭对讲机" : "打开对讲机"]);
    }
    if (!eng.state.carrying(id) || prop(eng, id, "living")) continue;
    for (const target of [...ids.filter(other => prop(eng, other, "container")), "pocket"]) {
      if (putCheck(eng, id, target)?.allowed) add(`item:${id}:put:${target}`, "put", label, [`把${cn(eng, id)}放进${cn(eng, target)}`], { prep: "in", noun2: target === "pocket" ? "pocket" : eng.items[target].aliases[0] });
    }
  }
  return candidates;
}

// Deliberately one parent level: source INTO-RESERVOIR and SPILL-MILL.
export function wetItems(s, { mode }) {
  if (!["enter", "mill"].includes(mode)) throw new TypeError("Unknown water-entry mode");
  const exposed = id => {
    const loc = s.itemAt(id);
    if (["inventory", "worn", "pocket"].includes(loc)) return true;
    if (mode === "mill" && loc === "windmill") return true;
    const parent = s.containerOf(id);
    return parent !== null && TOP_HELD.has(s.itemAt(parent));
  };
  if (exposed("walkie_talkie")) s.setFlag("walkie_wet");
  if (exposed("bag")) {
    s.moveItem("soggy_bag", s.itemAt("bag")); s.destroy("bag");
    s.setCnt("crumbs_remaining", 0); s.setCnt("crumbs_appetite", 0);
  }
  if (exposed("empty_bag")) {
    if (mode === "mill") for (const child of [...contents(s, "empty_bag")]) s.putIn(child, "soggy_bag");
    s.moveItem("soggy_bag", s.itemAt("empty_bag")); s.destroy("empty_bag");
  }
}
