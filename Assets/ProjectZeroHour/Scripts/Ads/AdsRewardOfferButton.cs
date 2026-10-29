using UnityEngine;
using UnityEngine.UI;

namespace ProjectZeroHour.Ads
{
    /// <summary>
    /// Connect a rewarded-ad offer on a menu/loadout/results/death screen. Do not attach this to
    /// movement, fire, aim, or ability controls. It never fakes a reward when ads are unavailable.
    /// </summary>
    public sealed class AdsRewardOfferButton : MonoBehaviour
    {
        [SerializeField] private AdRewardPurpose purpose = AdRewardPurpose.FieldUpgradeProgram;
        [SerializeField] private Button watchAdButton;
        [SerializeField] private Text statusText;
        [SerializeField] private bool hideButtonWhenUnavailable = true;

        private void OnEnable()
        {
            if (watchAdButton != null)
            {
                watchAdButton.onClick.RemoveListener(OnWatchAdClicked);
                watchAdButton.onClick.AddListener(OnWatchAdClicked);
            }

            if (AdsManager.Instance != null)
            {
                AdsManager.Instance.StateChanged += Refresh;
                AdsManager.Instance.RewardEarned += OnRewardEarned;
            }
            Refresh();
        }

        private void OnDisable()
        {
            if (watchAdButton != null) watchAdButton.onClick.RemoveListener(OnWatchAdClicked);
            if (AdsManager.Instance != null)
            {
                AdsManager.Instance.StateChanged -= Refresh;
                AdsManager.Instance.RewardEarned -= OnRewardEarned;
            }
        }

        public void Refresh()
        {
            if (watchAdButton == null) return;
            bool available = AdsManager.Instance != null && AdsManager.Instance.CanOfferRewarded(purpose);
            watchAdButton.interactable = available;
            if (hideButtonWhenUnavailable) watchAdButton.gameObject.SetActive(available);

            if (statusText != null)
            {
                statusText.text = available
                    ? "Watch ad for reward"
                    : (AdsManager.Instance != null
                        ? AdsManager.Instance.GetRewardedUnavailableReason(purpose)
                        : "Not available right now.");
            }
        }

        private void OnWatchAdClicked()
        {
            if (AdsManager.Instance == null)
            {
                if (statusText != null) statusText.text = "Not available right now.";
                Refresh();
                return;
            }

            bool accepted = AdsManager.Instance.TryShowRewarded(purpose);
            if (!accepted && statusText != null)
                statusText.text = AdsManager.Instance.GetRewardedUnavailableReason(purpose);
            Refresh();
        }

        private void OnRewardEarned(AdRewardPurpose earnedPurpose)
        {
            if (earnedPurpose == purpose && statusText != null)
                statusText.text = purpose switch
                {
                    AdRewardPurpose.FieldUpgradeProgram => "Field Upgrade active for this mission.",
                    AdRewardPurpose.ReviveOncePerMission => "Revive earned. Restoring ZERO…",
                    AdRewardPurpose.DoubleMissionRewards => "Double mission rewards unlocked.",
                    _ => "Reward earned."
                };
            Refresh();
        }
    }
}