#if UNITY_EDITOR
using System;
using ProjectZeroHour.Ads;
using UnityEditor;
using UnityEditor.Build;
using UnityEditor.Build.Reporting;
using UnityEngine;

namespace ProjectZeroHour.Ads.Editor
{
    /// <summary>
    /// Synchronizes AdConfig's selected Android App ID to the official plugin's manifest settings before
    /// Android builds. Keeps GoogleMobileAdsSettings from becoming a second source of truth for IDs.
    /// </summary>
    internal sealed class AdMobAppIdBuildSync : IPreprocessBuildWithReport
    {
        private const string ConfigPath = "Assets/ProjectZeroHour/Resources/AdConfig.asset";
        private const string GoogleSettingsPath = "Assets/GoogleMobileAds/Resources/GoogleMobileAdsSettings.asset";
        private const string AndroidAppIdSerializedField = "adMobAndroidAppId";

        public int callbackOrder => -1000;

        [MenuItem("Tools/Project Zero Hour/Sync Google Mobile Ads App ID")]
        private static void SyncEditorTestId()
        {
            AdConfig config = AssetDatabase.LoadAssetAtPath<AdConfig>(ConfigPath);
            if (config == null)
            {
                EditorUtility.DisplayDialog("Project Zero Hour Ads", $"Missing {ConfigPath}. Restore the AdConfig asset first.", "OK");
                return;
            }

            try
            {
                Sync(config, developmentBuild: true);
                EditorUtility.DisplayDialog("Project Zero Hour Ads", "Google Mobile Ads Settings now contains the Google test App ID for Editor/development testing.", "OK");
            }
            catch (Exception ex)
            {
                EditorUtility.DisplayDialog("Project Zero Hour Ads", ex.Message, "OK");
            }
        }

        public void OnPreprocessBuild(BuildReport report)
        {
            if (report.summary.platform != BuildTarget.Android) return;

            // The plugin's current documented Android requirement is API 24+; target API 35+ is
            // required by the Google Mobile Ads Unity quick start. Never lower a project's newer target.
            if ((int)PlayerSettings.Android.minSdkVersion < 24)
                PlayerSettings.Android.minSdkVersion = (UnityEditor.AndroidSdkVersions)24;

            if ((int)PlayerSettings.Android.targetSdkVersion < 35)
                PlayerSettings.Android.targetSdkVersion = (UnityEditor.AndroidSdkVersions)35;

            bool developmentBuild = (report.summary.options & BuildOptions.Development) != 0;
            AdConfig config = AssetDatabase.LoadAssetAtPath<AdConfig>(ConfigPath);
            if (config == null)
                throw new BuildFailedException($"[Project Zero Hour Ads] Missing {ConfigPath}; refusing to build without an explicit AdConfig.");

            try
            {
                string appId = config.GetAndroidAppId(developmentBuild);
                SyncAppId(appId);
            }
            catch (Exception ex)
            {
                throw new BuildFailedException($"[Project Zero Hour Ads] Could not configure the Google Mobile Ads manifest App ID. {ex.Message}");
            }
        }

        private static void Sync(AdConfig config, bool developmentBuild)
        {
            string appId = config.GetAndroidAppId(developmentBuild);
            SyncAppId(appId);
        }

        private static void SyncAppId(string appId)
        {
            if (string.IsNullOrWhiteSpace(appId))
                throw new InvalidOperationException("Selected Google Mobile Ads Android App ID is empty.");

            ScriptableObject settings = AssetDatabase.LoadAssetAtPath<ScriptableObject>(GoogleSettingsPath);
            if (settings == null)
                throw new InvalidOperationException(
                    $"Official Google Mobile Ads settings were not found at {GoogleSettingsPath}. Import the official Google Mobile Ads Unity plugin first, then open Assets > Google Mobile Ads > Settings once.");

            var serializedSettings = new SerializedObject(settings);
            SerializedProperty property = serializedSettings.FindProperty(AndroidAppIdSerializedField);
            if (property == null || property.propertyType != SerializedPropertyType.String)
                throw new InvalidOperationException(
                    "Could not locate the Google Mobile Ads Android App ID field. The installed plugin settings schema may have changed; set Android App ID manually in Assets > Google Mobile Ads > Settings.");

            property.stringValue = appId;
            serializedSettings.ApplyModifiedPropertiesWithoutUndo();
            EditorUtility.SetDirty(settings);
            AssetDatabase.SaveAssets();
            Debug.Log($"[Project Zero Hour Ads] Synced Android App ID ({(appId.Contains("3940256099942544") ? "Google test" : "configured Release")}) into the Google Mobile Ads plugin settings.");
        }
    }

}
#endif
