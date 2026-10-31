using UnityEngine;
using UnityEngine.UI;

namespace ProjectZeroHour.Ads
{
    /// <summary>Optional UI bridge for menu/settings only. Do not put these buttons in the combat HUD.</summary>
    public sealed class AdsMenuUI : MonoBehaviour
    {
        [SerializeField] private Button fieldUpgradeButton;
        [SerializeField] private Button reviveButton;
        [SerializeField] private Button doubleRewardsButton;
        [SerializeField] private Button privacyOptionsButton;
        [SerializeField] private Button bannerEnableButton;
        [SerializeField] private Text availabilityLabel;

        private void OnEnable()
        {
            if (fieldUpgradeButton != null) fieldUpgradeButton.onClick.AddListener(WatchFieldUpgrade);
            if (reviveButton != null) reviveButton.onClick.AddListener(WatchRevive);
            if (doubleRewardsButton != null) doubleRewardsButton.onClick.AddListener(WatchDoubleRewards);
            if (privacyOptionsButton != null) privacyOptionsButton.onClick.AddListener(ShowPrivacyOptions);
            Refresh();
        }

        private void OnDisable()
        {
            if (fieldUpgradeButton != null) fieldUpgradeButton.onClick.RemoveListener(WatchFieldUpgrade);
            if (reviveButton != null) reviveButton.onClick.RemoveListener(WatchRevive);
            if (doubleRewardsButton != null) doubleRewardsButton.onClick.RemoveListener(WatchDoubleRewards);
            if (privacyOptionsButton != null) privacyOptionsButton.onClick.RemoveListener(ShowPrivacyOptions);
        }

        private void Update() { Refresh(); }

        private void Refresh()
        {
            AdsManager manager = AdsManager.Instance;
            bool ready = manager != null && manager.RewardedReady && !manager.IsBusyShowingAd;
            if (fieldUpgradeButton != null) fieldUpgradeButton.gameObject.SetActive(ready);
            if (reviveButton != null) reviveButton.gameObject.SetActive(ready);
            if (doubleRewardsButton != null) doubleRewardsButton.gameObject.SetActive(ready);
            if (availabilityLabel != null) availabilityLabel.text = ready ? "Optional reward ad ready" : "Not available right now";
            if (privacyOptionsButton != null) privacyOptionsButton.gameObject.SetActive(manager != null);
        }

        private void WatchFieldUpgrade() => AdsManager.Instance?.OfferRewarded(RewardKind.FieldUpgrade);
        private void WatchRevive() => AdsManager.Instance?.OfferRewarded(RewardKind.MissionRevive);
        private void WatchDoubleRewards() => AdsManager.Instance?.OfferRewarded(RewardKind.DoubleMissionRewards);
        private void ShowPrivacyOptions()
        {
            AdsManager manager = AdsManager.Instance;
            if (manager == null) return;
            var consent = manager.GetComponent<AdsConsentController>();
            consent?.ShowPrivacyOptions();
        }

        public void OpenPrivacyPolicy(string url)
        {
            if (!string.IsNullOrWhiteSpace(url) && url.StartsWith("https://"))
                Application.OpenURL(url);
        }
    }
}