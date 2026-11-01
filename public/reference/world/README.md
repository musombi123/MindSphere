# World photo assets

These three stills were extracted from the user's uploaded video `1000034633.mp4` and are required local material-reference assets. Do not replace them with stock images or unrelated generated image stand-ins. See `docs/WORLD_INVENTORY.md` for frame descriptions and `docs/WORLD_REFERENCE_MAP.md` for the current material mapping.

The frames are ordinary 320×180 video stills, not photogrammetry, calibrated PBR scans or a 360-degree panorama. The game uses local crops from them as source pixels for road/soil, bark/wood, leaf and roof/metal materials. The sky is a procedural shader dome; the horizon ridge, vegetation, road and rural scenery are 3D meshes.

An unmapped optional world/weapon GLB is listed in F3 diagnostics and `ASSETS_NEEDED.md`; it does not trigger the red required-asset banner. A required local image, model, animation, decoder or catalog file that actually fails to load remains a visible error.
