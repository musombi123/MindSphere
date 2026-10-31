# Player and enemy character pipeline

## Runtime

The active game uses Three.js. `src/characters/PlayerController.js` now accepts either a GLB/GLTF or FBX player model. It reads `public/assets/asset-catalog.json` and uses `character.playerModel` when present; otherwise it checks the legacy `public/assets/characters/player.glb` path. The selected model is cloned, normalised to approximately 1.88 metres, and given a right-hand weapon socket where a recognised hand bone exists.

The same controller stages reusable skinned rig clones for enemies. Gangster, thief, commander and Echo roles receive restrained material tints and use available locomotion, shooting, hit and death clips. This is a shared-rig integration stage, not a completed set of visually unique enemy factions. Faction-specific models, equipment and animations still need to be sourced/created, checked and integrated.

The game still owns movement, combat, mission progression, weapons, damage, abilities, story and HUD. The controller only owns the player visual rig, the player animation mixer, enemy rig clones and their animation mixers.

## Stage FBX animations

The source FBX animation files remain in `Assets/`. Run:

```powershell
npm run assets:prepare
```

This copies the selected source clips to `public/assets/animations/fbx/` and registers them in `public/assets/animations/manifest.json`. The standard `npm run build` runs this preparation step automatically.

Current staged map: Idle, Walk, Run, Sprint, Backpedal, Aim Idle, Shoot, Reload, Jump, Fall, Land, Hit, Death and Interact. Some gameplay ability animations (Shockwave, Aegis, Overdrive, Chain Lightning and Second Wind) are not present in the selected map; the controller must not pretend those clips exist.

**Skeleton constraint:** external FBX clips are played against the active character skeleton by matching animation track/node names. This is not an automatic humanoid retargeter. If the clip skeleton and player rig do not share compatible bone names and rest pose, the clip may not animate correctly. Confirm this in a real browser session using the chosen rig.

## Extract the soldier archive

The current repository includes `Assets/german-bundeswehr-soldier-rigged.zip` as a Git LFS source archive. First ensure Git LFS has downloaded the real archive:

```powershell
git lfs pull
.\scripts\prepare-character.ps1 -ListOnly
```

Review the model candidates the script reports. It ranks files by filename hints and uncompressed file size; this cannot establish likeness, quality, rig validity, textures or redistribution rights. After confirming the intended source model and license, run:

```powershell
.\scripts\prepare-character.ps1
```

The script extracts supported model and texture files below `public/assets/characters/imported/zero-soldier/` and writes `public/assets/asset-catalog.json`. The game then discovers the configured model through the catalog. Review the selected player in the game before using it as the release character. If the chosen archive does not contain a suitable original rig, do not force an animation-only FBX into the player slot; use another compatible player asset.

## Weapon socket

The player weapon socket is attached to a recognised right-hand bone (Mixamo-style RightHand/HandR names are recognised). When no matching hand bone is found, the runtime marks the socket approximate and logs a warning. Adjust the socket's local offset after inspecting the actual model and rifle grip. The present socket alignment has not yet been visually signed off.

## Development fallback and diagnostics

If the catalog/model is unavailable or the model fails to load, the game retains a labelled temporary proxy so the gameplay prototype can still start. The missing-model message and F3 asset diagnostics remain visible/logged. That proxy is not the production character and must not be represented as the final art.

## Validation boundary

The repository build can validate the FBX staging script and JavaScript integration. It cannot prove that the extracted soldier is the right character, its PBR textures look correct, the animation clips bind correctly, the rifle grip aligns, or the game meets low-end Android frame-rate targets. Those checks require running the built game with the actual extracted rig and then testing on desktop and physical Android devices.
