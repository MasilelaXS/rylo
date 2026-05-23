import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import BackgroundImage from '../../src/components/BackgroundImage';
import EmptyState from '../../src/components/EmptyState';
import ProcrastinationHeatmap from '../../src/components/ProcrastinationHeatmap';
import StreaksCard from '../../src/components/StreaksCard';
import { useTaskStore } from '../../src/store/taskStore';
import type { Task } from '../../src/types';
import { ACCENT, CARD_SHADOW, CARD_SHADOW_SM, COLORS, PRIORITY_CONFIG } from '../../src/utils/constants';

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAY_ABBR = ['Su','Mo','Tu','We','Th','Fr','Sa'];

// ─── Mini calendar ────────────────────────────────────────────────────────────
function CalendarView({ tasks }: { tasks: Task[] }) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth()); // 0-indexed
  const [selectedDay, setSelectedDay] = useState<number | null>(today.getDate());

  // Build a map: "YYYY-MM-DD" -> Task[]
  const tasksByDay = useMemo(() => {
    const map: Record<string, Task[]> = {};
    for (const t of tasks) {
      if (t.status === 'cancelled') continue;
      const d = new Date(t.dueDate);
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      (map[key] = map[key] ?? []).push(t);
    }
    return map;
  }, [tasks]);

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
    setSelectedDay(null);
  };
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
    setSelectedDay(null);
  };

  // Days in month
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  // Day of week the 1st falls on (0=Sun)
  const firstDow = new Date(year, month, 1).getDay();
  // Build a 6×7 grid
  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const selectedKey = selectedDay !== null
    ? `${year}-${String(month+1).padStart(2,'0')}-${String(selectedDay).padStart(2,'0')}`
    : null;
  const selectedTasks = selectedKey ? (tasksByDay[selectedKey] ?? []) : [];

  return (
    <View>
      {/* Month nav */}
      <View style={c.calHeader}>
        <TouchableOpacity onPress={prevMonth} style={c.navBtn}>
          <Ionicons name="chevron-back" size={20} color={COLORS.primary} />
        </TouchableOpacity>
        <Text style={c.calTitle}>{MONTH_NAMES[month]} {year}</Text>
        <TouchableOpacity onPress={nextMonth} style={c.navBtn}>
          <Ionicons name="chevron-forward" size={20} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      {/* Day headers */}
      <View style={c.weekRow}>
        {DAY_ABBR.map(d => (
          <Text key={d} style={c.weekDay}>{d}</Text>
        ))}
      </View>

      {/* Calendar grid */}
      <View style={c.grid}>
        {cells.map((day, idx) => {
          if (!day) return <View key={`e${idx}`} style={c.dayCell} />;
          const key = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
          const dayTasks = tasksByDay[key] ?? [];
          const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
          const isSelected = day === selectedDay;
          const hasTasks = dayTasks.length > 0;
          return (
            <TouchableOpacity
              key={day}
              style={[c.dayCell, isSelected && c.dayCellSelected, isToday && !isSelected && c.dayCellToday]}
              onPress={() => setSelectedDay(day === selectedDay ? null : day)}
              activeOpacity={0.75}
            >
              <Text style={[c.dayNum, isSelected && c.dayNumSelected, isToday && !isSelected && c.dayNumToday]}>
                {day}
              </Text>
              {hasTasks && (
                <View style={c.dotRow}>
                  {dayTasks.slice(0, 3).map((t, di) => (
                    <View key={di} style={[c.dot, { backgroundColor: PRIORITY_CONFIG[t.priority].color }]} />
                  ))}
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Selected day tasks */}
      {selectedDay !== null && (
        <View style={c.dayDetail}>
          <Text style={c.dayDetailTitle}>
            {MONTH_NAMES[month]} {selectedDay}
            {selectedTasks.length > 0 ? ` — ${selectedTasks.length} task${selectedTasks.length > 1 ? 's' : ''}` : ' — No tasks'}
          </Text>
          {selectedTasks.length === 0 ? (
            <Text style={c.noTasks}>Free day!</Text>
          ) : (
            selectedTasks.map((t) => {
              const p = PRIORITY_CONFIG[t.priority];
              const time = new Date(t.dueDate).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
              return (
                <View key={t.id} style={c.taskRow}>
                  <View style={[c.taskDot, { backgroundColor: p.color }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={c.taskTitle}>{t.title}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={c.taskTime}>{time}</Text>
                      {t.location ? (
                        <>
                          <Ionicons name="location-outline" size={11} color={COLORS.textMuted} />
                          <Text style={c.taskTime} numberOfLines={1}>{t.location}</Text>
                        </>
                      ) : null}
                    </View>
                  </View>
                  <View style={[c.statusBadge, { backgroundColor: p.bg }]}>
                    <Text style={[c.statusText, { color: p.color }]}>{p.label}</Text>
                  </View>
                </View>
              );
            })
          )}
        </View>
      )}
    </View>
  );
}

// ─── Screen ──────────────────────────────────────────────────────────────────
export default function HistoryScreen() {
  const { tasks, loadAll } = useTaskStore();
  const [tab, setTab] = useState<'stats' | 'calendar'>('stats');

  useEffect(() => { loadAll(); }, []);

  const completed = tasks.filter((t) => t.status === 'completed');
  const avoidanceCount = tasks.filter((t) => t.snoozeCount > 0).length;
  const avoidanceScore = tasks.length > 0 ? Math.round((1 - avoidanceCount / tasks.length) * 100) : 100;
  const completionRate = tasks.length > 0 ? Math.round((completed.length / tasks.length) * 100) : 0;
  const totalSnoozes = tasks.reduce((sum, t) => sum + t.snoozeCount, 0);

  // ── Weekly bars (last 7 days) ────────────────────────────────────────────
  const weeklyBars = useMemo(() => {
    const bars: { label: string; done: number; total: number; rate: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i); d.setHours(0, 0, 0, 0);
      const end = new Date(d); end.setHours(23, 59, 59, 999);
      const dayTasks = tasks.filter((t) => t.dueDate >= d.getTime() && t.dueDate <= end.getTime());
      const done     = dayTasks.filter((t) => t.status === 'completed').length;
      bars.push({
        label: i === 0 ? 'Today' : DAY_ABBR[d.getDay()],
        done,
        total: dayTasks.length,
        rate: dayTasks.length > 0 ? done / dayTasks.length : 0,
      });
    }
    return bars;
  }, [tasks]);

  const maxBarTotal = Math.max(...weeklyBars.map((b) => b.total), 1);

  // ── Best / worst day of week ──────────────────────────────────────────────
  const dayStats = useMemo(() => {
    const stats = Array.from({ length: 7 }, (_, i) => ({ dow: i, done: 0, total: 0 }));
    for (const t of tasks) {
      const dow = new Date(t.dueDate).getDay();
      stats[dow].total++;
      if (t.status === 'completed') stats[dow].done++;
    }
    const withRate = stats.map((s) => ({ ...s, rate: s.total > 0 ? s.done / s.total : -1 }));
    const active = withRate.filter((s) => s.rate >= 0);
    if (active.length === 0) return null;
    const best  = active.reduce((a, b) => b.rate > a.rate ? b : a);
    const worst = active.reduce((a, b) => b.rate < a.rate ? b : a);
    return { best, worst };
  }, [tasks]);

  // ── 30-day heatmap ────────────────────────────────────────────────────────
  const heatmapData = useMemo(() => {
    const cells: { date: Date; count: number; doneCount: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i); d.setHours(0, 0, 0, 0);
      const end = new Date(d); end.setHours(23, 59, 59, 999);
      const dayTasks = tasks.filter((t) => t.dueDate >= d.getTime() && t.dueDate <= end.getTime());
      cells.push({ date: new Date(d), count: dayTasks.length, doneCount: dayTasks.filter((t) => t.status === 'completed').length });
    }
    return cells;
  }, [tasks]);

  // Average task age (created → completed)
  const avgAge = useMemo(() => {
    const ages = completed
      .filter((t) => t.completedAt && t.createdAt)
      .map((t) => (t.completedAt! - t.createdAt) / 86_400_000);
    if (!ages.length) return null;
    return ages.reduce((a, b) => a + b, 0) / ages.length;
  }, [completed]);

  const METRICS = [
    { label: 'Completion Rate', value: `${completionRate}%`, color: ACCENT.purple.color, bg: ACCENT.purple.bg },
    { label: 'Avoidance Score', value: String(avoidanceScore), color: avoidanceScore >= 70 ? COLORS.success : COLORS.danger, bg: avoidanceScore >= 70 ? ACCENT.green.bg : ACCENT.coral.bg },
    { label: 'Total Snoozes', value: String(totalSnoozes), color: ACCENT.peach.color, bg: ACCENT.peach.bg },
    { label: 'Completed', value: String(completed.length), color: COLORS.success, bg: ACCENT.green.bg },
  ];

  return (
    <BackgroundImage screen="history">
      <SafeAreaView style={s.safe}>
        <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
        <ScrollView style={s.scroll} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

          <Text style={s.title}>History</Text>

          {/* Segment control */}
          <View style={s.segWrap}>
            <TouchableOpacity
              style={[s.segBtn, tab === 'stats' && s.segBtnActive]}
              onPress={() => setTab('stats')}
              activeOpacity={0.8}
            >
              <Ionicons name="bar-chart-outline" size={15} color={tab === 'stats' ? COLORS.primary : COLORS.textSub} />
              <Text style={[s.segText, tab === 'stats' && s.segTextActive]}>Stats</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.segBtn, tab === 'calendar' && s.segBtnActive]}
              onPress={() => setTab('calendar')}
              activeOpacity={0.8}
            >
              <Ionicons name="calendar-outline" size={15} color={tab === 'calendar' ? COLORS.primary : COLORS.textSub} />
              <Text style={[s.segText, tab === 'calendar' && s.segTextActive]}>Calendar</Text>
            </TouchableOpacity>
          </View>

          {tab === 'stats' ? (
            <>
              <Text style={s.subtitle}>Your execution record</Text>
              <View style={s.metricGrid}>
                {METRICS.map((m) => (
                  <View key={m.label} style={[s.metricCard, { backgroundColor: m.bg }]}>
                    <Text style={[s.metricValue, { color: m.color }]}>{m.value}</Text>
                    <Text style={s.metricLabel}>{m.label}</Text>
                  </View>
                ))}
              </View>

              <StreaksCard refreshKey={tasks.length} />
              <ProcrastinationHeatmap tasks={tasks} />

              {/* Weekly completion bars */}
              <View style={[s.analyticsCard, CARD_SHADOW_SM]}>
                <Text style={s.analyticsTitle}>Last 7 Days</Text>
                <View style={s.barsRow}>
                  {weeklyBars.map((b, i) => (
                    <View key={i} style={s.barCol}>
                      <Text style={s.barRate}>{b.total > 0 ? `${Math.round(b.rate * 100)}%` : '—'}</Text>
                      <View style={s.barTrack}>
                        <View style={[s.barFill, { height: `${Math.round((b.total / maxBarTotal) * 100)}%`, backgroundColor: COLORS.surfaceBorder }]} />
                        <View style={[s.barFillDone, { height: `${Math.round((b.done / maxBarTotal) * 100)}%`, backgroundColor: b.rate >= 0.8 ? COLORS.success : COLORS.primary }]} />
                      </View>
                      <Text style={s.barLabel}>{b.label}</Text>
                      <Text style={s.barNum}>{b.done}/{b.total}</Text>
                    </View>
                  ))}
                </View>
              </View>

              {/* Best / worst day + avg age */}
              {dayStats && (
                <View style={s.insightsRow}>
                  <View style={[s.insightCard, { backgroundColor: ACCENT.green.bg, flex: 1 }]}>
                    <Ionicons name="trophy-outline" size={18} color={COLORS.success} />
                    <Text style={s.insightLabel}>Best Day</Text>
                    <Text style={[s.insightValue, { color: COLORS.success }]}>{DAY_ABBR[dayStats.best.dow]}</Text>
                    <Text style={s.insightSub}>{Math.round(dayStats.best.rate * 100)}% rate</Text>
                  </View>
                  <View style={[s.insightCard, { backgroundColor: ACCENT.coral.bg, flex: 1 }]}>
                    <Ionicons name="trending-down-outline" size={18} color={COLORS.danger} />
                    <Text style={s.insightLabel}>Worst Day</Text>
                    <Text style={[s.insightValue, { color: COLORS.danger }]}>{DAY_ABBR[dayStats.worst.dow]}</Text>
                    <Text style={s.insightSub}>{Math.round(dayStats.worst.rate * 100)}% rate</Text>
                  </View>
                  {avgAge !== null && (
                    <View style={[s.insightCard, { backgroundColor: ACCENT.purple.bg, flex: 1 }]}>
                      <Ionicons name="time-outline" size={18} color={ACCENT.purple.color} />
                      <Text style={s.insightLabel}>Avg Age</Text>
                      <Text style={[s.insightValue, { color: ACCENT.purple.color }]}>{avgAge < 1 ? '<1d' : `${avgAge.toFixed(1)}d`}</Text>
                      <Text style={s.insightSub}>task-to-done</Text>
                    </View>
                  )}
                </View>
              )}

              {/* 30-day heatmap */}
              <View style={[s.analyticsCard, CARD_SHADOW_SM]}>
                <Text style={s.analyticsTitle}>30-Day Activity</Text>
                <View style={s.heatmap}>
                  {heatmapData.map((cell, i) => {
                    const rate = cell.total > 0 ? cell.doneCount / cell.total : -1;
                    const bg = cell.total === 0
                      ? COLORS.surfaceBorder
                      : rate >= 0.8 ? COLORS.success
                      : rate >= 0.5 ? COLORS.primary
                      : rate >= 0 ? COLORS.primary + '60'
                      : COLORS.surfaceBorder;
                    return (
                      <View
                        key={i}
                        style={[s.heatCell, { backgroundColor: bg }]}
                        accessibilityLabel={`${cell.date.toLocaleDateString()}: ${cell.doneCount}/${cell.total}`}
                      />
                    );
                  })}
                </View>
                <View style={s.heatLegend}>
                  <View style={[s.heatCell, { backgroundColor: COLORS.surfaceBorder }]} />
                  <Text style={s.heatLegendText}>0</Text>
                  <View style={[s.heatCell, { backgroundColor: COLORS.primary + '60' }]} />
                  <Text style={s.heatLegendText}>Low</Text>
                  <View style={[s.heatCell, { backgroundColor: COLORS.primary }]} />
                  <Text style={s.heatLegendText}>Mid</Text>
                  <View style={[s.heatCell, { backgroundColor: COLORS.success }]} />
                  <Text style={s.heatLegendText}>High</Text>
                </View>
              </View>

              {completed.length === 0 ? (
                <EmptyState icon="checkmark-done-outline" title="No completed tasks yet" subtitle="Mark tasks complete to see history" />
              ) : (
                <>
                  <View style={s.sectionRow}>
                    <Ionicons name="checkmark-circle" size={16} color={COLORS.success} />
                    <Text style={s.sectionTitle}>Completed ({completed.length})</Text>
                  </View>
                  {completed.slice(0, 20).map((task) => {
                    const priority = PRIORITY_CONFIG[task.priority];
                    return (
                      <View key={task.id} style={s.historyCard}>
                        <View style={[s.priorityDot, { backgroundColor: priority.color }]} />
                        <View style={s.cardContent}>
                          <Text style={s.cardTitle}>{task.title}</Text>
                          {task.dueDate ? (
                            <Text style={s.cardDate}>
                              {new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </Text>
                          ) : null}
                          {task.location ? <Text style={s.cardLoc}>{task.location}</Text> : null}
                        </View>
                        <View style={[s.priorityBadge, { backgroundColor: priority.bg }]}>
                          <Text style={[s.priorityBadgeText, { color: priority.color }]}>{priority.label}</Text>
                        </View>
                      </View>
                    );
                  })}
                </>
              )}
            </>
          ) : (
            <View style={s.calCard}>
              <CalendarView tasks={tasks} />
            </View>
          )}

          <View style={{ height: 110 }} />
        </ScrollView>
      </SafeAreaView>
    </BackgroundImage>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe:    { flex: 1 },
  scroll:  { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 8 },
  title:   { fontSize: 28, fontWeight: '800', color: COLORS.text, letterSpacing: -0.5, marginBottom: 16 },
  subtitle:{ fontSize: 14, color: COLORS.textSub, marginBottom: 20 },

  // Segment control
  segWrap:       { flexDirection: 'row', backgroundColor: COLORS.cardAlt, borderRadius: 16, padding: 4, marginBottom: 20, ...CARD_SHADOW_SM },
  segBtn:        { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 9, borderRadius: 13 },
  segBtnActive:  { backgroundColor: COLORS.card, ...CARD_SHADOW_SM },
  segText:       { fontSize: 14, fontWeight: '600', color: COLORS.textSub },
  segTextActive: { color: COLORS.primary },

  // Stats
  metricGrid:  { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 28 },
  metricCard:  { width: '47%', borderRadius: 18, padding: 18, ...CARD_SHADOW_SM },
  metricValue: { fontSize: 32, fontWeight: '800', letterSpacing: -1, marginBottom: 4 },
  metricLabel: { fontSize: 12, color: COLORS.textSub, fontWeight: '600' },

  // History list
  sectionRow:  { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  sectionTitle:{ fontSize: 16, fontWeight: '700', color: COLORS.text },
  historyCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, borderRadius: 14, padding: 14, marginBottom: 8, gap: 12, ...CARD_SHADOW_SM },
  priorityDot: { width: 8, height: 8, borderRadius: 4, marginTop: 2 },
  cardContent: { flex: 1 },
  cardTitle:   { color: COLORS.text, fontSize: 14, fontWeight: '500' },
  cardDate:    { color: COLORS.textMuted, fontSize: 12, marginTop: 2 },
  cardLoc:     { color: COLORS.textMuted, fontSize: 11, marginTop: 2 },
  priorityBadge:    { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  priorityBadgeText:{ fontSize: 11, fontWeight: '700' },

  // Calendar wrapper card
  calCard: { backgroundColor: COLORS.card, borderRadius: 20, padding: 16, ...CARD_SHADOW },

  // Weekly bars
  analyticsCard: { backgroundColor: COLORS.card, borderRadius: 16, padding: 16, marginBottom: 16 },
  analyticsTitle: { fontSize: 14, fontWeight: '700', color: COLORS.text, marginBottom: 14 },
  barsRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 100 },
  barCol: { flex: 1, alignItems: 'center', gap: 3 },
  barTrack: { width: '100%', height: 72, borderRadius: 6, backgroundColor: COLORS.cardAlt, overflow: 'hidden', justifyContent: 'flex-end' },
  barFill: { position: 'absolute', bottom: 0, left: 0, right: 0, borderRadius: 6 },
  barFillDone: { borderRadius: 6, minHeight: 3 },
  barRate: { fontSize: 9, color: COLORS.textMuted, fontWeight: '600' },
  barLabel: { fontSize: 10, color: COLORS.textSub, fontWeight: '600' },
  barNum: { fontSize: 9, color: COLORS.textMuted },

  // Insights row
  insightsRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  insightCard: { borderRadius: 14, padding: 12, alignItems: 'center', gap: 4 },
  insightLabel: { fontSize: 11, color: COLORS.textSub, fontWeight: '600' },
  insightValue: { fontSize: 20, fontWeight: '800' },
  insightSub: { fontSize: 10, color: COLORS.textMuted },

  // Heatmap
  heatmap: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: 8 },
  heatCell: { width: 18, height: 18, borderRadius: 4 },
  heatLegend: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  heatLegendText: { fontSize: 11, color: COLORS.textMuted, marginRight: 6 },
});

// ─── Calendar styles ─────────────────────────────────────────────────────────
const c = StyleSheet.create({
  calHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  navBtn:    { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center' },
  calTitle:  { fontSize: 17, fontWeight: '700', color: COLORS.text },
  weekRow:   { flexDirection: 'row', marginBottom: 6 },
  weekDay:   { flex: 1, textAlign: 'center', fontSize: 12, fontWeight: '600', color: COLORS.textMuted },
  grid:      { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell:   { width: '14.28%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 2 },
  dayCellSelected: { backgroundColor: COLORS.primary, borderRadius: 10 },
  dayCellToday:    { backgroundColor: COLORS.primaryLight, borderRadius: 10 },
  dayNum:          { fontSize: 14, fontWeight: '500', color: COLORS.text },
  dayNumSelected:  { color: '#fff', fontWeight: '700' },
  dayNumToday:     { color: COLORS.primary, fontWeight: '700' },
  dotRow:    { flexDirection: 'row', gap: 2, marginTop: 2 },
  dot:       { width: 4, height: 4, borderRadius: 2 },

  // Day detail
  dayDetail:     { marginTop: 20, paddingTop: 16, borderTopWidth: 1, borderTopColor: COLORS.surfaceBorder },
  dayDetailTitle:{ fontSize: 15, fontWeight: '700', color: COLORS.text, marginBottom: 12 },
  noTasks:       { color: COLORS.textMuted, fontSize: 14, textAlign: 'center', paddingVertical: 8 },
  taskRow:       { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  taskDot:       { width: 10, height: 10, borderRadius: 5, marginTop: 2 },
  taskTitle:     { fontSize: 14, fontWeight: '600', color: COLORS.text, marginBottom: 2 },
  taskTime:      { fontSize: 12, color: COLORS.textMuted },
  statusBadge:   { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  statusText:    { fontSize: 11, fontWeight: '700' },
});
