import type {
  AiProcessResult,
  Attachment,
  Contact,
  EmailItem,
  Template,
  User,
  UserSettingsData,
} from "../types";
import { mockProcessMessage } from "./mockAiService";
import { useUserStore } from "../stores/userStore";

const API_URL = import.meta.env.VITE_API_URL as string | undefined;
export const USE_MOCK = !API_URL;

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = useUserStore.getState().token;
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error?.message ?? `Request failed (${res.status})`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

// ---- AI ----
export async function processMessage(message: string): Promise<AiProcessResult> {
  if (USE_MOCK) return mockProcessMessage(message);
  return request("/api/ai/process", { method: "POST", body: JSON.stringify({ message }) });
}

// ---- Auth ----
export async function login(email: string, password: string) {
  return request<{ user: User; token: string }>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

// Provide organizationName to create a new org, or inviteCode to join
// an existing one — exactly one of the two, matching the backend schema.
export async function register(input: {
  email: string;
  password: string;
  name: string;
  organizationName?: string;
  inviteCode?: string;
}) {
  return request<{ user: User; token: string }>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function getInviteCode() {
  if (USE_MOCK) return { organizationName: "Demo Org", inviteCode: "DEMO123456" };
  return request<{ organizationName: string; inviteCode: string }>(
    "/api/auth/org/invite-code"
  );
}

export async function regenerateInviteCode() {
  if (USE_MOCK) return { organizationName: "Demo Org", inviteCode: "DEMO654321" };
  return request<{ organizationName: string; inviteCode: string }>(
    "/api/auth/org/invite-code/regenerate",
    { method: "POST" }
  );
}

// ---- Settings ----
const DEFAULT_SETTINGS: UserSettingsData = {
  aiTone: "professional",
  defaultChartType: "bar",
  themePreference: "light",
};
let mockSettings: UserSettingsData = { ...DEFAULT_SETTINGS };

export async function getSettings() {
  if (USE_MOCK) return mockSettings;
  return request<UserSettingsData>("/api/users/settings");
}

export async function updateSettings(input: Partial<UserSettingsData>) {
  if (USE_MOCK) {
    mockSettings = { ...mockSettings, ...input };
    return mockSettings;
  }
  return request<UserSettingsData>("/api/users/settings", {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

// ---- Attachments ----
// Real mode: ask the backend for a signed Supabase Storage URL, then
// PUT the file straight there (bytes never pass through our own API).
// Mock mode: fake it so the composer UI is fully clickable with no
// backend — nothing is actually persisted anywhere.
export async function uploadAttachment(file: File): Promise<Attachment> {
  if (USE_MOCK) {
    await new Promise((r) => setTimeout(r, 300));
    return { name: file.name, path: `mock/${file.name}`, size: file.size, type: file.type };
  }

  const { path, signedUrl, token } = await request<{
    path: string;
    signedUrl: string;
    token: string;
  }>("/api/emails/attachments/upload-url", {
    method: "POST",
    body: JSON.stringify({ fileName: file.name }),
  });

  const uploadRes = await fetch(signedUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type || "application/octet-stream" },
    body: file,
  });
  if (!uploadRes.ok) throw new Error(`Attachment upload failed (${uploadRes.status})`);
  void token; // returned for parity with Supabase's signed-upload API; fetch(signedUrl) doesn't need it separately

  return { name: file.name, path, size: file.size, type: file.type };
}

export async function getAttachmentUrl(path: string) {
  if (USE_MOCK) return { url: "#" };
  return request<{ url: string }>(
    `/api/emails/attachments/signed-url?path=${encodeURIComponent(path)}`
  );
}

// ---- Emails ----
let mockEmails: EmailItem[] = [];

export async function listEmails(q?: string) {
  if (USE_MOCK) {
    const items = q
      ? mockEmails.filter((e) => e.subject.toLowerCase().includes(q.toLowerCase()))
      : mockEmails;
    return { items, total: items.length };
  }
  const qs = q ? `?q=${encodeURIComponent(q)}` : "";
  return request<{ items: EmailItem[]; total: number }>(`/api/emails${qs}`);
}

export async function createEmail(input: Partial<EmailItem>) {
  if (USE_MOCK) {
    const email: EmailItem = {
      id: crypto.randomUUID(),
      recipients: input.recipients ?? [],
      subject: input.subject ?? "Untitled",
      content: input.content ?? "",
      bulletPoints: input.bulletPoints ?? [],
      chartData: input.chartData ?? null,
      attachments: input.attachments ?? [],
      status: "draft",
      threadId: input.threadId ?? null,
      sentAt: null,
      createdAt: new Date().toISOString(),
    };
    mockEmails = [email, ...mockEmails];
    return email;
  }
  return request<EmailItem>("/api/emails/create", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function sendEmail(id: string) {
  if (USE_MOCK) {
    mockEmails = mockEmails.map((e) =>
      e.id === id ? { ...e, status: "sent", sentAt: new Date().toISOString() } : e
    );
    return mockEmails.find((e) => e.id === id)!;
  }
  return request<EmailItem>(`/api/emails/${id}/send`, { method: "POST" });
}

// ---- Contacts ----
let mockContacts: Contact[] = [
  { id: "c1", name: "Sample Recipient", email: "recipient@example.com", usageCount: 3 },
];

export async function listContacts() {
  if (USE_MOCK) return mockContacts;
  return request<Contact[]>("/api/contacts");
}

export async function createContact(input: { name: string; email: string; organization?: string }) {
  if (USE_MOCK) {
    const contact: Contact = { id: crypto.randomUUID(), usageCount: 0, ...input };
    mockContacts = [contact, ...mockContacts];
    return contact;
  }
  return request<Contact>("/api/contacts", { method: "POST", body: JSON.stringify(input) });
}

export async function deleteContact(id: string) {
  if (USE_MOCK) {
    mockContacts = mockContacts.filter((c) => c.id !== id);
    return;
  }
  return request<void>(`/api/contacts/${id}`, { method: "DELETE" });
}

// ---- Templates ----
let mockTemplates: Template[] = [
  { id: "t1", name: "Sales Report", prompt: "Summarize this quarter's sales figures", isPublic: true, usageCount: 12 },
  { id: "t2", name: "Meeting Summary", prompt: "Summarize the key decisions from this meeting", isPublic: true, usageCount: 8 },
  { id: "t3", name: "Project Update", prompt: "Give a status update on this project", isPublic: true, usageCount: 5 },
];

export async function listTemplates() {
  if (USE_MOCK) return mockTemplates;
  return request<Template[]>("/api/templates");
}

export async function createTemplate(input: { name: string; prompt: string; description?: string }) {
  if (USE_MOCK) {
    const template: Template = { id: crypto.randomUUID(), isPublic: false, usageCount: 0, ...input };
    mockTemplates = [template, ...mockTemplates];
    return template;
  }
  return request<Template>("/api/templates", { method: "POST", body: JSON.stringify(input) });
}

// ---- Analytics ----
export async function getUsage() {
  if (USE_MOCK) {
    return { counts: { ai_call: 14, email_sent: mockEmails.filter((e) => e.status === "sent").length, voice_used: 6, chart_generated: 9 } };
  }
  return request<{ counts: Record<string, number> }>("/api/analytics/usage");
}

export async function getTopics() {
  if (USE_MOCK) return { topics: ["Quarterly sales", "Project status updates", "Meeting recaps"] };
  return request<{ topics: string[] }>("/api/analytics/topics");
}
