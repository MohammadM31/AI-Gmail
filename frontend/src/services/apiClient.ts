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
const API_URL = "https://ai-gmail-lw6d.onrender.com";
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
  // ✅ Use the public test endpoint that doesn't require auth
  const response = await fetch(`${API_URL}/api/ai/test`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error?.error || `AI request failed (${response.status})`);
  }

  const data = await response.json();
  
  // The test endpoint returns { success: true, data: AiProcessResult }
  if (data.success && data.data) {
    return data.data;
  }
  
  throw new Error("Invalid response from AI test endpoint");
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
export async function listEmails(q?: string) {
  const qs = q ? `?q=${encodeURIComponent(q)}` : "";
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

export async function createTemplate(input: { name: string; prompt: string; description?: string }) {
  return request<Template>("/api/templates", { method: "POST", body: JSON.stringify(input) });
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