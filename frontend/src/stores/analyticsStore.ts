import { create } from "zustand";

interface AnalyticsState {
  counts: Record<string, number>;
  setCounts: (counts: Record<string, number>) => void;
}

export const useAnalyticsStore = create<AnalyticsState>((set) => ({
  counts: {},
  setCounts: (counts) => set({ counts }),
}));
