const sandbar = 'At first glance, this isolated spit seems hopelessly mired in the fog blowing in off the surrounding river. But the sand looks a bit firmer to the south.\n\n乍看之下，这片孤零零的沙嘴完全困在河面吹来的浓雾里。南边的沙地似乎要坚实些。';

export function withIsletGround(room) {
  return {...room, desc: () => "It's impossible to see more than a dozen yards on this fogbound islet. The damp air makes your footsteps sound unnaturally loud as you trudge across the sand at the river's edge.\n\n在这座浓雾笼罩的小岛上，你只能看清十来码远。你在河边沙地上跋涉，潮湿的空气里，每一步都响得出奇。"};
}

export function withSandbarGround(room) {
  return {
    ...room,
    desc: () => sandbar,
    events: [{
      id: 'sandbar_examine_ground',
      match: {verb:['examine'], noun:['sand','river','沙地','沙子','河流','河水']},
      text: sandbar,
    }, ...room.events],
  };
}
