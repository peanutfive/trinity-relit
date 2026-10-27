import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame} from './harness.mjs';
import {Parser} from '../prototype/js/parser.js';
import {ITEMS} from '../prototype/js/data/items.js';
import {prologueClock} from '../prototype/js/prologue-time.js';
import {restorePrologueTime} from '../prototype/js/data/prologue.js';
const road=['e','take ball','nw','unscrew gnomon','take gnomon','n','take paper bird','open paper bird','w','buy crumbs','feed birds','take ruby','n','push pram','push pram','wait','throw ball at tree','take umbrella','push pram','open pram','enter pram','open umbrella'];
async function act(g,c){const n=g.output.length;await g.eng.processInput(c);return g.output.slice(n).filter(o=>o.type==='text').map(o=>o.text).join('\n');}
async function lake(extra=0){const g=createGame();for(let i=0;i<extra;i++)await act(g,'wait');for(const c of road){await act(g,c);assert.ok(!g.state.dead,c);}assert.equal(g.state.room,'long_water');return g;}
const elapsed=g=>prologueClock(g.state).elapsed;

test('原版手表3:30开始，普通动作15秒、WAIT60秒；TIME与背包/分数不推进时钟',async()=>{
 const g=createGame();assert.equal(elapsed(g),0);
 assert.match(await act(g,'examine watch'),/3:30:00 pm/);assert.equal(elapsed(g),15);
 await act(g,'wait');assert.equal(elapsed(g),75);
 const before=g.state.turns;assert.match(await act(g,'time'),/3:31:15 pm/);assert.equal(g.state.turns,before);assert.equal(elapsed(g),75);
 for(const c of ['inventory','score','help','nonsense'])await act(g,c);assert.equal(elapsed(g),75);
 assert.match(await act(g,'read watch'),/3:31:15 pm/);assert.equal(elapsed(g),90);
});
test('一回合WAIT等于无事件的四次LOOK；两种推进都会抵达相同钟表时刻',async()=>{
 const a=createGame(),b=createGame();await act(a,'wait');for(let i=0;i<4;i++)await act(b,'look');assert.equal(elapsed(a),60);assert.equal(elapsed(a),elapsed(b));
});
test('等待被可见NPC事件打断，男孩吹泡泡只经过一个15秒周期',async()=>{
 const g=createGame();g.eng.moveTo('inverness_terrace');const before=elapsed(g);
 await act(g,'wait');assert.equal(elapsed(g)-before,15);assert.equal(g.state.cnt('boy_cycle'),1);
 const cycle=g.state.cnt('boy_cycle');await act(g,'time');assert.equal(g.state.cnt('boy_cycle'),cycle);
});
test('原版警报从3:57:45触发，WAIT被警报打断；倒计时最终死亡而非无限等候',async()=>{
 const g=createGame();for(let i=0;i<110;i++)await act(g,'look');assert.equal(elapsed(g),1650);
 const text=await act(g,'wait');assert.match(text,/Air-raid sirens/);assert.equal(elapsed(g),1680);assert.equal(g.state.cnt('doom_phase'),1);
 for(let i=0;i<8;i++)await act(g,'look');assert.equal(g.state.dead,true);assert.equal(g.state.cnt('doom_phase'),9);
});
test('早到/多等十二分钟的两条正常路线都能到湖，抵达后固定3:59:45而非四点准入',async()=>{
 for(const extra of [0,12]){const g=await lake(extra);assert.equal(elapsed(g),1785);assert.equal(g.state.cnt('long_water_phase'),0);assert.ok(!g.state.hasFlag('missile_visible'));assert.ok(!g.state.hasFlag('white_door_visible'));assert.ok(g.state.wearing('watch'));assert.match(ITEMS.watch.desc(g.state),/3:59:45 pm/);assert.match(ITEMS.watch.desc(g.state),/seconds.*stopped/);}
});
test('冻结的手表不等于冻结危险：静寂、导弹、门、乌鸦、水禽、圆木、毁灭各出现一次',async()=>{
 const g=await lake(),pieces=[];
 for(let i=1;i<=7;i++){pieces.push(await act(g,'wait'));assert.equal(elapsed(g),1785);assert.equal(g.state.cnt('long_water_phase'),i);}
 for(const [i,re]of [[0,/Everything is very quiet/],[1,/missile is hanging/],[2,/white door, suspended/],[3,/flock of ravens/],[4,/Swans and ducks/],[5,/A log is being pushed/],[6,/vaporized in extreme slow motion/]])assert.match(pieces[i],re);
 assert.equal(pieces.filter(t=>/flock of ravens/.test(t)).length,1);assert.equal(g.state.dead,true);
});
test('先涉水再等门；不可见的门不产生时间，原版SWIM/WAIT/WAIT/ENTER DOOR可成功',async()=>{
 const g=await lake();await act(g,'swim');assert.equal(g.state.room,'wading');assert.equal(g.state.cnt('long_water_phase'),1);assert.ok(!g.eng.currentRoom().desc(g.state).includes('white door'));
 const before=g.state.turns;for(let i=0;i<3;i++)assert.match(await act(g,'enter door'),/can't see any white door/);assert.equal(g.state.turns,before);assert.equal(g.state.cnt('long_water_phase'),1);
 await act(g,'wait');assert.ok(g.state.hasFlag('missile_visible'));assert.ok(!g.state.hasFlag('white_door_visible'));await act(g,'wait');assert.ok(g.state.hasFlag('white_door_visible'));
 await act(g,'enter door');assert.equal(g.state.chapter,'wabe');assert.equal(g.state.room,'meadow');assert.equal(g.state.timer,null);assert.equal(prologueClock(g.state).frozen,false);assert.match(ITEMS.watch.desc(g.state),/digits are flashing randomly/);
});
test('湖岸南行不再成为涉水捷径；E/IN/涉水入口一致，来回岸边不重置事件窗口',async()=>{
 const g=await lake();assert.match(await act(g,'s'),/tracks/);assert.equal(g.state.room,'long_water');assert.equal(g.state.cnt('long_water_phase'),2);
 await act(g,'e');assert.equal(g.state.room,'wading');assert.equal(g.state.cnt('long_water_phase'),3);
 await act(g,'out');assert.equal(g.state.room,'long_water');assert.equal(g.state.cnt('long_water_phase'),4);assert.equal(elapsed(g),1785);
 assert.match(await act(g,'enter door'),/couldn't do that/);assert.equal(g.state.room,'long_water');assert.equal(g.state.cnt('long_water_phase'),5);
 await act(g,'enter water');assert.equal(g.state.room,'wading');assert.equal(g.state.cnt('long_water_phase'),6);const crossing=await act(g,'enter door');assert.match(crossing,/You wade to the threshold of the white door/);assert.ok(!crossing.includes('roadrunner flutters past'),'圆木上已经过门的走鹃不再次穿门');assert.equal(g.state.chapter,'wabe');assert.equal(g.state.dead,false);
});
test('新档精确恢复时钟/冻结阶段；旧湖岸无timer档迁移后仍继续危险而不重置门',async()=>{
 const g=await lake();await act(g,'enter water');await act(g,'wait');await act(g,'wait');const saved=JSON.parse(JSON.stringify(g.eng.serialize())),a=createGame();await a.eng.deserialize(saved);restorePrologueTime(a.state);assert.deepEqual(a.state.serialize(),g.state.serialize());
 const old=structuredClone(saved);old.state.flags=old.state.flags.filter(f=>!f.startsWith('prologue_clock')&&f!=='prologue_time_frozen');for(const k of Object.keys(old.state.counters))if(k.startsWith('prologue_')||k.startsWith('long_water_'))delete old.state.counters[k];old.state.timer=null;
 const b=createGame();await b.eng.deserialize(old);restorePrologueTime(b.state);assert.equal(elapsed(b),1785);assert.equal(b.state.cnt('long_water_phase'),3);assert.equal(b.state.timer.id,'doomsday');await act(b,'wait');assert.equal(b.state.cnt('long_water_phase'),4);assert.ok(b.state.hasFlag('white_door_visible'));
});
test('时间与涉水词走确定解析；未知输入仍不改变时钟或窗口',async()=>{
 const parser=new Parser();for(const c of ['swim','wade','wade into the water','游泳','涉水','进入湖水'])assert.deepEqual(parser.parse(c),{type:'simple',verb:'enter',noun:'water'});
 const g=await lake(),before=g.state.serialize();for(const c of ['garble','open nonexistent'])await act(g,c);assert.deepEqual(g.state.serialize(),before);
});
