// After a user taps "Call" on a comm task, surface this to confirm the
// conversation actually happened before marking the task complete.

import { Ionicons } from '@expo/vector-icons';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { confirmCall } from '../services/callService';
import { CARD_SHADOW, COLORS } from '../utils/constants';

export interface CallConfirmModalProps {
  visible: boolean;
  taskId: string | null;
  taskTitle?: string;
  onConfirmed: () => void;
  onClose: () => void;
}

export default function CallConfirmModal({ visible, taskId, taskTitle, onConfirmed, onClose }: CallConfirmModalProps) {
  const handle = async (ok: boolean) => {
    if (!taskId) return;
    await confirmCall(taskId, ok);
    if (ok) onConfirmed();
    onClose();
  };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={s.scrim}>
        <View style={s.card}>
          <Ionicons name="call" size={32} color={COLORS.primary} />
          <Text style={s.title}>Did you say it?</Text>
          {taskTitle ? <Text style={s.sub} numberOfLines={2}>{taskTitle}</Text> : null}
          <View style={s.row}>
            <TouchableOpacity style={[s.btn, s.btnSec]} onPress={() => handle(false)}>
              <Text style={s.btnSecText}>Not yet</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.btn, s.btnPri]} onPress={() => handle(true)}>
              <Ionicons name="checkmark" size={18} color="#fff" />
              <Text style={s.btnPriText}>Yes — done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(26,29,46,0.55)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  card: { width: '100%', backgroundColor: COLORS.card, borderRadius: 22, padding: 24, alignItems: 'center', ...CARD_SHADOW },
  title: { fontSize: 22, fontWeight: '800', color: COLORS.text, marginTop: 10 },
  sub: { fontSize: 14, color: COLORS.textSub, marginTop: 6, textAlign: 'center' },
  row: { flexDirection: 'row', gap: 10, marginTop: 18, width: '100%' },
  btn: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, paddingVertical: 14, borderRadius: 14 },
  btnSec: { backgroundColor: COLORS.cardAlt },
  btnPri: { backgroundColor: COLORS.primary },
  btnSecText: { color: COLORS.textSub, fontWeight: '700' },
  btnPriText: { color: '#fff', fontWeight: '700' },
});
