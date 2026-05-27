import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import {
    Alert,
    Modal,
    Pressable,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { type HabitWithStats, toIsoDate, useHabitStore } from '../../src/store/habitStore';
import type { Habit } from '../../src/types';
import { CARD_SHADOW, COLORS } from '../../src/utils/constants';

// ─── Config ──────────────────────────────────────────────────────────────────
const CHAIN_DAYS = 14;

const HABIT_ICONS = [
  'fitness-outline', 'barbell-outline', 'walk-outline', 'bicycle-outline',
  'book-outline', 'pencil-outline', 'code-outline', 'language-outline',
  'water-outline', 'restaurant-outline', 'medkit-outline', 'moon-outline',
  'sunny-outline', 'leaf-outline', 'musical-notes-outline', 'people-outline',
  'heart-outline', 'flash-outline', 'timer-outline', 'checkmark-circle-outline',
] as const;

const HABIT_COLORS = [
  '#1E90FF', '#2ECC9A', '#FF9A56', '#FF7DA0',
  '#6B7CFF', '#F59E0B', '#FF7070', '#9B8CFF',
  '#2ECCE0', '#E85D04',
];

// ─── Helpers ─────────────────────────────────────────────────────────────────
function buildChainDates(n: number): string[] {
  return Array.from({ length: n }, (_, i) =>
    toIsoDate(new Date(Date.now() - (n - 1 - i) * 86_400_000)),
  );
}

// ─── HabitCard ───────────────────────────────────────────────────────────────
function HabitCard({
  item,
  onToggleToday,
  onLongPress,
}: {
  item: HabitWithStats;
  onToggleToday: (habitId: string) => void;
  onLongPress: (habit: Habit) => void;
}) {
  const { habit, streak, longestStreak, todayDone, completedDates } = item;
  const chainDates = useMemo(() => buildChainDates(CHAIN_DAYS), []);

  return (
    <Pressable
      style={[s.habitCard, todayDone && { borderColor: `${habit.color}55` }]}
      onPress={() => onToggleToday(habit.id)}
      onLongPress={() => onLongPress(habit)}
      android_ripple={{ color: `${habit.color}18` }}
    >
      {/* Top row: icon | name + streak | check */}
      <View style={s.cardTop}>
        <View style={[s.iconCircle, { backgroundColor: `${habit.color}20` }]}>
          <Ionicons name={habit.icon as any} size={22} color={habit.color} />
        </View>

        <View style={s.cardMid}>
          <Text style={s.habitName} numberOfLines={1}>{habit.name}</Text>
          <Text style={s.streakSub}>Best: {longestStreak} day{longestStreak !== 1 ? 's' : ''}</Text>
        </View>

        <View style={s.streakBadge}>
          <Ionicons
            name="flame"
            size={13}
            color={streak > 0 ? '#FF9A56' : COLORS.textMuted}
          />
          <Text style={[s.streakNum, { color: streak > 0 ? '#FF9A56' : COLORS.textMuted }]}>
            {streak}
          </Text>
        </View>

        <View style={[s.checkCircle, todayDone && { backgroundColor: habit.color, borderColor: habit.color }]}>
          {todayDone && <Ionicons name="checkmark" size={14} color="#fff" />}
        </View>
      </View>

      {/* Chain dots: oldest left → today right */}
      <View style={s.chain}>
        {chainDates.map((date, idx) => {
          const done = completedDates.has(date);
          const isToday = idx === chainDates.length - 1;
          return (
            <View
              key={date}
              style={[
                s.dot,
                done ? { backgroundColor: habit.color } : s.dotEmpty,
                isToday && s.dotToday,
                isToday && done && { backgroundColor: habit.color },
              ]}
            />
          );
        })}
      </View>
    </Pressable>
  );
}

// ─── Add / Edit Modal ─────────────────────────────────────────────────────────
interface ModalFields { name: string; icon: string; color: string }

function HabitModal({
  visible,
  initial,
  onSave,
  onClose,
}: {
  visible: boolean;
  initial?: ModalFields;
  onSave: (fields: ModalFields) => void;
  onClose: () => void;
}) {
  const [name,  setName]  = useState('');
  const [icon,  setIcon]  = useState(HABIT_ICONS[0]);
  const [color, setColor] = useState(HABIT_COLORS[0]);

  useEffect(() => {
    if (visible) {
      setName(initial?.name ?? '');
      setIcon(initial?.icon ?? HABIT_ICONS[0]);
      setColor(initial?.color ?? HABIT_COLORS[0]);
    }
  }, [visible, initial]);

  const isEditing = !!initial;

  return (
    <Modal visible={visible} animationType="slide" transparent presentationStyle="overFullScreen">
      <View style={m.overlay}>
        <View style={m.sheet}>
          <View style={m.sheetHeader}>
            <Text style={m.sheetTitle}>{isEditing ? 'Edit Habit' : 'New Habit'}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={22} color={COLORS.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Name */}
          <TextInput
            style={m.input}
            placeholder="Habit name (e.g. Exercise, Read 30 min)"
            placeholderTextColor={COLORS.textMuted}
            value={name}
            onChangeText={setName}
            maxLength={50}
            returnKeyType="done"
          />

          {/* Preview */}
          {name.trim().length > 0 && (
            <View style={[m.preview, { backgroundColor: `${color}15` }]}>
              <View style={[m.previewIcon, { backgroundColor: `${color}25` }]}>
                <Ionicons name={icon as any} size={24} color={color} />
              </View>
              <Text style={[m.previewName, { color }]}>{name.trim()}</Text>
            </View>
          )}

          {/* Icon picker */}
          <Text style={m.label}>Icon</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={m.iconRow}
          >
            {HABIT_ICONS.map((ic) => (
              <TouchableOpacity
                key={ic}
                style={[
                  m.iconOpt,
                  icon === ic && { backgroundColor: `${color}22`, borderColor: color },
                ]}
                onPress={() => setIcon(ic)}
              >
                <Ionicons
                  name={ic as any}
                  size={22}
                  color={icon === ic ? color : COLORS.textMuted}
                />
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Color picker */}
          <Text style={m.label}>Color</Text>
          <View style={m.colorRow}>
            {HABIT_COLORS.map((c) => (
              <TouchableOpacity
                key={c}
                style={[m.colorDot, { backgroundColor: c }, color === c && m.colorDotActive]}
                onPress={() => setColor(c)}
              >
                {color === c && <Ionicons name="checkmark" size={14} color="#fff" />}
              </TouchableOpacity>
            ))}
          </View>

          {/* Buttons */}
          <View style={m.btnRow}>
            <TouchableOpacity style={m.btnCancel} onPress={onClose}>
              <Text style={m.btnCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[m.btnSave, !name.trim() && m.btnDisabled]}
              onPress={() => name.trim() && onSave({ name: name.trim(), icon, color })}
              activeOpacity={name.trim() ? 0.8 : 1}
            >
              <Text style={m.btnSaveText}>{isEditing ? 'Save changes' : 'Add Habit'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Screen ──────────────────────────────────────────────────────────────────
export default function HabitsScreen() {
  const { habits, loading, loadAll, toggle, add, edit, remove } = useHabitStore();
  const insets = useSafeAreaInsets();
  const fabBottom = Math.max(insets.bottom, 8) + 14 + 68 + 16;

  const [showAdd,       setShowAdd]       = useState(false);
  const [editingHabit,  setEditingHabit]  = useState<Habit | null>(null);

  useEffect(() => { loadAll(); }, []);

  const today          = toIsoDate(new Date());
  const todayDoneCount = habits.filter((h) => h.todayDone).length;
  const totalCount     = habits.length;
  const progress       = totalCount > 0 ? todayDoneCount / totalCount : 0;

  function handleLongPress(habit: Habit) {
    Alert.alert(habit.name, undefined, [
      { text: 'Edit',   onPress: () => setEditingHabit(habit) },
      {
        text: 'Delete', style: 'destructive',
        onPress: () =>
          Alert.alert(
            'Delete Habit',
            `Delete "${habit.name}" and all its history?`,
            [
              { text: 'Cancel',   style: 'cancel' },
              { text: 'Delete',   style: 'destructive', onPress: () => remove(habit.id) },
            ],
          ),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  async function handleSaveNew({ name, icon, color }: ModalFields) {
    await add({ name, icon, color, frequency: 'daily', targetDays: [] });
    setShowAdd(false);
  }

  async function handleSaveEdit({ name, icon, color }: ModalFields) {
    if (!editingHabit) return;
    await edit(editingHabit.id, { name, icon, color });
    setEditingHabit(null);
  }

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.bg} />
      <SafeAreaView style={s.safe} edges={['top']}>

        {/* Header */}
        <View style={s.header}>
          <View>
            <Text style={s.title}>Habits</Text>
            <Text style={s.subtitle}>Build streaks, break patterns</Text>
          </View>
          <Ionicons name="flame" size={30} color="#FF9A56" />
        </View>

        <ScrollView
          style={s.scroll}
          contentContainerStyle={[s.list, { paddingBottom: fabBottom + 24 }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Today's progress card */}
          {totalCount > 0 && (
            <View style={s.progressCard}>
              <View style={s.progressTop}>
                <Text style={s.progressLabel}>Today's Progress</Text>
                <Text style={s.progressCount}>
                  <Text style={s.progressDone}>{todayDoneCount}</Text>
                  <Text style={s.progressTotal}> / {totalCount}</Text>
                </Text>
              </View>
              <View style={s.progressBarBg}>
                <View style={[s.progressBarFill, { width: `${Math.round(progress * 100)}%` as any }]} />
              </View>
              <Text style={s.progressSub}>
                {progress >= 1
                  ? '🎉 All habits done — great day!'
                  : `${Math.round(progress * 100)}% complete`}
              </Text>
            </View>
          )}

          {/* Habits list */}
          {habits.length === 0 && !loading ? (
            <View style={s.empty}>
              <Ionicons name="repeat-outline" size={56} color={COLORS.textMuted} />
              <Text style={s.emptyTitle}>No habits yet</Text>
              <Text style={s.emptySub}>
                Tap + to add your first habit and start building streaks
              </Text>
            </View>
          ) : (
            habits.map((item) => (
              <HabitCard
                key={item.habit.id}
                item={item}
                onToggleToday={(id) => toggle(id, today)}
                onLongPress={handleLongPress}
              />
            ))
          )}
        </ScrollView>
      </SafeAreaView>

      {/* FAB */}
      <TouchableOpacity
        style={[s.fab, { bottom: fabBottom }]}
        onPress={() => setShowAdd(true)}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      <HabitModal
        visible={showAdd}
        onSave={handleSaveNew}
        onClose={() => setShowAdd(false)}
      />

      <HabitModal
        visible={!!editingHabit}
        initial={
          editingHabit
            ? { name: editingHabit.name, icon: editingHabit.icon, color: editingHabit.color }
            : undefined
        }
        onSave={handleSaveEdit}
        onClose={() => setEditingHabit(null)}
      />
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: COLORS.bg },
  safe:   { flex: 1 },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12,
  },
  title:    { fontSize: 26, fontWeight: '800', color: COLORS.text },
  subtitle: { fontSize: 13, color: COLORS.textMuted, marginTop: 2 },

  scroll: { flex: 1 },
  list:   { paddingHorizontal: 16, paddingTop: 4, gap: 10 },

  // ── Progress card
  progressCard: {
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 16,
    marginBottom: 4,
    ...CARD_SHADOW,
  },
  progressTop:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  progressLabel:{ fontSize: 14, fontWeight: '700', color: COLORS.text },
  progressCount:{ fontSize: 15, fontWeight: '700' },
  progressDone: { color: COLORS.primary },
  progressTotal:{ color: COLORS.textMuted },
  progressBarBg:{
    height: 8, borderRadius: 4, backgroundColor: COLORS.cardAlt,
    overflow: 'hidden', marginBottom: 8,
  },
  progressBarFill:{
    height: '100%', borderRadius: 4, backgroundColor: COLORS.primary,
  },
  progressSub: { fontSize: 12, color: COLORS.textMuted },

  // ── Habit card
  habitCard: {
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 14,
    ...CARD_SHADOW,
    borderWidth: 1,
    borderColor: '#E8EAF0',
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },

  iconCircle: {
    width: 44, height: 44, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  cardMid:  { flex: 1 },
  habitName: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  streakSub: { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },

  streakBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, marginRight: 6 },
  streakNum:   { fontSize: 15, fontWeight: '800' },

  checkCircle: {
    width: 30, height: 30, borderRadius: 15,
    borderWidth: 2, borderColor: '#D8DAE5',
    alignItems: 'center', justifyContent: 'center',
  },

  // ── Chain dots
  chain: {
    flexDirection: 'row', gap: 4, alignItems: 'center', paddingTop: 2,
  },
  dot: {
    width: 14, height: 14, borderRadius: 7,
  },
  dotEmpty: {
    backgroundColor: COLORS.cardAlt, borderWidth: 1, borderColor: '#E0E2EB',
  },
  dotToday: {
    width: 18, height: 18, borderRadius: 9,
    borderWidth: 2, borderColor: '#B0B8D8',
  },

  // ── Empty
  empty: { alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  emptySub:   { fontSize: 14, color: COLORS.textMuted, textAlign: 'center', paddingHorizontal: 32 },

  // ── FAB
  fab: {
    position: 'absolute', right: 20,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 8, elevation: 6,
  },
});

const m = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 24, paddingBottom: 36,
  },
  sheetHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 20,
  },
  sheetTitle: { fontSize: 19, fontWeight: '800', color: COLORS.text },

  input: {
    backgroundColor: COLORS.cardAlt,
    borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12,
    fontSize: 15, color: COLORS.text,
    borderWidth: 1, borderColor: '#E8EAF0',
    marginBottom: 16,
  },

  preview: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: 14, padding: 12, marginBottom: 16,
  },
  previewIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  previewName: { fontSize: 15, fontWeight: '700' },

  label: { fontSize: 13, fontWeight: '700', color: COLORS.textSub, marginBottom: 10 },

  iconRow: { gap: 8, paddingBottom: 4 },
  iconOpt: {
    width: 46, height: 46, borderRadius: 14,
    backgroundColor: COLORS.cardAlt,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: 'transparent',
  },

  colorRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 10,
    marginBottom: 24,
  },
  colorDot: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: 'center', justifyContent: 'center',
  },
  colorDotActive: {
    borderWidth: 2.5, borderColor: '#fff',
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 4, elevation: 3,
    transform: [{ scale: 1.15 }],
  },

  btnRow:       { flexDirection: 'row', gap: 10, marginTop: 4 },
  btnCancel:    {
    flex: 1, paddingVertical: 14, borderRadius: 14,
    backgroundColor: COLORS.cardAlt, alignItems: 'center',
  },
  btnCancelText:{ fontSize: 15, fontWeight: '600', color: COLORS.textSub },
  btnSave:      {
    flex: 2, paddingVertical: 14, borderRadius: 14,
    backgroundColor: COLORS.primary, alignItems: 'center',
  },
  btnSaveText:  { fontSize: 15, fontWeight: '700', color: '#fff' },
  btnDisabled:  { opacity: 0.4 },
});
