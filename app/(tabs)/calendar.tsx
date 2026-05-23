import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
import {
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AddTaskModal from '../../src/components/AddTaskModal';
import BackgroundImage from '../../src/components/BackgroundImage';
import { scheduleTaskReminder } from '../../src/notifications/notificationService';
import { useProjectStore } from '../../src/store/projectStore';
import { useTaskStore } from '../../src/store/taskStore';
import type { Task } from '../../src/types';
import { ACCENT, CARD_SHADOW, CARD_SHADOW_SM, COLORS, PRIORITY_CONFIG, generateId } from '../../src/utils/constants';

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];
const DAY_ABBR = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

const padZ = (n: number) => String(n).padStart(2, '0');

function isQuietInDay(
  hour: number,
  quietHoursEnabled: boolean,
  quietStart: string,
  quietEnd: string,
): boolean {
  if (!quietHoursEnabled) return false;
  const [sh] = quietStart.split(':').map(Number);
  const [eh] = quietEnd.split(':').map(Number);
  return sh > eh
    ? hour >= sh || hour < eh
    : hour >= sh && hour < eh;
}

export default function CalendarScreen() {
  const { tasks, loadAll, addTask, markComplete, snoozeTask } = useTaskStore();
  const { projects, loadAll: loadProjects } = useProjectStore();

  const today = new Date();
  const [year,        setYear]        = useState(today.getFullYear());
  const [month,       setMonth]       = useState(today.getMonth());
  const [selectedDay, setSelectedDay] = useState<number | null>(today.getDate());
  const [showAdd,     setShowAdd]     = useState(false);
  const [prefillDate, setPrefillDate] = useState<Date | null>(null);

  useEffect(() => { loadAll(); loadProjects(); }, []);

  // ── Build tasksByDay map ───────────────────────────────────────────────────
  const tasksByDay = useMemo(() => {
    const map: Record<string, Task[]> = {};
    for (const t of tasks) {
      if (t.status === 'cancelled') continue;
      const d   = new Date(t.dueDate);
      const key = `${d.getFullYear()}-${padZ(d.getMonth() + 1)}-${padZ(d.getDate())}`;
      (map[key] = map[key] ?? []).push(t);
    }
    return map;
  }, [tasks]);

  // ── Calendar grid ──────────────────────────────────────────────────────────
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDow    = new Date(year, month, 1).getDay();
  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const selectedKey  = selectedDay !== null ? `${year}-${padZ(month + 1)}-${padZ(selectedDay)}` : null;
  const selectedTasks = (selectedKey ? (tasksByDay[selectedKey] ?? []) : [])
    .sort((a, b) => a.dueDate - b.dueDate);

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1);
    setSelectedDay(null);
  };
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1);
    setSelectedDay(null);
  };

  const handleDayPress = (day: number) => setSelectedDay(day === selectedDay ? null : day);

  const handleAddFromDay = () => {
    if (selectedDay !== null) {
      const d = new Date(year, month, selectedDay, 9, 0, 0, 0);
      setPrefillDate(d);
    }
    setShowAdd(true);
  };

  const handleAdd = async (taskData: Omit<Task, 'id' | 'createdAt' | 'escalationLevel' | 'snoozeCount'>) => {
    const task: Task = { ...taskData, id: generateId(), createdAt: Date.now(), escalationLevel: 0, snoozeCount: 0 };
    await addTask(task);
    await scheduleTaskReminder(task);
    setPrefillDate(null);
  };

  // ── Stats ──────────────────────────────────────────────────────────────────
  const completed      = tasks.filter(t => t.status === 'completed').length;
  const pending        = tasks.filter(t => t.status !== 'completed' && t.status !== 'cancelled').length;
  const overdue        = tasks.filter(t => t.dueDate < Date.now() && t.status !== 'completed' && t.status !== 'cancelled').length;
  const completionRate = tasks.length > 0 ? Math.round((completed / tasks.length) * 100) : 0;
  const totalSnoozes   = tasks.reduce((s, t) => s + t.snoozeCount, 0);

  const monthTaskCount = useMemo(() => {
    let count = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      count += (tasksByDay[`${year}-${padZ(month + 1)}-${padZ(d)}`]?.length ?? 0);
    }
    return count;
  }, [tasksByDay, year, month, daysInMonth]);

  return (
    <BackgroundImage screen="calendar">
      <SafeAreaView style={s.safe}>
        <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
        <ScrollView style={s.scroll} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

          <Text style={s.title}>Calendar</Text>

          {/* ── Stats Row ─────────────────────────────────────────── */}
          <View style={s.statsRow}>
            {[
              { val: `${completionRate}%`, label: 'Done Rate', bg: ACCENT.purple.bg, color: ACCENT.purple.color },
              { val: String(completed),    label: 'Completed', bg: ACCENT.green.bg,  color: ACCENT.green.color  },
              { val: String(pending),      label: 'Pending',   bg: ACCENT.peach.bg,  color: ACCENT.peach.color  },
              { val: String(overdue),      label: 'Overdue',   bg: ACCENT.coral.bg,  color: ACCENT.coral.color  },
            ].map(item => (
              <View key={item.label} style={[s.statCard, { backgroundColor: item.bg }]}>
                <Text style={[s.statValue, { color: item.color }]}>{item.val}</Text>
                <Text style={s.statLabel}>{item.label}</Text>
              </View>
            ))}
          </View>

          {/* ── Calendar Card ─────────────────────────────────────── */}
          <View style={s.calCard}>

            {/* Month nav */}
            <View style={s.calHeader}>
              <TouchableOpacity onPress={prevMonth} style={s.navBtn}>
                <Ionicons name="chevron-back" size={20} color={COLORS.primary} />
              </TouchableOpacity>
              <View style={{ alignItems: 'center' }}>
                <Text style={s.calTitle}>{MONTH_NAMES[month]} {year}</Text>
                <Text style={s.calSub}>{monthTaskCount} task{monthTaskCount !== 1 ? 's' : ''} this month</Text>
              </View>
              <TouchableOpacity onPress={nextMonth} style={s.navBtn}>
                <Ionicons name="chevron-forward" size={20} color={COLORS.primary} />
              </TouchableOpacity>
            </View>

            {/* Today shortcut */}
            <TouchableOpacity
              style={s.todayBtn}
              onPress={() => {
                setYear(today.getFullYear());
                setMonth(today.getMonth());
                setSelectedDay(today.getDate());
              }}
            >
              <Ionicons name="today-outline" size={13} color={COLORS.primary} />
              <Text style={s.todayBtnText}>Today</Text>
            </TouchableOpacity>

            {/* Day of week headers */}
            <View style={s.weekRow}>
              {DAY_ABBR.map(d => <Text key={d} style={s.weekDay}>{d}</Text>)}
            </View>

            {/* Day grid */}
            <View style={s.grid}>
              {cells.map((day, idx) => {
                if (!day) return <View key={`e${idx}`} style={s.dayCell} />;
                const key      = `${year}-${padZ(month + 1)}-${padZ(day)}`;
                const dayTasks = tasksByDay[key] ?? [];
                const isToday  = day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
                const isSel    = day === selectedDay;
                const isPast   = !isToday && new Date(year, month, day, 23, 59).getTime() < Date.now();
                return (
                  <TouchableOpacity
                    key={day}
                    style={[s.dayCell, isSel && s.dayCellSel, isToday && !isSel && s.dayCellToday]}
                    onPress={() => handleDayPress(day)}
                    activeOpacity={0.7}
                  >
                    <Text style={[
                      s.dayNum,
                      isSel && s.dayNumSel,
                      isToday && !isSel && s.dayNumToday,
                      isPast && !isSel && s.dayNumPast,
                    ]}>
                      {day}
                    </Text>
                    {dayTasks.length > 0 && (
                      <View style={s.dotRow}>
                        {dayTasks.slice(0, 3).map((t, di) => (
                          <View key={di} style={[s.dot, { backgroundColor: PRIORITY_CONFIG[t.priority].color }]} />
                        ))}
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Priority legend */}
            <View style={s.legend}>
              {(Object.entries(PRIORITY_CONFIG) as [string, { label: string; color: string }][]).map(([, val]) => (
                <View key={val.label} style={s.legendItem}>
                  <View style={[s.legendDot, { backgroundColor: val.color }]} />
                  <Text style={s.legendText}>{val.label}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* ── Day Detail ────────────────────────────────────────── */}
          {selectedDay !== null && (
            <View style={s.dayDetail}>
              <View style={s.dayDetailHeader}>
                <View>
                  <Text style={s.dayDetailTitle}>{MONTH_NAMES[month]} {selectedDay}, {year}</Text>
                  <Text style={s.dayDetailSub}>
                    {selectedTasks.length === 0
                      ? 'No tasks scheduled'
                      : `${selectedTasks.length} task${selectedTasks.length > 1 ? 's' : ''}`}
                  </Text>
                </View>
                <TouchableOpacity style={s.addDayBtn} onPress={handleAddFromDay}>
                  <Ionicons name="add" size={18} color={COLORS.primary} />
                  <Text style={s.addDayText}>Add Task</Text>
                </TouchableOpacity>
              </View>

              {selectedTasks.length === 0 ? (
                <Text style={s.freeDay}>✓ Free day — nothing scheduled</Text>
              ) : (
                selectedTasks.map(t => {
                  const p      = PRIORITY_CONFIG[t.priority];
                  const time   = new Date(t.dueDate).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
                  const isDone = t.status === 'completed';
                  return (
                    <View key={t.id} style={[s.taskRow, isDone && s.taskRowDone]}>
                      <View style={s.timeCol}>
                        <Text style={s.timeText}>{time}</Text>
                      </View>
                      <View style={[s.taskBar, { backgroundColor: p.color }]} />
                      <View style={s.taskBody}>
                        <Text style={[s.taskTitle, isDone && s.taskTitleDone]} numberOfLines={2}>
                          {t.title}
                        </Text>
                        <View style={s.taskMeta}>
                          <View style={[s.statusDot, { backgroundColor: isDone ? COLORS.success : p.color }]} />
                          <Text style={s.taskStatusText}>{isDone ? 'Completed' : p.label}</Text>
                          {t.location ? (
                            <>
                              <Ionicons name="location-outline" size={10} color={COLORS.textMuted} />
                              <Text style={s.taskLocation} numberOfLines={1}>{t.location}</Text>
                            </>
                          ) : null}
                        </View>
                      </View>
                      {!isDone && (
                        <TouchableOpacity
                          onPress={() => markComplete(t.id)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          style={s.doneBtn}
                        >
                          <Ionicons name="checkmark" size={16} color="#fff" />
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                })
              )}
            </View>
          )}

          <View style={{ height: 110 }} />
        </ScrollView>

        <AddTaskModal
          visible={showAdd}
          onClose={() => { setShowAdd(false); setPrefillDate(null); }}
          onSave={handleAdd}
          projects={projects}
          initialDate={prefillDate ?? undefined}
        />
      </SafeAreaView>
    </BackgroundImage>
  );
}

const s = StyleSheet.create({
  safe:    { flex: 1 },
  scroll:  { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 8 },
  title:   { fontSize: 28, fontWeight: '800', color: COLORS.text, letterSpacing: -0.5, marginBottom: 16 },

  // Stats
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  statCard: { flex: 1, borderRadius: 16, padding: 12, alignItems: 'center', ...CARD_SHADOW_SM },
  statValue: { fontSize: 18, fontWeight: '800', letterSpacing: -0.5 },
  statLabel: { fontSize: 10, color: COLORS.textSub, marginTop: 2, fontWeight: '600' },

  // Calendar card
  calCard:   { backgroundColor: COLORS.card, borderRadius: 22, padding: 16, ...CARD_SHADOW, marginBottom: 16 },
  calHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  navBtn:    { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center' },
  calTitle:  { fontSize: 17, fontWeight: '800', color: COLORS.text },
  calSub:    { fontSize: 11, color: COLORS.textMuted, marginTop: 2, textAlign: 'center' },

  todayBtn:     { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'center', paddingVertical: 4, paddingHorizontal: 12, borderRadius: 12, backgroundColor: COLORS.primaryLight, marginBottom: 12 },
  todayBtnText: { fontSize: 12, fontWeight: '600', color: COLORS.primary },

  weekRow: { flexDirection: 'row', marginBottom: 4 },
  weekDay: { flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '700', color: COLORS.textMuted, letterSpacing: 0.4 },

  grid:          { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell:       { width: '14.28%', aspectRatio: 0.9, alignItems: 'center', justifyContent: 'center', paddingVertical: 2 },
  dayCellSel:    { backgroundColor: COLORS.primary, borderRadius: 12 },
  dayCellToday:  { backgroundColor: COLORS.primaryLight, borderRadius: 12 },
  dayNum:        { fontSize: 14, fontWeight: '500', color: COLORS.text },
  dayNumSel:     { color: '#fff', fontWeight: '700' },
  dayNumToday:   { color: COLORS.primary, fontWeight: '700' },
  dayNumPast:    { color: COLORS.textMuted },
  dotRow:        { flexDirection: 'row', gap: 2, marginTop: 2 },
  dot:           { width: 4, height: 4, borderRadius: 2 },

  legend:     { flexDirection: 'row', gap: 10, justifyContent: 'center', marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: COLORS.cardAlt },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot:  { width: 6, height: 6, borderRadius: 3 },
  legendText: { fontSize: 10, color: COLORS.textMuted, fontWeight: '600' },

  // Day detail
  dayDetail:       { backgroundColor: COLORS.card, borderRadius: 22, padding: 16, ...CARD_SHADOW },
  dayDetailHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  dayDetailTitle:  { fontSize: 16, fontWeight: '700', color: COLORS.text },
  dayDetailSub:    { fontSize: 12, color: COLORS.textSub, marginTop: 2 },
  addDayBtn:       { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: COLORS.primaryLight, borderRadius: 12 },
  addDayText:      { fontSize: 13, fontWeight: '700', color: COLORS.primary },
  freeDay:         { textAlign: 'center', color: COLORS.textMuted, fontSize: 14, paddingVertical: 16 },

  taskRow:       { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: COLORS.cardAlt },
  taskRowDone:   { opacity: 0.55 },
  timeCol:       { width: 46, alignItems: 'flex-end' },
  timeText:      { fontSize: 11, fontWeight: '600', color: COLORS.textMuted },
  taskBar:       { width: 3, height: 40, borderRadius: 2 },
  taskBody:      { flex: 1 },
  taskTitle:     { fontSize: 14, fontWeight: '600', color: COLORS.text, marginBottom: 3 },
  taskTitleDone: { textDecorationLine: 'line-through', color: COLORS.textMuted },
  taskMeta:      { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' },
  statusDot:     { width: 6, height: 6, borderRadius: 3 },
  taskStatusText:{ fontSize: 11, color: COLORS.textMuted, fontWeight: '500' },
  taskLocation:  { fontSize: 11, color: COLORS.textMuted, flex: 1 },
  doneBtn:       { width: 28, height: 28, borderRadius: 14, backgroundColor: COLORS.success, alignItems: 'center', justifyContent: 'center' },
});
