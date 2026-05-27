import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import {
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    ViewStyle,
} from 'react-native';
import type { Task } from '../types';
import { COLORS } from '../utils/constants';

interface Props {
  tasks: Task[];
  style?: ViewStyle;
}

const DAYS = 14;
const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function getCountColor(count: number): string {
  if (count === 0) return COLORS.cardAlt;
  if (count <= 2) return '#2ECC9A';
  if (count <= 5) return '#F5A623';
  return '#FF4B4B';
}

export default function WorkloadBanner({ tasks, style }: Props) {
  const [collapsed, setCollapsed] = useState(false);

  const days = useMemo(() => {
    const result: { date: Date; count: number }[] = [];
    const now = new Date();
    for (let i = 0; i < DAYS; i++) {
      const d = new Date(now);
      d.setHours(0, 0, 0, 0);
      d.setDate(now.getDate() + i);
      const nextDay = new Date(d);
      nextDay.setDate(d.getDate() + 1);
      const count = tasks.filter((t) => {
        if (t.status === 'completed' || t.status === 'cancelled') return false;
        return t.dueDate >= d.getTime() && t.dueDate < nextDay.getTime();
      }).length;
      result.push({ date: d, count });
    }
    return result;
  }, [tasks]);

  const maxCount = useMemo(() => Math.max(...days.map((d) => d.count), 1), [days]);

  return (
    <View style={[w.root, style]}>
      {/* Header row */}
      <TouchableOpacity onPress={() => setCollapsed((v) => !v)} style={w.header} activeOpacity={0.7}>
        <Ionicons name="bar-chart-outline" size={13} color={COLORS.primary} />
        <Text style={w.headerText}>Workload · Next {DAYS} days</Text>
        <Ionicons
          name={collapsed ? 'chevron-down' : 'chevron-up'}
          size={13}
          color={COLORS.textMuted}
        />
      </TouchableOpacity>

      {!collapsed && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={w.row}
        >
          {days.map(({ date, count }, i) => {
            const isToday = i === 0;
            const barHeight = count === 0 ? 4 : Math.max(6, (count / maxCount) * 28);
            const dotColor = getCountColor(count);
            return (
              <View key={i} style={[w.cell, isToday && w.cellToday]}>
                <Text style={[w.dow, isToday && w.dowToday]}>
                  {isToday ? 'Today' : DAY_SHORT[date.getDay()]}
                </Text>
                <Text style={[w.date, isToday && w.dateToday]}>{date.getDate()}</Text>
                <View style={w.barTrack}>
                  <View style={[w.bar, { height: barHeight, backgroundColor: dotColor }]} />
                </View>
                <Text style={[w.count, { color: dotColor }]}>{count}</Text>
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const w = StyleSheet.create({
  root: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    marginHorizontal: 16,
    marginBottom: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E8EAF0',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  headerText: { flex: 1, fontSize: 12, fontWeight: '700', color: COLORS.text },
  row: { paddingHorizontal: 12, paddingBottom: 12, gap: 4 },
  cell: {
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 12,
    minWidth: 46,
  },
  cellToday: { backgroundColor: COLORS.primaryLight },
  dow: { fontSize: 9, fontWeight: '600', color: COLORS.textMuted },
  dowToday: { color: COLORS.primary },
  date: { fontSize: 13, fontWeight: '700', color: COLORS.text, marginTop: 1 },
  dateToday: { color: COLORS.primary },
  barTrack: { height: 30, justifyContent: 'flex-end', marginTop: 4 },
  bar: { width: 18, borderRadius: 4 },
  count: { fontSize: 10, fontWeight: '700', marginTop: 2 },
});
