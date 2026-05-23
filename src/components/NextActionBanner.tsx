// Always-visible "next action" banner for a project detail view.

import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { nextActionForProject } from '../services/nextActionService';
import { useTaskStore } from '../store/taskStore';
import type { Task } from '../types';
import { CARD_SHADOW, COLORS, PRIORITY_CONFIG } from '../utils/constants';

export interface NextActionBannerProps {
  projectId: string;
  onOpen?: (task: Task) => void;
  onComplete?: (task: Task) => void;
}

export default function NextActionBanner({ projectId, onOpen, onComplete }: NextActionBannerProps) {
  const tasks = useTaskStore((s) => s.tasks);
  const next = nextActionForProject(projectId, tasks);

  if (!next) {
    return (
      <View style={s.card}>
        <Ionicons name="checkmark-done" size={20} color={COLORS.success} />
        <Text style={s.empty}>No next action — project is clear.</Text>
      </View>
    );
  }

  const p = PRIORITY_CONFIG[next.priority];
  const dueLabel = new Date(next.dueDate).toLocaleString('en-US', { weekday: 'short', hour: '2-digit', minute: '2-digit' });

  return (
    <TouchableOpacity style={s.card} onPress={() => onOpen?.(next)} activeOpacity={0.85}>
      <View style={[s.tag, { backgroundColor: p.bg }]}>
        <Text style={[s.tagText, { color: p.color }]}>Next</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.title} numberOfLines={2}>{next.title}</Text>
        <Text style={s.meta}>{dueLabel} · {p.label}</Text>
      </View>
      <TouchableOpacity onPress={() => onComplete?.(next)} hitSlop={8} style={s.checkBtn}>
        <Ionicons name="checkmark" size={20} color={COLORS.primary} />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: COLORS.card, padding: 14, borderRadius: 16, marginBottom: 12, ...CARD_SHADOW },
  tag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  tagText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.4 },
  title: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  meta: { fontSize: 12, color: COLORS.textSub, marginTop: 2 },
  empty: { fontSize: 14, color: COLORS.textSub, marginLeft: 6 },
  checkBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.primaryLight },
});
