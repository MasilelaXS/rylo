import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
    Alert,
    Modal,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { scheduleTaskReminder } from '../../src/notifications/notificationService';
import { useProjectStore } from '../../src/store/projectStore';
import { useTaskStore } from '../../src/store/taskStore';
import { type TaskTemplate, useTemplateStore } from '../../src/store/templateStore';
import type { Priority, RepeatType } from '../../src/types';
import { CARD_SHADOW, COLORS, PRIORITY_CONFIG, generateId } from '../../src/utils/constants';

// ─── Constants ────────────────────────────────────────────────────────────────
const PRIORITIES: { value: Priority; label: string; color: string }[] = [
  { value: 'low',    label: 'Low',    color: '#6B7CFF' },
  { value: 'medium', label: 'Medium', color: '#F59E0B' },
  { value: 'high',   label: 'High',   color: '#FF7DA0' },
  { value: 'urgent', label: 'Urgent', color: '#FF4444' },
];

const REPEAT_TYPES: { value: RepeatType; label: string }[] = [
  { value: 'none',    label: 'Once'    },
  { value: 'daily',   label: 'Daily'   },
  { value: 'weekly',  label: 'Weekly'  },
  { value: 'monthly', label: 'Monthly' },
];

const DURATION_OPTIONS = [
  { value: 0,   label: '—'   },
  { value: 15,  label: '15m' },
  { value: 30,  label: '30m' },
  { value: 45,  label: '45m' },
  { value: 60,  label: '1h'  },
  { value: 90,  label: '1.5h'},
  { value: 120, label: '2h'  },
  { value: 180, label: '3h'  },
];

// ─── Template editor modal ────────────────────────────────────────────────────
function TemplateEditorModal({
  visible,
  initial,
  onClose,
  onSave,
}: {
  visible: boolean;
  initial?: TaskTemplate | null;
  onClose: () => void;
  onSave: (data: Omit<TaskTemplate, 'id'>) => void;
}) {
  const [name,              setName]              = useState('');
  const [title,             setTitle]             = useState('');
  const [description,       setDescription]       = useState('');
  const [location,          setLocation]          = useState('');
  const [priority,          setPriority]          = useState<Priority>('medium');
  const [estimatedMinutes,  setEstimatedMinutes]  = useState(0);
  const [repeatType,        setRepeatType]        = useState<RepeatType>('none');

  useEffect(() => {
    if (visible) {
      if (initial) {
        setName(initial.name);
        setTitle(initial.title);
        setDescription(initial.description);
        setLocation(initial.location);
        setPriority(initial.priority);
        setEstimatedMinutes(initial.estimatedMinutes);
        setRepeatType(initial.repeatType);
      } else {
        setName(''); setTitle(''); setDescription(''); setLocation('');
        setPriority('medium'); setEstimatedMinutes(0); setRepeatType('none');
      }
    }
  }, [visible, initial]);

  function handleSave() {
    if (!name.trim() || !title.trim()) {
      Alert.alert('Missing info', 'Template name and task title are required.');
      return;
    }
    onSave({ name: name.trim(), title: title.trim(), description, location, priority, estimatedMinutes, repeatType });
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={e.safe} edges={['top', 'bottom']}>
        <View style={e.header}>
          <TouchableOpacity onPress={onClose} style={e.closeBtn}>
            <Ionicons name="close" size={22} color={COLORS.textMuted} />
          </TouchableOpacity>
          <Text style={e.headerTitle}>{initial ? 'Edit Template' : 'New Template'}</Text>
          <TouchableOpacity onPress={handleSave} style={e.saveBtn}>
            <Text style={e.saveBtnText}>Save</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={e.scroll} contentContainerStyle={e.content} showsVerticalScrollIndicator={false}>

          {/* Template name */}
          <Text style={e.label}>Template Name</Text>
          <TextInput
            style={e.input}
            placeholder="e.g. Daily Standup"
            placeholderTextColor={COLORS.textMuted}
            value={name}
            onChangeText={setName}
          />

          {/* Task title */}
          <Text style={[e.label, { marginTop: 16 }]}>Task Title</Text>
          <TextInput
            style={e.input}
            placeholder="What needs to be done?"
            placeholderTextColor={COLORS.textMuted}
            value={title}
            onChangeText={setTitle}
          />

          {/* Description */}
          <Text style={[e.label, { marginTop: 16 }]}>Description</Text>
          <TextInput
            style={[e.input, { minHeight: 72, textAlignVertical: 'top' }]}
            placeholder="Optional details..."
            placeholderTextColor={COLORS.textMuted}
            value={description}
            onChangeText={setDescription}
            multiline
          />

          {/* Location */}
          <Text style={[e.label, { marginTop: 16 }]}>Location</Text>
          <TextInput
            style={e.input}
            placeholder="Optional location"
            placeholderTextColor={COLORS.textMuted}
            value={location}
            onChangeText={setLocation}
          />

          {/* Priority */}
          <Text style={[e.label, { marginTop: 16 }]}>Priority</Text>
          <View style={e.chipRow}>
            {PRIORITIES.map((p) => (
              <TouchableOpacity
                key={p.value}
                style={[e.chip, priority === p.value && { backgroundColor: p.color, borderColor: p.color }]}
                onPress={() => setPriority(p.value)}
              >
                <Text style={[e.chipText, priority === p.value && { color: '#fff' }]}>{p.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Duration */}
          <Text style={[e.label, { marginTop: 16 }]}>Estimated Duration</Text>
          <View style={e.chipRow}>
            {DURATION_OPTIONS.map((d) => (
              <TouchableOpacity
                key={d.value}
                style={[e.chip, estimatedMinutes === d.value && e.chipActive]}
                onPress={() => setEstimatedMinutes(d.value)}
              >
                <Text style={[e.chipText, estimatedMinutes === d.value && e.chipTextActive]}>{d.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Repeat */}
          <Text style={[e.label, { marginTop: 16 }]}>Repeat</Text>
          <View style={e.chipRow}>
            {REPEAT_TYPES.map((r) => (
              <TouchableOpacity
                key={r.value}
                style={[e.chip, repeatType === r.value && e.chipActive]}
                onPress={() => setRepeatType(r.value)}
              >
                <Text style={[e.chipText, repeatType === r.value && e.chipTextActive]}>{r.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={{ height: 32 }} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const e = StyleSheet.create({
  safe:       { flex: 1, backgroundColor: COLORS.bg },
  header:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.cardAlt },
  closeBtn:   { padding: 4 },
  headerTitle:{ flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '700', color: COLORS.text },
  saveBtn:    { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: COLORS.primary, borderRadius: 10 },
  saveBtnText:{ color: '#fff', fontWeight: '700', fontSize: 14 },
  scroll:     { flex: 1 },
  content:    { padding: 16 },
  label:      { fontSize: 13, fontWeight: '600', color: COLORS.textSub, marginBottom: 6, letterSpacing: 0.3 },
  input: {
    backgroundColor: COLORS.cardAlt, borderRadius: 12, padding: 12,
    fontSize: 15, color: COLORS.text, borderWidth: 1, borderColor: '#E8EAF0',
  },
  chipRow:       { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip:          { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10, backgroundColor: COLORS.cardAlt, borderWidth: 1, borderColor: '#E8EAF0' },
  chipActive:    { backgroundColor: COLORS.primaryLight, borderColor: COLORS.primary },
  chipText:      { fontSize: 13, color: COLORS.textSub, fontWeight: '600' },
  chipTextActive:{ color: COLORS.primary },
});

// ─── Use Template modal (date picker) ─────────────────────────────────────────
const HOURS    = Array.from({ length: 24 }, (_, i) => i);
const MINUTES  = [0, 15, 30, 45];
const MONTH_ABB = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function UseTemplateModal({
  visible,
  template,
  onClose,
  onConfirm,
}: {
  visible: boolean;
  template: TaskTemplate | null;
  onClose: () => void;
  onConfirm: (date: Date) => void;
}) {
  const [hour,   setHour]   = useState(9);
  const [minute, setMinute] = useState(0);
  const [daysAhead, setDaysAhead] = useState(0);

  useEffect(() => {
    if (visible) { setHour(9); setMinute(0); setDaysAhead(0); }
  }, [visible]);

  if (!template) return null;

  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + daysAhead);
  targetDate.setHours(hour, minute, 0, 0);

  const pConfig = PRIORITY_CONFIG[template.priority];

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={u.overlay}>
        <View style={u.sheet}>
          <Text style={u.sheetTitle}>Schedule Task</Text>
          <Text style={u.sheetSub}>From template: <Text style={{ fontWeight: '700' }}>{template.name}</Text></Text>

          {/* Task preview */}
          <View style={[u.preview, { borderLeftColor: pConfig.color }]}>
            <Text style={u.previewTitle}>{template.title}</Text>
            <Text style={u.previewMeta}>
              {pConfig.label}{template.estimatedMinutes ? ` · ${template.estimatedMinutes}m` : ''}
              {template.repeatType !== 'none' ? ` · Repeats ${template.repeatType}` : ''}
            </Text>
          </View>

          {/* Day picker */}
          <Text style={u.fieldLabel}>Day</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
            {[0, 1, 2, 3, 4, 5, 6, 7].map((d) => {
              const dt = new Date(); dt.setDate(dt.getDate() + d); dt.setHours(0, 0, 0, 0);
              const label = d === 0 ? 'Today' : d === 1 ? 'Tomorrow' : `${MONTH_ABB[dt.getMonth()]} ${dt.getDate()}`;
              return (
                <TouchableOpacity
                  key={d}
                  style={[u.dayChip, daysAhead === d && u.dayChipActive]}
                  onPress={() => setDaysAhead(d)}
                >
                  <Text style={[u.dayChipText, daysAhead === d && u.dayChipTextActive]}>{label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Time picker */}
          <Text style={[u.fieldLabel, { marginTop: 12 }]}>Time</Text>
          <View style={u.timeRow}>
            <ScrollView style={u.timeScroll} showsVerticalScrollIndicator={false}>
              {HOURS.map((h) => (
                <TouchableOpacity
                  key={h}
                  style={[u.timeItem, hour === h && u.timeItemActive]}
                  onPress={() => setHour(h)}
                >
                  <Text style={[u.timeItemText, hour === h && u.timeItemTextActive]}>
                    {h === 0 ? '12 AM' : h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h - 12} PM`}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <ScrollView style={u.timeScroll} showsVerticalScrollIndicator={false}>
              {MINUTES.map((m) => (
                <TouchableOpacity
                  key={m}
                  style={[u.timeItem, minute === m && u.timeItemActive]}
                  onPress={() => setMinute(m)}
                >
                  <Text style={[u.timeItemText, minute === m && u.timeItemTextActive]}>:{String(m).padStart(2, '0')}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Confirm */}
          <TouchableOpacity style={u.confirmBtn} onPress={() => onConfirm(targetDate)} activeOpacity={0.85}>
            <Ionicons name="checkmark-circle" size={18} color="#fff" />
            <Text style={u.confirmText}>
              Schedule for {MONTH_ABB[targetDate.getMonth()]} {targetDate.getDate()} at{' '}
              {targetDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onClose} style={u.cancelBtn}>
            <Text style={u.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const u = StyleSheet.create({
  overlay:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet:     { backgroundColor: COLORS.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 32, gap: 10 },
  sheetTitle:{ fontSize: 18, fontWeight: '800', color: COLORS.text },
  sheetSub:  { fontSize: 13, color: COLORS.textMuted },
  preview:   { backgroundColor: COLORS.cardAlt, borderRadius: 12, padding: 12, borderLeftWidth: 3, marginVertical: 4 },
  previewTitle:{ fontSize: 15, fontWeight: '700', color: COLORS.text },
  previewMeta: { fontSize: 12, color: COLORS.textMuted, marginTop: 3 },
  fieldLabel:  { fontSize: 12, fontWeight: '600', color: COLORS.textSub, letterSpacing: 0.3 },
  dayChip:     { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: COLORS.cardAlt, borderWidth: 1, borderColor: '#E8EAF0' },
  dayChipActive:    { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  dayChipText:      { fontSize: 13, color: COLORS.textSub, fontWeight: '600' },
  dayChipTextActive:{ color: '#fff' },
  timeRow:   { flexDirection: 'row', gap: 8, height: 140 },
  timeScroll:{ flex: 1, backgroundColor: COLORS.cardAlt, borderRadius: 12 },
  timeItem:  { paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
  timeItemActive:    { backgroundColor: COLORS.primary },
  timeItemText:      { fontSize: 14, color: COLORS.textSub, fontWeight: '600' },
  timeItemTextActive:{ color: '#fff' },
  confirmBtn:{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: COLORS.success, borderRadius: 14, paddingVertical: 14, marginTop: 4 },
  confirmText:{ color: '#fff', fontWeight: '700', fontSize: 15 },
  cancelBtn: { alignItems: 'center', paddingVertical: 10 },
  cancelText:{ fontSize: 14, color: COLORS.textMuted },
});

// ─── Template card ────────────────────────────────────────────────────────────
function TemplateCard({
  template,
  onUse,
  onEdit,
  onDelete,
}: {
  template: TaskTemplate;
  onUse: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const p = PRIORITY_CONFIG[template.priority];
  return (
    <View style={[tc.card, { borderLeftColor: p.color }]}>
      <View style={tc.top}>
        <View style={[tc.icon, { backgroundColor: `${p.color}18` }]}>
          <Ionicons name="copy-outline" size={18} color={p.color} />
        </View>
        <View style={tc.body}>
          <Text style={tc.name}>{template.name}</Text>
          <Text style={tc.taskTitle} numberOfLines={1}>{template.title}</Text>
        </View>
        <TouchableOpacity onPress={onEdit} style={tc.iconBtn} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
          <Ionicons name="pencil-outline" size={16} color={COLORS.textMuted} />
        </TouchableOpacity>
        <TouchableOpacity onPress={onDelete} style={tc.iconBtn} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
          <Ionicons name="trash-outline" size={16} color={COLORS.danger} />
        </TouchableOpacity>
      </View>

      {template.description ? (
        <Text style={tc.desc} numberOfLines={2}>{template.description}</Text>
      ) : null}

      <View style={tc.meta}>
        <View style={[tc.badge, { backgroundColor: `${p.color}18` }]}>
          <Text style={[tc.badgeText, { color: p.color }]}>{p.label}</Text>
        </View>
        {template.estimatedMinutes > 0 && (
          <View style={tc.badge}>
            <Ionicons name="time-outline" size={11} color={COLORS.textMuted} />
            <Text style={tc.badgeText}>
              {template.estimatedMinutes < 60
                ? `${template.estimatedMinutes}m`
                : `${template.estimatedMinutes / 60}h`}
            </Text>
          </View>
        )}
        {template.repeatType !== 'none' && (
          <View style={tc.badge}>
            <Ionicons name="repeat-outline" size={11} color={COLORS.textMuted} />
            <Text style={tc.badgeText}>{template.repeatType}</Text>
          </View>
        )}
        {template.location ? (
          <View style={tc.badge}>
            <Ionicons name="location-outline" size={11} color={COLORS.textMuted} />
            <Text style={tc.badgeText} numberOfLines={1}>{template.location}</Text>
          </View>
        ) : null}
      </View>

      <TouchableOpacity style={tc.useBtn} onPress={onUse} activeOpacity={0.85}>
        <Ionicons name="flash-outline" size={15} color="#fff" />
        <Text style={tc.useBtnText}>Use Template</Text>
      </TouchableOpacity>
    </View>
  );
}

const tc = StyleSheet.create({
  card: {
    backgroundColor: COLORS.card, borderRadius: 18, padding: 14,
    borderLeftWidth: 4, ...CARD_SHADOW, gap: 10, marginBottom: 10,
  },
  top:       { flexDirection: 'row', alignItems: 'center', gap: 10 },
  icon:      { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  body:      { flex: 1 },
  name:      { fontSize: 15, fontWeight: '800', color: COLORS.text },
  taskTitle: { fontSize: 12, color: COLORS.textSub, marginTop: 1 },
  iconBtn:   { padding: 4 },
  desc:      { fontSize: 13, color: COLORS.textSub, lineHeight: 18 },
  meta:      { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  badge:     { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, backgroundColor: COLORS.cardAlt, borderRadius: 7 },
  badgeText: { fontSize: 11, color: COLORS.textMuted, fontWeight: '600' },
  useBtn:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: COLORS.primary, borderRadius: 12, paddingVertical: 10 },
  useBtnText:{ fontSize: 13, fontWeight: '700', color: '#fff' },
});

// ─── Screen ──────────────────────────────────────────────────────────────────
export default function TemplatesScreen() {
  const router   = useRouter();
  const { templates, load, addTemplate, updateTemplate, removeTemplate } = useTemplateStore();
  const { addTask }      = useTaskStore();
  const { projects }     = useProjectStore();

  const [editorVisible,  setEditorVisible]  = useState(false);
  const [editingTpl,     setEditingTpl]     = useState<TaskTemplate | null>(null);
  const [useModalTpl,    setUseModalTpl]    = useState<TaskTemplate | null>(null);

  useEffect(() => { load(); }, []);

  function handleEdit(tpl: TaskTemplate) {
    setEditingTpl(tpl);
    setEditorVisible(true);
  }

  function handleNew() {
    setEditingTpl(null);
    setEditorVisible(true);
  }

  async function handleSaveTemplate(data: Omit<TaskTemplate, 'id'>) {
    if (editingTpl) {
      await updateTemplate(editingTpl.id, data);
    } else {
      await addTemplate(data);
    }
    setEditorVisible(false);
  }

  function handleDelete(tpl: TaskTemplate) {
    Alert.alert(
      'Delete Template',
      `Delete "${tpl.name}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => removeTemplate(tpl.id) },
      ],
    );
  }

  async function handleUseTemplate(tpl: TaskTemplate, date: Date) {
    const task = {
      id:                 generateId(),
      title:              tpl.title,
      description:        tpl.description,
      dueDate:            date.getTime(),
      priority:           tpl.priority,
      status:             'pending' as const,
      projectId:          null,
      repeatType:         tpl.repeatType,
      voiceReminderEnabled: true,
      communicationTarget:  null,
      location:           tpl.location,
      estimatedMinutes:   tpl.estimatedMinutes,
      createdAt:          Date.now(),
      escalationLevel:    0,
      snoozeCount:        0,
    };
    await addTask(task);
    await scheduleTaskReminder(task).catch(() => {});
    setUseModalTpl(null);
    Alert.alert('Task Created', `"${tpl.title}" has been added to your tasks.`);
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
            <Text style={s.title}>Templates</Text>
            <Text style={s.subtitle}>{templates.length} template{templates.length !== 1 ? 's' : ''}</Text>
          </View>
          <TouchableOpacity onPress={handleNew} style={s.addBtn}>
            <Ionicons name="add" size={20} color="#fff" />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={s.scroll}
          contentContainerStyle={s.content}
          showsVerticalScrollIndicator={false}
        >
          {/* Info card */}
          <View style={s.infoCard}>
            <Ionicons name="copy-outline" size={18} color={COLORS.primary} />
            <Text style={s.infoText}>
              Templates let you instantly create recurring tasks. Tap <Text style={{ fontWeight: '700' }}>Use Template</Text> to schedule one in seconds.
            </Text>
          </View>

          {/* Template list */}
          {templates.length === 0 ? (
            <View style={s.empty}>
              <Ionicons name="copy-outline" size={48} color={COLORS.textMuted} />
              <Text style={s.emptyTitle}>No templates yet</Text>
              <Text style={s.emptySub}>Tap + to create your first reusable task template.</Text>
              <TouchableOpacity style={s.emptyBtn} onPress={handleNew}>
                <Text style={s.emptyBtnText}>Create Template</Text>
              </TouchableOpacity>
            </View>
          ) : (
            templates.map((tpl) => (
              <TemplateCard
                key={tpl.id}
                template={tpl}
                onUse={() => setUseModalTpl(tpl)}
                onEdit={() => handleEdit(tpl)}
                onDelete={() => handleDelete(tpl)}
              />
            ))
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>

      {/* Modals */}
      <TemplateEditorModal
        visible={editorVisible}
        initial={editingTpl}
        onClose={() => setEditorVisible(false)}
        onSave={handleSaveTemplate}
      />

      <UseTemplateModal
        visible={useModalTpl !== null}
        template={useModalTpl}
        onClose={() => setUseModalTpl(null)}
        onConfirm={(date) => handleUseTemplate(useModalTpl!, date)}
      />
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
  subtitle: { fontSize: 12, color: COLORS.textMuted, marginTop: 1 },
  addBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center',
  },

  scroll:  { flex: 1 },
  content: { paddingHorizontal: 16, paddingBottom: 40 },

  infoCard: {
    flexDirection: 'row', gap: 10, alignItems: 'flex-start',
    backgroundColor: COLORS.primaryLight, borderRadius: 14, padding: 12, marginBottom: 14,
  },
  infoText: { flex: 1, fontSize: 13, color: COLORS.primary, lineHeight: 20 },

  empty:     { alignItems: 'center', paddingVertical: 48, gap: 12 },
  emptyTitle:{ fontSize: 18, fontWeight: '700', color: COLORS.textSub },
  emptySub:  { fontSize: 13, color: COLORS.textMuted, textAlign: 'center', maxWidth: 260 },
  emptyBtn:  { paddingHorizontal: 20, paddingVertical: 12, backgroundColor: COLORS.primary, borderRadius: 14, marginTop: 4 },
  emptyBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
});
