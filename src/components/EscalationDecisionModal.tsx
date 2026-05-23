// Full-screen decision modal that fires when a task has been snoozed too many times.
// Forces user to choose: Do it now / Reschedule (with reason) / Cancel (with reason).

import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { logExcuse } from '../services/excuseService';
import type { Task } from '../types';
import { CARD_SHADOW, COLORS } from '../utils/constants';

export interface EscalationDecisionModalProps {
  visible: boolean;
  task: Task | null;
  onDoNow: () => void;
  onReschedule: (extraMinutes: number) => void;
  onCancel: () => void;
  onClose: () => void;
}

export default function EscalationDecisionModal({ visible, task, onDoNow, onReschedule, onCancel, onClose }: EscalationDecisionModalProps) {
  const [reason, setReason] = useState('');
  const [mode, setMode] = useState<'choose' | 'reschedule' | 'cancel'>('choose');

  const handleClose = () => {
    setReason('');
    setMode('choose');
    onClose();
  };

  const handleReschedule = async () => {
    if (!task) return;
    if (reason.trim()) await logExcuse(task.id, reason);
    onReschedule(60);
    handleClose();
  };

  const handleCancel = async () => {
    if (!task) return;
    if (reason.trim()) await logExcuse(task.id, reason);
    onCancel();
    handleClose();
  };

  if (!task) return null;

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={handleClose}>
      <SafeAreaView style={s.scrim}>
        <View style={s.card}>
          <View style={s.headerRow}>
            <Ionicons name="alert-circle" size={28} color={COLORS.danger} />
            <Text style={s.headerTitle}>Decision required</Text>
            <TouchableOpacity onPress={handleClose} hitSlop={8}>
              <Ionicons name="close" size={22} color={COLORS.textMuted} />
            </TouchableOpacity>
          </View>

          <Text style={s.task}>{task.title}</Text>
          <Text style={s.sub}>Snoozed {task.snoozeCount} time{task.snoozeCount === 1 ? '' : 's'}. Pick one — no more dismissing.</Text>

          {mode === 'choose' && (
            <View style={{ gap: 12, marginTop: 18 }}>
              <TouchableOpacity style={[s.btn, s.btnPrimary]} onPress={() => { onDoNow(); handleClose(); }}>
                <Ionicons name="flash" size={20} color="#fff" />
                <Text style={s.btnPrimaryText}>Do it now</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.btn, s.btnSecondary]} onPress={() => setMode('reschedule')}>
                <Ionicons name="time-outline" size={20} color={COLORS.primary} />
                <Text style={s.btnSecondaryText}>Reschedule — why?</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.btn, s.btnDanger]} onPress={() => setMode('cancel')}>
                <Ionicons name="trash-outline" size={20} color={COLORS.danger} />
                <Text style={s.btnDangerText}>Cancel — why?</Text>
              </TouchableOpacity>
            </View>
          )}

          {mode !== 'choose' && (
            <View style={{ marginTop: 18 }}>
              <Text style={s.label}>Reason</Text>
              <TextInput
                style={s.input}
                value={reason}
                onChangeText={setReason}
                placeholder={mode === 'reschedule' ? 'What\'s in the way right now?' : 'Why drop it?'}
                placeholderTextColor={COLORS.textMuted}
                multiline
                numberOfLines={3}
                autoFocus
              />
              <View style={s.actionRow}>
                <TouchableOpacity style={[s.btn, s.btnSecondary, { flex: 1 }]} onPress={() => setMode('choose')}>
                  <Text style={s.btnSecondaryText}>Back</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.btn, mode === 'cancel' ? s.btnDanger : s.btnPrimary, { flex: 1 }]}
                  onPress={mode === 'cancel' ? handleCancel : handleReschedule}
                >
                  <Text style={mode === 'cancel' ? s.btnDangerText : s.btnPrimaryText}>
                    {mode === 'cancel' ? 'Confirm cancel' : 'Reschedule +1h'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const s = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(26,29,46,0.55)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  card: { width: '100%', backgroundColor: COLORS.card, borderRadius: 24, padding: 22, ...CARD_SHADOW },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '800', color: COLORS.text },
  task: { fontSize: 22, fontWeight: '800', color: COLORS.text, marginTop: 12 },
  sub: { fontSize: 14, color: COLORS.textSub, marginTop: 4 },
  label: { fontSize: 13, fontWeight: '600', color: COLORS.textSub, marginBottom: 8 },
  input: { backgroundColor: COLORS.cardAlt, borderRadius: 14, padding: 14, fontSize: 15, color: COLORS.text, textAlignVertical: 'top', minHeight: 90 },
  actionRow: { flexDirection: 'row', gap: 12, marginTop: 14 },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 14 },
  btnPrimary: { backgroundColor: COLORS.primary },
  btnPrimaryText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  btnSecondary: { backgroundColor: COLORS.primaryLight },
  btnSecondaryText: { color: COLORS.primary, fontWeight: '700', fontSize: 15 },
  btnDanger: { backgroundColor: COLORS.dangerLight },
  btnDangerText: { color: COLORS.danger, fontWeight: '700', fontSize: 15 },
});
