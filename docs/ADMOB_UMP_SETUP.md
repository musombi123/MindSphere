# Project Zero Hour — Google Mobile Ads + UMP (Part 1)

## Scope and safety
This branch adds the SDK integration foundation: UMP consent, a persistent AdsManager, test-ID configuration, rewarded/interstitial preload with exponential retry, menu/loadout banners, reward callback gating, safe interstitial contexts, pause/resume, and offline local logging. Ads are optional. The game does not wait for an ad or require connectivity to start a mission.

**Unity Editor note:** Editor always selects Google's test IDs and the code does not initialize/request ads outside Android player builds. Real ad IDs must never be used for test clicks.

## Import official SDKs
1. Back up/commit your Unity project first.
2. In Unity, use **Window > Package Management > Package Manager** only for Unity Registry packages; Google Mobile Ads is imported separately.
3. Install the official Google Mobile Ads Unity plugin using Google's current quick-start page: https://developers.google.com/admob/unity/quick-start. Preferred OpenUPM route: install OpenUPM-CLI, then from the project root run `openupm add com.google.ads.mobile`. Alternatively download the official Google Mobile Ads Unity plugin release `.unitypackage` from https://github.com/googleads/googleads-mobile-unity/releases and double-click it / use **Assets > Import Package > Custom Package...**.
4. Import the UMP Unity plugin from the official plugin distribution/release. If the installed Google Mobile Ads plugin version bundles UMP, confirm `GoogleMobileAds.Ump` is present; otherwise import Google's official UMP Unity plugin package per https://developers.google.com/admob/unity/privacy.
5. Do not install the OpenUPM package and a second copy of the same plugin via `.unitypackage`; duplicate GoogleMobileAds assemblies cause compile errors.
6. Wait for Unity compilation to finish.

## App ID and Android setup
1. Select **Assets > Google Mobile Ads > Settings**.
2. Set **Android App ID** to the Google test App ID during development: `ca-app-pub-3940256099942544~3347511713`.
3. Keep **iOS App ID** empty for this Android-only game.
4. Google plugin settings are stored at `Assets/GoogleMobileAds/Resources/GoogleMobileAdsSettings.asset`; plugin settings generate the Android manifest App ID metadata. Do not manually add duplicate `com.google.android.gms.ads.APPLICATION_ID` entries unless diagnosing a custom manifest.
5. Open **File > Build Profiles > Player Settings > Android > Other Settings** (older Unity layouts: **Edit > Project Settings > Player > Android > Other Settings**). Set **Minimum API Level = Android 7.0 / API 24 or higher** and **Target API Level = API 35 or higher**. The plugin's current quick start documents these requirements.
6. Select **Assets > External Dependency Manager > Android Resolver > Resolve** (some versions expose **Force Resolve**). If the menu is missing, check that External Dependency Manager (EDM4U) was included with the official plugin, reimport the plugin's EDM4U dependency, then restart Unity. Let Gradle download dependencies while online.
7. If using **Custom Main Gradle Template**, ensure Google Maven is included and don't remove plugin-generated dependencies. Use Gradle templates only if needed.
8. R8/ProGuard: normally the official plugin supplies required keep rules. If minification fails at runtime, inspect Gradle/R8 output and add only the keep rules recommended by the exact plugin version; do not disable minification as the first fix. Resolve duplicate classes by removing duplicate SDK imports, not by excluding random Google libraries.

## Create AdConfig
1. Right-click in Project window at `Assets/ProjectZeroHour/Ads/Resources` (create folders if needed).
2. **Create > Project Zero Hour > Ads > Ad Config** and name it `AdConfig`.
3. Test IDs are already filled in the asset defaults. Leave Release fields blank until your own AdMob app and ad units exist.
4. Add an empty GameObject named `AdsManager` to the first scene. Add `AdsManager` and `AdsConsentController`. Assign the AdConfig asset to AdsManager. Keep exactly one manager; it persists between scenes.
5. Add the scripts in this folder to the project. Ensure Google Mobile Ads and UMP namespaces compile.

## Consent, privacy, and offline
- UMP update runs at launch when internet is available. It then calls `LoadAndShowConsentFormIfRequired`. Ads SDK initialization happens only if `CanRequestAds()` returns true.
- If launch is offline, the game remains playable; on returning online the consent check is refreshed.
- Add a **Privacy options** button in Settings and wire it to `AdsConsentController.ShowPrivacyOptions()`. UMP privacy options may only be required for some users/regions.
- Publish a privacy policy at an HTTPS URL, set `AdConfig.privacyPolicyUrl`, and wire a Settings link to `AdsMenuUI.OpenPrivacyPolicy(url)`.
- Configure privacy messages in AdMob > Privacy & messaging. A Unity code change alone does not create/publish the consent message.

## Reward integration contract
Add `AdsMenuUI` only to **menu/loadout/results UI**, never the combat HUD. Place reward buttons far from all movement/fire/ability controls. The UI bridge hides Watch Ad buttons unless a rewarded ad is loaded and network/consent are ready.

In the Inspector, select AdsManager > **On Reward Granted (RewardKind)** and wire game-owned handlers:
- `FieldUpgrade`: unlock/extend a chosen ability for a limited time or current mission.
- `MissionRevive`: restore player once per mission. The manager resets its revive gate on `BeginMission(index)`.
- `DoubleMissionRewards`: apply the multiplier to the results screen's pending reward before finalizing it.

The manager emits the reward event only from Google's `OnUserEarnedReward` callback. Do not grant on ad close, impression, or when Show() is called. Wire these events to the real local mission systems; this branch does not invent or mutate mission economy state because the existing repository is a browser/Vite prototype, not a Unity C# mission runtime.

## Interstitial and banner policy
- Call `TryShowInterstitial(AdScreenContext.Results, missionIndex)` or `TryShowInterstitial(AdScreenContext.BetweenMissions, missionIndex)` only after a mission ends. It refuses combat/cutscene/menu contexts, mission 1, the configured interval (default 180s), and session cap (default 3).
- Call `ShowBannerForMenuOrLoadout(AdScreenContext.Menu)` or `Loadout` only on menu/loadout. Call `HideBanner()` immediately on entering gameplay. The manager also hides banners at `BeginMission`.
- No interstitial is automatically shown by Update or on scene load.

## Debug log
The manager writes timestamped ad events to `Application.persistentDataPath/ad-debug.log`, retains recent events in memory, and prints them to Unity Console. Use `LocalLog` to populate a scrollable debug panel. It does not send analytics to a server.

## Testing
### Editor Play mode
1. Confirm the Google plugin is installed and scripts compile.
2. Play with Wi-Fi off: game should launch and missions remain playable; reward buttons remain hidden / unavailable.
3. Play online in Editor: no ad request should be made by this implementation; Editor chooses test IDs but the manager intentionally leaves SDK startup to Android builds.
4. Test mission-context calls from a temporary debug button: gameplay/combat/cutscene interstitial requests return false; mission 1 results return false.
5. Verify reward handlers are not invoked by failed loads or ad closes. Only a real Google test rewarded completion can invoke them.

### Real Android test phone (debug build)
1. Use USB debugging and a development build; keep test IDs selected automatically.
2. Install/run while online. UMP consent form appears if the configured privacy message is required. Verify gameplay starts even if the form/network cannot load.
3. Tap a menu-only rewarded button after it becomes ready; complete Google's test ad and verify exactly one reward event. Close early and verify no reward.
4. Background/resume during a fullscreen ad; the ad callback must restore the pre-ad time scale and audio.
5. Disable data/Wi-Fi and launch again; verify the mission works and ads show “Not available right now”.
6. Never click live ads during testing. Use Google's official test ad units only.

## Production IDs — later, after testing
1. Create/register the Android app and each ad unit in AdMob.
2. Fill `releaseAndroidAppId`, `releaseRewardedId`, `releaseInterstitialId`, and `releaseBannerId` on AdConfig with your own IDs.
3. Copy your production App ID into **Assets > Google Mobile Ads > Settings** for the Release build. The SDK's manifest metadata comes from that plugin setting, not from the runtime ScriptableObject. Do not ship a production App ID in a test build. Confirm a release build uses only the real IDs and a development build uses only test IDs.
4. Google Ad Inspector: integrate the plugin's supported `MobileAds.OpenAdInspector(...)` entry point behind a developer-only Settings action, then run on a registered test device. Menu/API signatures can vary by plugin version; use the API docs for the exact installed version: https://developers.google.com/admob/unity/ad-inspector. Do not expose inspector in public production UI.

## Important verification boundary
This repository's current `main` branch describes itself as a browser/Vite + Three.js prototype and explicitly says no Unity APK/build is currently being built. This branch adds Unity C# integration source and setup instructions, but it cannot be called an end-to-end Unity build until copied/imported into the actual Unity 6 URP project with the official plugin, the Unity Console passes, and the Android device tests above pass.
