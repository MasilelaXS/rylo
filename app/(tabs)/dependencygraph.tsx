import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTaskStore } from '../../src/store/taskStore';
import type { Task } from '../../src/types';
import { CARD_SHADOW_SM, COLORS, PRIORITY_CONFIG } from '../../src/utils/constants';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Build chains: root = tasks with dependsOn=null that ARE depended on by others,
 *  or any task that starts a chain. Returns tree nodes with children. */
interface ChainNode {
  task: Task;
  children: ChainNode[];
  depth: number;
  isBlocked: boolean; // is blocked by its parent
}

function buildChains(tasks: Task[]): {
  chains: ChainNode[];
  independent: Task[];
  stats: { blocked: number; blocking: number; free: number };
} {
  const taskMap = new Map<string, Task>(tasks.map((t) => [t.id, t]));
  // Which tasks are depended on by something?
  const isBlocker = new Set<string>();
  tasks.forEach((t) => { if (t.dependsOn) isBlocker.add(t.dependsOn); });

  // Root nodes of chains: tasks that block others but are not blocked themselves
  const chainRoots = tasks.filter(
    (t) => isBlocker.has(t.id) && !t.dependsOn,
  );

  // Also include tasks that ARE blocked (dependsOn set) but whose blocker no longer exists → treat as roots
  const danglingRoots = tasks.filter(
    (t) => t.dependsOn && !taskMap.has(t.dependsOn),
  );

  function buildNode(task: Task, depth: number, isBlocked: boolean): ChainNode {
    const children = tasks
      .filter((t) => t.dependsOn === task.id)
      .map((t) => buildNode(t, depth + 1, true));
    return { task, children, depth, isBlocked };
  }

  const chains = [
    ...chainRoots.map((t) => buildNode(t, 0, false)),
    ...danglingRoots.map((t) => buildNode(t, 0, true)),
  ];

  // Tasks in no chain and not blocking anything
  const chainedIds = new Set<string>();
  function collectIds(node: ChainNode) {
    chainedIds.add(node.task.id);
    node.children.forEach(collectIds);
  }
  chains.forEach(collectIds);

  const independent = tasks.filter(
    (t) => !chainedIds.has(t.id) && !t.dependsOn,
  );

  const stats = {
    blocked:  tasks.filter((t) => t.dependsOn && taskMap.has(t.dependsOn)).length,
    blocking: chainRoots.length,
    free:     independent.length,
  };

  return { chains, independent, stats };
}

function formatDate(ms: number) {
  const d = new Date(ms);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ─── Chain node card ─────────────────────────────────────────────────────────
function NodeCard({
  node,
  onEdit,
}: {
  node: ChainNode;
  onEdit: (task: Task) => void;
}) {
  const { task, depth, isBlocked, children } = node;
  const p       = PRIORITY_CONFIG[task.priority];
  const isDone  = task.status === 'completed';
  const isReady = !isBlocked || isDone;

  return (
    <View>
      <View style={[n.row, { marginLeft: depth * 24 }]}>
        {/* Connector lines */}
        {depth > 0 && (
          <View style={n.connectorWrap}>
            <View style={[n.connectorV, { backgroundColor: isDone ? COLORS.success : isBlocked ? COLORS.warning : COLORS.textMuted }]} />
            <View style={[n.connectorH, { backgroundColor: isDone ? COLORS.success : isBlocked ? COLORS.warning : COLORS.textMuted }]} />
          </View>
        )}

        <TouchableOpacity
          style={[
            n.card,
            { borderLeftColor: p.color },
            isDone && n.cardDone,
          ]}
          onPress={() => onEdit(task)}
          activeOpacity={0.8}
        >
          {/* Status icon */}
          <View style={[n.statusIcon, { backgroundColor: isDone ? `${COLORS.success}22` : isBlocked ? '#FFF3E022' : `${p.color}20` }]}>
            <Ionicons
              name={isDone ? 'checkmark-circle' : isBlocked ? 'lock-closed' : 'radio-button-on'}
              size={16}
              color={isDone ? COLORS.success : isBlocked ? COLORS.warning : p.color}
            />
          </View>

          <View style={n.body}>
            <Text style={[n.title, isDone && n.titleDone]} numberOfLines={2}>
              {task.title}
            </Text>
            <View style={n.meta}>
              <View style={[n.priorityBadge, { backgroundColor: `${p.color}18` }]}>
                <Text style={[n.priorityText, { color: p.color }]}>{p.label}</Text>
              </View>
              <Text style={n.date}>{formatDate(task.dueDate)}</Text>
              {isBlocked && !isDone && (
                <View style={n.blockedBadge}>
                  <Ionicons name="lock-closed-outline" size={10} color={COLORS.warning} />
                  <Text style={n.blockedText}>Blocked</Text>
                </View>
              )}
              {task.status === 'in_progress' && (
                <View style={n.inProgressBadge}>
                  <Text style={n.inProgressText}>In Progress</Text>
                </View>
              )}
            </View>
          </View>

          <Ionicons name="chevron-forward" size={14} color={COLORS.textMuted} />
        </TouchableOpacity>
      </View>

      {/* Render children recursively */}
      {children.map((child) => (
        <NodeCard key={child.task.id} node={child} onEdit={onEdit} />
      ))}
    </View>
  );
}

const n = StyleSheet.create({
  row:         { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  connectorWrap:{ width: 24, alignItems: 'flex-end', paddingTop: 20 },
  connectorV:  { width: 2, height: 24, position: 'absolute', top: -16, right: 10 },
  connectorH:  { width: 14, height: 2, position: 'absolute', top: 8, right: 8 },
  card: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: COLORS.card, borderRadius: 14, padding: 12,
    borderLeftWidth: 3, ...CARD_SHADOW_SM,
  },
  cardDone: { opacity: 0.6 },
  statusIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  body:        { flex: 1, gap: 4 },
  title:       { fontSize: 14, fontWeight: '700', color: COLORS.text },
  titleDone:   { textDecorationLine: 'line-through', color: COLORS.textMuted },
  meta:        { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' },
  priorityBadge:  { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  priorityText:   { fontSize: 10, fontWeight: '700' },
  date:           { fontSize: 11, color: COLORS.textMuted },
  blockedBadge:   { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, backgroundColor: '#FFF3E0' },
  blockedText:    { fontSize: 10, fontWeight: '700', color: COLORS.warning },
  inProgressBadge:{ paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, backgroundColor: `${COLORS.primary}18` },
  inProgressText: { fontSize: 10, fontWeight: '700', color: COLORS.primary },
});

// ─── Screen ──────────────────────────────────────────────────────────────────
export default function DependencyGraphScreen() {
  const { tasks, loadAll }   = useTaskStore();
  const router               = useRouter();
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [showDone, setShowDone] = useState(false);

  useEffect(() => { loadAll(); }, []);

  const activeTasks = useMemo(
    () => tasks.filter((t) => t.status !== 'cancelled' && (showDone || t.status !== 'completed')),
    [tasks, showDone],
  );

  const { chains, independent, stats } = useMemo(
    () => buildChains(activeTasks),
    [activeTasks],
  );

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.bg} />
      <SafeAreaView style={s.safe} edges={['top']}>

        {/* ── Header ────────────────────────────────────────────────── */}
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="chevron-back" size={22} color={COLORS.primary} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={s.title}>Dependency Graph</Text>
            <Text style={s.subtitle}>Visualise task chains & blockers</Text>
          </View>
          <TouchableOpacity
            style={[s.doneToggle, showDone && s.doneToggleActive]}
            onPress={() => setShowDone((v) => !v)}
          >
            <Ionicons name="checkmark-done-outline" size={16} color={showDone ? COLORS.primary : COLORS.textMuted} />
            <Text style={[s.doneToggleText, showDone && { color: COLORS.primary }]}>Done</Text>
          </TouchableOpacity>
        </View>

        {/* ── Stats ─────────────────────────────────────────────────── */}
        <View style={s.statsRow}>
          {[
            { val: stats.blocking, label: 'Chains',     color: COLORS.primary, icon: 'git-branch-outline' as const },
            { val: stats.blocked,  label: 'Blocked',    color: COLORS.warning, icon: 'lock-closed-outline' as const },
            { val: stats.free,     label: 'Free',       color: COLORS.success, icon: 'checkmark-circle-outline' as const },
          ].map((item) => (
            <View key={item.label} style={[s.statCard, { borderTopColor: item.color }]}>
              <Ionicons name={item.icon} size={16} color={item.color} />
              <Text style={[s.statVal, { color: item.color }]}>{item.val}</Text>
              <Text style={s.statLabel}>{item.label}</Text>
            </View>
          ))}
        </View>

        <ScrollView
          style={s.scroll}
          contentContainerStyle={s.content}
          showsVerticalScrollIndicator={false}
        >
          {/* ── Chains ──────────────────────────────────────────────── */}
          {chains.length > 0 && (
            <View style={s.section}>
              <View style={s.sectionHeader}>
                <Ionicons name="git-branch-outline" size={16} color={COLORS.primary} />
                <Text style={s.sectionTitle}>Dependency Chains</Text>
                <View style={s.badge}><Text style={s.badgeText}>{chains.length}</Text></View>
              </View>
              <Text style={s.sectionSub}>Tasks that block other tasks from starting</Text>
              {chains.map((node) => (
                <NodeCard key={node.task.id} node={node} onEdit={setEditTask} />
              ))}
            </View>
          )}

          {/* ── Independent tasks ───────────────────────────────────── */}
          {independent.length > 0 && (
            <View style={s.section}>
              <View style={s.sectionHeader}>
                <Ionicons name="radio-button-on-outline" size={16} color={COLORS.success} />
                <Text style={[s.sectionTitle, { color: COLORS.success }]}>Independent Tasks</Text>
                <View style={[s.badge, { backgroundColor: `${COLORS.success}18` }]}>
                  <Text style={[s.badgeText, { color: COLORS.success }]}>{independent.length}</Text>
                </View>
              </View>
              <Text style={s.sectionSub}>No dependencies — ready to start anytime</Text>
              {independent.slice(0, 20).map((task) => {
                const p = PRIORITY_CONFIG[task.priority];
                return (
                  <TouchableOpacity
                    key={task.id}
                    style={[s.freeCard, { borderLeftColor: p.color }]}
                    onPress={() => setEditTask(task)}
                    activeOpacity={0.8}
                  >
                    <View style={[s.freeIcon, { backgroundColor: `${p.color}18` }]}>
                      <Ionicons name="radio-button-on" size={14} color={p.color} />
                    </View>
                    <View style={s.freeBody}>
                      <Text style={s.freeTitle} numberOfLines={1}>{task.title}</Text>
                      <Text style={s.freeMeta}>{p.label} · {formatDate(task.dueDate)}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={14} color={COLORS.textMuted} />
                  </TouchableOpacity>
                );
              })}
              {independent.length > 20 && (
                <Text style={s.moreText}>+ {independent.length - 20} more independent tasks</Text>
              )}
            </View>
          )}

          {/* ── Empty state ─────────────────────────────────────────── */}
          {chains.length === 0 && independent.length === 0 && (
            <View style={s.empty}>
              <Ionicons name="git-branch-outline" size={48} color={COLORS.textMuted} />
              <Text style={s.emptyTitle}>No tasks with dependencies</Text>
              <Text style={s.emptySub}>
                Open any task and set a "Blocked by" task to create a dependency chain.
              </Text>
            </View>
          )}

          {/* ── How to tip ──────────────────────────────────────────── */}
          <View style={s.tipCard}>
            <Ionicons name="information-circle-outline" size={16} color={COLORS.primary} />
            <Text style={s.tipText}>
              To add a dependency, open any task and tap "Blocked by" to select the task it waits on.
            </Text>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  safe: { flex: 1 },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12,
  },
  backBtn:  { padding: 4 },
  title:    { fontSize: 22, fontWeight: '800', color: COLORS.text },
  subtitle: { fontSize: 12, color: COLORS.textMuted, marginTop: 1 },
  doneToggle: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 6,
    backgroundColor: COLORS.cardAlt, borderRadius: 10,
  },
  doneToggleActive: { backgroundColor: COLORS.primaryLight },
  doneToggleText: { fontSize: 12, fontWeight: '600', color: COLORS.textMuted },

  statsRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, marginBottom: 12 },
  statCard: {
    flex: 1, backgroundColor: COLORS.card, borderRadius: 14, padding: 12,
    alignItems: 'center', gap: 4, borderTopWidth: 3, ...CARD_SHADOW_SM,
  },
  statVal:   { fontSize: 20, fontWeight: '800', color: COLORS.text },
  statLabel: { fontSize: 11, color: COLORS.textMuted, fontWeight: '600' },

  scroll:  { flex: 1 },
  content: { paddingHorizontal: 16, gap: 8, paddingBottom: 32 },

  section:       { gap: 8, marginBottom: 12 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle:  { fontSize: 15, fontWeight: '700', color: COLORS.text, flex: 1 },
  sectionSub:    { fontSize: 12, color: COLORS.textMuted, marginTop: -4, marginBottom: 4 },
  badge:         { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, backgroundColor: COLORS.primaryLight },
  badgeText:     { fontSize: 11, fontWeight: '700', color: COLORS.primary },

  freeCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: COLORS.card, borderRadius: 14, padding: 12,
    borderLeftWidth: 3, marginBottom: 6, ...CARD_SHADOW_SM,
  },
  freeIcon:  { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  freeBody:  { flex: 1 },
  freeTitle: { fontSize: 13, fontWeight: '600', color: COLORS.text },
  freeMeta:  { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
  moreText:  { fontSize: 12, color: COLORS.textMuted, textAlign: 'center', paddingVertical: 8 },

  empty: { alignItems: 'center', paddingVertical: 48, gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: COLORS.textSub },
  emptySub:   { fontSize: 13, color: COLORS.textMuted, textAlign: 'center', lineHeight: 20, maxWidth: 280 },

  tipCard: {
    flexDirection: 'row', gap: 8, alignItems: 'flex-start',
    backgroundColor: COLORS.primaryLight, borderRadius: 14, padding: 12,
    marginTop: 8,
  },
  tipText: { flex: 1, fontSize: 12, color: COLORS.primary, lineHeight: 18, fontWeight: '500' },
});
