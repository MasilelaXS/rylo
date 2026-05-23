import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import NoteCard from '../../src/components/NoteCard';
import type { ExtractedTask } from '../../src/services/aiService';
import { expandNote, extractTasksFromNote, improveNote, rewriteNote, summarizeNote } from '../../src/services/aiService';
import { useNoteStore } from '../../src/store/noteStore';
import { useProjectStore } from '../../src/store/projectStore';
import { useTaskStore } from '../../src/store/taskStore';
import type { Note } from '../../src/types';
import { CARD_SHADOW, CARD_SHADOW_SM, COLORS, generateId } from '../../src/utils/constants';

type AiAction = 'improve' | 'summarize' | 'expand' | 'rewrite';
type AiState  = 'idle' | 'loading' | 'done' | 'error';

const AI_ACTIONS: { id: AiAction; label: string; icon: string }[] = [
  { id: 'rewrite',   label: 'Rewrite',   icon: 'briefcase'      },
  { id: 'improve',   label: 'Improve',   icon: 'sparkles'       },
  { id: 'summarize', label: 'Summarize', icon: 'list'           },
  { id: 'expand',    label: 'Expand',    icon: 'expand'         },
];

export default function NotesScreen() {
  const { notes, loadAll, addNote, editNote, removeNote } = useNoteStore();
  const insets = useSafeAreaInsets();
  const fabBottom = Math.max(insets.bottom, 8) + 14 + 68 + 16;

  // ── list state
  const [search, setSearch] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  // ── editor state
  const [editorOpen,   setEditorOpen]   = useState(false);
  const [editingNote,  setEditingNote]  = useState<Note | null>(null);
  const [noteTitle,    setNoteTitle]    = useState('');
  const [noteContent,  setNoteContent]  = useState('');

  // ── AI state
  const [aiState,    setAiState]    = useState<AiState>('idle');
  const [aiResult,   setAiResult]   = useState('');
  const [extracted,  setExtracted]  = useState<ExtractedTask[]>([]);
  const [extracting, setExtracting] = useState(false);

  const { addTask }    = useTaskStore();
  const { projects }   = useProjectStore();

  const contentRef = useRef<TextInput>(null);

  useEffect(() => { loadAll(); }, []);

  // ── filtered list ──────────────────────────────────────────────────────────
  const filtered = search.trim()
    ? notes.filter(
        (n) =>
          n.title.toLowerCase().includes(search.toLowerCase()) ||
          n.content.toLowerCase().includes(search.toLowerCase())
      )
    : notes;

  // ── open editor ────────────────────────────────────────────────────────────
  function openNew() {
    setEditingNote(null);
    setNoteTitle('');
    setNoteContent('');
    resetAi();
    setEditorOpen(true);
  }

  function openEdit(note: Note) {
    setEditingNote(note);
    setNoteTitle(note.title);
    setNoteContent(note.content);
    resetAi();
    setEditorOpen(true);
  }

  function resetAi() {
    setAiState('idle');
    setAiResult('');
    setExtracted([]);
  }

  async function handleExtractTasks() {
    const text = noteContent.trim();
    if (!text) {
      Alert.alert('Nothing to process', 'Add some content to your note first.');
      return;
    }
    setExtracting(true);
    setExtracted([]);
    try {
      const tasks = await extractTasksFromNote(text);
      if (tasks.length === 0) {
        Alert.alert('No tasks found', 'The AI could not detect any tasks in this note.');
      } else {
        setExtracted(tasks);
      }
    } catch {
      Alert.alert('AI Error', 'Could not extract tasks. Please try again.');
    } finally {
      setExtracting(false);
    }
  }

  async function confirmExtractedTask(t: ExtractedTask) {
    const dueDate = t.dueDays != null
      ? Date.now() + t.dueDays * 86_400_000
      : Date.now() + 86_400_000; // default tomorrow
    await addTask({
      id: generateId(),
      title: t.title,
      description: '',
      dueDate,
      priority: t.priority ?? 'medium',
      status: 'pending',
      escalationLevel: 0,
      projectId: null,
      repeatType: 'none',
      voiceReminderEnabled: true,
      communicationTarget: null,
      snoozeCount: 0,
      createdAt: Date.now(),
      estimatedMinutes: 0,
    });
    setExtracted((prev) => prev.filter((x) => x.title !== t.title));
  }

  // ── save / delete ──────────────────────────────────────────────────────────
  async function handleSave() {
    if (!noteTitle.trim() && !noteContent.trim()) {
      setEditorOpen(false);
      return;
    }
    if (editingNote) {
      await editNote(editingNote.id, noteTitle.trim(), noteContent.trim());
    } else {
      await addNote(noteTitle.trim(), noteContent.trim());
    }
    setEditorOpen(false);
  }

  function handleDelete() {
    if (!editingNote) return;
    Alert.alert('Delete Note', 'Are you sure you want to delete this note?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          await removeNote(editingNote.id);
          setEditorOpen(false);
        },
      },
    ]);
  }

  // ── AI actions ─────────────────────────────────────────────────────────────
  async function handleAiAction(action: AiAction) {
    const text = noteContent.trim();
    if (!text) {
      Alert.alert('Nothing to process', 'Add some content to your note first.');
      return;
    }
    setAiState('loading');
    setAiResult('');
    try {
      let result: string;
      if (action === 'improve')        result = await improveNote(text);
      else if (action === 'summarize') result = await summarizeNote(text);
      else if (action === 'rewrite')   result = await rewriteNote(text);
      else                             result = await expandNote(text);
      setAiResult(result);
      setAiState('done');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('GROQ_KEY_MISSING')) {
        Alert.alert(
          'API Key Required',
          'Add your free Groq API key as EXPO_PUBLIC_GROQ_API_KEY in your .env file.\n\nGet one free at console.groq.com'
        );
      } else {
        Alert.alert('AI Error', 'Something went wrong. Please try again.');
      }
      setAiState('error');
    }
  }

  function applyAiResult() {
    setNoteContent(aiResult);
    resetAi();
  }

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <SafeAreaView style={s.safe} edges={['top']}>

        {/* Header */}
        <View style={s.header}>
          {showSearch ? (
            <View style={[s.searchBox, CARD_SHADOW_SM]}>
              <Ionicons name="search" size={16} color={COLORS.textMuted} style={{ marginRight: 6 }} />
              <TextInput
                style={s.searchInput}
                placeholder="Search notes…"
                placeholderTextColor={COLORS.textMuted}
                value={search}
                onChangeText={setSearch}
                autoFocus
              />
              <TouchableOpacity onPress={() => { setShowSearch(false); setSearch(''); }}>
                <Ionicons name="close" size={18} color={COLORS.textMuted} />
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <Text style={s.title}>Notes</Text>
              <TouchableOpacity style={s.iconBtn} onPress={() => setShowSearch(true)}>
                <Ionicons name="search-outline" size={20} color={COLORS.text} />
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Note list */}
        <ScrollView
          style={s.scroll}
          contentContainerStyle={[s.list, { paddingBottom: fabBottom + 20 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {filtered.length === 0 ? (
            <View style={s.emptyWrap}>
              <Ionicons name="document-text-outline" size={52} color={COLORS.textMuted} />
              <Text style={s.emptyTitle}>{search ? 'No results' : 'No notes yet'}</Text>
              <Text style={s.emptySub}>
                {search ? 'Try a different search' : 'Tap + to create your first note'}
              </Text>
            </View>
          ) : (
            filtered.map((note) => (
              <NoteCard key={note.id} note={note} onPress={() => openEdit(note)} />
            ))
          )}
        </ScrollView>
      </SafeAreaView>

      {/* FAB */}
      <TouchableOpacity
        style={[s.fab, { bottom: fabBottom }]}
        onPress={openNew}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      {/* ── Editor Modal ── */}
      <Modal
        visible={editorOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setEditorOpen(false)}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <SafeAreaView style={s.editorRoot} edges={['top', 'bottom']}>

            {/* Editor header */}
            <View style={s.editorHeader}>
              <TouchableOpacity onPress={() => setEditorOpen(false)} style={s.editorBtn}>
                <Text style={s.editorBtnCancel}>Cancel</Text>
              </TouchableOpacity>
              <Text style={s.editorHeading}>{editingNote ? 'Edit Note' : 'New Note'}</Text>
              <TouchableOpacity onPress={handleSave} style={s.editorBtn}>
                <Text style={s.editorBtnSave}>Save</Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={s.editorBody}
              keyboardShouldPersistTaps="handled"
            >
              {/* Title */}
              <TextInput
                style={s.noteTitle}
                placeholder="Title"
                placeholderTextColor={COLORS.textMuted}
                value={noteTitle}
                onChangeText={setNoteTitle}
                returnKeyType="next"
                onSubmitEditing={() => contentRef.current?.focus()}
              />

              {/* Divider */}
              <View style={s.divider} />

              {/* Content */}
              <TextInput
                ref={contentRef}
                style={s.noteContent}
                placeholder="Start writing…"
                placeholderTextColor={COLORS.textMuted}
                value={noteContent}
                onChangeText={(t) => { setNoteContent(t); resetAi(); }}
                multiline
                textAlignVertical="top"
              />

              {/* Extracted tasks */}
              {extracted.length > 0 && (
                <View style={[s.aiResultCard, CARD_SHADOW, { borderColor: '#9B8CFF40' }]}>
                  <View style={s.aiResultHeader}>
                    <Ionicons name="git-branch-outline" size={14} color="#9B8CFF" />
                    <Text style={[s.aiResultLabel, { color: '#9B8CFF' }]}>Extracted Tasks</Text>
                    <TouchableOpacity onPress={() => setExtracted([])}>
                      <Ionicons name="close" size={16} color={COLORS.textMuted} />
                    </TouchableOpacity>
                  </View>
                  {extracted.map((t, i) => (
                    <View key={i} style={s.extractRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.extractTitle}>{t.title}</Text>
                        <Text style={s.extractMeta}>
                          {t.priority ?? 'medium'} priority
                          {t.dueDays != null ? `  ·  due in ${t.dueDays}d` : ''}
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={s.extractConfirmBtn}
                        onPress={() => confirmExtractedTask(t)}
                      >
                        <Ionicons name="add-circle" size={22} color="#9B8CFF" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}

              {/* AI Result card */}
              {aiState === 'done' && aiResult ? (
                <View style={[s.aiResultCard, CARD_SHADOW]}>
                  <View style={s.aiResultHeader}>
                    <Ionicons name="sparkles" size={14} color={COLORS.primary} />
                    <Text style={s.aiResultLabel}>AI Suggestion</Text>
                    <TouchableOpacity onPress={resetAi}>
                      <Ionicons name="close" size={16} color={COLORS.textMuted} />
                    </TouchableOpacity>
                  </View>
                  <Text style={s.aiResultText}>{aiResult}</Text>
                  <TouchableOpacity style={s.applyBtn} onPress={applyAiResult}>
                    <Text style={s.applyBtnText}>Replace my note with this</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </ScrollView>

            {/* AI actions bar */}
            <View style={s.aiBar}>
              {(aiState === 'loading' || extracting) ? (
                <View style={s.aiLoading}>
                  <ActivityIndicator size="small" color={COLORS.primary} />
                  <Text style={s.aiLoadingText}>Thinking…</Text>
                </View>
              ) : (
                <>
                  {AI_ACTIONS.map((a) => (
                    <TouchableOpacity
                      key={a.id}
                      style={[s.aiChip, CARD_SHADOW_SM]}
                      onPress={() => handleAiAction(a.id)}
                      activeOpacity={0.75}
                    >
                      <Ionicons name={a.icon as never} size={14} color={COLORS.primary} />
                      <Text style={s.aiChipText}>{a.label}</Text>
                    </TouchableOpacity>
                  ))}
                  <TouchableOpacity
                    style={[s.aiChip, CARD_SHADOW_SM, { borderColor: '#9B8CFF' }]}
                    onPress={handleExtractTasks}
                    activeOpacity={0.75}
                  >
                    <Ionicons name="git-branch-outline" size={14} color="#9B8CFF" />
                    <Text style={[s.aiChipText, { color: '#9B8CFF' }]}>Extract Tasks</Text>
                  </TouchableOpacity>
                </>
              )}

              {editingNote ? (
                <TouchableOpacity style={s.deleteBtn} onPress={handleDelete}>
                  <Ionicons name="trash-outline" size={18} color={COLORS.danger} />
                </TouchableOpacity>
              ) : null}
            </View>

          </SafeAreaView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  root:  { flex: 1, backgroundColor: COLORS.bg },
  safe:  { flex: 1 },

  // header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 12,
  },
  title: { fontSize: 26, fontWeight: '800', color: COLORS.text, letterSpacing: -0.5 },
  iconBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: COLORS.card,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#E8EAF0',
  },
  searchBox: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.card, borderRadius: 12,
    paddingHorizontal: 12, height: 40,
  },
  searchInput: { flex: 1, fontSize: 14, color: COLORS.text },

  // list
  scroll: { flex: 1 },
  list:   { paddingHorizontal: 16, paddingTop: 4 },

  // empty
  emptyWrap:  { alignItems: 'center', marginTop: 80 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: COLORS.textSub, marginTop: 14 },
  emptySub:   { fontSize: 13, color: COLORS.textMuted, marginTop: 4 },

  // FAB
  fab: {
    position: 'absolute', right: 20,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
  },

  // editor
  editorRoot:    { flex: 1, backgroundColor: '#fff' },
  editorHeader:  {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#F0F0F5',
  },
  editorBtn:        { minWidth: 60 },
  editorBtnCancel:  { fontSize: 15, color: COLORS.textSub },
  editorBtnSave:    { fontSize: 15, fontWeight: '700', color: COLORS.primary, textAlign: 'right' },
  editorHeading:    { fontSize: 15, fontWeight: '600', color: COLORS.text },
  editorBody:       { padding: 16, paddingBottom: 20 },

  noteTitle: {
    fontSize: 22, fontWeight: '700', color: COLORS.text,
    marginBottom: 10, padding: 0,
  },
  divider:     { height: 1, backgroundColor: '#F0F0F5', marginBottom: 12 },
  noteContent: {
    fontSize: 15, color: COLORS.text, lineHeight: 22,
    minHeight: 200, padding: 0,
  },

  // AI result
  aiResultCard: {
    backgroundColor: COLORS.primaryLight,
    borderRadius: 12, padding: 14, marginTop: 16,
  },
  aiResultHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8,
  },
  aiResultLabel: {
    flex: 1, fontSize: 12, fontWeight: '700',
    color: COLORS.primary, letterSpacing: 0.5,
  },
  aiResultText:   { fontSize: 14, color: COLORS.text, lineHeight: 21 },
  applyBtn: {
    marginTop: 12, paddingVertical: 9, borderRadius: 8,
    backgroundColor: COLORS.primary, alignItems: 'center',
  },
  applyBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },

  // Extract tasks
  extractRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderTopWidth: 1, borderTopColor: COLORS.surfaceBorder, gap: 10 },
  extractTitle: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  extractMeta: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  extractConfirmBtn: { padding: 4 },

  // AI bar
  aiBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: '#F0F0F5',
    gap: 8,
  },
  aiChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: COLORS.card, borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 7,
  },
  aiChipText:    { fontSize: 13, fontWeight: '600', color: COLORS.primary },
  aiLoading:     { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  aiLoadingText: { fontSize: 13, color: COLORS.textSub },
  deleteBtn:     { marginLeft: 'auto' },
});
