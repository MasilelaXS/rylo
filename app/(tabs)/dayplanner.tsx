import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AddTaskModal from '../../src/components/AddTaskModal';
import { scheduleTaskReminder } from '../../src/notifications/notificationService';
import { useProjectStore } from '../../src/store/projectStore';
import { useTaskStore } from '../../src/store/taskStore';
import type { Task } from '../../src/types';
import { COLORS, PRIORITY_CONFIG, generateId } from '../../src/utils/constants';

// ─── Layout constants ────────────────────────────────────────────────────────
const HOUR_H       = 64;   // px per hour
const TIME_COL_W   = 56;   // width of the left time column
const TASK_PAD_L   = 4;    // gap between time col and task blocks
const TASK_PAD_R   = 12;
const MIN_TASK_H   = 38;   // minimum block height in px
const TOTAL_H      = 24 * HOUR_H;
const SCROLL_TO_H  = 6 * HOUR_H;  // auto-scroll to 6 AM

// ─── Helpers ─────────────────────────────────────────────────────────────────
const DAY_NAMES  = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const MONTH_ABBR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function formatHour(h: number) {
  if (h === 0)  return '12 AM';
  if (h < 12)   return `${h} AM`;
  if (h === 12) return '12 PM';
  return `${h - 12} PM`;
}

function taskTop(dueDate: number): number {
  const d = new Date(dueDate);
  return d.getHours() * HOUR_H + (d.getMinutes() / 60) * HOUR_H;
}

function taskHeight(estimatedMinutes?: number): number {
  const mins = estimatedMinutes && estimatedMinutes > 0 ? estimatedMinutes : 45;
  return Math.max((mins / 60) * HOUR_H, MIN_TASK_H);
}

function parseDate(param?: string): Date {
  if (param) {
    const d = new Date(param);
    if (!isNaN(d.getTime())) {
      d.setHours(0, 0, 0, 0);
      return d;
    }
  }
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function toDateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function addDays(d: Date, n: number): Date {
  const nd = new Date(d);
  nd.setDate(d.getDate() + n);
  return nd;
}

// ─── Task block ───────────────────────────────────────────────────────────────
function TaskBlock({
  task,
  onPress,
  offsetX,
  totalCols,
}: {
  task: Task;
  onPress: () => void;
  offsetX: number;
  totalCols: number;
}) {
  const p      = PRIORITY_CONFIG[task.priority];
  const top    = taskTop(task.dueDate);
  const height = taskHeight(task.estimatedMinutes);
  const isDone = task.status === 'completed';

  const colWidth = (1 / totalCols);
  const leftPct  = `${offsetX * colWidth * 100}%` as any;
  const widthPct = `${colWidth * 100 - 1}%` as any;

  const time = new Date(task.dueDate).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  return (
    <TouchableOpacity
      style={[
        blk.root,
        {
          top,
          height,
          left: TIME_COL_W + TASK_PAD_L + (offsetX === 0 ? 0 : (offsetX / totalCols) * (/* container width - TIME_COL_W - paddings */ 0)),
          marginLeft: offsetX > 0 ? `${(offsetX / totalCols) * 100}%` as any : undefined,
          width: `${colWidth * 100 - 1}%` as any,
          borderLeftColor: p.color,
          backgroundColor: isDone ? `${p.color}18` : `${p.color}22`,
          opacity: isDone ? 0.6 : 1,
        },
      ]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Text style={[blk.title, isDone && blk.done]} numberOfLines={height < 50 ? 1 : 2}>
        {isDone ? '✓ ' : ''}{task.title}
      </Text>
      {height >= 50 && (
        <Text style={blk.meta} numberOfLines={1}>
          {time}{task.estimatedMinutes ? ` · ${task.estimatedMinutes}m` : ''}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const blk = StyleSheet.create({
  root: {
    position: 'absolute',
    borderRadius: 10, borderLeftWidth: 3,
    paddingHorizontal: 8, paddingVertical: 5,
    overflow: 'hidden',
  },
  title: { fontSize: 12, fontWeight: '700', color: COLORS.text },
  done:  { textDecorationLine: 'line-through', color: COLORS.textMuted },
  meta:  { fontSize: 10, color: COLORS.textSub, marginTop: 2 },
});

// ─── Screen ──────────────────────────────────────────────────────────────────
export default function DayPlannerScreen() {
  const params                               = useLocalSearchParams<{ date?: string }>();
  const router                               = useRouter();
  const { tasks, loadAll, addTask, markComplete } = useTaskStore();
  const { projects, loadAll: loadProjects }  = useProjectStore();

  const [selectedDate, setSelectedDate]      = useState(() => parseDate(params.date));
  const [showAdd,      setShowAdd]           = useState(false);
  const [prefillDate,  setPrefillDate]       = useState<Date | null>(null);
  const [editTask,     setEditTask]          = useState<Task | null>(null);

  const scrollRef = useRef<ScrollView>(null);
  const nowRef    = useRef<View>(null);

  useEffect(() => { loadAll(); loadProjects(); }, []);

  // Auto-scroll to 6 AM (or current hour if today) on mount / date change
  useEffect(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const isToday = selectedDate.getTime() === today.getTime();
    const scrollTo = isToday
      ? Math.max(0, (new Date().getHours() - 1) * HOUR_H)
      : SCROLL_TO_H;
    setTimeout(() => scrollRef.current?.scrollTo({ y: scrollTo, animated: false }), 150);
  }, [selectedDate]);

  const isToday = useMemo(() => {
    const t = new Date(); t.setHours(0, 0, 0, 0);
    return selectedDate.getTime() === t.getTime();
  }, [selectedDate]);

  // Now-line position
  const nowTop = useMemo(() => {
    const n = new Date();
    return n.getHours() * HOUR_H + (n.getMinutes() / 60) * HOUR_H;
  }, []);

  // Tasks for the selected day
  const dayTasks = useMemo(() => {
    const startMs = selectedDate.getTime();
    const endMs   = startMs + 86_400_000 - 1;
    return tasks
      .filter((t) => t.dueDate >= startMs && t.dueDate <= endMs && t.status !== 'cancelled')
      .sort((a, b) => a.dueDate - b.dueDate);
  }, [tasks, selectedDate]);

  // Detect overlaps — assign column index to each task
  const tasksWithCols = useMemo(() => {
    type Slot = { task: Task; col: number; end: number };
    const placed: Slot[] = [];
    for (const task of dayTasks) {
      const top    = taskTop(task.dueDate);
      const bottom = top + taskHeight(task.estimatedMinutes);
      // Find what columns are occupied at this vertical range
      const usedCols = new Set(
        placed
          .filter((s) => s.end > top && taskTop(s.task.dueDate) < bottom)
          .map((s) => s.col),
      );
      let col = 0;
      while (usedCols.has(col)) col++;
      placed.push({ task, col, end: bottom });
    }
    const maxCol = placed.reduce((m, s) => Math.max(m, s.col), 0) + 1;
    return placed.map((s) => ({ ...s, totalCols: maxCol }));
  }, [dayTasks]);

  const dateLabel = useMemo(() => {
    const s = isToday ? 'Today — ' : '';
    return `${s}${DAY_NAMES[selectedDate.getDay()]}, ${MONTH_ABBR[selectedDate.getMonth()]} ${selectedDate.getDate()}`;
  }, [selectedDate, isToday]);

  // ── Handlers ────────────────────────────────────────────────────────────────
  const goPrev = () => setSelectedDate((d) => addDays(d, -1));
  const goNext = () => setSelectedDate((d) => addDays(d, +1));
  const goToday = () => setSelectedDate(parseDate());

  function handleSlotPress(e: { nativeEvent: { locationY: number } }) {
    const y       = e.nativeEvent.locationY;
    const hours   = Math.floor(y / HOUR_H);
    const minutes = Math.round(((y % HOUR_H) / HOUR_H) * 60 / 15) * 15;
    const d       = new Date(selectedDate);
    d.setHours(hours, minutes, 0, 0);
    setPrefillDate(d);
    setShowAdd(true);
  }

  const handleAdd = async (taskData: Omit<Task, 'id' | 'createdAt' | 'escalationLevel' | 'snoozeCount'>) => {
    const task: Task = { ...taskData, id: generateId(), createdAt: Date.now(), escalationLevel: 0, snoozeCount: 0 };
    await addTask(task);
    await scheduleTaskReminder(task);
    setPrefillDate(null);
  };

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.bg} />
      <SafeAreaView style={s.safe} edges={['top']}>

        {/* ── Header ──────────────────────────────────────────────────── */}
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="chevron-back" size={22} color={COLORS.primary} />
          </TouchableOpacity>
          <View style={s.titleBlock}>
            <Text style={s.title}>Day Planner</Text>
          </View>
          <TouchableOpacity onPress={() => setShowAdd(true)} style={s.addBtn}>
            <Ionicons name="add" size={20} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* ── Date nav ────────────────────────────────────────────────── */}
        <View style={s.dateNav}>
          <TouchableOpacity onPress={goPrev} style={s.navArrow} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
            <Ionicons name="chevron-back" size={20} color={COLORS.primary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={goToday} style={s.dateChip} activeOpacity={0.75}>
            <Text style={s.dateLabel}>{dateLabel}</Text>
            {!isToday && (
              <View style={s.todayBadge}><Text style={s.todayBadgeText}>Go Today</Text></View>
            )}
          </TouchableOpacity>
          <TouchableOpacity onPress={goNext} style={s.navArrow} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
            <Ionicons name="chevron-forward" size={20} color={COLORS.primary} />
          </TouchableOpacity>
        </View>

        {/* ── Task count pill ─────────────────────────────────────────── */}
        <View style={s.countRow}>
          <View style={s.countPill}>
            <Ionicons name="calendar-outline" size={13} color={COLORS.primary} />
            <Text style={s.countText}>
              {dayTasks.length} task{dayTasks.length !== 1 ? 's' : ''} scheduled
            </Text>
          </View>
          {dayTasks.filter((t) => t.status === 'completed').length > 0 && (
            <View style={[s.countPill, { backgroundColor: `${COLORS.success}18` }]}>
              <Ionicons name="checkmark-circle-outline" size={13} color={COLORS.success} />
              <Text style={[s.countText, { color: COLORS.success }]}>
                {dayTasks.filter((t) => t.status === 'completed').length} done
              </Text>
            </View>
          )}
        </View>

        {/* ── Timeline ────────────────────────────────────────────────── */}
        <ScrollView
          ref={scrollRef}
          style={s.scroll}
          contentContainerStyle={s.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Tap-to-add transparent overlay */}
          <TouchableOpacity
            style={[StyleSheet.absoluteFillObject, { zIndex: 0 }]}
            onPress={handleSlotPress as any}
            activeOpacity={1}
          />

          {/* Fixed-height timeline area */}
          <View style={{ height: TOTAL_H, position: 'relative' }}>

            {/* Hour rows */}
            {Array.from({ length: 24 }, (_, h) => (
              <View key={h} style={[s.hourRow, { top: h * HOUR_H }]}>
                <Text style={s.hourLabel}>{formatHour(h)}</Text>
                <View style={s.hourLine} />
              </View>
            ))}

            {/* Current time indicator */}
            {isToday && (
              <View style={[s.nowLine, { top: nowTop }]}>
                <View style={s.nowDot} />
                <View style={s.nowLineInner} />
              </View>
            )}

            {/* Task blocks */}
            {tasksWithCols.map(({ task, col, totalCols }) => (
              <View
                key={task.id}
                style={[
                  blk.root,
                  {
                    top: taskTop(task.dueDate),
                    height: taskHeight(task.estimatedMinutes),
                    left: TIME_COL_W + TASK_PAD_L + col * Math.floor((280 - TASK_PAD_L) / totalCols),
                    width: Math.floor((280 - TASK_PAD_L) / totalCols) - 4,
                    borderLeftColor: PRIORITY_CONFIG[task.priority].color,
                    backgroundColor: task.status === 'completed'
                      ? `${PRIORITY_CONFIG[task.priority].color}18`
                      : `${PRIORITY_CONFIG[task.priority].color}22`,
                    opacity: task.status === 'completed' ? 0.6 : 1,
                    zIndex: 10,
                  },
                ]}
              >
                <TouchableOpacity
                  style={{ flex: 1 }}
                  onPress={() => setEditTask(task)}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      blk.title,
                      task.status === 'completed' && blk.done,
                    ]}
                    numberOfLines={taskHeight(task.estimatedMinutes) < 50 ? 1 : 2}
                  >
                    {task.status === 'completed' ? '✓ ' : ''}{task.title}
                  </Text>
                  {taskHeight(task.estimatedMinutes) >= 50 && (
                    <Text style={blk.meta} numberOfLines={1}>
                      {new Date(task.dueDate).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                      {task.estimatedMinutes ? ` · ${task.estimatedMinutes}m` : ''}
                    </Text>
                  )}
                </TouchableOpacity>
                {task.status !== 'completed' && (
                  <TouchableOpacity
                    style={s.doneBtn}
                    onPress={() => markComplete(task.id)}
                    hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                  >
                    <Ionicons name="checkmark" size={12} color={PRIORITY_CONFIG[task.priority].color} />
                  </TouchableOpacity>
                )}
              </View>
            ))}

            {/* Empty hint */}
            {dayTasks.length === 0 && (
              <View style={s.emptyHint}>
                <Ionicons name="sunny-outline" size={32} color={COLORS.textMuted} />
                <Text style={s.emptyTitle}>Free day!</Text>
                <Text style={s.emptySub}>Tap any time slot to schedule a task</Text>
              </View>
            )}
          </View>
          <View style={{ height: 40 }} />
        </ScrollView>

        {/* ── Add Task Modal ───────────────────────────────────────────── */}
        <AddTaskModal
          visible={showAdd || editTask !== null}
          onClose={() => { setShowAdd(false); setPrefillDate(null); setEditTask(null); }}
          onSave={handleAdd}
          projects={projects}
          initialDate={editTask ? new Date(editTask.dueDate) : prefillDate ?? undefined}
          initialTask={editTask ?? undefined}
          onDelete={editTask ? async (id) => {
            const { deleteTask } = useTaskStore.getState();
            await deleteTask(id);
            setEditTask(null);
          } : undefined}
        />
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
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4,
  },
  backBtn:    { padding: 4 },
  titleBlock: { flex: 1 },
  title:      { fontSize: 22, fontWeight: '800', color: COLORS.text },
  addBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center',
  },

  dateNav: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 12, paddingHorizontal: 16, paddingVertical: 8,
  },
  navArrow: { padding: 6 },
  dateChip: { flex: 1, alignItems: 'center', gap: 3 },
  dateLabel:{ fontSize: 15, fontWeight: '700', color: COLORS.text, textAlign: 'center' },
  todayBadge: {
    paddingHorizontal: 10, paddingVertical: 3,
    backgroundColor: COLORS.primaryLight, borderRadius: 8,
  },
  todayBadgeText: { fontSize: 11, fontWeight: '600', color: COLORS.primary },

  countRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 8 },
  countPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 5,
    backgroundColor: COLORS.primaryLight, borderRadius: 10,
  },
  countText: { fontSize: 12, fontWeight: '600', color: COLORS.primary },

  scroll:       { flex: 1 },
  scrollContent: { paddingHorizontal: 0 },

  hourRow: {
    position: 'absolute', left: 0, right: 0, height: HOUR_H,
    flexDirection: 'row', alignItems: 'flex-start',
  },
  hourLabel: {
    width: TIME_COL_W, paddingLeft: 10, paddingTop: 4,
    fontSize: 11, color: COLORS.textMuted, fontWeight: '600',
  },
  hourLine: {
    flex: 1, height: 1, backgroundColor: COLORS.cardAlt, marginTop: 12,
  },

  nowLine: {
    position: 'absolute', left: 0, right: 0, height: 2, zIndex: 20,
    flexDirection: 'row', alignItems: 'center',
  },
  nowDot: {
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: COLORS.danger, marginLeft: TIME_COL_W - 5,
  },
  nowLineInner: { flex: 1, height: 2, backgroundColor: COLORS.danger, opacity: 0.6 },

  doneBtn: {
    position: 'absolute', top: 6, right: 6,
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: COLORS.cardAlt,
    alignItems: 'center', justifyContent: 'center',
  },

  emptyHint: {
    position: 'absolute', top: 280, left: 0, right: 0,
    alignItems: 'center', gap: 6,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: COLORS.textSub },
  emptySub:   { fontSize: 13, color: COLORS.textMuted },
});
