import assert from 'node:assert/strict';
import {SCENES} from '../scene-manifest.js';
import {NAVIGATION_REVIEW} from '../navigation-review.js';
import {roomArrival} from '../arrivals.js';
import {isBlocked,approachingExit} from '../world.js';

assert.deepEqual(Object.keys(NAVIGATION_REVIEW).sort(),Object.keys(SCENES).sort(),'每个已制作场景都须有独立道路审查记录');
let checked=0,matched=0;
for(const [id,scene]of Object.entries(SCENES)){
  const review=NAVIGATION_REVIEW[id];
  assert.ok(review.issues.length,`${id}缺审查证据`);
  assert.ok(['revise','sample','approved'].includes(review.status),id);
  for(const exit of scene.exits){
    const target=SCENES[exit.target],arrival=roomArrival(target,{fromRoom:id,direction:exit.dir,exits:target.exits});
    assert.ok(arrival&&!isBlocked(target,arrival.x,arrival.y),`${id}→${exit.target}没有安全入口落点`);
    if(arrival.matched)matched++;
    // Deliberately step away while still within the sensor. A distance-only
    // implementation would silently return to the room we just left.
    const angle=.73,from={x:exit.x+Math.cos(angle)*8,y:exit.y+Math.sin(angle)*8},to={x:exit.x+Math.cos(angle)*9,y:exit.y+Math.sin(angle)*9};
    assert.equal(approachingExit(exit,from,to),false,`${id}.${exit.dir}远离时误切房`);
    checked++;
  }
  console.log(`${id}: ${review.status} · ${review.issues.join(' ')}`);
}
const approved=Object.values(NAVIGATION_REVIEW).filter(review=>review.status==='approved').length;
console.log(`\n覆盖${Object.keys(SCENES).length}场景/${checked}出口；安全落点与远离出口不误切检查通过，${matched}条按真实返回口匹配。`);
console.log(`道路美术发布批准${approved}/${Object.keys(SCENES).length}。热点可达检查通过不代表视觉道路体验合格。`);
if(process.argv.includes('--release')&&approved!==Object.keys(SCENES).length){
  console.error('发布门槛未满足：须先修订道路/出口美术，并以隐藏文字箭头的真实双向行走逐房批准。');
  process.exitCode=1;
}
