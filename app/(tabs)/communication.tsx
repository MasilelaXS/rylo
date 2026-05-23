import { Ionicons } from '@expo/vector-icons';
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
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
    deleteLog,
    getAllLogs,
    insertLog,
} from '../../src/database/communication';
import { useTaskStore } from '../../src/store/taskStore';
import type { CommunicationLog, CommunicationType, Urgency } from '../../src/types';
import { CARD_SHADOW_SM, COLORS, COMMUNICATION_TYPES, generateId } from '../../src/utils/constants';

const URGENCY_CONFIG: Record<Urgency, { label: string; color: string; bg: string }> = {
  low:      { label: 'Low',      color: '#2ECC9A', bg: '#E5FAF2' },
  medium:   { label: 'Medium',   color: '#F59E0B', bg: '#FFF3DC' },
  high:     { label: 'High',     color: '#FF7043', bg: '#FFF0EB' },
  critical: { label: 'Critical', color: '#FF4444', bg: '#FFE8E8' },
};

const TYPE_ICONS: Record<CommunicationType, string> = {
  call:       'call-outline',
  email:      'mail-outline',
  message:    'chatbubble-outline',
  meeting:    'people-outline',
  apology:    'heart-outline',
  'follow-up':'refresh-outline',
  inform:     'information-circle-outline',
};

function LogCard({ log, taskTitle, onDelete }: { log: CommunicationLog; taskTitle?: string; onDelete: () => void }) {
  const urgency = URGENCY_CONFIG[log.urgency];
  const date = new Date(log.timestamp);
  const dateLabel = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
    ' · ' + date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  return (
    <View style={s.card}>
      <View style={s.cardHeader}>
        <View style={s.typeRow}>
          <Ionicons
            name={(TYPE_ICONS[log.communicationType] ?? 'chatbubble-outline') as any}
            size={16}
            color={COLORS.primary}
          />
          <Text style={s.typeLabel}>{log.communicationType.replace('-', ' ')}</Text>
          <View style={[s.urgencyBadge, { backgroundColor: urgency.bg }]}>
            <Text style={[s.urgencyText, { color: urgency.color }]}>{urgency.label}</Text>
          </View>
        </View>
        <TouchableOpacity onPress={onDelete} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="trash-outline" size={15} color={COLORS.textMuted} />
        </TouchableOpacity>
      </View>

      <Text style={s.person}>{log.personName || 'Unknown person'}</Text>
      {taskTitle ? (
        <Text style={s.taskRef} numberOfLines={1}>
          <Ionicons name="link-outline" size={11} color={COLORS.textMuted} /> {taskTitle}
        </Text>
      ) : null}
      {log.outcome ? <Text style={s.outcome}>{log.outcome}</Text> : null}
      {log.draftMessage ? (
        <View style={s.draftBox}>
          <Text style={s.draftLabel}>Draft</Text>
          <Text style={s.draftText} numberOfLines={3}>{log.draftMessage}</Text>
        </View>
      ) : null}
      <Text style={s.date}>{dateLabel}</Text>
    </View>
  );
}

export default function CommunicationScreen() {
  const { tasks, loadAll } = useTaskStore();
  const insets = useSafeAreaInsets();
  const fabBottom = Math.max(insets.bottom, 8) + 14 + 68 + 16;

  const [logs, setLogs] = useState<CommunicationLog[]>([]);
  const [filterType, setFilterType] = useState<CommunicationType | 'all'>('all');
  const [showAdd, setShowAdd] = useState(false);

  // Add form state
  const [person, setPerson]     = useState('');
  const [type, setType]         = useState<CommunicationType>('message');
  const [urgency, setUrgency]   = useState<Urgency>('medium');
  const [outcome, setOutcome]   = useState('');
  const [draft, setDraft]       = useState('');
  const [taskId, setTaskId]     = useState<string | null>(null);

  const load = async () => { setLogs(await getAllLogs()); };

  useEffect(() => { load(); loadAll(); }, []);

  const filtered = filterType === 'all'
    ? logs
    : logs.filter((l) => l.communicationType === filterType);

  const handleSave = async () => {
    const log: CommunicationLog = {
      id: generateId(),
      taskId: taskId ?? '',
      personName: person.trim(),
      communicationType: type,
      outcome: outcome.trim(),
      draftMessage: draft.trim(),
      urgency,
      timestamp: Date.now(),
    };
    await insertLog(log);
    setPerson(''); setOutcome(''); setDraft(''); setTaskId(null);
    setType('message'); setUrgency('medium');
    setShowAdd(false);
    load();
  };

  const handleDelete = (id: string) => {
    Alert.alert('Delete Log', 'Remove this communication log?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await deleteLog(id); load(); } },
    ]);
  };

  const URGENCY_LEVELS: Urgency[] = ['low', 'medium', 'high', 'critical'];

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <SafeAreaView style={s.safe} edges={['top']}>

        {/* Header */}
        <View style={s.header}>
          <Text style={s.title}>Communication</Text>
          <Text style={s.subtitle}>{logs.length} log{logs.length !== 1 ? 's' : ''}</Text>
        </View>

        {/* Filter bar */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterBar} contentContainerStyle={s.filterContent}>
          {(['all', ...COMMUNICATION_TYPES] as const).map((t) => (
            <TouchableOpacity
              key={t}
              style={[s.filterChip, filterType === t && s.filterChipActive]}
              onPress={() => setFilterType(t)}
            >
              {t !== 'all' && (
                <Ionicons
                  name={(TYPE_ICONS[t as CommunicationType] ?? 'chatbubble-outline') as any}
                  size={13}
                  color={filterType === t ? COLORS.primary : COLORS.textSub}
                />
              )}
              <Text style={[s.filterChipText, filterType === t && s.filterChipTextActive]}>
                {t === 'all' ? 'All' : t.replace('-', ' ')}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Log list */}
        <ScrollView
          style={s.scroll}
          contentContainerStyle={[s.list, { paddingBottom: fabBottom + 20 }]}
          showsVerticalScrollIndicator={false}
        >
          {filtered.length === 0 ? (
            <View style={s.empty}>
              <Ionicons name="chatbubbles-outline" size={52} color={COLORS.textMuted} />
              <Text style={s.emptyTitle}>No logs yet</Text>
              <Text style={s.emptySub}>Tap + to log a call, email, or message</Text>
            </View>
          ) : (
            filtered.map((log) => {
              const linked = tasks.find((t) => t.id === log.taskId);
              return (
                <LogCard
                  key={log.id}
                  log={log}
                  taskTitle={linked?.title}
                  onDelete={() => handleDelete(log.id)}
                />
              );
            })
          )}
        </ScrollView>
      </SafeAreaView>

      {/* FAB */}
      <TouchableOpacity
        style={[s.fab, { bottom: fabBottom }]}
        onPress={() => setShowAdd(true)}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={26} color="#fff" />
      </TouchableOpacity>

      {/* Add modal */}
      <Modal visible={showAdd} animationType="slide" transparent onRequestClose={() => setShowAdd(false)}>
        <View style={s.backdrop}>
          <View style={s.sheet}>
            <View style={s.handle} />
            <View style={s.sheetHeader}>
              <Text style={s.sheetTitle}>New Log</Text>
              <TouchableOpacity onPress={() => setShowAdd(false)}>
                <Ionicons name="close" size={22} color={COLORS.textSub} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={s.fieldLabel}>Person / Contact</Text>
              <TextInput
                style={s.input}
                placeholder="Who did you communicate with?"
                placeholderTextColor={COLORS.textMuted}
                value={person}
                onChangeText={setPerson}
                autoFocus
              />

              <Text style={s.fieldLabel}>Type</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                {(COMMUNICATION_TYPES as readonly CommunicationType[]).map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={[s.typeChip, type === t && s.typeChipSel]}
                    onPress={() => setType(t)}
                  >
                    <Ionicons
                      name={(TYPE_ICONS[t] ?? 'chatbubble-outline') as any}
                      size={13}
                      color={type === t ? COLORS.primary : COLORS.textSub}
                    />
                    <Text style={[s.typeChipText, type === t && s.typeChipTextSel]}>{t.replace('-', ' ')}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={s.fieldLabel}>Urgency</Text>
              <View style={s.urgencyRow}>
                {URGENCY_LEVELS.map((u) => {
                  const cfg = URGENCY_CONFIG[u];
                  return (
                    <TouchableOpacity
                      key={u}
                      style={[s.urgencyChip, urgency === u && { backgroundColor: cfg.bg, borderColor: cfg.color }]}
                      onPress={() => setUrgency(u)}
                    >
                      <Text style={[s.urgencyChipText, urgency === u && { color: cfg.color }]}>{cfg.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={s.fieldLabel}>Outcome / Notes</Text>
              <TextInput
                style={[s.input, s.multiline]}
                placeholder="What was the result or key takeaway?"
                placeholderTextColor={COLORS.textMuted}
                value={outcome}
                onChangeText={setOutcome}
                multiline
                numberOfLines={3}
              />

              <Text style={s.fieldLabel}>Draft Message (optional)</Text>
              <TextInput
                style={[s.input, s.multiline]}
                placeholder="Draft a follow-up message…"
                placeholderTextColor={COLORS.textMuted}
                value={draft}
                onChangeText={setDraft}
                multiline
                numberOfLines={3}
              />

              {tasks.length > 0 && (
                <>
                  <Text style={s.fieldLabel}>Link to Task (optional)</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                    <TouchableOpacity
                      style={[s.taskChip, !taskId && s.taskChipSel]}
                      onPress={() => setTaskId(null)}
                    >
                      <Text style={s.taskChipText}>None</Text>
                    </TouchableOpacity>
                    {tasks.filter((t) => t.status !== 'completed').slice(0, 20).map((t) => (
                      <TouchableOpacity
                        key={t.id}
                        style={[s.taskChip, taskId === t.id && s.taskChipSel]}
                        onPress={() => setTaskId(t.id)}
                      >
                        <Text style={s.taskChipText} numberOfLines={1}>{t.title}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </>
              )}

              <View style={{ height: 8 }} />
            </ScrollView>

            <TouchableOpacity style={s.saveBtn} onPress={handleSave}>
              <Text style={s.saveBtnText}>Save Log</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  safe: { flex: 1 },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 },
  title:  { fontSize: 28, fontWeight: '800', color: COLORS.text, letterSpacing: -0.5 },
  subtitle:{ fontSize: 13, color: COLORS.textSub, marginTop: 2 },

  // Filter bar
  filterBar:     { maxHeight: 46, marginTop: 8 },
  filterContent: { paddingHorizontal: 16, gap: 8, paddingVertical: 4 },
  filterChip:    { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: COLORS.cardAlt, borderWidth: 1, borderColor: COLORS.surfaceBorder },
  filterChipActive: { backgroundColor: COLORS.primaryLight, borderColor: COLORS.primary },
  filterChipText:   { fontSize: 12, fontWeight: '600', color: COLORS.textSub, textTransform: 'capitalize' },
  filterChipTextActive: { color: COLORS.primary },

  scroll: { flex: 1 },
  list:   { paddingHorizontal: 16, paddingTop: 12 },

  // Log card
  card: { backgroundColor: COLORS.card, borderRadius: 16, padding: 14, marginBottom: 10, ...CARD_SHADOW_SM },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  typeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  typeLabel: { fontSize: 12, fontWeight: '600', color: COLORS.textSub, textTransform: 'capitalize' },
  urgencyBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8 },
  urgencyText:  { fontSize: 10, fontWeight: '700' },
  person: { fontSize: 15, fontWeight: '700', color: COLORS.text, marginBottom: 3 },
  taskRef: { fontSize: 11, color: COLORS.textMuted, marginBottom: 6 },
  outcome: { fontSize: 13, color: COLORS.textSub, lineHeight: 18, marginBottom: 6 },
  draftBox: { backgroundColor: COLORS.cardAlt, borderRadius: 10, padding: 10, marginBottom: 8, borderWidth: 1, borderColor: COLORS.surfaceBorder },
  draftLabel: { fontSize: 10, fontWeight: '700', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  draftText:  { fontSize: 12, color: COLORS.text, lineHeight: 17 },
  date: { fontSize: 11, color: COLORS.textMuted },

  // Empty
  empty: { alignItems: 'center', paddingTop: 80, gap: 10 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: COLORS.text },
  emptySub:   { fontSize: 14, color: COLORS.textSub, textAlign: 'center' },

  // FAB
  fab: {
    position: 'absolute', right: 20,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 8, elevation: 8,
  },

  // Sheet modal
  backdrop:    { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet:       { backgroundColor: COLORS.card, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, paddingBottom: 36, maxHeight: '90%' },
  handle:      { width: 40, height: 4, borderRadius: 2, backgroundColor: COLORS.surfaceBorder, alignSelf: 'center', marginBottom: 16 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sheetTitle:  { fontSize: 18, fontWeight: '700', color: COLORS.text },

  fieldLabel: { fontSize: 12, fontWeight: '700', color: COLORS.textSub, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },
  input: {
    backgroundColor: COLORS.cardAlt, borderRadius: 14, padding: 14,
    color: COLORS.text, fontSize: 15, marginBottom: 16,
    borderWidth: 1, borderColor: COLORS.surfaceBorder,
  },
  multiline: { height: 80, textAlignVertical: 'top' },

  // Type chips
  typeChip:      { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: COLORS.surfaceBorder, backgroundColor: COLORS.cardAlt, marginRight: 8 },
  typeChipSel:   { backgroundColor: COLORS.primaryLight, borderColor: COLORS.primary },
  typeChipText:  { fontSize: 12, fontWeight: '600', color: COLORS.textSub, textTransform: 'capitalize' },
  typeChipTextSel:{ color: COLORS.primary },

  // Urgency row
  urgencyRow:    { flexDirection: 'row', gap: 8, marginBottom: 16 },
  urgencyChip:   { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: COLORS.surfaceBorder, backgroundColor: COLORS.cardAlt },
  urgencyChipText:{ fontSize: 12, fontWeight: '600', color: COLORS.textSub },

  // Task link chips
  taskChip:      { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: COLORS.surfaceBorder, backgroundColor: COLORS.cardAlt, marginRight: 8, maxWidth: 180 },
  taskChipSel:   { backgroundColor: COLORS.primaryLight, borderColor: COLORS.primary },
  taskChipText:  { fontSize: 12, fontWeight: '500', color: COLORS.text },

  saveBtn:     { backgroundColor: COLORS.primary, borderRadius: 16, padding: 16, alignItems: 'center', marginTop: 8 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
