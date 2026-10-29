# World reference map — The Red Road

All visual references in this phase come from the user's uploaded video \`1000034633.mp4\`.

| Source image | Visual evidence | World use |
|---|---|---|
| \`video_frame_02s.webp\` | Red laterite road, brick boundary wall, shrubs, dense trees and blue/clouded sky | \`Sky.js\` creates overlapping curved sky/tree-line/horizon panels from this photo. \`TextureFactory.js\` also crops the road/soil area of this same frame for photo-based road/terrain albedo. |
| \`video_frame_16s.webp\` | Irregular timber/stick fence, mature tree trunks, lush green garden and small flowers | \`TextureFactory.js\` creates the photo-based fence, bark, wood, leaf and ground-cover maps from this image. |
| \`video_frame_26s.webp\` | Rustic homestead/shed, rough wall, projecting corrugated roof and yard vegetation | \`TextureFactory.js\` creates roof/metal texture crops and a homestead photo panel from this frame. |

## Precision notes

- These are normal camera frames, not a 360-degree panorama; the sky is placed on a curved backdrop ring.
- Road/soil albedo comes from an actual crop of the road visible in the user's photo. The corresponding normal/roughness maps are derived from the photo pixels.
- Ground and vegetation materials are photo crops; they are not claimed to be photogrammetric scans.
- Near-distance GLBs are not bundled yet. The F3 diagnostics panel lists the missing model paths and the red banner reports the first missing path instead of silently treating a photo card as a model.
