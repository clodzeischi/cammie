import { create } from 'zustand';

/** Dialogs that can be opened from more than one place (header, tool rail, menus, keys). */
export type DialogName = 'stock' | 'machine' | 'bits' | 'hole' | 'arrange';

interface DialogState {
  open: DialogName | null;
  show: (name: DialogName) => void;
  close: () => void;
}

/** Which app-level dialog is open; AppShell renders it. One at a time. */
export const useDialogStore = create<DialogState>()((set) => ({
  open: null,
  show: (open) => set({ open }),
  close: () => set({ open: null }),
}));
