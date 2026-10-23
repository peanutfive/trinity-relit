import test from 'node:test';
import assert from 'node:assert/strict';
import { characterPose, characterGrounding, characterLighting, paintCharacter } from '../character.js';

const directions = ['down', 'up', 'left', 'right'];
// Record the actual canvas output, including mirrored coordinates, without a DOM.
function recordingCanvas() {
  const output = [], stack = [];
  let matrix = [1, 1, 0, 0], path = [], fillStyle = '', depth = 0;
  const point = (x, y) => [x * matrix[0] + matrix[2], y * matrix[1] + matrix[3]];
  const context = {
    get fillStyle() { return fillStyle; }, set fillStyle(value) { fillStyle = value; },
    save() { stack.push({ matrix: [...matrix], fillStyle }); depth++; },
    restore() { const previous = stack.pop(); assert.ok(previous); matrix = previous.matrix; fillStyle = previous.fillStyle; depth--; },
    translate(x, y) { matrix[2] += x * matrix[0]; matrix[3] += y * matrix[1]; },
    scale(x, y) { matrix[0] *= x; matrix[1] *= y; },
    beginPath() { path = []; },
    moveTo(x, y) { path.push(point(x, y)); }, lineTo(x, y) { path.push(point(x, y)); }, closePath() {},
    ellipse(x, y, rx, ry, rotation) { path.push({ center: point(x, y), rx, ry, rotation }); },
    fill() { output.push({ type: 'fill', color: fillStyle, path: structuredClone(path) }); },
    fillRect(x, y, width, height) { output.push({ type: 'rect', color: fillStyle,
      path: [point(x, y), point(x + width, y), point(x + width, y + height), point(x, y + height)] }); },
  };
  return { context, output, get depth() { return depth; } };
}

for (const facing of directions) {
  test(`${facing}静站的足底接触点不随呼吸漂浮，投影固定在右下`, () => {
    const a = characterGrounding(facing, .8, { moving: false, blend: 0, time: 1 });
    const b = characterGrounding(facing, .8, { moving: false, blend: 0, time: 3 });
    assert.deepEqual(a.feet, b.feet);
    assert.ok(a.feet.every(foot => foot.y === 1.3 && foot.lift === 0 && foot.weight === 1));
    assert.ok(a.cast.x > 0 && a.cast.y > 0 && a.cast.rotation > 0);
    const recorded = recordingCanvas();
    paintCharacter(recorded.context, 100, 150, '#bca071', facing, .8, false, { moving: false, blend: 0, time: 2 });
    const shadows = recorded.output.filter(item => item.path[0]?.center);
    assert.equal(shadows.length, 4, '两层柔和投影和两个足底接触影');
    assert.equal(shadows[0].path[0].center[0], 100 + a.cast.x, '侧身镜像不能把光源投影也翻转');
    assert.equal(shadows[0].path[0].center[1], 150 + a.cast.y);
    for (let i = 0; i < 2; i++) assert.deepEqual(shadows[i + 2].path[0].center, [100 + a.feet[i].x, 151.3]);
    assert.equal(recorded.depth, 0);
  });

  test(`${facing}步态始终有一只支撑脚，抬脚影减弱而地面坐标不抬升`, () => {
    for (const phase of [0, Math.PI / 4, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
      const ground = characterGrounding(facing, phase, { moving: true, blend: 1 });
      assert.ok(ground.feet.some(foot => foot.weight === 1));
      assert.ok(ground.feet.every(foot => foot.y === 1.3 && foot.weight >= 0 && foot.weight <= 1));
      for (const foot of ground.feet) if (foot.lift > 0) assert.ok(foot.weight < 1);
      const recorded = recordingCanvas();
      paintCharacter(recorded.context, 0, 0, '#bca071', facing, phase, false, { moving: true, blend: 1 });
      const ankleSoles = recorded.output.filter(item => item.type === 'rect' && item.color === '#424735');
      assert.equal(ankleSoles.length, 2);
      assert.ok(ankleSoles.every(item => Math.max(...item.path.map(point => point[1])) <= 1.55 + .001), '鞋底不能穿入地面');
    }
  });
}

test('左右转身保持同一个左上光源，衣料具受光/中间调/背光三个体块', () => {
  const brightness = hex => hex.slice(1).match(/../g).map(part => parseInt(part, 16)).reduce((sum, value) => sum + value, 0);
  for (const facing of directions) {
    const light = characterLighting(facing, '#bca071');
    assert.ok(brightness(light.light) > brightness(light.mid));
    assert.ok(brightness(light.mid) > brightness(light.shade));
    const mirror = facing === 'left' ? -1 : 1;
    assert.equal(light.localLightX * mirror, -1, '光源方向必须换算为相同世界方向');
    const recorded = recordingCanvas();
    paintCharacter(recorded.context, 0, 0, '#bca071', facing, 0, false, { blend: 0 });
    for (const color of [light.light, light.mid, light.shade]) assert.ok(recorded.output.some(item => item.color === color));
    const bodyHighlights = recorded.output.filter(item => item.color === light.light && item.path.every(Array.isArray)
      && Math.max(...item.path.map(point => point[1])) - Math.min(...item.path.map(point => point[1])) > 8);
    assert.ok(bodyHighlights.length > 0);
    assert.ok(bodyHighlights.every(item => item.path.reduce((sum, point) => sum + point[0], 0) / item.path.length < 0));
  }
});

test('停步和碰墙后不靠时间继续踏步，已有姿势平滑回落并有小幅收势', () => {
  const phase = Math.PI / 2;
  let priorLift = Infinity;
  for (const blend of [1, .75, .4, .1, 0]) {
    const a = characterPose(phase, { moving: false, blend, time: 1 });
    const b = characterPose(phase, { moving: false, blend, time: 10 });
    assert.equal(a.stride, b.stride); assert.equal(a.leftLift, b.leftLift);
    assert.ok(a.leftLift <= priorLift); priorLift = a.leftLift;
    assert.equal(a.moving, false); assert.ok(Math.abs(a.weightShift + a.inertia) < .7);
  }
  const moving = characterPose(phase, { moving: true, blend: .75 });
  const settling = characterPose(phase, { moving: false, blend: .75 });
  assert.ok(settling.inertia > moving.inertia, '停止时有克制的重心收势');
  assert.equal(characterPose(phase, { moving: false, blend: 0 }).settling, false);
  assert.equal(characterPose(phase, { moving: false, blend: 0 }).stride, 0);
});

test('拾取屈身和查看动作不改变地面锚点，角色比例保持修长', () => {
  for (const facing of directions) {
    for (const action of ['idle', 'pickup', 'inspect']) {
      const recorded = recordingCanvas();
      paintCharacter(recorded.context, 0, 0, '#bca071', facing, 0, false,
        { blend: 0, action, actionProgress: .5, time: 0 });
      const soles = recorded.output.filter(item => item.type === 'rect' && item.color === '#424735');
      assert.ok(soles.every(item => Math.max(...item.path.map(point => point[1])) <= 1.55 + .001));
      const visible = recorded.output.filter(item => item.path.every(Array.isArray)).flatMap(item => item.path);
      const height = Math.max(...visible.map(point => point[1])) - Math.min(...visible.map(point => point[1]));
      assert.ok(height > 30 && height < 38);
      assert.equal(recorded.depth, 0);
    }
  }
});
