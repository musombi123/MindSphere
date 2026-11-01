# Player and enemy character pipeline

## Runtime

The active game uses Three.js. `src/characters/PlayerController.js` accepts a GLB/GLTF or FBX player model. It reads `public/assets/asset-catalog.json` and uses `character.playerModel` when present; otherwise it checks the legacy `public/assets/characters/player.glb` path. The selected model is cloned, normalised to approximately 1.88 metres, and given a right-hand weapon socket where a recognised hand bone exists.

The same controller creates reusable skinned-rig clones for enemies. Gangster, thief, commander and Echo roles receive restrained material tints and use available locomotion, shooting, hit and death clips. This is a shared-rig integration stage, not a completed set of visually unique enemy factions. Faction-specific models, equipment and animations still need to be supplied and reviewed.

The game still owns movement, combat, mission progression, weapons, damage, abilities, story and HUD. The controller owns the player visual rig, player animation mixer, enemy rig clones and their animation mixers.

## Source rig inspection — 31 October 2026

The automated source-model inspection in [GitHub Actions run 41231113287](https://github.com/musombi123/MindSphere/actions/runs/41231113287) parsed the available character and model candidates with Three.js. It found:

- `Female Basic Locomotion Pack.zip` contains `trellis-2387720894.fbx`: **1 skinned mesh, 65 bones, 1 embedded animation**. The hierarchy includes Mixamo-style names such as `mixamorigHips`, `mixamorigHead` and `mixamorigRightHand`.
- The locomotion pack's Idle/Walk/Run/Jump/Strafe clips use closely matching node hierarchies (39 of 41 names in the inspector's exported node-name sample matched the Trellis rig). The runtime can load these clips against that model; final in-game animation quality still needs visual testing.
- The standalone `Assets/trellis-2387720894.glb` has **no skin and no bones**. It is a static mesh, not the player rig; the runtime's humanoid validation correctly rejects it.
- `german-bundeswehr-soldier-rigged.zip` contains only `source/Idle.fbx` in the inspected archive, not a complete soldier character. Do not use that archive as the player model.

**Recommended development rig candidate:** `trellis-2387720894.fbx` from the Female Basic Locomotion Pack. This is a structural compatibility result, not visual approval. The archive name indicates a female locomotion pack; open the rendered character and confirm that its body, clothing and appearance are acceptable for the ZERO hero before treating it as the final player model. Verify the asset licence before public distribution.

To inspect and stage that candidate on Windows:

```powershell
git lfs pull --include="Assets/Female Basic Locomotion Pack.zip"
.\scripts\prepare-character.ps1 -Archive "Female Basic Locomotion Pack.zip" -ListOnly
.\scripts\prepare-character.ps1 -Archive "Female Basic Locomotion Pack.zip" -ModelEntry "trellis-2387720894.fbx"
```

The script extracts the candidate model and the pack's FBX locomotion files below `public/assets/characters/imported/zero-soldier/`, then merges its model path into `public/assets/asset-catalog.json`. It preserves existing world and weapon catalog mappings.

## One-command Windows character import

The source archive is stored in Git LFS. From the current feature branch, run:

```powershell
npm run assets:import:character
```

This restores the tracked archive only if it is missing from the working tree,
pulls it through Git LFS, imports the inspected
`trellis-2387720894.fbx` candidate and its pack files, then runs the normal
production build. It does not commit or push imported binary assets.

After the build, inspect the character's body/clothing, textures, orientation,
movement and weapon-hand alignment. Verify the source licence before release.
Only then stage the imported runtime folder, shared catalog and animation
manifest for a commit.

## Compatible animation selection

The baseline 33-clip set is staged from loose FBX files under `Assets/`. When the Trellis character pack has been extracted, `scripts/prepare-runtime-assets.mjs` automatically prefers its matching pack files for:

- Idle — `idle.fbx`
- Walk — `walking.fbx`
- Run — `running.fbx`
- Jump — `jump.fbx`
- Strafe left — `left strafe.fbx`
- Strafe right — `right strafe.fbx`
- Turn — `left turn.fbx`

Other actions (crouch, prone, shoot, reload, hit, death, dodge and melee) continue using the baseline staged clips unless compatible versions are added. The selected character-pack clips are referenced directly under `/assets/characters/imported/zero-soldier/`; the rest remain under `/assets/animations/fbx/`. The normal build refreshes the manifest before validation.

The runtime now checks animation track targets against the loaded player rig before creating an action. Clips below 65% target-name coverage are rejected and reported; accepted clips are also the only ones cloned to enemy rigs. The source inspection found 76 animation FBXs with 52/52 target-name coverage on the Trellis rig.

This is **name-compatible clip binding**, not automatic retargeting. A close node-name match is a promising structural signal but does not guarantee every joint orientation, bind pose, root-motion choice or clip transition is correct. Verify idle, walk, run, sprint, aim, shoot, reload, jump, crouch, hit and death in the actual browser game. Check for foot sliding, twisted wrists, root drift and weapon-hand alignment.

## Enemy reuse and weapon socket

When the player rig loads successfully, the game clones it for enemy roles and applies faction tints. Distinct faction silhouettes, clothing/armour, gear and bespoke enemy rigs are not yet present.

The player weapon socket attaches to a recognised right-hand bone (Mixamo-style RightHand/HandR names are recognised). When no matching hand bone exists, the runtime marks the socket approximate and logs a warning. Adjust weapon model offsets after inspecting the actual player and rifle together; the current socket alignment is not visually signed off.

## Development fallback and diagnostics

If the catalog/model is unavailable or the model fails to load, the game retains a labelled temporary proxy so the gameplay prototype can still start. The missing-model message and F3 asset diagnostics remain visible/logged. That proxy is not the production character.

## Validation boundary

CI verifies the JavaScript build, staged animation files and model file references. It cannot prove likeness, final art quality, rig fidelity, animation quality, weapon grip, mobile performance or licence compliance. Those checks require the extracted model in the browser, then physical Android device testing.
