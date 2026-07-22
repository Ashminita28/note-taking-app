import { create } from 'zustand';

// Modal identifiers are introduced by the tickets that add each modal (AB-1010+); until then this
// is a plain string slot rather than a hand-defined union of modal names that don't exist yet.
interface UIStore {
  sidebarOpen: boolean;
  activeModal: string | null;
  editorDirty: boolean;
  toggleSidebar: () => void;
  openModal: (type: string) => void;
  closeModal: () => void;
  setEditorDirty: (dirty: boolean) => void;
}

export const useUIStore = create<UIStore>((set) => ({
  sidebarOpen: false,
  activeModal: null,
  editorDirty: false,
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  openModal: (type) => set({ activeModal: type }),
  closeModal: () => set({ activeModal: null }),
  setEditorDirty: (dirty) => set({ editorDirty: dirty }),
}));
