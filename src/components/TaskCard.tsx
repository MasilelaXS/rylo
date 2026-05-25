import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { memo, useCallback, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import type { Task } from '../types';
import { CARD_SHADOW_SM, COLORS, PRIORITY_CONFIG } from '../utils/constants';
import FocusTimer from './FocusTimer';
import SubtaskList from './SubtaskList';

interface Props {
  task: Task;
  onComplete: (id: string) => void;
  onSnooze: (id: string) => void;
  onPress: (task: Task) => void;
}

const REPEAT_LABELS: Record<string, string> = {
  daily:   '↻ Daily',
  weekly:  '↻ Weekly',
  monthly: '↻ Monthly',
};

function formatMinutes(m: number): string {
  if (!m) return '';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem ? `${h}h ${rem}m` : `${h}h`;
}

function TaskCard({ task, onComplete, onSnooze, onPress }: Props) {
  const swipeRef = useRef<Swipeable>(null);
  const didTrigger = useRef(false);
  const priority = PRIORITY_CONFIG[task.priority];
  const isOverdue = task.dueDate < Date.now() && task.status !== 'completed';
  const isDone = task.status === 'completed';
  const [timerVisible, setTimerVisible] = useState(false);

  const dueDate = new Date(task.dueDate);
  const isToday = dueDate.toDateString() === new Date().toDateString();
  const dateLabel = isToday
    ? dueDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    : dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  const handleComplete = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    onComplete(task.id);
  }, [task.id, onComplete]);

  const handleSnooze = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    onSnooze(task.id);
  }, [task.id, onSnooze]);

  const triggerComplete = useCallback(() => {
    if (didTrigger.current) return;
    didTrigger.current = true;
    swipeRef.current?.close();
    handleComplete();
  }, [handleComplete]);

  const triggerSnooze = useCallback(() => {
    if (didTrigger.current) return;
    didTrigger.current = true;
    swipeRef.current?.close();
    handleSnooze();
  }, [handleSnooze]);

  const renderRightActions = () => (
    <TouchableOpacity style={s.swipeRight} onPress={triggerSnooze} activeOpacity={0.85}>
      <Ionicons name="moon-outline" size={22} color="#fff" />
      <Text style={s.swipeLabel}>Snooze</Text>
    </TouchableOpacity>
  );

  const renderLeftActions = () => (
    <TouchableOpacity style={s.swipeLeft} onPress={triggerComplete} activeOpacity={0.85}>
      <Ionicons name="checkmark-circle-outline" size={22} color="#fff" />
      <Text style={s.swipeLabel}>Done</Text>
    </TouchableOpacity>
  );

  const cardContent = (
    <TouchableOpacity onPress={() => onPress(task)} activeOpacity={0.75} style={[s.card, CARD_SHADOW_SM]}>
      <View style={s.body}>
        {/* Title + priority pill */}
        <View style={s.titleRow}>
          <Text style={[s.title, isDone && s.titleDone]} numberOfLines={1}>
            {task.title}
          </Text>
          {!isDone && (
            <View style={[s.pill, { borderColor: priority.color + '60', backgroundColor: priority.bg }]}>
              <Text style={[s.pillText, { color: priority.color }]}>{priority.label}</Text>
            </View>
          )}
          {isDone && <Ionicons name="checkmark-circle" size={16} color={COLORS.success} />}
        </View>

        {task.description ? (
          <Text style={s.desc} numberOfLines={1}>{task.description}</Text>
        ) : null}
        {task.location ? (
          <View style={s.locRow}>
            <Ionicons name="location-outline" size={11} color={COLORS.textMuted} />
            <Text style={s.locText} numberOfLines={1}>{task.location}</Text>
          </View>
        ) : null}

        {/* Subtask checklist (read-only inline view) */}
        {!isDone && <SubtaskList taskId={task.id} />}

        {/* Footer */}
        <View style={s.footer}>
          <View style={s.meta}>
            <Ionicons
              name={isOverdue ? 'alert-circle' : 'time-outline'}
              size={11}
              color={isOverdue ? COLORS.danger : COLORS.textMuted}
            />
            <Text style={[s.metaText, isOverdue && { color: COLORS.danger }]}>{dateLabel}</Text>

            {!!task.estimatedMinutes && (
              <View style={s.durationPill}>
                <Ionicons name="hourglass-outline" size={10} color={COLORS.textMuted} />
                <Text style={s.durationText}>{formatMinutes(task.estimatedMinutes)}</Text>
              </View>
            )}

            {task.snoozeCount > 0 && (
              <View style={[s.snoozePill, task.snoozeCount >= 3 && { backgroundColor: COLORS.dangerLight }]}>
                <Ionicons name="moon-outline" size={10} color={task.snoozeCount >= 3 ? COLORS.danger : COLORS.warning} />
                <Text style={[s.snoozeText, task.snoozeCount >= 3 && { color: COLORS.danger }]}>{task.snoozeCount}</Text>
              </View>
            )}

            {task.repeatType !== 'none' && !!REPEAT_LABELS[task.repeatType] && (
              <View style={s.repeatPill}>
                <Text style={s.repeatText}>{REPEAT_LABELS[task.repeatType]}</Text>
              </View>
            )}
          </View>

          {!isDone && (
            <View style={s.actions}>
              <TouchableOpacity
                style={s.actionBtn}
                onPress={() => setTimerVisible(true)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="timer-outline" size={14} color={COLORS.primary} />
              </TouchableOpacity>
              <TouchableOpacity
                style={s.actionBtn}
                onPress={handleSnooze}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="moon-outline" size={14} color={COLORS.textMuted} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.actionBtn, s.doneBtn]}
                onPress={handleComplete}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="checkmark" size={14} color="#fff" />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  if (isDone) return cardContent;

  // Reset trigger guard whenever task identity changes (e.g. re-used key)
  didTrigger.current = false;

  return (
    <>
      <FocusTimer
        visible={timerVisible}
        onClose={() => setTimerVisible(false)}
        taskTitle={task.title}
        estimatedMinutes={task.estimatedMinutes}
      />
      <Swipeable
        ref={swipeRef}
        renderLeftActions={renderLeftActions}
        renderRightActions={renderRightActions}
        onSwipeableOpen={(direction) => {
          if (direction === 'left') triggerComplete();
          else triggerSnooze();
        }}
        friction={2}
        leftThreshold={50}
        rightThreshold={50}
      >
        {cardContent}
      </Swipeable>
    </>
  );
}

const s = StyleSheet.create({
  card: {
    flexDirection: 'row',
    borderRadius: 16,
    marginBottom: 10,
    overflow: 'hidden',
    backgroundColor: COLORS.card,
  },
  body: { flex: 1, paddingHorizontal: 14, paddingVertical: 13 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  title: { flex: 1, color: COLORS.text, fontSize: 14, fontWeight: '600', letterSpacing: 0.1 },
  titleDone: { textDecorationLine: 'line-through', color: COLORS.textMuted },
  pill: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 10, borderWidth: 1 },
  pillText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.2 },
  desc: { color: COLORS.textSub, fontSize: 12, marginBottom: 5, lineHeight: 16 },
  locRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 8 },
  locText: { color: COLORS.textMuted, fontSize: 11, flex: 1 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1, flexWrap: 'wrap' },
  metaText: { color: COLORS.textMuted, fontSize: 11 },
  snoozePill: {
    flexDirection: 'row', alignItems: 'center', gap: 2,
    backgroundColor: COLORS.warningLight, borderRadius: 6,
    paddingHorizontal: 5, paddingVertical: 1,
  },
  snoozeText: { color: COLORS.warning, fontSize: 10, fontWeight: '700' },
  durationPill: {
    flexDirection: 'row', alignItems: 'center', gap: 2,
    backgroundColor: COLORS.cardAlt, borderRadius: 6,
    paddingHorizontal: 5, paddingVertical: 1,
    borderWidth: 1, borderColor: COLORS.surfaceBorder,
  },
  durationText: { color: COLORS.textMuted, fontSize: 10, fontWeight: '600' },
  repeatPill: {
    backgroundColor: COLORS.primaryLight, borderRadius: 6,
    paddingHorizontal: 5, paddingVertical: 1,
  },
  repeatText: { color: COLORS.primary, fontSize: 10, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: 6 },
  actionBtn: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: COLORS.cardAlt,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: COLORS.card,
  },
  doneBtn: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  swipeLeft: {
    backgroundColor: COLORS.success,
    justifyContent: 'center', alignItems: 'center',
    width: 80, borderRadius: 16, marginBottom: 10, gap: 2,
  },
  swipeRight: {
    backgroundColor: COLORS.warning,
    justifyContent: 'center', alignItems: 'center',
    width: 80, borderRadius: 16, marginBottom: 10, gap: 2,
  },
  swipeLabel: { color: '#fff', fontSize: 11, fontWeight: '700' },
});

export default memo(TaskCard);
