using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using UnityEngine;
using UnityEngine.Events;
using GoogleMobileAds;
using GoogleMobileAds.Api;

namespace ProjectZeroHour.Ads
{
    public enum AdScreenContext { Menu, Loadout, Gameplay, Combat, Cutscene, Results, BetweenMissions }
    public enum RewardKind { FieldUpgrade, MissionRevive, DoubleMissionRewards }

    [Serializable] public sealed class RewardGrantedEvent : UnityEvent<RewardKind> { }

    /// <summary>
    /// Optional ads service. It never waits for ads to play and never blocks offline gameplay.
    /// Connect reward events to authoritative local mission/ability systems in the Inspector.
    /// </summary>
    public sealed class AdsManager : MonoBehaviour
    {
        public static AdsManager Instance { get; private set; }

        [Header("Configuration")]
        [SerializeField] private AdConfig config;
        [SerializeField] private AdsConsentController consentController;

        [Header("Reward integrations (wire to game systems in Inspector)")]
        [SerializeField] private RewardGrantedEvent onRewardGranted = new RewardGrantedEvent();

        [Header("Session rules")]
        [SerializeField, Min(0)] private int firstMissionIndex = 1;
        [SerializeField] private bool enableAds = true;

        public RewardGrantedEvent OnRewardGranted => onRewardGranted;
        public bool AdsAvailable => sdkInitialized && consentController != null && consentController.CanRequestAds && HasInternet;
        public bool RewardedReady => AdsAvailable && rewardedAd != null && rewardedAd.CanShowAd();
        public bool InterstitialReady => AdsAvailable && interstitialAd != null && interstitialAd.CanShowAd();
        public bool HasInternet => Application.internetReachability != NetworkReachability.NotReachable;
        public bool IsBusyShowingAd { get; private set; }
        public string RewardedAvailabilityMessage => RewardedReady ? "Watch ad" : "Not available right now";

        private RewardedAd rewardedAd;
        private InterstitialAd interstitialAd;
        private BannerView banner;
        private bool sdkInitialized;
        private bool loadRewardedInProgress;
        private bool loadInterstitialInProgress;
        private float lastInterstitialRealtime = -100000f;
        private int interstitialsThisSession;
        private int currentMissionIndex;
        private bool revivedThisMission;
        private float priorTimeScale = 1f;
        private float priorAudioVolume = 1f;
        private bool adWasOpen;
        private bool appPausedDuringAd;
        private readonly List<string> localLog = new List<string>();
        private string LogPath => Path.Combine(Application.persistentDataPath, "ad-debug.log");
        public IReadOnlyList<string> LocalLog => localLog.AsReadOnly();

        private void Awake()
        {
            if (Instance != null && Instance != this) { Destroy(gameObject); return; }
            Instance = this;
            DontDestroyOnLoad(gameObject);
            if (config == null) Debug.LogError("[POH Ads] Assign AdConfig; ads will stay disabled.", this);
            if (consentController == null) consentController = GetComponent<AdsConsentController>();
            Log("AdsManager awake. Test IDs=" + (config != null && config.UseTestAds));
        }

        private void Start()
        {
#if UNITY_EDITOR
            // No SDK initialization or ad requests in Editor Play mode.
            Log("Editor Play mode: SDK requests disabled; test IDs remain configured.");
            return;
#else
            if (Application.platform != RuntimePlatform.Android)
            {
                Log("Non-Android runtime: ads disabled.");
                return;
            }
            if (!enableAds || config == null || consentController == null) { Log("Ads disabled or references missing."); return; }
            consentController.GatherConsent(HandleConsentResult);
#endif
        }

        private void HandleConsentResult(bool canRequest)
        {
#if UNITY_EDITOR
            Log("Editor Play mode: ignoring SDK initialization.");
            return;
#endif
            if (!canRequest || !HasInternet) { Log("Ads unavailable: consent/network not ready."); return; }
            if (sdkInitialized) { PreloadAds(); return; }

            try
            {
                MobileAds.Initialize(status =>
                {
                    if (status == null) { Log("SDK initialization returned null status."); return; }
                    sdkInitialized = true;
                    Log("Google Mobile Ads SDK initialized.");
                    PreloadAds();
                });
            }
            catch (Exception ex) { Log("SDK initialization exception: " + ex.Message); }
        }

        private void Update()
        {
#if UNITY_EDITOR
            return;
#endif
            if (!sdkInitialized && enableAds && config != null && consentController != null &&
                HasInternet && consentController.ConsentFlowFinished && consentController.CanRequestAds)
                HandleConsentResult(true);
        }

        private void PreloadAds()
        {
            if (!AdsAvailable && !sdkInitialized) return;
            if (!HasInternet || consentController == null || !consentController.CanRequestAds) return;
            if (rewardedAd == null && !loadRewardedInProgress) StartCoroutine(LoadRewardedWithBackoff());
            if (interstitialAd == null && !loadInterstitialInProgress) StartCoroutine(LoadInterstitialWithBackoff());
        }

        private IEnumerator LoadRewardedWithBackoff()
        {
            loadRewardedInProgress = true;
            float delay = 2f;
            while (enabled && rewardedAd == null)
            {
                if (!HasInternet || consentController == null || !consentController.CanRequestAds) { yield return new WaitForSecondsRealtime(5f); continue; }
                bool completed = false;
                RewardedAd.Load(config.RewardedId, new AdRequest(), (ad, error) =>
                {
                    completed = true;
                    if (error != null || ad == null) { Log("Rewarded load failed: " + (error == null ? "empty ad" : error.GetMessage())); return; }
                    rewardedAd = ad;
                    RegisterRewardedEvents(ad);
                    Log("Rewarded ad loaded.");
                });
                float timeout = 0f;
                while (!completed && timeout < 20f) { timeout += Time.unscaledDeltaTime; yield return null; }
                if (rewardedAd != null) break;
                Log("Retry rewarded load in " + delay + "s.");
                yield return new WaitForSecondsRealtime(delay);
                delay = Mathf.Min(delay * 2f, 120f);
            }
            loadRewardedInProgress = false;
        }

        private IEnumerator LoadInterstitialWithBackoff()
        {
            loadInterstitialInProgress = true;
            float delay = 3f;
            while (enabled && interstitialAd == null)
            {
                if (!HasInternet || consentController == null || !consentController.CanRequestAds) { yield return new WaitForSecondsRealtime(5f); continue; }
                bool completed = false;
                InterstitialAd.Load(config.InterstitialId, new AdRequest(), (ad, error) =>
                {
                    completed = true;
                    if (error != null || ad == null) { Log("Interstitial load failed: " + (error == null ? "empty ad" : error.GetMessage())); return; }
                    interstitialAd = ad;
                    RegisterInterstitialEvents(ad);
                    Log("Interstitial ad loaded.");
                });
                float timeout = 0f;
                while (!completed && timeout < 20f) { timeout += Time.unscaledDeltaTime; yield return null; }
                if (interstitialAd != null) break;
                Log("Retry interstitial load in " + delay + "s.");
                yield return new WaitForSecondsRealtime(delay);
                delay = Mathf.Min(delay * 2f, 120f);
            }
            loadInterstitialInProgress = false;
        }

        private void RegisterRewardedEvents(RewardedAd ad)
        {
            ad.OnAdFullScreenContentOpened += () => BeginAdPause("rewarded");
            ad.OnAdFullScreenContentClosed += () => { EndAdPause(); rewardedAd = null; Log("Rewarded closed."); PreloadAds(); };
            ad.OnAdFullScreenContentFailed += error => { EndAdPause(); rewardedAd = null; Log("Rewarded show failed: " + error.GetMessage()); PreloadAds(); };
            ad.OnAdImpressionRecorded += () => Log("Rewarded impression recorded.");
        }

        private void RegisterInterstitialEvents(InterstitialAd ad)
        {
            ad.OnAdFullScreenContentOpened += () => BeginAdPause("interstitial");
            ad.OnAdFullScreenContentClosed += () => { EndAdPause(); interstitialAd = null; Log("Interstitial closed."); PreloadAds(); };
            ad.OnAdFullScreenContentFailed += error => { EndAdPause(); interstitialAd = null; Log("Interstitial show failed: " + error.GetMessage()); PreloadAds(); };
            ad.OnAdImpressionRecorded += () => Log("Interstitial impression recorded.");
        }

        public bool OfferRewarded(RewardKind reward)
        {
            if (!RewardedReady || IsBusyShowingAd) { Log("Rewarded unavailable; no reward granted."); return false; }
            if (reward == RewardKind.MissionRevive && revivedThisMission) { Log("Revive already used this mission."); return false; }

            try
            {
                rewardedAd.Show(rewarded =>
                {
                    // The only reward-grant path. Do not grant on close, impression, or show success.
                    if (reward == RewardKind.MissionRevive) revivedThisMission = true;
                    Log("REWARD EARNED: " + reward);
                    onRewardGranted.Invoke(reward);
                });
                Log("Rewarded ad show requested for " + reward);
                return true;
            }
            catch (Exception ex) { Log("Rewarded show exception: " + ex.Message); EndAdPause(); return false; }
        }

        public bool TryShowInterstitial(AdScreenContext context, int missionIndex)
        {
            bool safeContext = context == AdScreenContext.Results || context == AdScreenContext.BetweenMissions;
            if (!safeContext || missionIndex <= firstMissionIndex || !InterstitialReady || IsBusyShowingAd) return false;
            if (Time.realtimeSinceStartup - lastInterstitialRealtime < config.minimumInterstitialIntervalSeconds) return false;
            if (interstitialsThisSession >= config.maximumInterstitialsPerSession) return false;
            try
            {
                interstitialAd.Show();
                lastInterstitialRealtime = Time.realtimeSinceStartup;
                interstitialsThisSession++;
                Log("Interstitial show requested at " + context + " mission " + missionIndex);
                return true;
            }
            catch (Exception ex) { Log("Interstitial show exception: " + ex.Message); EndAdPause(); return false; }
        }

        public void ShowBannerForMenuOrLoadout(AdScreenContext context)
        {
            if (context != AdScreenContext.Menu && context != AdScreenContext.Loadout) { HideBanner(); return; }
            if (!AdsAvailable || banner != null) return;
            try
            {
                banner = new BannerView(config.BannerId, AdSize.Banner, AdPosition.Bottom);
                banner.OnBannerAdLoaded += () => Log("Banner loaded.");
                banner.OnBannerAdLoadFailed += error => { Log("Banner load failed: " + error.GetMessage()); HideBanner(); };
                banner.LoadAd(new AdRequest());
            }
            catch (Exception ex) { Log("Banner exception: " + ex.Message); HideBanner(); }
        }

        public void HideBanner()
        {
            if (banner == null) return;
            banner.Destroy();
            banner = null;
            Log("Banner hidden/destroyed.");
        }

        public void BeginMission(int missionIndex)
        {
            currentMissionIndex = missionIndex;
            revivedThisMission = false;
            Log("Mission started: " + missionIndex + "; revive reset.");
            HideBanner();
        }

        private void BeginAdPause(string kind)
        {
            if (adWasOpen) return;
            adWasOpen = true;
            IsBusyShowingAd = true;
            priorTimeScale = Time.timeScale;
            priorAudioVolume = AudioListener.volume;
            Time.timeScale = 0f;
            AudioListener.pause = true;
            AudioListener.volume = 0f;
            Log(kind + " fullscreen opened; game paused.");
        }

        private void EndAdPause()
        {
            if (!adWasOpen) return;
            adWasOpen = false;
            IsBusyShowingAd = false;
            Time.timeScale = priorTimeScale <= 0f ? 1f : priorTimeScale;
            AudioListener.pause = false;
            AudioListener.volume = priorAudioVolume;
            Log("Fullscreen ad ended; game/audio restored.");
        }

        private void OnApplicationPause(bool paused)
        {
            if (paused && adWasOpen) { appPausedDuringAd = true; return; }
            if (!paused && appPausedDuringAd)
            {
                appPausedDuringAd = false;
                // Keep paused until the SDK sends its close/failure callback.
                Log("App foregrounded while ad active; awaiting SDK completion.");
            }
            if (!paused && !sdkInitialized && HasInternet && consentController != null)
                consentController.RefreshConsentWhenOnline(HandleConsentResult);
        }

        private void Log(string message)
        {
            string line = DateTime.UtcNow.ToString("O") + " | " + message;
            Debug.Log("[POH Ads] " + message);
            localLog.Add(line);
            if (localLog.Count > 300) localLog.RemoveAt(0);
            try { File.AppendAllText(LogPath, line + Environment.NewLine); } catch { /* Logging must never break gameplay. */ }
        }

        public void ExportDebugLog() { Log("Debug log requested. File: " + LogPath); }
        private void OnDestroy()
        {
            if (Instance == this) Instance = null;
            HideBanner();
            rewardedAd?.Destroy();
            interstitialAd?.Destroy();
            if (adWasOpen) EndAdPause();
        }
    }
}