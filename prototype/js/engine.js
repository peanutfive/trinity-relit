// ═══════════════════════════════════════════════════
//  GameState — 游戏全局状态
// ═══════════════════════════════════════════════════

export class GameState {
  constructor() {
    this.room = "palace_gate";
    this.itemLoc = {};       // itemId → roomId | "inventory" | "pocket" | "worn" | "destroyed"
    this.flags = new Set();
    this.counters = {};
    this.score = 0;
    this.maxScore = 100;
    this.turns = 0;
    this.chapter = "prologue";
    this.timer = null;       // { remaining, id, perTurn }
    this.visited = new Set(["palace_gate"]);
    this.flipped = false;    // Arboretum Klein bottle
    this.sundialSymbol = 2;  // current symbol the ring points to (1-7)
    this.leverPulled = false;
    this.dead = false;
  }

  // ── Item queries ──
  has(id)       { const l = this.itemLoc[id]; return l === "inventory" || l === "pocket" || l === "worn"; }
  carrying(id)  { return this.itemLoc[id] === "inventory"; }
  inPocket(id)  { return this.itemLoc[id] === "pocket"; }
  wearing(id)   { return this.itemLoc[id] === "worn"; }
  inRoom(id)    { return this.itemLoc[id] === this.room; }
  itemAt(id)    { return this.itemLoc[id]; }

  // ── Item mutations ──
  take(id)      { this.itemLoc[id] = "inventory"; }
  toPocket(id)  { this.itemLoc[id] = "pocket"; }
  wear(id)      { this.itemLoc[id] = "worn"; }
  drop(id)      { this.itemLoc[id] = this.room; }
  destroy(id)   { this.itemLoc[id] = "destroyed"; }
  moveItem(id, loc) { this.itemLoc[id] = loc; }
  placeItem(id, roomId) { this.itemLoc[id] = roomId; }

  roomItems() {
    return Object.entries(this.itemLoc)
      .filter(([, loc]) => loc === this.room)
      .map(([id]) => id);
  }

  inventoryList() {
    return Object.entries(this.itemLoc)
      .filter(([, l]) => l === "inventory" || l === "pocket" || l === "worn")
      .map(([id, l]) => ({ id, loc: l }));
  }

  carryCount() {
    return Object.values(this.itemLoc).filter(l => l === "inventory").length;
  }

  // ── Flags ──
  setFlag(f)    { this.flags.add(f); }
  hasFlag(f)    { return this.flags.has(f); }
  clearFlag(f)  { this.flags.delete(f); }

  // ── Counters ──
  cnt(n)        { return this.counters[n] || 0; }
  setCnt(n, v)  { this.counters[n] = v; }
  inc(n)        { this.counters[n] = (this.counters[n] || 0) + 1; }

  // ── Score ──
  addScore(pts) { this.score += pts; }

  // ── Timer ──
  startTimer(turns, id, perTurn) { this.timer = { remaining: turns, id, perTurn }; }
  tickTimer() {
    if (!this.timer) return null;
    this.timer.remaining--;
    return this.timer;
  }
  clearTimer() { this.timer = null; }
}

// ═══════════════════════════════════════════════════
//  GameEngine — 游戏逻辑核心
// ═══════════════════════════════════════════════════

const MAX_CARRY = 8;
const PRAM_NOUNS = new Set(["pram", "perambulator", "carriage", "婴儿车", "推车", "车"]);

export class GameEngine {
  constructor({ rooms, items, parser, embedding, ui, chapterLoader, preloadedChapters }) {
    this.rooms = rooms;
    this.items = items;
    this.parser = parser;
    this.embedding = embedding;
    this.ui = ui;
    this.chapterLoader = chapterLoader || null;
    this.loadedChapters = new Set(preloadedChapters || ["prologue"]);
    this.state = new GameState();
    this._initItems();
  }

  _initItems() {
    for (const [id, item] of Object.entries(this.items)) {
      if (item.start) this.state.itemLoc[id] = item.start;
    }
  }

  currentRoom() {
    return this.rooms[this.state.room];
  }

  // ── Room display ──
  describeRoom() {
    const room = this.currentRoom();
    if (!room) { this.ui.system(`错误：找不到房间 ${this.state.room}`); return; }

    const name = room.name;
    const cn = room.cn;
    this.ui.location(name, cn);

    const desc = typeof room.desc === "function" ? room.desc(this.state) : room.desc;
    this.ui.text(desc);

    const loose = this.state.roomItems();
    for (const id of loose) {
      const item = this.items[id];
      if (item && item.roomDesc) {
        const rd = typeof item.roomDesc === "function" ? item.roomDesc(this.state) : item.roomDesc;
        if (rd) this.ui.text(rd);
      }
    }
  }

  moveTo(roomId, silent) {
    if (!this.rooms[roomId]) { this.ui.system(`错误：房间 ${roomId} 不存在。`); return; }
    this.state.room = roomId;
    this.state.visited.add(roomId);
    if (!silent) this.describeRoom();
    const room = this.rooms[roomId];
    if (room.onEnter) room.onEnter(this.state, this);
  }

  async activateChapter(chapterId) {
    if (!chapterId) return false;
    if (this.loadedChapters.has(chapterId)) return true;
    if (!this.chapterLoader) return false;
    const rooms = await this.chapterLoader(chapterId);
    if (!rooms) return false;
    Object.assign(this.rooms, rooms);
    this.loadedChapters.add(chapterId);
    return true;
  }

  async transitionChapter({ to, roomCandidates = [], fallbackRoom = null }) {
    if (!to) return false;

    const loaded = await this.activateChapter(to);
    if (!loaded && !this.loadedChapters.has(to)) {
      this.ui.system(
        `\n—— 章节「${to}」尚未开放，敬请期待。——\n` +
        "当前进度已保留，后续更新后可继续游戏。"
      );
      return false;
    }

    this.state.chapter = to;
    this.state.setFlag(`chapter_${to}_entered`);

    const target = [...roomCandidates, fallbackRoom].find((id) => id && this.rooms[id]);
    if (!target) {
      this.ui.system(`章节「${to}」已加载，但没有可进入的起始房间。`);
      return false;
    }
    this.moveTo(target);
    return true;
  }

  // ── Input processing ──
  async processInput(raw) {
    const input = raw.trim();
    if (!input) return;

    this.ui.userInput(input);
    this.state.turns++;

    // 1. Meta commands
    const meta = this._handleMeta(input);
    if (meta) return;

    // 2. Parser (structured matching)
    const cmd = this.parser.parse(input);
    if (cmd) {
      const handled = await this._handleParsed(cmd);
      if (handled) { this._postTurn(); return; }
    }

    // 解析返回 null：不进行语义猜测，直接提示无法识别
    this.ui.system("这句话无法识别。输入「帮助」查看指令提示。");
    this._postTurn();
  }

  _handleMeta(input) {
    const low = input.toLowerCase();
    if (["帮助", "help", "?", "？"].includes(low)) {
      this.ui.system(
        "方向：北(n) 南(s) 东(e) 西(w) 东北(ne) 西北(nw) 东南(se) 西南(sw) 上(u) 下(d)\n" +
        "动作：看(look) 拿(take) 放(drop) 检查(examine) 打开(open) 关(close)\n" +
        "复合：扔X向Y 把X放进Y 给X给Y 用Y切X\n" +
        "系统：背包(i) 分数(score) 等待(wait/z) 帮助(help)"
      );
      return true;
    }
    if (["背包", "物品", "inventory", "i"].includes(low)) {
      this._showInventory(); return true;
    }
    if (["分数", "score"].includes(low)) {
      this.ui.system(`当前分数：${this.state.score} / ${this.state.maxScore}，共 ${this.state.turns} 回合。`);
      return true;
    }
    return false;
  }

  async _handleParsed(cmd) {
    if (cmd.type === "direction") return await this._handleDirection(cmd.dir);
    if (cmd.type === "meta") return this._handleMetaCmd(cmd.cmd);
    if (cmd.type === "simple" || cmd.type === "compound") return await this._handleAction(cmd);
    return false;
  }

  async _handleDirection(dir) {
    const room = this.currentRoom();
    const exits = typeof room.exits === "function" ? room.exits(this.state) : room.exits;
    if (!exits || !exits[dir]) {
      this.ui.system("你不能往那个方向走。");
      return true;
    }
    const target = exits[dir];
    if (typeof target === "object") {
      if (target.when && !target.when(this.state)) {
        const failMsg = typeof target.fail === "function" ? target.fail(this.state) : target.fail;
        this.ui.text(failMsg || "你不能往那个方向走。");
        return true;
      }
      if (target.text) this.ui.text(target.text);
      if (target.act) await target.act(this.state, this);
      this.moveTo(target.to);
    } else {
      this.moveTo(target);
    }
    return true;
  }

  _handleMetaCmd(cmd) {
    if (cmd === "look") { this.describeRoom(); return true; }
    if (cmd === "wait") {
      this.ui.text("时间流逝。");
      const room = this.currentRoom();
      if (room.onWait) room.onWait(this.state, this);
      return true;
    }
    return false;
  }

  async _handleAction(cmd) {
    const room = this.currentRoom();
    const events = room.events || [];

    for (const ev of events) {
      if (ev.when && !ev.when(this.state)) continue;
      if (!ev.match) continue;
      if (this._matchCommand(cmd, ev.match)) {
        await this._executeEvent(ev);
        return true;
      }
    }

    // Generic take/drop/examine if no specific event matched
    if (cmd.verb === "take") return this._genericTake(cmd.noun);
    if (cmd.verb === "drop") return this._genericDrop(cmd.noun);
    if (cmd.verb === "examine") return this._genericExamine(cmd.noun);
    if ((cmd.verb === "push" || cmd.verb === "move") && this._looksLikePram(cmd.noun)) {
      this.ui.system("这里没有可推动的婴儿车。");
      return true;
    }
    if (cmd.verb === "climb") {
      if (!cmd.noun) {
        this.ui.system("你想爬什么？");
      } else {
        this.ui.system("你在这里爬不上去。");
      }
      return true;
    }

    return false;
  }

  _matchCommand(cmd, match) {
    if (!match.verb) return false;
    const verbs = Array.isArray(match.verb) ? match.verb : [match.verb];
    if (!verbs.includes(cmd.verb)) return false;

    if (match.noun) {
      const nouns = Array.isArray(match.noun) ? match.noun : [match.noun];
      if (!cmd.noun || !this._nounMatch(cmd.noun, nouns)) return false;
    }

    if (match.noun2) {
      const nouns2 = Array.isArray(match.noun2) ? match.noun2 : [match.noun2];
      if (!cmd.noun2 || !this._nounMatch(cmd.noun2, nouns2)) return false;
    }

    return true;
  }

  _nounMatch(input, candidates) {
    const low = input.toLowerCase();
    for (const c of candidates) {
      if (low === c.toLowerCase()) return true;
      // Also check item aliases
      const item = this.items[c];
      if (item && item.aliases) {
        for (const a of item.aliases) {
          if (low === a.toLowerCase()) return true;
        }
      }
    }
    return false;
  }

  _looksLikePram(noun) {
    if (!noun) return false;
    return PRAM_NOUNS.has(noun.toLowerCase());
  }

  async _executeEvent(ev) {
    if (ev.act) await ev.act(this.state, this);
    if (ev.text) {
      const t = typeof ev.text === "function" ? ev.text(this.state) : ev.text;
      if (t) this.ui.text(t);
    }
  }

  _postTurn() {
    const room = this.currentRoom();
    if (room.onTurn) room.onTurn(this.state, this);

    if (this.state.timer) {
      const t = this.state.tickTimer();
      if (t && t.perTurn) t.perTurn(this.state, this);
      if (t && t.remaining <= 0) {
        this.state.clearTimer();
      }
    }

    if (this.state.dead) {
      this.ui.system("\n你死了。\n\n输入任意内容重新开始。");
    }
  }

  // ── Generic actions ──
  _genericTake(noun) {
    if (!noun) { this.ui.system("拿什么？"); return true; }
    const itemId = this._resolveItem(noun);
    if (!itemId) return false;
    if (this.state.inPocket(itemId)) {
      this.state.take(itemId);
      const item = this.items[itemId];
      this.ui.text(item?.takeTxt || `You take the ${item?.cn || noun} out of your pocket.\n你从口袋里取出了${item?.cn || noun}。`);
      return true;
    }
    if (!this.state.inRoom(itemId)) { this.ui.system("这里没有那个东西。"); return true; }
    const item = this.items[itemId];
    if (item && item.fixed) { this.ui.system(item.fixedMsg || "你拿不动它。"); return true; }
    if (this.state.carryCount() >= MAX_CARRY) { this.ui.system("你拿不下更多东西了。"); return true; }
    this.state.take(itemId);
    this.ui.text(item?.takeTxt || `你拿起了${item?.cn || noun}。`);
    return true;
  }

  _genericDrop(noun) {
    if (!noun) { this.ui.system("放下什么？"); return true; }
    const itemId = this._resolveItem(noun);
    if (!itemId || !this.state.has(itemId)) { this.ui.system("你没有那个东西。"); return true; }
    this.state.drop(itemId);
    const item = this.items[itemId];
    this.ui.text(`你放下了${item?.cn || noun}。`);
    return true;
  }

  _genericExamine(noun) {
    if (!noun) { this.describeRoom(); return true; }
    const itemId = this._resolveItem(noun);
    if (itemId) {
      const item = this.items[itemId];
      if (this.state.has(itemId) || this.state.inRoom(itemId)) {
        const desc = typeof item.desc === "function" ? item.desc(this.state) : item.desc;
        this.ui.text(desc || `${item.cn}看起来没什么特别的。`);
        return true;
      }
    }
    return false;
  }

  _resolveItem(noun) {
    const low = noun.toLowerCase();
    for (const [id, item] of Object.entries(this.items)) {
      if (id === low) return id;
      if (item.aliases) {
        for (const a of item.aliases) {
          if (a.toLowerCase() === low) return id;
        }
      }
    }
    return null;
  }

  _showInventory() {
    const list = this.state.inventoryList();
    if (list.length === 0) {
      this.ui.system("你两手空空。");
      return;
    }
    const lines = list.map(({ id, loc }) => {
      const item = this.items[id];
      const cn = item?.cn || id;
      const tag = loc === "pocket" ? "（口袋里）" : loc === "worn" ? "（穿戴中）" : "";
      return `  · ${cn}${tag}`;
    });
    this.ui.inventory("随身物品：\n" + lines.join("\n"));
  }

  die(msg) {
    this.ui.text(msg);
    this.state.dead = true;
  }

  print(text) {
    this.ui.text(text);
  }
}
