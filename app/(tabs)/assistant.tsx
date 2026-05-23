import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    KeyboardAvoidingView,
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
import { chatWithAssistant } from '../../src/services/aiService';
import { useProjectStore } from '../../src/store/projectStore';
import { useSettingsStore } from '../../src/store/settingsStore';
import { useTaskStore } from '../../src/store/taskStore';
import type { Priority } from '../../src/types';
import { CARD_SHADOW_SM, COLORS, generateId } from '../../src/utils/constants';
import { speakText, stopSpeaking } from '../../src/voice/ttsService';

// ─── Types ────────────────────────────────────────────────────────────────────
interface ParsedTask {
  title: string;
  description?: string;
  priority?: Priority;
  dueDays?: number;
}

interface ParsedProject {
  name: string;
  description?: string;
  color?: string;
}

type ActionItem =
  | { type: 'task';    data: ParsedTask;    created: boolean }
  | { type: 'project'; data: ParsedProject; created: boolean };

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;       // display text — markers already stripped
  actions?: ActionItem[];
}

// ─── Parsing helpers ──────────────────────────────────────────────────────────
function parseAIResponse(raw: string): { text: string; actions: ActionItem[] } {
  const actions: ActionItem[] = [];
  let text = raw;

  const taskRx = /<<CREATE_TASK>>([\s\S]*?)<<END_TASK>>/g;
  let m: RegExpExecArray | null;
  while ((m = taskRx.exec(raw)) !== null) {
    try { actions.push({ type: 'task', data: JSON.parse(m[1]), created: false }); } catch { /* skip malformed */ }
  }
  text = text.replace(/<<CREATE_TASK>>[\s\S]*?<<END_TASK>>/g, '').trim();

  const projRx = /<<CREATE_PROJECT>>([\s\S]*?)<<END_PROJECT>>/g;
  while ((m = projRx.exec(raw)) !== null) {
    try { actions.push({ type: 'project', data: JSON.parse(m[1]), created: false }); } catch { /* skip malformed */ }
  }
  text = text.replace(/<<CREATE_PROJECT>>[\s\S]*?<<END_PROJECT>>/g, '').trim();

  return { text, actions };
}

function dueDateFromDays(days: number): number {
  const d = new Date();
  d.setHours(d.getHours() + 1, 0, 0, 0);
  d.setDate(d.getDate() + (days ?? 1));
  return d.getTime();
}

const PRIORITY_COLORS: Record<Priority, { bg: string; text: string }> = {
  low:    { bg: '#F0F4FF', text: '#6E7191' },
  medium: { bg: COLORS.primaryLight, text: COLORS.primary },
  high:   { bg: COLORS.warningLight, text: '#B97D00' },
  urgent: { bg: COLORS.dangerLight, text: COLORS.danger },
};

const STARTERS = [
  "What should I focus on today?",
  "Analyse my current workload",
  "What tasks are overdue?",
  "Create a task for me",
  "Help me set up a new project",
];

// ─── Inline action card ───────────────────────────────────────────────────────
function ActionCard({
  item,
  onCreated,
}: {
  item: ActionItem;
  onCreated: () => void;
}) {
  const { addTask } = useTaskStore();
  const { addProject } = useProjectStore();
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    setLoading(true);
    try {
      if (item.type === 'task') {
        const t = item.data as ParsedTask;
        await addTask({
          id: generateId(),
          title: t.title,
          description: t.description ?? '',
          priority: t.priority ?? 'medium',
          status: 'pending',
          dueDate: dueDateFromDays(t.dueDays ?? 1),
          projectId: null,
          repeatType: 'none',
          estimatedMinutes: 0,
          voiceReminderEnabled: true,
          communicationTarget: null,
          escalationLevel: 0,
          snoozeCount: 0,
          createdAt: Date.now(),
        });
      } else {
        const p = item.data as ParsedProject;
        await addProject({
          id: generateId(),
          name: p.name,
          description: p.description ?? '',
          color: p.color ?? COLORS.primary,
          createdAt: Date.now(),
        });
      }
      onCreated();
    } catch { /* silently fail */ }
    finally { setLoading(false); }
  };

  const isTask    = item.type === 'task';
  const taskData  = isTask ? (item.data as ParsedTask) : null;
  const projData  = !isTask ? (item.data as ParsedProject) : null;
  const priority  = taskData?.priority ?? 'medium';
  const pColor    = PRIORITY_COLORS[priority];
  const dueDays   = taskData?.dueDays ?? 1;
  const dueLabel  = dueDays === 0 ? 'Today' : dueDays === 1 ? 'Tomorrow' : `In ${dueDays} days`;

  if (item.created) {
    return (
      <View style={ac.card}>
        <View style={ac.createdRow}>
          <View style={ac.createdIcon}>
            <Ionicons name="checkmark-circle" size={18} color={COLORS.success} />
          </View>
          <Text style={ac.createdText}>
            {isTask ? 'Task created' : 'Project created'}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={ac.card}>
      <View style={ac.headerRow}>
        <View style={[ac.typeIcon, { backgroundColor: isTask ? COLORS.primaryLight : '#EEE8FF' }]}>
          <Ionicons
            name={isTask ? 'checkmark-circle-outline' : 'folder-outline'}
            size={16}
            color={isTask ? COLORS.primary : '#9B8CFF'}
          />
        </View>
        <Text style={ac.typeLabel}>{isTask ? 'New Task' : 'New Project'}</Text>
      </View>

      <Text style={ac.title} numberOfLines={2}>
        {isTask ? taskData!.title : projData!.name}
      </Text>

      {(isTask ? taskData!.description : projData!.description) ? (
        <Text style={ac.desc} numberOfLines={2}>
          {isTask ? taskData!.description : projData!.description}
        </Text>
      ) : null}

      {isTask && (
        <View style={ac.metaRow}>
          <View style={[ac.badge, { backgroundColor: pColor.bg }]}>
            <Text style={[ac.badgeText, { color: pColor.text }]}>
              {priority.toUpperCase()}
            </Text>
          </View>
          <Text style={ac.metaDot}>·</Text>
          <Text style={ac.metaText}>{dueLabel}</Text>
        </View>
      )}

      {!isTask && projData!.color && (
        <View style={ac.metaRow}>
          <View style={[ac.colorDot, { backgroundColor: projData!.color }]} />
          <Text style={ac.metaText}>{projData!.color}</Text>
        </View>
      )}

      <TouchableOpacity
        style={ac.createBtn}
        onPress={handleCreate}
        disabled={loading}
        activeOpacity={0.8}
      >
        {loading
          ? <ActivityIndicator size="small" color="#fff" />
          : <>
              <Ionicons name="add-circle-outline" size={16} color="#fff" />
              <Text style={ac.createBtnText}>
                {isTask ? 'Add to Tasks' : 'Create Project'}
              </Text>
            </>
        }
      </TouchableOpacity>
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function AssistantScreen() {
  const { todayTasks, overdueTasks, tasks, loadAll } = useTaskStore();
  const { projects, loadAll: loadProjects } = useProjectStore();
  const { settings } = useSettingsStore();
  const insets = useSafeAreaInsets();
  const tabBarClearance = Math.max(insets.bottom, 8) + 14 + 68 + 10;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput]       = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => { loadAll(); loadProjects(); }, []);

  const taskContext = useMemo(() => {
    const total   = todayTasks.length;
    const done    = todayTasks.filter((t) => t.status === 'completed').length;
    const overdue = overdueTasks.length;
    const streak  = settings.currentStreak ?? 0;

    const estMins = todayTasks
      .filter((t) => t.status !== 'completed')
      .reduce((sum, t) => sum + (t.estimatedMinutes ?? 0), 0);

    // Project lookup for task context
    const projectMap = Object.fromEntries(projects.map((p) => [p.id, p.name]));

    const fmtTask = (t: (typeof tasks)[0]) => {
      const due = t.dueDate
        ? new Date(t.dueDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
        : 'no due date';
      const proj = t.projectId ? ` [project: ${projectMap[t.projectId] ?? t.projectId}]` : '';
      const desc = t.description ? ` — ${t.description}` : '';
      const est  = t.estimatedMinutes ? ` (~${t.estimatedMinutes}m)` : '';
      return `• [${t.status}] ${t.title} | ${t.priority} priority | due ${due}${est}${proj}${desc}`;
    };

    // All pending & overdue tasks (no cap)
    const pendingTasks = tasks
      .filter((t) => t.status !== 'completed')
      .sort((a, b) => a.dueDate - b.dueDate)
      .map(fmtTask)
      .join('\n');

    // Most recent 30 completed tasks
    const completedTasks = tasks
      .filter((t) => t.status === 'completed')
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 30)
      .map(fmtTask)
      .join('\n');

    // Project names
    const projectList = projects.length
      ? projects.map((p) => `${p.name}${p.description ? ` (${p.description})` : ''}`).join(', ')
      : 'No active projects';

    return [
      `Today: ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}`,
      `Tasks today: ${total} (${done} done, ${total - done} remaining)`,
      `Overdue: ${overdue} | Current streak: ${streak} days`,
      estMins ? `Estimated workload today: ${estMins >= 60 ? `${Math.floor(estMins / 60)}h ${estMins % 60}m` : `${estMins}m`}` : '',
      `Active projects: ${projectList}`,
      pendingTasks   ? `\nAll pending/overdue tasks (${tasks.filter(t => t.status !== 'completed').length} total):\n${pendingTasks}` : '\nNo pending tasks.',
      completedTasks ? `\nRecently completed tasks:\n${completedTasks}` : '',
    ].filter(Boolean).join('\n');
  }, [todayTasks, overdueTasks, tasks, projects, settings]);

  const handleSend = useCallback(
    async (text?: string) => {
      const userText = (text ?? input).trim();
      if (!userText || isTyping) return;
      setInput('');
      const userMsg: ChatMessage = { id: `u_${Date.now()}`, role: 'user', content: userText };
      const history = [...messages, userMsg];
      setMessages(history);
      setIsTyping(true);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 60);
      try {
        const raw = await chatWithAssistant(
          // send only clean text to AI — no markers in history
          history.map((m) => ({ role: m.role, content: m.content })),
          taskContext
        );
        const { text: cleanText, actions } = parseAIResponse(raw);
        const aiMsg: ChatMessage = {
          id: `a_${Date.now()}`,
          role: 'assistant',
          content: cleanText,
          actions: actions.length > 0 ? actions : undefined,
        };
        setMessages((prev) => [...prev, aiMsg]);
        if (settings.voiceEnabled && cleanText) speakText(cleanText, settings.speechRate);
      } catch {
        setMessages((prev) => [
          ...prev,
          { id: `err_${Date.now()}`, role: 'assistant', content: 'Sorry, something went wrong. Please try again.' },
        ]);
      } finally {
        setIsTyping(false);
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
      }
    },
    [input, messages, isTyping, taskContext, settings]
  );

  // Mark a specific action as created
  const markCreated = useCallback((msgId: string, actionIdx: number) => {
    setMessages((prev) =>
      prev.map((msg) => {
        if (msg.id !== msgId || !msg.actions) return msg;
        const actions = msg.actions.map((a, i) =>
          i === actionIdx ? { ...a, created: true } : a
        );
        return { ...msg, actions };
      })
    );
  }, []);

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      <SafeAreaView edges={['top']} style={{ backgroundColor: COLORS.bg }}>
        <View style={s.header}>
          <View style={s.headerLeft}>
            <View style={s.avatar}>
              <Ionicons name="sparkles" size={18} color="#fff" />
            </View>
            <View>
              <Text style={s.title}>Pieter AI</Text>
              <Text style={s.subtitle}>Your productivity assistant</Text>
            </View>
          </View>
          {messages.length > 0 && (
            <TouchableOpacity style={s.clearBtn} onPress={() => { setMessages([]); stopSpeaking(); }}>
              <Ionicons name="trash-outline" size={18} color={COLORS.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
      >
        <ScrollView
          ref={scrollRef}
          style={s.list}
          contentContainerStyle={[s.listContent, { paddingBottom: tabBarClearance + 72 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {messages.length === 0 ? (
            <>
              <View style={s.welcome}>
                <View style={s.welcomeOrb}>
                  <Ionicons name="sparkles" size={30} color={COLORS.primary} />
                </View>
                <Text style={s.welcomeTitle}>Hi, I&apos;m Pieter AI</Text>
                <Text style={s.welcomeSub}>
                  Ask me anything about your tasks, or say &quot;create a task&quot; to add one directly from our conversation.
                </Text>
              </View>
              <Text style={s.starterLabel}>Try asking…</Text>
              {STARTERS.map((starter) => (
                <TouchableOpacity
                  key={starter}
                  style={[s.starterChip, CARD_SHADOW_SM]}
                  onPress={() => handleSend(starter)}
                  activeOpacity={0.75}
                >
                  <Text style={s.starterText}>{starter}</Text>
                  <Ionicons name="arrow-forward" size={14} color={COLORS.primary} />
                </TouchableOpacity>
              ))}
            </>
          ) : (
            messages.map((msg) => (
              <View key={msg.id} style={s.msgGroup}>
                <View style={[s.bubble, msg.role === 'user' ? s.bubbleUser : s.bubbleAI]}>
                  {msg.role === 'assistant' && (
                    <View style={s.aiIcon}>
                      <Ionicons name="sparkles" size={11} color={COLORS.primary} />
                    </View>
                  )}
                  {msg.content ? (
                    <Text style={[s.bubbleText, msg.role === 'user' ? s.bubbleTextUser : s.bubbleTextAI]}>
                      {msg.content}
                    </Text>
                  ) : null}
                </View>

                {/* Action cards rendered below AI bubbles */}
                {msg.role === 'assistant' && msg.actions?.map((action, idx) => (
                  <ActionCard
                    key={idx}
                    item={action}
                    onCreated={() => markCreated(msg.id, idx)}
                  />
                ))}
              </View>
            ))
          )}

          {isTyping && (
            <View style={[s.bubble, s.bubbleAI, { flexDirection: 'row', alignItems: 'center', gap: 8 }]}>
              <ActivityIndicator size="small" color={COLORS.primary} />
              <Text style={[s.bubbleText, s.bubbleTextAI]}>Thinking…</Text>
            </View>
          )}
        </ScrollView>

        <View style={[s.inputBar, { paddingBottom: tabBarClearance }]}>
          <TextInput
            style={s.inputField}
            placeholder="Ask me anything…"
            placeholderTextColor={COLORS.textMuted}
            value={input}
            onChangeText={setInput}
            onSubmitEditing={() => handleSend()}
            returnKeyType="send"
            multiline
            maxLength={600}
          />
          <TouchableOpacity
            style={[s.sendBtn, (!input.trim() || isTyping) && s.sendBtnOff]}
            onPress={() => handleSend()}
            disabled={!input.trim() || isTyping}
          >
            <Ionicons name="send" size={17} color="#fff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 6, paddingBottom: 12,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: {
    width: 42, height: 42, borderRadius: 21, backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  title:    { fontSize: 17, fontWeight: '700', color: COLORS.text },
  subtitle: { fontSize: 12, color: COLORS.textMuted, marginTop: 1 },
  clearBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.cardAlt,
    alignItems: 'center', justifyContent: 'center',
  },
  list:        { flex: 1 },
  listContent: { paddingHorizontal: 16, paddingTop: 8 },
  welcome: { alignItems: 'center', paddingVertical: 24, paddingHorizontal: 16 },
  welcomeOrb: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: COLORS.primaryLight,
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  welcomeTitle: { fontSize: 20, fontWeight: '800', color: COLORS.text, marginBottom: 8 },
  welcomeSub:   { fontSize: 14, color: COLORS.textSub, textAlign: 'center', lineHeight: 21 },
  starterLabel: {
    fontSize: 12, fontWeight: '700', color: COLORS.textMuted,
    letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 10, marginTop: 4,
  },
  starterChip: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: COLORS.card, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 13, marginBottom: 8,
  },
  starterText: { fontSize: 14, color: COLORS.text, flex: 1, marginRight: 8 },
  msgGroup:   { marginBottom: 2 },
  bubble:     { maxWidth: '82%', borderRadius: 18, padding: 12, marginBottom: 6 },
  bubbleUser: { alignSelf: 'flex-end', backgroundColor: COLORS.primary, borderBottomRightRadius: 4 },
  bubbleAI:   { alignSelf: 'flex-start', backgroundColor: COLORS.card, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: '#E8EAF0' },
  bubbleText:     { fontSize: 14, lineHeight: 21 },
  bubbleTextUser: { color: '#fff' },
  bubbleTextAI:   { color: COLORS.text },
  aiIcon: {
    width: 18, height: 18, borderRadius: 9, backgroundColor: COLORS.primaryLight,
    alignItems: 'center', justifyContent: 'center', marginBottom: 6,
  },
  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end',
    paddingHorizontal: 16, paddingTop: 10,
    backgroundColor: COLORS.bg, borderTopWidth: 1, borderTopColor: '#E8EAF0', gap: 10,
  },
  inputField: {
    flex: 1, minHeight: 42, maxHeight: 100,
    backgroundColor: COLORS.card, borderRadius: 21,
    paddingHorizontal: 16, paddingVertical: 10,
    fontSize: 14, color: COLORS.text, borderWidth: 1, borderColor: '#E8EAF0',
  },
  sendBtn:    { width: 42, height: 42, borderRadius: 21, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  sendBtnOff: { backgroundColor: COLORS.textMuted },
});

const ac = StyleSheet.create({
  card: {
    alignSelf: 'flex-start', maxWidth: '82%',
    backgroundColor: COLORS.card, borderRadius: 16,
    borderWidth: 1, borderColor: '#E8EAF0',
    padding: 14, marginBottom: 10, marginTop: 2,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  typeIcon: {
    width: 28, height: 28, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  typeLabel: { fontSize: 11, fontWeight: '700', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.6 },
  title:     { fontSize: 15, fontWeight: '700', color: COLORS.text, marginBottom: 4 },
  desc:      { fontSize: 13, color: COLORS.textSub, lineHeight: 19, marginBottom: 8 },
  metaRow:   { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  badge:     { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.4 },
  metaDot:   { color: COLORS.textMuted, fontSize: 12 },
  metaText:  { fontSize: 12, color: COLORS.textSub },
  colorDot:  { width: 12, height: 12, borderRadius: 6 },
  createBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: COLORS.primary, borderRadius: 10, paddingVertical: 10,
  },
  createBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  createdRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  createdIcon: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: COLORS.successLight,
    alignItems: 'center', justifyContent: 'center',
  },
  createdText: { fontSize: 14, fontWeight: '600', color: COLORS.success },
});
