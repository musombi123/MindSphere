# Source model inspection — 31 October 2026

**Repository:** `musombi123/MindSphere`  
**Source inventory run:** [GitHub Actions 41230822371](https://github.com/musombi123/MindSphere/actions/runs/41230822371)  
**Structural inspection run:** [GitHub Actions 41231113287](https://github.com/musombi123/MindSphere/actions/runs/41231113287)  
**Scope:** standalone FBX/GLB/OBJ models and selected GLB/GLTF/FBX/OBJ members from source ZIP packs under `Assets/`.  
**Status:** structural inspection complete; visual approval and licence verification are still required.

## 1. Player character candidate

The strongest available humanoid rig candidate is:

`Female Basic Locomotion Pack.zip` → `trellis-2387720894.fbx`

Three.js FBXLoader structural inspection reported:

| Property | Result |
|---|---:|
| Meshes | 1 |
| Skinned meshes | 1 |
| Bones | 65 |
| Scene nodes reported | 67 |
| Embedded animation clips | 1 |
| Recognised Mixamo bones | Includes `mixamorigHips`, `mixamorigHead`, `mixamorigRightHand` |

The same archive includes Idle, Walking, Running, Jump, Left/Right Strafe and turn FBX files. The inspector's exported node-name samples for the Trellis rig and the pack's locomotion clips overlapped by 39 of 41 names (about 95%). This is a promising compatibility signal, not proof that every clip will look correct in motion.

**Recommendation:** use this as the first development rig to test the runtime importer. The archive name indicates a female character pack; inspect the actual appearance and confirm it is appropriate for the ZERO hero before treating it as final production art.

### Candidates rejected as the player

| Candidate | Structural result | Decision |
|---|---|---|
| `Assets/trellis-2387720894.glb` | 1 mesh, 0 skins, 0 skinned mesh nodes, 0 joints, 0 animations | Static mesh only; not an animated player rig |
| `Assets/trellis-2387720894.obj` | 17,310 vertices and 5,770 faces; OBJ has no skeleton or animation data | Not a runtime humanoid without a separate rigging/animation process |
| `german-bundeswehr-soldier-rigged.zip` | The inspected model entries contained only `source/Idle.fbx` | Animation file, not a complete soldier body |

## 2. Weapon source findings

| Candidate | Structural result | Engineering decision |
|---|---|---|
| `rifle__awp_weapon_model_cs2.glb` | 1 mesh, 1 skin, 6 joints, 22 embedded animations | A specific CS2 AWP viewmodel. Do not assume that source-game extraction permits redistribution; licence/provenance is unresolved. |
| `planetside_2_prototype_weapon.glb` | 4 meshes, 0 skins, 0 animations; includes a studio/pedestal scene with large bounds | Needs scene-node isolation, hand-scale fitting and licence review; not a ready weapon socket asset. |
| `Murder_Drones_Weapons.glb` | 27 meshes, 10 skins, 79 joints, 14 images, 0 animations | A multi-weapon collection, not one weapon. Individual submodels need isolation and licence review. |
| `weapons.zip` → `source/bb.glb` | 9 skinned meshes, 27 joints, 19 materials, 22 images | A combined weapon collection with several game-style weapon nodes; do not load the complete collection as a single held weapon. Source provenance/rights are unresolved. |
| `weapon-pack.zip` → `source/weapon_pack_SF.fbx` | FBX model candidate; no visual/rig sign-off | Needs individual model and licence review before runtime mapping. |

The weapon catalog remains intentionally empty. The hand socket expects one suitable, isolated weapon model for each game slot; it must not receive an entire pack or a model chosen only by filename.

## 3. Environment and farming assets

### Mini farming pack

`mini-farming-pack-free-low-poly-farming-assets.zip` → `source/Farm Pack.glb`

Structural report:

- 51 nodes
- 10 meshes / 52 primitives
- 40 materials
- No embedded image textures
- No skins or animation
- Approximate combined accessor bounds: 7.05 × 3.75 × 30.15 source units

The node names include a pump, garden bench, charpai, scarecrow, bullock cart, machan and corn/maize elements. This is a combined farm scene, not one isolated tree/crop prop. It may be useful after reviewing the visual style, scene-node separation, scale, and licence. It should not be mapped to a single vegetation key as-is.

### Kenney Retro Fantasy Kit

The inspected ZIP contains 105 GLB, 105 FBX and 105 OBJ model files. Its names include trees, shrubs, fences, walls, roofs and crates. This provides many small GLB props, but the pack is visibly categorised as a retro-fantasy kit by its asset naming; it should not be used to claim a photoreal Bungoma environment. Only individual generic props that visually fit the art direction and have confirmed licence terms should be considered.

### Rural/homestead packs

The inspected archives `thatched-rural-houses.zip` and `low-poly-bus-stop-game-ready.zip` did not expose GLB, GLTF, FBX or OBJ model members in the source inventory. `rural-toilet-1.zip` exposed one FBX candidate, but it has not been identified or approved as a production building model.

**Environment conclusion:** there is still no verified near-field rural house, mabati-roof homestead, boda boda, pickup, water tank, bridge or photoreal tree set ready to map. The current world remains a hybrid of procedural terrain/road, source-photo textures/cutouts and unfilled GLB catalog slots.

## 4. Safe next import

To stage the inspected player rig on a Windows checkout:

```powershell
git lfs pull --include="Assets/Female Basic Locomotion Pack.zip"
.\scripts\prepare-character.ps1 -Archive "Female Basic Locomotion Pack.zip" -ListOnly
.\scripts\prepare-character.ps1 -Archive "Female Basic Locomotion Pack.zip" -ModelEntry "trellis-2387720894.fbx"
npm run build
```

The importer extracts the selected FBX plus its supported pack files to `public/assets/characters/imported/zero-soldier/` and updates `public/assets/asset-catalog.json`. The next build automatically prefers the pack's Idle/Walk/Run/Jump/Strafe clips for the compatible states and validates their files.

After extraction, render the hero in the game and inspect face/body appearance, clothing, textures, forward axis, foot placement, foot sliding, aim/shoot/reload transitions and the right-hand socket. Commit the extracted runtime files through the existing Git LFS rules only after confirming that the model is the intended game character and the source licence allows use in the project.

## 5. Licence and release gate

The structural audit does **not** establish ownership, creator identity, licence, commercial-use rights, redistribution rights or derivative-work permission. Files being present in the repository or Git LFS does not grant those rights. Several weapon filenames explicitly refer to existing games; do not ship them as public web/APK content without a clear, applicable licence or permission.

The asset catalog must remain empty for roles that do not yet have a verified, appropriate model. A missing-asset diagnostic is better than silently inserting an unrelated or legally unsafe model.
