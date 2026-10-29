# PROJECT ZERO HOUR — THE RED ROAD

**A 3D superhero action-game prototype** inspired by the supplied rural environment video: red-earth roads, fenced homesteads, tall trees, and forest edges.

## Story One

The Black Viper gang has seized the settlement road and brought in a crew of thieves. Play as the Guardian, neutralise three gang fighters, stop two faster and less-armoured thieves, defeat their lieutenant, recover three intelligence caches, and reach extraction.

## Play

The game runs as a static web page using Three.js from a CDN. Serve the repository folder over HTTP rather than opening `index.html` as a `file://` URL.

```bash
python -m http.server 8080
```

Then open `http://localhost:8080` in a modern WebGL-capable browser. Internet access is needed for the Three.js CDN import.

### Desktop controls

- **WASD / arrow keys:** move; **Shift:** sprint
- **Mouse:** aim; **hold left mouse button** or **Space:** fire
- **1–4:** switch super-weapons; **R:** reload
- **Q:** shockwave; **E:** Aegis shield
- **F / C / X:** use Overdrive, Chain Lightning, or Second Wind after unlocking each ability

Mobile browsers get on-screen movement, firing, shield, shockwave, reload, and unlocked-ability controls.

## Weapons and abilities

The prototype contains four fictional energy weapons: Pulse Rifle, Nova Cannon, Arc Lance, and Gravity Core. Guardian abilities include a close-range shockwave, damage-reducing Aegis shield, and three upgrade abilities obtainable through the development rewarded-ad flow.

## Ads, rewards, and saves

**Rewarded ads are simulated in this prototype.** No real ad is served and no revenue is generated yet. The six-second demo flow grants one ability only when its timer completes. Unlocked demo abilities are stored locally in the browser. Before public monetisation, integrate a real rewarded-ad provider and award abilities only after its verified reward callback; use a backend to validate reward claims and progression where supported.

## GitHub Pages deployment

A workflow at `.github/workflows/deploy-pages.yml` validates the game JavaScript and publishes the static site on pushes to `main`. For first-time setup, open **Settings → Pages** and choose **GitHub Actions** as the build/deployment source if the repository has not enabled Pages yet. Then check the Actions tab for the deployment result.

Expected project URL after a successful deployment: <https://musombi123.github.io/MindSphere/>


## Android APK and offline-first gameplay

The Android build uses Capacitor to package the Vite-built game and its bundled Three.js runtime into a native Android WebView. The core mission is designed to run without a network connection after installation; it does not need to download Three.js from a CDN at launch.

### Build an APK in GitHub

Open **Actions → Build Project Zero Hour Android APK → Run workflow**. When the job succeeds, open its run and download the `project-zero-hour-debug-apk` artifact. Extract it and install `app-debug.apk` on a compatible Android device. This is a debug APK for testing, not a signed release for distribution.

The workflow also runs on relevant pushes to `main). It installs dependencies, builds the web assets, generates the Capacitor Android project, and runs Gradle to assemble the APK.

### Offline and online progression

- **Offline:** play the mission, fight enemies, collect intelligence, and unlock abilities through combat milestones. Your unlocked abilities are saved on the device.
- **Online:** the current rewarded-ad button is still a clearly labelled demo simulation. No real ad network is integrated yet.
- **Revenue reality:** ordinary ad networks need a network connection to request, verify, and report ad impressions. You should not count on earning ad revenue while fully offline. Some SDKs may cache limited ads in advance, but availability and reward validation depend on the provider and its rules. The safe design is full offline gameplay with mission-based unlocks, plus optional verified rewarded ads when online.
- **Before release:** integrate a supported rewarded-ad SDK, verify reward callbacks, add a privacy policy/consent flow, and test the SDK's Android and offline behaviour. Never grant a paid/rewarded ability based only on a client-side timer.

## Current scope / next milestones

- [x] Stylised 3D rural road, trees, fences, and homesteads
- [x] Third-person hero, enemy pursuit, incoming fire, and boss fight
- [x] Four fictional super-weapons, health, pickups, intel, and mission completion
- [x] Shockwave, Aegis, and demo rewarded-ability unlock loop
- [x] Desktop and mobile controls
- [x] GitHub Pages workflow with JavaScript syntax validation
- [ ] Character animations, richer environment art, voice/music, and sound design
- [ ] Real rewarded-ad SDK, verified rewards, and cloud saves
- [ ] More missions, thieves/rescue encounters, vehicles, and boss variants
- [x] Capacitor Android APK build workflow and locally bundled Three.js runtime\n- [ ] Android device-performance testing, release signing, and real rewarded-ad SDK

This is an early playable prototype, not a finished commercial game. Models are built from procedural 3D shapes; no purchased or third-party game assets are included.
