import { cemeteryView } from './cemetery-state.js';
import { cemeteryDetailImage, cemeteryDetailRegions, cemeteryBodyRegions } from './cemetery-art.js';

const details = {
  shroud: { label: '覆身的布', command: 'take shroud' },
  bandage: { label: '下颌的布带', command: 'take bandage' },
  mouth: { label: '张开的嘴', command: 'look in mouth' },
  coin: { label: '银币', command: 'take silver coin' },
  cover: { label: '把手中的布覆回去', command: 'put shroud on corpse' },
  bind: { label: '用手中的绷带缠住下颌', command: 'put bandage on corpse' },
  replaceCoin: { label: '把手中的银币放回口中', command: 'put silver coin in mouth' },
};

export function tombArtView(state) {
  const view = cemeteryView(state);
  return { open: view.open, shrouded: view.shroudOnBody, bound: view.bandageOnBody,
    coinPresent: view.coinInMouth, coinSeen: view.coinSeen };
}

export function createCryptInspection(root, act, leave) {
  const plate = root.querySelector('.crypt-plate');
  const photo = plate.querySelector('img');
  const back = root.querySelector('.crypt-leave');
  let selection = '';
  let targets = [];
  back.onclick = leave;
  back.onfocus = () => {selection='back';};

  function select(target, focus = false) {
    selection = target;
    for (const button of plate.querySelectorAll('button')) {
      button.classList.toggle('selected', focus && selection === button.dataset.detail);
      if (focus && selection === button.dataset.detail) button.focus({preventScroll:true});
    }
  }

  function update(state, heldItem) {
    const view = tombArtView(state);
    const src = cemeteryDetailImage(view);
    if (photo.getAttribute('src') !== src) photo.setAttribute('src',src);
    const regions = {...cemeteryDetailRegions(view)};
    if (heldItem==='shroud' && state.has(heldItem) && !view.shrouded) regions.cover=cemeteryBodyRegions.shroud;
    if (heldItem==='bandage' && state.has(heldItem) && !view.bound) {
      delete regions.mouth;
      delete regions.coin;
      regions.bind=cemeteryBodyRegions.bandage;
    }
    if (heldItem==='silver_coin' && state.has(heldItem) && !view.bound && !view.coinPresent) {
      delete regions.mouth;
      regions.replaceCoin=cemeteryBodyRegions.mouth;
    }
    const keys = Object.keys(regions);
    const keepFocus = plate.contains(document.activeElement);
    for (const button of plate.querySelectorAll('button')) button.remove();
    targets = keys;
    for (const key of keys) {
      const [x,y,width,height] = regions[key];
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.detail = key;
      button.setAttribute('aria-label', details[key].label);
      Object.assign(button.style, {left:`${x*100}%`,top:`${y*100}%`,width:`${width*100}%`,height:`${height*100}%`});
      button.onfocus = () => {selection = key;};
      button.onclick = () => { select(key); act(details[key].command); };
      plate.append(button);
    }
    select(keys.includes(selection) ? selection : keys[0], keepFocus);
  }

  return {
    get open() { return !root.hidden; },
    show(state,heldItem) { root.hidden=false; update(state,heldItem); },
    update,
    hide() { root.hidden=true; selection=''; targets=[]; },
    step(by) {
      if (!targets.length) return;
      const next=(targets.indexOf(selection)+by+targets.length)%targets.length;
      select(targets[next],true);
    },
    tab(by) {
      const order=[...plate.querySelectorAll('button'),back];
      const at=order.indexOf(document.activeElement);
      const next=at<0?(by<0?order.length-1:0):(at+by+order.length)%order.length;
      const target=order[next];
      if(target===back){ select('back'); back.focus(); }
      else select(target.dataset.detail,true);
    },
    interact() {
      if (details[selection]) act(details[selection].command);
      else leave();
    },
    selected() { return selection; },
  };
}
