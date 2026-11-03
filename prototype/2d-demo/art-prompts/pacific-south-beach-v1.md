# Pacific south-beach v1

Mode: built-in image_gen; reference image is style-only. Final generated PNG retained unmodified in assets.

```text
Use case: stylized-concept. Asset type: production background for a 2D exploration RPG, a single finished raster scene, landscape exact 5:3 composition. Logical game coordinate space is 480 by 288, origin top left. Match the supplied Wabe garden/chasm reference ONLY for the rich painterly HD-2D visual language: intricate physical textures, believable proportions, warm golden highlights, cool deep green shadows, strong layered depth, elevated three-quarter camera, crisp readable floor. No pixel squares, no cartoon or chibi, no outlines, no photographic image, no interfaces, no labels or lettering, no frame. No people, no birds, no movable inventory objects. All requested exits must have a wide believable continuous floor leading to them. Avoid decorative fake routes.

Scene/backdrop: south shore of a tiny sandy Pacific atoll, dawn red-gold sky and deep teal water along bottom, a great temporary corrugated iron industrial shed dominates upper center, seen elevated three-quarter. Broad walkable sandy beach band extends continuously WEST to (0,200) and EAST to (480,200). North access to the upper industrial floor is a clear open metal ramp between shed walls, beginning at (190,165) and going out upper screen at (190,0), 40 logical px wide, distinct from ground door. On shed front at logical (300,135) is a large heavy sliding metal door partly open: clearly visible dark threshold at (300,155), step/floor apron (300,178); this is a separate ground-level IN entrance, not the same as north ramp. A tiny plain old red button on outside shed wall just beside door at (333,136), no labels, wires or screen. Sand between apron, east/west beach and north ramp is connected and clear, width at least40px. Sea foam follows lower shore around y248, do not paint sand route into water. Minimal beach scrub at outer margins only, no jungle or crowds. No coconuts/controlbox or movable props. Rich physical textures, muted iron metal cooled green, dawn rim lighting, same refined painterly HD2D world.
```

## Asset receipt

- Selected raw generated file: `/Users/klarachen/.codex/generated_images/01a19b85-f119-7940-a7c3-866e5f19572d/exec-655afe46-66aa-47e2-be08-191073c8852c.png`
- Project copy: `assets/pacific-south-beach-v1.png` (unmodified PNG).
- Initial style references: assets/pacific-scaffold-v1.png; assets/wabe-chasm-v2.png.
- Tool: built-in image_gen; no CLI/API fallback.

## Selected final iteration

The first beach margins visually constricted the west/east mouths. Final image preserves building coordinates and clears those sand mouths. Exact prompt follows.

```text
Use case: precise-object-edit. Production gameplay path correction on this Pacific south beach background. Preserve the exact industrial shed, ramp, sliding metal doorway, tiny red button, tanks and all their screen positions. Preserve camera, ocean, dawn sky, detailed painterly HD2D style and warm colors. Change ONLY the foreground beach margins: create a clear uninterrupted sandy walking band spanning from the LEFT image edge to the RIGHT image edge between 54% and 71% of image height (logical y155 to y205 in a480x288 world). Remove rocks, shrubs, palm fronds and boulders from this horizontal sand band, especially the leftmost 60 logical pixels and rightmost 60 logical pixels. The west exit is at logical(16,163), the east exit at(464,193): each needs at least a 36px wide clean sand opening at its edge, genuinely visible as sand, not stones, foliage or foam. Ocean/whitewater must begin BELOW y215, and all decorative shoreline boulders must be BELOW or OUTSIDE the walk band. It is fine to retain upper-left palm and any foliage not crossing the horizontal sand lane. The northern ramp base and sliding-door apron must remain in the same location with clear sand connecting to both. No new objects, no people, no lettering, no arrows or UI, no new paths or buildings.
```
