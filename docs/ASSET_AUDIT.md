# Project Zero Hour — Asset Audit

**Audit date:** 2026-10-29  
**Repository:** `musombi123/MindSphere`  
**Audited revision:** `4d7c760dee92120a58736c776f56f782efae3f8b` (`main`)  
**Scope:** repository root, `Assets/`, and `public/reference/`  
**Status:** **BLOCKED — required art assets are absent, and this repository is not currently a Unity 6 LTS project. No gameplay or art code was changed in this audit.**

## 1. Executive findings

- The tracked `Assets/` directory contains **5 files, all C# scripts**. It contains **zero** tracked models, Unity prefabs, materials, textures, animations, audio files, or Unity scenes.
- There is no visible Unity project scaffold in the audited repository: no `ProjectSettings/`, `Packages/manifest.json`, `.unity` scenes, or `.meta` files were found in the tracked tree. The checked-in root instead has `package.json`, `vite.config.js`, `index.html`, `dist/`, and a bundled Three.js/Vite web prototype. The README describes procedural scenery and says procedural shapes are used for characters and scenery.
- `public/reference/player/` contains **7 JPEG references**. The repository's `docs/PLAYER_REFERENCE_MAP.md` explicitly says their pixels were not visually inspected in the previous editing session and their individual roles remain unconfirmed. In this audit environment the GitHub connector exposes filenames and byte sizes, but rejects binary image content; therefore I cannot truthfully claim to have opened/visually inspected those seven photographs or verify their pixel dimensions. They are marked **visual review pending**, not guessed.
- `public/reference/world/` contains **3 WebP stills**. The existing `docs/WORLD_INVENTORY.md` documents each as **320 × 180**, so all three are **below 512 px** and unsuitable as close-up production texture sources. The descriptions below are taken from that existing inventory; the image pixels could not be independently reopened in this audit session.
- Do not treat web prototype assets, procedural shapes, reference photos, or browser assets as production-ready Unity character/environment models. Do not create replacement primitive art. Missing required runtime assets must remain conspicuously marked pink **MISSING ASSET**, be logged, and be included in this list when a Unity scene/project is available.

## 2. Asset counts

Counts are based on the tracked Git tree at the audited revision. “Models” includes common exchange/model files and Unity prefabs. Reference photographs are counted separately from runtime assets.

| Asset category | In `Assets/` | In `public/reference/` | Finding |
|---|---:|---:|---|
| 3D models (`.fbx`, `.glb`, `.gltf`, `.obj`, `.blend`) | 0 | 0 | Missing |
| Unity prefabs (`.prefab`) | 0 | 0 | Missing |
| Textures/images used as Unity assets | 0 | 0 | Missing |
| Materials (`.mat`) | 0 | 0 | Missing |
| Animations/controllers (`.anim`, `.controller`) | 0 | 0 | Missing |
| Audio (`.wav`, `.mp3`, `.ogg`, `.aiff`) | 0 | 0 | Missing |
| Unity scenes (`.unity`) | 0 | 0 | Missing |
| C# scripts (`.cs`) | 5 | 0 | Present; all five are listed below |
| Player reference photos (`.jpg`/`.jpeg`) | — | 7 | Pixel-level review pending |
| World reference stills (`.webp`) | — | 3 | Existing inventory says 320 × 180 each |
| Other reference documentation | — | 1 | `public/reference/world/README.md` |

### Files in `Assets/`

1. `Assets/ProjectZeroHour/Scripts/Player/PlayerInputRouter.cs` — 8,847 bytes
2. `Assets/ProjectZeroHour/Scripts/Player/PlayerLookPad.cs` — 1,209 bytes
3. `Assets/ProjectZeroHour/Scripts/Player/PlayerTouchButton.cs` — 1,856 bytes
4. `Assets/ProjectZeroHour/Scripts/Player/PlayerVirtualJoystick.cs` — 2,599 bytes
5. `Assets/ProjectZeroHour/Scripts/Player/ThirdPersonPlayerController.cs` — 15,361 bytes

These filenames indicate input/controller code, not rendered art. Their presence does not establish that they compile in Unity 6 or that a Unity project exists.

## 3. Root inventory

The repository root contains these tracked files (sizes in bytes):

| File | Bytes | Notes |
|---|---:|---|
| `IMG-20251120-WA0000.jpg` | 93,020 | Duplicate-location candidate for player reference; root copy retained |
| `IMG-20251120-WA0003.jpg` | 102,991 | Duplicate-location candidate for player reference; root copy retained |
| `IMG-20260220-WA0006.jpg` | 61,853 | Duplicate-location candidate for player reference; root copy retained |
| `IMG-20260220-WA0007.jpg` | 88,016 | Duplicate-location candidate for player reference; root copy retained |
| `IMG20260223152044.jpg` | 2,018,988 | Duplicate-location candidate for player reference; root copy retained |
| `IMG20260223152238.jpg` | 2,018,551 | Duplicate-location candidate for player reference; root copy retained |
| `IMG20260224151445.jpg` | 2,022,853 | Duplicate-location candidate for player reference; root copy retained |
| `README.md` | 7,569 | Describes a Three.js/Vite web prototype |
| `STORY_BIBLE.md` | 13,937 | Narrative document |
| `capacitor.config.json` | 234 | Capacitor web-wrapper configuration |
| `index.html` | 104,391 | Web game/application entry point |
| `package-lock.json` | 75,726 | npm dependency lockfile |
| `package.json` | 609 | npm scripts/dependencies |
| `vite.config.js` | 492 | Vite configuration |

The tracked tree contains 3,289 files overall, including the web build, dependencies, documentation and workflows. That repository-wide number is not a count of game art assets.

## 4. Reference-image inventory

### 4.1 Player references

The following seven files exist in `public/reference/player/`. Individual visual content and pixel dimensions are **not verified**: the binary image payloads were not available to inspect in this session. I will not infer a face, hairstyle, skin tone, clothing, pose, or body build from filenames.

| File | Size | Visual description | 512 px check |
|---|---:|---|---|
| `IMG-20251120-WA0000.jpg` | 93,020 bytes | Pending direct visual inspection | Dimensions unverified |
| `IMG-20251120-WA0003.jpg` | 102,991 bytes | Pending direct visual inspection | Dimensions unverified |
| `IMG-20260220-WA0006.jpg` | 61,853 bytes | Pending direct visual inspection | Dimensions unverified |
| `IMG-20260220-WA0007.jpg` | 88,016 bytes | Pending direct visual inspection | Dimensions unverified |
| `IMG20260223152044.jpg` | 2,018,988 bytes | Pending direct visual inspection | Dimensions unverified |
| `IMG20260223152238.jpg` | 2,018,551 bytes | Pending direct visual inspection | Dimensions unverified |
| `IMG20260224151445.jpg` | 2,022,853 bytes | Pending direct visual inspection | Dimensions unverified |

**Audit limitation:** the existing `docs/PLAYER_REFERENCE_MAP.md` records the same limitation. These photos are likeness references, not game-ready textures or 3D models. No likeness decisions should be made until the pixels can be inspected.

### 4.2 World references

Descriptions below reproduce the existing repository inventory in `docs/WORLD_INVENTORY.md` and have not been independently checked against pixels in this session.

| File | Existing documented description | Resolution | Quality decision |
|---|---|---:|---|
| `public/reference/world/video_frame_02s.webp` | Red laterite road, long brick/masonry boundary wall, shrubs, dense dark-green tree line, roadside trunks/posts, overhead wires and blue sky with white clouds | 320 × 180 | **Too small (<512 px)** for close-up textures; retain as visual reference only |
| `public/reference/world/video_frame_16s.webp` | Irregular hand-built timber/stick fence between mature tree trunks, lush garden understory, broad leaves and small flowers | 320 × 180 | **Too small (<512 px)** for close-up textures; retain as visual reference only |
| `public/reference/world/video_frame_26s.webp` | Rustic rural outbuilding/homestead with rough walls, projecting corrugated roof/canopy, small shed, red earth and garden trees | 320 × 180 | **Too small (<512 px)** for close-up textures; retain as visual reference only |

These are ordinary video stills, not a panorama, photogrammetry scan, or a set of calibrated PBR maps. Existing documentation says some web-prototype texture maps are derived from photo luminance; those derived web assets are not present as Unity textures in `Assets/`.

## 5. What is missing for the requested Unity target

**Critical project-format gap:** the checked-in project is a Vite/Three.js web prototype with Capacitor configuration, not a complete Unity 6 LTS project. Before a Unity-only pipeline can be validated, the repository needs a real Unity project scaffold (Unity-generated project settings, package manifest, scenes and metadata) or the correct Unity project/repository must be supplied. I have not silently converted or rewritten the existing web game.

Missing production art/runtime content:

- Player: rigged original humanoid model, clothing/gear, skin/hair/eye materials, PBR maps, animation clips and avatar setup.
- Weapons: separate mesh parts for magazine, bolt and optics; PBR textures/materials; reload/fire/inspect animation clips; muzzle attachment points.
- Enemies: three visually distinct original faction models and a distinct Commander; rigs, materials, animation sets and LODs.
- World: real terrain/landscape source, 4–6 usable PBR ground layers, tree/grass/rock/log/fence/house/farm-field assets and LODs. No Unity terrain or scene is tracked.
- Rendering: URP asset, renderer asset/features, lighting/reflection/light-probe setup, post-processing volume/profile, sky/fog setup and baked-lighting data.
- Gameplay presentation: weapon VFX, impacts, shell casings, dust, bullet holes, blood-free hit flash, ambient and weapon audio, premium HUD/icon assets, minimap art and loading screen.
- Mobile delivery: Unity Android build settings, ARM64/IL2CPP configuration, ASTC policy, quality tiers, device performance evidence and build-size report.
- Proof tooling: Unity-side debug overlay for FPS, draw calls, triangles, memory and explicit missing/primitive asset reporting.

## 6. Prioritized asset shopping list

Sources below are suggestions to review for license, redistribution rights, commercial use and offline bundling before adoption. Prefer original commissioned work or assets with clear CC0/compatible licenses. Do not use ripped game assets, PUBG branding, or copied models. Target triangle budgets are per visible LOD0 model unless stated otherwise.

| Priority | Exact asset required | Suggested free/low-cost source | Target path in Unity project | Target polygon / texture budget |
|---|---|---|---|---|
| P0 | Unity 6 LTS URP project scaffold, Android build profile and a minimal test scene | Unity Hub / Unity Editor (free Personal eligibility subject to Unity terms) | `ProjectSettings/`, `Packages/manifest.json`, `Assets/ProjectZeroHour/Scenes/AssetValidation.unity` | Not applicable; first establish a genuine Unity project |
| P0 | Original player soldier, Mixamo-compatible humanoid rig, layered clothing, boots, gloves, tactical vest/backpack | Commission original model; use Mixamo only for compatible rigging/animation where its terms permit; review Kenney/Sketchfab license filters for suitable components | `Assets/ProjectZeroHour/Art/Characters/Player/Player_Soldier.fbx` | 25k–45k triangles; 2K minimum, 4K hero PBR set where memory allows; albedo/base color, normal, metallic-smoothness, AO |
| P0 | Player material/texture set, including skin, cloth, leather, metal, hair cards and eyes | Original texture authoring; ambientCG/Poly Haven for generic compatible surface materials, not likeness textures | `Assets/ProjectZeroHour/Art/Characters/Player/Materials/` and `Textures/` | 2K–4K texture sets; mobile-compressed ASTC variants; separate masks/channels documented |
| P0 | Primary rifle with independently riggable magazine, bolt, optic and muzzle attachment | Original commission or license-cleared CC0/compatible model; verify redistribution rights | `Assets/ProjectZeroHour/Art/Weapons/Rifle/Weapon_Rifle.fbx` | 8k–15k triangles; 2K PBR set; separate moving parts/pivots |
| P0 | Three enemy faction soldiers with distinct silhouettes/gear, plus Commander | Reuse a licensed compatible base only if the license allows derivative/redistributed game assets; commission distinct gear/silhouettes | `Assets/ProjectZeroHour/Art/Characters/Enemies/FactionA/`, `FactionB/`, `FactionC/`, `Commander/` | 18k–35k triangles each; 1K–2K PBR sets; shared rig where practical, unique silhouettes and materials |
| P1 | Animation set: idle, walk, run, sprint, crouch, aim, fire, reload, hit reaction, death, melee | Mixamo animations subject to current terms, or original animator | `Assets/ProjectZeroHour/Art/Animations/Humanoid/` | Animation clips, no polygon budget; retarget to chosen humanoid rig |
| P1 | Red-soil/laterite, dry soil, grass, crop/field, gravel/rock and compacted path PBR surfaces | Poly Haven / ambientCG (verify each asset's current license and mobile suitability) | `Assets/ProjectZeroHour/Art/Environment/Materials/Ground/` | 4–6 terrain layers; 1K–2K tiling maps per layer: base color, normal, roughness, AO/height as supported |
| P1 | Kenyan rural house kit: mud-brick walls, mabati roof sheets, doors/windows, veranda and shed; modular fence/gate | Original kitbash/commission; license-cleared Sketchfab/BlenderKit assets only after inspection | `Assets/ProjectZeroHour/Art/Environment/Buildings/RuralHomestead/` | Modular pieces 500–8k triangles each; house kit target 10k–30k triangles visible; 1K–2K PBR textures |
| P1 | Trees, shrubs, grass clumps, crop rows, rocks, logs and fence segments | Poly Haven/ambientCG for surfaces; license-cleared vegetation assets or original models | `Assets/ProjectZeroHour/Art/Environment/Vegetation/` and `Props/` | Tree LOD0 3k–12k triangles; shrub 500–3k; rock/log 100–2k; grass cards budgeted by screen coverage; 2–3 LODs |
| P1 | Weapon/impact/VFX textures and particle materials (muzzle flash, tracers, sparks, dust, bullet marks, hit flash) | Original textures; license-cleared VFX packs | `Assets/ProjectZeroHour/Art/VFX/` | Small flipbooks/atlases, typically 256–1024 px; avoid expensive overdraw |
| P1 | Audio: weapon layers, distant tails, reloads, impacts, footsteps by surface, wind, birds and insects | Sonniss GDC audio bundles / Freesound with explicit license review, or original recordings | `Assets/ProjectZeroHour/Audio/{Weapons,Footsteps,Impacts,Ambience,UI}/` | 44.1/48 kHz source; compressed mobile runtime formats; mono for positional one-shots where appropriate |
| P2 | Premium HUD icon set, reticle variants, hit markers, damage-direction indicators, kill-feed symbols, map markers, loading art | Original vector/icon design or license-cleared Kenney UI assets as a base | `Assets/ProjectZeroHour/UI/Art/` | Vector/source plus crisp raster exports; 256–1024 px as appropriate |
| P2 | Terrain/prop decal set, signage and local environmental detail textures | Original authored decals; license-cleared surface packs | `Assets/ProjectZeroHour/Art/Environment/Decals/` | 512–1024 px atlases; trim sheets where suitable |
| P2 | Sky/environment source with correct rural Kenyan light and distant haze | Original sky capture or licensed HDRI from Poly Haven; not a stretched 320×180 frame | `Assets/ProjectZeroHour/Art/Environment/Sky/` | HDRI sized to performance target; test memory cost on mid-range Android |

**Shopping discipline:** do not buy assets until checking file format, source project, polygon count, rig/pivot structure, texture channels, LODs, license and redistribution permissions. Use a consistent scale/origin convention and test a single representative asset in Unity before buying a full pack.

## 7. Required next gate (no implementation in this step)

1. Make the correct Unity 6 LTS project available in this repository (or identify the intended Unity project location). The current tracked revision is a web game, so Unity build/rendering settings cannot be verified here.
2. Make the seven player reference pixels available for visual inspection; then record each photo's actual subject and dimensions without guessing.
3. Acquire/author the P0 assets first. Keep missing content visible with the exact pink **MISSING ASSET** marker and diagnostic log; never substitute primitive art.
4. Stop here. No character, weapon, enemy, world, lighting, VFX or UI implementation has been started by this audit.
