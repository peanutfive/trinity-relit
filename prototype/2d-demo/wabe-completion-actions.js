import {ITEMS} from '../js/data/items.js';
import {COMPLETION_POINTS as P, COMPLETION_LOOSE_ANCHORS} from './wabe-completion-points.js';

export const COMPLETION_WABE_ROOMS = Object.freeze([
  'chasms_brink', 'promontory', 'herb_garden', 'the_river',
]);
const supported = new Set(COMPLETION_WABE_ROOMS);
const action = (label, command) => ({label, command});
const ellipse = (x, y, rx, ry, priority = 1) => ({kind: 'ellipse', x, y, rx, ry, priority});
const drawPoint = p => Array.isArray(p.drawAt) ? {x:p.drawAt[0],y:p.drawAt[1]} : p.drawAt || p;
const prop = (id, point, label, kind, actions, extra = {}) => ({
  id, ...point, label, kind, radius: 38, actions, ...extra,
});

// This layer only exposes existing observations and real room items. The boy's
// visual bubbles never become inventory items, commands, flags or ferry travel.
export function getCompletionHotspots(state) {
  if (!supported.has(state.room)) return [];
  const objects = [];
  if (state.room === 'chasms_brink') objects.push(
    prop('chasms_brink:oak', P.oak, '橡树', 'completion_oak',
      [action('观察橡树', 'examine oak')],
      {baked:true,eventId:'examine_oak',pointerShape:ellipse(100,72,21,30)}),
    prop('chasms_brink:toadstool', P.chasmMushroom, '岩台上的毒菌', state.sundialSymbol===4?'pacific_gate':'completion_toadstool',
      [action('观察毒菌', 'examine toadstool'),...(state.sundialSymbol===4?[action('进入','in')]:[])],
      {baked:true,eventId:'examine_toadstool_cb',pointerOnly:state.sundialSymbol!==4,
        pointerShape:ellipse(276,29,12,8,3)}),
    prop('chasms_brink:chasm', P.chasmMushroom, '深渊', 'completion_chasm',
      [action('观察深渊', 'examine chasm')],
      {baked:true,eventId:'examine_chasm',pointerOnly:state.sundialSymbol===4,pointerShape:ellipse(283,102,22,17)}),
  );
  if (state.room === 'promontory') {
    const boyAt = drawPoint(P.boy), dishAt = drawPoint(P.dish), headphonesAt = drawPoint(P.headphones);
    objects.push(
      prop('promontory:boy', P.boy, '戴耳机的巨型男孩', 'completion_boy',
        [action('观察男孩', 'examine boy')],
        {baked:false,eventId:'examine_boy_prom',depthY:boyAt.y,radius:45,
          visualOptions:{drawAt:boyAt},
          pointerShape:{kind:'polygon',points:[
            [boyAt.x-31,boyAt.y-129],[boyAt.x+5,boyAt.y-129],
            [boyAt.x+11,boyAt.y-97],[boyAt.x+26,boyAt.y-76],
            [boyAt.x+50,boyAt.y-34],[boyAt.x+67,boyAt.y-11],
            [boyAt.x+53,boyAt.y],[boyAt.x-32,boyAt.y-3],
            [boyAt.x-68,boyAt.y-14],[boyAt.x-64,boyAt.y-56],
          ],priority:1}}),
      prop('promontory:dish', P.dish, '肥皂水碟', 'completion_dish',
        [action('观察碟子', 'examine dish')],
        {baked:false,eventId:'examine_dish_prom',depthY:dishAt.y,
          visualOptions:{drawAt:dishAt},pointerShape:ellipse(dishAt.x,dishAt.y-7,24,10,3)}),
      prop('promontory:headphones', P.headphones, '耳机', 'completion_headphones',
        [action('观察耳机', 'examine headphones')],
        {baked:true,eventId:'examine_headphones_prom',pointerOnly:true,
          pointerShape:ellipse(headphonesAt.x,headphonesAt.y,8,12,4)}),
    );
  }
  if (state.room === 'herb_garden') objects.push(
    prop('herb_garden:herbs', P.herbs, '药草', 'completion_herbs',
      [action('观察药草', 'examine herbs')],
      {baked:true,eventId:'examine_herbs',pointerShape:{kind:'polygons',priority:1,polygons:[
        [[145,67],[171,64],[185,69],[195,63],[225,65],[231,78],[224,101],[140,100]],
        [[248,68],[275,68],[293,77],[318,75],[328,85],[323,110],[241,107]],
        [[137,112],[161,108],[180,116],[198,110],[216,119],[211,139],[128,137]],
        [[241,119],[276,120],[302,125],[319,129],[315,147],[232,142]],
        [[125,143],[149,140],[166,144],[178,137],[199,144],[209,153],[202,175],[114,171]],
        [[231,153],[249,151],[268,159],[263,178],[218,175]],
        [[289,156],[309,155],[336,162],[341,183],[279,182]],
      ]}}),
    // The unfinished tundra branch remains a scene boundary. No IN command is
    // attached to the pictured mushroom, even when the original symbol is set.
    prop('herb_garden:mushroom', P.mushroom, '毒菌', 'completion_mushroom',
      [action('观察此处', 'look')],
      {depthY:drawPoint(P.mushroom).y,visualOptions:{drawAt:drawPoint(P.mushroom)},pointerShape:ellipse(365,120,29,38)}),
  );
  if (state.room === 'the_river') objects.push(prop(
    'the_river:water', P.river, '河流', 'completion_river',
    [action('观察河流', 'examine river')],
    {baked:true,eventId:'examine_river',radius:45,pointerShape:ellipse(385,172,45,21)},
  ));

  const [baseX, baseY] = COMPLETION_LOOSE_ANCHORS[state.room];
  state.roomItems().filter(id => ITEMS[id]).forEach((id, index) => {
    const item = ITEMS[id], noun = item.aliases?.[0] || id;
    const thyme = state.room === 'herb_garden' && id === 'thyme';
    const point = thyme ? P.thyme : {
      x:baseX+(index%3-1)*11,y:baseY+Math.floor(index/3)*8,
    };
    const actions = [action('查看', `examine ${noun}`)];
    if (!item.fixed) actions.push(action('拿取', `take ${noun}`));
    objects.push(prop(`completion:item:${id}`,point,item.cn,
      thyme ? 'completion_thyme' : id,actions,{
        itemId:id,baked:thyme,
        ...(thyme ? {eventId:'examine_thyme'} : {}),
        pointerShape:thyme ? ellipse(300,166,26,12,2) : ellipse(point.x,point.y-5,7,7,2),
      }));
  });
  return objects;
}

export function getCompletionInventoryActions(id, state) {
  if (!supported.has(state.room) || !state.has(id) || !ITEMS[id]) return [];
  const item = ITEMS[id], noun = item.aliases?.[0] || id;
  const actions = [action('查看', `examine ${noun}`)];
  if (!item.fixed) actions.push(action('放下', `drop ${noun}`));
  return actions;
}
