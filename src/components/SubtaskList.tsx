import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import {
    deleteSubtask,
    getSubtasksForTask,
    insertSubtask,
    toggleSubtask,
} from '../database/subtasks';
import type { Subtask } from '../types';
import { COLORS, generateId } from '../utils/constants';

interface Props {
  taskId: string;
  /** If true the component renders as a checklist inside an open task editor */
  editable?: boolean;
}

export default function SubtaskList({ taskId, editable = false }: Props) {
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [newTitle, setNewTitle] = useState('');
  const inputRef = useRef<TextInput>(null);

  const load = useCallback(async () => {
    const rows = await getSubtasksForTask(taskId);
    setSubtasks(rows);
  }, [taskId]);

  useEffect(() => {
    if (taskId) load();
  }, [taskId, load]);

  const handleAdd = async () => {
    const title = newTitle.trim();
    if (!title) return;
    const sub: Subtask = {
      id: generateId(),
      taskId,
      title,
      completed: false,
      sortOrder: subtasks.length,
      createdAt: Date.now(),
    };
    await insertSubtask(sub);
    setNewTitle('');
    load();
  };

  const handleToggle = async (id: string) => {
    await toggleSubtask(id);
    load();
  };

  const handleDelete = async (id: string) => {
    await deleteSubtask(id);
    load();
  };

  const doneCount = subtasks.filter((s) => s.completed).length;

  if (subtasks.length === 0 && !editable) return null;

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <Ionicons name="list-outline" size={14} color={COLORS.textSub} />
        <Text style={s.headerText}>
          Subtasks{subtasks.length > 0 ? ` · ${doneCount}/${subtasks.length}` : ''}
        </Text>
      </View>

      {/* Progress bar */}
      {subtasks.length > 0 && (
        <View style={s.track}>
          <View
            style={[
              s.fill,
              {
                width: `${Math.round((doneCount / subtasks.length) * 100)}%` as `${number}%`,
                backgroundColor: doneCount === subtasks.length ? COLORS.success : COLORS.primary,
              },
            ]}
          />
        </View>
      )}

      {/* List */}
      {subtasks.map((sub) => (
        <View key={sub.id} style={s.row}>
          <TouchableOpacity
            onPress={() => handleToggle(sub.id)}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Ionicons
              name={sub.completed ? 'checkmark-circle' : 'ellipse-outline'}
              size={18}
              color={sub.completed ? COLORS.success : COLORS.textMuted}
            />
          </TouchableOpacity>
          <Text
            style={[s.subTitle, sub.completed && s.subTitleDone]}
            numberOfLines={2}
          >
            {sub.title}
          </Text>
          {editable && (
            <TouchableOpacity
              onPress={() => handleDelete(sub.id)}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <Ionicons name="close" size={15} color={COLORS.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      ))}

      {/* Add input */}
      {editable && (
        <View style={s.addRow}>
          <TextInput
            ref={inputRef}
            style={s.input}
            placeholder="Add subtask…"
            placeholderTextColor={COLORS.textMuted}
            value={newTitle}
            onChangeText={setNewTitle}
            onSubmitEditing={handleAdd}
            returnKeyType="done"
          />
          <TouchableOpacity onPress={handleAdd} style={s.addBtn} disabled={!newTitle.trim()}>
            <Ionicons
              name="add-circle-outline"
              size={20}
              color={newTitle.trim() ? COLORS.primary : COLORS.textMuted}
            />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { marginTop: 10 },
  header:    { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  headerText:{ fontSize: 12, fontWeight: '600', color: COLORS.textSub },
  track: {
    height: 3, borderRadius: 2, backgroundColor: COLORS.cardAlt,
    marginBottom: 8, overflow: 'hidden',
    borderWidth: 1, borderColor: COLORS.surfaceBorder,
  },
  fill: { height: '100%', borderRadius: 2 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 4,
  },
  subTitle:     { flex: 1, fontSize: 13, color: COLORS.text },
  subTitleDone: { textDecorationLine: 'line-through', color: COLORS.textMuted },
  addRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderTopWidth: 1, borderTopColor: COLORS.surfaceBorder,
    marginTop: 6, paddingTop: 6,
  },
  input: {
    flex: 1, fontSize: 13, color: COLORS.text,
    paddingVertical: 4,
  },
  addBtn: { padding: 2 },
});
