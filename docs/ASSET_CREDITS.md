# Asset credits and licensing

This phase adds the character loading/animation pipeline and stages the user's own reference images. It does not yet add a third-party humanoid GLB, animation pack, gun model, world pack, or texture pack. No third-party character asset is represented as included.

| Asset / code | Source | Licence / status |
|---|---|---|
| Three.js core | Existing project dependency, \`three@^0.170.0\` | MIT; retain its upstream licence notice |
| \`GLTFLoader\`, \`DRACOLoader\`, \`KTX2Loader\`, \`SkeletonUtils\`, \`MeshoptDecoder\` | Three.js example modules bundled with the existing Three dependency | Covered by the Three.js package licensing; see upstream repository |
| Draco decoder payload | Copied at install from \`three/examples/jsm/libs/draco/gltf/\` | Google Draco is Apache-2.0; preserve its licence/notice when redistributing the copied payload |
| Basis transcoder payload | Copied at install from \`three/examples/jsm/libs/basis/\` | Preserve the upstream licence notices distributed with the Basis payload |
| Repository reference JPEGs | Supplied by the project owner; copied byte-for-byte from the repository root into \`public/reference/player/\` | Treat as owner-provided likeness reference material; preserve any rights notes supplied by the owner |
| Google Photos reference album | \`https://photos.app.goo.gl/EUtjYgGUC73V9CJk8\` | Could not be fetched in this environment; no item from that album is bundled yet |
| Unsplash gun-photo reference | [Unsplash photo: “A gold and black gun on a black background”](https://unsplash.com/photos/a-gold-and-black-gun-on-a-black-background-HioI0Y-eTEQ) and the supplied [guns search page](https://unsplash.com/s/photos/guns) | Reference-only; no image is bundled in this player-only phase. Check the Unsplash License and any depicted brand/person permissions before using it in a shipped product |
| Realistic player model | Not supplied yet | **Manual asset required**: add \`public/assets/characters/player.glb\`; record its creator/source and exact licence here before shipping |
| Animation clips | Not supplied yet | **Manual asset required** if not embedded in \`player.glb\`; record the creator/source and exact licence for each clip before shipping |

## New packages

No new npm dependency is required for this phase. The GLTF/Draco/KTX2/SkeletonUtils/Meshopt decoder APIs used by the controller are supplied by the project's existing Three.js dependency. A local \`postinstall\` script stages decoder files from \`node_modules/three\` into \`public/decoders/\` for offline-capable runtime loading.

## Links

- Three.js: https://github.com/mrdoob/three.js
- Google Draco licence: https://github.com/google/draco/blob/main/LICENSE
- Meshoptimizer licence (if an external meshopt tool is introduced): https://github.com/zeux/meshoptimizer/blob/master/LICENSE.md
- Unsplash licence: https://unsplash.com/license
