using System;
using UnityEngine;
using GoogleMobileAds.Ump.Api;

namespace ProjectZeroHour.Ads
{
    /// <summary>Runs UMP at launch and exposes the required privacy-options entry point.</summary>
    public sealed class AdsConsentController : MonoBehaviour
    {
        public bool ConsentFlowFinished { get; private set; }
        public bool CanRequestAds => ConsentInformation.CanRequestAds();
        public bool PrivacyOptionsRequired =>
            ConsentInformation.PrivacyOptionsRequirementStatus == PrivacyOptionsRequirementStatus.Required;

        public void GatherConsent(Action<bool> completed)
        {
            ConsentFlowFinished = false;
            if (Application.internetReachability == NetworkReachability.NotReachable)
            {
                ConsentFlowFinished = true;
                Debug.Log("[POH Ads] Offline at launch; ads remain unavailable until consent is refreshed online.");
                completed?.Invoke(false);
                return;
            }

            ConsentInformation.Update(new ConsentRequestParameters(), error =>
            {
                if (error != null)
                    Debug.LogWarning("[POH Ads] UMP update: " + error.Message);

                ConsentForm.LoadAndShowConsentFormIfRequired(formError =>
                {
                    if (formError != null)
                        Debug.LogWarning("[POH Ads] Consent form: " + formError.Message);

                    ConsentFlowFinished = true;
                    bool allowed = ConsentInformation.CanRequestAds();
                    Debug.Log("[POH Ads] Consent flow finished. CanRequestAds=" + allowed);
                    completed?.Invoke(allowed);
                });
            });
        }

        public void ShowPrivacyOptions()
        {
            if (!PrivacyOptionsRequired)
            {
                Debug.Log("[POH Ads] Privacy options entry point is not required for this user.");
                return;
            }

            ConsentForm.ShowPrivacyOptionsForm(error =>
            {
                if (error != null) Debug.LogWarning("[POH Ads] Privacy options: " + error.Message);
                Debug.Log("[POH Ads] Privacy options form dismissed.");
            });
        }

        public void RefreshConsentWhenOnline(Action<bool> completed)
        {
            if (Application.internetReachability == NetworkReachability.NotReachable)
            {
                completed?.Invoke(false);
                return;
            }
            GatherConsent(completed);
        }
    }
}