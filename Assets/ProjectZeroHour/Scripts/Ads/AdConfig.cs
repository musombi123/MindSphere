using System;
using UnityEngine;

namespace ProjectZeroHour.Ads
{
    /// <summary>
    /// Single source of truth for ad IDs. Editor and Development builds always use Google's sample test IDs.
    /// Production IDs are only used by non-development Release builds after an explicit opt-in.
    /// </summary>
    [CreateAssetMenu(fileName = "AdConfig", menuName = "Project Zero Hour/Ads/Ad Config", order = 10)]
    public sealed class AdConfig : ScriptableObject
    {
        [Header("Release safety switch")]
        [SerializeField] private bool useProductionIdsInRelease;

        [Header("Google sample test IDs — do not change")]
        [SerializeField] private string testAndroidAppId = "ca-app-pub-3940256099942544~3347511713";
        [SerializeField] private string testRewardedId = "ca-app-pub-3940256099942544/5224354917";
        [SerializeField] private string testInterstitialId = "ca-app-pub-3940256099942544/1033173712";
        [SerializeField] private string testBannerId = "ca-app-pub-3940256099942544/6300978111";

        [Header("Production IDs — fill only after creating real AdMob units")]
        [SerializeField] private string productionAndroidAppId = string.Empty;
        [SerializeField] private string productionRewardedId = string.Empty;
        [SerializeField] private string productionInterstitialId = string.Empty;
        [SerializeField] private string productionBannerId = string.Empty;

        [Header("Privacy")]
        [Tooltip("Public HTTPS privacy policy URL. Leave blank until an actual public page exists.")]
        [SerializeField] private string privacyPolicyUrl = string.Empty;

        [Header("Development-only UMP diagnostics")]
        [SerializeField] private bool forceEeaConsentForDevelopmentTests;
        [SerializeField] private string[] umpTestDeviceHashedIds = Array.Empty<string>();

        public bool UseProductionIdsInRelease => useProductionIdsInRelease;
        public string PrivacyPolicyUrl => privacyPolicyUrl;
        public bool ForceEeaConsentForDevelopmentTests => forceEeaConsentForDevelopmentTests;
        public string[] UmpTestDeviceHashedIds => umpTestDeviceHashedIds ?? Array.Empty<string>();

        public string GetAndroidAppId(bool developmentBuild) =>
            ShouldUseProductionIds(developmentBuild) && !string.IsNullOrWhiteSpace(productionAndroidAppId)
                ? productionAndroidAppId.Trim() : testAndroidAppId.Trim();

        public string GetRewardedId(bool developmentBuild) =>
            ShouldUseProductionIds(developmentBuild) && !string.IsNullOrWhiteSpace(productionRewardedId)
                ? productionRewardedId.Trim() : testRewardedId.Trim();

        public string GetInterstitialId(bool developmentBuild) =>
            ShouldUseProductionIds(developmentBuild) && !string.IsNullOrWhiteSpace(productionInterstitialId)
                ? productionInterstitialId.Trim() : testInterstitialId.Trim();

        public string GetBannerId(bool developmentBuild) =>
            ShouldUseProductionIds(developmentBuild) && !string.IsNullOrWhiteSpace(productionBannerId)
                ? productionBannerId.Trim() : testBannerId.Trim();

        public bool HasCompleteProductionIds(out string missing)
        {
            var missingItems = new System.Collections.Generic.List<string>();
            if (string.IsNullOrWhiteSpace(productionAndroidAppId)) missingItems.Add("Android App ID");
            if (string.IsNullOrWhiteSpace(productionRewardedId)) missingItems.Add("Rewarded ID");
            if (string.IsNullOrWhiteSpace(productionInterstitialId)) missingItems.Add("Interstitial ID");
            if (string.IsNullOrWhiteSpace(productionBannerId)) missingItems.Add("Banner ID");
            missing = string.Join(", ", missingItems);
            return missingItems.Count == 0;
        }

        private bool ShouldUseProductionIds(bool developmentBuild) =>
            !developmentBuild && useProductionIdsInRelease && HasCompleteProductionIds(out _);

#if UNITY_EDITOR
        private void OnValidate()
        {
            if (useProductionIdsInRelease && !HasCompleteProductionIds(out string missing))
                Debug.LogWarning($"[Project Zero Hour Ads] Incomplete production IDs ({missing}); test IDs remain active.", this);
        }
#endif
    }
}