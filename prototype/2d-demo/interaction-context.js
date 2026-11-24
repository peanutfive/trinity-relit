import {resolveInteraction} from './interaction-intent.js';
const flag=(s,key)=>s.hasFlag?.(key)??(s.flags instanceof Set?s.flags.has(key):(s.flags||[]).includes(key));
const navigation=/^(?:n|ne|e|se|s|sw|w|nw|u|d|in|out|enter door|enter water)$/;
// The nearby prompt and the F handler consume this same read-only decision.
// A selected prop must never relabel a passage as a puzzle-item combination.
export function keyboardInteraction(state,target,{heldItem=null,observed=new Set()}={}){
  const passage=['passage','mushroom_gate','pacific_gate','tundra_gate','islet_gate','islet_ferry','japan_door','stairs','door','water_edge'].includes(target?.kind);
  const self=state.room==='orbit_satellite'&&heldItem==='axe'&&!passage
    ||['underground_2','underground_3'].includes(state.room)&&heldItem==='lantern'&&!flag(state,'lantern_on')&&!passage;
  if(self)return {type:'self',hint:'使用手中物品'};
  if(!target)return null;
  const command=resolveInteraction(state,target,{heldItem,observed});
  const inspecting=/^(examine |read |look$)/.test(command||'');
  const physical=command==='open box'?'打开':/^push (switch|button)$/.test(command||'')?'按下':null;
  const hint=target.physicalHint|| (navigation.test(command||'')?target.navigationHint||'通行':command==='wait'?'等候':inspecting?'观察':physical|| (heldItem?'使用手中物品':observed.has(target.id)?target.label:'观察'));
  return {type:'target',target,command,hint};
}
export const chapterObjective=chapter=>({
  prologue:'沿着小径探索，留意身边的人、物品与环境变化。',
  wabe:'沿林间小路前行，留意石头、植物与光影中的细节。',
  japan:'留意沙堆、避难所与身旁的人。',
  underground:'观察通道、光线与身边的装置。',
  orbit:'留意泡膜、卫星与远处的白门。',
  pacific:'沿海岸探索，留意脚手架的上下层与身边的装置。',
  tundra:'辨认冻土与山岩间的通路，留意平台和岩缝中的细节。',
  islet:'沿沙岸探索，留意雾中的水线、船与毒菌。',
  desert:'沿沙漠通路辨认浅坑与远处的地形。',
  ranch:'沿石墙和水库边的小径探索牧场。',
}[chapter]||'观察周围，再试试手中物品能做什么。');
