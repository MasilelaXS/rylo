import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
// Import database module so the sync open+schema runs before any screen mounts
import ErrorBoundary from '../src/components/ErrorBoundary';
import '../src/database/database';
import { registerNotificationCategories, scheduleDailyBriefings, setupNotificationResponseHandler } from '../src/notifications/notificationService';
import { useSettingsStore } from '../src/store/settingsStore';
import { useTaskStore } from '../src/store/taskStore';
import { speakHourlySummary } from '../src/voice/ttsService';

export default function RootLayout() {
  const lastSummaryRef = useRef<number>(0);

  useEffect(() => {
    // Load persisted settings before any screen renders
    useSettingsStore.getState().loadSettings().catch(console.error);
    // Register notification action categories (Complete / Snooze)
    registerNotificationCategories().catch(console.error);
    // Handle tapping notification actions
    const unsubNotif = setupNotificationResponseHandler();
    return unsubNotif;
  }, []);

  useEffect(() => {
    // Schedule daily briefings once on mount
    const { tasks } = useTaskStore.getState();
    scheduleDailyBriefings(tasks).catch(console.error);
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state !== 'active') return;
      const now = Date.now();
      const hourMs = 60 * 60 * 1000;
      if (now - lastSummaryRef.current < hourMs) return;
      lastSummaryRef.current = now;

      const { settings } = useSettingsStore.getState();
      if (!settings.voiceEnabled) return;

      const { tasks } = useTaskStore.getState();
      const pending = tasks.filter((t) => t.status !== 'completed' && t.status !== 'cancelled');
      const overdue = pending.filter((t) => t.dueDate < now);
      const next = pending
        .filter((t) => t.dueDate >= now)
        .sort((a, b) => a.dueDate - b.dueDate)[0];
      const nextArg = next
        ? { title: next.title, dueTime: new Date(next.dueDate).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) }
        : undefined;
      speakHourlySummary(pending.length, overdue.length, nextArg);
    });

    return () => sub.remove();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ErrorBoundary fallbackTitle="App error — tap to retry">
          <StatusBar style="dark" backgroundColor="#ffffff" />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" />
          </Stack>
        </ErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

