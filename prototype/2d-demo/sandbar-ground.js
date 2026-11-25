import { isletDoorView, vertexShadowView } from './islet-shadow.js';

const sandbar = 'At first glance, this isolated spit seems hopelessly mired in the fog blowing in off the surrounding river. But the sand looks a bit firmer to the south.\n\n乍看之下，这片孤零零的沙嘴完全困在河面吹来的浓雾里。南边的沙地似乎要坚实些。';

const absentFeatures = new Map([
  ...['door','white door','门','白门'].map(noun=>[noun,"You can't see any door here.\n\n你在这里看不见门。"]),
  ...['toadstool','mushroom','毒菌','蘑菇'].map(noun=>[noun,"You can't see any toadstool here.\n\n你在这里看不见毒菌。"]),
]);

export function missingSandbarFeature(command) {
  if (['examine','enter','go'].includes(command.verb)) return absentFeatures.get(command.noun);
}

function readIsletShadow(state) {
  const {sector,phase,centered,leverUp} = vertexShadowView(state);
  if (sector !== 12) return "You can't see any at the moment.\n\n此刻你看不到那道影子。";
  if (!leverUp) return centered
    ? 'Its sharp point rests exactly on the open door in the toadstool.\n\n影尖恰好落在菌柄那扇敞开的门上。'
    : 'Its sharp point rests near the toadstool.\n\n影尖落在毒菌旁边。';
  if (phase < 4) return 'Its sharp point is sweeping southward, towards the toadstool.\n\n影尖向南扫去，正朝毒菌移近。';
  if (phase === 4) return 'Its sharp point is almost touching the toadstool.\n\n影尖快要碰到毒菌了。';
  if (centered) return 'Its sharp point is sweeping across the open door in the toadstool.\n\n影尖正掠过菌柄上敞开的白门。';
  return 'Its sharp point is sweeping southward, away from the toadstool.\n\n影尖继续向南扫去，渐渐离开了毒菌。';
}

export function withIsletGround(room) {
  return {
    ...room,
    desc: () => "It's impossible to see more than a dozen yards on this fogbound islet. The damp air makes your footsteps sound unnaturally loud as you trudge across the sand at the river's edge.\n\n在这座浓雾笼罩的小岛上，你只能看清十来码远。你在河边沙地上跋涉，潮湿的空气里，每一步都响得出奇。",
    events: [{
      id: 'islet_examine_toadstool',
      match: {verb:['examine'],noun:['toadstool_islet','stem','crown','菌柄','菌盖']},
      text: 'The toadstool must be at least twelve feet from base to crown.\n\n这株毒菌从根部到菌盖，少说也有十二英尺高。',
    },{
      id:'islet_examine_white_door',match:{verb:['examine'],noun:['door','white door','白门','门']},
      text:s=>isletDoorView(s).open?'The open white door is of stately residential design.\n\n这扇敞开的白门庄重气派，像是大宅的正门。':'The closed white door is of stately residential design.\n\n这扇关着的白门庄重气派，像是大宅的正门。',
    },{
      id:'islet_examine_shadow',match:{verb:['examine'],noun:['shadow','shadow tip','影尖','影子']},
      text:readIsletShadow,
    },{
      id:'islet_try_white_door',match:{verb:['open'],noun:['door','white door','白门','门']},
      text:s=>isletDoorView(s).open?"It's already open.\n\n门已经开着了。":"The white door won't budge.\n\n白门纹丝不动。",
    },{
      id:'islet_close_door',match:{verb:['close'],noun:['door','white door','白门','门']},
      text:s=>isletDoorView(s).open?"That's odd. The white door won't budge.\n\n真奇怪，白门纹丝不动。":"It's already closed.\n\n门已经关上了。",
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
