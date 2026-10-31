using UnityEngine;

namespace ProjectZeroHour.Ads
{
    [CreateAssetMenu(menuName = "Project Zero Hour/Ads/Ad Config", fileName = "AdConfig")]
    public sealed class AdConfig : ScriptableObject
    {
        [Header("Google test IDs — never replace these with production IDs for testing")]
        public string testAndroidAppId = "ca-app-pub-3940256099942544~3347511713";
        public string testRewardedId = "ca-app-pub-3940256099942544/5224354917";
        public string testInterstitialId = "ca-app-pub-3940256099942544/1033173712";
        public string testBannerId = "ca-app-pub-3940256099942544/6300978111";

        [Header("Production IDs — fill only after creating your own AdMob app/ad units")]
        public string releaseAndroidAppId = "";
        public string releaseRewardedId = "";
        public string releaseInterstitialId = "";
        public string releaseBannerId = "";

        [Header("Privacy")]
        [Tooltip("HTTPS URL to the game's published privacy policy.")]
        public string privacyPolicyUrl = "";

        [Header("Interstitial safeguards")]
        [Min(60)] public float minimumInterstitialIntervalSeconds = 180f;
        [Min(0)] public int maximumInterstitialsPerSession = 3;

        public bool UseTestAds
        {
            get
            {
#if UNITY_EDITOR || DEVELOPMENT_BUILD || !UNITY_ANDROID
                return true;
#else
                return false;
#endif
            }
        }

        public string AndroidAppId => UseTestAds || string.IsNullOrWhiteSpace(releaseAndroidAppId) ? testAndroidAppId : releaseAndroidAppId;
        public string RewardedId => UseTestAds || string.IsNullOrWhiteSpace(releaseRewardedId) ? testRewardedId : releaseRewardedId;
        public string InterstitialId => UseTestAds || string.IsNullOrWhiteSpace(releaseInterstitialId) ? testInterstitialId : releaseInterstitialId;
        public string BannerId => UseTestAds || string.IsNullOrWhiteSpace(releaseBannerId) ? testBannerId : releaseBannerId;
    }
}