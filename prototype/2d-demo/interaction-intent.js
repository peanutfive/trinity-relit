import { ITEMS } from '../js/data/items.js';

// One physical intention at a time. Menus never reveal the puzzle's verb list.
export function resolveInteraction(state,object,{heldItem=null,observed=new Set()}={}) {
  if(!object)return null;
  const actions=object.actions||[],find=prefix=>actions.find(a=>a.command.startsWith(prefix))?.command;
  const seen=observed.has(object.id);
  if(object.kind==='orbit_membrane')return heldItem==='axe'&&state.room==='orbit_satellite'?find('break bubble'):find('examine ');
  if(object.kind==='water_edge')return find('enter water');
  // Doorways are navigation: carrying a prop must not lock the player inside.
  if(object.kind==='mushroom_gate')return seen
    ? actions.find(a=>a.command==='in')?.command||find('look') : find('look');
  if(object.kind==='japan_door')return seen?find('enter door')||find('look'):find('look');
  if(object.kind==='passage')return actions.find(a=>['n','s','e','in','w','out','u','d'].includes(a.command))?.command||null;
  if(object.kind==='japan_children')return find('wait');
  if(object.kind==='stairs')return find('u')||find('d')||find('look');
  if(object.kind==='door')return seen?find('enter door')||find('s')||find('examine '):find('examine ')||find('look');
  if(object.kind==='ug_barrow_door'){
    if(heldItem==='key_barrow')return find('put key');
    return seen?find('in'):find('examine ');
  }
  if(object.kind==='ug_hole'&&heldItem==='key_barrow')return find('put key');
  if(heldItem){
    if(object.kind==='japan_girl') {
      if(state.room==='playground'&&heldItem==='umbrella')return find('give umbrella');
      if(state.room==='shelter'&&heldItem==='paper_bird'&&state.hasFlag('bird_unfolded'))return find('give paper');
    }
    if(heldItem==='coin'&&object.kind==='woman'&&state.room==='broad_walk')return find('buy ');
    if(heldItem==='bag'&&['birds','pigeons'].includes(object.kind))return find('feed ');
    if(heldItem==='ball'&&['tree','umbrella','umbrella_tree'].includes(object.kind))return find('throw ball');
    if(heldItem==='umbrella'&&object.kind==='pram'&&state.hasFlag('in_pram'))return 'open umbrella';
    return null;
  }
  if(seen){
    if(object.kind==='ring')return find('turn ')||find('examine ');
    if(object.kind==='pram')return find('exit pram')||find('open pram')||find('enter pram')||find('push pram')||find('look');
    if(object.kind==='woman'&&state.room==='lancaster_gate')return find('help ')||find('wait');
    if(object.itemId&&!ITEMS[object.itemId]?.fixed)return find('unscrew ')||find('take ')||find('get ')||find('pick ')||find('examine ');
  }
  return find('examine ')||find('read ')||find('look')||find('wait')||'look';
}
export function resolveHeldSelf(id,state) {
  if(!id||!state.has(id))return null;
  if(id==='axe'&&state.room==='orbit_satellite')return 'break bubble with axe';
  if(id==='lantern'&&['underground_2','underground_3'].includes(state.room)&&!state.hasFlag('lantern_on'))return 'turn lantern';
  if(id==='paper_bird'&&state.room==='round_pond')return state.hasFlag('bird_unfolded')?'read paper bird':'open paper bird';
  if(id==='paper_bird'&&state.room==='playground')return 'ride bird';
  if(id==='umbrella'&&['lancaster_gate','lancaster_walk'].includes(state.room))return 'open umbrella';
  return `examine ${ITEMS[id]?.aliases?.[0]||id}`;
}
