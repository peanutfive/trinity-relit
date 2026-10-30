import {resolveInteraction} from './interaction-intent.js';
const flag=(s,key)=>s.hasFlag?.(key)??(s.flags instanceof Set?s.flags.has(key):(s.flags||[]).includes(key));
const navigation=/^(?:n|ne|e|se|s|sw|w|nw|u|d|in|out|enter door|enter water)$/;
// The nearby prompt and the F handler consume this same read-only decision.
// A selected prop must never relabel a passage as a puzzle-item combination.
export function keyboardInteraction(state,target,{heldItem=null,observed=new Set()}={}){
  const passage=['passage','mushroom_gate','japan_door','stairs','door','water_edge'].includes(target?.kind);
  const self=state.room==='orbit_satellite'&&heldItem==='axe'&&!passage
    ||['underground_2','underground_3'].includes(state.room)&&heldItem==='lantern'&&!flag(state,'lantern_on')&&!passage;
  if(self)return {type:'self',hint:'使用手中物品'};
  if(!target)return null;
  const command=resolveInteraction(state,target,{heldItem,observed});
  const inspecting=/^(examine |read |look$)/.test(command||'');
  const hint=navigation.test(command||'')?'通行':command==='wait'?'等候':inspecting?'观察':heldItem?'使用手中物品':observed.has(target.id)?target.label:'观察';
  return {type:'target',target,command,hint};
}
export const chapterObjective=chapter=>({
  prologue:'沿着小径探索，留意身边的人、物品与环境变化。',
  wabe:'沿林间小路前行，留意石头、植物与光影中的细节。',
  japan:'留意沙堆、避难所与身旁的人。',
  underground:'观察通道、光线与身边的装置。',
  orbit:'留意泡膜、卫星与远处的白门。',
}[chapter]||'观察周围，再试试手中物品能做什么。');
