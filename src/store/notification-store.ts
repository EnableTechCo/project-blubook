import { create } from "zustand";

export interface NotificationItem {
  id: string;
  message: string;
  createdAt: string;
  read: boolean;
  customerName?: string;
}

interface NotificationState {
  items: NotificationItem[];
  setItems: (items: NotificationItem[]) => void;
  upsertItem: (item: NotificationItem) => void;
  markRead: (id: string) => void;
  markGroupRead: (ids: string[]) => void;
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
  markGroupRead: (ids) =>
    set((state) => ({
      items: state.items.map((item) =>
        ids.includes(item.id) ? { ...item, read: true } : item,
      ),
    })),
  markAllRead: () =>
    set((state) => ({
      items: state.items.map((item) => ({ ...item, read: true })),
    })),
}));
