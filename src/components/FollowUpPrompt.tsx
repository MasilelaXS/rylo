// After a comm task is completed, prompt for an expected-reply date and
// auto-spawn the chase task.

import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { createFollowUp } from '../services/followUpService';
import type { Task } from '../types';
import { CARD_SHADOW, COLORS } from '../utils/constants';

const PRESETS = [
  { label: 'No follow-up', days: -1 },
  { label: '+1 day',       days: 1 },
  { label: '+3 days',      days: 3 },
  { label: '+1 week',      days: 7 },
];

export interface FollowUpPromptProps {
  visible: boolean;
  task: Task | null;
  onClose: () => void;
}

export default function FollowUpPrompt({ visible, task, onClose }: FollowUpPromptProps) {
  const [busy, setBusy] = useState(false);

  const pick = async (days: number) => {
    if (!task || days < 0) { onClose(); return; }
    setBusy(true);
    const when = new Date();
    when.setDate(when.getDate() + days);
    when.setHours(10, 0, 0, 0);
    try {
      await createFollowUp(task, when.getTime());
    } finally {
      setBusy(false);
      onClose();
    }
  };

  if (!task) return null;

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={s.scrim}>
        <View style={s.card}>
          <Ionicons name="repeat" size={28} color={COLORS.primary} />
          <Text style={s.title}>Expecting a reply?</Text>
          <Text style={s.sub} numberOfLines={2}>{task.title}</Text>
          <View style={s.col}>
            {PRESETS.map((p) => (
              <TouchableOpacity key={p.label} style={s.btn} disabled={busy} onPress={() => pick(p.days)}>
                <Text style={s.btnText}>{p.label}</Text>
                {p.days > 0 && <Ionicons name="add-circle-outline" size={18} color={COLORS.primary} />}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(26,29,46,0.55)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  card: { width: '100%', backgroundColor: COLORS.card, borderRadius: 22, padding: 24, alignItems: 'center', ...CARD_SHADOW },
  title: { fontSize: 20, fontWeight: '800', color: COLORS.text, marginTop: 10 },
  sub: { fontSize: 13, color: COLORS.textSub, marginTop: 4, textAlign: 'center' },
  col: { width: '100%', gap: 10, marginTop: 18 },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: COLORS.cardAlt, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 14 },
  btnText: { color: COLORS.text, fontWeight: '600', fontSize: 15 },
});
