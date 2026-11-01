# World photo inventory — Project Zero Hour / The Red Road

These are stills extracted from the user's uploaded video \`1000034633.mp4\`. They are not third-party stock photos. The full 77 MB video is not copied into the game repository; compact WebP stills are bundled for offline use.

| Image | Source moment | What the photo shows | In-game use |
|---|---|---|---|
| \\`public/reference/world/video_frame_02s.webp\\` | Approx. 2 seconds; 320×180 WebP still | Red laterite road crossing the foreground, long brick/masonry boundary wall to the left, shrubs and a thick dark-green tree line, tall roadside trunks/posts, overhead wires and blue sky with white cumulus clouds | Road/soil and related ground-material source crop. The sky is rendered by a procedural shader dome; no photo panel is used. |
| \\`public/reference/world/video_frame_16s.webp\\` | Approx. 16 seconds; 320×180 WebP still | Hand-built irregular timber/stick fence between mature tree trunks, lush garden understory, broad leaves and small flowers | Bark/wood, leaf and ground-cover material source crops. Vegetation is rendered as instanced 3D geometry, not photo cutouts. |
| \\`public/reference/world/video_frame_26s.webp\\` | Approx. 26 seconds; 320×180 WebP still | Rustic rural outbuilding/homestead with rough walls, projecting corrugated roof/canopy, a simple small shed nearby, red earth and garden trees | Roof/metal and related surface material source crops. Homestead scenery is represented by 3D procedural mesh groups, not a photo panel. |

## Important limitations

The uploaded video contains ordinary handheld camera frames, not a 360-degree panorama. The sky module renders a continuous procedural atmospheric shader dome with a sun halo and generated distant ridge; it does not build a panorama from the source photographs. Normal and roughness maps are derived from the luminance/detail of the same source photos; they are not separate photographs. The road, vegetation and rural props are 3D meshes.

The video frame stills are compressed for offline delivery and distant views. They are good source references for the look, but larger source frames or isolated tree/house/fence images would improve close-up texture detail.
