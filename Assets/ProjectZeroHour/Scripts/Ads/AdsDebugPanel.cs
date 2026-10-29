using UnityEngine;
using UnityEngine.UI;

namespace ProjectZeroHour.Ads
{
    /// <summary>Optional local-only diagnostics panel; contains no telemetry or external analytics.</summary>
    public sealed class AdsDebugPanel : MonoBehaviour
    {
        [SerializeField] private GameObject panelRoot;
        [SerializeField] private Text logText;
        [SerializeField] private Button refreshButton;
        [SerializeField] private Button inspectorButton;
        [SerializeField] private Button closeButton;
        [SerializeField, Min(5)] private int linesToShow = 30;

        private void OnEnable()
        {
            if (AdsManager.Instance != null)
            {
                AdsManager.Instance.LogChanged += OnLogChanged;
                AdsManager.Instance.StateChanged += Refresh;
            }

            if (refreshButton != null) refreshButton.onClick.AddListener(Refresh);
            if (inspectorButton != null) inspectorButton.onClick.AddListener(OpenInspector);
            if (closeButton != null) closeButton.onClick.AddListener(Close);
            if (inspectorButton != null) inspectorButton.gameObject.SetActive(Debug.isDebugBuild);
            Refresh();
        }

        private void OnDisable()
        {
            if (AdsManager.Instance != null)
            {
                AdsManager.Instance.LogChanged -= OnLogChanged;
                AdsManager.Instance.StateChanged -= Refresh;
            }
            if (refreshButton != null) refreshButton.onClick.RemoveListener(Refresh);
            if (inspectorButton != null) inspectorButton.onClick.RemoveListener(OpenInspector);
            if (closeButton != null) closeButton.onClick.RemoveListener(Close);
        }

        public void Toggle()
        {
            if (panelRoot != null) panelRoot.SetActive(!panelRoot.activeSelf);
            Refresh();
        }

        public void Refresh()
        {
            if (logText == null) return;
            logText.text = AdsManager.Instance == null
                ? "[POH Ads] AdsManager not present in this scene."
                : AdsManager.Instance.GetRecentLogText(linesToShow);
        }

        private void OnLogChanged(string _) => Refresh();

        private void OpenInspector()
        {
            if (AdsManager.Instance != null) AdsManager.Instance.OpenAdInspector();
        }

        private void Close()
        {
            if (panelRoot != null) panelRoot.SetActive(false);
        }
    }
}