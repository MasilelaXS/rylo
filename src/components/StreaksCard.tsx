// Per-category streaks card. Updated by taskStore on completion.

import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { getAllStreaks } from '../database/categoryStreaks';
import type { CategoryStreak, StreakCategory } from '../types';
import { CARD_SHADOW, COLORS } from '../utils/constants';

const META: Record<StreakCategory, { label: string; icon: keyof typeof Ionicons.glyphMap; color: string }> = {
  communication: { label: 'Communication', icon: 'chatbubbles-outline', color: '#6B7CFF' },
  deep_work:     { label: 'Deep work',     icon: 'flash-outline',      color: '#FF9A56' },
  admin:         { label: 'Admin',         icon: 'document-text-outline', color: '#2ECC9A' },
  personal:      { label: 'Personal',      icon: 'heart-outline',      color: '#FF7DA0' },
  general:       { label: 'General',       icon: 'checkmark-circle-outline', color: '#1E90FF' },
};

interface Props {
  refreshKey?: number;
}

export default function StreaksCard({ refreshKey }: Props) {
  const [streaks, setStreaks] = useState<CategoryStreak[]>([]);

  useEffect(() => {
    let cancelled = false;
    getAllStreaks().then((s) => { if (!cancelled) setStreaks(s); }).catch(() => {});
    return () => { cancelled = true; };
  }, [refreshKey]);

  return (
    <View style={s.card}>
      <View style={s.headerRow}>
        <Ionicons name="flame-outline" size={18} color={COLORS.primary} />
        <Text style={s.title}>Momentum</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingVertical: 4 }}>
        {streaks.map((st) => {
          const m = META[st.category];
          return (
            <View key={st.category} style={s.tile}>
              <Ionicons name={m.icon} size={18} color={m.color} />
              <Text style={s.tileLabel}>{m.label}</Text>
              <Text style={[s.tileVal, { color: m.color }]}>{st.current}</Text>
              <Text style={s.tileSub}>best {st.longest}</Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: COLORS.card, borderRadius: 18, padding: 16, marginBottom: 12, ...CARD_SHADOW },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  title: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  tile: { width: 110, padding: 12, borderRadius: 14, backgroundColor: COLORS.cardAlt, alignItems: 'flex-start', gap: 6 },
  tileLabel: { fontSize: 12, color: COLORS.textSub, fontWeight: '600' },
  tileVal: { fontSize: 26, fontWeight: '800' },
  tileSub: { fontSize: 11, color: COLORS.textMuted },
});
