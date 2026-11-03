# Pacific 物件透明图集

使用内置 image_gen 生成，非 CLI；2026-11-02。保留原始 RGBA，不抠图、不重采样。

参考图仅供画风与光照：`assets/wabe-completion-props-v1.png`、`assets/wabe-river-v2.png`。

原始生成文件：`/Users/klarachen/.codex/generated_images/01a19b86-674e-73b0-aa39-612b3db25e35/exec-392b9da9-892d-42f9-846c-7b4286e14fd6.png`。

下列为实际提交给工具的完整提示。箱、开关、红按钮依据只读原版外观；渲染姿态只对应现有章节 flag，不扩写广播、滑门或倒计时机制。完整与裂开椰子仅按现有 `coconut_cracked` 状态选择，不授予破裂动作。

```text
Create ONE production 2D game prop sprite atlas on a true fully transparent RGBA background. Asset type: hand-painted HD-2D game sprite sheet, six isolated props in one horizontal strip, generous completely transparent gutters. Landscape 3:1 canvas around 2304 by 768 pixels. No labels, frame numbers, borders, floor plane, captions, interface, lettering or watermark. Use the supplied reference images ONLY for matching the established game's painterly microtexture, warm upper-left golden sunlight and deep soft olive/cool-green shadows; do not reproduce their objects or scene. Keep a fixed elevated three-quarter RPG view, realistic proportions and physical materials, no chibi, no cartoon outlines, no glossy 3D toy appearance. Readability at a very small in-game scale is essential.

First FOUR slots: the SAME small 1940s/1950s simple wall-mounted industrial control cabinet, dull weathered sea-green/gray painted metal with a few rusted corners and shallow depth, approximately 1.2 times tall as its body width. All four cabinets have exactly identical body size, perspective, body position and attachment points on a shared bottom baseline. Not a freestanding chest, not wooden, no legs, no mounting pole, no surrounding wall: alpha around the cabinet only. It has a hinged thin metal door that swings to the LEFT. Four states, left to right:
1. cabinet fully closed, plain opaque metal door and small latch.
2. cabinet fully open with door fixed to the left. Dark simple interior control panel contains exactly two unlabeled old mechanical controls: a small toggle SWITCH on the LEFT in the UP position and a small round dull RED push BUTTON on the RIGHT, unpressed. No extra controls.
3. same open cabinet, same geometry and door pose, but LEFT toggle now DOWN. RIGHT red push button remains unpressed.
4. same open cabinet, same geometry and door pose, LEFT toggle DOWN, RIGHT red push button visibly slightly depressed into its rim.
Neither switch state nor pressed button changes lighting. NO illuminated indicators, LEDs, gauges, screens, wires, clocks, countdowns, broadcast symbols or modern warning stripes. The cabinet's rectangular main body stays in precisely the same position in all four slots even though the left open door extends beyond its body. Give the opening a readable light rim and simple dark interior, muted colors and small bolts. Each slot roughly 350 pixels wide, leave room for the open door within its slot. The lower edge of all cabinets sits on the same baseline.

Final TWO slots: a whole palm-sized brown fibrous coconut, then a split coconut with two chunky halves showing dull cream flesh and a little opaque coconut milk inside. These are natural modest-sized objects from the same hand-painted game world, NOT large tropical product photos. Whole and split coconut each entirely isolated with clear alpha, same scale, seen from the same elevated camera. Warm sand-compatible lighting from upper-left, dark soft creases, no dramatic cast shadow or floor. Each coconut group fits entirely within its own slot. Do not draw floating liquid droplets.

Composition priority: SIX evenly separated groups, no overlap between slots, complete alpha transparency in corners and gutters, 20+ pixel safety margin around every object. Preserve metallic cabinet edges and coconut fiber silhouette.
```
