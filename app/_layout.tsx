import * as QuickActions from 'expo-quick-actions';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus, Linking } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
// Import database module so the sync open+schema runs before any screen mounts
import ErrorBoundary from '../src/components/ErrorBoundary';
import GlobalModalsHost from '../src/components/GlobalModalsHost';
import '../src/database/database';
import { registerNotificationCategories, scheduleDailyBriefings, setupNotificationResponseHandler } from '../src/notifications/notificationService';
import { ingestSharedText, parseCaptureUrl, setupQuickActions } from '../src/services/captureService';
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
    // Home-screen quick-action shortcuts
    setupQuickActions().catch(() => {});

    // Deep-link / share-intent capture: pieter://capture?text=...
    const handleUrl = async (url: string | null) => {
      if (!url) return;
      const text = parseCaptureUrl(url);
      if (text) {
        const task = await ingestSharedText(text);
        if (task) {
          useTaskStore.getState().loadAll().catch(() => {});
          try { router.push('/(tabs)/tasks'); } catch { /* ignore navigation race */ }
        }
      }
    };
    Linking.getInitialURL().then(handleUrl).catch(() => {});
    const sub = Linking.addEventListener('url', (e) => handleUrl(e.url));

    // Quick action shortcut routing
    const unsubQA = QuickActions.addListener((item) => {
      const route = (item.params as { route?: string } | undefined)?.route;
      if (route) {
        try { router.push(route as never); } catch { /* ignore */ }
      }
    });

    return () => {
      unsubNotif();
      sub.remove();
      unsubQA.remove?.();
    };
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
          <GlobalModalsHost />
        </ErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

