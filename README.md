# PROJECT ZERO HOUR — THE RED ROAD

**A 3D superhero action-game prototype** inspired by the supplied rural environment video: red-earth roads, fenced homesteads, tall trees, and forest edges.

## Story One

The Black Viper gang has seized the settlement road. Play as the Guardian, push back five gang members and their lieutenant, recover three intelligence caches, and reach extraction.

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
- [ ] Android packaging and device-performance testing

This is an early playable prototype, not a finished commercial game. Models are built from procedural 3D shapes; no purchased or third-party game assets are included.
