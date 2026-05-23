import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
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
import { SafeAreaView } from 'react-native-safe-area-context';
import AddTaskModal from '../../src/components/AddTaskModal';
import BackgroundImage from '../../src/components/BackgroundImage';
import EmptyState from '../../src/components/EmptyState';
import ProjectCard from '../../src/components/ProjectCard';
import TaskCard from '../../src/components/TaskCard';
import { useProjectStore } from '../../src/store/projectStore';
import { useTaskStore } from '../../src/store/taskStore';
import type { Project, Task } from '../../src/types';
import { CARD_SHADOW, CARD_SHADOW_SM, COLORS, generateId } from '../../src/utils/constants';

const PROJECT_COLORS = ['#6B7CFF', '#FF9A56', '#2ECC9A', '#F59E0B', '#FF7DA0', '#FF7070'];

export default function ProjectsScreen() {
  const { projects, loadAll, addProject } = useProjectStore();
  const { tasks, loadAll: loadTasks, markComplete, snoozeTask, editTask: saveEditedTask, removeTask } = useTaskStore();
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [showAddTaskModal, setShowAddTaskModal] = useState(false);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newColor, setNewColor] = useState(PROJECT_COLORS[0]);

  useEffect(() => { loadAll(); loadTasks(); }, []);

  const taskCountFor = (projectId: string) =>
    tasks.filter((t) => t.projectId === projectId && t.status !== 'completed').length;

  const completedCountFor = (projectId: string) =>
    tasks.filter((t) => t.projectId === projectId && t.status === 'completed').length;

  const totalCountFor = (projectId: string) =>
    tasks.filter((t) => t.projectId === projectId).length;

  const projectTasks = selectedProject
    ? tasks.filter((t) => t.projectId === selectedProject.id)
    : [];

  const handleAddProject = async () => {
    if (!newName.trim()) return;
    await addProject({ id: generateId(), name: newName.trim(), description: newDesc.trim(), color: newColor, createdAt: Date.now() });
    setNewName(''); setNewDesc(''); setNewColor(PROJECT_COLORS[0]); setShowAddModal(false);
  };

  const handleAddTask = async (taskData: Omit<Task, 'id' | 'createdAt' | 'escalationLevel' | 'snoozeCount'>) => {
    const { addTask } = useTaskStore.getState();
    const task: Task = { ...taskData, id: generateId(), createdAt: Date.now(), escalationLevel: 0, snoozeCount: 0 };
    await addTask(task);
    await loadTasks();
  };

  const handleEditTask = async (taskData: Omit<Task, 'id' | 'createdAt' | 'escalationLevel' | 'snoozeCount'>) => {
    if (!editTask) return;
    await saveEditedTask({ ...taskData, id: editTask.id });
    setEditTask(null);
  };

  const handleDeleteTask = async (id: string) => {
    await removeTask(id);
    setEditTask(null);
  };

  return (
    <BackgroundImage screen="projects">
      <SafeAreaView style={s.safe}>
        <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

        <View style={s.header}>
          <View>
            <Text style={s.title}>Projects</Text>
            <Text style={s.subtitle}>{projects.length} active</Text>
          </View>
          <TouchableOpacity style={s.addBtn} onPress={() => setShowAddModal(true)}>
            <Ionicons name="add" size={22} color={COLORS.primary} />
          </TouchableOpacity>
        </View>

        {selectedProject ? (
          <ScrollView style={s.scroll} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
            <View style={s.detailHeader}>
              <TouchableOpacity onPress={() => setSelectedProject(null)} style={s.backBtn}>
                <Ionicons name="arrow-back" size={22} color={COLORS.text} />
              </TouchableOpacity>
              <View style={[s.colorDot, { backgroundColor: selectedProject.color }]} />
              <Text style={s.detailTitle}>{selectedProject.name}</Text>
              <TouchableOpacity style={s.addTaskBtn} onPress={() => setShowAddTaskModal(true)}>
                <Ionicons name="add-circle-outline" size={22} color={COLORS.primary} />
              </TouchableOpacity>
            </View>
            {selectedProject.description ? <Text style={s.detailDesc}>{selectedProject.description}</Text> : null}
            {projectTasks.length === 0 ? (
              <EmptyState icon="checkmark-done-outline" title="No tasks yet" subtitle="Tap + to add a task" />
            ) : (
              projectTasks.map((t) => (
                <TaskCard key={t.id} task={t} onComplete={markComplete} onSnooze={snoozeTask} onPress={(task) => setEditTask(task)} />
              ))
            )}
            <View style={{ height: 110 }} />
          </ScrollView>
        ) : (
          <ScrollView style={s.scroll} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
            {projects.length === 0 ? (
              <EmptyState icon="folder-open-outline" title="No projects yet" subtitle="Tap + to create your first project" />
            ) : (
              projects.map((project) => (
                <ProjectCard key={project.id} project={project} taskCount={totalCountFor(project.id)} completedCount={completedCountFor(project.id)} onPress={() => setSelectedProject(project)} />
              ))
            )}
            <View style={{ height: 110 }} />
          </ScrollView>
        )}

        <Modal visible={showAddModal} animationType="slide" transparent onRequestClose={() => setShowAddModal(false)}>
          <View style={s.modalOverlay}>
            <View style={s.modalSheet}>
              <View style={s.modalHandle} />
              <Text style={s.modalTitle}>New Project</Text>
              <TextInput style={s.input} placeholder="Project name" placeholderTextColor={COLORS.textMuted} value={newName} onChangeText={setNewName} autoFocus />
              <TextInput style={[s.input, s.inputMulti]} placeholder="Description (optional)" placeholderTextColor={COLORS.textMuted} value={newDesc} onChangeText={setNewDesc} multiline numberOfLines={3} />
              <Text style={s.colorLabel}>Color</Text>
              <View style={s.colorRow}>
                {PROJECT_COLORS.map((c) => (
                  <TouchableOpacity key={c} style={[s.colorSwatch, { backgroundColor: c }, newColor === c && s.colorSwatchActive]} onPress={() => setNewColor(c)} />
                ))}
              </View>
              <View style={s.modalBtns}>
                <TouchableOpacity style={s.cancelBtn} onPress={() => setShowAddModal(false)}>
                  <Text style={s.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.saveBtn} onPress={handleAddProject}>
                  <Text style={s.saveBtnText}>Create</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {selectedProject && (
          <AddTaskModal visible={showAddTaskModal} onClose={() => setShowAddTaskModal(false)} onSave={handleAddTask} projects={projects} />
        )}
        <AddTaskModal
          visible={!!editTask}
          onClose={() => setEditTask(null)}
          onSave={handleEditTask}
          projects={projects}
          initialTask={editTask ?? undefined}
          onDelete={handleDeleteTask}
        />
      </SafeAreaView>
    </BackgroundImage>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 20, paddingBottom: 40 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16 },
  title: { fontSize: 28, fontWeight: '800', color: COLORS.text, letterSpacing: -0.5 },
  subtitle: { fontSize: 14, color: COLORS.textSub, marginTop: 2 },
  addBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center' },
  detailHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 4, paddingBottom: 16, gap: 10 },
  backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: COLORS.cardAlt, alignItems: 'center', justifyContent: 'center' },
  colorDot: { width: 16, height: 16, borderRadius: 8 },
  detailTitle: { flex: 1, fontSize: 20, fontWeight: '700', color: COLORS.text },
  addTaskBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center' },
  detailDesc: { fontSize: 14, color: COLORS.textSub, marginHorizontal: 20, marginBottom: 16 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(26,29,46,0.5)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: COLORS.card, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, ...CARD_SHADOW },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: COLORS.textMuted, alignSelf: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 22, fontWeight: '800', color: COLORS.text, marginBottom: 20 },
  input: { backgroundColor: COLORS.cardAlt, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: COLORS.text, marginBottom: 12, borderWidth: 1, borderColor: 'transparent' },
  inputMulti: { height: 90, textAlignVertical: 'top' },
  colorLabel: { fontSize: 13, fontWeight: '600', color: COLORS.textSub, marginBottom: 10 },
  colorRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  colorSwatch: { width: 32, height: 32, borderRadius: 16 },
  colorSwatchActive: { ...CARD_SHADOW_SM, borderWidth: 3, borderColor: COLORS.card },
  modalBtns: { flexDirection: 'row', gap: 12 },
  cancelBtn: { flex: 1, paddingVertical: 16, borderRadius: 16, backgroundColor: COLORS.cardAlt, alignItems: 'center' },
  cancelBtnText: { fontSize: 16, fontWeight: '700', color: COLORS.textSub },
  saveBtn: { flex: 1, paddingVertical: 16, borderRadius: 16, backgroundColor: COLORS.primary, alignItems: 'center' },
  saveBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
});
