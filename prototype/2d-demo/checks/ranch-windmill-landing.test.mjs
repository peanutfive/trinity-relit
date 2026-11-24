import test from 'node:test';
import assert from 'node:assert/strict';
import { ROOMS } from '../../js/data/ranch.js';
import { roomArrival } from '../arrivals.js';
import { RANCH_WINDMILL_LANDING_LAYOUT } from '../ranch-windmill-landing-layout.js';
import { approachingExit, findPath, isBlocked, isSegmentWalkable } from '../world.js';

const stage = RANCH_WINDMILL_LANDING_LAYOUT.windmill;

test('上梯从实际梯顶落地，沿木板可到望远镜外缘再回到同一处楼梯', () => {
  const [x,y] = stage.exitAnchors.d;
  const ladder = {dir:'d',target:'under_windmill',x,y,interactionOnly:true,radius:17};
  const arrival = roomArrival(stage, {fromRoom:'under_windmill',direction:'u',exits:[ladder]});
  assert.ok(arrival?.matched);
  assert.equal(arrival.entrance,'d');
  assert.ok(Math.hypot(arrival.x-x,arrival.y-y)>stage.passageVisuals.d.radius);
  const {approach} = stage.binocularsPlacement;
  for (const [from,to] of [[arrival,approach],[approach,ladder],[ladder,arrival]]) {
    assert.ok(findPath(stage,from,to).length);
  }
  assert.equal(isBlocked(stage,...approach),false);
  assert.equal(ROOMS.windmill.exits({}).d,ladder.target);
  assert.equal(ROOMS.windmill.exits({}).out,ladder.target);
  assert.deepEqual(stage.exitAnchors.d,stage.exitAnchors.out);
  assert.deepEqual(stage.interactionExitDirs,['d']);
  assert.deepEqual(stage.hiddenExitDirs,['out']);
  assert.equal(approachingExit(ladder,{x,y:y-2},ladder),false);
});

test('平台侧边、轴桩和梯子下面的地面都不能走过去', () => {
  for (const point of [[152,111],[331,119],[211,64],[241,159],[311,193],[253,74]]) {
    assert.equal(isBlocked(stage,...point),true,point.join(','));
    assert.deepEqual(findPath(stage,stage.spawn,point),[],point.join(','));
  }
  for (const [inside,beyond] of [
    [[184,112],[151,112]], [[298,107],[334,107]], [[208,129],[208,164]], [[226,94],[226,64]],
  ]) {
    assert.equal(isBlocked(stage,...inside),false);
    assert.equal(isSegmentWalkable(stage,inside,beyond),false);
  }
  const approach = stage.binocularsPlacement.approach;
  assert.ok(isSegmentWalkable(stage, [268,116], approach));
  assert.ok(isSegmentWalkable(stage, approach, stage.exitAnchors.d));
});
