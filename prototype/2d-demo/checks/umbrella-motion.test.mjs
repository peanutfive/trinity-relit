import test from 'node:test';import assert from 'node:assert/strict';
import {UMBRELLA_CUES,UMBRELLA_DURATION,umbrellaScene,idleUmbrellaVisual,BODY_POSES} from '../umbrella-motion.js';
const a={umbrellaWoman:{x:194,y:159},umbrella:{x:325,y:120},tree:{x:300,y:145}};
test('opening includes prepare/raise/open/support/brace before a visible two-second flight',()=>{
 assert.deepEqual(UMBRELLA_CUES.slice(0,6).map(c=>c[0]),['prepare','raise','open','hold','brace','released']);
 for(const [action,start,end]of UMBRELLA_CUES){const s=umbrellaScene((start+end)/2,a);assert.equal(s.action,action);assert.equal(s.body.standing,true);assert.ok(Number.isFinite(s.umbrella.x));}
 const before=umbrellaScene(4.9-.0001,a),after=umbrellaScene(4.9,a);assert.ok(Math.hypot(before.umbrella.x-after.umbrella.x,before.umbrella.y-after.umbrella.y)<.02,'no release teleport');
 const mid=umbrellaScene(6,a),land=umbrellaScene(7.8,a);assert.ok(mid.umbrella.y<90,'gust visibly lifts above the actors');
 assert.deepEqual([land.umbrella.x,land.umbrella.y],[325,120]);assert.equal(land.umbrella.openness,1);
});
test('motion paths stay continuous at stage boundaries and finish with exact tree anchor',()=>{
 for(const [,start]of UMBRELLA_CUES.slice(6)){const x=umbrellaScene(start-.0001,a),y=umbrellaScene(start,a);assert.ok(Math.hypot(x.body.x-y.body.x,x.body.y-y.body.y)<.03,'body does not jump stage boundaries');assert.ok(Math.hypot(x.umbrella.x-y.umbrella.x,x.umbrella.y-y.umbrella.y)<.03);}
 assert.deepEqual(umbrellaScene(UMBRELLA_DURATION,a).umbrella,{...umbrellaScene(UMBRELLA_DURATION,a).umbrella,x:325,y:120});
});
test('idle struggle visibly raises and partly opens the canopy without advancing world counters',()=>{
 assert.equal(idleUmbrellaVisual(0).bodyFrame,0);assert.equal(idleUmbrellaVisual(1.5).bodyFrame,1);assert.equal(idleUmbrellaVisual(2.7).bodyFrame,2);
 assert.ok(idleUmbrellaVisual(3).openness>.3);assert.ok(idleUmbrellaVisual(3).openness<1);
 assert.equal(BODY_POSES.length,9);
});
