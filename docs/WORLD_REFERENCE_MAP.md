# World reference map — The Red Road

## Repository audit

The repository did not contain public/reference/world/ or any world-reference image files when this phase began. The folder is reserved for your exact reference images; this document does not claim to have studied or applied photos that are not present. Add your road, fence, homestead, vegetation, soil and skyline images there for a precise per-image match.

The shell network test failed before any binary asset could be downloaded. This phase uses original procedural materials and generated terrain geometry, not downloaded photographs or textures. The world code checks for local PBR files listed below and will use them when supplied.

## Visual target map

| Reference / visual target | World element | Treatment / status |
|---|---|---|
| User road photos — not present yet | The Red Road | Curved Catmull-Rom road; terrain-following vertices; generated laterite PBR maps; two tyre ruts; eroded edges; scattered stones; puddles and grass verges |
| User soil/ground photos — not present yet | Terrain | Layered-noise heightfield and shader-blended laterite, grass, dry grass, rock and mud albedo; generated normal and roughness maps |
| User vegetation photos — not present yet | Trees, crops and scrub | Instanced organic canopy/trunk meshes and plant cards with wind sway, pending Phase 3 |
| User fence photos — not present yet | Rural fence lines | Weathered wood posts and rounded rails, pending Phase 4 |
| User house/building photos — not present yet | Mud-brick homes and mabati roofs | Custom wall surfaces and corrugated metal roof geometry, pending Phase 4 |
| User hill/sky photos — not present yet | Skyline and atmosphere | Layered terrain contours, procedural sky, morning sun, fog, dust and pollen, pending Phase 2/5 |
| Public visual reference: https://commons.wikimedia.org/wiki/File:Rural_road_outside_of_Bungoma_Town.jpg | Soil colour, road width, rural planting density and distant farmland | Style reference only, not downloaded or used as a game texture. Verify the page's exact licence before redistributing the photograph |
| Poly Haven Red Sand: https://polyhaven.com/a/red_sand | Laterite texture direction | CC0 asset identified but not bundled because its binary maps were unavailable to the shell |
| Poly Haven Gravel Road: https://polyhaven.com/a/gravel_road | Worn road grit and roughness direction | CC0 asset identified but not bundled because its binary maps were unavailable to the shell |

## Optional local PBR textures

Put licensed maps in public/assets/world/textures/:

- laterite_color.jpg, laterite_normal.jpg, laterite_roughness.jpg
- grass_color.jpg, grass_normal.jpg, grass_roughness.jpg
- dryGrass_color.jpg, dryGrass_normal.jpg, dryGrass_roughness.jpg
- rock_color.jpg, rock_normal.jpg, rock_roughness.jpg
- mud_color.jpg, mud_normal.jpg, mud_roughness.jpg
- road_color.jpg, road_normal.jpg, road_roughness.jpg

Only commit textures whose licence allows redistribution. Record source, asset name, licence and any modifications in docs/ASSET_CREDITS.md.
