import {ITEMS} from '../js/data/items.js';

export const PACIFIC_ROOMS = Object.freeze([
  'mesa', 'scaffold', 'bottom_scaffold', 'north_beach',
  'west_beach', 'east_beach', 'south_beach',
]);
const supported = new Set(PACIFIC_ROOMS);
const a = (label, command) => ({label, command});
const ellipse = (x, y, rx, ry, priority = 1) => ({kind:'ellipse',x,y,rx,ry,priority});
const prop = (id, point, label, kind, actions, extra = {}) => ({
  id,...point,label,kind,radius:30,actions,...extra,
});

// Art anchors belong to the wall or actual sand contact. The keyboard standing
// points stay on usable ground and never decide the sprite's depth ordering.
export const PACIFIC_POINTS = Object.freeze({
  box:Object.freeze({x:291,y:129,drawAt:Object.freeze({x:291,y:99})}),
  switch:Object.freeze({x:279,y:129}),
  button:Object.freeze({x:304,y:129}),
  coconut:Object.freeze({x:295,y:183,drawAt:Object.freeze({x:295,y:183})}),
});
const looseAnchors = {
  mesa:[250,118],scaffold:[200,142],bottom_scaffold:[250,170],
  north_beach:[210,148],west_beach:[300,145],
  east_beach:[234,159],south_beach:[210,128],
};

export function getPacificHotspots(state) {
  if (!supported.has(state.room)) return [];
  const objects = [];
  if (state.room === 'bottom_scaffold') {
    const open = state.hasFlag('pacific_box_open');
    const switched = state.hasFlag('pacific_switch_pushed');
    const pushed = state.hasFlag('pacific_button_pushed');
    objects.push(prop('bottom_scaffold:box',PACIFIC_POINTS.box,'控制箱','pacific_box',[
      a('观察此处','look'),...(!open ? [a('打开箱子','open box')] : []),
    ],{
      eventId:'pacific_open_box',pointerOnly:open,depthY:PACIFIC_POINTS.box.drawAt.y,
      visualOptions:{drawAt:PACIFIC_POINTS.box.drawAt},
      pointerShape:{kind:'polygon',priority:1,points:open
        ? [[277,81],[282,78],[285,77],[297,77],[299,79],[299,98],[294,100],[283,98],[277,100]]
        : [[282,79],[284,77],[297,77],[300,80],[300,98],[296,100],[282,97]]},
    }));
    // Opening the box already reveals both controls. Commands below are only
    // the chapter's existing, currently legal actions; there is no inspect verb
    // for these scenery controls in the shared engine.
    if (open) objects.push(
      prop('bottom_scaffold:switch',PACIFIC_POINTS.switch,'开关','pacific_switch',[
        a('观察此处','look'),...(!switched ? [a('按下开关','push switch')] : []),
      ],{baked:true,eventId:'pacific_push_switch',radius:24,
        pointerShape:ellipse(287.4,87.6,2.2,4,4)}),
      prop('bottom_scaffold:button',PACIFIC_POINTS.button,'红色按钮','pacific_button',[
        a('观察此处','look'),...(switched && !pushed ? [a('按下按钮','push button')] : []),
      ],{baked:true,eventId:'pacific_push_button',radius:24,
        pointerShape:ellipse(291.6,87.6,2.3,2.8,5)}),
    );
  }

  const [baseX,baseY] = looseAnchors[state.room];
  state.roomItems().filter(id => ITEMS[id]).forEach((id,index) => {
    const item = ITEMS[id],noun = item.aliases?.[0] || id;
    const nativeCoconut = id === 'coconut' && state.room === 'east_beach';
    const point = nativeCoconut ? PACIFIC_POINTS.coconut : {
      x:baseX+(index%7)*8,y:baseY+Math.floor(index/7)*6,
    };
    const drawAt = point.drawAt || point;
    const actions = [a('查看',`examine ${noun}`)];
    if (!item.fixed) actions.push(a('拿取',`take ${noun}`));
    objects.push(prop(`pacific:item:${id}`,point,item.cn,
      id === 'coconut' ? 'pacific_coconut' : id,actions,{
        itemId:id,depthY:drawAt.y,visualOptions:{drawAt},
        pointerShape:ellipse(drawAt.x,drawAt.y-4,id === 'coconut'?5:7,6,3),
      }));
  });
  return objects;
}

export function getPacificInventoryActions(id,state) {
  if (!supported.has(state.room) || !state.has(id) || !ITEMS[id]) return [];
  const item = ITEMS[id],noun = item.aliases?.[0] || id;
  return [a('查看',`examine ${noun}`),...(!item.fixed ? [a('放下',`drop ${noun}`)] : [])];
}
