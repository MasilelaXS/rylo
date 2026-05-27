import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
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
import { useMoodStore } from '../../src/store/moodStore';
import { useTaskStore } from '../../src/store/taskStore';
import type { MoodLog } from '../../src/types';
import { CARD_SHADOW, CARD_SHADOW_SM, COLORS } from '../../src/utils/constants';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function toIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function getLast14Days(): string[] {
  const days: string[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(toIso(d));
  }
  return days;
}

// ─── Scale Config ─────────────────────────────────────────────────────────────
const ENERGY_LABELS = ['', '🪫 Drained', '😴 Tired', '😐 Neutral', '⚡ Good', '🔥 Charged'];
const MOOD_LABELS   = ['', '😞 Low', '😟 Down', '😐 Okay', '😊 Good', '😄 Great'];
const ENERGY_COLORS = ['', '#FF6B6B', '#FFB347', '#F59E0B', '#2ECC9A', '#1E90FF'];
const MOOD_COLORS   = ['', '#FF6B6B', '#FFB347', '#F59E0B', '#2ECC9A', '#A855F7'];

// ─── Sub-components ───────────────────────────────────────────────────────────
function ScalePicker({
  value, onChange, colors, labels,
}: {
  value: number;
  onChange: (v: number) => void;
  colors: string[];
  labels: string[];
}) {
  return (
    <View style={styles.scalePicker}>
      {[1, 2, 3, 4, 5].map((v) => (
        <TouchableOpacity
          key={v}
          style={[
            styles.scaleBtn,
            value === v && { backgroundColor: colors[v], borderColor: colors[v] },
          ]}
          onPress={() => onChange(v)}
          activeOpacity={0.75}
        >
          <Text style={[styles.scaleBtnText, value === v && styles.scaleBtnActive]}>{v}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function TrendChart({ logs, days }: { logs: MoodLog[]; days: string[] }) {
  const map = useMemo(() => {
    const m: Record<string, MoodLog> = {};
    logs.forEach((l) => { m[l.logDate] = l; });
    return m;
  }, [logs]);

  const maxH = 60;

  return (
    <View style={styles.chartOuter}>
      {/* Y axis labels */}
      <View style={styles.yAxis}>
        {[5, 3, 1].map((v) => (
          <Text key={v} style={styles.yLabel}>{v}</Text>
        ))}
      </View>
      {/* Bars */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
        <View style={styles.chartInner}>
          {days.map((d) => {
            const log  = map[d];
            const eH   = log ? ((log.energy / 5) * maxH) : 0;
            const mH   = log ? ((log.mood   / 5) * maxH) : 0;
            const dayLabel = new Date(d + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'narrow' });
            return (
              <View key={d} style={styles.dayCol}>
                <View style={{ height: maxH, justifyContent: 'flex-end', flexDirection: 'row', alignItems: 'flex-end', gap: 2 }}>
                  {log ? (
                    <>
                      <View style={[styles.bar, { height: eH, backgroundColor: '#1E90FF' }]} />
                      <View style={[styles.bar, { height: mH, backgroundColor: '#A855F7' }]} />
                    </>
                  ) : (
                    <View style={[styles.bar, { height: 4, backgroundColor: COLORS.textMuted, opacity: 0.3 }]} />
                  )}
                </View>
                <Text style={styles.dayLabel}>{dayLabel}</Text>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

// ─── Check-In Modal ───────────────────────────────────────────────────────────
function CheckInModal({
  visible,
  initial,
  onSave,
  onClose,
}: {
  visible: boolean;
  initial: { energy: number; mood: number; note: string } | null;
  onSave: (energy: number, mood: number, note: string) => void;
  onClose: () => void;
}) {
  const [energy, setEnergy] = useState(initial?.energy ?? 3);
  const [mood,   setMood]   = useState(initial?.mood   ?? 3);
  const [note,   setNote]   = useState(initial?.note   ?? '');

  useEffect(() => {
    if (visible) {
      setEnergy(initial?.energy ?? 3);
      setMood(initial?.mood   ?? 3);
      setNote(initial?.note   ?? '');
    }
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Daily Check-In</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={COLORS.textSub} />
            </TouchableOpacity>
          </View>

          {/* Energy */}
          <Text style={styles.sectionLabel}>Energy Level</Text>
          <Text style={styles.scaleHint}>{ENERGY_LABELS[energy]}</Text>
          <ScalePicker value={energy} onChange={setEnergy} colors={ENERGY_COLORS} labels={ENERGY_LABELS} />

          {/* Mood */}
          <Text style={[styles.sectionLabel, { marginTop: 20 }]}>Mood</Text>
          <Text style={styles.scaleHint}>{MOOD_LABELS[mood]}</Text>
          <ScalePicker value={mood} onChange={setMood} colors={MOOD_COLORS} labels={MOOD_LABELS} />

          {/* Note */}
          <Text style={[styles.sectionLabel, { marginTop: 20 }]}>Note (optional)</Text>
          <TextInput
            style={styles.noteInput}
            value={note}
            onChangeText={setNote}
            placeholder="How are you feeling today?"
            placeholderTextColor={COLORS.textMuted}
            multiline
            maxLength={200}
          />

          <TouchableOpacity
            style={styles.saveBtn}
            onPress={() => onSave(energy, mood, note.trim())}
            activeOpacity={0.85}
          >
            <Text style={styles.saveBtnText}>Save</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function MoodLogScreen() {
  const router        = useRouter();
  const { logs, todayLog, loadAll, saveLog, removeLog } = useMoodStore();
  const { tasks }                                        = useTaskStore();
  const [showModal, setShowModal]                        = useState(false);

  useEffect(() => { loadAll(); }, []);

  const days14 = useMemo(() => getLast14Days(), []);

  // ── Correlation: high energy (4-5) vs low energy (1-2) task completion
  const correlation = useMemo(() => {
    if (logs.length < 3) return null;
    let highCount = 0, highDone = 0;
    let lowCount  = 0, lowDone  = 0;

    logs.forEach((log) => {
      const dayTasks = tasks.filter((t) => {
        const due = t.dueDate ? new Date(t.dueDate) : null;
        return due && toIso(due) === log.logDate;
      });
      if (!dayTasks.length) return;
      const doneRate = dayTasks.filter((t) => t.completed).length / dayTasks.length;

      if (log.energy >= 4) { highCount++; highDone += doneRate; }
      else if (log.energy <= 2) { lowCount++;  lowDone  += doneRate; }
    });

    if (highCount === 0 && lowCount === 0) return null;
    const highAvg = highCount ? Math.round((highDone / highCount) * 100) : null;
    const lowAvg  = lowCount  ? Math.round((lowDone  / lowCount)  * 100) : null;
    return { highAvg, lowAvg, highCount, lowCount };
  }, [logs, tasks]);

  const avgEnergy = useMemo(() => {
    const last7 = logs.filter((l) => days14.slice(-7).includes(l.logDate));
    if (!last7.length) return null;
    return (last7.reduce((s, l) => s + l.energy, 0) / last7.length).toFixed(1);
  }, [logs, days14]);

  const avgMood = useMemo(() => {
    const last7 = logs.filter((l) => days14.slice(-7).includes(l.logDate));
    if (!last7.length) return null;
    return (last7.reduce((s, l) => s + l.mood, 0) / last7.length).toFixed(1);
  }, [logs, days14]);

  function handleDelete(id: string) {
    Alert.alert('Delete Log', 'Remove this mood log?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => removeLog(id) },
    ]);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mood & Energy</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Today's Check-In Card */}
        <View style={[styles.card, styles.checkinCard, CARD_SHADOW]}>
          <Text style={styles.cardTitle}>Today</Text>
          {todayLog ? (
            <View>
              <View style={styles.todayRow}>
                <View style={styles.todayStat}>
                  <Text style={styles.todayStatIcon}>⚡</Text>
                  <Text style={[styles.todayStatValue, { color: ENERGY_COLORS[todayLog.energy] }]}>
                    {todayLog.energy}
                  </Text>
                  <Text style={styles.todayStatLabel}>Energy</Text>
                </View>
                <View style={styles.divider} />
                <View style={styles.todayStat}>
                  <Text style={styles.todayStatIcon}>😊</Text>
                  <Text style={[styles.todayStatValue, { color: MOOD_COLORS[todayLog.mood] }]}>
                    {todayLog.mood}
                  </Text>
                  <Text style={styles.todayStatLabel}>Mood</Text>
                </View>
              </View>
              {!!todayLog.note && (
                <Text style={styles.todayNote}>"{todayLog.note}"</Text>
              )}
              <TouchableOpacity
                style={styles.editCheckinBtn}
                onPress={() => setShowModal(true)}
                activeOpacity={0.75}
              >
                <Text style={styles.editCheckinText}>Edit Check-In</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.noCheckinWrap}>
              <Text style={styles.noCheckinMsg}>You haven't logged today yet.</Text>
              <TouchableOpacity
                style={styles.checkinBtn}
                onPress={() => setShowModal(true)}
                activeOpacity={0.85}
              >
                <Ionicons name="add-circle" size={18} color="#FFF" />
                <Text style={styles.checkinBtnText}>Log Today</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* 7-day Averages */}
        {(avgEnergy || avgMood) && (
          <View style={[styles.card, CARD_SHADOW]}>
            <Text style={styles.cardTitle}>7-Day Average</Text>
            <View style={styles.avgRow}>
              <View style={styles.avgItem}>
                <Text style={styles.avgLabel}>⚡ Energy</Text>
                <Text style={[styles.avgValue, { color: '#1E90FF' }]}>{avgEnergy ?? '—'}</Text>
              </View>
              <View style={styles.avgItem}>
                <Text style={styles.avgLabel}>😊 Mood</Text>
                <Text style={[styles.avgValue, { color: '#A855F7' }]}>{avgMood ?? '—'}</Text>
              </View>
            </View>
          </View>
        )}

        {/* 14-day Trend Chart */}
        <View style={[styles.card, CARD_SHADOW]}>
          <Text style={styles.cardTitle}>14-Day Trend</Text>
          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#1E90FF' }]} />
              <Text style={styles.legendText}>Energy</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#A855F7' }]} />
              <Text style={styles.legendText}>Mood</Text>
            </View>
          </View>
          <TrendChart logs={logs} days={days14} />
        </View>

        {/* Correlation Card */}
        {correlation && (
          <View style={[styles.card, CARD_SHADOW]}>
            <Text style={styles.cardTitle}>Energy & Productivity</Text>
            <Text style={styles.correlationSub}>Task completion rate by energy level</Text>
            <View style={styles.correlationRow}>
              {correlation.highAvg !== null && (
                <View style={styles.correlationItem}>
                  <Text style={styles.corrLabel}>⚡ High Energy</Text>
                  <Text style={[styles.corrValue, { color: '#2ECC9A' }]}>
                    {correlation.highAvg}%
                  </Text>
                  <Text style={styles.corrSampleSize}>{correlation.highCount} day{correlation.highCount !== 1 ? 's' : ''}</Text>
                </View>
              )}
              {correlation.lowAvg !== null && (
                <View style={styles.correlationItem}>
                  <Text style={styles.corrLabel}>🪫 Low Energy</Text>
                  <Text style={[styles.corrValue, { color: '#FF6B6B' }]}>
                    {correlation.lowAvg}%
                  </Text>
                  <Text style={styles.corrSampleSize}>{correlation.lowCount} day{correlation.lowCount !== 1 ? 's' : ''}</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* History List */}
        <View style={styles.historySection}>
          <Text style={styles.sectionHeader}>History</Text>
          {logs.length === 0 && (
            <View style={[styles.card, CARD_SHADOW]}>
              <Text style={styles.emptyText}>No mood logs yet. Start by logging today!</Text>
            </View>
          )}
          {logs.map((log) => (
            <View key={log.id} style={[styles.card, styles.historyCard, CARD_SHADOW_SM]}>
              <View style={styles.historyMain}>
                <Text style={styles.historyDate}>{formatDate(log.logDate)}</Text>
                <View style={styles.historyStats}>
                  <Text style={[styles.historyStatText, { color: ENERGY_COLORS[log.energy] }]}>
                    ⚡{log.energy}
                  </Text>
                  <Text style={[styles.historyStatText, { color: MOOD_COLORS[log.mood] }]}>
                    😊{log.mood}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => handleDelete(log.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="trash-outline" size={16} color={COLORS.textMuted} />
                </TouchableOpacity>
              </View>
              {!!log.note && <Text style={styles.historyNote}>{log.note}</Text>}
            </View>
          ))}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      <CheckInModal
        visible={showModal}
        initial={todayLog ? { energy: todayLog.energy, mood: todayLog.mood, note: todayLog.note } : null}
        onSave={async (e, m, n) => {
          await saveLog(e, m, n);
          setShowModal(false);
        }}
        onClose={() => setShowModal(false)}
      />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: COLORS.bg },
  header:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text },

  content: { paddingHorizontal: 16, paddingTop: 4 },

  card:        { backgroundColor: COLORS.card, borderRadius: 16, padding: 16, marginBottom: 14 },
  checkinCard: { borderWidth: 1, borderColor: COLORS.primaryLight },
  cardTitle:   { fontSize: 15, fontWeight: '700', color: COLORS.text, marginBottom: 12 },

  // Today card
  todayRow:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingVertical: 8 },
  todayStat:      { alignItems: 'center', flex: 1 },
  todayStatIcon:  { fontSize: 22, marginBottom: 2 },
  todayStatValue: { fontSize: 32, fontWeight: '800' },
  todayStatLabel: { fontSize: 12, color: COLORS.textSub, marginTop: 2 },
  divider:        { width: 1, height: 48, backgroundColor: COLORS.surfaceBorder },
  todayNote:      { fontSize: 13, color: COLORS.textSub, fontStyle: 'italic', textAlign: 'center', marginTop: 10 },
  editCheckinBtn: { alignSelf: 'center', marginTop: 12, paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: COLORS.primary },
  editCheckinText:{ fontSize: 13, color: COLORS.primary, fontWeight: '600' },
  noCheckinWrap:  { alignItems: 'center', paddingVertical: 8 },
  noCheckinMsg:   { fontSize: 14, color: COLORS.textSub, marginBottom: 12 },
  checkinBtn:     { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.primary, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20 },
  checkinBtnText: { color: '#FFF', fontWeight: '700', fontSize: 14 },

  // Averages
  avgRow:  { flexDirection: 'row', gap: 16 },
  avgItem: { flex: 1, alignItems: 'center', backgroundColor: COLORS.cardAlt, borderRadius: 12, paddingVertical: 14 },
  avgLabel:{ fontSize: 13, color: COLORS.textSub, marginBottom: 4 },
  avgValue:{ fontSize: 28, fontWeight: '800' },

  // Trend chart
  legend:     { flexDirection: 'row', gap: 16, marginBottom: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot:  { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 12, color: COLORS.textSub },
  chartOuter: { flexDirection: 'row', alignItems: 'flex-end', height: 80 },
  yAxis:      { width: 16, height: 60, justifyContent: 'space-between', marginRight: 4 },
  yLabel:     { fontSize: 9, color: COLORS.textMuted, textAlign: 'right' },
  chartInner: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, paddingHorizontal: 4 },
  dayCol:     { alignItems: 'center', width: 28 },
  bar:        { width: 8, borderRadius: 4 },
  dayLabel:   { fontSize: 9, color: COLORS.textMuted, marginTop: 4 },

  // Correlation
  correlationSub:  { fontSize: 12, color: COLORS.textSub, marginBottom: 12 },
  correlationRow:  { flexDirection: 'row', gap: 12 },
  correlationItem: { flex: 1, backgroundColor: COLORS.cardAlt, borderRadius: 12, padding: 14, alignItems: 'center' },
  corrLabel:  { fontSize: 13, color: COLORS.textSub, marginBottom: 4 },
  corrValue:  { fontSize: 28, fontWeight: '800' },
  corrSampleSize: { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },

  // History
  historySection: { marginTop: 4 },
  sectionHeader:  { fontSize: 16, fontWeight: '700', color: COLORS.text, marginBottom: 10 },
  historyCard:    { paddingVertical: 12 },
  historyMain:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  historyDate:    { fontSize: 13, fontWeight: '600', color: COLORS.text, flex: 1 },
  historyStats:   { flexDirection: 'row', gap: 12, marginRight: 12 },
  historyStatText:{ fontSize: 14, fontWeight: '700' },
  historyNote:    { fontSize: 12, color: COLORS.textSub, marginTop: 6, fontStyle: 'italic' },
  emptyText:      { fontSize: 14, color: COLORS.textSub, textAlign: 'center' },

  // Scale picker
  scalePicker:   { flexDirection: 'row', gap: 10, marginTop: 6 },
  scaleBtn:      { flex: 1, height: 44, borderRadius: 12, borderWidth: 1.5, borderColor: COLORS.surfaceBorder, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.cardAlt },
  scaleBtnText:  { fontSize: 16, fontWeight: '700', color: COLORS.textSub },
  scaleBtnActive:{ color: '#FFF' },
  scaleHint:     { fontSize: 13, color: COLORS.textSub, marginTop: 4 },
  sectionLabel:  { fontSize: 14, fontWeight: '600', color: COLORS.text, marginBottom: 6 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalSheet:   { backgroundColor: COLORS.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 36 },
  modalHeader:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  modalTitle:   { fontSize: 18, fontWeight: '700', color: COLORS.text },
  noteInput:    { backgroundColor: COLORS.cardAlt, borderRadius: 12, padding: 12, fontSize: 14, color: COLORS.text, minHeight: 72, textAlignVertical: 'top', marginTop: 4 },
  saveBtn:      { backgroundColor: COLORS.primary, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 24 },
  saveBtnText:  { color: '#FFF', fontWeight: '700', fontSize: 16 },
} as const);
