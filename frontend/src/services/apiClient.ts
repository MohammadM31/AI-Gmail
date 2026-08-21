import type {
  AiProcessResult,
  Attachment,
  Contact,
  EmailItem,
  Template,
  User,
  UserSettingsData,
} from "../types";
import { useUserStore } from "../stores/userStore";

// ✅ Force to use the real backend, NOT mock
export const API_URL = "https://ai-gmail-lw6d.onrender.com";
export const USE_MOCK = false; // ← Force real API calls

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
  // Use the authenticated endpoint, not /api/ai/test — the test route
  // exists only for pre-auth smoke-testing and skips recipient
  // resolution, audit logging, and usage tracking entirely, since it
  // has no req.auth to resolve contacts or attribute events against.
  return request<AiProcessResult>("/api/ai/process", {
    method: "POST",
    body: JSON.stringify({ message }),
  });
}

// ---- Auth ----
export async function login(email: string, password: string) {
  return request<{ user: User; token: string }>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

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
  return request<{ organizationName: string; inviteCode: string }>(
    "/api/auth/org/invite-code"
  );
}

export async function regenerateInviteCode() {
  return request<{ organizationName: string; inviteCode: string }>(
    "/api/auth/org/invite-code/regenerate",
    { method: "POST" }
  );
}

// ---- Settings ----
export async function getSettings() {
  return request<UserSettingsData>("/api/users/settings");
}

export async function updateSettings(input: Partial<UserSettingsData>) {
  return request<UserSettingsData>("/api/users/settings", {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

// ---- Attachments ----
export async function uploadAttachment(file: File): Promise<Attachment> {
  const { path, signedUrl } = await request<{
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

  return { name: file.name, path, size: file.size, type: file.type };
}

export async function getAttachmentUrl(path: string) {
  return request<{ url: string }>(
    `/api/emails/attachments/signed-url?path=${encodeURIComponent(path)}`
  );
}

// ---- Emails ----
export async function listEmails(params?: string) {
  const qs = params ? `?${params}` : "";
  return request<{ items: EmailItem[]; total: number }>(`/api/emails${qs}`);
}

export async function createEmail(input: Partial<EmailItem>) {
  return request<EmailItem>("/api/emails/create", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function sendEmail(id: string) {
  return request<EmailItem>(`/api/emails/${id}/send`, { method: "POST" });
}

export async function getEmail(id: string) {
  return request<EmailItem>(`/api/emails/${id}`);
}

export async function getThread(threadId: string) {
  return request<EmailItem[]>(`/api/emails/thread/${threadId}`);
}

export async function getThreadSummary(threadId: string) {
  return request<{ summary: string[] }>(`/api/emails/summary/${threadId}`);
}

export async function deleteEmail(id: string) {
  return request<void>(`/api/emails/${id}`, { method: "DELETE" });
}

// ---- Contacts ----
export async function listContacts() {
  return request<Contact[]>("/api/contacts");
}

export async function getContact(id: string) {
  return request<Contact>(`/api/contacts/${id}`);
}

export async function getContactSummary(id: string) {
  return request<{
    contact: string;
    summary: string[];
    emailCount: number;
    emails: {
      id: string;
      subject: string;
      content: string;
      bulletPoints: string[];
      createdAt: string;
      status: string;
      threadId: string | null;
    }[];
  }>(`/api/contacts/${id}/summary`);
}

export async function getContactThreads(id: string) {
  return request<{
    contact: string;
    threads: {
      threadId: string;
      count: number;
      lastMessage: any;
      messages: {
        id: string;
        subject: string;
        content: string;
        bulletPoints: string[];
        createdAt: string;
        status: string;
      }[];
    }[];
    totalEmails: number;
  }>(`/api/contacts/${id}/threads`);
}

export async function createContact(input: { name: string; email: string; organization?: string }) {
  return request<Contact>("/api/contacts", { method: "POST", body: JSON.stringify(input) });
}

export async function deleteContact(id: string) {
  return request<void>(`/api/contacts/${id}`, { method: "DELETE" });
}

// ---- Templates ----
export async function listTemplates() {
  return request<Template[]>("/api/templates");
}

export async function getTemplate(id: string) {
  return request<Template>(`/api/templates/${id}`);
}

export async function createTemplate(input: { 
  name: string; 
  prompt: string; 
  description?: string;
  recipientId?: string;
  scheduleDate?: string;
  autoSend?: boolean;
}) {
  return request<Template>("/api/templates", { 
    method: "POST", 
    body: JSON.stringify(input) 
  });
}

export async function updateTemplate(id: string, input: Partial<{
  name: string;
  prompt: string;
  description?: string;
  recipientId?: string;
  scheduleDate?: string;
  autoSend?: boolean;
}>) {
  return request<Template>(`/api/templates/${id}`, { 
    method: "PUT", 
    body: JSON.stringify(input) 
  });
}

export async function deleteTemplate(id: string) {
  return request<void>(`/api/templates/${id}`, { method: "DELETE" });
}

// ✅ NEW: Send scheduled templates
export async function sendScheduledTemplates() {
  return request<{ processed: number; results: any[] }>("/api/templates/send-scheduled", {
    method: "POST",
  });
}

// ✅ NEW: Send template now
export async function sendTemplateNow(id: string) {
  return request<{ success: boolean; emailId: string }>(`/api/templates/${id}/send`, {
    method: "POST",
  });
}

// ---- Analytics ----
export async function getUsage() {
  return request<{ counts: Record<string, number> }>("/api/analytics/usage");
}

export async function getTopics() {
  return request<{ topics: string[] }>("/api/analytics/topics");
}

// ---- Thread Summary ----
export async function summarizeThread(threadId: string) {
  return request<{ summary: string[] }>(`/api/emails/summary/${threadId}`);
}

