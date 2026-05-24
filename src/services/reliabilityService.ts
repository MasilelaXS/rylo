// Reliability helpers — deep-link the user into the Android OS settings screens
// that control whether scheduled notifications actually fire when the app is
// closed. Android cannot expose the "isIgnoringBatteryOptimizations" status
// to JS without a custom native module, so this service focuses on launching
// the right intents; the UI tracks the user's acknowledgement in settings.

import Constants from 'expo-constants';
import * as IntentLauncher from 'expo-intent-launcher';
import { Linking, Platform } from 'react-native';

function packageName(): string {
  // app.json android.package — fall back to expoConfig
  return (
    (Constants.expoConfig?.android?.package as string | undefined) ??
    'com.danneldev.Pieter'
  );
}

/** Opens the system dialog "Allow [App] to ignore battery optimisations?". */
export async function requestIgnoreBatteryOptimizations(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    await IntentLauncher.startActivityAsync(
      'android.settings.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS',
      { data: `package:${packageName()}` }
    );
  } catch {
    // Some OEMs block the direct request — fall back to the global list.
    await openBatteryOptimizationList();
  }
}

/** Opens the global "Battery optimisation" list (user picks app manually). */
export async function openBatteryOptimizationList(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    await IntentLauncher.startActivityAsync(
      'android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS'
    );
  } catch {
    await Linking.openSettings();
  }
}

/** Opens this app's "Alarms & reminders" permission screen (Android 12+). */
export async function openExactAlarmSettings(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    await IntentLauncher.startActivityAsync(
      'android.settings.REQUEST_SCHEDULE_EXACT_ALARM',
      { data: `package:${packageName()}` }
    );
  } catch {
    await Linking.openSettings();
  }
}

/** Opens this app's main settings page (battery, notifications, etc.). */
export async function openAppSettings(): Promise<void> {
  await Linking.openSettings();
}
