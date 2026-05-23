// Procrastination heatmap — visualises avoidance by weekday/hour + by category.

import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { buildAvoidanceByCategory, buildHeatmap } from '../services/heatmapService';
import type { Task } from '../types';
import { CARD_SHADOW, COLORS } from '../utils/constants';

const DAY = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

export interface ProcrastinationHeatmapProps { tasks: Task[]; }

export default function ProcrastinationHeatmap({ tasks }: ProcrastinationHeatmapProps) {
  const cells = useMemo(() => buildHeatmap(tasks), [tasks]);
  const byCategory = useMemo(() => buildAvoidanceByCategory(tasks), [tasks]);

  // Reorder rows so Monday-first (RN data uses 0=Sun)
  const grid: { score: number; total: number }[][] = [];
  for (let r = 0; r < 7; r++) {
    const dow = (r + 1) % 7;
    grid.push(
      Array.from({ length: 24 }, (_, h) => {
        const c = cells.find((x) => x.dow === dow && x.hour === h);
        return { score: c?.avoidanceScore ?? 0, total: c?.total ?? 0 };
      })
    );
  }

  return (
    <View style={s.card}>
      <Text style={s.title}>Procrastination heatmap</Text>
      <Text style={s.sub}>Red = avoided more often.</Text>

      <View style={s.grid}>
        {grid.map((row, ri) => (
          <View key={ri} style={s.row}>
            <Text style={s.rowLabel}>{DAY[ri]}</Text>
            {row.map((cell, hi) => {
              const opacity = cell.total === 0 ? 0.06 : Math.max(0.12, cell.score);
              const bg = cell.total === 0
                ? `rgba(168,174,203,0.25)`
                : `rgba(255,107,107,${opacity})`;
              return <View key={hi} style={[s.cell, { backgroundColor: bg }]} />;
            })}
          </View>
        ))}
        <View style={[s.row, { marginTop: 6 }]}>
          <Text style={s.rowLabel} />
          {Array.from({ length: 24 }, (_, i) => (
            <Text key={i} style={s.hourLabel}>{i % 6 === 0 ? i : ''}</Text>
          ))}
        </View>
      </View>

      <Text style={[s.title, { marginTop: 16 }]}>Avoidance by category</Text>
      <View style={{ gap: 8, marginTop: 8 }}>
        {byCategory.length === 0 && <Text style={s.sub}>No data yet.</Text>}
        {byCategory.map((c) => (
          <View key={c.tag} style={s.barRow}>
            <Text style={s.barLabel} numberOfLines={1}>{c.tag.replace('_', ' ')}</Text>
            <View style={s.barTrack}>
              <View style={[s.barFill, { width: `${Math.round(c.rate * 100)}%` }]} />
            </View>
            <Text style={s.barValue}>{Math.round(c.rate * 100)}%</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: COLORS.card, borderRadius: 18, padding: 16, marginBottom: 12, ...CARD_SHADOW },
  title: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  sub: { fontSize: 12, color: COLORS.textSub, marginTop: 4 },
  grid: { marginTop: 12 },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 3 },
  rowLabel: { width: 24, fontSize: 11, color: COLORS.textSub, fontWeight: '600' },
  cell: { flex: 1, height: 12, borderRadius: 2, marginHorizontal: 1 },
  hourLabel: { flex: 1, textAlign: 'center', fontSize: 9, color: COLORS.textMuted },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  barLabel: { width: 90, fontSize: 12, color: COLORS.text, fontWeight: '600', textTransform: 'capitalize' },
  barTrack: { flex: 1, height: 8, borderRadius: 4, backgroundColor: COLORS.cardAlt, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: COLORS.danger, borderRadius: 4 },
  barValue: { width: 40, textAlign: 'right', fontSize: 11, color: COLORS.textSub, fontWeight: '600' },
});
