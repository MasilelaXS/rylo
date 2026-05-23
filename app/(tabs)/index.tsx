import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
    ImageBackground,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import AddTaskModal from '../../src/components/AddTaskModal';
import BackgroundImage from '../../src/components/BackgroundImage';
import BriefingPlayer from '../../src/components/BriefingPlayer';
import EmptyState from '../../src/components/EmptyState';
import GlobalSearch from '../../src/components/GlobalSearch';
import TaskCard from '../../src/components/TaskCard';
import VoiceCaptureModal from '../../src/components/VoiceCaptureModal';
import { scheduleDailyBriefings, scheduleHourlyReminders, scheduleTaskReminder } from '../../src/notifications/notificationService';
import { useBackgroundStore } from '../../src/store/backgroundStore';
import { useProjectStore } from '../../src/store/projectStore';
import { useSettingsStore } from '../../src/store/settingsStore';
import { useTaskStore } from '../../src/store/taskStore';
import type { Task } from '../../src/types';
import { ACCENT, CARD_SHADOW, CARD_SHADOW_SM, COLORS, generateId } from '../../src/utils/constants';
import { speakMorningBriefing } from '../../src/voice/ttsService';

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

// ─── Category card ────────────────────────────────────────────────────────────
type AccentKey = { bg: string; color: string; border: string; text: string };

function CategoryCard({
  icon, title, subtitle, accent, onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  accent: AccentKey;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.78}
      style={[s.catCard, { backgroundColor: accent.bg, borderColor: accent.border }]}
    >
      <View style={[s.catIcon, { backgroundColor: accent.color + '28' }]}>
        <Ionicons name={icon} size={20} color={accent.color} />
      </View>
      <Text style={s.catTitle}>{title}</Text>
      <Text style={s.catSub}>{subtitle}</Text>
      <View style={s.catFooter}>
        <Text style={[s.catCta, { color: accent.color }]}>View</Text>
        <Ionicons name="arrow-forward-outline" size={12} color={accent.color} />
      </View>
    </TouchableOpacity>
  );
}

// ─── Screen ──────────────────────────────────────────────────────────────────
export default function DashboardScreen() {
  const { todayTasks, overdueTasks, loadAll, addTask, markComplete, snoozeTask, getDailyStats, getWeeklyBars, getAvoidanceTasks, getEstimatedMinutesToday } =
    useTaskStore();
  const { projects, loadAll: loadProjects } = useProjectStore();
  const { settings } = useSettingsStore();
  const { backgrounds, fetchBackground } = useBackgroundStore();
  const [showAddModal, setShowAddModal] = useState(false);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [showVoice, setShowVoice] = useState(false);
  const { editTask: saveEditedTask, removeTask } = useTaskStore();
  const insets = useSafeAreaInsets();
  const fabBottom = Math.max(insets.bottom, 8) + 14 + 68 + 16;
  const router = useRouter();

  useEffect(() => {
    loadAll().then(() => {
      const { tasks } = useTaskStore.getState();
      scheduleHourlyReminders(tasks).catch(console.error);
      scheduleDailyBriefings(tasks).catch(console.error);
    });
    loadProjects();
    fetchBackground('dashboard');
  }, []);

  const stats = getDailyStats();
  const weeklyBars = getWeeklyBars();
  const avoidanceTasks = getAvoidanceTasks();
  const estimatedMinutes = getEstimatedMinutesToday();
  const completionPct = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;
  const snoozedCount = todayTasks.filter((t) => t.status === 'snoozed').length;
  const streak = settings.currentStreak ?? 0;
  const heroBg = backgrounds['dashboard'];
  const heroImageUri = heroBg?.src?.large2x ?? heroBg?.src?.large ?? heroBg?.src?.medium ?? null;

  function formatWorkload(mins: number): string {
    if (!mins) return '';
    if (mins < 60) return `${mins}m of work`;
    const h = Math.floor(mins / 60); const r = mins % 60;
    return r ? `${h}h ${r}m of work` : `${h}h of work`;
  }

  const handleAddTask = async (
    taskData: Omit<Task, 'id' | 'createdAt' | 'escalationLevel' | 'snoozeCount'>
  ) => {
    const task: Task = {
      ...taskData,
      id: generateId(),
      createdAt: Date.now(),
      escalationLevel: 0,
      snoozeCount: 0,
    };
    await addTask(task);
    await scheduleTaskReminder(task);
    scheduleHourlyReminders(useTaskStore.getState().tasks).catch(console.error);
  };

  const handleEditTask = async (
    taskData: Omit<Task, 'id' | 'createdAt' | 'escalationLevel' | 'snoozeCount'>
  ) => {
    if (!editTask) return;
    await saveEditedTask({ ...taskData, id: editTask.id });
    setEditTask(null);
    scheduleHourlyReminders(useTaskStore.getState().tasks).catch(console.error);
  };

  const handleDeleteTask = async (id: string) => {
    await removeTask(id);
    setEditTask(null);
  };

  const progressColor =
    completionPct >= 80 ? COLORS.success : completionPct >= 40 ? COLORS.primary : COLORS.primary;

  const CATEGORIES = [
    {
      icon: 'folder-open-outline' as keyof typeof Ionicons.glyphMap,
      title: 'Projects',
      subtitle: `${projects.length} active`,
      accent: ACCENT.peach,
      onPress: () => router.push('/(tabs)/projects'),
    },
    {
      icon: 'calendar-outline' as keyof typeof Ionicons.glyphMap,
      title: 'Calendar',
      subtitle: 'Your record',
      accent: ACCENT.purple,
      onPress: () => router.push('/(tabs)/calendar'),
    },
    {
      icon: 'mic-outline' as keyof typeof Ionicons.glyphMap,
      title: 'Assistant',
      subtitle: 'Voice control',
      accent: ACCENT.pink,
      onPress: () => router.push('/(tabs)/assistant'),
    },
    {
      icon: 'alert-circle-outline' as keyof typeof Ionicons.glyphMap,
      title: 'Overdue',
      subtitle: `${overdueTasks.length} task${overdueTasks.length !== 1 ? 's' : ''}`,
      accent: ACCENT.coral,
      onPress: () => {},
    },
    {
      icon: 'chatbubbles-outline' as keyof typeof Ionicons.glyphMap,
      title: 'Communication',
      subtitle: 'Logs & follow-ups',
      accent: ACCENT.blue,
      onPress: () => router.push('/(tabs)/communication'),
    },
  ];

  return (
    <BackgroundImage screen="dashboard">
      <SafeAreaView style={s.safe}>
        <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
        <ScrollView style={s.scroll} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

          {/* ── Header ─────────────────────────────────────────────── */}
          <View style={s.header}>
            <View>
              <Text style={s.greeting}>{getGreeting()} 👋</Text>
              <Text style={s.date}>
                {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </Text>
            </View>
            <View style={s.headerActions}>
              <TouchableOpacity
                style={s.iconBtn}
                onPress={() => setShowSearch(true)}
              >
                <Ionicons name="search-outline" size={21} color={COLORS.text} />
              </TouchableOpacity>
              <TouchableOpacity
                style={s.iconBtn}
                onPress={() => setShowVoice(true)}
              >
                <Ionicons name="mic-outline" size={21} color={COLORS.text} />
              </TouchableOpacity>
              <TouchableOpacity
                style={s.iconBtn}
                onPress={() => settings.voiceEnabled && speakMorningBriefing(stats.total, stats.overdue)}
              >
                <Ionicons name="notifications-outline" size={21} color={COLORS.text} />
              </TouchableOpacity>
              <TouchableOpacity
                style={s.iconBtn}
                onPress={() => router.push('/(tabs)/settings')}
              >
                <Ionicons name="settings-outline" size={21} color={COLORS.text} />
              </TouchableOpacity>
            </View>
          </View>

          {/* ── Streak Banner ───────────────────────────────────────── */}
          {streak > 0 && (
            <View style={[s.streakBanner, CARD_SHADOW_SM]}>
              <Text style={s.streakEmoji}>{streak >= 7 ? '🔥' : streak >= 3 ? '⚡' : '✨'}</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.streakTitle}>{streak}-day streak</Text>
                <Text style={s.streakSub}>
                  {streak >= 7 ? 'On fire! Keep it up!' : streak >= 3 ? 'Building momentum!' : 'Great start!'}
                  {settings.longestStreak > streak ? `  Best: ${settings.longestStreak}` : ' 🏆 Personal best!'}
                </Text>
              </View>
              <View style={s.streakBadge}>
                <Text style={s.streakBadgeText}>{streak}</Text>
              </View>
            </View>
          )}

          <BriefingPlayer />

          {/* ── Progress Hero ───────────────────────────────────────── */}
          <ImageBackground
            source={heroImageUri ? { uri: heroImageUri } : undefined}
            style={[s.heroCard, CARD_SHADOW]}
            resizeMode="cover"
          >
            <View style={s.heroOverlay}>
              <View style={s.heroTop}>
                <View style={{ flex: 1 }}>
                  <Text style={s.heroLabel}>YOUR PROGRESS</Text>
                  <Text style={[s.heroPct, { color: '#fff' }]}>{completionPct}%</Text>
                  <Text style={s.heroDate}>
                    {new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'long' })}
                  </Text>
                </View>
                <View style={[s.circleWrap, { borderColor: 'rgba(255,255,255,0.2)' }]}>
                  <Text style={[s.circleNum, { color: progressColor }]}>{stats.total}</Text>
                  <Text style={s.circleLabel}>Tasks</Text>
                </View>
              </View>
              <View style={s.progressTrack}>
                <LinearGradient
                  colors={completionPct >= 80 ? ['#2ECC9A', '#17A073'] : [COLORS.primary, COLORS.primaryDark]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[s.progressFill, { width: `${Math.max(completionPct, 3)}%` as any }]}
                />
              </View>
              <Text style={s.heroMeta}>
                {stats.completed} done · {stats.pending} pending
                {stats.overdue > 0 ? ` · ${stats.overdue} overdue` : ''}
                {estimatedMinutes > 0 ? `  ·  ~${formatWorkload(estimatedMinutes)}` : ''}
              </Text>
            </View>
          </ImageBackground>

          {/* ── Stat Chips ──────────────────────────────────────────── */}
          <View style={s.statsRow}>
            {[
              { label: 'Total',   value: stats.total,     color: COLORS.primary },
              { label: 'Done',    value: stats.completed, color: COLORS.success },
              { label: 'Overdue', value: stats.overdue,   color: COLORS.danger  },
              { label: 'Snoozed', value: snoozedCount,    color: COLORS.warning },
            ].map((chip) => (
              <View key={chip.label} style={[s.chip, CARD_SHADOW_SM]}>
                <Text style={[s.chipValue, { color: chip.color }]}>{chip.value}</Text>
                <Text style={s.chipLabel}>{chip.label}</Text>
              </View>
            ))}
          </View>

          {/* ── Weekly Chart ────────────────────────────────────────── */}
          <View style={[s.weeklyCard, CARD_SHADOW_SM]}>
            <Text style={s.weeklyTitle}>This Week</Text>
            <View style={s.weeklyBars}>
              {weeklyBars.map((bar, i) => {
                const pct = bar.total > 0 ? bar.completed / bar.total : 0;
                const isToday = i === 6;
                return (
                  <View key={i} style={s.weeklyBarCol}>
                    <View style={s.weeklyBarTrack}>
                      <View style={[
                        s.weeklyBarFill,
                        { height: `${Math.max(pct * 100, bar.total > 0 ? 6 : 0)}%` as any },
                        isToday && { backgroundColor: COLORS.primary },
                        pct >= 1 && { backgroundColor: COLORS.success },
                      ]} />
                    </View>
                    <Text style={[s.weeklyBarLabel, isToday && { color: COLORS.primary, fontWeight: '700' }]}>
                      {bar.label}
                    </Text>
                    {bar.total > 0 && (
                      <Text style={s.weeklyBarCount}>{bar.completed}/{bar.total}</Text>
                    )}
                  </View>
                );
              })}
            </View>
          </View>

          {/* ── Quick Access grid ───────────────────────────────────── */}
          <Text style={s.sectionHeader}>Quick Access</Text>
          <View style={s.catGrid}>
            {CATEGORIES.map((cat) => <CategoryCard key={cat.title} {...cat} />)}
          </View>

          {/* ── Today's Tasks ───────────────────────────────────────── */}
          <View style={s.sectionRow}>
            <Text style={s.sectionHeader}>Today</Text>
            <View style={[s.badge, { backgroundColor: COLORS.primaryLight }]}>
              <Text style={[s.badgeText, { color: COLORS.primary }]}>{todayTasks.length}</Text>
            </View>
          </View>

          {todayTasks.length === 0 ? (
            <EmptyState
              icon="sunny-outline"
              title="Free today!"
              subtitle="Nothing scheduled — add a task or enjoy the day"
              accent={COLORS.warning}
            />
          ) : (
            todayTasks.map((t) => (
              <TaskCard key={t.id} task={t} onComplete={markComplete} onSnooze={snoozeTask} onPress={(task) => setEditTask(task)} />
            ))
          )}

          {/* ── Overdue ─────────────────────────────────────────────── */}
          {overdueTasks.length > 0 && (
            <>
              <View style={[s.sectionRow, { marginTop: 18 }]}>
                <Text style={[s.sectionHeader, { color: COLORS.danger }]}>Overdue</Text>
                <View style={[s.badge, { backgroundColor: COLORS.dangerLight }]}>
                  <Text style={[s.badgeText, { color: COLORS.danger }]}>{overdueTasks.length}</Text>
                </View>
              </View>
              {overdueTasks.slice(0, 3).map((t) => (
                <TaskCard key={t.id} task={t} onComplete={markComplete} onSnooze={snoozeTask} onPress={(task) => setEditTask(task)} />
              ))}
            </>
          )}

          {/* ── Avoidance Watch ─────────────────────────────────────── */}
          {avoidanceTasks.length > 0 && (
            <>
              <View style={[s.sectionRow, { marginTop: 18 }]}>
                <Ionicons name="eye-outline" size={16} color={COLORS.warning} />
                <Text style={[s.sectionHeader, { color: COLORS.warning }]}>Avoidance Watch</Text>
                <View style={[s.badge, { backgroundColor: COLORS.warningLight }]}>
                  <Text style={[s.badgeText, { color: COLORS.warning }]}>{avoidanceTasks.length}</Text>
                </View>
              </View>
              <View style={[s.avoidanceBanner, CARD_SHADOW_SM]}>
                <Ionicons name="warning-outline" size={16} color={COLORS.warning} />
                <Text style={s.avoidanceBannerText}>
                  These tasks keep getting ignored. Each day they stay unresolved, they&apos;ll escalate further.
                </Text>
              </View>
              {avoidanceTasks.slice(0, 3).map((t) => (
                <TaskCard key={t.id} task={t} onComplete={markComplete} onSnooze={snoozeTask} onPress={(task) => setEditTask(task)} />
              ))}
            </>
          )}

          <View style={{ height: 110 }} />
        </ScrollView>

        {/* ── FAB ─────────────────────────────────────────────────── */}
        <TouchableOpacity style={[s.fab, { bottom: fabBottom }]} onPress={() => setShowAddModal(true)} activeOpacity={0.85}>
          <LinearGradient colors={[COLORS.primary, COLORS.primaryDark]} style={s.fabGradient}>
            <Ionicons name="add" size={28} color="#fff" />
          </LinearGradient>
        </TouchableOpacity>

        <AddTaskModal
          visible={showAddModal}
          onClose={() => setShowAddModal(false)}
          onSave={handleAddTask}
          projects={projects}
        />
        <AddTaskModal
          visible={!!editTask}
          onClose={() => setEditTask(null)}
          onSave={handleEditTask}
          projects={projects}
          initialTask={editTask ?? undefined}
          onDelete={handleDeleteTask}
        />
        <GlobalSearch visible={showSearch} onClose={() => setShowSearch(false)} />
        <VoiceCaptureModal visible={showVoice} onClose={() => setShowVoice(false)} />
      </SafeAreaView>
    </BackgroundImage>
  );
}

const s = StyleSheet.create({
  safe:    { flex: 1 },
  scroll:  { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 8 },

  // ── Header
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, marginTop: 4 },
  headerActions: { flexDirection: 'row', gap: 10 },
  greeting: { fontSize: 22, fontWeight: '700', color: COLORS.text },
  date:     { fontSize: 13, color: COLORS.textSub, marginTop: 3 },
  iconBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: COLORS.card,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#E8EAF0',
  },

  // ── Hero card
  heroCard: { borderRadius: 20, marginBottom: 14, overflow: 'hidden', backgroundColor: '#1A1D2E' },
  heroOverlay: { padding: 20, backgroundColor: 'rgba(15, 17, 35, 0.62)' },
  heroTop:  { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16 },
  heroLabel: { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.5)', letterSpacing: 1.4, marginBottom: 4 },
  heroPct:  { fontSize: 52, fontWeight: '800', letterSpacing: -2, lineHeight: 56 },
  heroDate: { fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 6 },
  circleWrap: {
    width: 72, height: 72, borderRadius: 36,
    borderWidth: 2, alignItems: 'center', justifyContent: 'center',
    marginTop: 4, marginLeft: 12,
  },
  circleNum:   { fontSize: 22, fontWeight: '800', color: COLORS.text, lineHeight: 24 },
  circleLabel: { fontSize: 9,  fontWeight: '600', color: 'rgba(255,255,255,0.5)', letterSpacing: 0.4 },
  progressTrack: { height: 8, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 4, overflow: 'hidden', marginBottom: 10 },
  progressFill:  { height: 8, borderRadius: 4 },
  heroMeta:  { fontSize: 12, color: 'rgba(255,255,255,0.5)' },

  // ── Stat chips
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 22 },
  chip:     { flex: 1, backgroundColor: COLORS.card, borderRadius: 14, paddingVertical: 12, alignItems: 'center' },
  chipValue: { fontSize: 20, fontWeight: '800', lineHeight: 22 },
  chipLabel: { fontSize: 10, color: COLORS.textMuted, marginTop: 3, letterSpacing: 0.3 },

  // ── Category grid
  sectionHeader: { fontSize: 16, fontWeight: '700', color: COLORS.text, marginBottom: 12 },
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 24 },
  catCard: { width: '47%', borderRadius: 18, padding: 16, borderWidth: 1 },
  catIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  catTitle: { color: COLORS.text, fontSize: 14, fontWeight: '700', marginBottom: 3 },
  catSub:   { color: COLORS.textSub, fontSize: 12, lineHeight: 16, marginBottom: 14 },
  catFooter: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  catCta:    { fontSize: 12, fontWeight: '700' },

  // ── Section row
  sectionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  badgeText: { fontSize: 12, fontWeight: '700' },

  // ── Streak banner
  streakBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.card, borderRadius: 16,
    padding: 14, marginBottom: 14,
  },
  streakEmoji: { fontSize: 28 },
  streakTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  streakSub:   { fontSize: 12, color: COLORS.textSub, marginTop: 1 },
  streakBadge: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: '#FFF3DC',
    alignItems: 'center', justifyContent: 'center',
  },
  streakBadgeText: { fontSize: 18, fontWeight: '800', color: '#F59E0B' },

  // ── Weekly chart
  weeklyCard: {
    backgroundColor: COLORS.card, borderRadius: 16,
    padding: 16, marginBottom: 22,
  },
  weeklyTitle: { fontSize: 12, fontWeight: '700', color: COLORS.textMuted, letterSpacing: 0.8, marginBottom: 12, textTransform: 'uppercase' },
  weeklyBars: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 80 },
  weeklyBarCol: { flex: 1, alignItems: 'center', gap: 4 },
  weeklyBarTrack: {
    flex: 1, width: '100%', backgroundColor: COLORS.bg,
    borderRadius: 4, overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  weeklyBarFill: {
    width: '100%', borderRadius: 4,
    backgroundColor: COLORS.primaryLight,
    minHeight: 0,
  },
  weeklyBarLabel: { fontSize: 10, color: COLORS.textMuted, fontWeight: '500' },
  weeklyBarCount: { fontSize: 9, color: COLORS.textMuted },

  // ── Avoidance section
  avoidanceBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: COLORS.warningLight, borderRadius: 12,
    padding: 12, marginBottom: 10,
  },
  avoidanceBannerText: { flex: 1, color: COLORS.textSub, fontSize: 12, lineHeight: 17 },

  // ── FAB
  fab: {
    position: 'absolute', right: 20,
  },
  fabGradient: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
});
