# Project Zero Hour — Combat and movement systems

## Player movement

The active web/Capacitor runtime is implemented in `index.html` and `src/characters/PlayerController.js`.

| Control | Action | Runtime behaviour |
|---|---|---|
| WASD / arrows | Move | Terrain-relative planar movement |
| Shift | Sprint | 1.35× movement speed |
| Ctrl | Crouch | 0.58× movement speed and crouch animation blend |
| J | Jump | Initial vertical velocity 7.2 m/s; gravity 17.5 m/s²; landing trigger on ground contact |
| V | Dodge | 13.5 m/s directional burst for 0.28 s; 0.22 s damage-immunity window; 2.5 s cooldown |
| T | Melee | Nearest enemy within 2.65 m; 0.85 s recovery |
| Right mouse | Aim | Aim camera offset and upper-body aim animation |
| Left mouse / Space | Fire | Active weapon projectile fire |
| R | Reload | Reload active magazine |
| Q / E | Shockwave / Aegis | Existing abilities and cooldowns |
| G | Interact | Context-sensitive chapter objective action |
| F / C / X | Overdrive / Chain Lightning / Second Wind | Unlockable progression abilities |
| 1–4 | Weapon slot | Changes combat stats and the catalog-driven hand weapon visual |

On mobile, the same actions are exposed as touch controls. Movement/aim/fire do not require a gamepad.

## Damage and evasion

- Player damage is reduced while Aegis is active.
- Dodge ignores incoming player damage during its short immunity window; it is not permanent invulnerability.
- Jump applies vertical motion and a landing transition. Enemy shots use the player's vertical position for hit checks, and the Chapter 02 river wave only hits the player while grounded.
- Melee targets the nearest living enemy in horizontal range. It is not an aim-cone or combo system yet.

## Enemy role AI

Enemy records choose a role mode at short intervals and steer toward role-specific ranges. This is steering behaviour, not navmesh/pathfinding.

| Role | Behaviour | Preferred range |
|---|---|---:|
| Black Viper raider | Advances, then suppresses while sidestepping | about 5.8 m |
| Thief/scavenger | Uses diagonal flank movement and circles nearby | about 7.5 m |
| Echo unit | Advances at range, strafes in its firing band and retreats when rushed | about 13.5 m |
| Commander Kito | Advances, repositions when crowded and strafe-holds a command range | about 9.5 m |

Enemy fire now leads the player's recent horizontal movement with a capped prediction time. Echo units use distinct violet projectiles; the commander retains a separate boss projectile. Existing chapter-specific trust/sever signal choices still alter enemy fire timing.

**Known limitation:** the current AI does not perform navigation-mesh pathfinding, cover selection, squad coordination, obstacle-aware tactical routing, or human-like perception. The new role steering improves engagement variety but is not a replacement for a production tactical AI stack.

## Validation checklist

1. In Chapter 01, test walk/run/sprint, crouch, jump/land, dodge immunity, melee range, all four weapon slots, reload and the Kito encounter.
2. In Chapter 02, verify a jump can clear the grounded river-wave hit condition; dodge can avoid a hit during its active window; rescue and anchor interactions remain reachable with G.
3. In Chapter 03, verify memory/phase-seam interactions still require deliberate G input and Echo units maintain a longer firing range.
4. Test touch controls with simultaneous movement and fire; use one additional finger for Jump/Dodge/Melee.
5. Test on the lowest target Android device. Check FPS and render counters with F4; check missing/loaded runtime assets with F3.

Balance constants are starting values. Retune only after measuring engagement length and hit rates in all three chapters on desktop and the target phone class.
