# World asset ingestion and placement

The browser runtime now reads `public/assets/asset-catalog.json` and loads world GLB/GLTF models through `src/world/WorldAssetLibrary.js`. Only entries explicitly mapped under `worldModels` are loaded. This avoids guessing whether a model is a house, tree, fence, vehicle or unrelated prop.

## Source assets currently present

The repository includes candidate source archives for thatched rural houses, rural toilets, a bus stop, farming assets, terrain textures, weapons and character packs. It also includes individual GLB/FBX/OBJ files. The source names and repository presence do not by themselves prove the model category or license. Use the archive inventory before mapping a candidate.

## List an archive's models

First download the LFS source payloads:

```powershell
git lfs pull --include="Assets/thatched-rural-houses.zip"
```

Use the matching path for the other ZIP you intend to inspect; you do not need to download all source packs. Then list GLB/GLTF members of a candidate ZIP without extracting:

```powershell
.\scripts\prepare-world-assets.ps1 -Archive "thatched-rural-houses.zip" -ListOnly
.\scripts\prepare-world-assets.ps1 -Archive "low-poly-bus-stop-game-ready.zip" -ListOnly
.\scripts\prepare-world-assets.ps1 -Archive "mini-farming-pack-free-low-poly-farming-assets.zip" -ListOnly
```

The helper reads ZIP members and filters for GLB/GLTF runtime models. If a pack contains only FBX files, it will not map those as world models; convert the chosen model to GLB (keeping its texture dependencies) before using it in this runtime.

## Import and map one verified world model

Choose a valid key from:

`acacia`, `eucalyptus`, `mangoTree`, `figTree`, `mudHouse`, `timberFence`, `bodaBoda`, `rustedPickup`, `waterTank`, `bridge`, `bananaPlant`, `maizePatch`, `sugarcanePatch`, `crates`, `tyres`, `firePit`, `stoneWall`.

For example, after reviewing the exact archive member path:

```powershell
.\scripts\prepare-world-assets.ps1 -Archive "thatched-rural-houses.zip" -ModelKey mudHouse -ModelEntry "exact/path/from/listing/house.glb"
```

For a self-contained GLB already stored directly under `Assets/`:

```powershell
.\scripts\prepare-world-assets.ps1 -SourceFile "Assets/trellis-2387720894.glb" -ModelKey stoneWall
```

The script extracts all supported referenced model and texture files below `public/assets/world/imported/<ModelKey>/` and merges the mapping into `public/assets/asset-catalog.json` without deleting the player mapping or other world models. It rejects archive paths that attempt to leave the extraction directory.

## Runtime behaviour

- `WorldAssetLibrary` loads and validates mapped GLB/GLTF models, preserves PBR materials, enables mesh shadow flags, and records loaded/missing assets in F3 diagnostics.
- `Props` places mapped rural houses, fence segments, a motorcycle, pickup, water tank and homestead/roadside details at terrain height.
- `Vegetation` places mapped trees and crop patches near the road, while retaining the user-footage cutouts as a distant layer. Real vegetation instances are distance-culled.
- The library derives model scale from its measured bounds and target height. Rotation/orientation still needs visual review for each selected source asset.

## Design and release gate

Mapping a model key is an explicit statement about the model's role. Do not map a random prop to a house/tree key just to clear an F3 warning. Check the model in-game for identity, silhouette, PBR maps, local origin, forward axis, ground contact, scale, LOD cost and mobile draw calls. Confirm creator, source, exact license, attribution and redistribution rights before a public build. A file existing in Git/Git LFS does not grant redistribution permission.

The world is still hybrid: the uploaded 320×180 photographs drive distant photo references and source-derived surfaces; GLBs provide the near-field geometry where mapped. This does not claim full photogrammetry or a fully scanned Bungoma landscape.

## Weapon models

The active combat weapons can each display a catalog-mapped GLB in the player's right-hand socket. Runtime keys are `pulseRifle`, `novaCannon`, `arcLance` and `gravityCore`.

For a standalone weapon GLB already stored in `Assets/`:

```powershell
git lfs pull --include="Assets/rifle__awp_weapon_model_cs2.glb"
.\scripts\prepare-weapon-assets.ps1 -SourceFile "Assets/rifle__awp_weapon_model_cs2.glb" -ModelKey pulseRifle
```

For an archive, first list the GLB/GLTF candidates:

```powershell
git lfs pull --include="Assets/weapons-crate.zip"
.\scripts\prepare-weapon-assets.ps1 -Archive "weapons-crate.zip" -ListOnly
```

After reviewing the model and license, map the exact selected archive entry:

```powershell
.\scripts\prepare-weapon-assets.ps1 -Archive "weapons-crate.zip" -ModelKey novaCannon -ModelEntry "exact/path/from/listing/weapon.glb"
```

The importer merges `weaponModels` into the shared asset catalog without deleting the player or world model mappings. Each weapon entry may contain a `transform` object with `targetLength`, `scale`, `position` and `rotation`. The initial grip transform is only a starting point; inspect the rendered weapon on the actual player rig, then tune its local offset and orientation. Do not map a source weapon to a fictional weapon key unless its silhouette and role are appropriate.
