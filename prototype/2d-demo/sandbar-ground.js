const sandbar = 'At first glance, this isolated spit seems hopelessly mired in the fog blowing in off the surrounding river. But the sand looks a bit firmer to the south.\n\n乍看之下，这片孤零零的沙嘴完全困在河面吹来的浓雾里。南边的沙地似乎要坚实些。';

const absentFeatures = new Map([
  ...['door','white door','门','白门'].map(noun=>[noun,"You can't see any door here.\n\n你在这里看不见门。"]),
  ...['toadstool','mushroom','毒菌','蘑菇'].map(noun=>[noun,"You can't see any toadstool here.\n\n你在这里看不见毒菌。"]),
]);

export function missingSandbarFeature(command) {
  if (['examine','enter','go'].includes(command.verb)) return absentFeatures.get(command.noun);
}

export function withIsletGround(room) {
  return {
    ...room,
    desc: () => "It's impossible to see more than a dozen yards on this fogbound islet. The damp air makes your footsteps sound unnaturally loud as you trudge across the sand at the river's edge.\n\n在这座浓雾笼罩的小岛上，你只能看清十来码远。你在河边沙地上跋涉，潮湿的空气里，每一步都响得出奇。",
    events: [{
      id: 'islet_examine_toadstool',
      match: {verb:['examine'],noun:['toadstool_islet','stem','crown','菌柄','菌盖']},
      text: 'The toadstool must be at least twelve feet from base to crown.\n\n这株毒菌从根部到菌盖，少说也有十二英尺高。',
    }, ...room.events],
  };
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
