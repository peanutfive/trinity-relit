import {resolveInteraction} from './interaction-intent.js';
const navigation=/^(?:n|ne|e|se|s|sw|w|nw|u|d|in|out|enter door|enter water|enter dory|exit dory)$/;
function physicalHint(command,target){
  if(command==='move log')return '试着搬动';
  if(command==='put ruby on box')return '放在箱盖上';
  if(command==='look at roadrunner through binoculars')return '举起望远镜';
  if(command==='put slip in book')return '夹入书中';
  if(command==='take slip')return '拾起书签';
  if(command==='put gnomon in hole')return '装入指针';
  if(command==='unscrew gnomon')return '拧下指针';
  if(command==='take gnomon')return '拾起指针';
  if(command==='give silver coin to oarsman')return '递出银币';
  if(command==='give credit card to oarsman')return '递出信用卡';
  if(command==='give spade to oarsman')return '递出铲子';
  if(command==='take map'||command==='take sink'||command==='take stove pipes')return '试着取下';
  if(command?.endsWith(' in cupboard'))return '放进橱柜';
  if(target.kind==='ranch_tableware'||target.visualOptions?.onShelf && command?.startsWith('take '))return '拿起';
  if(command==='open box')return '打开';
  if(/^push (switch|button)$/.test(command||''))return '按下';
  return null;
}
// The nearby prompt and the F handler consume this same read-only decision.
// A selected prop must never relabel a passage as a puzzle-item combination.
export function keyboardInteraction(state,target,{heldItem=null,observed=new Set()}={}){
  const passage=['passage','mushroom_gate','pacific_gate','tundra_gate','islet_gate','islet_ferry','japan_door','stairs','door','water_edge'].includes(target?.kind);
  const self=state.room==='orbit_satellite'&&heldItem==='axe'&&!passage;
  const command=target && resolveInteraction(state,target,{heldItem,observed});
  if(heldItem==='lantern' && state.has('lantern') && !passage && !command)return {type:'self',hint:'拨动灯的开关'};
  if(self)return {type:'self',hint:'使用手中物品'};
  if(!target)return heldItem==='paperback'?{type:'self',hint:'翻阅'}:null;
  const inspecting=/^(examine |read |look$)/.test(command||'');
  const physical=physicalHint(command,target);
  const hint=target.physicalHint|| (navigation.test(command||'')?target.navigationHint||'通行':command==='wait'?'等候':inspecting?target.inspectionHint||'观察':physical|| (heldItem?'使用手中物品':observed.has(target.id)?target.label:'观察'));
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
