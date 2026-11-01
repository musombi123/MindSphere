# Project Zero Hour — dynamic environment simulation

The weather layer is driven by `src/world/Weather.js` and updated from
`WorldManager.render()`. It does not replace the photo-derived world surfaces,
the authored terrain or chapter-specific scene lighting.

## Runtime profiles

| Profile | Atmospheric behaviour |
|---|---|
| Clear | Low-density dust and pollen drift |
| Dust | Stronger dry wind and laterite-coloured airborne particles |
| Rain | Animated wind-slanted rain streaks and reduced visibility |
| Storm | Denser rain, stronger gusts and brief directional-lightning flashes |
| Anomaly | Violet atmospheric particles and phase-haze visibility |

The story selects profiles after its chapter environment has been constructed:
Chapter 01 uses clear air, Chapter 02 uses a storm at the Nzoia crossing, and
Chapter 03 uses the phase-anomaly atmosphere.

## Runtime details

- Rain is a bounded `LineSegments` buffer. Each drop is advanced by wind and
  fall speed, then recycled above the local heightfield once it reaches ground
  level or leaves the active weather volume.
- Dust/pollen particles respond to the active wind vector and gust oscillation.
- Storm lightning is a short-lived directional-light flash with a randomised
  cooldown. It does not allocate a new light or geometry per strike.
- Visibility changes preserve the chapter fog colour and restore the fog
  baseline when clear weather is selected.
- Low, Medium and High presets rebuild particle counts using separate budgets.
- F3 exposes a weather selector for QA; the chapter default remains active
  unless a developer overrides it.

## Regression checks

```powershell
npm run test:weather
npm run test:tactical
npm run build
```

Tests cover rain movement, fog restoration, storm flashes, unsupported profile
handling, quality rebuilding and resource disposal.

## Current limits

Rain does not yet create splash decals, wetness accumulation, puddle growth,
vehicle traction changes or audio occlusion. The current environment remains a
photo-reference/heightfield hybrid until reviewed, licensed near-field models
are imported and mapped. Do not treat atmospheric effects as a photogrammetry
reconstruction or as proof of mobile performance certification.
