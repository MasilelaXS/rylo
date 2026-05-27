import { Ionicons } from '@expo/vector-icons';
import { useMemo, useRef, useState } from 'react';
import {
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import type { Task } from '../types';
import { COLORS, PRIORITY_CONFIG } from '../utils/constants';

interface Props {
  tasks: Task[];
  onPress: (task: Task) => void;
}

const DAY_W = 46;          // pixels per day column
const ROW_H = 52;          // pixels per task row
const HEADER_H = 36;       // date header height
const NAME_W = 120;        // fixed left name panel width
const VISIBLE_DAYS = 14;   // how many days to show in the window

const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAY_SHORT   = ['Su','Mo','Tu','We','Th','Fr','Sa'];

function buildDays(windowStart: Date, count: number): Date[] {
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(windowStart);
    d.setDate(windowStart.getDate() + i);
    d.setHours(0, 0, 0, 0);
    return d;
  });
}

export default function TimelineView({ tasks, onPress }: Props) {
  const today = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }, []);
  const [windowStart, setWindowStart] = useState(() => {
    const d = new Date(today);
    d.setDate(today.getDate() - 2); // show 2 days before today
    return d;
  });

  const days = useMemo(() => buildDays(windowStart, VISIBLE_DAYS), [windowStart]);
  const windowEnd = useMemo(() => {
    const d = new Date(days[days.length - 1]);
    d.setHours(23, 59, 59, 999);
    return d;
  }, [days]);

  const syncRef = useRef<ScrollView>(null);

  const prevWindow = () => {
    const d = new Date(windowStart);
    d.setDate(windowStart.getDate() - 7);
    setWindowStart(d);
  };
  const nextWindow = () => {
    const d = new Date(windowStart);
    d.setDate(windowStart.getDate() + 7);
    setWindowStart(d);
  };
  const jumpToday = () => {
    const d = new Date(today);
    d.setDate(today.getDate() - 2);
    setWindowStart(d);
  };

  // Filter tasks that have any overlap with the visible window
  const visibleTasks = useMemo(() => {
    const ws = windowStart.getTime();
    const we = windowEnd.getTime();
    return tasks
      .filter((t) => t.status !== 'cancelled')
      .filter((t) => {
        const start = Math.max(t.createdAt, ws);
        const end   = t.dueDate;
        return end >= ws && start <= we;
      })
      .sort((a, b) => a.dueDate - b.dueDate);
  }, [tasks, windowStart, windowEnd]);

  // Map day index → pixel offset from left edge of the timeline
  function dayToX(d: Date): number {
    const ws = windowStart.getTime();
    const diff = (d.getTime() - ws) / 86_400_000;
    return diff * DAY_W;
  }

  function taskBar(task: Task) {
    const ws = windowStart.getTime();
    const we = windowEnd.getTime();
    // Bar start: max(task created, window start), clamped to day boundary
    const rawStart = Math.max(task.createdAt, ws);
    const startDay = new Date(rawStart); startDay.setHours(0, 0, 0, 0);
    const startX = Math.max(0, dayToX(startDay));

    // Bar end: min(dueDate, window end)
    const rawEnd = Math.min(task.dueDate, we);
    const endDay = new Date(rawEnd); endDay.setHours(23, 59, 59, 999);
    const endX = Math.min(VISIBLE_DAYS * DAY_W, dayToX(endDay) + DAY_W);

    const width = Math.max(endX - startX, DAY_W * 0.5);
    return { left: startX, width };
  }

  const totalW = VISIBLE_DAYS * DAY_W;
  const p = PRIORITY_CONFIG;

  return (
    <View style={t.root}>
      {/* Navigation bar */}
      <View style={t.nav}>
        <TouchableOpacity style={t.navBtn} onPress={prevWindow}>
          <Ionicons name="chevron-back" size={16} color={COLORS.primary} />
        </TouchableOpacity>
        <TouchableOpacity onPress={jumpToday} style={t.navLabel}>
          <Text style={t.navLabelText}>
            {MONTH_SHORT[days[0].getMonth()]} {days[0].getDate()} –{' '}
            {MONTH_SHORT[days[VISIBLE_DAYS - 1].getMonth()]} {days[VISIBLE_DAYS - 1].getDate()},{' '}
            {days[0].getFullYear()}
          </Text>
          <View style={t.todayChip}>
            <Ionicons name="today-outline" size={11} color={COLORS.primary} />
            <Text style={t.todayChipText}>Today</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={t.navBtn} onPress={nextWindow}>
          <Ionicons name="chevron-forward" size={16} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      {/* Main grid */}
      <ScrollView style={t.scroll} showsVerticalScrollIndicator={false}>
        <View style={t.row}>
          {/* Fixed left name column header */}
          <View style={[t.nameCol, { height: HEADER_H }]}>
            <Text style={t.nameColHeader}>Task</Text>
          </View>

          {/* Scrollable date header */}
          <ScrollView
            ref={syncRef}
            horizontal
            scrollEnabled
            showsHorizontalScrollIndicator={false}
            style={{ flex: 1 }}
          >
            <View style={{ width: totalW, height: HEADER_H, flexDirection: 'row' }}>
              {days.map((d, i) => {
                const isToday = d.toDateString() === today.toDateString();
                return (
                  <View key={i} style={[t.dayHeader, { width: DAY_W }, isToday && t.dayHeaderToday]}>
                    <Text style={[t.dayHeaderDow, isToday && t.dayHeaderTodayText]}>{DAY_SHORT[d.getDay()]}</Text>
                    <Text style={[t.dayHeaderNum, isToday && t.dayHeaderTodayText]}>{d.getDate()}</Text>
                  </View>
                );
              })}
            </View>
          </ScrollView>
        </View>

        {/* Task rows */}
        {visibleTasks.length === 0 ? (
          <View style={t.empty}>
            <Ionicons name="calendar-outline" size={36} color={COLORS.textMuted} />
            <Text style={t.emptyText}>No tasks in this window</Text>
          </View>
        ) : (
          visibleTasks.map((task) => {
            const cfg = p[task.priority];
            const bar = taskBar(task);
            const isDone = task.status === 'completed';
            const isOverdue = task.dueDate < Date.now() && !isDone;
            return (
              <TouchableOpacity key={task.id} onPress={() => onPress(task)} activeOpacity={0.78} style={t.row}>
                {/* Name */}
                <View style={[t.nameCol, { height: ROW_H }]}>
                  <Text style={[t.taskName, isDone && t.taskNameDone]} numberOfLines={2}>{task.title}</Text>
                </View>

                {/* Timeline */}
                <ScrollView
                  horizontal
                  scrollEnabled
                  showsHorizontalScrollIndicator={false}
                  style={{ flex: 1 }}
                  scrollEventThrottle={16}
                >
                  <View style={{ width: totalW, height: ROW_H, justifyContent: 'center' }}>
                    {/* Day separators */}
                    {days.map((_, i) => (
                      <View
                        key={i}
                        style={[t.daySep, {
                          left: i * DAY_W,
                          backgroundColor: i % 2 === 0 ? 'transparent' : COLORS.cardAlt,
                        }]}
                      />
                    ))}
                    {/* Today highlight */}
                    {(() => {
                      const todayIdx = days.findIndex((d) => d.toDateString() === today.toDateString());
                      if (todayIdx < 0) return null;
                      return (
                        <View style={[t.todayLine, { left: todayIdx * DAY_W + DAY_W / 2 - 1 }]} />
                      );
                    })()}
                    {/* Task bar */}
                    <View
                      style={[
                        t.bar,
                        {
                          left: bar.left + 2,
                          width: bar.width - 4,
                          backgroundColor: isDone ? COLORS.success : (isOverdue ? COLORS.danger : cfg.color),
                          opacity: isDone ? 0.55 : 1,
                        },
                      ]}
                    >
                      <Text style={t.barLabel} numberOfLines={1}>{task.title}</Text>
                    </View>
                  </View>
                </ScrollView>
              </TouchableOpacity>
            );
          })
        )}

        <View style={{ height: 24 }} />
      </ScrollView>
    </View>
  );
}

const t = StyleSheet.create({
  root: { flex: 1 },
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 10,
    gap: 8,
  },
  navBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  navLabel: { flex: 1, alignItems: 'center', gap: 4 },
  navLabelText: { fontSize: 13, fontWeight: '700', color: COLORS.text },
  todayChip: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 2, backgroundColor: COLORS.primaryLight, borderRadius: 8 },
  todayChipText: { fontSize: 10, color: COLORS.primary, fontWeight: '600' },
  scroll: { flex: 1 },
  row: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: COLORS.cardAlt },
  nameCol: {
    width: NAME_W,
    paddingHorizontal: 12,
    justifyContent: 'center',
    borderRightWidth: 1,
    borderRightColor: COLORS.cardAlt,
    backgroundColor: COLORS.card,
  },
  nameColHeader: { fontSize: 11, fontWeight: '700', color: COLORS.textMuted, letterSpacing: 0.5 },
  taskName: { fontSize: 11, fontWeight: '600', color: COLORS.text, lineHeight: 15 },
  taskNameDone: { textDecorationLine: 'line-through', color: COLORS.textMuted },
  dayHeader: { alignItems: 'center', justifyContent: 'center', gap: 1 },
  dayHeaderDow: { fontSize: 9, fontWeight: '600', color: COLORS.textMuted },
  dayHeaderNum: { fontSize: 12, fontWeight: '700', color: COLORS.text },
  dayHeaderToday: { backgroundColor: COLORS.primaryLight, borderRadius: 8 },
  dayHeaderTodayText: { color: COLORS.primary },
  daySep: { position: 'absolute', top: 0, width: DAY_W, height: ROW_H },
  todayLine: { position: 'absolute', top: 0, bottom: 0, width: 2, backgroundColor: COLORS.primary + '40', borderRadius: 1 },
  bar: {
    position: 'absolute',
    height: 22,
    borderRadius: 6,
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  barLabel: { fontSize: 9, fontWeight: '600', color: '#fff' },
  empty: { alignItems: 'center', paddingVertical: 60, gap: 8 },
  emptyText: { color: COLORS.textMuted, fontSize: 14 },
});
