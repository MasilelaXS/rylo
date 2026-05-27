import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { improveNote, parseDueDateHint, suggestSchedule } from '../services/aiService';
import { useTaskStore } from '../store/taskStore';
import { useTemplateStore } from '../store/templateStore';
import type { Priority, RepeatType, Task } from '../types';
import { COLORS, PRIORITY_CONFIG } from '../utils/constants';
import SubtaskList from './SubtaskList';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSave: (task: Omit<Task, 'id' | 'createdAt' | 'escalationLevel' | 'snoozeCount'>) => void;
  projects: { id: string; name: string; color: string }[];
  initialTask?: Task;
  onDelete?: (id: string) => void;
  /** Pre-fill the date when creating a new task from the calendar */
  initialDate?: Date;
}

const PRIORITIES: Priority[] = ['low', 'medium', 'high', 'urgent'];
const REPEAT_TYPES: { value: RepeatType; label: string; icon: string }[] = [
  { value: 'none',    label: 'Once',    icon: '\u2014' },
  { value: 'daily',   label: 'Daily',   icon: '\ud83d\udd01' },
  { value: 'weekly',  label: 'Weekly',  icon: '\ud83d\uddd3' },
  { value: 'monthly', label: 'Monthly', icon: '\ud83d\udcc6' },
];
const DURATION_OPTIONS = [
  { value: 0,   label: '—' },
  { value: 15,  label: '15m' },
  { value: 30,  label: '30m' },
  { value: 45,  label: '45m' },
  { value: 60,  label: '1h' },
  { value: 90,  label: '1.5h' },
  { value: 120, label: '2h' },
];
const MINUTE_STEPS = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

function generateDays(count = 180): Date[] {
  return Array.from({ length: count }, (_, i) => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + i);
    return d;
  });
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export default function AddTaskModal({ visible, onClose, onSave, projects, initialTask, onDelete, initialDate }: Props) {
  const isEdit = !!initialTask;
  const DAYS = generateDays(180);
  const { templates, load: loadTemplates } = useTemplateStore();

  const initDue = initialTask ? new Date(initialTask.dueDate) : (() => {
    const d = new Date(); d.setHours(d.getHours() + 1, 0, 0, 0); return d;
  })();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [projectId, setProjectId] = useState<string | null>(null);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [repeatType, setRepeatType] = useState<RepeatType>('none');
  const [estimatedMinutes, setEstimatedMinutes] = useState(0);
  const [dependsOn, setDependsOn] = useState<string | null>(null);
  const [showBlockerPicker, setShowBlockerPicker] = useState(false);
  const [blockerSearch, setBlockerSearch] = useState('');
  const [hour, setHour] = useState(initDue.getHours());
  const [minute, setMinute] = useState(MINUTE_STEPS.includes(initDue.getMinutes()) ? initDue.getMinutes() : 0);
  const [dayIndex, setDayIndex] = useState(0);

  const dateScrollRef = useRef<ScrollView>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [schedSuggestion, setSchedSuggestion] = useState('');
  const [schedLoading, setSchedLoading] = useState(false);
  const [dueDateHint, setDueDateHint] = useState<{ days: number; label: string } | null>(null);
  const dueDateDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { todayTasks } = useTaskStore();
  const { tasks: allTasks } = useTaskStore();

  // Debounced due-date hint from title
  function handleTitleChange(text: string) {
    setTitle(text);
    setDueDateHint(null);
    if (dueDateDebounceRef.current) clearTimeout(dueDateDebounceRef.current);
    if (!text.trim() || isEdit) return;
    dueDateDebounceRef.current = setTimeout(async () => {
      try {
        const days = await parseDueDateHint(text);
        if (days !== null) {
          const label = days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : `In ${days} days`;
          setDueDateHint({ days, label });
        }
      } catch { /* silent */ }
    }, 900);
  }

  function applyDueDateHint() {
    if (!dueDateHint) return;
    const target = new Date();
    target.setDate(target.getDate() + dueDateHint.days);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const diff = Math.round((target.setHours(0, 0, 0, 0), target.getTime() - today.getTime()) / 86_400_000);
    setDayIndex(Math.max(0, Math.min(diff, DAYS.length - 1)));
    setDueDateHint(null);
  }

  async function handleSuggestSchedule() {
    if (!title.trim() || schedLoading) return;
    setSchedLoading(true);
    setSchedSuggestion('');
    try {
      const existing = todayTasks
        .filter((t) => t.status !== 'completed')
        .map((t) => ({
          title: t.title,
          dueDate: new Date(t.dueDate).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
          estimatedMinutes: t.estimatedMinutes ?? 0,
        }));
      const suggestion = await suggestSchedule(title, todayTasks.length, estimatedMinutes, existing);
      setSchedSuggestion(suggestion);
    } catch { /* silent */ }
    finally { setSchedLoading(false); }
  }

  const handleImproveDescription = async () => {
    if (!description.trim() || aiLoading) return;
    setAiLoading(true);
    try {
      const improved = await improveNote(description);
      setDescription(improved);
    } catch {
      // silently fail
    } finally {
      setAiLoading(false);
    }
  };

  // Sync state when modal opens / initialTask changes
  useEffect(() => {
    if (!visible) return;
    loadTemplates();
    if (initialTask) {
      const d = new Date(initialTask.dueDate);
      setTitle(initialTask.title);
      setDescription(initialTask.description ?? '');
      setLocation(initialTask.location ?? '');
      setPriority(initialTask.priority);
      setProjectId(initialTask.projectId);
      setVoiceEnabled(initialTask.voiceReminderEnabled);
      setHour(d.getHours());
      const nearestMin = MINUTE_STEPS.reduce((prev, cur) =>
        Math.abs(cur - d.getMinutes()) < Math.abs(prev - d.getMinutes()) ? cur : prev, 0);
      setMinute(nearestMin);
      setRepeatType(initialTask.repeatType ?? 'none');
      setEstimatedMinutes(initialTask.estimatedMinutes ?? 0);
      setDependsOn(initialTask.dependsOn ?? null);
      // Find day index
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const taskDay = new Date(d); taskDay.setHours(0, 0, 0, 0);
      const diff = Math.round((taskDay.getTime() - today.getTime()) / 86400000);
      setDayIndex(Math.max(0, Math.min(diff, DAYS.length - 1)));
    } else {
      const d = initialDate ?? (() => { const x = new Date(); x.setHours(x.getHours() + 1, 0, 0, 0); return x; })();
      setTitle(''); setDescription(''); setLocation('');
      setPriority('medium'); setProjectId(null); setVoiceEnabled(true);
      setRepeatType('none'); setEstimatedMinutes(0); setDependsOn(null);
      setHour(d.getHours()); setMinute(0);
      // Find matching day index
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const targetDay = new Date(d); targetDay.setHours(0, 0, 0, 0);
      const diff = Math.round((targetDay.getTime() - today.getTime()) / 86_400_000);
      setDayIndex(Math.max(0, Math.min(diff, DAYS.length - 1)));
    }
  }, [visible, initialTask]);

  const selectedDate = DAYS[dayIndex] ?? DAYS[0];
  const dueTimestamp = (() => {
    const d = new Date(selectedDate);
    d.setHours(hour, minute, 0, 0);
    return d.getTime();
  })();

  const adjustHour = (delta: number) => setHour(h => (h + delta + 24) % 24);
  const adjustMinute = (delta: number) => {
    const idx = MINUTE_STEPS.indexOf(minute);
    const next = (idx + delta + MINUTE_STEPS.length) % MINUTE_STEPS.length;
    setMinute(MINUTE_STEPS[next]);
  };

  const handleSave = () => {
    if (!title.trim()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    onSave({
      title: title.trim(),
      description: description.trim(),
      location: location.trim(),
      priority,
      status: isEdit ? (initialTask!.status) : 'pending',
      dueDate: dueTimestamp,
      projectId,
      repeatType,
      estimatedMinutes,
      voiceReminderEnabled: voiceEnabled,
      communicationTarget: isEdit ? initialTask!.communicationTarget : null,
      dependsOn,
    });
    onClose();
  };

  const handleDelete = () => {
    if (initialTask && onDelete) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      onDelete(initialTask.id);
      onClose();
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={s.backdrop}>
        <View style={s.sheet}>
          <View style={s.handle} />

          {/* Header */}
          <View style={s.header}>
            <Text style={s.headerTitle}>{isEdit ? 'Edit Task' : 'New Task'}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={24} color={COLORS.textSub} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

            {/* Templates (only for new tasks) */}
            {!isEdit && templates.length > 0 && (
              <>
                <Text style={s.label}>Start from template</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                  {templates.map((tpl) => (
                    <TouchableOpacity
                      key={tpl.id}
                      style={s.tplChip}
                      onPress={() => {
                        setTitle(tpl.title);
                        setDescription(tpl.description);
                        setPriority(tpl.priority);
                        setRepeatType(tpl.repeatType);
                        setEstimatedMinutes(tpl.estimatedMinutes);
                        setLocation(tpl.location ?? '');
                      }}
                    >
                      <Ionicons name="copy-outline" size={12} color={COLORS.primary} />
                      <Text style={s.tplChipText}>{tpl.name}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </>
            )}

            {/* Title */}
            <TextInput
              style={s.input}
              placeholder="What needs to be done?"
              placeholderTextColor={COLORS.textMuted}
              value={title}
              onChangeText={handleTitleChange}
              autoFocus={!isEdit}
            />
            {/* Due date hint chip */}
            {dueDateHint && (
              <TouchableOpacity style={s.hintChip} onPress={applyDueDateHint}>
                <Ionicons name="calendar-outline" size={13} color={COLORS.primary} />
                <Text style={s.hintChipText}>Set due: {dueDateHint.label}?</Text>
                <Ionicons name="checkmark" size={13} color={COLORS.primary} />
              </TouchableOpacity>
            )}

            {/* Notes */}
            <View style={s.notesHeader}>
              <Text style={s.notesLabel}>Notes</Text>
              {description.trim().length > 0 && (
                <TouchableOpacity style={s.sparkleBtn} onPress={handleImproveDescription} disabled={aiLoading}>
                  {aiLoading
                    ? <ActivityIndicator size="small" color={COLORS.primary} />
                    : <Ionicons name="sparkles" size={15} color={COLORS.primary} />}
                  <Text style={s.sparkleBtnText}>Improve</Text>
                </TouchableOpacity>
              )}
            </View>
            <TextInput
              style={[s.input, s.multiline]}
              placeholder="Notes (optional)"
              placeholderTextColor={COLORS.textMuted}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={2}
            />

            {/* Location */}
            <View style={s.locationRow}>
              <Ionicons name="location-outline" size={18} color={COLORS.textMuted} style={s.locationIcon} />
              <TextInput
                style={s.locationInput}
                placeholder="Location / address (optional)"
                placeholderTextColor={COLORS.textMuted}
                value={location}
                onChangeText={setLocation}
              />
            </View>

            {/* Date Strip */}
            <Text style={s.label}>Date</Text>
            <ScrollView
              ref={dateScrollRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              style={s.dateStrip}
              contentContainerStyle={s.dateStripContent}
            >
              {DAYS.map((day, i) => {
                const isSelected = dayIndex === i;
                const isToday = i === 0;
                return (
                  <TouchableOpacity
                    key={i}
                    style={[s.dayCell, isSelected && s.dayCellSelected]}
                    onPress={() => setDayIndex(i)}
                    activeOpacity={0.7}
                  >
                    <Text style={[s.dayName, isSelected && s.dayNameSelected]}>
                      {isToday ? 'Today' : DAY_NAMES[day.getDay()]}
                    </Text>
                    <Text style={[s.dayNum, isSelected && s.dayNumSelected]}>
                      {day.getDate()}
                    </Text>
                    <Text style={[s.dayMonth, isSelected && s.dayMonthSelected]}>
                      {MONTH_NAMES[day.getMonth()]}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Time Picker */}
            <View style={s.timeLabelRow}>
              <Text style={s.label}>Time</Text>
              <TouchableOpacity
                style={s.suggestTimeBtn}
                onPress={handleSuggestSchedule}
                disabled={schedLoading || !title.trim()}
              >
                {schedLoading
                  ? <ActivityIndicator size="small" color={COLORS.primary} />
                  : <Ionicons name="sparkles-outline" size={13} color={COLORS.primary} />}
                <Text style={s.suggestTimeBtnText}>Suggest Time</Text>
              </TouchableOpacity>
            </View>
            {schedSuggestion ? (
              <View style={s.schedCard}>
                <Ionicons name="bulb-outline" size={14} color={COLORS.primary} style={{ marginTop: 1 }} />
                <Text style={s.schedCardText}>{schedSuggestion}</Text>
              </View>
            ) : null}
            <View style={s.timePicker}>
              {/* Hour */}
              <View style={s.timeUnit}>
                <TouchableOpacity onPress={() => adjustHour(1)} style={s.timeBtn}>
                  <Ionicons name="chevron-up" size={18} color={COLORS.primary} />
                </TouchableOpacity>
                <Text style={s.timeValue}>{String(hour).padStart(2, '0')}</Text>
                <TouchableOpacity onPress={() => adjustHour(-1)} style={s.timeBtn}>
                  <Ionicons name="chevron-down" size={18} color={COLORS.primary} />
                </TouchableOpacity>
              </View>
              <Text style={s.timeSep}>:</Text>
              {/* Minute */}
              <View style={s.timeUnit}>
                <TouchableOpacity onPress={() => adjustMinute(1)} style={s.timeBtn}>
                  <Ionicons name="chevron-up" size={18} color={COLORS.primary} />
                </TouchableOpacity>
                <Text style={s.timeValue}>{String(minute).padStart(2, '0')}</Text>
                <TouchableOpacity onPress={() => adjustMinute(-1)} style={s.timeBtn}>
                  <Ionicons name="chevron-down" size={18} color={COLORS.primary} />
                </TouchableOpacity>
              </View>
              <Text style={s.timeHint}>
                {selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                {'  '}
                {String(hour).padStart(2, '0')}:{String(minute).padStart(2, '0')}
              </Text>
            </View>

            {/* Priority */}
            <Text style={s.label}>Priority</Text>
            <View style={s.row}>
              {PRIORITIES.map((p) => {
                const cfg = PRIORITY_CONFIG[p];
                const sel = priority === p;
                return (
                  <TouchableOpacity
                    key={p}
                    style={[s.chip, { borderColor: cfg.color, backgroundColor: sel ? cfg.bg : 'transparent' }]}
                    onPress={() => setPriority(p)}
                  >
                    <Text style={[s.chipText, { color: cfg.color }]}>{cfg.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Repeat */}
            <Text style={s.label}>Repeat</Text>
            <View style={[s.row, { marginBottom: 20 }]}>
              {REPEAT_TYPES.map((rt) => {
                const sel = repeatType === rt.value;
                return (
                  <TouchableOpacity
                    key={rt.value}
                    style={[s.chip, { borderColor: sel ? COLORS.primary : COLORS.surfaceBorder, backgroundColor: sel ? COLORS.primaryLight : 'transparent', flex: 1 }]}
                    onPress={() => setRepeatType(rt.value)}
                  >
                    <Text style={[s.chipText, { color: sel ? COLORS.primary : COLORS.textSub }]}>{rt.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Duration */}
            <Text style={s.label}>Estimated Duration</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
              {DURATION_OPTIONS.map((d) => {
                const sel = estimatedMinutes === d.value;
                return (
                  <TouchableOpacity
                    key={d.value}
                    style={[s.durationChip, sel && s.durationChipSel]}
                    onPress={() => setEstimatedMinutes(d.value)}
                  >
                    <Text style={[s.durationChipText, sel && s.durationChipTextSel]}>{d.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Project */}
            {projects.length > 0 && (
              <>
                <Text style={s.label}>Project</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                  <TouchableOpacity
                    style={[s.projChip, !projectId && s.projChipSel]}
                    onPress={() => setProjectId(null)}
                  >
                    <Text style={s.projChipText}>None</Text>
                  </TouchableOpacity>
                  {projects.map((proj) => (
                    <TouchableOpacity
                      key={proj.id}
                      style={[s.projChip, projectId === proj.id && s.projChipSel, { borderColor: proj.color }]}
                      onPress={() => setProjectId(proj.id)}
                    >
                      <View style={[s.dot, { backgroundColor: proj.color }]} />
                      <Text style={s.projChipText}>{proj.name}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </>
            )}

            {/* Blocked by (dependency) */}
            <Text style={s.label}>Blocked by</Text>
            {!showBlockerPicker ? (
              <TouchableOpacity
                style={[s.input, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}
                onPress={() => setShowBlockerPicker(true)}
                activeOpacity={0.75}
              >
                <Text style={{ color: dependsOn ? COLORS.text : COLORS.textMuted, fontSize: 15 }}>
                  {dependsOn
                    ? (allTasks.find((t) => t.id === dependsOn)?.title ?? 'Unknown task')
                    : 'None — tap to select'}
                </Text>
                {dependsOn ? (
                  <TouchableOpacity onPress={() => setDependsOn(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="close-circle" size={18} color={COLORS.textMuted} />
                  </TouchableOpacity>
                ) : (
                  <Ionicons name="chevron-down" size={16} color={COLORS.textMuted} />
                )}
              </TouchableOpacity>
            ) : (
              <View style={s.blockerPicker}>
                <TextInput
                  style={[s.input, { marginBottom: 8 }]}
                  placeholder="Search tasks…"
                  placeholderTextColor={COLORS.textMuted}
                  value={blockerSearch}
                  onChangeText={setBlockerSearch}
                  autoFocus
                />
                <ScrollView style={{ maxHeight: 180 }} keyboardShouldPersistTaps="handled">
                  <TouchableOpacity
                    style={s.blockerItem}
                    onPress={() => { setDependsOn(null); setShowBlockerPicker(false); setBlockerSearch(''); }}
                  >
                    <Ionicons name="remove-circle-outline" size={16} color={COLORS.textMuted} />
                    <Text style={[s.blockerItemText, { color: COLORS.textMuted }]}>None (remove blocker)</Text>
                  </TouchableOpacity>
                  {allTasks
                    .filter((t) =>
                      t.id !== initialTask?.id &&
                      t.status !== 'completed' &&
                      t.status !== 'cancelled' &&
                      (!blockerSearch.trim() || t.title.toLowerCase().includes(blockerSearch.toLowerCase()))
                    )
                    .slice(0, 20)
                    .map((t) => (
                      <TouchableOpacity
                        key={t.id}
                        style={[s.blockerItem, dependsOn === t.id && s.blockerItemActive]}
                        onPress={() => { setDependsOn(t.id); setShowBlockerPicker(false); setBlockerSearch(''); }}
                      >
                        <Ionicons name="lock-closed-outline" size={14} color={COLORS.primary} />
                        <Text style={s.blockerItemText} numberOfLines={1}>{t.title}</Text>
                      </TouchableOpacity>
                    ))}
                </ScrollView>
                <TouchableOpacity style={s.blockerCancel} onPress={() => { setShowBlockerPicker(false); setBlockerSearch(''); }}>
                  <Text style={{ color: COLORS.textMuted, fontSize: 13 }}>Cancel</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Voice reminder toggle */}
            <View style={s.toggleRow}>
              <Ionicons name="mic-outline" size={18} color={COLORS.textSub} />
              <Text style={s.toggleLabel}>Voice reminder</Text>
              <Switch
                value={voiceEnabled}
                onValueChange={setVoiceEnabled}
                trackColor={{ false: COLORS.surfaceBorder, true: COLORS.primaryLight }}
                thumbColor={voiceEnabled ? COLORS.primary : '#ccc'}
              />
            </View>

            {/* Subtasks — only shown when editing an existing task */}
            {isEdit && initialTask && (
              <View style={{ marginTop: 16 }}>
                <SubtaskList taskId={initialTask.id} editable />
              </View>
            )}

            <View style={{ height: 8 }} />
          </ScrollView>

          {/* Buttons */}
          <TouchableOpacity style={s.saveBtn} onPress={handleSave}>
            <Text style={s.saveBtnText}>{isEdit ? 'Save Changes' : 'Add Task'}</Text>
          </TouchableOpacity>

          {isEdit && onDelete && (
            <TouchableOpacity style={s.deleteBtn} onPress={handleDelete}>
              <Ionicons name="trash-outline" size={16} color={COLORS.danger} />
              <Text style={s.deleteBtnText}>Delete Task</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 28,
    maxHeight: '92%',
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: COLORS.surfaceBorder, alignSelf: 'center', marginBottom: 18 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  headerTitle: { color: COLORS.text, fontSize: 20, fontWeight: '700' },

  input: {
    backgroundColor: COLORS.cardAlt,
    borderRadius: 14,
    padding: 14,
    color: COLORS.text,
    fontSize: 15,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.surfaceBorder,
  },
  multiline: { height: 72, textAlignVertical: 'top' },
  notesHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, marginTop: 8 },
  notesLabel: { fontSize: 13, fontWeight: '600', color: COLORS.textSub },
  sparkleBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, backgroundColor: COLORS.primaryLight },
  sparkleBtnText: { fontSize: 12, fontWeight: '700', color: COLORS.primary },

  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.cardAlt,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.surfaceBorder,
    marginBottom: 20,
    paddingLeft: 12,
  },
  locationIcon: { marginRight: 6 },
  locationInput: { flex: 1, paddingVertical: 14, paddingRight: 14, color: COLORS.text, fontSize: 15 },

  label: { color: COLORS.textSub, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 },

  // Due date hint chip
  hintChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
    backgroundColor: COLORS.primaryLight, borderWidth: 1, borderColor: COLORS.primary,
    marginBottom: 12,
  },
  hintChipText: { color: COLORS.primary, fontSize: 13, fontWeight: '600' },

  // Time label row (with Suggest Time button)
  timeLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  suggestTimeBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14, backgroundColor: COLORS.primaryLight, borderWidth: 1, borderColor: COLORS.primary },
  suggestTimeBtnText: { color: COLORS.primary, fontSize: 12, fontWeight: '600' },

  // Schedule suggestion card
  schedCard: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', backgroundColor: COLORS.primaryLight, borderRadius: 12, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: COLORS.primary + '40' },
  schedCardText: { flex: 1, color: COLORS.text, fontSize: 13, lineHeight: 18 },

  // Date strip
  dateStrip: { marginBottom: 20 },
  dateStripContent: { paddingRight: 16, gap: 8 },
  dayCell: {
    width: 62, paddingVertical: 10, borderRadius: 16, alignItems: 'center',
    borderWidth: 1, borderColor: COLORS.surfaceBorder, backgroundColor: COLORS.cardAlt,
  },
  dayCellSelected: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  dayName: { fontSize: 11, fontWeight: '600', color: COLORS.textMuted, marginBottom: 3 },
  dayNameSelected: { color: 'rgba(255,255,255,0.85)' },
  dayNum: { fontSize: 20, fontWeight: '800', color: COLORS.text },
  dayNumSelected: { color: '#fff' },
  dayMonth: { fontSize: 10, color: COLORS.textMuted, marginTop: 2 },
  dayMonthSelected: { color: 'rgba(255,255,255,0.75)' },

  // Time picker
  timePicker: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  timeUnit: { alignItems: 'center' },
  timeBtn: { padding: 6 },
  timeValue: { fontSize: 28, fontWeight: '800', color: COLORS.text, width: 52, textAlign: 'center' },
  timeSep: { fontSize: 28, fontWeight: '800', color: COLORS.textMuted, marginBottom: 6 },
  timeHint: { flex: 1, fontSize: 13, color: COLORS.textSub, fontWeight: '500' },

  // Priority chips
  row: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  chip: { flex: 1, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, alignItems: 'center' },
  chipText: { fontSize: 13, fontWeight: '700' },

  // Template chips
  tplChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    borderWidth: 1, borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryLight, marginRight: 8,
  },
  tplChipText: { color: COLORS.primary, fontSize: 13, fontWeight: '600' },

  // Project chips
  projChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    borderWidth: 1, borderColor: COLORS.surfaceBorder,
    backgroundColor: COLORS.cardAlt, marginRight: 8,
  },
  projChipSel: { backgroundColor: COLORS.primaryLight, borderColor: COLORS.primary },
  projChipText: { color: COLORS.text, fontSize: 13, fontWeight: '500' },
  dot: { width: 8, height: 8, borderRadius: 4 },

  // Voice toggle
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  toggleLabel: { flex: 1, color: COLORS.text, fontSize: 15, fontWeight: '500' },

  // Duration chips
  durationChip: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
    borderWidth: 1.5, borderColor: COLORS.surfaceBorder,
    backgroundColor: COLORS.cardAlt, marginRight: 8,
  },
  durationChipSel: { backgroundColor: COLORS.primaryLight, borderColor: COLORS.primary },
  durationChipText: { fontSize: 13, fontWeight: '600', color: COLORS.textSub },
  durationChipTextSel: { color: COLORS.primary },

  // Save / delete
  saveBtn: { backgroundColor: COLORS.primary, borderRadius: 16, padding: 16, alignItems: 'center', marginTop: 14 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  deleteBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 12, padding: 10 },
  deleteBtnText: { color: COLORS.danger, fontSize: 15, fontWeight: '600' },
  // Blocker picker
  blockerPicker: { backgroundColor: COLORS.cardAlt, borderRadius: 14, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: COLORS.surfaceBorder },
  blockerItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 8, borderRadius: 10 },
  blockerItemActive: { backgroundColor: COLORS.primaryLight },
  blockerItemText: { flex: 1, fontSize: 14, color: COLORS.text },
  blockerCancel: { alignItems: 'center', paddingTop: 8 },
});
