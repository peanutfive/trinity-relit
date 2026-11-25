import assert from 'node:assert/strict';

export function pointerCenter(object) {
  const shape = object?.pointerShape;
  assert.ok(shape,`画面缺少实际触点 ${object?.id}`);
  if (shape.kind==='ellipse') return [shape.x,shape.y];
  assert.equal(shape.kind,'polygon');
  return shape.points.reduce(([x,y],[px,py]) => [x+px/shape.points.length,y+py/shape.points.length],[0,0]);
}

export async function setIslandDial({ state, tap }, symbol) {
  assert.equal((await state()).room,'vertex');
  const lever = (await state()).objects.find(item=>item.id==='vertex:lever');
  assert.ok(lever,'正常渡船路线应先在顶台安装指针，旧档应保留原有拉杆');
  if ((await state()).dialShadow.leverUp) {
    await tap(pointerCenter(lever),'push lever');
  }
  const ring = [286,132];
  if (!(await state()).observed.includes('vertex:ring')) await tap(ring,'examine ring');
  for (let turn = 0; turn < 8; turn++) {
    const current = await state();
    if (current.sundialSymbol===symbol && current.dialShadow.centered && current.dialShadow.symbol===symbol) break;
    await tap(ring,'turn ring');
  }
  const dial = (await state()).dialShadow;
  assert.equal(dial.symbol,symbol);
  assert.equal(dial.leverUp,false);
  assert.ok([5,6].includes(dial.phase),'日晷影尖未停在准位');
}

export const shackPassages = [
  {from:'shack',dir:'w',to:'tower_platform',entrance:'e'},
  {from:'tower_platform',dir:'d',to:'tower_landing',entrance:'u'},
  {from:'tower_landing',dir:'d',to:'base_of_tower',entrance:'u'},
];

export const shackRoads = [...shackPassages.map(({from,to})=>[from,to]),['base_of_tower','shallow_crater']];
