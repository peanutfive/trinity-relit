import { ITEMS } from './exploration-items.js';

// One physical intention at a time. Menus never reveal the puzzle's verb list.
export function resolveInteraction(state,object,{heldItem=null,observed=new Set()}={}) {
  if(!object)return null;
  const actions=object.actions||[],find=prefix=>actions.find(a=>a.command.startsWith(prefix))?.command;
  const seen=observed.has(object.id);
  if(object.kind==='companion_bird')return heldItem==='binoculars'?'look at roadrunner through binoculars':'examine roadrunner';
  if(object.kind==='ruby_box_lid')return heldItem==='ruby'?'put ruby on box':null;
  if(object.kind==='tower_ruby' || object.kind==='beak_ruby')return seen?'take ruby':'examine ruby';
  if(object.kind==='shack_door' || object.kind==='sundial_lever')return actions[0]?.command;
  if(object.kind==='paperback' && !object.visualOptions?.onShelf){
    if(heldItem==='slip')return 'put slip in book';
    return seen?find('take '):find('examine ');
  }
  if(object.kind==='slip' && !object.visualOptions?.onShelf)return seen?'take slip':'examine slip';
  if(object.kind==='orbit_membrane')return heldItem==='axe'&&state.room==='orbit_satellite'?find('break bubble'):find('examine ');
  if(object.kind==='binoculars' && object.physicalHint)return find('take ');
  if(object.kind==='ranch_outside_door')return find('open ')||find('close ');
  if(object.kind==='ranch_window')return (seen && find('look through ')) || actions[0]?.command;
  if(object.kind==='ranch_floor_mark')return find('examine ');
  if(object.kind==='ranch_cold_wall')return find('touch ');
  if(object.kind==='ranch_wall_map')return seen?find('take '):find('examine ');
  if(object.kind==='cemetery_tomb'){
    if(find('look in crypt'))return 'look in crypt';
    if(heldItem==='spade' && find('open crypt with spade'))return 'open crypt with spade';
    return seen?'open crypt':'examine crypt';
  }
  if(object.kind==='ranch_cupboard'){
    const deposit=heldItem && actions.find(action=>action.itemId===heldItem && action.command.startsWith('put '));
    return deposit?.command||(heldItem && find('put '+heldItem+' in cupboard'))||find('examine ');
  }
  if(object.visualOptions?.onShelf)return find('take ');
  if(object.kind==='ranch_tableware')return find('take ');
  if(object.kind==='ranch_sink'||object.kind==='ranch_pipes')return seen?find('take ')||find('examine '):find('examine ');
  if(object.kind==='ranch_view')return find('look at ');
  if(object.kind==='water_edge')return find('enter water');
  if(object.kind==='pacific_gate')return seen?find('in'):find('examine ');
  if(object.kind==='tundra_gate')return seen?find('in'):find('look');
  if (object.kind === 'islet_gate') return seen ? find('enter door') : find('examine ') || find('look');
  if (object.kind === 'islet_ferry' || object.kind === 'islet_oarsman') {
    const offering = heldItem && actions.find(action => action.itemId === heldItem && action.command.startsWith('give '));
    if (offering) return offering.command;
    if (find('exit dory')) return 'exit dory';
    const observe = find('examine ') || find('look');
    return seen ? find('enter dory') || find('in') || find('out') || find('wait') || observe : observe;
  }
  if (object.kind==='sandbar_water' || object.kind==='completion_river') return (seen && find('wait')) || find('examine ');
  if (object.kind==='sandbar_sand' || object.kind==='islet_crown') return find('examine ');
  if(object.kind==='pacific_box')return seen?find('open box')||find('look'):find('look');
  if(['pacific_switch','pacific_button'].includes(object.kind))return find('push ')||find('look');
  // Doorways are navigation: carrying a prop must not lock the player inside.
  if(object.kind==='mushroom_gate')return seen
    ? actions.find(a=>a.command==='in')?.command||find('look') : find('look');
  if(object.kind==='japan_door')return seen?find('enter door')||find('look'):find('look');
  if(object.id==='vertex:hole')return (heldItem==='gnomon' && find('put gnomon in hole')) || find('examine hole');
  if(object.id==='vertex:dial-gnomon')return seen?find('take gnomon'):find('examine gnomon');
  if(object.id==='vertex:fixed-gnomon')return (seen && find('unscrew gnomon')) || find('examine shadow') || find('examine gnomon');
  if(object.kind==='islet_shadow')return find('examine shadow');
  if(object.kind==='ring' && state.room==='vertex')return seen ? find('turn ') : find('examine ');
  if(object.kind==='passage')return actions.find(a=>['n','ne','e','se','s','sw','w','nw','in','out','u','d'].includes(a.command))?.command||null;
  if(object.kind==='japan_children')return find('wait');
  if(object.kind==='stairs')return find('u')||find('d')||find('look');
  // At the lake's last instant the open doorway is still a usable exit.
  // A first F at its threshold must not spend that instant inspecting it.
  if(object.id==='wading:door' && state.counters?.long_water_phase===6)return find('enter door');
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
  if(id==='paperback')return 'read book';
  if(id==='gnomon'&&state.room==='vertex')return 'examine bolt';
  if(id==='axe'&&state.room==='orbit_satellite')return 'break bubble with axe';
  if(id==='lantern'&&['underground_2','underground_3'].includes(state.room)&&!state.hasFlag('lantern_on'))return 'turn lantern';
  if(id==='paper_bird'&&state.room==='round_pond')return state.hasFlag('bird_unfolded')?'read paper bird':'open paper bird';
  if(id==='paper_bird'&&state.room==='playground')return 'ride bird';
  if(id==='umbrella'&&['lancaster_gate','lancaster_walk'].includes(state.room))return 'open umbrella';
  return `examine ${ITEMS[id]?.aliases?.[0]||id}`;
}
