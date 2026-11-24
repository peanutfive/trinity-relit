// Offline check of the SVG greyboxes against the project's text-runtime exits.
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ROOMS } from '../../js/data/ranch.js';
import { roomArrival } from '../arrivals.js';
import { approachingExit, findPath, isBlocked, isSegmentWalkable, leavingBoundaryExit } from '../world.js';

const roomIds = ['nw_ranch', 'ne_ranch', 'front_yard', 'se_ranch', 'sw_ranch'];
const width = 480, height = 288;
const radius = 17;
const sides = { n: [0, -1], e: [1, 0], s: [0, 1], w: [-1, 0] };
const inwardFace = { n: 'down', e: 'left', s: 'up', w: 'right' };
const words = value => (value || '').split(/\s+/).filter(Boolean);
const offset = ({ x, y }, [dx, dy], distance) => ({ x: x + dx * distance, y: y + dy * distance });
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const points = value => words(value).map(pair => pair.split(',').map(Number));
const toRoom = value => typeof value === 'string' ? value : value?.to;

// The authored files use plain SVG elements with quoted metadata attributes.
// Keeping the actual group hierarchy prevents a nested reserve from counting as an exit.
function readSvg(xml, name) {
  const root = { children: [] }, stack = [root];
  for (const [, closing, tag, content, selfClosing] of xml.matchAll(
    /<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<(\/?)([\w:-]+)([^<>]*?)\s*(\/?)>/g,
  )) {
    if (!tag) continue;
    if (closing) {
      assert.equal(stack.pop()?.tag, tag, `${name}: SVG closing tag`);
      continue;
    }
    const attrs = Object.fromEntries([...content.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)]
      .map(([, key, double, single]) => [key, double ?? single]));
    const node = { tag, attrs, children: [] };
    stack.at(-1).children.push(node);
    if (!selfClosing) stack.push(node);
  }
  assert.equal(stack.length, 1, `${name}: unterminated SVG element`);
  assert.equal(root.children.length, 1, name);
  assert.equal(root.children[0].tag, 'svg', name);
  return root.children[0];
}

function only(items, select, label) {
  const matches = items.filter(select);
  assert.equal(matches.length, 1, label);
  return matches[0];
}

function position(node, [x, y], label) {
  const point = { x: Number(node.attrs[x]), y: Number(node.attrs[y]) };
  assert.ok(node.attrs[x]?.trim() && node.attrs[y]?.trim()
    && point.x >= 12 && point.x <= width - 12 && point.y >= 12 && point.y <= height - 12,
  `${label}: foot position is outside the playable canvas`);
  return point;
}

function polygons(elements, label) {
  return elements.filter(element => element.tag === 'polygon').map(element => {
    const polygon = points(element.attrs.points);
    assert.ok(polygon.length >= 3 && polygon.every(pair => pair.length === 2 && pair.every(Number.isFinite)), label);
    return polygon;
  });
}

async function loadScene(room) {
  const file = `ranch-perimeter-${room}-v1.route-layout.svg`;
  const svg = readSvg(await readFile(new URL(`../assets/${file}`, import.meta.url), 'utf8'), file);
  assert.equal(svg.attrs['data-room'], room);
  assert.deepEqual(words(svg.attrs.viewBox).map(Number), [0, 0, width, height], room);
  const group = id => only(svg.children, item => item.tag === 'g' && item.attrs.id === id, `${room} #${id}`).children;
  const walkablePolygons = polygons(group('ring'), `${room}: ring polygon`);
  assert.equal(walkablePolygons.length, 1, room);
  const reserved = group('reserved');
  const barriers = group('barriers');
  const blockedPolygons = polygons(barriers.flatMap(element => element.children), `${room}: barrier polygon`);
  const feet = group('feet');
  const start = only(feet, node => node.tag === 'circle' && node.attrs.id === 'spawn', `${room}: spawn marker`);
  const spawn = position(start, ['cx', 'cy'], room);
  const exits = group('anchors').map(node => {
    assert.equal(node.tag, 'circle', `${room}: road anchor`);
    const dir = node.attrs['data-dir'], target = node.attrs['data-target'];
    assert.ok(Object.hasOwn(sides, dir), `${room}.${dir}: expected a cardinal road`);
    const label = `${room}.${dir}`;
    const anchor = position(node, ['cx', 'cy'], label);
    const arrival = position(node, ['data-arrival-x', 'data-arrival-y'], label);
    const face = node.attrs['data-face'];
    assert.equal(face, inwardFace[dir], label);
    only(feet, foot => foot.tag === 'circle' && !foot.attrs.id && Number(foot.attrs.cx) === arrival.x
      && Number(foot.attrs.cy) === arrival.y, `${label}: drawn landing marker`);
    return { ...anchor, dir, target, radius, arrival: { ...arrival, face } };
  });
  assert.equal(feet.length, exits.length + 1, `${room}: unexpected landing markers`);
  return { file, room, spawn: [spawn.x, spawn.y], exits, reserved, barriers,
    walkablePolygons, blockedPolygons, obstacles: [], footprint: { rx: 6, ry: 3 } };
}

function checkMetadata(scene) {
  const { room, exits, reserved, barriers } = scene;
  const textExits = ROOMS[room].exits();
  const supported = Object.fromEntries(Object.entries(textExits)
    .filter(([, target]) => typeof target === 'string' && roomIds.includes(target)));
  assert.equal(exits.length, 2, room);
  assert.deepEqual(Object.fromEntries(exits.map(({ dir, target }) => [dir, target])), supported, room);

  const deferred = Object.entries(textExits).map(([dir, value]) => [dir, toRoom(value)])
    .filter(([dir, to]) => to !== room && !Object.hasOwn(supported, dir));
  const drawnDeferred = reserved.flatMap(element => {
    assert.equal(element.tag, 'g', room);
    const dirs = words(element.attrs['data-dirs']);
    assert.ok(dirs.length, `${room}: unnamed reserved direction`);
    if (element.attrs['data-kind'] === 'unresolved') {
      assert.ok(element.children.every(child => child.tag === 'title' || child.tag === 'desc'),
        `${room}: an unresolved direction must have no drawn road`);
    } else {
      assert.equal(element.attrs['data-kind'], 'road', room);
      const centre = only(element.children, child => child.tag === 'polyline', `${room}: reserved centreline`);
      const line = points(centre.attrs.points);
      assert.ok(line.length >= 2 && line.every(pair => pair.length === 2 && pair.every(Number.isFinite)), room);
      assert.ok(isBlocked(scene, ...line.at(-1)), `${room}.${dirs.join('/')}: reserved limb ends on playable ground`);
    }
    return dirs.map(dir => [dir, element.attrs['data-target']]);
  });
  assert.deepEqual(drawnDeferred.sort(), deferred.sort(), `${room}: reserved claims differ from the runtime`);

  const blockedDirs = barriers.flatMap(element => words(element.attrs['data-blocked-dirs']));
  assert.deepEqual(blockedDirs.sort(), Object.entries(textExits).filter(([, value]) => toRoom(value) === room)
    .map(([dir]) => dir).sort(), `${room}: blocked approach metadata`);
  const gates = barriers.filter(element => ['open-gate', 'closed-gate', 'deck'].includes(element.attrs['data-kind']));
  for (const gate of gates) {
    const directions = words(gate.attrs['data-dirs']);
    assert.ok(directions.length, `${room}: entrance needs a direction`);
    assert.ok(reserved.some(element => words(element.attrs['data-dirs']).sort().join(' ') === directions.sort().join(' ')),
      `${room}: gate should annotate a reserved branch`);
    assert.ok(directions.every(dir => !Object.hasOwn(supported, dir)), `${room}: gate is encoded as a ring road`);
    const geometry = polygons(gate.children, room).flat();
    assert.ok(geometry.length, `${room}: missing gate geometry`);
    assert.ok(exits.every(exit => geometry.every(([x, y]) => distance(exit, { x, y }) > radius)),
      `${room}: gate geometry overlaps an exit sensor`);
  }
  return gates.map(({ attrs }) => ({ kind: attrs['data-kind'], directions: words(attrs['data-dirs']) }));
}

function checkEdges(scene) {
  const pointsOnEdge = {
    w: Array.from({ length: height - 23 }, (_, index) => [12, index + 12]),
    e: Array.from({ length: height - 23 }, (_, index) => [width - 12, index + 12]),
    n: Array.from({ length: width - 23 }, (_, index) => [index + 12, 12]),
    s: Array.from({ length: width - 23 }, (_, index) => [index + 12, height - 12]),
  };
  for (const [dir, band] of Object.entries(pointsOnEdge)) {
    const edgeHasGround = band.some(([x, y]) => !isBlocked(scene, x, y));
    assert.equal(edgeHasGround, scene.exits.some(exit => exit.dir === dir), `${scene.room}.${dir}: stray walkable edge`);
    const [dx, dy] = sides[dir];
    assert.ok(band.every(([x, y]) => isBlocked(scene, x + dx, y + dy)), `${scene.room}.${dir}: outer bounds`);
  }
}

const scenes = Object.fromEntries(await Promise.all(roomIds.map(async room => [room, await loadScene(room)])));
const roads = [], gates = [];
for (const scene of Object.values(scenes)) {
  gates.push(...checkMetadata(scene).map(gate => ({ room: scene.room, ...gate })));
  checkEdges(scene);
  assert.equal(isBlocked(scene, ...scene.spawn), false, scene.room);
  for (const exit of scene.exits) {
    const label = `${scene.room}.${exit.dir}`;
    const vector = sides[exit.dir];
    const start = offset(exit, vector, -radius - 6);
    const end = offset(exit, vector, 0);
    assert.ok(findPath(scene, scene.spawn, start).length, `${label}: no route to the approach`);
    assert.ok(isSegmentWalkable(scene, start, end), `${label}: final stride leaves the road`);
    assert.deepEqual(scene.exits.filter(candidate => approachingExit(candidate, start, end)), [exit],
      `${label}: outward stride should activate only its own exit`);
    assert.equal(approachingExit(exit, end, start), false, `${label}: inward stride must not cross a room`);
    const [x, y] = vector;
    const frameEdge = { x: { w: 12, e: width - 12 }[exit.dir] ?? exit.x,
      y: { n: 12, s: height - 12 }[exit.dir] ?? exit.y };
    assert.ok(isSegmentWalkable(scene, end, frameEdge), `${label}: painted road stops before the edge`);
    assert.equal(leavingBoundaryExit(exit, frameEdge, { x, y }), true, `${label}: held outward input`);
    assert.equal(leavingBoundaryExit(exit, frameEdge, { x: -x, y: -y }), false, `${label}: held inward input`);

    const destination = scenes[exit.target];
    const returnRoad = only(destination.exits, candidate => candidate.target === scene.room, `${label}: reciprocal road`);
    const landing = returnRoad.arrival;
    assert.ok(destination.exits.every(candidate => distance(candidate, landing) > candidate.radius + 8),
      `${label}: drawn return landing overlaps a road sensor`);
    assert.ok(findPath(destination, landing, destination.spawn).length, `${label}: drawn landing cannot leave the threshold`);
    const calculated = roomArrival(destination, { fromRoom: scene.room, direction: exit.dir, exits: destination.exits });
    assert.equal(calculated?.matched, true, `${label}: runtime shape did not choose the source road`);
    assert.equal(calculated.entrance, returnRoad.dir, label);
    assert.equal(isBlocked(destination, calculated.x, calculated.y), false, label);
    roads.push({ from: scene.room, dir: exit.dir, to: exit.target, entrance: returnRoad.dir, authoredLanding: landing });
  }
}
assert.equal(roads.length, 10);
const receipt = { sceneCount: roomIds.length, roadCount: roads.length, files: Object.values(scenes).map(scene => scene.file),
  roads, gates, verificationScope: 'SVG 灰盒和项目现有文字版外围出口，未接入运行版' };
if (process.env.QA_OUTPUT) {
  await mkdir(process.env.QA_OUTPUT, { recursive: true });
  await writeFile(join(process.env.QA_OUTPUT, 'result.json'), `${JSON.stringify(receipt, null, 2)}\n`);
}
console.log(`通过 ${roomIds.length} 处外围灰盒、${roads.length} 条有向步行路、来源落点、门和步行范围检查`);
