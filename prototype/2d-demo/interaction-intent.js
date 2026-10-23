import { ITEMS } from '../js/data/items.js';

// One physical intention at a time. Menus never reveal the puzzle's verb list.
export function resolveInteraction(state,object,{heldItem=null,observed=new Set()}={}) {
  if(!object)return null;
  const actions=object.actions||[],find=prefix=>actions.find(a=>a.command.startsWith(prefix))?.command;
  if(heldItem){
    if(heldItem==='coin'&&object.kind==='woman'&&state.room==='broad_walk')return find('buy ');
    if(heldItem==='bag'&&['birds','pigeons'].includes(object.kind))return find('feed ');
    if(heldItem==='ball'&&['tree','umbrella','umbrella_tree'].includes(object.kind))return find('throw ball');
    if(heldItem==='umbrella'&&object.kind==='pram'&&state.hasFlag('in_pram'))return 'open umbrella';
    return null;
  }
  if(object.kind==='stairs')return find('u')||find('d')||find('look');
  const seen=observed.has(object.id);
  if(seen){
    if(object.kind==='ring')return find('turn ')||find('examine ');
    if(object.kind==='pram')return find('exit pram')||find('open pram')||find('enter pram')||find('push pram')||find('look');
    if(object.kind==='woman'&&state.room==='lancaster_gate')return find('help ')||find('wait');
    if(object.kind==='door')return find('enter door')||find('s')||find('examine ');
    if(object.itemId&&!ITEMS[object.itemId]?.fixed)return find('unscrew ')||find('take ')||find('get ')||find('pick ')||find('examine ');
  }
  return find('examine ')||find('read ')||find('look')||find('wait')||'look';
}
export function resolveHeldSelf(id,state) {
  if(!id||!state.has(id))return null;
  if(id==='paper_bird'&&state.room==='round_pond')return state.hasFlag('bird_unfolded')?'read paper bird':'open paper bird';
  if(id==='umbrella'&&['lancaster_gate','lancaster_walk'].includes(state.room))return 'open umbrella';
  return `examine ${ITEMS[id]?.aliases?.[0]||id}`;
}
