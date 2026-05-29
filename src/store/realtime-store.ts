import { create } from "zustand";

interface PresenceState {
  onlineUsers: string[];
  setOnlineUsers: (ids: string[]) => void;
}

export const useRealtimeStore = create<PresenceState>((set) => ({
  onlineUsers: [],
  setOnlineUsers: (ids) => set({ onlineUsers: ids }),
}));
