import assert from 'node:assert/strict';

const names = { knife: '刀', splinter: '木片' };

function floorItem(current, id) {
  const item = current.objects.find(object => object.itemId === id && !object.visualOptions?.onShelf);
  assert.ok(item, `${current.room} 地面没有显示 ${id}`);
  return { id:item.id, x:item.x, y:item.y, drawAt:item.drawAt ?? [item.x,item.y], pointerShape:item.pointerShape };
}

export async function testRanchFloorItems({ page, state, until, drain, shot, steps, feet, checkArrival,
  walkTo, road, action, reopen, holdInventoryItem, shelfPoint }) {
  const toSoutheastRoom = () => road('e','se_room','w',[[401,158]]);
  const toKitchen = () => road('w','kitchen','e',[[82,163]]);

  async function place(id, point) {
    await walkTo(point);
    const before = await drain();
    await holdInventoryItem(id,names[id]);
    await page.keyboard.press('i');
    await page.locator('#inventory-drop').click();
    const command = `drop ${id}`;
    const after = await until(s => !s.processing && s.lastCommand === command && s.turns > before.turns, `没有放下 ${id}`);
    checkArrival(before,after,before.room,command,null,{place:id});
    const placement = floorItem(after,id);
    const distance = Math.hypot(placement.x-before.player.x,placement.y-before.player.y);
    assert.ok(distance >= 16 && distance <= 71, `${id} 没有落在主角脚边，距离 ${distance}`);
    await drain();
    steps.push({ command,room:after.room,input:'inventory menu',foot:feet(before),placement });
    return placement;
  }

  async function retrieve(room, id, placement, touch = false) {
    const point = [placement.pointerShape.x,placement.pointerShape.y];
    if (touch) await page.setViewportSize({width:390,height:844});
    if (id === 'splinter' && !(await state()).observed.includes(placement.id))
      await action('examine splinter',room,{point,touch});
    await action(`take ${id}`,room,{point,touch,take:id});
    if (touch) await page.setViewportSize({width:1440,height:900});
    assert.ok(!(await state()).objects.some(object => object.itemId === id));
  }

  async function testRoom({ room, first, second, firstPoint, secondPoint, leave, enter }) {
    const firstPosition = await place(first,firstPoint);
    const secondPosition = await place(second,secondPoint);
    assert.deepEqual(floorItem(await state(),first),firstPosition);
    assert.ok(Math.hypot(secondPosition.x-firstPosition.x,secondPosition.y-firstPosition.y) >= 17);
    await walkTo([238,207]);
    await shot(`${room}-both-items`);
    await retrieve(room,first,firstPosition);
    assert.deepEqual(floorItem(await state(),second),secondPosition);
    await shot(`${room}-remaining-item`);
    await leave();
    assert.ok(!(await state()).objects.some(object => object.itemId === second));
    await enter();
    assert.deepEqual(floorItem(await state(),second),secondPosition);
    await reopen(`${room}-item-restored`);
    assert.deepEqual(floorItem(await state(),second),secondPosition);
    await retrieve(room,second,secondPosition,true);
    assert.ok((await state()).inventory.includes('splinter') && (await state()).inventory.includes('knife'));
    steps.push({ command:'verify-floor-position',room,afterTaking:first,item:second,placement:secondPosition,
      stages:['picked up neighbour','left and returned','saved and refreshed','picked up at original point with touch'] });
  }

  await action('take knife from cupboard','kitchen',{point:shelfPoint(await state(),'knife'),take:'knife',score:1});
  await testRoom({room:'kitchen',first:'splinter',second:'knife',firstPoint:[215,175],secondPoint:[278,176],
    leave:toSoutheastRoom,enter:toKitchen});
  await toSoutheastRoom();
  await testRoom({room:'se_room',first:'knife',second:'splinter',firstPoint:[220,170],secondPoint:[290,171],
    leave:toKitchen,enter:toSoutheastRoom});
}
