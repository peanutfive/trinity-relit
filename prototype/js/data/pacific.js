// ═══════════════════════════════════════════════════
//  Pacific Island — 比基尼环礁  7 rooms
//  From Chasm's Brink (Neptune ♆). Mesa = entrance; scaffold, beaches, coconut.
//  All English text from original Infocom Trinity (1986) / walkthrough.
// ═══════════════════════════════════════════════════

export const ROOMS = {

  mesa: {
    name: "Mesa",
    cn: "台地",

    desc(s) {
      return "You are on a mesa—a small island in the middle of an ocean. A scaffold rises to the south; the white door behind you leads back to the Wabe.\n\n你在台地上——大洋中的一座小岛。南面矗立着脚手架；身后的白门通向 Wabe。";
    },

    onEnter(s) {
      s.chapter = "pacific";
    },

    exits() {
      return { out: "chasms_brink", in: "chasms_brink", s: "scaffold", d: "scaffold", n: "scaffold", u: "scaffold" };
    },

    events: [],
  },

  scaffold: {
    name: "Scaffold",
    cn: "脚手架",

    desc(s) {
      return "You are on the scaffold. The mesa is to the north and above; the bottom of the scaffold is below. Beaches lie in all directions.\n\n你在脚手架上。台地在北面、上方；脚手架底部在下方。四面都是海滩。";
    },

    onEnter(s) {
      s.chapter = "pacific";
    },

    exits() {
      return { u: "mesa", n: "north_beach", s: "south_beach", e: "east_beach", w: "west_beach", d: "bottom_scaffold" };
    },

    events: [],
  },

  bottom_scaffold: {
    name: "Bottom of Scaffold",
    cn: "脚手架底部",

    desc(s) {
      return "You are at the bottom of the scaffold. A box is here; open it and push the switch—you have seven minutes. Then push the button.\n\n你在脚手架底部。这里有一个箱子；打开它并按下开关——你有七分钟。然后按下按钮。";
    },

    onEnter(s) {
      s.chapter = "pacific";
    },

    exits() {
      return { u: "scaffold", nw: "west_beach", s: "south_beach" };
    },

    events: [],
  },

  north_beach: {
    name: "North Beach",
    cn: "北海滩",

    desc(s) {
      return "You are on the north beach. The ocean stretches away. The scaffold is to the south.\n\n你在北海滩。大海向远处延伸。脚手架在南面。";
    },

    onEnter(s) {
      s.chapter = "pacific";
    },

    exits() {
      return { s: "scaffold", w: "west_beach", e: "east_beach" };
    },

    events: [],
  },

  west_beach: {
    name: "West Beach",
    cn: "西海滩",

    desc(s) {
      return "You are on the west beach. A fin or dolphin may follow you. Coconuts and an islet are visible. Point at the coconut when the tide is right; the dolphin may toss it to your feet.\n\n你在西海滩。一只鳍或海豚可能会跟着你。可见椰子和一座小岛。潮水合适时指向椰子；海豚可能会把它抛到你脚边。";
    },

    onEnter(s) {
      s.chapter = "pacific";
    },

    exits() {
      return { e: "scaffold", se: "south_beach", n: "north_beach", u: "scaffold" };
    },

    events: [],
  },

  east_beach: {
    name: "East Beach",
    cn: "东海滩",

    desc(s) {
      return "You are on the east beach. The ocean and the scaffold are nearby.\n\n你在东海滩。大海与脚手架在近旁。";
    },

    onEnter(s) {
      s.chapter = "pacific";
    },

    exits() {
      return { w: "scaffold", n: "north_beach", s: "south_beach" };
    },

    events: [],
  },

  south_beach: {
    name: "South Beach",
    cn: "南海滩",

    desc(s) {
      return "You are on the south beach. The scaffold rises to the north.\n\n你在南海滩。脚手架在北面耸立。";
    },

    onEnter(s) {
      s.chapter = "pacific";
    },

    exits() {
      return { n: "scaffold", w: "west_beach", e: "east_beach" };
    },

    events: [],
  },
};
