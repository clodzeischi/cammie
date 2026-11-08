import { create } from 'zustand';
import type { ToastMessage } from '../ui/common/Toast';

interface NoticeState {
  notice: ToastMessage | null;
  show: (notice: ToastMessage) => void;
  dismiss: () => void;
}

/** One app-wide toast, for actions that can be started from several places. */
export const useNoticeStore = create<NoticeState>()((set) => ({
  notice: null,
  show: (notice) => set({ notice }),
  dismiss: () => set({ notice: null }),
}));
