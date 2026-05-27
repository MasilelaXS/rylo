import { Ionicons } from '@expo/vector-icons';
import { useCallback } from 'react';
import {
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import type { Task, TaskStatus } from '../types';
import { CARD_SHADOW_SM, COLORS, PRIORITY_CONFIG } from '../utils/constants';

interface Props {
  tasks: Task[];
  onPress: (task: Task) => void;
  onComplete: (id: string) => void;
  onStatusChange: (id: string, status: TaskStatus) => void;
}

interface Column {
  key: TaskStatus;
  label: string;
  color: string;
  bg: string;
  icon: string;
}

const COLUMNS: Column[] = [
  { key: 'pending',     label: 'To Do',      color: '#6E7191', bg: '#F0F1F8', icon: 'radio-button-off-outline' },
  { key: 'in_progress', label: 'In Progress', color: '#1E90FF', bg: '#E6F2FF', icon: 'play-circle-outline'       },
  { key: 'completed',   label: 'Done',        color: '#2ECC9A', bg: '#E5FAF2', icon: 'checkmark-circle-outline'  },
];

function formatDue(ts: number): string {
  const d = new Date(ts);
  const isToday = d.toDateString() === new Date().toDateString();
  if (isToday) return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function KanbanCard({
  task,
  onPress,
  onComplete,
  onMoveNext,
  isLast,
}: {
  task: Task;
  onPress: (t: Task) => void;
  onComplete: (id: string) => void;
  onMoveNext?: (id: string) => void;
  isLast: boolean;
}) {
  const p = PRIORITY_CONFIG[task.priority];
  const isOverdue = task.dueDate < Date.now() && task.status !== 'completed';
  return (
    <TouchableOpacity
      onPress={() => onPress(task)}
      activeOpacity={0.78}
      style={[k.card, CARD_SHADOW_SM]}
    >
      {/* Priority bar */}
      <View style={[k.priorityBar, { backgroundColor: p.color }]} />
      <View style={k.body}>
        <Text style={[k.title, task.status === 'completed' && k.titleDone]} numberOfLines={2}>
          {task.title}
        </Text>
        <View style={k.footer}>
          <View style={k.meta}>
            <Ionicons
              name={isOverdue ? 'alert-circle' : 'time-outline'}
              size={10}
              color={isOverdue ? COLORS.danger : COLORS.textMuted}
            />
            <Text style={[k.metaText, isOverdue && { color: COLORS.danger }]}>{formatDue(task.dueDate)}</Text>
            <View style={[k.badge, { backgroundColor: p.bg, borderColor: p.color + '40' }]}>
              <Text style={[k.badgeText, { color: p.color }]}>{p.label}</Text>
            </View>
          </View>
          <View style={k.actions}>
            {task.status !== 'completed' && (
              <TouchableOpacity
                style={k.actionBtn}
                onPress={() => onComplete(task.id)}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <Ionicons name="checkmark" size={13} color="#fff" />
              </TouchableOpacity>
            )}
            {!isLast && onMoveNext && task.status !== 'completed' && (
              <TouchableOpacity
                style={[k.actionBtn, k.moveBtn]}
                onPress={() => onMoveNext(task.id)}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <Ionicons name="arrow-forward" size={13} color={COLORS.primary} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function KanbanBoard({ tasks, onPress, onComplete, onStatusChange }: Props) {
  const getNextStatus = useCallback((current: TaskStatus): TaskStatus | null => {
    const idx = COLUMNS.findIndex((c) => c.key === current);
    return idx >= 0 && idx < COLUMNS.length - 1 ? COLUMNS[idx + 1].key : null;
  }, []);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={b.scrollContent}
      decelerationRate="fast"
      snapToInterval={288}
      snapToAlignment="start"
    >
      {COLUMNS.map((col, colIdx) => {
        const colTasks = tasks.filter((t) => {
          if (col.key === 'pending') return t.status === 'pending' || t.status === 'snoozed';
          return t.status === col.key;
        });

        return (
          <View key={col.key} style={b.column}>
            {/* Column header */}
            <View style={[b.colHeader, { backgroundColor: col.bg }]}>
              <Ionicons name={col.icon as any} size={14} color={col.color} />
              <Text style={[b.colTitle, { color: col.color }]}>{col.label}</Text>
              <View style={[b.colCount, { backgroundColor: col.color + '22' }]}>
                <Text style={[b.colCountText, { color: col.color }]}>{colTasks.length}</Text>
              </View>
            </View>

            {/* Cards */}
            <ScrollView
              style={b.colScroll}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 16 }}
              nestedScrollEnabled
            >
              {colTasks.length === 0 ? (
                <View style={b.empty}>
                  <Ionicons name="checkmark-done-outline" size={28} color={COLORS.textMuted} />
                  <Text style={b.emptyText}>Nothing here</Text>
                </View>
              ) : (
                colTasks.map((task) => {
                  const next = getNextStatus(col.key);
                  return (
                    <KanbanCard
                      key={task.id}
                      task={task}
                      onPress={onPress}
                      onComplete={onComplete}
                      onMoveNext={next ? (id) => onStatusChange(id, next) : undefined}
                      isLast={colIdx === COLUMNS.length - 1}
                    />
                  );
                })
              )}
            </ScrollView>
          </View>
        );
      })}
    </ScrollView>
  );
}

const COLUMN_W = 272;

const b = StyleSheet.create({
  scrollContent: { paddingHorizontal: 16, paddingBottom: 16, gap: 10 },
  column: {
    width: COLUMN_W,
    backgroundColor: COLORS.card,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E8EAF0',
  },
  colHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  colTitle: { flex: 1, fontSize: 13, fontWeight: '700', letterSpacing: 0.2 },
  colCount: { borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2 },
  colCountText: { fontSize: 11, fontWeight: '700' },
  colScroll: { flex: 1, paddingHorizontal: 10, paddingTop: 6 },
  empty: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyText: { color: COLORS.textMuted, fontSize: 13 },
});

const k = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: COLORS.bg,
    borderRadius: 12,
    marginBottom: 8,
    overflow: 'hidden',
  },
  priorityBar: { width: 3 },
  body: { flex: 1, padding: 10 },
  title: { fontSize: 13, fontWeight: '600', color: COLORS.text, marginBottom: 7, lineHeight: 18 },
  titleDone: { textDecorationLine: 'line-through', color: COLORS.textMuted },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1 },
  metaText: { fontSize: 10, color: COLORS.textMuted, marginRight: 2 },
  badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, borderWidth: 1 },
  badgeText: { fontSize: 9, fontWeight: '700' },
  actions: { flexDirection: 'row', gap: 4 },
  actionBtn: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: COLORS.success,
    alignItems: 'center', justifyContent: 'center',
  },
  moveBtn: { backgroundColor: COLORS.primaryLight },
});
