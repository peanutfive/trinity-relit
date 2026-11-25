import test from 'node:test';
import assert from 'node:assert/strict';
import { SCENES, sceneBoundaries } from '../scene-manifest.js';
import { roomArrival } from '../arrivals.js';
import { findPath, isBlocked, isSegmentWalkable } from '../world.js';
import { GameState } from '../../js/engine.js';
import { getIsletHotspots } from '../islet-actions.js';
import { ISLET_ROOMS } from '../ferry-islet.js';
import { createNarrativeDirector } from '../narrative.js';
import { currentPlate } from '../art.js';
import { pointerTarget } from '../interaction-targets.js';
import { resolveInteraction } from '../interaction-intent.js';
import { createNavigationSceneCache } from '../navigation-scene.js';

test('沙洲真正的南侧沙地能往返，两处观察都能站在岸上完成', () => {
  const state = new GameState();
  state.room='sand_bar'; state.chapter='islet';
  assert.equal(ISLET_ROOMS.sand_bar.exits(state).s,'islet');
  assert.equal(ISLET_ROOMS.islet.exits(state).n,'sand_bar');
  assert.match(ISLET_ROOMS.sand_bar.desc(state),/firmer to the south/);
  assert.doesNotMatch(ISLET_ROOMS.islet.desc(state),/firmer to the/);
  const ground=getIsletHotspots(state).filter(object=>['sandbar_water','sandbar_sand'].includes(object.kind));
  assert.equal(ground.length,2);
  for(const target of ground) {
    assert.ok(findPath(SCENES.sand_bar,SCENES.sand_bar.spawn,target).length);
    assert.equal(isBlocked(SCENES.sand_bar,target.x,target.y),false);
    assert.equal(isBlocked(SCENES.sand_bar,target.pointerShape.x,target.pointerShape.y),target.kind==='sandbar_water');
  }
});

test('沙洲的画面、前景遮挡和可点击的门同时匹配玩家实际经历的渡程', () => {
  const scene=SCENES.sand_bar;
  const navigation=createNavigationSceneCache();
  for (const flags of [[],['ferry_paid','river_ferry_crossed'],['ferry_paid'],['wabe_to_islet_used']]) {
    const state=new GameState();
    state.room='sand_bar'; state.chapter='islet';
    for (const flag of flags) state.setFlag(flag);
    const oldTrip=flags.length===1;
    assert.equal(getIsletHotspots(state).some(object=>object.kind==='islet_gate'),oldTrip);
    const plate=currentPlate(scene.background,state);
    assert.equal(plate===scene.background.variant,oldTrip);
    assert.equal(currentPlate(scene.background,state.serialize()),plate);
    const occluders=plate.occluders ?? scene.occluders;
    assert.equal(occluders.length>0,oldTrip);
    const ground=navigation(scene,[],plate.walkablePolygons);
    assert.equal(isBlocked(ground,151,177),oldTrip);
    if (!oldTrip) assert.ok(findPath(ground,scene.spawn,[151,177]).length);
    state.room='islet';
    assert.ok(getIsletHotspots(state).some(object=>object.kind==='islet_gate'));
  }
});

test('船上交币穿雾后抵达沙洲，跳过及读档保持已结算的行程', () => {
  const director=createNarrativeDirector();
  const before={room:'the_river',chapter:'wabe',flags:['river_ferry_onboard']};
  const after={room:'sand_bar',chapter:'islet',flags:['river_ferry_crossed']};
  director.onCommand(before,after,'give silver coin to oarsman');
  assert.equal(director.getState(after).sceneRoom,'the_river');
  director.update(1.2);
  assert.equal(director.getState(after).sceneRoom,'sand_bar');
  const operations=[];
  director.draw({save(){},restore(){},fillRect(){operations.push(this.globalAlpha);}},'sand_bar',after);
  assert.deepEqual(operations,[1]);
  director.skip();
  assert.equal(director.getState(after).busy,false);
  assert.equal(createNarrativeDirector().getState(after).sceneRoom,'sand_bar');
});

test('小岛的菌盖可以反复查看，只有菌柄上的门能穿过', () => {
  const state=new GameState();
  state.room='islet'; state.chapter='islet';
  const objects=getIsletHotspots(state);
  const crown=pointerTarget(objects,{x:376,y:82});
  const door=pointerTarget(objects,{x:363,y:135});
  assert.equal(crown.id,'islet:crown');
  assert.equal(door.id,'islet:gate');
  const observed=new Set([crown.id,door.id]);
  assert.equal(resolveInteraction(state,crown,{observed}),'examine toadstool');
  assert.equal(resolveInteraction(state,door,{observed}),'enter door');
});

test('渡口及白门的来向落点可步行离开，且不创建反向道路', () => {
  const passages = [
    ['the_river', 'give silver coin to oarsman', 'sand_bar', 'ferry'],
    ['the_river', 'in', 'islet', 'ferry'], // older paid passage
    ['islet', 'enter door', 'shallow_crater', 'door'],
    ['sand_bar', 'enter door', 'shallow_crater', 'door'],
  ];
  for (const [fromRoom, direction, target, entrance] of passages) {
    const scene = SCENES[target];
    const arrival = roomArrival(scene, { fromRoom, direction, exits: scene.exits });
    assert.equal(arrival?.entrance, entrance);
    assert.equal(arrival.fromRoom, fromRoom);
    assert.equal(isBlocked(scene, arrival.x, arrival.y), false);
    assert.ok(findPath(scene, arrival, scene.spawn).length, `${fromRoom}→${target}`);
    assert.equal(scene.exits.some(exit => exit.target === fromRoom), false);
  }
});

test('浅坑两侧鞍口保留原走法，已制作的沙路延伸可通行', () => {
  for (const [room, dir, target] of [['desert_5', 'w', 'desert_4'], ['desert_6', 'e', 'desert_7']]) {
    const scene = SCENES[room];
    const state = new GameState();
    state.room = room;
    state.chapter = 'desert';
    const exit = scene.exits.find(exit => exit.dir === dir);
    assert.equal(exit?.target, target);
    assert.equal(sceneBoundaries(room, state).some(boundary => boundary.dir === dir), false);
    assert.ok(findPath(scene, scene.spawn, exit).length, room);
  }
  const crater = SCENES.shallow_crater;
  assert.equal(isSegmentWalkable(crater, [30, 145], [16, 145]), true);
  assert.equal(isSegmentWalkable(crater, [444, 129], [458, 129]), true);
});
