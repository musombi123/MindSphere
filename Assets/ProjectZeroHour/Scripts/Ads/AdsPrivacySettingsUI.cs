using UnityEngine;
using UnityEngine.UI;

namespace ProjectZeroHour.Ads
{
    /// <summary>
    /// Optional Settings-page bridge. Put these controls in Settings, never in the combat HUD.
    /// A separate Privacy options button should be displayed only when UMP requires it.
    /// </summary>
    public sealed class AdsPrivacySettingsUI : MonoBehaviour
    {
        [SerializeField] private Button privacyOptionsButton;
        [SerializeField] private Button privacyPolicyButton;

        private void OnEnable()
        {
            if (privacyOptionsButton != null)
            {
                privacyOptionsButton.onClick.RemoveListener(OnPrivacyOptionsClicked);
                privacyOptionsButton.onClick.AddListener(OnPrivacyOptionsClicked);
            }
            if (privacyPolicyButton != null)
            {
                privacyPolicyButton.onClick.RemoveListener(OnPrivacyPolicyClicked);
                privacyPolicyButton.onClick.AddListener(OnPrivacyPolicyClicked);
            }

            if (AdsManager.Instance != null)
                AdsManager.Instance.StateChanged += Refresh;
            Refresh();
        }

        private void OnDisable()
        {
            if (privacyOptionsButton != null) privacyOptionsButton.onClick.RemoveListener(OnPrivacyOptionsClicked);
            if (privacyPolicyButton != null) privacyPolicyButton.onClick.RemoveListener(OnPrivacyPolicyClicked);
            if (AdsManager.Instance != null) AdsManager.Instance.StateChanged -= Refresh;
        }

        private void Refresh()
        {
            if (privacyOptionsButton != null)
            {
                bool required = AdsManager.Instance != null && AdsManager.Instance.PrivacyOptionsRequired;
                privacyOptionsButton.gameObject.SetActive(required);
                privacyOptionsButton.interactable = required;
            }

            if (privacyPolicyButton != null)
                privacyPolicyButton.interactable = AdsManager.Instance != null;
        }

        public void OnPrivacyOptionsClicked()
        {
            if (AdsManager.Instance != null) AdsManager.Instance.RefreshConsentInformation();
        }

        public void OnPrivacyPolicyClicked()
        {
            if (AdsManager.Instance != null) AdsManager.Instance.OpenPrivacyPolicy();
        }
    }
}