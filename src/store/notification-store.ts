import { create } from "zustand";

interface NotificationItem {
  id: string;
  message: string;
  createdAt: string;
  read: boolean;
}

interface NotificationState {
  items: NotificationItem[];
  setItems: (items: NotificationItem[]) => void;
  upsertItem: (item: NotificationItem) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  items: [],
  setItems: (items) => set({ items }),
  upsertItem: (item) =>
    set((state) => ({
      items: [
        item,
        ...state.items.filter((existing) => existing.id !== item.id),
      ],
    })),
  markRead: (id) =>
    set((state) => ({
      items: state.items.map((item) =>
        item.id === id ? { ...item, read: true } : item,
      ),
    })),
  markAllRead: () =>
    set((state) => ({
      items: state.items.map((item) => ({ ...item, read: true })),
    })),
}));
