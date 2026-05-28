import { create } from 'zustand';
import { deleteNote, getAllNotes, insertNote, updateNote } from '../database/notes';
import type { Note } from '../types';
import { generateId } from '../utils/constants';

interface NoteOpts {
  tags?: string[];
  folder?: string;
  pinned?: boolean;
}

interface NoteStore {
  notes: Note[];
  loading: boolean;
  loadAll: () => Promise<void>;
  addNote: (title: string, content: string, opts?: NoteOpts) => Promise<Note>;
  editNote: (id: string, title: string, content: string, opts?: NoteOpts) => Promise<void>;
  pinNote: (id: string, pinned: boolean) => Promise<void>;
  removeNote: (id: string) => Promise<void>;
}

export const useNoteStore = create<NoteStore>((set, get) => ({
  notes: [],
  loading: false,

  loadAll: async () => {
    set({ loading: true });
    try {
      const notes = await getAllNotes();
      set({ notes, loading: false });
    } catch (e) {
      console.error('[NoteStore] loadAll failed:', e);
      set({ loading: false });
    }
  },

  addNote: async (title, content, opts = {}) => {
    const note: Note = {
      id: generateId(),
      title,
      content,
      tags:   opts.tags   ?? [],
      folder: opts.folder ?? '',
      pinned: opts.pinned ?? false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await insertNote(note);
    await get().loadAll();
    return note;
  },

  editNote: async (id, title, content, opts = {}) => {
    await updateNote({ id, title, content, ...opts });
    await get().loadAll();
  },

  pinNote: async (id, pinned) => {
    await updateNote({ id, pinned });
    await get().loadAll();
  },

  removeNote: async (id) => {
    await deleteNote(id);
    set((s) => ({ notes: s.notes.filter((n) => n.id !== id) }));
  },
}));
