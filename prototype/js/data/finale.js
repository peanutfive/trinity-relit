// ═══════════════════════════════════════════════════
//  Finale — 终章
//  Cut wire (desert) → the_end → transition to Prologue (Palace Gate).
// ═══════════════════════════════════════════════════

export const ROOMS = {

  the_end: {
    name: "The End",
    cn: "终局",

    desc(s) {
      return "The mysterious voice congratulates you, and says not to be worried about the apparent paradox you've created. The next thing you know, you're back at the Palace Gate in Kensington Park where this whole adventure started.\n\n神秘的声音祝贺你，并说不要为你造成的明显悖论担心。下一刻，你已回到肯辛顿公园的宫殿门——这场冒险开始的地方。";
    },

    onEnter(s) {
      s.chapter = "finale";
    },

    exits() {
      return {};
    },

    events: [],
  },
};
