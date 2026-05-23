// AI project breakdown — paste a goal, see proposed sequential tasks, accept all.

import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { breakdownGoal, commitBreakdown, friendlyAiError, type BreakdownStep } from '../services/projectBreakdownService';
import { useTaskStore } from '../store/taskStore';
import { CARD_SHADOW, COLORS, PRIORITY_CONFIG } from '../utils/constants';

export interface ProjectBreakdownModalProps {
  visible: boolean;
  projectId: string | null;
  onClose: () => void;
}

export default function ProjectBreakdownModal({ visible, projectId, onClose }: ProjectBreakdownModalProps) {
  const [goal, setGoal] = useState('');
  const [steps, setSteps] = useState<BreakdownStep[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const reload = useTaskStore((s) => s.loadAll);

  const handleGenerate = async () => {
    setBusy(true);
    setErr('');
    try {
      const r = await breakdownGoal(goal);
      setSteps(r);
    } catch (e) {
      setErr(friendlyAiError(e));
    } finally {
      setBusy(false);
    }
  };

  const handleAccept = async () => {
    if (!projectId) return;
    setBusy(true);
    try {
      await commitBreakdown(projectId, steps);
      await reload();
      handleClose();
    } finally {
      setBusy(false);
    }
  };

  const handleClose = () => {
    setGoal('');
    setSteps([]);
    setErr('');
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <View style={s.scrim}>
        <View style={s.sheet}>
          <View style={s.handle} />
          <View style={s.headerRow}>
            <Ionicons name="sparkles-outline" size={20} color={COLORS.primary} />
            <Text style={s.title}>AI breakdown</Text>
            <TouchableOpacity onPress={handleClose} hitSlop={8}><Ionicons name="close" size={22} color={COLORS.textMuted} /></TouchableOpacity>
          </View>

          {steps.length === 0 ? (
            <>
              <Text style={s.sub}>Describe the goal. AI will draft 4-10 sequential tasks for this project.</Text>
              <TextInput
                style={[s.input, { minHeight: 110 }]}
                value={goal}
                onChangeText={setGoal}
                placeholder="e.g. Launch the new landing page by end of month"
                placeholderTextColor={COLORS.textMuted}
                multiline
                autoFocus
              />
              {err ? <Text style={s.err}>{err}</Text> : null}
              <TouchableOpacity style={s.primary} onPress={handleGenerate} disabled={!goal.trim() || busy}>
                {busy ? <ActivityIndicator color="#fff" /> : <>
                  <Ionicons name="flash" size={18} color="#fff" />
                  <Text style={s.primaryText}>Generate plan</Text>
                </>}
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={s.sub}>Review and accept — tasks will be added to this project.</Text>
              <ScrollView style={{ maxHeight: 360 }}>
                {steps.map((st, i) => {
                  const p = PRIORITY_CONFIG[st.priority];
                  return (
                    <View key={i} style={s.step}>
                      <View style={[s.dot, { backgroundColor: p.color }]} />
                      <View style={{ flex: 1 }}>
                        <Text style={s.stepTitle}>{i + 1}. {st.title}</Text>
                        {st.description ? <Text style={s.stepDesc} numberOfLines={3}>{st.description}</Text> : null}
                        <Text style={s.stepMeta}>+{st.dueDays}d · ~{st.estimatedMinutes}m · {p.label}</Text>
                      </View>
                    </View>
                  );
                })}
              </ScrollView>
              <View style={s.row}>
                <TouchableOpacity style={[s.btn, s.sec]} onPress={() => setSteps([])} disabled={busy}>
                  <Text style={s.secText}>Edit goal</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.btn, s.pri]} onPress={handleAccept} disabled={busy}>
                  {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.priText}>Accept all</Text>}
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(26,29,46,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: COLORS.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 22, ...CARD_SHADOW, maxHeight: '92%' },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: COLORS.textMuted, alignSelf: 'center', marginBottom: 14 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { flex: 1, fontSize: 18, fontWeight: '800', color: COLORS.text },
  sub: { fontSize: 14, color: COLORS.textSub, marginTop: 10 },
  input: { backgroundColor: COLORS.cardAlt, borderRadius: 14, padding: 14, fontSize: 15, color: COLORS.text, textAlignVertical: 'top', marginTop: 10 },
  err: { color: COLORS.danger, fontSize: 13, marginTop: 8 },
  primary: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, backgroundColor: COLORS.primary, paddingVertical: 14, borderRadius: 14, marginTop: 14 },
  primaryText: { color: '#fff', fontWeight: '700' },
  step: { flexDirection: 'row', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.cardAlt },
  dot: { width: 10, height: 10, borderRadius: 5, marginTop: 5 },
  stepTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  stepDesc: { fontSize: 13, color: COLORS.textSub, marginTop: 2 },
  stepMeta: { fontSize: 11, color: COLORS.textMuted, marginTop: 4 },
  row: { flexDirection: 'row', gap: 10, marginTop: 14 },
  btn: { flex: 1, paddingVertical: 14, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  sec: { backgroundColor: COLORS.cardAlt },
  pri: { backgroundColor: COLORS.primary },
  secText: { color: COLORS.textSub, fontWeight: '700' },
  priText: { color: '#fff', fontWeight: '700' },
});
