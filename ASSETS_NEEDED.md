# Project Zero Hour — outstanding runtime assets

This list is generated from the current Three.js/Vite asset catalog and the visual requirements for Episode 01, The Red Road. A missing optional model is not a failed network request: the existing terrain, road, instanced vegetation and procedural prop systems remain active until a reviewed asset is added.

## World models still needed

| Priority | Catalog key | Asset required | Current runtime behaviour |
|---|---|---|---|
| High | acacia | Distinctive umbrella-canopy African acacia tree, game-ready GLB | Uses authored instanced 3D tree geometry; no catalog GLB is mapped |
| Medium | eucalyptus | Tall eucalyptus tree GLB | Uses authored instanced 3D tree geometry |
| Medium | mangoTree | Mature mango tree GLB | Uses authored instanced 3D tree geometry |
| Medium | figTree | Mature fig tree GLB | Uses authored instanced 3D tree geometry |
| High | mudHouse | Bungoma rural homestead / masonry house GLB | Existing 3D homestead construction remains active |
| High | timberFence | Weathered timber / stick fence segment GLB | Existing roadside fence construction remains active |
| Medium | bodaBoda | Realistic boda boda motorcycle GLB | Existing 3D motorcycle construction remains active |
| Medium | rustedPickup | Rural utility pickup GLB | Existing 3D pickup construction remains active |
| Medium | waterTank | Elevated rural water tank GLB | Existing 3D tank construction remains active |
| Medium | bridge | Rural concrete / steel bridge GLB | Chapter-specific bridge geometry remains active |
| Low | bananaPlant | Banana plant clump GLB | Crop dressing remains procedural |
| Low | maizePatch | Maize crop patch GLB | Crop dressing remains procedural |
| Low | sugarcanePatch | Sugarcane patch GLB | Crop dressing remains procedural |
| Low | crates | Weathered field-supply crates GLB | Existing crate geometry remains active |
| Low | tyres | Roadside tyre stack GLB | No catalog GLB is mapped |
| Low | firePit | Rural outdoor fire pit GLB | No catalog GLB is mapped |
| Medium | stoneWall | Local masonry boundary wall GLB | Existing roadside wall construction remains active |

## Audio assets still needed

The optional offline ambience loader looks for these local files. They are not currently present in public/assets/world/audio/, so the loader skips them and reports them as optional in F3:

- assets/world/audio/wind.ogg
- assets/world/audio/birds.ogg
- assets/world/audio/insects.ogg
- assets/world/audio/footsteps_soil.ogg
- assets/world/audio/footsteps_grass.ogg

Use original or properly licensed recordings and include source, licence, attribution and permitted redistribution in docs/ASSET_CREDITS.md before release. No network audio dependency is required for a mission to start.

## Lighting and close-range reference assets

- A true 360-degree HDR environment map (the existing sky dome is procedural and does not require an HDR download).
- Higher-resolution, locally sourced surface references for close-range ground, buildings and foliage. The existing three 320×180 video frames remain useful for visual direction but are not close-up texture sources.

## Player model candidate awaiting review

Military_Male_01 (1).glb is present at the repository root and is tracked by Git LFS. It is not mapped as the production player. Before use, inspect the actual LFS payload for GLB validity, skinned-mesh count, skeleton hierarchy, material/texture dependencies, scale and licence; then test the 65-bone Mixamo animation set against its skeleton. The current player catalog entry remains the previously inspected Mixamo FBX until that review passes.

## Release gate

Do not map a model solely to clear an F3 notice. Confirm that its silhouette, scale, orientation, PBR textures, animation behaviour, mobile rendering cost and redistribution licence are appropriate for Project Zero Hour.
