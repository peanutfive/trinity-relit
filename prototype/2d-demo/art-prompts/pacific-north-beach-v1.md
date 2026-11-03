# Pacific north-beach v1

Mode: built-in image_gen; reference image is style-only. Final generated PNG retained unmodified in assets.

```text
Use case: stylized-concept. Asset type: production background for a 2D exploration RPG, a single finished raster scene, landscape exact 5:3 composition. Logical game coordinate space is 480 by 288, origin top left. Match the supplied Wabe garden/chasm reference ONLY for the rich painterly HD-2D visual language: intricate physical textures, believable proportions, warm golden highlights, cool deep green shadows, strong layered depth, elevated three-quarter camera, crisp readable floor. No pixel squares, no cartoon or chibi, no outlines, no photographic image, no interfaces, no labels or lettering, no frame. No people, no birds, no movable inventory objects. All requested exits must have a wide believable continuous floor leading to them. Avoid decorative fake routes.

Scene/backdrop: north shore of a tiny sandy Pacific atoll at red-and-gold dawn. A large utilitarian corrugated-metal industrial shed fills the lower-right quadrant and island center; no lush jungle. The north-facing beach looks toward calm deep teal lagoon in the upper half with coral-blue shallow water and a glowing red-gold horizon. A long square wooden conduit like a narrow box-shaped pipe lies from the shed out over the sand and extends north into the lagoon, centered logical x190. It is a solid small industrial conduit, NOT a walkable bridge or pier. Sandy walkable beach occupies the broad band from y140 to y240, bending with shore, with no water crossings. West route exits screen at (0,195) along continuous sand; east route exits at (480,195) continuous sand. A clear route turns SOUTH beside the shed toward an open access bay, and leaves bottom screen at (255,288), with width at least 40 logical px. Shed is on right from (325,160) outward, leave south route clear near x255. Sparse beach grass and a few small coral rocks at floor margins only. No people, shells-as-items, coconuts, dolphins, decorative text, barbed wire or palm jungle.
```

## Selected final iteration

The first generated shed blocked the eastern shore route and was rejected. The final source is exec-069d5b52-deba-44e7-b512-2e339a8de96a.png. Exact edit prompt follows.

```text
Use case: precise-object-edit. Edit this north beach production game background. Preserve its painterly HD2D style, dawn ocean, conduit, sky and colors. Fix ONLY the path layout: the corrugated shed currently blocks every eastward exit. Shrink and move the entire shed into the LOWER-RIGHT CORNER: its roof must not extend ABOVE 65% image height (logical y187 in a 480x288 world). There must be an UNINTERRUPTED horizontal open SAND walking band spanning the FULL width of the frame at logical y155 to y185, connecting left and right edges. Keep ocean/foamy shoreline ABOVE y140 and the shed BELOW y190; minimum sand width 36 pixels between them. Move the square wooden conduit base northward to logical (180,140), so the horizontal sand lane passes SOUTH of the conduit, not through it. The shed entrance may be at logical (365,250) with accessible sand apron extending to the horizontal lane. Keep no clutter or boulders in the full-width sand band. This is an elevated three-quarter 5:3 landscape. No people, no text, no UI, no coconut. Do not add a bridge, path into water, palm jungle, or another building. Keep the original drawing's materials and sky. This correction is essential for a playable east-west continuous shoreline route.
```

## Asset receipt

- Selected raw generated file: `/Users/klarachen/.codex/generated_images/01a19b85-f119-7940-a7c3-866e5f19572d/exec-069d5b52-deba-44e7-b512-2e339a8de96a.png`
- Project copy: `assets/pacific-north-beach-v1.png` (unmodified PNG).
- Initial style references: assets/pacific-scaffold-v1.png; assets/wabe-chasm-v2.png.
- Tool: built-in image_gen; no CLI/API fallback.
