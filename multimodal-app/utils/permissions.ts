import { PermissionsAndroid, Platform, Alert, Linking } from "react-native";

/**
 * Requests storage permission on Android devices.
 *
 * - For iOS and other platforms, resolves to true immediately.
 * - On Android, it checks if permission is already granted, otherwise requests it.
 * - Handles user responses including denial and permanent denial by showing alerts.
 *
 * @returns {Promise<boolean>} True if permission is granted, false otherwise.
 */
export async function requestStoragePermission() {
  if (Platform.OS !== "android") {
    console.log("iOS or web platform - no permission needed.");
    return true;
  }

  try {
    console.log("Requesting storage permission...");

    const androidVersion = Platform.Version;
    console.log("Android API Level:", androidVersion);

    // Check if permission is already granted
    const hasPermission = await PermissionsAndroid.check(
      PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE
    );

    if (hasPermission) {
      console.log("Storage permission already granted.");
      return true;
    }

    // Request permission
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
      {
        title: "Storage Permission Required",
        message:
          "This app needs access to your device storage to download and manage models. ",
        buttonNeutral: "Ask Me Later",
        buttonNegative: "Cancel",
        buttonPositive: "Grant Permission",
      }
    );

    console.log("Permission response:", granted);

    switch (granted) {
      case PermissionsAndroid.RESULTS.GRANTED:
        console.log("Storage permission granted.");
        return true;

      case PermissionsAndroid.RESULTS.DENIED:
        console.log("Storage permission denied.");
        Alert.alert(
          "Permission Denied",
          "Storage access is required for this app to work properly. Please try again.",
          [{ text: "OK" }]
        );
        return false;

      case PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN:
        console.log("Permission denied permanently.");
        Alert.alert(
          "Permission Required",
          "Storage permission was permanently denied. Please enable it manually in your device settings to use this feature.",
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Open Settings",
              onPress: () => Linking.openSettings(),
            },
          ]
        );
        return false;

      default:
        console.log("Unknown permission response:", granted);
        return false;
    }
  } catch (err) {
    console.error("Permission request error:", err);
    Alert.alert(
      "Permission Error",
      "An error occurred while requesting storage permission. Please try again.",
      [{ text: "OK" }]
    );
    return false;
  }
}

/**
 * Checks if the Android version supports scoped storage (API 33+),
 * and requests storage permission if needed on lower versions.
 *
 * For non-Android platforms, resolves to true immediately.
 *
 * @returns {Promise<boolean>} True if scoped storage is used or permission is granted, false otherwise.
 */
export async function checkAndroidVersion() {
  if (Platform.OS !== "android") {
    console.log("iOS or web platform - no permission needed.");
    return true;
  }

  try {
    const androidVersion = Platform.Version;

    if (androidVersion >= 33) {
      console.log("Android 13+ detected, using scoped storage approach");
      return true;
    }
    return await requestStoragePermission();
  } catch (error) {
    console.error("Modern storage permission error:", error);
    return false;
  }
}
