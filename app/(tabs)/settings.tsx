import { Ionicons } from '@expo/vector-icons';
import * as Speech from 'expo-speech';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, Share, StatusBar, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import BackgroundImage from '../../src/components/BackgroundImage';
import { cancelAllNotifications, scheduleHourlyReminders } from '../../src/notifications/notificationService';
import { useNoteStore } from '../../src/store/noteStore';
import { useProjectStore } from '../../src/store/projectStore';
import { useSettingsStore } from '../../src/store/settingsStore';
import { useTaskStore } from '../../src/store/taskStore';
import type { ReminderMode } from '../../src/types';
import { CARD_SHADOW, COLORS, ESCALATION_CONFIG, REMINDER_MODES } from '../../src/utils/constants';
import { speakText } from '../../src/voice/ttsService';

const ESCALATION_COLORS = ['#2ECC9A', '#F59E0B', '#FF7043', '#FF4444'];

// ── Hour label helper ─────────────────────────────────────────────────────────
function hourLabel(h: number) {
  if (h === 0)  return '12 AM';
  if (h < 12)  return `${h} AM`;
  if (h === 12) return '12 PM';
  return `${h - 12} PM`;
}

function Divider() {
  return <View style={{ height: 1, backgroundColor: COLORS.cardAlt, marginHorizontal: 16 }} />;
}

function SettingRow({ label, sublabel, right }: { label: string; sublabel?: string; right?: React.ReactNode }) {
  return (
    <View style={s.row}>
      <View style={{ flex: 1 }}>
        <Text style={s.rowLabel}>{label}</Text>
        {sublabel ? <Text style={s.rowSub}>{sublabel}</Text> : null}
      </View>
      {right}
    </View>
  );
}

export default function SettingsScreen() {
  const { settings, update } = useSettingsStore();
  const { tasks } = useTaskStore();
  const { notes } = useNoteStore();
  const { projects } = useProjectStore();
  const [exportLoading, setExportLoading] = useState(false);

  const [voices,       setVoices]       = useState<Speech.Voice[]>([]);
  const [loadingVoice, setLoadingVoice] = useState(false);
  const [previewingId, setPreviewingId] = useState<string | null>(null);

  // ── Load available voices ──────────────────────────────────────────────────
  useEffect(() => {
    setLoadingVoice(true);
    Speech.getAvailableVoicesAsync()
      .then((all) => {
        // Keep English voices only, Enhanced quality first
        const english = all
          .filter((v) => v.language?.startsWith('en'))
          .sort((a, b) => {
            if (a.quality === 'Enhanced' && b.quality !== 'Enhanced') return -1;
            if (b.quality === 'Enhanced' && a.quality !== 'Enhanced') return 1;
            return a.name.localeCompare(b.name);
          });
        setVoices(english);
      })
      .catch(() => {})
      .finally(() => setLoadingVoice(false));
  }, []);

  // ── Preview a voice ────────────────────────────────────────────────────────
  const previewVoice = (voice: Speech.Voice) => {
    Speech.stop();
    setPreviewingId(voice.identifier);
    Speech.speak('Hello! I will remind you of your tasks.', {
      voice: voice.identifier,
      language: voice.language,
      rate: settings.speechRate,
      onDone:  () => setPreviewingId(null),
      onError: () => setPreviewingId(null),
    });
  };

  // ── Quiet hours helpers ────────────────────────────────────────────────────
  const adjustQuietHour = (field: 'quietHoursStart' | 'quietHoursEnd', delta: number) => {
    const current = parseInt(settings[field].split(':')[0], 10);
    const next = (current + delta + 24) % 24;
    update({ [field]: `${String(next).padStart(2, '0')}:00` });
  };

  // Re-schedule when hourly or quiet hours settings change
  useEffect(() => {
    scheduleHourlyReminders(tasks).catch(console.error);
  }, [settings.hourlyRemindersEnabled, settings.quietHoursEnabled, settings.quietHoursStart, settings.quietHoursEnd, settings.userName]);

  const quietStartH = parseInt(settings.quietHoursStart.split(':')[0], 10);
  const quietEndH   = parseInt(settings.quietHoursEnd.split(':')[0], 10);

  return (
    <BackgroundImage screen="settings">
      <SafeAreaView style={s.safe}>
        <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
        <ScrollView style={s.scroll} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
          <Text style={s.title}>Settings</Text>
          <Text style={s.subtitle}>Customize your execution engine</Text>

          {/* ── Profile ───────────────────────────────────────────── */}
          <Text style={s.sectionLabel}>Profile</Text>
          <View style={s.group}>
            <View style={s.row}>
              <Text style={[s.rowLabel, { flex: 1 }]}>Your name</Text>
              <TextInput
                style={s.nameInput}
                value={settings.userName ?? ''}
                onChangeText={(v) => update({ userName: v })}
                placeholder="e.g. Pieter"
                placeholderTextColor={COLORS.textMuted}
                returnKeyType="done"
                maxLength={40}
              />
            </View>
            <Divider />
            <View style={s.row}>
              <Text style={s.rowSub} numberOfLines={2}>
                Used in hourly check-ins: &#34;Hey {settings.userName?.trim() || 'there'}, it&#39;s 3:00 PM...&#34;
              </Text>
            </View>
          </View>

          {/* ── Voice ─────────────────────────────────────────────── */}
          <Text style={s.sectionLabel}>Voice</Text>
          <View style={s.group}>
            <SettingRow
              label="Voice Reminders"
              sublabel="Speak tasks aloud when triggered"
              right={
                <Switch
                  value={settings.voiceEnabled}
                  onValueChange={(v) => update({ voiceEnabled: v })}
                  trackColor={{ false: COLORS.cardAlt, true: COLORS.primaryLight }}
                  thumbColor={settings.voiceEnabled ? COLORS.primary : COLORS.textMuted}
                />
              }
            />
            <Divider />
            <SettingRow
              label="Morning Briefing"
              sublabel="Daily summary at wake-up"
              right={
                <Switch
                  value={settings.morningBriefingEnabled}
                  onValueChange={(v) => update({ morningBriefingEnabled: v })}
                  trackColor={{ false: COLORS.cardAlt, true: COLORS.primaryLight }}
                  thumbColor={settings.morningBriefingEnabled ? COLORS.primary : COLORS.textMuted}
                />
              }
            />
            <Divider />
            <SettingRow
              label="Evening Briefing"
              sublabel="Daily recap at end of day"
              right={
                <Switch
                  value={settings.eveningBriefingEnabled}
                  onValueChange={(v) => update({ eveningBriefingEnabled: v })}
                  trackColor={{ false: COLORS.cardAlt, true: COLORS.primaryLight }}
                  thumbColor={settings.eveningBriefingEnabled ? COLORS.primary : COLORS.textMuted}
                />
              }
            />
          </View>

          {/* ── Hourly Reminders ──────────────────────────────────── */}
          <Text style={s.sectionLabel}>Hourly Reminders</Text>
          <View style={s.group}>
            <SettingRow
              label="Hourly Notifications"
              sublabel="Remind every hour with upcoming tasks"
              right={
                <Switch
                  value={settings.hourlyRemindersEnabled}
                  onValueChange={(v) => update({ hourlyRemindersEnabled: v })}
                  trackColor={{ false: COLORS.cardAlt, true: COLORS.primaryLight }}
                  thumbColor={settings.hourlyRemindersEnabled ? COLORS.primary : COLORS.textMuted}
                />
              }
            />
            {settings.hourlyRemindersEnabled && (
              <>
                <Divider />
                <SettingRow
                  label="Quiet Hours"
                  sublabel="Silence reminders overnight"
                  right={
                    <Switch
                      value={settings.quietHoursEnabled}
                      onValueChange={(v) => update({ quietHoursEnabled: v })}
                      trackColor={{ false: COLORS.cardAlt, true: COLORS.primaryLight }}
                      thumbColor={settings.quietHoursEnabled ? COLORS.primary : COLORS.textMuted}
                    />
                  }
                />
                {settings.quietHoursEnabled && (
                  <>
                    <Divider />
                    <View style={s.quietRow}>
                      <Text style={s.quietLabel}>Silence from</Text>
                      <View style={s.hourPicker}>
                        <TouchableOpacity onPress={() => adjustQuietHour('quietHoursStart', -1)} style={s.hourBtn}>
                          <Ionicons name="chevron-back" size={14} color={COLORS.primary} />
                        </TouchableOpacity>
                        <Text style={s.hourVal}>{hourLabel(quietStartH)}</Text>
                        <TouchableOpacity onPress={() => adjustQuietHour('quietHoursStart', 1)} style={s.hourBtn}>
                          <Ionicons name="chevron-forward" size={14} color={COLORS.primary} />
                        </TouchableOpacity>
                      </View>
                      <Text style={s.quietLabel}>to</Text>
                      <View style={s.hourPicker}>
                        <TouchableOpacity onPress={() => adjustQuietHour('quietHoursEnd', -1)} style={s.hourBtn}>
                          <Ionicons name="chevron-back" size={14} color={COLORS.primary} />
                        </TouchableOpacity>
                        <Text style={s.hourVal}>{hourLabel(quietEndH)}</Text>
                        <TouchableOpacity onPress={() => adjustQuietHour('quietHoursEnd', 1)} style={s.hourBtn}>
                          <Ionicons name="chevron-forward" size={14} color={COLORS.primary} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </>
                )}
              </>
            )}
          </View>

          {/* ── Voice Selection ───────────────────────────────────── */}
          <Text style={s.sectionLabel}>Voice Selection</Text>
          <View style={s.group}>
            {loadingVoice ? (
              <View style={s.voiceLoading}>
                <ActivityIndicator size="small" color={COLORS.primary} />
                <Text style={s.voiceLoadingText}>Loading voices…</Text>
              </View>
            ) : voices.length === 0 ? (
              <View style={s.row}>
                <Text style={s.rowSub}>No voices available on this device</Text>
              </View>
            ) : (
              voices.map((voice, i) => {
                const isSelected = settings.selectedVoiceId === voice.identifier;
                const isPreviewing = previewingId === voice.identifier;
                return (
                  <React.Fragment key={voice.identifier}>
                    {i > 0 && <Divider />}
                    <TouchableOpacity
                      style={s.voiceRow}
                      onPress={() => update({ selectedVoiceId: voice.identifier })}
                      activeOpacity={0.75}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={[s.rowLabel, isSelected && { color: COLORS.primary }]}>
                          {voice.name}
                        </Text>
                        <Text style={s.rowSub}>
                          {voice.language}
                          {voice.quality === 'Enhanced' ? '  ✦ Enhanced' : ''}
                        </Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => previewVoice(voice)}
                        style={[s.previewBtn, isPreviewing && { backgroundColor: COLORS.primaryLight }]}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        {isPreviewing
                          ? <ActivityIndicator size="small" color={COLORS.primary} />
                          : <Ionicons name="play-outline" size={16} color={COLORS.primary} />}
                      </TouchableOpacity>
                      {isSelected && (
                        <Ionicons name="checkmark-circle" size={20} color={COLORS.primary} style={{ marginLeft: 8 }} />
                      )}
                    </TouchableOpacity>
                  </React.Fragment>
                );
              })
            )}
          </View>

          {/* ── Reminder Mode ─────────────────────────────────────── */}
          <Text style={s.sectionLabel}>Reminder Mode</Text>
          <View style={s.group}>
            {(REMINDER_MODES as readonly ReminderMode[]).map((mode, i) => (
              <React.Fragment key={mode}>
                {i > 0 && <Divider />}
                <TouchableOpacity style={s.row} onPress={() => update({ reminderMode: mode })}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.rowLabel}>{mode.charAt(0).toUpperCase() + mode.slice(1)}</Text>
                  </View>
                  {settings.reminderMode === mode && (
                    <Ionicons name="checkmark-circle" size={20} color={COLORS.primary} />
                  )}
                </TouchableOpacity>
              </React.Fragment>
            ))}
          </View>

          {/* ── Escalation Levels ─────────────────────────────────── */}
          <Text style={s.sectionLabel}>Escalation Levels</Text>
          <View style={s.group}>
            {ESCALATION_CONFIG.map((level, i) => (
              <React.Fragment key={level.label}>
                {i > 0 && <Divider />}
                <View style={s.escalationRow}>
                  <View style={[s.escalationDot, { backgroundColor: ESCALATION_COLORS[i] }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.rowLabel}>{level.label}</Text>
                    <Text style={s.rowSub}>Every {level.intervalMin} min</Text>
                  </View>
                </View>
              </React.Fragment>
            ))}
          </View>

          {/* ── Actions ───────────────────────────────────────────── */}
          <Text style={s.sectionLabel}>Actions</Text>
          <View style={s.group}>
            <TouchableOpacity
              style={s.row}
              onPress={() => {
                scheduleHourlyReminders(tasks).catch(console.error);
                speakText('Reminders refreshed.');
              }}
            >
              <Text style={s.rowLabel}>Refresh Reminders</Text>
              <Ionicons name="refresh-outline" size={18} color={COLORS.primary} />
            </TouchableOpacity>
            <Divider />
            <TouchableOpacity style={s.row} onPress={() => cancelAllNotifications()}>
              <Text style={[s.rowLabel, { color: COLORS.danger }]}>Clear All Notifications</Text>
              <Ionicons name="trash-outline" size={18} color={COLORS.danger} />
            </TouchableOpacity>
          </View>

          {/* ── Data Export ───────────────────────────────────────── */}
          <Text style={s.sectionLabel}>Data</Text>
          <View style={s.group}>
            <TouchableOpacity
              style={s.row}
              onPress={async () => {
                setExportLoading(true);
                try {
                  const payload = {
                    exportedAt: new Date().toISOString(),
                    tasks,
                    notes,
                    projects,
                  };
                  const json = JSON.stringify(payload, null, 2);
                  await Share.share({ message: json, title: 'Pieter Export' });
                } catch (e) {
                  Alert.alert('Export failed', 'Could not share data.');
                } finally {
                  setExportLoading(false);
                }
              }}
              disabled={exportLoading}
            >
              <Text style={s.rowLabel}>Export Data (JSON)</Text>
              {exportLoading
                ? <ActivityIndicator size="small" color={COLORS.primary} />
                : <Ionicons name="share-outline" size={18} color={COLORS.primary} />}
            </TouchableOpacity>
          </View>

          <View style={{ height: 110 }} />
        </ScrollView>
      </SafeAreaView>
    </BackgroundImage>
  );
}

const s = StyleSheet.create({
  safe:    { flex: 1 },
  scroll:  { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 8 },
  title:    { fontSize: 28, fontWeight: '800', color: COLORS.text, letterSpacing: -0.5, marginBottom: 2 },
  subtitle: { fontSize: 14, color: COLORS.textSub, marginBottom: 24 },
  sectionLabel: { fontSize: 12, fontWeight: '700', color: COLORS.textSub, letterSpacing: 1.0, textTransform: 'uppercase', marginBottom: 8, marginTop: 4 },
  nameInput: {
    fontSize: 14,
    color: COLORS.text,
    textAlign: 'right',
    minWidth: 120,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: COLORS.cardAlt,
    borderWidth: 1,
    borderColor: COLORS.surfaceBorder,
  },
  group: { backgroundColor: COLORS.card, borderRadius: 18, marginBottom: 24, ...CARD_SHADOW, overflow: 'hidden' },
  row:   { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
  rowLabel: { fontSize: 15, color: COLORS.text, fontWeight: '500' },
  rowSub:   { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },

  // Quiet hours
  quietRow:   { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 8, flexWrap: 'wrap' },
  quietLabel: { fontSize: 14, color: COLORS.textSub, fontWeight: '500' },
  hourPicker: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.primaryLight, borderRadius: 10, paddingHorizontal: 6, paddingVertical: 4 },
  hourBtn:    { padding: 4 },
  hourVal:    { fontSize: 13, fontWeight: '700', color: COLORS.primary, minWidth: 44, textAlign: 'center' },

  // Voice selection
  voiceLoading:     { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16 },
  voiceLoadingText: { fontSize: 14, color: COLORS.textMuted },
  voiceRow:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  previewBtn:   { width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.cardAlt, alignItems: 'center', justifyContent: 'center' },

  escalationRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  escalationDot: { width: 10, height: 10, borderRadius: 5, marginTop: 2 },
});
