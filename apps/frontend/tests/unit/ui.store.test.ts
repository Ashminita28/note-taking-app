import { describe, it, expect, beforeEach } from 'vitest';
import { useUIStore } from '../../src/stores/ui.store';

describe('useUIStore', () => {
  beforeEach(() => {
    useUIStore.setState({ sidebarOpen: false, activeModal: null, editorDirty: false });
  });

  it('toggles the sidebar', () => {
    useUIStore.getState().toggleSidebar();
    expect(useUIStore.getState().sidebarOpen).toBe(true);

    useUIStore.getState().toggleSidebar();
    expect(useUIStore.getState().sidebarOpen).toBe(false);
  });

  it('opens and closes a modal', () => {
    useUIStore.getState().openModal('delete-note');
    expect(useUIStore.getState().activeModal).toBe('delete-note');

    useUIStore.getState().closeModal();
    expect(useUIStore.getState().activeModal).toBeNull();
  });

  it('sets the editor dirty flag', () => {
    useUIStore.getState().setEditorDirty(true);
    expect(useUIStore.getState().editorDirty).toBe(true);
  });
});
