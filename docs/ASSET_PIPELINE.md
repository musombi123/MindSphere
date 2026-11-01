# Project Zero Hour — Runtime and asset pipeline

## Runtime source of truth

The current playable application is a **Three.js + Vite browser game**, with a Capacitor Android wrapper. It is not a Unity 6 project. The C# files under `Assets/ProjectZeroHour/Scripts/Player/` are a separate Unity starter pack; they are not compiled by the Vite game and are not the active browser/mobile controller.

The active runtime entry point is `index.html`. Main gameplay code is currently defined in its module script, with world and character rendering systems in `src/`.

## Get the complete asset checkout

Large source packs, GLB files, HDR images and WAV files are tracked through Git LFS. Normal builds fetch only the committed runtime models under `public/assets/characters/imported/` and `public/assets/world/imported/`. To fetch one source archive for extraction, pull only that path, for example:

```powershell
git lfs install
git lfs pull --include="Assets/german-bundeswehr-soldier-rigged.zip"
```

Do not download the entire source library unless you need it; it contains large archives and high-resolution source media. Check that downloaded files are real assets, not short Git LFS pointer text files.

## Inventory the complete source asset library

Before choosing a player, weapon or world model, run the non-destructive inventory:

```powershell
.\scripts\audit-source-assets.ps1
```

It lists standalone model files and model members inside ZIP archives, flags archives that are still LFS pointers, classifies likely animation/weapon/vegetation/building candidates, and shows each internal ZIP path. It does not extract or modify any source file. Use `-ArchiveName "filename.zip"` to inspect one pack, or `-IncludeAnimationOnly` to include all FBX animation entries in the report.

## Runtime asset manifest and offline paths

The active web runtime resolves every local model, animation, texture, decoder and reference image relative to Vite's `BASE_URL`. Do not start a local asset URL with `/`; an origin-root path can escape the deployed subpath and fail inside a packaged app. Keep catalog and animation-manifest paths relative, for example `assets/animations/fbx/Walking.fbx` or `assets/characters/imported/zero-soldier/idle.fbx`.

The build runs `npm run assets:manifest` before validation. This creates `public/assets/asset-manifest.json` from the catalog and animation manifest and fails the build if a required local file is missing, empty, or still an LFS pointer. At game startup, `RuntimeAssetPreloader.js` reads that generated manifest and preloads the player model, core locomotion/combat clips, reference textures and decoder files with bounded concurrency. The same loading overlay reports progress; a required file that fails to preload is added to the F3 missing-assets list. Catalog slots without a mapped world/weapon model are optional enhancements; they are not treated as 404 failures. Their exact backlog is maintained in `ASSETS_NEEDED.md`.

After Vite has produced `dist/`, `npm run offline:manifest` generates `dist/precache-manifest.json`. On a secure production web origin, `public/sw.js` caches that exact build and reports its progress through F3 diagnostics. The first visit needs a connection until all files are cached; later visits can load the cached build offline. Capacitor ships the `dist/` files in its native web bundle and skips service-worker registration for `capacitor:` / `file:` origins.

## Prepare animation clips

The repository-owned FBX files in `Assets/` are copied into `public/assets/animations/fbx/` by:

```powershell
npm run assets:prepare
```

The script updates `public/assets/animations/manifest.json`. The validator checks the clip files, catalog paths, GLB headers and GLTF dependencies; it also rejects LFS pointer text in mapped runtime assets. Empty player/world/weapon catalog sections are warnings until those assets have been imported. The normal production build invokes preparation and validation automatically:

```powershell
npm ci
npm run assets:prepare
npm run assets:validate
npm run build
```

The current manifest stages 33 FBX entries, including Idle, Walk, Run, Sprint, Backpedal, crouch idle/walk/aim, prone shoot/reload, block, jump/wall-jump/high-jump, fall/land, hit/death variants, dodge, melee, turn, Shoot, Reload and Interact. It does not fabricate missing animations. The clips must target the same skeleton node/bone names as the chosen player rig. This pipeline loads FBX clips; it **does not automatically retarget incompatible skeletons**.

## Prepare the inspected player rig

The model inspection report found that the standalone `Assets/trellis-2387720894.glb` is a static mesh with no skin/bones, so it is **not** the player rig. It also found that `Assets/german-bundeswehr-soldier-rigged.zip` contains only an Idle animation file.

The stronger development candidate is `trellis-2387720894.fbx` inside `Female Basic Locomotion Pack.zip`. Three.js FBX inspection found one skinned mesh and 65 bones, including a Mixamo-style right hand. The pack also contains matching Idle, Walk, Run, Jump and Strafe clips. This is a structural finding, not visual approval of the character or its licensing. See [CHARACTER_PIPELINE.md](CHARACTER_PIPELINE.md).

Pull and stage that candidate:

```powershell
git lfs pull --include="Assets/Female Basic Locomotion Pack.zip"
.\scripts\prepare-character.ps1 -Archive "Female Basic Locomotion Pack.zip" -ListOnly
.\scripts\prepare-character.ps1 -Archive "Female Basic Locomotion Pack.zip" -ModelEntry "trellis-2387720894.fbx"
```

The script extracts the rig and all supported FBX/media dependencies below `public/assets/characters/imported/zero-soldier/`, then merges its model path into `public/assets/asset-catalog.json`. The runtime validates for a skinned humanoid before replacing the development proxy.

When the character pack is extracted, `npm run assets:prepare` automatically overrides the core locomotion manifest entries with that pack's Idle, Walk, Run, Jump, Strafe Left, Strafe Right and Turn files. Other actions retain the baseline FBX clips. This preference is based on the inspected skeleton hierarchy, but the animation transitions still require in-game review.

Do not publish the extracted model solely because the parser reports bones. The archive name indicates a female locomotion pack; check the actual rendered character, clothing, body proportions, texture quality and intended hero appearance. Also confirm source creator, licence, attribution and redistribution rights before including it in a public web build or APK.
## Enemy animation integration

When the player rig loads successfully, the game clones it for enemy roles and applies a restrained faction tint. These clones use the available idle/walk/run, shoot, hit and death clips. This is a shared-rig integration stage; separate enemy faction meshes and unique gear still need to be supplied and visually reviewed. When no compatible player rig is available, the development actor proxy remains active and the missing-model warning remains visible in the F3 diagnostics.

## World assets and current limitations

The current world uses a heightfield, a winding 3D laterite road, local photo-derived PBR material crops, instanced 3D trees/branches/grass, 3D rural prop meshes, a continuous procedural sky dome and a generated distant ridge. The three user-supplied world video frames are 320×180 stills, not photogrammetry or a 360-degree panorama. Rural buildings, fencing, vehicles and tanks are currently procedural 3D mesh stand-ins; the photorealistic GLB backlog is listed in ASSETS_NEEDED.md. Do not describe these stand-ins as scanned or photogrammetric assets.

The F3 diagnostics panel separates required files that fail to load from optional unmapped world/weapon models and optional ambience recordings. F4 displays FPS, draw calls, triangles, geometry/texture counts and JavaScript heap when exposed by the browser. Low, Medium and High world presets are available. These counters and presets still require real target-device profiling before performance can be certified.

## Verification boundary

A Vite production build validates the JavaScript bundle and the runtime asset-staging script. It does not prove that a downloaded character is the correct rig, that all imported animations bind, that combat feels balanced, or that low-end Android devices meet a frame-rate target. Those require browser play testing and Android device testing.

## Third-party assets and licensing

The repository contains candidate third-party asset archives and models, including packs with source/license details that still need review. Check each provider's current license, attribution, commercial-use and redistribution terms before shipping any source asset or extracted derivative in the web game or APK. A file being present in Git or Git LFS does not grant redistribution rights. Do not use ripped game assets or models with unclear provenance.
