# PROJECT ZERO HOUR — THE NINTH TOMORROW

**A 3D sci-fi action prototype set in a speculative future Bungoma County, Kenya.** This is an unfolding story, not a one-off arena: every recovered Echo Shard changes what the player knows, the final fragment asks for a consequential choice, and replaying a failed run is part of the fiction.

## Story mode

It is the year 2097. Following a 43-second blackout, radios around Bungoma begin receiving emergency messages from seventeen minutes in the future. The red-earth road beneath Mount Elgon is occupied by the Black Viper mercenaries, and a mysterious relay near Sang’alo is calling the experimental Aegis suit worn by Amani Wekesa, callsign **ZERO**.

Chapter 01 asks ZERO to stop the raiders, recover three Echo Shards, defeat commander Kito, and reach the relay. Each shard opens a radio transmission and pauses combat while the story is read. The third shard presents a persistent local choice:

- **Trust the Echo:** keep the warning channel open, even if the intelligence on the other side can hear ZERO.
- **Sever the Link:** cut the feedback, conceal ZERO’s location, and lose the guidance coming through the signal.

The end report changes with that choice. When a chapter is replayed, the game acknowledges the previous attempt and the stored choice. That loop is a story mechanic; it is not a cloud save or a completed multi-mission campaign.

Read the full premise and five-chapter arc in [STORY_BIBLE.md](STORY_BIBLE.md). **Chapters 01 and 02 are now implemented as playable prototypes. Chapters 03–05 remain the narrative roadmap, not yet playable missions.**

The setting uses real geographic anchors—including Mount Elgon, Sang’alo and Chetambe hills, and the Nzoia River—but the people, organisations, MILELE Engine, Conductor, technology, and events are fictional. The game does not claim that its speculative events or technology are real Bungoma history.

## Run locally

The app bundles Three.js through Vite, so the built game does not need to fetch the 3D library from a CDN at launch.

```bash
npm install
npm run dev
```

Open the local address printed by Vite. For a production-like local build:

```bash
npm run build
npm run preview
```

A modern browser with WebGL support is required.

## Controls

### Desktop
- **WASD / arrow keys:** move; **Shift:** sprint
- **Mouse:** aim; **hold left mouse button** or **Space:** fire
- **1–4:** switch weapons; **R:** reload
- **Q:** Shockwave; **E:** Aegis shield
- **F / C / X:** Overdrive, Chain Lightning, Second Wind after unlocking

### Mobile browser
On-screen movement, firing, shield, shockwave, reload, and unlocked-ability controls are provided. The interface is still a prototype and needs further low-end Android device testing.

## Combat systems

The prototype contains four fictional energy weapons: Pulse Rifle, Nova Cannon, Arc Lance, and Gravity Core. Abilities include Shockwave, Aegis, Overdrive, Chain Lightning, and Second Wind. Combat milestones and shard collection can unlock abilities offline; unlocked abilities are saved locally by the browser.

## Ads, rewards, and offline play

**The rewarded-ad button is still a demo simulation.** No real advertisement is served and no ad revenue is earned. The six-second demo timer is not a valid production ad integration. Before monetisation, connect a supported rewarded-ad SDK and grant rewards only from its verified reward callback. Add the required consent/privacy experience and validate reward claims as appropriate.

Full offline play is the target. Normal ad networks need connectivity to request, verify, and report ad impressions, so do not promise or count on ad revenue while fully offline. The design is offline missions and progression, with optional real rewarded ads when online.

## Website deployment

The workflow at `.github/workflows/deploy-pages.yml` builds the site and attempts to publish it on pushes to `main`. The Vite build can succeed even when deployment fails because GitHub Pages is not enabled. To publish, open **Repository Settings → Pages** and select **GitHub Actions** as the build/deployment source, subject to repository permissions. Then check the Actions tab.

Expected URL after a successful Pages deployment: <https://musombi123.github.io/MindSphere/>.

## Android build status

**No APK is being built as part of this story update.** The Android APK workflow is manual-only: `.github/workflows/build-android-apk.yml` has `workflow_dispatch` but no automatic push trigger. Do not run it until gameplay, the story, and controls are ready for an Android build.

When you deliberately choose to test a native build later, the workflow packages the Vite-built assets and local Three.js runtime through Capacitor and uploads a debug APK artifact. It has not been invoked for this story work.

## Current milestone

- [x] Procedural rural road, homesteads, trees, and stylised Mount Elgon horizon
- [x] Third-person hero, enemy pursuit, projectiles, pickups, and commander fight
- [x] Four fictional energy weapons and five abilities
- [x] Three story-triggering Echo Shards and pausing radio transmissions
- [x] Trust-the-Echo / Sever-the-Link branch persisted locally
- [x] Replay dialogue recognises past attempts and the stored choice
- [x] Illuminated Sang’alo relay beacon and Chapter 01 cliffhanger
- [x] Chapter 02 Nzoia crossing with silver river, raised bridge, animated anomaly, three civilian rescues, two temporal anchors, and four Echo units
- [x] Chapter 01 success transitions to Chapter 02; the Trust/Sever choice changes Chapter 02 enemy tracking versus suit health and alters the finale dialogue
- [x] Local Vite build configured for bundled Three.js
- [ ] Chapters 03–05 playable missions and deeper cross-chapter choice consequences
- [ ] Character animation, richer environment assets, voice/music, and sound design
- [ ] Low-end Android performance tests
- [ ] Real rewarded-ad SDK, verified rewards, privacy/consent flow, and cloud saves

This remains an early prototype. Procedural shapes are used for characters and scenery; no purchased or third-party game assets are included.
