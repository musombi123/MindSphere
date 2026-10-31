# Asset credits and licensing

## User-supplied real-world photo references

| File | Source and status |
|---|---|
| \`public/reference/world/video_frame_02s.webp\` | Still extracted from the user's uploaded video \`1000034633.mp4\`, approx. 2 seconds. Red laterite road, brick boundary wall, dense tree line and clouded blue sky. Road/soil crops are sourced from this frame. |
| \`public/reference/world/video_frame_16s.webp\` | Still extracted from the user's uploaded video, approx. 16 seconds. Timber/stick fence, tree trunks, green garden and flowers. |
| \`public/reference/world/video_frame_26s.webp\` | Still extracted from the user's uploaded video, approx. 26 seconds. Rustic homestead/outbuilding, rough walls, corrugated roof and yard. |

These are user-provided media, not third-party stock. The project does not assert rights to people or other private subjects appearing in the footage; obtain any permissions needed for public distribution.

## Code and dependencies

| Asset or module | License / status |
|---|---|
| Three.js | Existing project dependency; MIT |
| \`three-mesh-bvh\` | MIT; used for heightfield spatial raycasts |
| \`src/world/TextureFactory.js\` | Project code that crops the user's photographs and derives normal/roughness maps from those pixels. It does not synthesize substitute albedo textures. |
| \`src/world/Sky.js\` | Project code placing the user's ordinary camera frames on feathered curved background panels; the source footage is not a 360-degree panorama. |

## Still required for full photorealism

Near-range tree, homestead, fence, vehicle and water-tank GLB models and a true 360-degree HDR panorama are not included yet. These missing GLBs are intentionally listed in the F3 debug panel and the on-screen asset-missing banner.

## Imported candidate packs — rights review required

The repository also contains user-imported candidate FBX, GLB, ZIP, EXR and WAV assets under `Assets/`. The individual creators, original source pages and license terms have not yet been verified in this repository documentation. Do not treat Git LFS availability or repository possession as a grant of redistribution, commercial-use or derivative-work rights. Before shipping any candidate asset in a public web build or APK, record its creator/source URL, exact license version, attribution requirements, modification status and redistribution permission here. Remove or replace any asset whose provenance or license cannot be established.
