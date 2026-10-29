using System;
using System.Collections;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using UnityEngine;
using GoogleMobileAds;
using GoogleMobileAds.Api;
using GoogleMobileAds.Common;
using GoogleMobileAds.Ump.Api;

namespace ProjectZeroHour.Ads
{
    public enum AdRewardPurpose
    {
        FieldUpgradeProgram,
        ReviveOncePerMission,
        DoubleMissionRewards
    }

    /// <summary>
    /// Optional network advertising layer. Gameplay never depends on this singleton being present,
    /// online, initialized, or having an ad loaded. Reward state changes only inside Show's reward callback.
    /// </summary>
    [DisallowMultipleComponent]
    public sealed class AdsManager : MonoBehaviour
    {
        private const string ConfigResourceName = "AdConfig";
        private const int MaxLocalLogLines = 120;
        private const int MaxInterstitialsPerSession = 2;
        private const float InterstitialCooldownSeconds = 180f;
        private const float FirstRetryDelaySeconds = 2f;
        private const float MaxRetryDelaySeconds = 120f;

        public static AdsManager Instance { get; private set; }

        public enum ScreenContext { Menu, Loadout, Gameplay, Combat, Cutscene, DeathScreen, Results, BetweenMissions }

        [Header("Configuration")]
        [SerializeField] private AdConfig config;

        [Header("Interstitial policy")]
        [SerializeField, Min(30f)] private float minimumInterstitialIntervalSeconds = InterstitialCooldownSeconds;
        [SerializeField, Range(0, 5)] private int maximumInterstitialsPerSession = MaxInterstitialsPerSession;

        public event Action StateChanged;
        public event Action<string> LogChanged;
        public event Action<AdRewardPurpose> RewardEarned;
        public event Action FieldUpgradeGranted;
        public event Action ReviveGranted;
        public event Action DoubleMissionRewardsGranted;

        private RewardedAd _rewardedAd;
        private InterstitialAd _interstitialAd;
        private BannerView _bannerView;
        private Coroutine _rewardedRetryRoutine;
        private Coroutine _interstitialRetryRoutine;
        private Coroutine _consentRetryRoutine;

        private readonly Queue<string> _recentLogs = new Queue<string>();
        private string _localLogPath;
        private bool _supportedRuntime;
        private bool _isOnline;
        private bool _consentUpdateInProgress;
        private bool _consentFlowFinished;
        private bool _sdkInitializationStarted;
        private bool _sdkInitialized;
        private bool _rewardedLoadInProgress;
        private bool _interstitialLoadInProgress;
        private bool _bannerRequested;
        private bool _isApplicationPaused;
        private bool _fullscreenAdShowing;
        private bool _gamePauseCaptured;
        private bool _priorAudioListenerPause;
        private float _priorTimeScale = 1f;
        private bool _rewardCallbackReceived;
        private bool _hasPendingReward;
        private AdRewardPurpose _pendingRewardPurpose;
        private int _rewardedRetryCount;
        private int _interstitialRetryCount;
        private int _currentMissionNumber = 1;
        private int _interstitialsShownThisSession;
        private float _lastInterstitialShownRealtime = float.NegativeInfinity;
        private ScreenContext _screenContext = ScreenContext.Menu;
        private bool _fieldUpgradeGranted;
        private int _fieldUpgradeMissionNumber = -1;
        private bool _reviveUsedThisMission;
        private bool _doubleRewardsGranted;

        public bool IsSdkInitialized => _sdkInitialized;
        public bool ConsentFlowFinished => _consentFlowFinished;
        public bool PrivacyOptionsRequired { get; private set; }
        public ScreenContext CurrentScreenContext => _screenContext;
        public bool IsFieldUpgradeActive => _fieldUpgradeGranted && _fieldUpgradeMissionNumber == _currentMissionNumber;
        public bool ReviveUsedThisMission => _reviveUsedThisMission;
        public bool DoubleRewardsGranted => _doubleRewardsGranted;
        public int InterstitialsShownThisSession => _interstitialsShownThisSession;
        public bool CanOfferFieldUpgrade => CanOfferRewarded(AdRewardPurpose.FieldUpgradeProgram);
        public bool CanOfferRevive => CanOfferRewarded(AdRewardPurpose.ReviveOncePerMission);
        public bool CanOfferDoubleRewards => CanOfferRewarded(AdRewardPurpose.DoubleMissionRewards);

        private bool AdsAllowed
        {
            get
            {
                if (!_supportedRuntime || !_sdkInitialized || !_consentFlowFinished || !_isOnline || _fullscreenAdShowing)
                    return false;
#if UNITY_ANDROID && !UNITY_EDITOR
                return ConsentInformation.CanRequestAds();
#else
                return false;
#endif
            }
        }

        private bool IsDevelopmentOrEditor => Debug.isDebugBuild || Application.isEditor;

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(gameObject);
                return;
            }

            Instance = this;
            DontDestroyOnLoad(gameObject);
            _localLogPath = Path.Combine(Application.persistentDataPath, "ads-debug.log");
            LoadRecentLogs();

#if UNITY_ANDROID && !UNITY_EDITOR
            _supportedRuntime = true;
#else
            _supportedRuntime = false;
#endif
            if (config == null) config = Resources.Load<AdConfig>(ConfigResourceName);
            if (config == null)
                WriteLog("config_missing", "Resources/AdConfig.asset was not found; ads remain disabled.");

            _isOnline = HasNetwork();
            WriteLog("manager_started", "Offline-first ads manager ready. Gameplay is not gated by ads.");
        }

        private void Start()
        {
            if (!_supportedRuntime)
            {
                WriteLog("runtime_disabled", "Ad requests are disabled in Unity Editor and non-Android players. No fake ads or reward simulation is used.");
                NotifyStateChanged();
                return;
            }

            if (_isOnline) BeginConsentFlow();
            else WriteLog("offline_start", "Device is offline; consent and ad requests are deferred without affecting gameplay.");
        }

        private void Update()
        {
            bool onlineNow = HasNetwork();
            if (onlineNow == _isOnline) return;

            _isOnline = onlineNow;
            WriteLog("connectivity", onlineNow ? "Network became reachable." : "Network unavailable; ad offers are disabled.");
            NotifyStateChanged();

            if (!onlineNow) return;
            if (_supportedRuntime && !_sdkInitialized && !_consentUpdateInProgress)
                BeginConsentFlow();
            else
            {
                if (AdsAllowed)
                {
                    LoadRewardedAd();
                    LoadInterstitialAd();
                    if (_bannerRequested && IsBannerContext(_screenContext)) EnsureBanner();
                }
            }
        }

        private void OnApplicationPause(bool paused)
        {
            _isApplicationPaused = paused;
            if (paused)
            {
                // If a fullscreen ad is open, preserve the ad pause until the app returns to foreground.
                if (_fullscreenAdShowing) PauseGameForAd();
                return;
            }

            if (!_fullscreenAdShowing) RestoreGameAfterAd();
        }

        private void OnApplicationFocus(bool hasFocus)
        {
            if (hasFocus)
            {
                _isApplicationPaused = false;
                if (!_fullscreenAdShowing) RestoreGameAfterAd();
            }
            else if (_fullscreenAdShowing)
            {
                _isApplicationPaused = true;
                PauseGameForAd();
            }
        }

        private void OnDestroy()
        {
            if (Instance == this) Instance = null;
            if (_rewardedAd != null) SafeDestroyRewarded();
            if (_interstitialAd != null) SafeDestroyInterstitial();
            if (_bannerView != null)
            {
                try { _bannerView.Destroy(); } catch (Exception ex) { Debug.LogWarning($"[POH Ads] Banner destroy: {ex.Message}"); }
                _bannerView = null;
            }
            if (_gamePauseCaptured) RestoreGameAfterAd();
        }

        public void SetScreenContext(ScreenContext context, int missionNumber)
        {
            _screenContext = context;
            if (missionNumber > 0) _currentMissionNumber = missionNumber;

            if (!IsBannerContext(context))
            {
                HideBanner();
            }
            else if (_bannerRequested && AdsAllowed)
            {
                EnsureBanner();
            }

            NotifyStateChanged();
        }

        /// <summary>Call when a mission begins. Keep missionNumber 1 for the first mission.</summary>
        public void BeginMission(int missionNumber)
        {
            _currentMissionNumber = Mathf.Max(1, missionNumber);
            _reviveUsedThisMission = false;
            _doubleRewardsGranted = false;
            if (_fieldUpgradeMissionNumber != _currentMissionNumber) _fieldUpgradeGranted = false;
            SetScreenContext(ScreenContext.Gameplay, _currentMissionNumber);
            WriteLog("mission_started", $"Mission {_currentMissionNumber}; ad rewards reset to mission scope.");
        }

        public void EndMission()
        {
            _fieldUpgradeGranted = false;
            _fieldUpgradeMissionNumber = -1;
            _reviveUsedThisMission = false;
            _doubleRewardsGranted = false;
            NotifyStateChanged();
        }

        public bool CanOfferRewarded(AdRewardPurpose purpose)
        {
            if (!AdsAllowed || _hasPendingReward || _rewardedAd == null || !_rewardedAd.CanShowAd()) return false;
            if (purpose == AdRewardPurpose.FieldUpgradeProgram)
                return IsFieldUpgradeContext(_screenContext) && !IsFieldUpgradeActive;
            if (purpose == AdRewardPurpose.ReviveOncePerMission)
                return _screenContext == ScreenContext.DeathScreen && !_reviveUsedThisMission;
            if (purpose == AdRewardPurpose.DoubleMissionRewards)
                return _screenContext == ScreenContext.Results && !_doubleRewardsGranted;
            return false;
        }

        public string GetRewardedUnavailableReason(AdRewardPurpose purpose)
        {
            if (!_supportedRuntime) return "Ads are available on Android builds only.";
            if (!_isOnline) return "Not available right now — connect to the internet.";
            if (!_consentFlowFinished || !_sdkInitialized) return "Not available right now — privacy setup is not ready.";
            if (!ConsentInformation.CanRequestAds()) return "Not available right now — ads are not permitted by the current consent state.";
            if (_fullscreenAdShowing || _hasPendingReward) return "An ad is already open.";
            if (_rewardedAd == null || !_rewardedAd.CanShowAd()) return "Not available right now — no rewarded ad is ready.";
            if (purpose == AdRewardPurpose.FieldUpgradeProgram && (!IsFieldUpgradeContext(_screenContext) || IsFieldUpgradeActive))
                return "Field Upgrade is offered from the menu, loadout, or between missions, once for a mission.";
            if (purpose == AdRewardPurpose.ReviveOncePerMission && (_screenContext != ScreenContext.DeathScreen || _reviveUsedThisMission))
                return _reviveUsedThisMission ? "Revive has already been used this mission." : "Revive is available only from the defeat/revive screen.";
            if (purpose == AdRewardPurpose.DoubleMissionRewards && (_screenContext != ScreenContext.Results || _doubleRewardsGranted))
                return "Double rewards is available once from the mission results screen.";
            return "Not available right now.";
        }

        /// <summary>
        /// Call only from a user-initiated reward button located on a non-combat surface
        /// (or the death/revive overlay). Reward state is changed only by OnUserEarnedReward.
        /// </summary>
        public bool TryShowRewarded(AdRewardPurpose purpose)
        {
            if (!CanOfferRewarded(purpose))
            {
                WriteLog("reward_unavailable", $"{purpose}: {GetRewardedUnavailableReason(purpose)}");
                NotifyStateChanged();
                return false;
            }

            _pendingRewardPurpose = purpose;
            _hasPendingReward = true;
            _rewardCallbackReceived = false;
            try
            {
                WriteLog("rewarded_show_requested", purpose.ToString());
                _rewardedAd.Show((Reward reward) =>
                {
                    RunOnMainThread(() => OnUserEarnedReward(purpose, reward));
                });
                return true;
            }
            catch (Exception ex)
            {
                _hasPendingReward = false;
                WriteLog("rewarded_show_exception", ex.Message);
                ScheduleRewardedRetry();
                NotifyStateChanged();
                return false;
            }
        }

        /// <summary>
        /// Google calls this path only after the user earns the reward. Never grant on close/impression.
        /// </summary>
        private void OnUserEarnedReward(AdRewardPurpose requestedPurpose, Reward reward)
        {
            if (!_hasPendingReward || requestedPurpose != _pendingRewardPurpose || _rewardCallbackReceived)
            {
                WriteLog("reward_callback_ignored", "Duplicate or unmatched reward callback ignored.");
                return;
            }

            _rewardCallbackReceived = true;
            switch (requestedPurpose)
            {
                case AdRewardPurpose.FieldUpgradeProgram:
                    _fieldUpgradeGranted = true;
                    _fieldUpgradeMissionNumber = _currentMissionNumber;
                    FieldUpgradeGranted?.Invoke();
                    break;
                case AdRewardPurpose.ReviveOncePerMission:
                    if (_reviveUsedThisMission)
                    {
                        WriteLog("reward_callback_ignored", "Revive already used for this mission; duplicate state change blocked.");
                        return;
                    }
                    _reviveUsedThisMission = true;
                    ReviveGranted?.Invoke();
                    break;
                case AdRewardPurpose.DoubleMissionRewards:
                    if (_screenContext != ScreenContext.Results || _doubleRewardsGranted)
                    {
                        WriteLog("reward_callback_ignored", "Double-reward grant was outside the results screen or had already been granted.");
                        return;
                    }
                    _doubleRewardsGranted = true;
                    DoubleMissionRewardsGranted?.Invoke();
                    break;
            }

            WriteLog("reward_earned", $"{requestedPurpose}; Google reward type={reward?.Type ?? "(none)"}; amount={reward?.Amount.ToString(CultureInfo.InvariantCulture) ?? "(none)"}.");
            RewardEarned?.Invoke(requestedPurpose);
            NotifyStateChanged();
        }

        /// <summary>Results UI/mission rewards code reads this; this value is set only on an earned reward callback.</summary>
        public int ConsumeMissionRewardMultiplier()
        {
            if (!_doubleRewardsGranted) return 1;
            _doubleRewardsGranted = false;
            NotifyStateChanged();
            return 2;
        }

        /// <summary>Set true only on a non-combat menu/loadout/results navigation action.</summary>
        public void RequestBannerInMenuOrLoadout(bool visible)
        {
            _bannerRequested = visible;
            if (!visible || !IsBannerContext(_screenContext))
            {
                HideBanner();
                return;
            }
            EnsureBanner();
        }

        private void EnsureBanner()
        {
            if (!AdsAllowed || !_bannerRequested || !IsBannerContext(_screenContext)) return;
            if (_bannerView != null) return;
            if (config == null) return;

            try
            {
                _bannerView = new BannerView(config.GetBannerId(IsDevelopmentOrEditor), AdSize.Banner, AdPosition.Bottom);
                _bannerView.OnBannerAdLoaded += () =>
                {
                    RunOnMainThread(() =>
                    {
                        WriteLog("banner_loaded", $"Context={_screenContext}");
                        if (IsBannerContext(_screenContext)) _bannerView?.Show();
                        else _bannerView?.Hide();
                        NotifyStateChanged();
                    });
                };
                _bannerView.OnBannerAdLoadFailed += error =>
                {
                    RunOnMainThread(() =>
                    {
                        WriteLog("banner_failed", error?.GetMessage() ?? "Unknown banner error");
                        try { _bannerView?.Destroy(); } catch { }
                        _bannerView = null;
                        NotifyStateChanged();
                    });
                };
                _bannerView.LoadAd(new AdRequest());
                WriteLog("banner_load_requested", $"Context={_screenContext}");
            }
            catch (Exception ex)
            {
                WriteLog("banner_load_exception", ex.Message);
                try { _bannerView?.Destroy(); } catch { }
                _bannerView = null;
                NotifyStateChanged();
            }
        }

        private void HideBanner()
        {
            if (_bannerView == null) return;
            try { _bannerView.Hide(); }
            catch (Exception ex) { WriteLog("banner_hide_exception", ex.Message); }
        }

        /// <summary>Only succeeds on eligible non-first mission transition/result contexts.</summary>
        public bool TryShowInterstitialAtNaturalBreak()
        {
            if (!AdsAllowed || _interstitialAd == null || !_interstitialAd.CanShowAd())
            {
                WriteLog("interstitial_unavailable", "Not available right now — no eligible loaded interstitial.");
                NotifyStateChanged();
                return false;
            }

            if (_currentMissionNumber <= 1)
            {
                WriteLog("interstitial_blocked", "Interstitials are disabled during and immediately after the first mission.");
                return false;
            }

            if (_screenContext != ScreenContext.Results && _screenContext != ScreenContext.BetweenMissions)
            {
                WriteLog("interstitial_blocked", $"Context {_screenContext} is not a natural transition.");
                return false;
            }

            if (_interstitialsShownThisSession >= maximumInterstitialsPerSession)
            {
                WriteLog("interstitial_capped", "Session interstitial limit reached.");
                return false;
            }

            if (Time.realtimeSinceStartup - _lastInterstitialShownRealtime < minimumInterstitialIntervalSeconds)
            {
                WriteLog("interstitial_cooldown", "Minimum interstitial interval has not elapsed.");
                return false;
            }

            try
            {
                WriteLog("interstitial_show_requested", $"Context={_screenContext}, mission={_currentMissionNumber}");
                _interstitialAd.Show();
                return true;
            }
            catch (Exception ex)
            {
                WriteLog("interstitial_show_exception", ex.Message);
                ScheduleInterstitialRetry();
                NotifyStateChanged();
                return false;
            }
        }

        /// <summary>Refresh consent settings from the app Settings screen; never blocks offline play.</summary>
        public void RefreshConsentInformation()
        {
            if (!_supportedRuntime)
            {
                WriteLog("consent_editor", "UMP forms require an Android device; no form or response is simulated in Editor.");
                return;
            }
            if (!_isOnline)
            {
                WriteLog("consent_offline", "Privacy options cannot be opened offline.");
                return;
            }
            if (!PrivacyOptionsRequired)
            {
                WriteLog("privacy_options_not_required", "UMP does not currently require the privacy-options entry point.");
                return;
            }

            try
            {
                ConsentForm.ShowPrivacyOptionsForm(error =>
                {
                    RunOnMainThread(() =>
                    {
                        if (error != null) WriteLog("privacy_options_failed", error.Message);
                        else WriteLog("privacy_options_closed", "Privacy choices updated.");

                        PrivacyOptionsRequired =
                            ConsentInformation.PrivacyOptionsRequirementStatus == PrivacyOptionsRequirementStatus.Required;
                        _consentFlowFinished = true;

                        // Re-evaluate the current UMP decision. Do not leave a previously loaded ad
                        // visible/eligible if the user changed their choices to disallow ad requests.
                        if (!ConsentInformation.CanRequestAds())
                        {
                            SafeDestroyRewarded();
                            SafeDestroyInterstitial();
                            HideBanner();
                            WriteLog("ads_not_permitted", "Privacy choices currently disallow ad requests; all loaded ads were discarded.");
                        }
                        else if (_sdkInitialized)
                        {
                            SafeDestroyRewarded();
                            SafeDestroyInterstitial();
                            LoadRewardedAd();
                            LoadInterstitialAd();
                            if (_bannerRequested && IsBannerContext(_screenContext))
                            {
                                if (_bannerView != null)
                                {
                                    try { _bannerView.Destroy(); } catch { }
                                    _bannerView = null;
                                }
                                EnsureBanner();
                            }
                        }
                        NotifyStateChanged();
                    });
                });
            }
            catch (Exception ex)
            {
                WriteLog("privacy_options_exception", ex.Message);
            }
        }

        public void OpenPrivacyPolicy()
        {
            if (config == null || string.IsNullOrWhiteSpace(config.PrivacyPolicyUrl))
            {
                WriteLog("privacy_policy_missing", "Set a public HTTPS privacy policy URL in AdConfig before release.");
                return;
            }

            if (!Uri.TryCreate(config.PrivacyPolicyUrl.Trim(), UriKind.Absolute, out Uri uri) ||
                uri.Scheme != Uri.UriSchemeHttps)
            {
                WriteLog("privacy_policy_invalid", "Privacy policy URL must be an absolute HTTPS URL.");
                return;
            }

            Application.OpenURL(uri.AbsoluteUri);
        }

        public string GetRecentLogText(int maxEntries = 40)
        {
            int skip = Mathf.Max(0, _recentLogs.Count - Mathf.Clamp(maxEntries, 1, MaxLocalLogLines));
            var lines = new List<string>(_recentLogs);
            return string.Join("\n", lines.GetRange(skip, lines.Count - skip));
        }

        /// <summary>Google Ad Inspector is intentionally exposed only to Development builds.</summary>
        public void OpenAdInspector()
        {
            if (!Debug.isDebugBuild || !_supportedRuntime || !_sdkInitialized)
            {
                WriteLog("ad_inspector_blocked", "Ad Inspector is available only in an Android Development build with the SDK initialized.");
                return;
            }

            try
            {
                MobileAds.OpenAdInspector(error =>
                {
                    RunOnMainThread(() =>
                    {
                        if (error != null) WriteLog("ad_inspector_failed", error.GetMessage());
                        else WriteLog("ad_inspector_closed", "Ad Inspector closed.");
                    });
                });
            }
            catch (Exception ex)
            {
                WriteLog("ad_inspector_exception", ex.Message);
            }
        }

        private void BeginConsentFlow()
        {
            if (_consentUpdateInProgress || _sdkInitializationStarted || !_supportedRuntime || !_isOnline || config == null) return;

            _consentUpdateInProgress = true;
            WriteLog("consent_update_requested", "Refreshing UMP consent information for this launch.");

            try
            {
                var parameters = new ConsentRequestParameters();
#if UNITY_EDITOR
                // This path is not run in Editor. Keep it compile-safe if test builds change platform later.
#endif
                if (config.ForceEeaConsentForDevelopmentTests && Debug.isDebugBuild)
                {
                    parameters.ConsentDebugSettings = new ConsentDebugSettings
                    {
                        DebugGeography = DebugGeography.EEA,
                        TestDeviceHashedIds = new List<string>(config.UmpTestDeviceHashedIds)
                    };
                }

                ConsentInformation.Update(parameters, error =>
                {
                    RunOnMainThread(() =>
                    {
                        _consentUpdateInProgress = false;
                        PrivacyOptionsRequired =
                            ConsentInformation.PrivacyOptionsRequirementStatus == PrivacyOptionsRequirementStatus.Required;

                        if (error != null)
                        {
                            WriteLog("consent_update_failed", error.Message);
                            // UMP may retain valid consent from a previous session.
                            if (ConsentInformation.CanRequestAds()) CompleteConsentAndInitialize("cached consent after UMP update error");
                            else ScheduleConsentRetry();
                            NotifyStateChanged();
                            return;
                        }

                        WriteLog("consent_update_succeeded", $"Privacy options required={PrivacyOptionsRequired}");
                        try
                        {
                            ConsentForm.LoadAndShowConsentFormIfRequired(formError =>
                            {
                                RunOnMainThread(() =>
                                {
                                    if (formError != null)
                                        WriteLog("consent_form_failed", formError.Message);
                                    else
                                        WriteLog("consent_form_completed", "Any required consent form has been dismissed.");

                                    PrivacyOptionsRequired =
                                        ConsentInformation.PrivacyOptionsRequirementStatus == PrivacyOptionsRequirementStatus.Required;
                                    _consentFlowFinished = true;

                                    if (ConsentInformation.CanRequestAds())
                                        CompleteConsentAndInitialize("UMP flow completed");
                                    else
                                        WriteLog("ads_not_permitted", "UMP says ad requests are not permitted; gameplay continues without ads.");

                                    NotifyStateChanged();
                                });
                            });
                        }
                        catch (Exception ex)
                        {
                            WriteLog("consent_form_exception", ex.Message);
                            _consentFlowFinished = true;
                            if (ConsentInformation.CanRequestAds()) CompleteConsentAndInitialize("cached consent after consent form exception");
                            NotifyStateChanged();
                        }
                    });
                });
            }
            catch (Exception ex)
            {
                _consentUpdateInProgress = false;
                WriteLog("consent_update_exception", ex.Message);
                if (ConsentInformation.CanRequestAds()) CompleteConsentAndInitialize("cached consent after UMP exception");
                else ScheduleConsentRetry();
                NotifyStateChanged();
            }
        }

        private void CompleteConsentAndInitialize(string reason)
        {
            if (_sdkInitializationStarted || !_supportedRuntime || !_isOnline || !ConsentInformation.CanRequestAds()) return;
            _consentFlowFinished = true;
            _sdkInitializationStarted = true;
            WriteLog("sdk_initialize_requested", reason);

            try
            {
                MobileAds.Initialize(status =>
                {
                    RunOnMainThread(() =>
                    {
                        if (status == null)
                        {
                            _sdkInitializationStarted = false;
                            _sdkInitialized = false;
                            WriteLog("sdk_initialize_failed", "Initialization callback returned null.");
                            ScheduleConsentRetry();
                            NotifyStateChanged();
                            return;
                        }

                        _sdkInitialized = true;
                        WriteLog("sdk_initialized", $"Google Mobile Ads initialized. Plugin version {MobileAds.GetVersion()}.");
                        _rewardedRetryCount = 0;
                        _interstitialRetryCount = 0;
                        LoadRewardedAd();
                        LoadInterstitialAd();
                        if (_bannerRequested && IsBannerContext(_screenContext)) EnsureBanner();
                        NotifyStateChanged();
                    });
                });
            }
            catch (Exception ex)
            {
                _sdkInitializationStarted = false;
                _sdkInitialized = false;
                WriteLog("sdk_initialize_exception", ex.Message);
                ScheduleConsentRetry();
                NotifyStateChanged();
            }
        }

        private void LoadRewardedAd()
        {
            if (!AdsAllowed || config == null || _rewardedLoadInProgress || (_rewardedAd != null && _rewardedAd.CanShowAd())) return;
            _rewardedLoadInProgress = true;
            WriteLog("rewarded_load_requested", "Preloading rewarded ad.");

            try
            {
                RewardedAd.Load(config.GetRewardedId(IsDevelopmentOrEditor), new AdRequest(), (RewardedAd ad, LoadAdError error) =>
                {
                    RunOnMainThread(() =>
                    {
                        _rewardedLoadInProgress = false;
                        if (error != null || ad == null)
                        {
                            if (ad != null) { try { ad.Destroy(); } catch { } }
                            WriteLog("rewarded_load_failed", error?.GetMessage() ?? "Rewarded ad returned null.");
                            ScheduleRewardedRetry();
                            NotifyStateChanged();
                            return;
                        }

                        SafeDestroyRewarded();
                        _rewardedAd = ad;
                        _rewardedRetryCount = 0;
                        BindRewardedEvents(ad);
                        WriteLog("rewarded_loaded", "Rewarded ad is ready when the requested reward and screen context permit it.");
                        NotifyStateChanged();
                    });
                });
            }
            catch (Exception ex)
            {
                _rewardedLoadInProgress = false;
                WriteLog("rewarded_load_exception", ex.Message);
                ScheduleRewardedRetry();
                NotifyStateChanged();
            }
        }

        private void BindRewardedEvents(RewardedAd ad)
        {
            ad.OnAdImpressionRecorded += () => RunOnMainThread(() => WriteLog("ad_shown", "rewarded impression recorded"));
            ad.OnAdFullScreenContentOpened += () => RunOnMainThread(() =>
            {
                _fullscreenAdShowing = true;
                PauseGameForAd();
                WriteLog("rewarded_opened", "Rewarded fullscreen content opened.");
                NotifyStateChanged();
            });
            ad.OnAdFullScreenContentClosed += () => RunOnMainThread(() =>
            {
                WriteLog("rewarded_closed", _rewardCallbackReceived ? "Closed after reward callback." : "Closed without an earned reward; no reward granted.");
                _hasPendingReward = false;
                _fullscreenAdShowing = false;
                RestoreGameAfterAd();
                SafeDestroyRewarded();
                ScheduleRewardedRetry(0f);
                NotifyStateChanged();
            });
            ad.OnAdFullScreenContentFailed += error => RunOnMainThread(() =>
            {
                WriteLog("rewarded_show_failed", error?.GetMessage() ?? "Unknown fullscreen error.");
                _hasPendingReward = false;
                _fullscreenAdShowing = false;
                RestoreGameAfterAd();
                SafeDestroyRewarded();
                ScheduleRewardedRetry(0f);
                NotifyStateChanged();
            });
        }

        private void LoadInterstitialAd()
        {
            if (!AdsAllowed || config == null || _interstitialLoadInProgress || (_interstitialAd != null && _interstitialAd.CanShowAd())) return;
            _interstitialLoadInProgress = true;
            WriteLog("interstitial_load_requested", "Preloading interstitial ad for mission transitions only.");

            try
            {
                InterstitialAd.Load(config.GetInterstitialId(IsDevelopmentOrEditor), new AdRequest(), (InterstitialAd ad, LoadAdError error) =>
                {
                    RunOnMainThread(() =>
                    {
                        _interstitialLoadInProgress = false;
                        if (error != null || ad == null)
                        {
                            if (ad != null) { try { ad.Destroy(); } catch { } }
                            WriteLog("interstitial_load_failed", error?.GetMessage() ?? "Interstitial ad returned null.");
                            ScheduleInterstitialRetry();
                            NotifyStateChanged();
                            return;
                        }

                        SafeDestroyInterstitial();
                        _interstitialAd = ad;
                        _interstitialRetryCount = 0;
                        BindInterstitialEvents(ad);
                        WriteLog("interstitial_loaded", "Interstitial is preloaded; not eligible until an allowed results/between-missions context.");
                        NotifyStateChanged();
                    });
                });
            }
            catch (Exception ex)
            {
                _interstitialLoadInProgress = false;
                WriteLog("interstitial_load_exception", ex.Message);
                ScheduleInterstitialRetry();
                NotifyStateChanged();
            }
        }

        private void BindInterstitialEvents(InterstitialAd ad)
        {
            ad.OnAdImpressionRecorded += () => RunOnMainThread(() => WriteLog("ad_shown", "interstitial impression recorded"));
            ad.OnAdFullScreenContentOpened += () => RunOnMainThread(() =>
            {
                _fullscreenAdShowing = true;
                _interstitialsShownThisSession++;
                _lastInterstitialShownRealtime = Time.realtimeSinceStartup;
                PauseGameForAd();
                WriteLog("interstitial_opened", $"Interstitial opened ({_interstitialsShownThisSession}/{maximumInterstitialsPerSession} session cap).");
                NotifyStateChanged();
            });
            ad.OnAdFullScreenContentClosed += () => RunOnMainThread(() =>
            {
                WriteLog("interstitial_closed", "Interstitial closed.");
                _fullscreenAdShowing = false;
                RestoreGameAfterAd();
                SafeDestroyInterstitial();
                ScheduleInterstitialRetry(0f);
                NotifyStateChanged();
            });
            ad.OnAdFullScreenContentFailed += error => RunOnMainThread(() =>
            {
                WriteLog("interstitial_show_failed", error?.GetMessage() ?? "Unknown fullscreen error.");
                _fullscreenAdShowing = false;
                RestoreGameAfterAd();
                SafeDestroyInterstitial();
                ScheduleInterstitialRetry(0f);
                NotifyStateChanged();
            });
        }

        private void ScheduleRewardedRetry(float? overrideDelay = null)
        {
            if (!isActiveAndEnabled || !_supportedRuntime || !_isOnline || !_sdkInitialized || _rewardedRetryRoutine != null) return;
            int retry = Mathf.Min(_rewardedRetryCount++, 8);
            float delay = overrideDelay ?? Mathf.Min(MaxRetryDelaySeconds, FirstRetryDelaySeconds * Mathf.Pow(2f, retry));
            _rewardedRetryRoutine = StartCoroutine(RetryAfterDelay(delay, () =>
            {
                _rewardedRetryRoutine = null;
                LoadRewardedAd();
            }));
            WriteLog("rewarded_retry_scheduled", $"{delay:0.#}s");
        }

        private void ScheduleInterstitialRetry(float? overrideDelay = null)
        {
            if (!isActiveAndEnabled || !_supportedRuntime || !_isOnline || !_sdkInitialized || _interstitialRetryRoutine != null) return;
            int retry = Mathf.Min(_interstitialRetryCount++, 8);
            float delay = overrideDelay ?? Mathf.Min(MaxRetryDelaySeconds, FirstRetryDelaySeconds * Mathf.Pow(2f, retry));
            _interstitialRetryRoutine = StartCoroutine(RetryAfterDelay(delay, () =>
            {
                _interstitialRetryRoutine = null;
                LoadInterstitialAd();
            }));
            WriteLog("interstitial_retry_scheduled", $"{delay:0.#}s");
        }

        private void ScheduleConsentRetry()
        {
            if (!isActiveAndEnabled || !_supportedRuntime || !_isOnline || _sdkInitializationStarted || _consentRetryRoutine != null) return;
            _consentRetryRoutine = StartCoroutine(RetryAfterDelay(30f, () =>
            {
                _consentRetryRoutine = null;
                BeginConsentFlow();
            }));
            WriteLog("consent_retry_scheduled", "30s");
        }

        private IEnumerator RetryAfterDelay(float seconds, Action callback)
        {
            yield return new WaitForSecondsRealtime(Mathf.Max(0.1f, seconds));
            callback?.Invoke();
        }

        private void PauseGameForAd()
        {
            if (!_gamePauseCaptured)
            {
                _priorTimeScale = Time.timeScale;
                _priorAudioListenerPause = AudioListener.pause;
                _gamePauseCaptured = true;
            }
            Time.timeScale = 0f;
            AudioListener.pause = true;
        }

        private void RestoreGameAfterAd()
        {
            if (!_gamePauseCaptured || _fullscreenAdShowing || _isApplicationPaused) return;
            Time.timeScale = _priorTimeScale;
            AudioListener.pause = _priorAudioListenerPause;
            _gamePauseCaptured = false;
        }

        private void SafeDestroyRewarded()
        {
            if (_rewardedAd == null) return;
            try { _rewardedAd.Destroy(); } catch (Exception ex) { WriteLog("rewarded_destroy_failed", ex.Message); }
            _rewardedAd = null;
        }

        private void SafeDestroyInterstitial()
        {
            if (_interstitialAd == null) return;
            try { _interstitialAd.Destroy(); } catch (Exception ex) { WriteLog("interstitial_destroy_failed", ex.Message); }
            _interstitialAd = null;
        }

        private static bool HasNetwork() => Application.internetReachability != NetworkReachability.NotReachable;
        private static bool IsBannerContext(ScreenContext context) => context == ScreenContext.Menu || context == ScreenContext.Loadout;
        private static bool IsFieldUpgradeContext(ScreenContext context) =>
            context == ScreenContext.Menu || context == ScreenContext.Loadout || context == ScreenContext.BetweenMissions;

        private static void RunOnMainThread(Action action)
        {
            if (action == null) return;
            try { MobileAdsEventExecutor.ExecuteInUpdate(action); }
            catch (Exception ex) { Debug.LogWarning($"[POH Ads] Could not queue SDK callback on Unity thread: {ex.Message}"); }
        }

        private void NotifyStateChanged()
        {
            try { StateChanged?.Invoke(); }
            catch (Exception ex) { Debug.LogWarning($"[POH Ads] State listener threw: {ex.Message}"); }
        }

        private void WriteLog(string category, string message)
        {
            string line = $"{DateTime.UtcNow:yyyy-MM-ddTHH:mm:ss.fffZ} [{category}] {message}";
            _recentLogs.Enqueue(line);
            while (_recentLogs.Count > MaxLocalLogLines) _recentLogs.Dequeue();

            try { File.AppendAllText(_localLogPath, line + Environment.NewLine); }
            catch (Exception ex) { Debug.LogWarning($"[POH Ads] Local log write failed: {ex.Message}"); }
            Debug.Log($"[POH Ads] {category}: {message}");
            try { LogChanged?.Invoke(line); }
            catch (Exception ex) { Debug.LogWarning($"[POH Ads] Log listener threw: {ex.Message}"); }
        }

        private void LoadRecentLogs()
        {
            try
            {
                if (!File.Exists(_localLogPath)) return;
                string[] lines = File.ReadAllLines(_localLogPath);
                int start = Mathf.Max(0, lines.Length - MaxLocalLogLines);
                for (int i = start; i < lines.Length; i++) _recentLogs.Enqueue(lines[i]);
            }
            catch (Exception ex)
            {
                Debug.LogWarning($"[POH Ads] Could not read local ad log: {ex.Message}");
            }
        }
    }
}