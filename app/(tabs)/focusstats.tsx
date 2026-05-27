import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useProjectStore } from '../../src/store/projectStore';
import { useTaskStore } from '../../src/store/taskStore';
import type { Task } from '../../src/types';
import { CARD_SHADOW, CARD_SHADOW_SM, COLORS, PRIORITY_CONFIG } from '../../src/utils/constants';

// ─── Helpers ─────────────────────────────────────────────────────────────────
const MONTH_ABBR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function formatMinutes(m: number): string {
  if (m <= 0)   return '—';
  if (m < 60)   return `${m}m`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h}h ${r}m` : `${h}h`;
}

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

// ─── Bar component ────────────────────────────────────────────────────────────
function HBar({
  label,
  minutes,
  maxMinutes,
  color,
  sublabel,
}: {
  label: string;
  minutes: number;
  maxMinutes: number;
  color: string;
  sublabel?: string;
}) {
  const pct = maxMinutes > 0 ? (minutes / maxMinutes) * 100 : 0;
  return (
    <View style={b.row}>
      <Text style={b.label} numberOfLines={1}>{label}</Text>
      <View style={b.track}>
        <View style={[b.fill, { width: `${pct}%` as any, backgroundColor: color }]} />
      </View>
      <Text style={b.val}>{formatMinutes(minutes)}</Text>
    </View>
  );
}

const b = StyleSheet.create({
  row:   { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  label: { width: 100, fontSize: 12, color: COLORS.text, fontWeight: '600' },
  track: { flex: 1, height: 8, borderRadius: 4, backgroundColor: COLORS.cardAlt, overflow: 'hidden' },
  fill:  { height: '100%', borderRadius: 4 },
  val:   { width: 48, fontSize: 12, fontWeight: '700', color: COLORS.text, textAlign: 'right' },
});

// ─── Screen ──────────────────────────────────────────────────────────────────
type Scope = 'all' | 'week' | 'month';

export default function FocusStatsScreen() {
  const { tasks, loadAll }           = useTaskStore();
  const { projects, loadAll: loadPj } = useProjectStore();
  const router                       = useRouter();
  const [scope, setScope]            = useState<Scope>('all');

  useEffect(() => { loadAll(); loadPj(); }, []);

  // ── Filter tasks by scope ──────────────────────────────────────────────────
  const scopedTasks = useMemo((): Task[] => {
    const now   = Date.now();
    const day   = 86_400_000;
    if (scope === 'week')  return tasks.filter((t) => (t.completedAt ?? t.dueDate) >= now - 7  * day);
    if (scope === 'month') return tasks.filter((t) => (t.completedAt ?? t.dueDate) >= now - 30 * day);
    return tasks;
  }, [tasks, scope]);

  const tasksWithTime = useMemo(
    () => scopedTasks.filter((t) => (t.timeLoggedMinutes ?? 0) > 0),
    [scopedTasks],
  );

  // ── Totals ─────────────────────────────────────────────────────────────────
  const totalMinutes = useMemo(
    () => tasksWithTime.reduce((s, t) => s + (t.timeLoggedMinutes ?? 0), 0),
    [tasksWithTime],
  );

  const completedWithTime = tasksWithTime.filter((t) => t.status === 'completed');
  const avgPerTask = completedWithTime.length
    ? Math.round(completedWithTime.reduce((s, t) => s + (t.timeLoggedMinutes ?? 0), 0) / completedWithTime.length)
    : 0;

  // ── By project ─────────────────────────────────────────────────────────────
  const projectRows = useMemo(() => {
    const map = new Map<string, { name: string; color: string; minutes: number }>();
    for (const t of tasksWithTime) {
      const key  = t.projectId ?? '__none__';
      const proj = projects.find((p) => p.id === t.projectId);
      const cur  = map.get(key) ?? { name: proj?.name ?? 'No Project', color: proj?.color ?? COLORS.textMuted, minutes: 0 };
      cur.minutes += t.timeLoggedMinutes ?? 0;
      map.set(key, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.minutes - a.minutes).slice(0, 8);
  }, [tasksWithTime, projects]);

  const maxProjectMinutes = Math.max(...projectRows.map((r) => r.minutes), 1);

  // ── By category ────────────────────────────────────────────────────────────
  const categoryRows = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of tasksWithTime) {
      const cat = t.category ?? 'general';
      map.set(cat, (map.get(cat) ?? 0) + (t.timeLoggedMinutes ?? 0));
    }
    return Array.from(map.entries())
      .map(([cat, minutes]) => ({ cat, label: CATEGORY_LABELS[cat] ?? cat, color: CATEGORY_COLORS[cat] ?? COLORS.primary, minutes }))
      .sort((a, b) => b.minutes - a.minutes);
  }, [tasksWithTime]);

  const maxCategoryMinutes = Math.max(...categoryRows.map((r) => r.minutes), 1);

  // ── Top tasks ───────────────────────────────────────────────────────────────
  const topTasks = useMemo(
    () => [...tasksWithTime].sort((a, b) => (b.timeLoggedMinutes ?? 0) - (a.timeLoggedMinutes ?? 0)).slice(0, 10),
    [tasksWithTime],
  );
  const maxTaskMinutes = Math.max(...topTasks.map((t) => t.timeLoggedMinutes ?? 0), 1);

  // ── Weekly day breakdown (only for 'week' scope) ───────────────────────────
  const weekDayBars = useMemo(() => {
    if (scope !== 'week') return [];
    const now = Date.now();
    return Array.from({ length: 7 }, (_, i) => {
      const dayStart = now - (6 - i) * 86_400_000;
      const d        = new Date(dayStart); d.setHours(0, 0, 0, 0);
      const d2       = new Date(d);        d2.setHours(23, 59, 59, 999);
      const mins = tasks
        .filter((t) => {
          const ts = t.completedAt ?? t.dueDate;
          return ts >= d.getTime() && ts <= d2.getTime() && (t.timeLoggedMinutes ?? 0) > 0;
        })
        .reduce((s, t) => s + (t.timeLoggedMinutes ?? 0), 0);
      const DAY = ['Su','Mo','Tu','We','Th','Fr','Sa'];
      return { label: DAY[d.getDay()], minutes: mins };
    });
  }, [tasks, scope]);

  const maxDayMinutes = Math.max(...weekDayBars.map((d) => d.minutes), 1);

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
            <Text style={s.title}>Focus Stats</Text>
            <Text style={s.subtitle}>Time logged in focus sessions</Text>
          </View>
        </View>

        {/* Scope tabs */}
        <View style={s.scopeRow}>
          {(['all', 'month', 'week'] as Scope[]).map((sc) => {
            const labels: Record<Scope, string> = { all: 'All Time', month: 'This Month', week: 'This Week' };
            return (
              <TouchableOpacity
                key={sc}
                style={[s.scopeBtn, scope === sc && s.scopeBtnActive]}
                onPress={() => setScope(sc)}
                activeOpacity={0.8}
              >
                <Text style={[s.scopeText, scope === sc && s.scopeTextActive]}>{labels[sc]}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <ScrollView style={s.scroll} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

          {/* Summary cards */}
          <View style={s.summaryRow}>
            <View style={s.sumCard}>
              <Ionicons name="timer-outline" size={22} color={COLORS.primary} />
              <Text style={s.sumVal}>{formatMinutes(totalMinutes)}</Text>
              <Text style={s.sumLabel}>Total Focus</Text>
            </View>
            <View style={s.sumCard}>
              <Ionicons name="checkmark-circle-outline" size={22} color={COLORS.success} />
              <Text style={[s.sumVal, { color: COLORS.success }]}>{tasksWithTime.length}</Text>
              <Text style={s.sumLabel}>Tasks with Time</Text>
            </View>
            <View style={s.sumCard}>
              <Ionicons name="trending-up-outline" size={22} color={COLORS.warning} />
              <Text style={[s.sumVal, { color: COLORS.warning }]}>{formatMinutes(avgPerTask)}</Text>
              <Text style={s.sumLabel}>Avg per Task</Text>
            </View>
          </View>

          {/* No data state */}
          {tasksWithTime.length === 0 && (
            <View style={s.empty}>
              <Ionicons name="timer-outline" size={48} color={COLORS.textMuted} />
              <Text style={s.emptyTitle}>No focus time logged</Text>
              <Text style={s.emptySub}>
                Use the focus timer on any task card to start logging time. Stats will appear here.
              </Text>
            </View>
          )}

          {/* Daily bars (week scope only) */}
          {scope === 'week' && weekDayBars.length > 0 && totalMinutes > 0 && (
            <View style={s.card}>
              <Text style={s.cardTitle}>Daily Focus This Week</Text>
              <View style={s.dayBarRow}>
                {weekDayBars.map((d, i) => {
                  const pct  = maxDayMinutes > 0 ? (d.minutes / maxDayMinutes) * 100 : 0;
                  const isToday = i === weekDayBars.length - 1;
                  return (
                    <View key={i} style={s.dayBarCol}>
                      <Text style={s.dayBarVal}>{d.minutes > 0 ? formatMinutes(d.minutes) : ''}</Text>
                      <View style={s.dayBarTrack}>
                        <View style={[s.dayBarFill, { height: `${pct}%` as any, backgroundColor: isToday ? COLORS.primary : '#A8B5FF' }]} />
                      </View>
                      <Text style={[s.dayBarLabel, isToday && { color: COLORS.primary, fontWeight: '700' }]}>{d.label}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* By project */}
          {projectRows.length > 0 && (
            <View style={s.card}>
              <Text style={s.cardTitle}>By Project</Text>
              {projectRows.map((r) => (
                <HBar key={r.name} label={r.name} minutes={r.minutes} maxMinutes={maxProjectMinutes} color={r.color} />
              ))}
            </View>
          )}

          {/* By category */}
          {categoryRows.length > 0 && (
            <View style={s.card}>
              <Text style={s.cardTitle}>By Category</Text>
              {categoryRows.map((r) => (
                <HBar key={r.cat} label={r.label} minutes={r.minutes} maxMinutes={maxCategoryMinutes} color={r.color} />
              ))}
            </View>
          )}

          {/* Top tasks */}
          {topTasks.length > 0 && (
            <View style={s.card}>
              <Text style={s.cardTitle}>Top Tasks by Focus Time</Text>
              {topTasks.map((t, i) => {
                const p   = PRIORITY_CONFIG[t.priority];
                const pct = maxTaskMinutes > 0 ? ((t.timeLoggedMinutes ?? 0) / maxTaskMinutes) * 100 : 0;
                return (
                  <View key={t.id} style={s.taskRow}>
                    <Text style={s.taskRank}>#{i + 1}</Text>
                    <View style={{ flex: 1 }}>
                      <View style={s.taskTitleRow}>
                        <Text style={s.taskTitle} numberOfLines={1}>{t.title}</Text>
                        <Text style={[s.taskTime, { color: p.color }]}>{formatMinutes(t.timeLoggedMinutes)}</Text>
                      </View>
                      <View style={s.taskBarTrack}>
                        <View style={[s.taskBarFill, { width: `${pct}%` as any, backgroundColor: p.color }]} />
                      </View>
                      <Text style={s.taskMeta}>
                        {p.label}
                        {t.estimatedMinutes ? ` · Est. ${formatMinutes(t.estimatedMinutes)}` : ''}
                        {t.estimatedMinutes && (t.timeLoggedMinutes ?? 0) > 0
                          ? ` · ${Math.round(((t.timeLoggedMinutes ?? 0) / t.estimatedMinutes) * 100)}% of estimate`
                          : ''}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

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
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8,
  },
  backBtn:  { padding: 4 },
  title:    { fontSize: 22, fontWeight: '800', color: COLORS.text },
  subtitle: { fontSize: 12, color: COLORS.textMuted, marginTop: 1 },

  scopeRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 10 },
  scopeBtn: {
    flex: 1, paddingVertical: 8, borderRadius: 12,
    backgroundColor: COLORS.cardAlt, alignItems: 'center',
  },
  scopeBtnActive: { backgroundColor: COLORS.primaryLight },
  scopeText:      { fontSize: 12, fontWeight: '600', color: COLORS.textSub },
  scopeTextActive:{ color: COLORS.primary },

  scroll:  { flex: 1 },
  content: { paddingHorizontal: 16, gap: 12, paddingBottom: 40 },

  summaryRow: { flexDirection: 'row', gap: 10 },
  sumCard: {
    flex: 1, backgroundColor: COLORS.card, borderRadius: 16, padding: 14,
    alignItems: 'center', gap: 6, ...CARD_SHADOW_SM,
  },
  sumVal:   { fontSize: 18, fontWeight: '800', color: COLORS.text },
  sumLabel: { fontSize: 10, color: COLORS.textMuted, fontWeight: '600', textAlign: 'center' },

  card: {
    backgroundColor: COLORS.card, borderRadius: 18, padding: 16,
    ...CARD_SHADOW, gap: 10,
  },
  cardTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text },

  dayBarRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: 110 },
  dayBarCol: { flex: 1, alignItems: 'center', gap: 4 },
  dayBarVal: { fontSize: 9, color: COLORS.textMuted, fontWeight: '600' },
  dayBarTrack: { flex: 1, width: 24, backgroundColor: COLORS.cardAlt, borderRadius: 6, overflow: 'hidden', justifyContent: 'flex-end' },
  dayBarFill:  { width: '100%', borderRadius: 6 },
  dayBarLabel: { fontSize: 11, color: COLORS.textSub, fontWeight: '600' },

  taskRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 8 },
  taskRank:{ width: 28, fontSize: 12, color: COLORS.textMuted, fontWeight: '700', paddingTop: 2 },
  taskTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  taskTitle: { flex: 1, fontSize: 13, fontWeight: '600', color: COLORS.text },
  taskTime:  { fontSize: 13, fontWeight: '800', marginLeft: 8 },
  taskBarTrack: { height: 5, borderRadius: 3, backgroundColor: COLORS.cardAlt, overflow: 'hidden' },
  taskBarFill:  { height: '100%', borderRadius: 3 },
  taskMeta:  { fontSize: 11, color: COLORS.textMuted, marginTop: 3 },

  empty: { alignItems: 'center', paddingVertical: 48, gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: COLORS.textSub },
  emptySub:   { fontSize: 13, color: COLORS.textMuted, textAlign: 'center', lineHeight: 20, maxWidth: 280 },
});
