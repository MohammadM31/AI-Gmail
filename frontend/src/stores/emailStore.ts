import { create } from "zustand";
import type { EmailItem } from "../types";

interface EmailState {
  emails: EmailItem[];
  setEmails: (emails: EmailItem[]) => void;
  upsertEmail: (email: EmailItem) => void;
}

export const useEmailStore = create<EmailState>((set) => ({
  emails: [],
  setEmails: (emails) => set({ emails }),
  upsertEmail: (email) =>
    set((state) => {
      const exists = state.emails.some((e) => e.id === email.id);
      return {
        emails: exists
          ? state.emails.map((e) => (e.id === email.id ? email : e))
          : [email, ...state.emails],
      };
    }),
}));
