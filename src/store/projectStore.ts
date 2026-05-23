import { create } from 'zustand';
import { deleteProject, getAllProjects, insertProject, updateProject } from '../database/projects';
import type { Project } from '../types';

interface ProjectStore {
  projects: Project[];
  loading: boolean;
  loadAll: () => Promise<void>;
  addProject: (project: Project) => Promise<void>;
  editProject: (project: Partial<Project> & { id: string }) => Promise<void>;
  removeProject: (id: string) => Promise<void>;
}

export const useProjectStore = create<ProjectStore>((set, get) => ({
  projects: [],
  loading: false,

  loadAll: async () => {
    set({ loading: true });
    try {
      const projects = await getAllProjects();
      set({ projects, loading: false });
    } catch (e) {
      console.error('[ProjectStore] loadAll failed:', e);
      set({ loading: false });
    }
  },

  addProject: async (project) => {
    await insertProject(project);
    await get().loadAll();
  },

  editProject: async (project) => {
    await updateProject(project);
    await get().loadAll();
  },

  removeProject: async (id) => {
    await deleteProject(id);
    set((s) => ({ projects: s.projects.filter((p) => p.id !== id) }));
  },
}));
