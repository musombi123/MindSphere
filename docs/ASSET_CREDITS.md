# Asset credits and licensing

## Current world phase

| Asset/code | Source | Licence / status |
|---|---|---|
| Three.js core, geometry and loaders | Existing project dependency, three@^0.170.0 | MIT |
| three-mesh-bvh | https://github.com/gkjohnson/three-mesh-bvh | MIT; added for accelerated terrain raycasts and ground-height queries |
| Procedural terrain, road, textures, materials and shaders | Original project code in src/world/ | Project-authored; no third-party texture/model files embedded in this phase |
| Terrain PBR-style maps | Generated with CanvasTexture and deterministic noise at runtime | Procedural project output; not from a third-party image |
| User world-reference images | Expected under public/reference/world/ | Folder was absent at audit time; no user images applied yet |
| Poly Haven Red Sand | https://polyhaven.com/a/red_sand | CC0 material identified as an optional laterite source, not bundled |
| Poly Haven Gravel Road | https://polyhaven.com/a/gravel_road | CC0 material identified as an optional road source, not bundled |
| Bungoma rural road photograph | https://commons.wikimedia.org/wiki/File:Rural_road_outside_of_Bungoma_Town.jpg | Visual reference only; not downloaded or used as a game texture. Verify exact file-page licence before reuse |

## Optional local assets

PBR maps can be added under public/assets/world/textures/ using the names in docs/WORLD_REFERENCE_MAP.md. Record the source URLs, exact asset names, licence and any edits here before shipping. No third-party model, audio recording, HDRI or photograph is represented as included by this phase.

## Runtime limits

Binary downloads could not be completed by the current shell environment. The world therefore uses procedural replacements now and supports optional local textures later. It requires no remote CDN at runtime and can run offline when assets are bundled.
