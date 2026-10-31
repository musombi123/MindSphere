# Project Zero Hour — Runtime and asset pipeline

## Runtime source of truth

The current playable application is a **Three.js + Vite browser game**, with a Capacitor Android wrapper. It is not a Unity 6 project. The C# files under `Assets/ProjectZeroHour/Scripts/Player/` are a separate Unity starter pack; they are not compiled by the Vite game and are not the active browser/mobile controller.

The active runtime entry point is `index.html`. Main gameplay code is currently defined in its module script, with world and character rendering systems in `src/`.

## Get the complete asset checkout

Large source packs, GLB files, HDR images and WAV files are tracked through Git LFS. From the repository root:

```powershell
git lfs install
git lfs pull
```

Check that large archive files are real downloaded files, not short Git LFS pointer text files, before attempting extraction.

## Prepare animation clips

The repository-owned FBX files in `Assets/` are copied into `public/assets/animations/fbx/` by:

```powershell
npm run assets:prepare
```

The script updates `public/assets/animations/manifest.json`. The normal production build invokes this step automatically:

```powershell
npm ci
npm run build
```

The current manifest maps available clips to Idle, Walk, Run, Sprint, Backpedal, Aim Idle, Shoot, Reload, Jump, Fall, Land, Hit, Death and Interact. It does not fabricate missing animations. The clips must target the same skeleton node/bone names as the chosen player rig. This pipeline loads FBX clips; it **does not automatically retarget incompatible skeletons**.

## Prepare the player model from the soldier archive

The character archive is a source pack, not a ready-to-load runtime path. Review its contents first:

```powershell
.\scripts\prepare-character.ps1 -ListOnly
```

The script ranks likely model candidates by filename hints (for example, soldier/character/rigged) and uncompressed file size. This is a convenience ranking, not proof that the selected file is the correct character, has a valid skeleton, has complete textures, or matches the reference identity.

After inspecting the candidate list and confirming the archive is the intended, rights-cleared player source, extract its model and supported texture files:

```powershell
.\scripts\prepare-character.ps1
```

The extraction is placed below `public/assets/characters/imported/zero-soldier/`. The script writes `public/assets/asset-catalog.json`; the runtime reads `character.playerModel` from this catalog and supports GLB/GLTF or FBX models.

**Before public release:** open the game and inspect the actual player mesh, likeness, materials, feet-to-ground alignment, forward axis, skeleton, animation binding and right-hand weapon socket. The current automatic candidate choice must be reviewed by a human. If the candidate is wrong, edit the catalog to point to the verified model. Do not claim the intended character likeness is complete based solely on extraction.

## Enemy animation integration

When the player rig loads successfully, the game clones it for enemy roles and applies a restrained faction tint. These clones use the available idle/walk/run, shoot, hit and death clips. This is a shared-rig integration stage; separate enemy faction meshes and unique gear still need to be supplied and visually reviewed. When no compatible player rig is available, the development actor proxy remains active and the missing-model warning remains visible in the F3 diagnostics.

## World assets and current limitations

The current world is a hybrid of a heightfield, photo-derived PBR crops, procedural road geometry, and photo-cutout vegetation. The three user-supplied world video frames are 320×180 stills, not photogrammetry or a 360-degree panorama. Houses and fences currently use photo panels at distance; near-field building, tree, boda boda, pickup, tank, bridge and other prop GLBs remain missing. Do not describe these photo panels as completed 3D geometry.

The F3 asset panel lists missing models and audio; F4 displays runtime performance counters. Low, Medium and High world presets are available. These counters and presets need real target-device profiling before performance can be certified.

## Verification boundary

A Vite production build validates the JavaScript bundle and the runtime asset-staging script. It does not prove that a downloaded character is the correct rig, that all imported animations bind, that combat feels balanced, or that low-end Android devices meet a frame-rate target. Those require browser play testing and Android device testing.

## Third-party assets and licensing

The repository contains candidate third-party asset archives and models, including packs with source/license details that still need review. Check each provider's current license, attribution, commercial-use and redistribution terms before shipping any source asset or extracted derivative in the web game or APK. A file being present in Git or Git LFS does not grant redistribution rights. Do not use ripped game assets or models with unclear provenance.
