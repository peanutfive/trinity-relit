# Tundra field 6 v1

Mode: built-in image_gen. Existing Wabe image is a style reference only. The final raw generated PNG is copied unmodified into assets.

```text
Use case: stylized-concept. Asset type: finished background raster for an existing 2D exploration RPG. One SINGLE landscape image, exact 5:3 ratio, logical world 480 by 288. Supplied reference is STYLE ONLY: rich painterly HD-2D with intricate material texture, believable realistic proportions, warm ochre rim light, cool blue-green shadows and layered atmosphere, elevated three-quarter gameplay camera looking down onto readable ground. No pixel-square art, no chibi, no cartoon black outlines, no photograph, no UI, no text, numbers, symbols, arrows, border or labels. No people, animals, movable props, guards, signs or buildings. No snow maze. This is the barren Arctic Russian Tundra from Trinity: exposed brown-gray cracked permanent-frost earth, gritty frost, sparse low withered grass, thin pale frost dust and cold wind, distant gray mountains. No thick snow fields, no tall snow walls, no forest, no lush plants, no artificial paved roads. The playable ground must be visually legible as lower frost-dusted, broad wind-scoured shallow channels between impassable jagged bedrock shelves and steep frozen earth shoulders; at every requested exit the continuous broad ground channel continues all the way out of the frame. Shelves rise 1–2 metres and have clearly steep edges, but are rock and earth, not snow fortifications. Background is a game floor plane across the ENTIRE image with no sky occupying the upper route endpoints; far mountains can appear as tiny raised silhouettes confined to blocked corner pockets. Routes have no markings. Central flat walkable clearing centered (240,165), roughly radius65x45; every route should be at least 36 logical px wide (about 120 physical px on a 1620px picture) so human-sized actor feet can traverse. No isolated ground pockets, no decorative fake paths, no additional exits beyond the exact route list.

Scene 6: THREE paths: EAST (480,160), SOUTHEAST (438,288), SOUTH (240,288). Each distinct. The north and northwest landscape slopes UPWARD into a high, sheer GRAY ROCK mountain wall taking the upper left and top edge; the wall is dark layered stone with light frost, NOT an ice wall or giant glacier. No opening into that mountain wall. The west edge is solid steep rock too. A safe bare ground clearing sits at (240,165). No door.
```

Original object ID: 380. Gameplay routes follow the current read-only chapter module; original/current rule differences are documented separately.

Initial raw generated file: `/Users/klarachen/.codex/generated_images/01a1eca0-4278-7293-ab0a-0ac11a6d5d78/exec-25155329-fe6c-4627-a45a-cf4d061bb10d.png`.
Project copy: `assets/tundra-field-6-v1.png` (unmodified selected PNG).

## Targeted route correction

The initial image contained an unwanted upper-right far track. Built-in image_gen filled that upper background with a continuous gray mountain wall, preserving the three main ground corridors.

```text
Use case: precise-object-edit. Edit ONLY the upper right background of this production 2D RPG tundra scene. Preserve composition, exact 5:3 framing, camera, color, bare frost-crusted tundra style, all main ground and all other rock positions. The finished scene must have EXACTLY THREE traversable broad corridors: one exits middle of RIGHT edge near 40% height, one exits LOWER RIGHT edge near 87% height, one exits BOTTOM edge near 42% width. In the current image an EXTRA narrow track snakes into the far upper-right landscape ABOVE the long horizontal rock rib, toward a tiny distant mountain/horizon. CLOSE AND REMOVE that extra far upper-right track: fill the whole topmost quarter of the upper-right corner with a continuous steep sheer gray mountain wall joined seamlessly to the huge upper-left rock wall. No ground path may lead through any part of the TOP screen edge or upper-right horizon. The three main mid-right, lower-right, bottom corridors must remain fully unchanged and unobstructed, broad bare frozen earth, natural gray rock borders. Do not add snow, doors, people, text, trees, arrows or new paths. Only correct the extra route; keep the overall high quality painterly HD2D terrain and warm low light.
```

Final selected raw file: `/Users/klarachen/.codex/generated_images/01a1eca0-4278-7293-ab0a-0ac11a6d5d78/exec-563ea133-d809-473c-99f8-d9d112c200ab.png`.
