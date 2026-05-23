import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useState } from 'react';
import {
    Modal,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import AddTaskModal from '../../src/components/AddTaskModal';
import EmptyState from '../../src/components/EmptyState';
import ProjectCard from '../../src/components/ProjectCard';
import TaskCard from '../../src/components/TaskCard';
import { scheduleHourlyReminders, scheduleTaskReminder } from '../../src/notifications/notificationService';
import { useProjectStore } from '../../src/store/projectStore';
import { useTaskStore } from '../../src/store/taskStore';
import type { Project, Task } from '../../src/types';
import { ACCENT, CARD_SHADOW, CARD_SHADOW_SM, COLORS, PRIORITY_CONFIG, generateId } from '../../src/utils/constants';

// ─── Shared helpers ───────────────────────────────────────────────────────────
type InnerTab  = 'tasks' | 'projects' | 'calendar';
type FilterKey = 'all' | 'today' | 'upcoming' | 'overdue' | 'done';

const INNER_TABS: { key: InnerTab; label: string; icon: string }[] = [
  { key: 'tasks',    label: 'Tasks',    icon: 'checkmark-circle-outline' },
  { key: 'projects', label: 'Projects', icon: 'folder-outline'           },
  { key: 'calendar', label: 'Calendar', icon: 'calendar-outline'         },
];

const TASK_FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all',      label: 'All'      },
  { key: 'today',    label: 'Today'    },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'overdue',  label: 'Overdue'  },
  { key: 'done',     label: 'Done'     },
];

const PROJECT_COLORS = ['#6B7CFF', '#FF9A56', '#2ECC9A', '#F59E0B', '#FF7DA0', '#FF7070'];

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAY_ABBR    = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const padZ = (n: number) => String(n).padStart(2, '0');

function dayStart(d: Date): number { const x = new Date(d); x.setHours(0, 0, 0, 0);        return x.getTime(); }
function dayEnd(d: Date):   number { const x = new Date(d); x.setHours(23, 59, 59, 999);    return x.getTime(); }

function getSectionTitle(dueDate: number): string {
  const today    = dayStart(new Date());
  const tomorrow = today + 86_400_000;
  const taskDay  = dayStart(new Date(dueDate));
  if (taskDay <  today)     return 'Overdue';
  if (taskDay === today)    return 'Today';
  if (taskDay === tomorrow) return 'Tomorrow';
  return new Date(dueDate).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}
const SECTION_COLORS: Record<string, string> = { Overdue: '#FF6B6B', Today: '#6B7CFF', Tomorrow: '#F59E0B' };

// ─── Main merged screen ───────────────────────────────────────────────────────
export default function WorkspaceScreen() {
  const { tasks, todayTasks, overdueTasks, loadAll, addTask, markComplete, snoozeTask, editTask: saveEdit, removeTask } = useTaskStore();
  const { projects, loadAll: loadProjects, addProject } = useProjectStore();
  const insets    = useSafeAreaInsets();
  const fabBottom = Math.max(insets.bottom, 8) + 14 + 68 + 16;

  // ── Shared state ─────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<InnerTab>('tasks');
  const [showAddTask,  setShowAddTask]  = useState(false);
  const [editingTask,  setEditingTask]  = useState<Task | null>(null);
  const [prefillDate,  setPrefillDate]  = useState<Date | null>(null);

  // ── Tasks tab state ──────────────────────────────────────────────────────
  const [filter, setFilter] = useState<FilterKey>('all');
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<'due' | 'priority' | 'created' | 'title' | 'duration'>('due');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const isSelecting = selectedIds.size > 0;

  // ── Projects tab state ───────────────────────────────────────────────────
  const [showAddProject,   setShowAddProject]   = useState(false);
  const [selectedProject,  setSelectedProject]  = useState<Project | null>(null);
  const [showAddTaskToProj,setShowAddTaskToProj] = useState(false);
  const [newName,  setNewName]  = useState('');
  const [newDesc,  setNewDesc]  = useState('');
  const [newColor, setNewColor] = useState(PROJECT_COLORS[0]);

  // ── Calendar tab state ───────────────────────────────────────────────────
  const today = new Date();
  const [calYear,  setCalYear]  = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth());
  const [selDay,   setSelDay]   = useState<number | null>(today.getDate());

  useEffect(() => { loadAll(); loadProjects(); }, []);

  // ─── Task handlers ────────────────────────────────────────────────────────
  const handleAddTask = async (taskData: Omit<Task, 'id' | 'createdAt' | 'escalationLevel' | 'snoozeCount'>) => {
    const task: Task = { ...taskData, id: generateId(), createdAt: Date.now(), escalationLevel: 0, snoozeCount: 0 };
    await addTask(task);
    await scheduleTaskReminder(task);
    scheduleHourlyReminders(useTaskStore.getState().tasks).catch(console.error);
    setPrefillDate(null);
  };

  const handleEditTask = async (taskData: Omit<Task, 'id' | 'createdAt' | 'escalationLevel' | 'snoozeCount'>) => {
    if (!editingTask) return;
    await saveEdit({ ...taskData, id: editingTask.id });
    setEditingTask(null);
    scheduleHourlyReminders(useTaskStore.getState().tasks).catch(console.error);
  };

  const handleComplete = async (id: string) => {
    await markComplete(id);
    scheduleHourlyReminders(useTaskStore.getState().tasks).catch(console.error);
  };

  // ─── Multi-select helpers ─────────────────────────────────────────────────
  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function bulkComplete() {
    await Promise.all([...selectedIds].map((id) => markComplete(id)));
    scheduleHourlyReminders(useTaskStore.getState().tasks).catch(console.error);
    setSelectedIds(new Set());
  }

  async function bulkDelete() {
    await Promise.all([...selectedIds].map((id) => removeTask(id)));
    setSelectedIds(new Set());
  }

  async function bulkSnooze() {
    await Promise.all([...selectedIds].map((id) => snoozeTask(id)));
    setSelectedIds(new Set());
  }

  // ─── Projects handlers ────────────────────────────────────────────────────
  const handleAddProject = async () => {
    if (!newName.trim()) return;
    await addProject({ id: generateId(), name: newName.trim(), description: newDesc.trim(), color: newColor, createdAt: Date.now() });
    setNewName(''); setNewDesc(''); setNewColor(PROJECT_COLORS[0]); setShowAddProject(false);
  };

  const handleAddTaskToProject = async (taskData: Omit<Task, 'id' | 'createdAt' | 'escalationLevel' | 'snoozeCount'>) => {
    const task: Task = { ...taskData, id: generateId(), createdAt: Date.now(), escalationLevel: 0, snoozeCount: 0 };
    await addTask(task);
    await loadAll();
  };

  // ─── Tasks filtered data ──────────────────────────────────────────────────
  const now = Date.now();
  const todayS = dayStart(new Date());
  const todayE = dayEnd(new Date());

  const filtered = useMemo(() => {
    let base: Task[];
    switch (filter) {
      case 'today':    base = tasks.filter(t => t.dueDate >= todayS && t.dueDate <= todayE && t.status !== 'completed' && t.status !== 'cancelled'); break;
      case 'upcoming': base = tasks.filter(t => t.dueDate > todayE && t.status !== 'completed' && t.status !== 'cancelled'); break;
      case 'overdue':  base = tasks.filter(t => t.dueDate < now && t.status !== 'completed' && t.status !== 'cancelled'); break;
      case 'done':     base = tasks.filter(t => t.status === 'completed'); break;
      default:         base = tasks.filter(t => t.status !== 'cancelled');
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      base = base.filter(t => t.title.toLowerCase().includes(q) || (t.description ?? '').toLowerCase().includes(q));
    }
    const PRIORITY_ORDER = { urgent: 0, high: 1, medium: 2, low: 3 };
    switch (sortKey) {
      case 'priority': return [...base].sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 2) - (PRIORITY_ORDER[b.priority] ?? 2));
      case 'created':  return [...base].sort((a, b) => b.createdAt - a.createdAt);
      case 'title':    return [...base].sort((a, b) => a.title.localeCompare(b.title));
      case 'duration': return [...base].sort((a, b) => (b.estimatedMinutes ?? 0) - (a.estimatedMinutes ?? 0));
      default:         return [...base].sort((a, b) => a.dueDate - b.dueDate);
    }
  }, [tasks, filter, search, sortKey, now, todayS, todayE]);

  const sections = useMemo(() => {
    if (filter === 'done') return [{ title: 'Completed', data: filtered, color: '#2ECC9A' }];
    const map: Record<string, Task[]> = {};
    for (const t of filtered) { const k = getSectionTitle(t.dueDate); (map[k] = map[k] ?? []).push(t); }
    const ORDER = ['Overdue', 'Today', 'Tomorrow'];
    const keys = Object.keys(map).sort((a, b) => {
      const ai = ORDER.indexOf(a), bi = ORDER.indexOf(b);
      if (ai !== -1 && bi !== -1) return ai - bi;
      if (ai !== -1) return -1; if (bi !== -1) return 1; return 0;
    });
    return keys.map(k => ({ title: k, data: map[k], color: SECTION_COLORS[k] ?? COLORS.textMuted }));
  }, [filtered, filter]);

  // ─── Calendar data ────────────────────────────────────────────────────────
  const tasksByDay = useMemo(() => {
    const map: Record<string, Task[]> = {};
    for (const t of tasks) {
      if (t.status === 'cancelled') continue;
      const d   = new Date(t.dueDate);
      const key = `${d.getFullYear()}-${padZ(d.getMonth() + 1)}-${padZ(d.getDate())}`;
      (map[key] = map[key] ?? []).push(t);
    }
    return map;
  }, [tasks]);

  const daysInMonth  = new Date(calYear, calMonth + 1, 0).getDate();
  const firstDow     = new Date(calYear, calMonth, 1).getDay();
  const calCells: (number | null)[] = [...Array(firstDow).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (calCells.length % 7 !== 0) calCells.push(null);

  const selKey   = selDay !== null ? `${calYear}-${padZ(calMonth + 1)}-${padZ(selDay)}` : null;
  const selTasks = (selKey ? (tasksByDay[selKey] ?? []) : []).sort((a, b) => a.dueDate - b.dueDate);

  const calStats = useMemo(() => {
    const completed  = tasks.filter(t => t.status === 'completed').length;
    const pending    = tasks.filter(t => t.status !== 'completed' && t.status !== 'cancelled').length;
    const overdue    = tasks.filter(t => t.dueDate < Date.now() && t.status !== 'completed' && t.status !== 'cancelled').length;
    const completion = tasks.length > 0 ? Math.round((completed / tasks.length) * 100) : 0;
    return { completed, pending, overdue, completion };
  }, [tasks]);

  const monthTaskCount = useMemo(() => {
    let c = 0;
    for (let d = 1; d <= daysInMonth; d++) c += (tasksByDay[`${calYear}-${padZ(calMonth + 1)}-${padZ(d)}`]?.length ?? 0);
    return c;
  }, [tasksByDay, calYear, calMonth, daysInMonth]);

  // ─── FAB action ───────────────────────────────────────────────────────────
  const handleFAB = () => {
    if (activeTab === 'tasks' || activeTab === 'calendar') setShowAddTask(true);
    else setShowAddProject(true);
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      {/* ── Header & tab switcher ──────────────────────────────────── */}
      <SafeAreaView edges={['top']} style={{ backgroundColor: COLORS.bg }}>
        <View style={s.header}>

          {/* Dynamic right-side action */}
          <View style={s.headerRight}>
            {activeTab === 'projects' && (
              <TouchableOpacity style={s.headerBtn} onPress={() => setShowAddProject(true)}>
                <Ionicons name="add" size={22} color={COLORS.primary} />
              </TouchableOpacity>
            )}
            {activeTab === 'tasks' && (
              <View style={s.headerSubtitle}>
                <Text style={s.subtitleText}>
                  {tasks.filter(t => t.status !== 'cancelled' && t.status !== 'completed').length} active
                  {overdueTasks.length > 0 ? ` · ${overdueTasks.length} overdue` : ''}
                </Text>
              </View>
            )}
          </View>

          {/* Inner tab switcher */}
          <View style={s.tabSwitcher}>
            {INNER_TABS.map((tab) => (
              <TouchableOpacity
                key={tab.key}
                style={[s.tabBtn, activeTab === tab.key && s.tabBtnActive]}
                onPress={() => setActiveTab(tab.key)}
                activeOpacity={0.75}
              >
                <Ionicons
                  name={(activeTab === tab.key ? tab.icon.replace('-outline', '') : tab.icon) as any}
                  size={15}
                  color={activeTab === tab.key ? COLORS.primary : COLORS.textMuted}
                />
                <Text style={[s.tabBtnText, activeTab === tab.key && s.tabBtnTextActive]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </SafeAreaView>

      {/* ══════════ TASKS TAB ══════════════════════════════════════════ */}
      {activeTab === 'tasks' && (
        <>
          <View style={s.searchWrap}>
            <Ionicons name="search-outline" size={16} color={COLORS.textMuted} />
            <TextInput
              style={s.searchInput}
              placeholder="Search tasks…"
              placeholderTextColor={COLORS.textMuted}
              value={search}
              onChangeText={setSearch}
              returnKeyType="search"
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close-circle" size={16} color={COLORS.textMuted} />
              </TouchableOpacity>
            )}
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterRow} style={{ flexGrow: 0 }}>
            {TASK_FILTERS.map(f => {
              const active = filter === f.key;
              const cnt    = f.key === 'today' ? todayTasks.length : f.key === 'overdue' ? overdueTasks.length : null;
              return (
                <TouchableOpacity key={f.key} style={[s.pill, active && s.pillActive]} onPress={() => setFilter(f.key)} activeOpacity={0.75}>
                  <Text style={[s.pillText, active && s.pillTextActive]}>{f.label}</Text>
                  {cnt !== null && cnt > 0 && (
                    <View style={[s.pillBadge, { backgroundColor: active ? 'rgba(255,255,255,0.3)' : COLORS.dangerLight }]}>
                      <Text style={[s.pillBadgeText, { color: active ? '#fff' : COLORS.danger }]}>{cnt}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Sort picker */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[s.filterRow, { paddingTop: 0, paddingBottom: 6 }]} style={{ flexGrow: 0 }}>
            {(['due', 'priority', 'created', 'title', 'duration'] as const).map((k) => {
              const labels: Record<typeof k, string> = { due: 'Due Date', priority: 'Priority', created: 'Newest', title: 'A–Z', duration: 'Duration' };
              const active = sortKey === k;
              return (
                <TouchableOpacity
                  key={k}
                  style={[s.sortChip, active && s.sortChipActive]}
                  onPress={() => setSortKey(k)}
                  activeOpacity={0.75}
                >
                  {active && <Ionicons name="swap-vertical-outline" size={11} color={COLORS.primary} />}
                  <Text style={[s.sortChipText, active && s.sortChipTextActive]}>{labels[k]}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <ScrollView style={s.scroll} contentContainerStyle={[s.content, { paddingBottom: fabBottom + 20 }]} showsVerticalScrollIndicator={false}>
            {filtered.length === 0 ? (
              <EmptyState
                icon={filter === 'done' ? 'checkmark-done-circle-outline' : filter === 'overdue' ? 'happy-outline' : filter === 'today' ? 'sunny-outline' : 'calendar-outline'}
                title={filter === 'done' ? 'Nothing completed yet' : filter === 'overdue' ? "You're all caught up!" : filter === 'today' ? 'Free today!' : 'No tasks yet'}
                subtitle={filter === 'done' ? 'Complete tasks to see them here' : filter === 'overdue' ? 'No overdue tasks — great work!' : filter === 'today' ? 'Enjoy your free time or add something' : 'Tap + to create your first task'}
                accent={filter === 'overdue' || filter === 'done' ? COLORS.success : undefined}
              />
            ) : (
              sections.map(sec => (
                <View key={sec.title}>
                  <View style={s.sectionRow}>
                    <Text style={[s.sectionTitle, { color: sec.color }]}>{sec.title}</Text>
                    <View style={[s.sectionCount, { backgroundColor: sec.color + '18' }]}>
                      <Text style={[s.sectionCountText, { color: sec.color }]}>{sec.data.length}</Text>
                    </View>
                  </View>
                  {sec.data.map(t => {
                    const sel = selectedIds.has(t.id);
                    return (
                      <TouchableOpacity
                        key={t.id}
                        activeOpacity={isSelecting ? 0.6 : 1}
                        onLongPress={() => toggleSelect(t.id)}
                        onPress={() => isSelecting ? toggleSelect(t.id) : undefined}
                        style={sel ? s.taskSelWrap : undefined}
                      >
                        {sel && (
                          <View style={s.selCheckWrap}>
                            <Ionicons name="checkmark-circle" size={22} color={COLORS.primary} />
                          </View>
                        )}
                        <TaskCard task={t} onComplete={handleComplete} onSnooze={snoozeTask} onPress={task => isSelecting ? toggleSelect(task.id) : setEditingTask(task)} />
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))
            )}
          </ScrollView>

          {/* Bulk actions toolbar */}
          {isSelecting && (
            <View style={[s.bulkBar, { bottom: fabBottom - 14 }]}>
              <Text style={s.bulkCount}>{selectedIds.size} selected</Text>
              <TouchableOpacity style={s.bulkBtn} onPress={bulkComplete}>
                <Ionicons name="checkmark-done-outline" size={18} color={COLORS.success} />
                <Text style={[s.bulkBtnText, { color: COLORS.success }]}>Complete</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.bulkBtn} onPress={bulkSnooze}>
                <Ionicons name="moon-outline" size={18} color={COLORS.primary} />
                <Text style={[s.bulkBtnText, { color: COLORS.primary }]}>Snooze</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.bulkBtn} onPress={bulkDelete}>
                <Ionicons name="trash-outline" size={18} color={COLORS.danger} />
                <Text style={[s.bulkBtnText, { color: COLORS.danger }]}>Delete</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.bulkBtn} onPress={() => setSelectedIds(new Set())}>
                <Ionicons name="close" size={18} color={COLORS.textMuted} />
              </TouchableOpacity>
            </View>
          )}
        </>
      )}

      {/* ══════════ PROJECTS TAB ═══════════════════════════════════════ */}
      {activeTab === 'projects' && (
        <>
          {selectedProject ? (
            <ScrollView style={s.scroll} contentContainerStyle={[s.content, { paddingBottom: fabBottom + 20 }]} showsVerticalScrollIndicator={false}>
              <View style={s.detailHeader}>
                <TouchableOpacity onPress={() => setSelectedProject(null)} style={s.backBtn}>
                  <Ionicons name="arrow-back" size={22} color={COLORS.text} />
                </TouchableOpacity>
                <View style={[s.colorDot, { backgroundColor: selectedProject.color }]} />
                <Text style={s.detailTitle}>{selectedProject.name}</Text>
                <TouchableOpacity style={s.addTaskBtn} onPress={() => setShowAddTaskToProj(true)}>
                  <Ionicons name="add-circle-outline" size={22} color={COLORS.primary} />
                </TouchableOpacity>
              </View>
              {selectedProject.description ? <Text style={s.detailDesc}>{selectedProject.description}</Text> : null}
              {tasks.filter(t => t.projectId === selectedProject.id).length === 0 ? (
                <EmptyState icon="checkmark-done-outline" title="No tasks yet" subtitle="Tap + to add a task" />
              ) : (
                tasks.filter(t => t.projectId === selectedProject.id).map((t) => (
                  <TaskCard key={t.id} task={t} onComplete={markComplete} onSnooze={snoozeTask} onPress={(task) => setEditingTask(task)} />
                ))
              )}
            </ScrollView>
          ) : (
            <ScrollView style={s.scroll} contentContainerStyle={[s.content, { paddingBottom: fabBottom + 20 }]} showsVerticalScrollIndicator={false}>
              {projects.length === 0 ? (
                <EmptyState icon="folder-open-outline" title="No projects yet" subtitle="Tap + to create your first project" />
              ) : (
                projects.map(project => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    taskCount={tasks.filter(t => t.projectId === project.id).length}
                    completedCount={tasks.filter(t => t.projectId === project.id && t.status === 'completed').length}
                    onPress={() => setSelectedProject(project)}
                  />
                ))
              )}
            </ScrollView>
          )}
        </>
      )}

      {/* ══════════ CALENDAR TAB ═══════════════════════════════════════ */}
      {activeTab === 'calendar' && (
        <ScrollView style={s.scroll} contentContainerStyle={[s.calContent, { paddingBottom: fabBottom + 20 }]} showsVerticalScrollIndicator={false}>

          {/* Stats row */}
          <View style={s.statsRow}>
            {[
              { val: `${calStats.completion}%`, label: 'Done Rate',  bg: ACCENT.purple.bg, color: ACCENT.purple.color },
              { val: String(calStats.completed), label: 'Completed', bg: ACCENT.green.bg,  color: ACCENT.green.color  },
              { val: String(calStats.pending),   label: 'Pending',   bg: ACCENT.peach.bg,  color: ACCENT.peach.color  },
              { val: String(calStats.overdue),   label: 'Overdue',   bg: ACCENT.coral.bg,  color: ACCENT.coral.color  },
            ].map(item => (
              <View key={item.label} style={[s.statCard, { backgroundColor: item.bg }]}>
                <Text style={[s.statValue, { color: item.color }]}>{item.val}</Text>
                <Text style={s.statLabel}>{item.label}</Text>
              </View>
            ))}
          </View>

          {/* Calendar card */}
          <View style={s.calCard}>
            <View style={s.calHeader}>
              <TouchableOpacity onPress={() => { if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1); } else setCalMonth(m => m - 1); setSelDay(null); }} style={s.navBtn}>
                <Ionicons name="chevron-back" size={20} color={COLORS.primary} />
              </TouchableOpacity>
              <View style={{ alignItems: 'center' }}>
                <Text style={s.calTitle}>{MONTH_NAMES[calMonth]} {calYear}</Text>
                <Text style={s.calSub}>{monthTaskCount} task{monthTaskCount !== 1 ? 's' : ''} this month</Text>
              </View>
              <TouchableOpacity onPress={() => { if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1); } else setCalMonth(m => m + 1); setSelDay(null); }} style={s.navBtn}>
                <Ionicons name="chevron-forward" size={20} color={COLORS.primary} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={s.todayBtn} onPress={() => { setCalYear(today.getFullYear()); setCalMonth(today.getMonth()); setSelDay(today.getDate()); }}>
              <Ionicons name="today-outline" size={13} color={COLORS.primary} />
              <Text style={s.todayBtnText}>Today</Text>
            </TouchableOpacity>

            <View style={s.weekRow}>
              {DAY_ABBR.map(d => <Text key={d} style={s.weekDay}>{d}</Text>)}
            </View>

            <View style={s.calGrid}>
              {calCells.map((day, idx) => {
                if (!day) return <View key={`e${idx}`} style={s.dayCell} />;
                const key      = `${calYear}-${padZ(calMonth + 1)}-${padZ(day)}`;
                const dayTasks = tasksByDay[key] ?? [];
                const isToday  = day === today.getDate() && calMonth === today.getMonth() && calYear === today.getFullYear();
                const isSel    = day === selDay;
                const isPast   = !isToday && new Date(calYear, calMonth, day, 23, 59).getTime() < Date.now();
                return (
                  <TouchableOpacity key={day} style={[s.dayCell, isSel && s.dayCellSel, isToday && !isSel && s.dayCellToday]} onPress={() => setSelDay(day === selDay ? null : day)} activeOpacity={0.7}>
                    <Text style={[s.dayNum, isSel && s.dayNumSel, isToday && !isSel && s.dayNumToday, isPast && !isSel && s.dayNumPast]}>{day}</Text>
                    {dayTasks.length > 0 && (
                      <View style={s.dotRow}>
                        {dayTasks.slice(0, 3).map((t, di) => (
                          <View key={di} style={[s.dot, { backgroundColor: PRIORITY_CONFIG[t.priority].color }]} />
                        ))}
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={s.legend}>
              {(Object.entries(PRIORITY_CONFIG) as [string, { label: string; color: string }][]).map(([, val]) => (
                <View key={val.label} style={s.legendItem}>
                  <View style={[s.legendDot, { backgroundColor: val.color }]} />
                  <Text style={s.legendText}>{val.label}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Day detail */}
          {selDay !== null && (
            <View style={s.dayDetail}>
              <View style={s.dayDetailHeader}>
                <View>
                  <Text style={s.dayDetailTitle}>{MONTH_NAMES[calMonth]} {selDay}, {calYear}</Text>
                  <Text style={s.dayDetailSub}>{selTasks.length === 0 ? 'No tasks scheduled' : `${selTasks.length} task${selTasks.length > 1 ? 's' : ''}`}</Text>
                </View>
                <TouchableOpacity style={s.addDayBtn} onPress={() => { setPrefillDate(new Date(calYear, calMonth, selDay, 9, 0, 0, 0)); setShowAddTask(true); }}>
                  <Ionicons name="add" size={18} color={COLORS.primary} />
                  <Text style={s.addDayText}>Add Task</Text>
                </TouchableOpacity>
              </View>

              {selTasks.length === 0 ? (
                <Text style={s.freeDay}>✓ Free day — nothing scheduled</Text>
              ) : (
                selTasks.map(t => {
                  const p    = PRIORITY_CONFIG[t.priority];
                  const time = new Date(t.dueDate).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
                  const done = t.status === 'completed';
                  return (
                    <View key={t.id} style={[s.taskRow, done && s.taskRowDone]}>
                      <View style={s.timeCol}><Text style={s.timeText}>{time}</Text></View>
                      <View style={[s.taskBar, { backgroundColor: p.color }]} />
                      <View style={s.taskBody}>
                        <Text style={[s.taskTitle, done && s.taskTitleDone]} numberOfLines={2}>{t.title}</Text>
                        <View style={s.taskMeta}>
                          <View style={[s.statusDot, { backgroundColor: done ? COLORS.success : p.color }]} />
                          <Text style={s.taskStatusText}>{done ? 'Completed' : p.label}</Text>
                          {t.location ? <><Ionicons name="location-outline" size={10} color={COLORS.textMuted} /><Text style={s.taskLocation} numberOfLines={1}>{t.location}</Text></> : null}
                        </View>
                      </View>
                      {!done && (
                        <TouchableOpacity onPress={() => handleComplete(t.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={s.doneBtn}>
                          <Ionicons name="checkmark" size={16} color="#fff" />
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                })
              )}
            </View>
          )}
        </ScrollView>
      )}

      {/* ── FAB ───────────────────────────────────────────────────────── */}
      <TouchableOpacity style={[s.fab, { bottom: fabBottom }]} onPress={handleFAB} activeOpacity={0.85}>
        <LinearGradient colors={[COLORS.primary, COLORS.primaryDark]} style={s.fabGrad}>
          <Ionicons name={activeTab === 'projects' && !selectedProject ? 'folder-open-outline' : 'add'} size={28} color="#fff" />
        </LinearGradient>
      </TouchableOpacity>

      {/* ── Modals ────────────────────────────────────────────────────── */}
      <AddTaskModal
        visible={showAddTask}
        onClose={() => { setShowAddTask(false); setPrefillDate(null); }}
        onSave={handleAddTask}
        projects={projects}
        initialDate={prefillDate ?? undefined}
      />
      <AddTaskModal
        visible={!!editingTask}
        onClose={() => setEditingTask(null)}
        onSave={handleEditTask}
        projects={projects}
        initialTask={editingTask ?? undefined}
        onDelete={id => { removeTask(id); setEditingTask(null); }}
      />
      {selectedProject && (
        <AddTaskModal
          visible={showAddTaskToProj}
          onClose={() => setShowAddTaskToProj(false)}
          onSave={handleAddTaskToProject}
          projects={projects}
        />
      )}

      {/* Add Project modal */}
      <Modal visible={showAddProject} animationType="slide" transparent onRequestClose={() => setShowAddProject(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalSheet}>
            <View style={s.modalHandle} />
            <Text style={s.modalTitle}>New Project</Text>
            <TextInput style={s.input} placeholder="Project name" placeholderTextColor={COLORS.textMuted} value={newName} onChangeText={setNewName} autoFocus />
            <TextInput style={[s.input, s.inputMulti]} placeholder="Description (optional)" placeholderTextColor={COLORS.textMuted} value={newDesc} onChangeText={setNewDesc} multiline numberOfLines={3} />
            <Text style={s.colorLabel}>Color</Text>
            <View style={s.colorRow}>
              {PROJECT_COLORS.map(c => (
                <TouchableOpacity key={c} style={[s.colorSwatch, { backgroundColor: c }, newColor === c && s.colorSwatchActive]} onPress={() => setNewColor(c)} />
              ))}
            </View>
            <View style={s.modalBtns}>
              <TouchableOpacity style={s.cancelBtn} onPress={() => setShowAddProject(false)}>
                <Text style={s.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.saveBtn} onPress={handleAddProject}>
                <Text style={s.saveBtnText}>Create</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root:    { flex: 1, backgroundColor: COLORS.bg },
  scroll:  { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 4 },

  // Header
  header: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 0 },
  headerRight: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', minHeight: 36, marginBottom: 10 },
  headerBtn:   { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center' },
  headerSubtitle: { alignItems: 'flex-end' },
  subtitleText:   { fontSize: 13, color: COLORS.textSub },

  // Inner tab switcher
  tabSwitcher: { flexDirection: 'row', backgroundColor: COLORS.cardAlt, borderRadius: 14, padding: 3, marginBottom: 12, borderWidth: 1, borderColor: '#E8EAF0' },
  tabBtn:      { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 9, borderRadius: 11 },
  tabBtnActive:{ backgroundColor: COLORS.card, ...CARD_SHADOW_SM },
  tabBtnText:  { fontSize: 13, fontWeight: '600', color: COLORS.textMuted },
  tabBtnTextActive: { color: COLORS.primary, fontWeight: '700' },

  // Tasks tab
  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: COLORS.card, borderRadius: 14, marginHorizontal: 16, marginBottom: 10, paddingHorizontal: 14, paddingVertical: 11, ...CARD_SHADOW_SM },
  searchInput: { flex: 1, fontSize: 14, color: COLORS.text, paddingVertical: 0 },
  filterRow:   { paddingHorizontal: 16, paddingBottom: 10, gap: 8 },
  pill:        { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: COLORS.card, borderRadius: 22, paddingHorizontal: 14, paddingVertical: 7, ...CARD_SHADOW_SM },
  pillActive:  { backgroundColor: COLORS.primary },
  pillText:    { fontSize: 13, fontWeight: '600', color: COLORS.textSub },
  pillTextActive: { color: '#fff' },
  pillBadge:      { borderRadius: 8, paddingHorizontal: 5, paddingVertical: 1 },
  pillBadgeText:  { fontSize: 10, fontWeight: '700' },
  sectionRow:       { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 18, marginBottom: 8, paddingHorizontal: 2 },
  sectionTitle:     { fontSize: 13, fontWeight: '700', flex: 1, letterSpacing: 0.2 },
  sectionCount:     { borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2 },
  sectionCountText: { fontSize: 11, fontWeight: '700' },

  // Projects tab
  detailHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4, paddingTop: 4, paddingBottom: 16, gap: 10 },
  backBtn:      { width: 38, height: 38, borderRadius: 19, backgroundColor: COLORS.cardAlt, alignItems: 'center', justifyContent: 'center' },
  colorDot:     { width: 16, height: 16, borderRadius: 8 },
  detailTitle:  { flex: 1, fontSize: 20, fontWeight: '700', color: COLORS.text },
  addTaskBtn:   { width: 38, height: 38, borderRadius: 19, backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center' },
  detailDesc:   { fontSize: 14, color: COLORS.textSub, marginBottom: 16 },

  // Calendar tab
  calContent: { paddingHorizontal: 16, paddingTop: 4 },
  statsRow:   { flexDirection: 'row', gap: 8, marginBottom: 14 },
  statCard:   { flex: 1, borderRadius: 14, padding: 10, alignItems: 'center', ...CARD_SHADOW_SM },
  statValue:  { fontSize: 16, fontWeight: '800', letterSpacing: -0.5 },
  statLabel:  { fontSize: 9, color: COLORS.textSub, marginTop: 2, fontWeight: '600' },
  calCard:    { backgroundColor: COLORS.card, borderRadius: 22, padding: 16, ...CARD_SHADOW, marginBottom: 14 },
  calHeader:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  navBtn:     { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center' },
  calTitle:   { fontSize: 17, fontWeight: '800', color: COLORS.text },
  calSub:     { fontSize: 11, color: COLORS.textMuted, marginTop: 2, textAlign: 'center' },
  todayBtn:     { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'center', paddingVertical: 4, paddingHorizontal: 12, borderRadius: 12, backgroundColor: COLORS.primaryLight, marginBottom: 12 },
  todayBtnText: { fontSize: 12, fontWeight: '600', color: COLORS.primary },
  weekRow:  { flexDirection: 'row', marginBottom: 4 },
  weekDay:  { flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '700', color: COLORS.textMuted, letterSpacing: 0.4 },
  calGrid:  { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell:  { width: '14.28%', aspectRatio: 0.9, alignItems: 'center', justifyContent: 'center', paddingVertical: 2 },
  dayCellSel:   { backgroundColor: COLORS.primary, borderRadius: 12 },
  dayCellToday: { backgroundColor: COLORS.primaryLight, borderRadius: 12 },
  dayNum:       { fontSize: 14, fontWeight: '500', color: COLORS.text },
  dayNumSel:    { color: '#fff', fontWeight: '700' },
  dayNumToday:  { color: COLORS.primary, fontWeight: '700' },
  dayNumPast:   { color: COLORS.textMuted },
  dotRow: { flexDirection: 'row', gap: 2, marginTop: 2 },
  dot:    { width: 4, height: 4, borderRadius: 2 },
  legend:     { flexDirection: 'row', gap: 10, justifyContent: 'center', marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: COLORS.cardAlt },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot:  { width: 6, height: 6, borderRadius: 3 },
  legendText: { fontSize: 10, color: COLORS.textMuted, fontWeight: '600' },
  dayDetail:       { backgroundColor: COLORS.card, borderRadius: 22, padding: 16, ...CARD_SHADOW },
  dayDetailHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  dayDetailTitle:  { fontSize: 16, fontWeight: '700', color: COLORS.text },
  dayDetailSub:    { fontSize: 12, color: COLORS.textSub, marginTop: 2 },
  addDayBtn:  { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: COLORS.primaryLight, borderRadius: 12 },
  addDayText: { fontSize: 13, fontWeight: '700', color: COLORS.primary },
  freeDay:    { textAlign: 'center', color: COLORS.textMuted, fontSize: 14, paddingVertical: 16 },
  taskRow:       { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: COLORS.cardAlt },
  taskRowDone:   { opacity: 0.55 },
  timeCol:       { width: 46, alignItems: 'flex-end' },
  timeText:      { fontSize: 11, fontWeight: '600', color: COLORS.textMuted },
  taskBar:       { width: 3, height: 40, borderRadius: 2 },
  taskBody:      { flex: 1 },
  taskTitle:     { fontSize: 14, fontWeight: '600', color: COLORS.text, marginBottom: 3 },
  taskTitleDone: { textDecorationLine: 'line-through', color: COLORS.textMuted },
  taskMeta:      { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' },
  statusDot:     { width: 6, height: 6, borderRadius: 3 },
  taskStatusText:{ fontSize: 11, color: COLORS.textMuted, fontWeight: '500' },
  taskLocation:  { fontSize: 11, color: COLORS.textMuted, flex: 1 },
  doneBtn:       { width: 28, height: 28, borderRadius: 14, backgroundColor: COLORS.success, alignItems: 'center', justifyContent: 'center' },

  // FAB
  fab:     { position: 'absolute', right: 20 },

  // Multi-select
  taskSelWrap: { position: 'relative', borderRadius: 14, borderWidth: 2, borderColor: COLORS.primary, marginBottom: 2, overflow: 'hidden' },
  selCheckWrap: { position: 'absolute', top: 8, right: 8, zIndex: 10, backgroundColor: '#fff', borderRadius: 12 },
  bulkBar: {
    position: 'absolute', left: 16, right: 16,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: COLORS.card, borderRadius: 18,
    paddingHorizontal: 16, paddingVertical: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15, shadowRadius: 12, elevation: 8,
    borderWidth: 1, borderColor: COLORS.surfaceBorder,
  },
  bulkCount: { flex: 1, fontWeight: '700', fontSize: 13, color: COLORS.text },
  bulkBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4 },
  bulkBtnText: { fontSize: 13, fontWeight: '600' },

  // Sort chips
  sortChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 14, borderWidth: 1, borderColor: COLORS.surfaceBorder, backgroundColor: COLORS.cardAlt, marginRight: 6 },
  sortChipActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
  sortChipText: { fontSize: 12, color: COLORS.textSub, fontWeight: '500' },
  sortChipTextActive: { color: COLORS.primary, fontWeight: '700' },
  fabGrad: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },

  // Add project modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(26,29,46,0.5)', justifyContent: 'flex-end' },
  modalSheet:   { backgroundColor: COLORS.card, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, ...CARD_SHADOW },
  modalHandle:  { width: 40, height: 4, borderRadius: 2, backgroundColor: COLORS.textMuted, alignSelf: 'center', marginBottom: 20 },
  modalTitle:   { fontSize: 22, fontWeight: '800', color: COLORS.text, marginBottom: 20 },
  input:        { backgroundColor: COLORS.cardAlt, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: COLORS.text, marginBottom: 12, borderWidth: 1, borderColor: 'transparent' },
  inputMulti:   { height: 90, textAlignVertical: 'top' },
  colorLabel:   { fontSize: 13, fontWeight: '600', color: COLORS.textSub, marginBottom: 10 },
  colorRow:     { flexDirection: 'row', gap: 12, marginBottom: 24 },
  colorSwatch:  { width: 32, height: 32, borderRadius: 16 },
  colorSwatchActive: { ...CARD_SHADOW_SM, borderWidth: 3, borderColor: COLORS.card },
  modalBtns:    { flexDirection: 'row', gap: 12 },
  cancelBtn:    { flex: 1, paddingVertical: 16, borderRadius: 16, backgroundColor: COLORS.cardAlt, alignItems: 'center' },
  cancelBtnText:{ fontSize: 16, fontWeight: '700', color: COLORS.textSub },
  saveBtn:      { flex: 1, paddingVertical: 16, borderRadius: 16, backgroundColor: COLORS.primary, alignItems: 'center' },
  saveBtnText:  { fontSize: 16, fontWeight: '700', color: '#fff' },
});
