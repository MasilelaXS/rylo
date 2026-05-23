// Lightweight prompt that captures a reason whenever a task is snoozed normally.
// Records it as an Excuse so patterns can surface in the heatmap.

import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { logExcuse } from '../services/excuseService';
import { CARD_SHADOW, COLORS } from '../utils/constants';

const QUICK = ['tired', 'no time', 'afraid', 'unclear', 'low energy', 'waiting'];

export interface ExcuseModalProps {
  visible: boolean;
  taskId: string | null;
  taskTitle?: string;
  onClose: () => void;
  onDone?: () => void;
}

export default function ExcuseModal({ visible, taskId, taskTitle, onClose, onDone }: ExcuseModalProps) {
  const [reason, setReason] = useState('');

  const submit = async (textOverride?: string) => {
    const text = (textOverride ?? reason).trim();
    if (taskId && text) {
      await logExcuse(taskId, text);
    }
    setReason('');
    onDone?.();
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={s.scrim}>
        <View style={s.sheet}>
          <View style={s.handle} />
          <View style={s.headerRow}>
            <Ionicons name="chatbubble-ellipses-outline" size={20} color={COLORS.primary} />
            <Text style={s.title}>Why snooze?</Text>
            <TouchableOpacity onPress={onClose} hitSlop={8}><Ionicons name="close" size={22} color={COLORS.textMuted} /></TouchableOpacity>
          </View>
          {taskTitle ? <Text style={s.task} numberOfLines={2}>{taskTitle}</Text> : null}

          <View style={s.chips}>
            {QUICK.map((q) => (
              <TouchableOpacity key={q} style={s.chip} onPress={() => submit(q)}>
                <Text style={s.chipText}>{q}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TextInput
            style={s.input}
            value={reason}
            onChangeText={setReason}
            placeholder="Or type a reason…"
            placeholderTextColor={COLORS.textMuted}
            multiline
            numberOfLines={3}
          />
          <View style={s.row}>
            <TouchableOpacity style={[s.btn, s.btnSec]} onPress={() => submit('')}>
              <Text style={s.btnSecText}>Skip</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.btn, s.btnPri]} onPress={() => submit()}>
              <Text style={s.btnPriText}>Log it</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(26,29,46,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: COLORS.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 22, ...CARD_SHADOW },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: COLORS.textMuted, alignSelf: 'center', marginBottom: 14 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { flex: 1, fontSize: 18, fontWeight: '800', color: COLORS.text },
  task: { fontSize: 14, color: COLORS.textSub, marginTop: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  chip: { backgroundColor: COLORS.cardAlt, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999 },
  chipText: { color: COLORS.text, fontSize: 13, fontWeight: '600' },
  input: { backgroundColor: COLORS.cardAlt, borderRadius: 14, padding: 14, marginTop: 14, fontSize: 15, color: COLORS.text, textAlignVertical: 'top', minHeight: 80 },
  row: { flexDirection: 'row', gap: 10, marginTop: 14 },
  btn: { flex: 1, paddingVertical: 14, borderRadius: 14, alignItems: 'center' },
  btnSec: { backgroundColor: COLORS.cardAlt },
  btnPri: { backgroundColor: COLORS.primary },
  btnSecText: { color: COLORS.textSub, fontWeight: '700' },
  btnPriText: { color: '#fff', fontWeight: '700' },
});
