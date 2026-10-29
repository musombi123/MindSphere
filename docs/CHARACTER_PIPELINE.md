# Player character pipeline

## Current implementation

The player is created as a visual root managed by \`src/characters/PlayerController.js\`. It tries to load \`/assets/characters/player.glb\` using Three.js \`GLTFLoader\`, \`DRACOLoader\`, \`KTX2Loader\`, \`MeshoptDecoder\`, and \`SkeletonUtils.clone\`. Loaded skinned meshes keep their glTF PBR materials, receive shadows, are normalised to about 1.88 metres tall, and expose a right-hand weapon socket when a recognised hand bone is present.

If \`player.glb\` is absent or invalid, a temporary capsule/sphere humanoid proxy is displayed and a clear \`console.warn\` identifies the missing asset. It is explicitly a development fallback, **not** the final realistic model. The existing game still owns player movement, mission progression, weapons, damage, abilities, story, and HUD.

The loading strip shows model progress. A short over-the-shoulder camera mode is activated by holding the **right mouse button**; standard movement and the existing left-mouse/Space fire controls remain intact.

## Exact manual steps still required

1. Add the intended reference photos to \`public/reference/player/\`. The repository's seven root-level JPEGs are copied there by this change. The exact face/outfit mapping remains pending visual confirmation; the implementation does not guess which image shows which feature.
2. Create the actual hero avatar in a character-creation tool such as Avaturn or Character Creator, using the supplied photos as the likeness and outfit references. Export a humanoid, skinned GLB with PBR materials. Make sure the face texture is authored/UV-mapped onto the head in the character-creation pipeline; a face photograph is **not** automatically projected onto a 3D head by this loader.
3. Put the exported model at \`public/assets/characters/player.glb\`. Export with the feet on the floor, a humanoid skeleton, a clear right-hand bone (for example \`mixamorig:RightHand\`), and forward facing local \`-Z\`. The loader normalises height and horizontal centring but does not retarget unrelated skeletons automatically.
4. Include clips directly inside \`player.glb\`, with descriptive names, or place compatible GLB animation files under \`public/assets/animations/\` and register them in \`public/assets/animations/manifest.json\`. For separately exported clips, keep the same bone/node names and bind-pose convention as the player model. Do not provide FBX files to this GLTFLoader pipeline without first converting them to GLB.
5. Recommended clip names: \`Idle\`, \`Walk\`, \`Run\`, \`Sprint\`, \`StrafeLeft\`, \`StrafeRight\`, \`Backpedal\`, \`Jump\`, \`Fall\`, \`Land\`, \`AimIdle\`, \`Shoot\`, \`Reload\`, \`Hit\`, \`Death\`, \`Interact\`, \`Shockwave\`, \`Aegis\`, \`Overdrive\`, \`ChainLightning\`, and \`SecondWind\`. The controller maps common Mixamo-style variants and blends available idle/walk/run/sprint clips by movement speed. Missing clips are reported as warnings rather than silently fabricated.
6. Tune \`PLAYER_WEAPON_SOCKET\` position/rotation in \`PlayerController.js\` after the real GLB is available. The socket is created from the right-hand bone where possible; model-specific grip alignment cannot be verified until the model is supplied.

## Decoder files and Android/offline behavior

Run \`npm install\` after pulling the change. The \`postinstall\` script copies the Draco and Basis decoder payloads from the installed Three.js package into \`public/decoders/draco/\` and \`public/decoders/basis/\`, where the loaders can use them offline. Meshopt decoding is imported from the installed Three.js package. The model and all animation clips should be stored locally in \`public/\`, not served from a third-party URL, so they work in a Capacitor build without a network connection.

## Validation boundary

A real rigged character cannot be confirmed until \`player.glb\` and real animation clips are added. The build can be checked for module/integration errors now, but likeness, clip retargeting, right-hand grip, shadows on-device, and Android frame rate require the actual GLB and a runtime/device test.
