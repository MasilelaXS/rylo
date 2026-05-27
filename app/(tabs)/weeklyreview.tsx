import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { friendlyAiError, generateWeeklyReview } from '../../src/services/aiService';
import { buildAvoidanceByCategory } from '../../src/services/heatmapService';
import { toIsoDate, useHabitStore } from '../../src/store/habitStore';
import { useNoteStore } from '../../src/store/noteStore';
import { useSettingsStore } from '../../src/store/settingsStore';
import { useTaskStore } from '../../src/store/taskStore';
import { CARD_SHADOW, COLORS, generateId } from '../../src/utils/constants';

// ─── Helpers ─────────────────────────────────────────────────────────────────
const DAY_ABBR = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTH_NAMES = [
  'Jan','Feb','Mar','Apr','May','Jun',
  'Jul','Aug','Sep','Oct','Nov','Dec',
];

const CATEGORY_LABELS: Record<string, string> = {
  communication: 'Communication',
  deep_work:     'Deep Work',
  admin:         'Admin',
  personal:      'Personal',
  general:       'General',
};

const CATEGORY_COLORS: Record<string, string> = {
  communication: '#6B7CFF',
  deep_work:     '#FF9A56',
  admin:         '#2ECC9A',
  personal:      '#FF7DA0',
  general:       '#1E90FF',
};

function weekStart(): Date {
  const d = new Date();
  d.setDate(d.getDate() - 6); // last 7 days ending today
  d.setHours(0, 0, 0, 0);
  return d;
}

// ─── Mini bar component ───────────────────────────────────────────────────────
function DayBar({
  label,
  done,
  total,
  maxTotal,
}: {
  label: string;
  done: number;
  total: number;
  maxTotal: number;
}) {
  const rate = total > 0 ? done / total : 0;
  const heightPct = maxTotal > 0 ? (total / maxTotal) * 100 : 0;
  const donePct   = maxTotal > 0 ? (done  / maxTotal) * 100 : 0;
  const color = rate >= 0.8 ? COLORS.success : rate >= 0.5 ? COLORS.primary : COLORS.warning;

  return (
    <View style={bar.col}>
      <Text style={bar.rate}>{total > 0 ? `${Math.round(rate * 100)}%` : '—'}</Text>
      <View style={bar.track}>
        <View style={[bar.bg, { height: `${heightPct}%` as any }]} />
        <View style={[bar.fill, { height: `${donePct}%` as any, backgroundColor: color }]} />
      </View>
      <Text style={bar.label}>{label}</Text>
      <Text style={bar.counts}>{done}/{total}</Text>
    </View>
  );
}

const bar = StyleSheet.create({
  col:    { flex: 1, alignItems: 'center', gap: 4 },
  rate:   { fontSize: 10, color: COLORS.textMuted, fontWeight: '600' },
  track:  { width: 24, height: 80, backgroundColor: COLORS.cardAlt, borderRadius: 6, overflow: 'hidden', justifyContent: 'flex-end', position: 'relative' },
  bg:     { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#E8EAF0', borderRadius: 6 },
  fill:   { position: 'absolute', bottom: 0, left: 0, right: 0, borderRadius: 6 },
  label:  { fontSize: 11, color: COLORS.textSub, fontWeight: '600' },
  counts: { fontSize: 10, color: COLORS.textMuted },
});

// ─── Screen ──────────────────────────────────────────────────────────────────
export default function WeeklyReviewScreen() {
  const { tasks, loadAll }                = useTaskStore();
  const { habits, loadAll: loadHabits }  = useHabitStore();
  const { addNote }                      = useNoteStore();
  const { settings }                     = useSettingsStore();
  const router                           = useRouter();

  const [aiInsight,      setAiInsight]      = useState('');
  const [aiLoading,      setAiLoading]      = useState(false);
  const [reflection,     setReflection]     = useState('');
  const [savingNote,     setSavingNote]     = useState(false);

  useEffect(() => { loadAll(); loadHabits(); }, []);

  // ── Compute week bounds ────────────────────────────────────────────────────
  const { weekStartMs, weekEndMs, weekRangeLabel } = useMemo(() => {
    const start = weekStart();
    const end   = new Date(); end.setHours(23, 59, 59, 999);
    const fmtDate = (d: Date) => `${MONTH_NAMES[d.getMonth()]} ${d.getDate()}`;
    return {
      weekStartMs:    start.getTime(),
      weekEndMs:      end.getTime(),
      weekRangeLabel: `${fmtDate(start)} – ${fmtDate(end)}, ${end.getFullYear()}`,
    };
  }, []);

  // ── Week tasks ─────────────────────────────────────────────────────────────
  const weekTasks = useMemo(
    () => tasks.filter((t) => t.dueDate >= weekStartMs && t.dueDate <= weekEndMs && t.status !== 'cancelled'),
    [tasks, weekStartMs, weekEndMs],
  );

  const completedCount = weekTasks.filter((t) => t.status === 'completed').length;
  const totalCount     = weekTasks.length;
  const completionRate = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  // ── Daily bars ─────────────────────────────────────────────────────────────
  const dailyBars = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStartMs + i * 86_400_000);
      d.setHours(0, 0, 0, 0);
      const end = new Date(d); end.setHours(23, 59, 59, 999);
      const day   = tasks.filter((t) => t.dueDate >= d.getTime() && t.dueDate <= end.getTime() && t.status !== 'cancelled');
      const done  = day.filter((t) => t.status === 'completed').length;
      return { label: DAY_ABBR[d.getDay()], done, total: day.length };
    });
  }, [tasks, weekStartMs]);

  const maxBarTotal = Math.max(...dailyBars.map((b) => b.total), 1);

  // ── Category breakdown ─────────────────────────────────────────────────────
  const categoryRows = useMemo(() => {
    const map = new Map<string, { done: number; total: number }>();
    for (const t of weekTasks) {
      const cat = t.category ?? 'general';
      const cur = map.get(cat) ?? { done: 0, total: 0 };
      cur.total++;
      if (t.status === 'completed') cur.done++;
      map.set(cat, cur);
    }
    return Array.from(map.entries())
      .map(([cat, v]) => ({
        cat,
        label: CATEGORY_LABELS[cat] ?? cat,
        color: CATEGORY_COLORS[cat] ?? COLORS.primary,
        done: v.done,
        total: v.total,
        rate: v.total > 0 ? v.done / v.total : 0,
      }))
      .sort((a, b) => b.total - a.total);
  }, [weekTasks]);

  const topCategory      = categoryRows.find((r) => r.rate >= 0.7)?.cat;
  const avoidanceRows    = useMemo(() => buildAvoidanceByCategory(weekTasks), [weekTasks]);
  const mostAvoided      = avoidanceRows.find((r) => r.total >= 2);

  // ── Habit summary ──────────────────────────────────────────────────────────
  const habitSummary = useMemo(() => {
    const weekDates = Array.from({ length: 7 }, (_, i) =>
      toIsoDate(new Date(weekStartMs + i * 86_400_000)),
    );
    return habits.map(({ habit, completedDates }) => ({
      name:         habit.name,
      icon:         habit.icon,
      color:        habit.color,
      doneThisWeek: weekDates.filter((d) => completedDates.has(d)).length,
    }));
  }, [habits, weekStartMs]);

  // ── Generate AI insights ───────────────────────────────────────────────────
  async function handleGenerateInsights() {
    setAiLoading(true);
    setAiInsight('');
    try {
      const text = await generateWeeklyReview({
        weekRange:            weekRangeLabel,
        completed:            completedCount,
        total:                totalCount,
        completionRate,
        mostAvoidedCategory:  mostAvoided?.tag,
        avoidanceRate:        mostAvoided?.rate,
        topCategory,
        habits:               habitSummary.map((h) => ({ name: h.name, doneThisWeek: h.doneThisWeek })),
        streak:               settings.currentStreak,
        userName:             settings.userName,
      });
      setAiInsight(text);
    } catch (e) {
      Alert.alert('AI Error', friendlyAiError(e));
    } finally {
      setAiLoading(false);
    }
  }

  // ── Save reflection as a note ─────────────────────────────────────────────
  async function handleSaveNote() {
    const body = [
      `## Week of ${weekRangeLabel}`,
      `**Tasks:** ${completedCount}/${totalCount} (${completionRate}%)`,
      aiInsight ? `\n### AI Insights\n${aiInsight}` : '',
      reflection.trim() ? `\n### My Reflection\n${reflection.trim()}` : '',
    ].filter(Boolean).join('\n');

    setSavingNote(true);
    try {
      await addNote({
        id:        generateId(),
        title:     `Weekly Review — ${weekRangeLabel}`,
        content:   body,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      Alert.alert('Saved', 'Weekly review saved to Notes.');
    } finally {
      setSavingNote(false);
    }
  }

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.bg} />
      <SafeAreaView style={s.safe} edges={['top']}>

        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="chevron-back" size={22} color={COLORS.primary} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={s.title}>Weekly Review</Text>
            <Text style={s.subtitle}>{weekRangeLabel}</Text>
          </View>
        </View>

        <ScrollView
          style={s.scroll}
          contentContainerStyle={s.content}
          showsVerticalScrollIndicator={false}
        >
          {/* Summary card */}
          <View style={s.summaryCard}>
            <View style={s.summaryRow}>
              <View style={s.summaryItem}>
                <Text style={s.summaryVal}>{completedCount}</Text>
                <Text style={s.summaryLabel}>Completed</Text>
              </View>
              <View style={s.sumDivider} />
              <View style={s.summaryItem}>
                <Text style={s.summaryVal}>{totalCount}</Text>
                <Text style={s.summaryLabel}>Scheduled</Text>
              </View>
              <View style={s.sumDivider} />
              <View style={s.summaryItem}>
                <Text style={[s.summaryVal, {
                  color: completionRate >= 80 ? COLORS.success
                       : completionRate >= 50 ? COLORS.primary
                       : COLORS.warning,
                }]}>
                  {completionRate}%
                </Text>
                <Text style={s.summaryLabel}>Rate</Text>
              </View>
              <View style={s.sumDivider} />
              <View style={s.summaryItem}>
                <Text style={s.summaryVal}>{settings.currentStreak}</Text>
                <Text style={s.summaryLabel}>Day Streak 🔥</Text>
              </View>
            </View>
          </View>

          {/* Daily bars */}
          <View style={s.card}>
            <Text style={s.cardTitle}>Daily Completions</Text>
            <View style={s.barsRow}>
              {dailyBars.map((b, i) => (
                <DayBar key={i} label={b.label} done={b.done} total={b.total} maxTotal={maxBarTotal} />
              ))}
            </View>
          </View>

          {/* Category breakdown */}
          {categoryRows.length > 0 && (
            <View style={s.card}>
              <Text style={s.cardTitle}>By Category</Text>
              {categoryRows.map((r) => (
                <View key={r.cat} style={s.catRow}>
                  <View style={[s.catDot, { backgroundColor: r.color }]} />
                  <Text style={s.catLabel}>{r.label}</Text>
                  <Text style={s.catCount}>{r.done}/{r.total}</Text>
                  <View style={s.catBarBg}>
                    <View style={[s.catBarFill, { width: `${Math.round(r.rate * 100)}%` as any, backgroundColor: r.color }]} />
                  </View>
                  <Text style={[s.catRate, { color: r.color }]}>{Math.round(r.rate * 100)}%</Text>
                </View>
              ))}
            </View>
          )}

          {/* Habits */}
          {habitSummary.length > 0 && (
            <View style={s.card}>
              <Text style={s.cardTitle}>Habits This Week</Text>
              {habitSummary.map((h) => (
                <View key={h.name} style={s.habitRow}>
                  <View style={[s.habitIcon, { backgroundColor: `${h.color}20` }]}>
                    <Ionicons name={h.icon as any} size={16} color={h.color} />
                  </View>
                  <Text style={s.habitName}>{h.name}</Text>
                  <View style={s.habitDots}>
                    {Array.from({ length: 7 }, (_, i) => (
                      <View
                        key={i}
                        style={[
                          s.habitDot,
                          i < h.doneThisWeek ? { backgroundColor: h.color } : s.habitDotEmpty,
                        ]}
                      />
                    ))}
                  </View>
                  <Text style={[s.habitCount, { color: h.doneThisWeek >= 5 ? COLORS.success : COLORS.textMuted }]}>
                    {h.doneThisWeek}/7
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* AI Insights */}
          <View style={s.card}>
            <View style={s.aiHeader}>
              <Ionicons name="sparkles" size={16} color="#9B8CFF" />
              <Text style={s.cardTitle}>AI Insights</Text>
            </View>
            {aiInsight ? (
              <Text style={s.aiText}>{aiInsight}</Text>
            ) : (
              <Text style={s.aiPlaceholder}>
                Tap below to get an honest AI analysis of your week based on all your data.
              </Text>
            )}
            <TouchableOpacity
              style={[s.aiBtn, aiLoading && s.aiBtnLoading]}
              onPress={handleGenerateInsights}
              disabled={aiLoading}
              activeOpacity={0.85}
            >
              {aiLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="flash" size={16} color="#fff" />
                  <Text style={s.aiBtnText}>{aiInsight ? 'Regenerate' : 'Generate Insights'}</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Reflection */}
          <View style={s.card}>
            <Text style={s.cardTitle}>My Reflection</Text>
            <TextInput
              style={s.reflectionInput}
              placeholder="What went well? What would you do differently next week?"
              placeholderTextColor={COLORS.textMuted}
              value={reflection}
              onChangeText={setReflection}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
            <TouchableOpacity
              style={[s.saveBtn, savingNote && s.saveBtnLoading]}
              onPress={handleSaveNote}
              disabled={savingNote}
              activeOpacity={0.85}
            >
              {savingNote ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="bookmark-outline" size={15} color="#fff" />
                  <Text style={s.saveBtnText}>Save to Notes</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  safe: { flex: 1 },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12,
  },
  backBtn:  { padding: 4 },
  title:    { fontSize: 22, fontWeight: '800', color: COLORS.text },
  subtitle: { fontSize: 13, color: COLORS.textMuted, marginTop: 1 },

  scroll:  { flex: 1 },
  content: { paddingHorizontal: 16, gap: 12, paddingBottom: 32 },

  // ── Summary card
  summaryCard: {
    backgroundColor: COLORS.card, borderRadius: 18, padding: 16, ...CARD_SHADOW,
  },
  summaryRow:  { flexDirection: 'row', alignItems: 'center' },
  summaryItem: { flex: 1, alignItems: 'center', gap: 4 },
  summaryVal:  { fontSize: 22, fontWeight: '800', color: COLORS.text },
  summaryLabel:{ fontSize: 11, color: COLORS.textMuted, fontWeight: '600', textAlign: 'center' },
  sumDivider:  { width: 1, height: 36, backgroundColor: COLORS.cardAlt },

  // ── Generic card
  card: {
    backgroundColor: COLORS.card, borderRadius: 18, padding: 16, ...CARD_SHADOW, gap: 10,
  },
  cardTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text },

  // ── Daily bars row
  barsRow: { flexDirection: 'row', gap: 4, alignItems: 'flex-end', marginTop: 4 },

  // ── Category rows
  catRow:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  catDot:   { width: 10, height: 10, borderRadius: 5 },
  catLabel: { width: 90, fontSize: 13, color: COLORS.text, fontWeight: '600' },
  catCount: { width: 32, fontSize: 12, color: COLORS.textMuted, textAlign: 'right' },
  catBarBg: { flex: 1, height: 6, borderRadius: 3, backgroundColor: COLORS.cardAlt, overflow: 'hidden' },
  catBarFill:{ height: '100%', borderRadius: 3 },
  catRate:  { width: 36, fontSize: 12, fontWeight: '700', textAlign: 'right' },

  // ── Habits
  habitRow:     { flexDirection: 'row', alignItems: 'center', gap: 8 },
  habitIcon:    { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  habitName:    { flex: 1, fontSize: 13, fontWeight: '600', color: COLORS.text },
  habitDots:    { flexDirection: 'row', gap: 3 },
  habitDot:     { width: 10, height: 10, borderRadius: 5 },
  habitDotEmpty:{ backgroundColor: COLORS.cardAlt, borderWidth: 1, borderColor: '#E0E2EB' },
  habitCount:   { width: 28, fontSize: 12, fontWeight: '700', textAlign: 'right' },

  // ── AI
  aiHeader:      { flexDirection: 'row', alignItems: 'center', gap: 6 },
  aiText:        { fontSize: 14, color: COLORS.text, lineHeight: 22 },
  aiPlaceholder: { fontSize: 13, color: COLORS.textMuted, lineHeight: 20 },
  aiBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#9B8CFF', borderRadius: 14, paddingVertical: 12,
  },
  aiBtnLoading: { opacity: 0.7 },
  aiBtnText:    { fontSize: 14, fontWeight: '700', color: '#fff' },

  // ── Reflection
  reflectionInput: {
    backgroundColor: COLORS.cardAlt,
    borderRadius: 12, padding: 12,
    fontSize: 14, color: COLORS.text, minHeight: 90,
    borderWidth: 1, borderColor: '#E8EAF0',
  },
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: COLORS.primary, borderRadius: 14, paddingVertical: 12,
  },
  saveBtnLoading: { opacity: 0.7 },
  saveBtnText:    { fontSize: 14, fontWeight: '700', color: '#fff' },
});
