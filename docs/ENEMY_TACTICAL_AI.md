# Enemy tactical AI

The active Three.js runtime now evaluates enemy movement through
`src/combat/EnemyTacticalAI.js`.

## Tactical behaviours

- **Stable squad lanes:** each enemy receives a deterministic slot and flank side when the encounter spawns. Raiders approach with small lane offsets instead of aiming for the same exact point.
- **Personal-space steering:** nearby living allies contribute a soft separation vector, reducing enemy stacking without introducing abrupt teleportation.
- **Role-specific intent:** raiders advance and suppress; thieves flank and circle; Echo units hold range or retreat; commanders reposition and command from their preferred band.
- **Suppression response:** incoming damage briefly raises suppression, triggers a lateral evasive response, lowers firing accuracy and lengthens the next firing interval.
- **Rush response:** a fast player approach at close range can trigger a short evasive sidestep.

The director uses local steering, not navmesh pathfinding. It does not claim obstacle-aware navigation, physical cover selection, squad communication or perception through geometry. Those require a world collision/navigation representation and are separate engineering stages.

## Regression test

Run:

```powershell
npm run test:tactical
npm run build
```

The production build runs this regression test after asset preparation and validation. Tests cover role steering, stable slot assignment, suppression decay, rush response, finite steering vectors and overlapping-actor safety.
