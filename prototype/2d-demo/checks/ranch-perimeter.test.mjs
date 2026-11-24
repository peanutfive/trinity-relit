import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ROOMS } from '../../js/data/ranch.js';
import { ROOMS as DESERT_ROOMS } from '../../js/data/desert.js';
import { RANCH_PERIMETER_LAYOUT } from '../ranch-perimeter-layout.js';
import { DESERT_ARRIVAL_LAYOUT } from '../desert-arrival-layout.js';
import { roomArrival } from '../arrivals.js';
import { approachingExit, findPath, isBlocked, isSegmentWalkable } from '../world.js';

const ring = ['nw_ranch', 'ne_ranch', 'front_yard', 'se_ranch', 'sw_ranch'];
const directions = { n: [0, -1], e: [1, 0], s: [0, 1], w: [-1, 0] };

test('浅坑与牧场的跨章入口各自落在来路内侧，离开路口不会立即折返', () => {
  const crater = DESERT_ARRIVAL_LAYOUT.shallow_crater;
  const corner = RANCH_PERIMETER_LAYOUT.nw_ranch;
  for (const [from, source, rooms, dir, to, destination, back] of [
    ['shallow_crater', crater, DESERT_ROOMS, 'se', 'nw_ranch', corner, 'nw'],
    ['nw_ranch', corner, ROOMS, 'nw', 'shallow_crater', crater, 'se'],
  ]) {
    const rule = rooms[from].exits({})[dir];
    assert.equal(rule?.to, to, from);
    const [x, y] = source.exitAnchors[dir];
    const route = {dir, x, y, radius:17, approach:source.exitApproaches[dir]};
    const [dx, dy] = route.approach;
    assert.ok(findPath(source, source.spawn, route).length, from);
    const inside = {x:x - 2 * dx, y:y - 2 * dy};
    assert.equal(isSegmentWalkable(source, inside, route), true);
    assert.equal(approachingExit(route, inside, route), true);
    assert.equal(approachingExit(route, route, inside), false);
    const [rx, ry] = destination.exitAnchors[back];
    const arrival = roomArrival(destination, {fromRoom:from, direction:dir, exits:[{dir:back,target:from,x:rx,y:ry,radius:17}]});
    assert.equal(arrival?.entrance, back, to);
    assert.equal(arrival.matched, true);
    assert.ok(Math.hypot(arrival.x - rx, arrival.y - ry) > 25);
    assert.equal(isSegmentWalkable(destination, arrival, [rx,ry]), true);
    assert.ok(findPath(destination, arrival, destination.spawn).length);
  }
});

test('浅坑东南切口与牧场西北铺装路可以沿图走完，岩沿不可横穿', () => {
  const crater = DESERT_ARRIVAL_LAYOUT.shallow_crater;
  for (const [scene, points] of [
    [crater, [[232,169],[286,194],[307,210],[339,219],[362,234],[386,250],[410,266],[422,275]]],
    [RANCH_PERIMETER_LAYOUT.nw_ranch, [[157,113],[124,99],[94,79],[64,59],[40,44],[18,29]]],
  ]) {
    for (let i = 1; i < points.length; i++) {
      assert.ok(isSegmentWalkable(scene, points[i-1], points[i]), points[i].join(','));
    }
  }
  for (const edge of [[385,227],[365,261],[424,237]]) {
    assert.equal(isBlocked(crater, ...edge), true, edge.join(','));
  }
});

function exits(roomId) {
  const rules = ROOMS[roomId].exits({});
  const scene = RANCH_PERIMETER_LAYOUT[roomId];
  return Object.entries(scene.exitAnchors).map(([dir, [x, y]]) => ({
    dir, target: rules[dir]?.to || rules[dir], x, y, radius: 17, approach: scene.exitApproaches?.[dir],
  }));
}

test('牧场外围主环遵循章节的十个行走方向，后续支路和门另留位置', () => {
  assert.deepEqual(Object.keys(RANCH_PERIMETER_LAYOUT).sort(), [...ring].sort());
  for (const [index, id] of ring.entries()) {
    const scene = RANCH_PERIMETER_LAYOUT[id];
    const routes = exits(id);
    const neighbours = [ring[(index + 1) % ring.length], ring[(index + ring.length - 1) % ring.length]];
    assert.deepEqual(routes.map(route => route.target).filter(target => ring.includes(target)).sort(), neighbours.sort(), id);
    const rules = ROOMS[id].exits({});
    const shown = Object.keys(rules).filter(dir => !scene.hiddenExitDirs.includes(dir));
    assert.deepEqual(shown.sort(), routes.map(route => route.dir).sort(), id);
    const image = readFileSync(new URL(scene.image, new URL('../', import.meta.url)));
    const ratio = image.readUInt32BE(16) / image.readUInt32BE(20);
    assert.ok(Math.abs(ratio - 5 / 3) < 0.01, id);
    for (const feature of scene.reservedFeatures) {
      assert.ok(!routes.some(route => route.target === feature.target), id);
      for (const dir of feature.dirs) {
        const rule = rules[dir];
        assert.equal(typeof rule === 'string' ? rule : rule?.to, feature.target, id + ' ' + dir);
      }
    }
  }
});

test('主环各去向和真实来向的足底都能通行，走回场内不会触发折返', () => {
  for (const fromRoom of ring) {
    const scene = RANCH_PERIMETER_LAYOUT[fromRoom];
    assert.equal(isBlocked(scene, ...scene.spawn), false, fromRoom);
    for (const route of exits(fromRoom).filter(exit => ring.includes(exit.target))) {
      const mark = fromRoom + ' ' + route.dir;
      assert.ok(findPath(scene, scene.spawn, route).length > 0, mark);
      const next = RANCH_PERIMETER_LAYOUT[route.target];
      const returns = exits(route.target);
      const reverse = returns.find(exit => exit.target === fromRoom);
      const arrival = roomArrival(next, { fromRoom, direction: route.dir, exits: returns });
      assert.ok(arrival?.matched, mark);
      assert.equal(arrival.entrance, reverse.dir, mark);
      const authored = next.sourceArrivals[fromRoom];
      assert.deepEqual([arrival.x, arrival.y, arrival.face], [authored.x, authored.y, authored.face], mark);
      assert.equal(isBlocked(next, arrival.x, arrival.y), false, mark);
      assert.ok(findPath(next, arrival, next.spawn).length > 0, mark);
      assert.ok(Math.hypot(arrival.x - reverse.x, arrival.y - reverse.y) > reverse.radius + 8, mark);
      const [dx, dy] = directions[reverse.dir];
      const outward = { x: reverse.x - dx * 2, y: reverse.y - dy * 2 };
      assert.equal(isSegmentWalkable(next, outward, reverse), true, mark);
      assert.equal(approachingExit(reverse, outward, reverse), true, mark);
      assert.equal(approachingExit(reverse, reverse, outward), false, mark);
    }
  }
});

test('沿成图路心连续行走，院墙、闭门和蓄水池墙挡住脚底', () => {
  const samples = {
    nw_ranch: {
      path:[[150,275],[149,228],[143,180],[145,152],[158,121],[179,106],[205,96],[270,86],[395,88],[464,88]],
      blocked:[[228,134],[338,120],[350,193]],
    },
    ne_ranch: {
      path:[[16,88],[135,92],[188,100],[216,112],[239,127],[253,153],[259,182],[255,235],[249,275]],
      blocked:[[202,153],[382,164],[350,219]],
    },
    front_yard: {
      path:[[209,16],[201,52],[205,89],[217,125],[222,152],[218,185],[207,229],[199,275]],
      blocked:[[338,155],[154,157],[423,130]],
    },
    se_ranch: {
      path:[[16,163],[110,160],[157,155],[193,146],[226,132],[250,112],[268,91],[276,65],[275,16]],
      blocked:[[182,94],[363,75],[122,119]],
    },
    sw_ranch: {
      path:[[160,16],[155,52],[152,94],[153,124],[164,149],[182,163],[206,178],[246,185],[331,189],[464,188]],
      blocked:[[245,109],[325,129],[206,65]],
    },
  };
  for (const [id, {path, blocked}] of Object.entries(samples)) {
    const scene = RANCH_PERIMETER_LAYOUT[id];
    for (let i = 1; i < path.length; i++) {
      assert.equal(isSegmentWalkable(scene, path[i-1], path[i]), true, `${id} ${path[i-1]} → ${path[i]}`);
    }
    const closed = scene.doorPlacement ? {...scene,obstacles:scene.doorPlacement.closedObstacles} : scene;
    for (const point of blocked) {
      assert.equal(isBlocked(closed, ...point), true, `${id} ${point}`);
    }
    if (scene.doorPlacement) {
      const door = scene.doorPlacement;
      const opened = {...scene,obstacles:door.openObstacles};
      assert.equal(isBlocked(closed, ...door.at), true, id+' 关门');
      assert.equal(isBlocked(closed, ...door.approach), false, id+' 门前');
      assert.ok(findPath(opened, scene.spawn, door.at).length, id+' 开门');
      assert.ok(findPath(opened, scene.spawn, door.openLeafApproach).length, id+' 打开的门扇旁可站');
      assert.equal(isBlocked(closed,...door.openLeafApproach),false,id+' 合门后仍有落脚处');
    }
  }
});

test('图上支路能走到近端，关闭的门止步、敞开的门可走到门槛', () => {
  const northwest = RANCH_PERIMETER_LAYOUT.nw_ranch;
  const gate = northwest.doorPlacement;
  for (const obstacles of [gate.closedObstacles,gate.openObstacles]) {
    const ground = {...northwest,obstacles};
    const arrival = northwest.sourceArrivals.back_yard;
    assert.ok(isSegmentWalkable(ground,arrival,[209,124]));
    assert.ok(isSegmentWalkable(ground,[209,124],gate.approach));
    assert.ok(isSegmentWalkable(ground,arrival,gate.openLeafApproach));
  }
  for (const [id, scene] of Object.entries(RANCH_PERIMETER_LAYOUT)) {
    for (const feature of scene.reservedFeatures) {
      if (feature.kind === 'unresolved') {
        assert.equal(feature.at, undefined, id);
        continue;
      }
      if (feature.kind === 'closed-gate') {
        assert.equal(isBlocked(scene, ...feature.at), true, id);
      }
      const near = feature.approach || feature.at;
      assert.equal(isBlocked(scene, ...near), false, id);
      assert.ok(findPath(scene, scene.spawn, near).length, id + ' ' + feature.kind);
    }
    for (let i = 0; i < 8; i++) {
      const [x, y] = scene.looseAnchor;
      const slot = [x + (i % 3 - 1) * 9, y + Math.floor(i / 3) * 7];
      assert.equal(isBlocked(scene, ...slot), false, id + ' ' + slot);
    }
  }
});

test('前院每条来路都能经石墙缺口到同一坡道，回前院时落在坡脚右侧', () => {
  const yard = RANCH_PERIMETER_LAYOUT.front_yard;
  const ramp = exits('front_yard').filter(exit => exit.target === 'front_deck');
  assert.equal(ramp.length, 1);
  assert.equal(ramp[0].dir, 'w');
  assert.deepEqual(yard.interactionExitDirs, ['w']);
  const landing = roomArrival(yard, {fromRoom:'front_deck',direction:'e',exits:ramp});
  assert.deepEqual([landing.x,landing.y,landing.face], [183,124,'right']);
  assert.ok(Math.hypot(landing.x - ramp[0].x, landing.y - ramp[0].y) > yard.passageVisuals.w.radius);
  assert.ok(isSegmentWalkable(yard, landing, [203,126]));
  for (const arrival of Object.values(yard.sourceArrivals)) {
    assert.ok(findPath(yard, arrival, ramp[0]).length);
  }
});

test('牧场东南的敞开铁门只有一个穿门口，回外墙时向场内走不会折返', () => {
  const scene = RANCH_PERIMETER_LAYOUT.se_ranch;
  const routes = exits('se_ranch');
  const gates = routes.filter(exit => exit.target === 'se_yard');
  assert.equal(gates.length, 1);
  const gate = gates[0];
  assert.equal(gate.dir, 'nw');
  const landing = roomArrival(scene, {fromRoom:'se_yard',direction:'se',exits:routes});
  assert.deepEqual([landing.x,landing.y,landing.face], [230,119,'down']);
  assert.ok(Math.hypot(landing.x - gate.x, landing.y - gate.y) > gate.radius + 8);
  assert.ok(isSegmentWalkable(scene, landing, gate));
  assert.equal(approachingExit(gate, {x:209,y:91}, gate), true);
  assert.equal(approachingExit(gate, gate, {x:209,y:91}), false);
  for (const post of [[190,103],[222,76]]) assert.equal(isBlocked(scene, ...post), true);
});
