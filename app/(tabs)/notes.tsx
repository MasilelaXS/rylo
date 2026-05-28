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
import Markdown from 'react-native-markdown-display';
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
  const { notes, loadAll, addNote, editNote, removeNote, pinNote } = useNoteStore();
  const insets    = useSafeAreaInsets();
  const fabBottom = Math.max(insets.bottom, 8) + 14 + 68 + 16;

  // ── list state ─────────────────────────────────────────────────────────────
  const [search,       setSearch]       = useState('');
  const [showSearch,   setShowSearch]   = useState(false);
  const [galleryMode,  setGalleryMode]  = useState(false);
  const [activeFolder, setActiveFolder] = useState('All');
  const [tagFilter,    setTagFilter]    = useState<string | null>(null);

  // ── editor state ───────────────────────────────────────────────────────────
  const [editorOpen,   setEditorOpen]   = useState(false);
  const [editingNote,  setEditingNote]  = useState<Note | null>(null);
  const [noteTitle,    setNoteTitle]    = useState('');
  const [noteContent,  setNoteContent]  = useState('');
  const [noteTags,     setNoteTags]     = useState<string[]>([]);
  const [noteFolder,   setNoteFolder]   = useState('');
  const [notePinned,   setNotePinned]   = useState(false);
  const [previewMode,  setPreviewMode]  = useState(false);
  const [tagInput,     setTagInput]     = useState('');
  const [showFolderPicker, setShowFolderPicker] = useState(false);
  const [newFolderText, setNewFolderText] = useState('');

  // ── AI state ───────────────────────────────────────────────────────────────
  const [aiState,    setAiState]    = useState<AiState>('idle');
  const [aiResult,   setAiResult]   = useState('');
  const [extracted,  setExtracted]  = useState<ExtractedTask[]>([]);
  const [extracting, setExtracting] = useState(false);

  const { addTask }  = useTaskStore();
  const { projects } = useProjectStore();
  const contentRef   = useRef<TextInput>(null);

  useEffect(() => { loadAll(); }, []);

  // ── derived ────────────────────────────────────────────────────────────────
  const allFolders = Array.from(new Set(notes.map(n => n.folder).filter(Boolean)));
  const allTags    = Array.from(new Set(notes.flatMap(n => n.tags)));

  const filtered = notes.filter(n => {
    if (activeFolder !== 'All' && n.folder !== activeFolder) return false;
    if (tagFilter && !n.tags.includes(tagFilter)) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q);
    }
    return true;
  });

  // ── open editor ────────────────────────────────────────────────────────────
  function openNew() {
    setEditingNote(null);
    setNoteTitle('');
    setNoteContent('');
    setNoteTags([]);
    setNoteFolder(activeFolder !== 'All' ? activeFolder : '');
    setNotePinned(false);
    setPreviewMode(false);
    setTagInput('');
    resetAi();
    setEditorOpen(true);
  }

  function openEdit(note: Note) {
    setEditingNote(note);
    setNoteTitle(note.title);
    setNoteContent(note.content);
    setNoteTags([...note.tags]);
    setNoteFolder(note.folder);
    setNotePinned(note.pinned);
    setPreviewMode(false);
    setTagInput('');
    resetAi();
    setEditorOpen(true);
  }

  function resetAi() {
    setAiState('idle');
    setAiResult('');
    setExtracted([]);
  }

  // ── tag management ─────────────────────────────────────────────────────────
  function addTag() {
    const t = tagInput.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    if (t && !noteTags.includes(t)) setNoteTags(prev => [...prev, t]);
    setTagInput('');
  }

  function removeTag(tag: string) {
    setNoteTags(prev => prev.filter(x => x !== tag));
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
    const opts = { tags: noteTags, folder: noteFolder, pinned: notePinned };
    if (editingNote) {
      await editNote(editingNote.id, noteTitle.trim(), noteContent.trim(), opts);
    } else {
      await addNote(noteTitle.trim(), noteContent.trim(), opts);
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
                placeholder="Search notes..."
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
              <View style={s.headerActions}>
                <TouchableOpacity style={s.iconBtn} onPress={() => setShowSearch(true)}>
                  <Ionicons name="search-outline" size={20} color={COLORS.text} />
                </TouchableOpacity>
                <TouchableOpacity style={[s.iconBtn, galleryMode && { borderColor: COLORS.primary }]} onPress={() => setGalleryMode(g => !g)}>
                  <Ionicons name={galleryMode ? 'list-outline' : 'grid-outline'} size={20} color={galleryMode ? COLORS.primary : COLORS.text} />
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>

        {/* Folder tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={s.folderRow}>
          {['All', ...allFolders].map(folder => (
            <TouchableOpacity
              key={folder}
              style={[s.folderChip, activeFolder === folder && s.folderChipActive]}
              onPress={() => { setActiveFolder(folder); setTagFilter(null); }}
              activeOpacity={0.75}
            >
              <Ionicons
                name={folder === 'All' ? 'albums-outline' : 'folder-outline'}
                size={13}
                color={activeFolder === folder ? '#fff' : COLORS.textSub}
              />
              <Text style={[s.folderChipText, activeFolder === folder && s.folderChipTextActive]}>
                {folder}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Tag filter chips */}
        {allTags.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={s.tagFilterRow}>
            {tagFilter !== null && (
              <TouchableOpacity style={s.tagFilterClear} onPress={() => setTagFilter(null)}>
                <Ionicons name="close-circle" size={14} color={COLORS.danger} />
                <Text style={s.tagFilterClearText}>Clear</Text>
              </TouchableOpacity>
            )}
            {allTags.map(tag => (
              <TouchableOpacity
                key={tag}
                style={[s.tagFilterChip, tagFilter === tag && s.tagFilterChipActive]}
                onPress={() => setTagFilter(tagFilter === tag ? null : tag)}
                activeOpacity={0.75}
              >
                <Text style={[s.tagFilterChipText, tagFilter === tag && s.tagFilterChipTextActive]}>#{tag}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* Note list / gallery */}
        <ScrollView
          style={s.scroll}
          contentContainerStyle={[galleryMode ? s.galleryGrid : s.list, { paddingBottom: fabBottom + 20 }]}
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
            filtered.map(note => (
              <NoteCard
                key={note.id}
                note={note}
                onPress={() => openEdit(note)}
                layout={galleryMode ? 'gallery' : 'list'}
              />
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

      {/* Folder picker modal */}
      <Modal visible={showFolderPicker} transparent animationType="slide" onRequestClose={() => setShowFolderPicker(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalSheet}>
            <View style={s.modalHandle} />
            <Text style={s.modalTitle}>Choose Folder</Text>
            <TouchableOpacity style={s.folderRow2} onPress={() => { setNoteFolder(''); setShowFolderPicker(false); }}>
              <Ionicons name="remove-circle-outline" size={20} color={COLORS.textMuted} />
              <Text style={s.folderRowText}>No folder</Text>
            </TouchableOpacity>
            {allFolders.map(f => (
              <TouchableOpacity key={f} style={s.folderRow2} onPress={() => { setNoteFolder(f); setShowFolderPicker(false); }}>
                <Ionicons name="folder-outline" size={20} color={COLORS.primary} />
                <Text style={s.folderRowText}>{f}</Text>
              </TouchableOpacity>
            ))}
            <View style={s.newFolderRow}>
              <TextInput
                style={s.newFolderInput}
                placeholder="Create new folder..."
                placeholderTextColor={COLORS.textMuted}
                value={newFolderText}
                onChangeText={setNewFolderText}
                returnKeyType="done"
                onSubmitEditing={() => {
                  const f = newFolderText.trim();
                  if (f) { setNoteFolder(f); setNewFolderText(''); setShowFolderPicker(false); }
                }}
              />
            </View>
          </View>
        </View>
      </Modal>

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
              <View style={s.editorHeaderCenter}>
                <TouchableOpacity
                  onPress={() => setNotePinned(p => !p)}
                  style={[s.headerIconBtn, notePinned && { backgroundColor: COLORS.primaryLight }]}
                >
                  <Ionicons name={notePinned ? 'pin' : 'pin-outline'} size={17} color={notePinned ? COLORS.primary : COLORS.textMuted} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setPreviewMode(p => !p)}
                  style={[s.headerIconBtn, previewMode && { backgroundColor: COLORS.primaryLight }]}
                >
                  <Ionicons name={previewMode ? 'create-outline' : 'eye-outline'} size={17} color={previewMode ? COLORS.primary : COLORS.textMuted} />
                </TouchableOpacity>
              </View>
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
              <View style={s.divider} />

              {/* Folder chip */}
              <View style={s.metaRow}>
                <TouchableOpacity style={s.metaChip} onPress={() => setShowFolderPicker(true)}>
                  <Ionicons name="folder-outline" size={13} color={COLORS.textSub} />
                  <Text style={s.metaChipText}>{noteFolder || 'No folder'}</Text>
                  <Ionicons name="chevron-down" size={11} color={COLORS.textMuted} />
                </TouchableOpacity>
              </View>

              {/* Tags */}
              <View style={s.tagEditorRow}>
                {noteTags.map(tag => (
                  <TouchableOpacity key={tag} style={s.tagBubble} onPress={() => removeTag(tag)}>
                    <Text style={s.tagBubbleText}>#{tag}</Text>
                    <Ionicons name="close" size={11} color={COLORS.primary} style={{ marginLeft: 3 }} />
                  </TouchableOpacity>
                ))}
                <TextInput
                  style={s.tagEditorInput}
                  placeholder="+ add tag"
                  placeholderTextColor={COLORS.textMuted}
                  value={tagInput}
                  onChangeText={setTagInput}
                  onSubmitEditing={addTag}
                  returnKeyType="done"
                  blurOnSubmit={false}
                />
              </View>

              {/* Content — edit or markdown preview */}
              {previewMode ? (
                <View style={s.previewWrap}>
                  {noteContent.trim() ? (
                    <Markdown style={mdStyles}>{noteContent}</Markdown>
                  ) : (
                    <Text style={s.previewEmpty}>Nothing to preview yet...</Text>
                  )}
                </View>
              ) : (
                <TextInput
                  ref={contentRef}
                  style={s.noteContent}
                  placeholder={'Start writing...\n\nTip: Use markdown\n  **bold**  _italic_\n  # Heading\n  - bullet list\n  `code`'}
                  placeholderTextColor={COLORS.textMuted}
                  value={noteContent}
                  onChangeText={(t) => { setNoteContent(t); resetAi(); }}
                  multiline
                  textAlignVertical="top"
                />
              )}

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
                          {t.dueDays != null ? `  |  due in ${t.dueDays}d` : ''}
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
                  <Text style={s.aiLoadingText}>Thinking...</Text>
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

const mdStyles = {
  body:        { fontSize: 15, color: COLORS.text, lineHeight: 22 },
  heading1:    { fontSize: 22, fontWeight: '700' as const, color: COLORS.text, marginBottom: 8, marginTop: 16 },
  heading2:    { fontSize: 18, fontWeight: '700' as const, color: COLORS.text, marginBottom: 6, marginTop: 14 },
  heading3:    { fontSize: 16, fontWeight: '600' as const, color: COLORS.text, marginBottom: 4, marginTop: 12 },
  strong:      { fontWeight: '700' as const },
  em:          { fontStyle: 'italic' as const },
  code_inline: { backgroundColor: '#F0F0F5', borderRadius: 4, fontSize: 13 },
  code_block:  { backgroundColor: '#F8F9FC', borderRadius: 8, padding: 12, marginVertical: 8 },
  fence:       { backgroundColor: '#F8F9FC', borderRadius: 8, padding: 12, marginVertical: 8 },
  bullet_list: { marginVertical: 4 },
  ordered_list:{ marginVertical: 4 },
  list_item:   { marginVertical: 2 },
  blockquote:  { backgroundColor: COLORS.primaryLight, borderRadius: 6, paddingHorizontal: 12, paddingVertical: 4, marginVertical: 8, opacity: 0.9 },
  hr:          { backgroundColor: '#E8EAF0', height: 1, marginVertical: 12 },
  link:        { color: COLORS.primary },
};

const s = StyleSheet.create({
  root:  { flex: 1, backgroundColor: COLORS.bg },
  safe:  { flex: 1 },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 6, paddingBottom: 10,
  },
  title:         { fontSize: 26, fontWeight: '800', color: COLORS.text, letterSpacing: -0.5 },
  headerActions: { flexDirection: 'row', gap: 8 },
  iconBtn: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: COLORS.card,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E8EAF0',
  },
  searchBox: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.card, borderRadius: 12, paddingHorizontal: 12, height: 40,
  },
  searchInput: { flex: 1, fontSize: 14, color: COLORS.text },

  // folders
  folderRow:            { paddingHorizontal: 16, paddingBottom: 10, gap: 8 },
  folderChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: COLORS.card, borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 7,
    borderWidth: 1, borderColor: '#E8EAF0',
  },
  folderChipActive:     { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  folderChipText:       { fontSize: 13, fontWeight: '600', color: COLORS.textSub },
  folderChipTextActive: { color: '#fff' },

  // tag filter
  tagFilterRow:            { paddingHorizontal: 16, paddingBottom: 8, gap: 6 },
  tagFilterChip:           { backgroundColor: COLORS.card, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: '#E8EAF0' },
  tagFilterChipActive:     { backgroundColor: COLORS.primaryLight, borderColor: COLORS.primary },
  tagFilterChipText:       { fontSize: 12, fontWeight: '600', color: COLORS.textSub },
  tagFilterChipTextActive: { color: COLORS.primary },
  tagFilterClear:          { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 5 },
  tagFilterClearText:      { fontSize: 12, color: COLORS.danger, fontWeight: '600' },

  scroll:      { flex: 1 },
  list:        { paddingHorizontal: 16, paddingTop: 4 },
  galleryGrid: { paddingHorizontal: 11, paddingTop: 4, flexDirection: 'row', flexWrap: 'wrap' },

  emptyWrap:  { alignItems: 'center', marginTop: 80, flex: 1, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: COLORS.textSub, marginTop: 14 },
  emptySub:   { fontSize: 13, color: COLORS.textMuted, marginTop: 4, textAlign: 'center' },

  fab: {
    position: 'absolute', right: 20, width: 56, height: 56, borderRadius: 28,
    backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center',
  },

  // folder picker modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(26,29,46,0.5)', justifyContent: 'flex-end' },
  modalSheet:   { backgroundColor: COLORS.card, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24 },
  modalHandle:  { width: 40, height: 4, borderRadius: 2, backgroundColor: COLORS.textMuted, alignSelf: 'center', marginBottom: 20 },
  modalTitle:   { fontSize: 20, fontWeight: '800', color: COLORS.text, marginBottom: 16 },
  folderRow2:   { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F0F0F5' },
  folderRowText:{ fontSize: 15, color: COLORS.text },
  newFolderRow: { marginTop: 16 },
  newFolderInput: {
    backgroundColor: COLORS.cardAlt, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: COLORS.text,
  },

  // editor
  editorRoot:   { flex: 1, backgroundColor: '#fff' },
  editorHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#F0F0F5',
  },
  editorBtn:          { minWidth: 60 },
  editorBtnCancel:    { fontSize: 15, color: COLORS.textSub },
  editorBtnSave:      { fontSize: 15, fontWeight: '700', color: COLORS.primary, textAlign: 'right' },
  editorHeaderCenter: { flexDirection: 'row', gap: 8, flex: 1, justifyContent: 'center' },
  headerIconBtn: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.cardAlt,
  },
  editorBody: { padding: 16, paddingBottom: 20 },

  noteTitle: { fontSize: 22, fontWeight: '700', color: COLORS.text, marginBottom: 10, padding: 0 },
  divider:   { height: 1, backgroundColor: '#F0F0F5', marginBottom: 10 },

  metaRow:      { flexDirection: 'row', gap: 8, marginBottom: 10 },
  metaChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: COLORS.cardAlt, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6,
  },
  metaChipText: { fontSize: 12, color: COLORS.textSub, fontWeight: '600' },

  tagEditorRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12,
    minHeight: 32, alignItems: 'center',
  },
  tagBubble: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.primaryLight, borderRadius: 12,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  tagBubbleText: { fontSize: 12, color: COLORS.primary, fontWeight: '600' },
  tagEditorInput:{ fontSize: 13, color: COLORS.text, minWidth: 80, padding: 0, paddingVertical: 4 },

  noteContent: { fontSize: 15, color: COLORS.text, lineHeight: 22, minHeight: 200, padding: 0 },
  previewWrap: { minHeight: 200, paddingTop: 4 },
  previewEmpty:{ fontSize: 14, color: COLORS.textMuted, fontStyle: 'italic', marginTop: 8 },

  aiResultCard:   { backgroundColor: COLORS.primaryLight, borderRadius: 12, padding: 14, marginTop: 16 },
  aiResultHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  aiResultLabel:  { flex: 1, fontSize: 12, fontWeight: '700', color: COLORS.primary, letterSpacing: 0.5 },
  aiResultText:   { fontSize: 14, color: COLORS.text, lineHeight: 21 },
  applyBtn:       { marginTop: 12, paddingVertical: 9, borderRadius: 8, backgroundColor: COLORS.primary, alignItems: 'center' },
  applyBtnText:   { fontSize: 13, fontWeight: '700', color: '#fff' },

  extractRow:        { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, marginTop: 4, gap: 10 },
  extractTitle:      { fontSize: 14, fontWeight: '600', color: COLORS.text },
  extractMeta:       { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  extractConfirmBtn: { padding: 4 },

  aiBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: COLORS.cardAlt, gap: 8,
  },
  aiChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: COLORS.card, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7,
  },
  aiChipText:    { fontSize: 13, fontWeight: '600', color: COLORS.primary },
  aiLoading:     { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  aiLoadingText: { fontSize: 13, color: COLORS.textSub },
  deleteBtn:     { marginLeft: 'auto' },
});
