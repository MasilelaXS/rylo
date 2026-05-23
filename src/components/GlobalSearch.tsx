import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
    FlatList,
    Modal,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { useNoteStore } from '../store/noteStore';
import { useProjectStore } from '../store/projectStore';
import { useTaskStore } from '../store/taskStore';
import { COLORS } from '../utils/constants';

type ResultKind = 'task' | 'note' | 'project';

interface SearchResult {
  id: string;
  kind: ResultKind;
  title: string;
  subtitle?: string;
}

interface Props {
  visible: boolean;
  onClose: () => void;
}

const KIND_ICON: Record<ResultKind, keyof typeof Ionicons.glyphMap> = {
  task:    'checkmark-circle-outline',
  note:    'document-text-outline',
  project: 'folder-outline',
};

const KIND_COLOR: Record<ResultKind, string> = {
  task:    COLORS.primary,
  note:    '#F5A623',
  project: '#9B8CFF',
};

const KIND_LABEL: Record<ResultKind, string> = {
  task:    'Task',
  note:    'Note',
  project: 'Project',
};

export default function GlobalSearch({ visible, onClose }: Props) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<TextInput>(null);
  const tasks = useTaskStore((s) => s.tasks);
  const notes = useNoteStore((s) => s.notes);
  const projects = useProjectStore((s) => s.projects);

  // Focus input when opened
  useEffect(() => {
    if (visible) {
      setQuery('');
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [visible]);

  const results = useMemo<SearchResult[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];

    const matched: SearchResult[] = [];

    tasks.forEach((t) => {
      if (
        t.title.toLowerCase().includes(q) ||
        (t.description ?? '').toLowerCase().includes(q) ||
        (t.location ?? '').toLowerCase().includes(q)
      ) {
        matched.push({
          id: t.id,
          kind: 'task',
          title: t.title,
          subtitle: t.description ? t.description.slice(0, 60) : undefined,
        });
      }
    });

    notes.forEach((n) => {
      if (
        n.title.toLowerCase().includes(q) ||
        n.content.toLowerCase().includes(q)
      ) {
        matched.push({
          id: n.id,
          kind: 'note',
          title: n.title,
          subtitle: n.content.slice(0, 60),
        });
      }
    });

    projects.forEach((p) => {
      if (
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q)
      ) {
        matched.push({
          id: p.id,
          kind: 'project',
          title: p.name,
          subtitle: p.description ? p.description.slice(0, 60) : undefined,
        });
      }
    });

    return matched;
  }, [query, tasks, notes, projects]);

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <View style={s.backdrop}>
        <View style={s.sheet}>
          {/* Search bar */}
          <View style={s.searchRow}>
            <Ionicons name="search" size={20} color={COLORS.textMuted} style={s.searchIcon} />
            <TextInput
              ref={inputRef}
              style={s.input}
              placeholder="Search tasks, notes, projects…"
              placeholderTextColor={COLORS.textMuted}
              value={query}
              onChangeText={setQuery}
              returnKeyType="search"
              clearButtonMode="while-editing"
              autoCorrect={false}
            />
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={20} color={COLORS.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Results */}
          {query.trim() === '' ? (
            <View style={s.empty}>
              <Ionicons name="search-outline" size={42} color={COLORS.surfaceBorder} />
              <Text style={s.emptyText}>Type to search everything</Text>
            </View>
          ) : results.length === 0 ? (
            <View style={s.empty}>
              <Ionicons name="sad-outline" size={42} color={COLORS.surfaceBorder} />
              <Text style={s.emptyText}>No results for "{query}"</Text>
            </View>
          ) : (
            <FlatList
              data={results}
              keyExtractor={(r) => `${r.kind}:${r.id}`}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: 20 }}
              renderItem={({ item }) => (
                <TouchableOpacity style={s.row} activeOpacity={0.7} onPress={onClose}>
                  <View style={[s.iconWrap, { backgroundColor: KIND_COLOR[item.kind] + '20' }]}>
                    <Ionicons name={KIND_ICON[item.kind]} size={18} color={KIND_COLOR[item.kind]} />
                  </View>
                  <View style={s.rowBody}>
                    <Text style={s.rowTitle} numberOfLines={1}>{item.title}</Text>
                    {item.subtitle ? (
                      <Text style={s.rowSub} numberOfLines={1}>{item.subtitle}</Text>
                    ) : null}
                  </View>
                  <View style={[s.kindBadge, { backgroundColor: KIND_COLOR[item.kind] + '18' }]}>
                    <Text style={[s.kindText, { color: KIND_COLOR[item.kind] }]}>
                      {KIND_LABEL[item.kind]}
                    </Text>
                  </View>
                </TouchableOpacity>
              )}
              ItemSeparatorComponent={() => <View style={s.sep} />}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-start',
    paddingTop: 60,
    paddingHorizontal: 16,
  },
  sheet: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    overflow: 'hidden',
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 12,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.surfaceBorder,
    gap: 8,
  },
  searchIcon: { marginRight: 2 },
  input: {
    flex: 1,
    fontSize: 16,
    color: COLORS.text,
    fontWeight: '500',
  },
  empty: {
    alignItems: 'center',
    paddingVertical: 48,
    gap: 12,
  },
  emptyText: {
    color: COLORS.textMuted,
    fontSize: 15,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBody: { flex: 1 },
  rowTitle: { color: COLORS.text, fontSize: 15, fontWeight: '600' },
  rowSub: { color: COLORS.textMuted, fontSize: 13, marginTop: 2 },
  kindBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  kindText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  sep: { height: 1, backgroundColor: COLORS.surfaceBorder, marginLeft: 66 },
});
