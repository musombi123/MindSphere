# World reference map — The Red Road

The environment is based on the user's uploaded video `1000034633.mp4`. Its frames are ordinary 320 × 180 camera stills, not photogrammetry or a 360-degree HDR panorama.

| Source image | Visual evidence recorded for the frame | Current world use |
|---|---|---|
| `video_frame_02s.webp` | Red laterite road, brick boundary wall, shrubs, dense trees and blue/clouded sky | Local albedo source for laterite road/soil and related ground materials. The sky is a continuous procedural shader dome; it does not use this frame as a panorama or backdrop card. |
| `video_frame_16s.webp` | Irregular timber/stick fence, mature tree trunks, lush garden and small flowers | Source pixels for bark, wood, leaf and ground-cover material crops. Tree trunks, branches, canopies, shrubs and grass are rendered as instanced 3D geometry. |
| `video_frame_26s.webp` | Rustic homestead/shed, rough wall, projecting corrugated roof and yard vegetation | Source for roof/metal and related surface material crops. Rural homesteads are constructed as 3D mesh groups; no full-frame homestead billboard is used. |

## Environment implementation

- `Terrain.js` builds a triangulated, queryable heightfield and uses a BVH for ground-height queries.
- `Road.js` builds the winding laterite road, surface ruts, eroded edges, grass verges, puddles and roadside stones as 3D geometry.
- `Vegetation.js` uses instanced trunks, angled branches, low umbrella-like canopies, canopy clusters, shrubs and grass tufts. Counts are reduced for the LOW quality preset.
- `Props.js` builds 3D rural houses, timber fencing, a boda boda, pickup, water tank and supply crates. These are authored procedural mesh stand-ins, not scans or final photorealistic GLBs.
- `Sky.js` draws a continuous atmospheric shader dome with a sun halo and generated distant ridge geometry. It does not place flat photo panels around the camera.
- `TextureFactory.js` derives surface albedo/normal/roughness crops from the three local user-supplied images. Their original resolution is not sufficient for close-up photogrammetric detail.

## Asset policy and limitations

A mapped GLB replaces only the matching procedural world prop. Unmapped models are **optional art backlog items**, recorded in F3 diagnostics and `ASSETS_NEEDED.md`; they are not falsely counted as failed downloads. A model that is mapped and then fails to load is a required asset error and remains visible in the red failure banner.

Photorealistic near-field GLBs (especially the acacia, homestead, fence and vehicle) and a true 360-degree HDR environment remain outstanding. See `ASSETS_NEEDED.md`. Do not describe the procedural stand-ins or the photo-derived material crops as photogrammetry.
