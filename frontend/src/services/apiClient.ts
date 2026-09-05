// frontend/src/services/apiClient.ts
import type {
  AiProcessResult,
  Attachment,
  Contact,
  EmailItem,
  Template,
  User,
  UserSettingsData,
  Pipeline,
} from "../types";
import { useUserStore } from "../stores/userStore";

// ✅ Use environment variable with fallback
export const API_URL = import.meta.env.VITE_API_URL || "https://ai-gmail-lw6d.onrender.com";
export const USE_MOCK = false;

// ✅ Environment check
if (!API_URL) {
  console.error('🚨 VITE_API_URL is not set!');
}

interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: number;
}

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

  // ✅ Check rate limit headers
  const rateLimitInfo: RateLimitInfo | null = res.headers.get('RateLimit-Limit') ? {
    limit: Number(res.headers.get('RateLimit-Limit')),
    remaining: Number(res.headers.get('RateLimit-Remaining')),
    reset: Number(res.headers.get('RateLimit-Reset')),
  } : null;

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    
    // ✅ Handle rate limit specifically
    if (res.status === 429) {
      const resetTime = rateLimitInfo?.reset || Math.floor(Date.now() / 1000) + 60;
      const resetDate = new Date(resetTime * 1000);
      throw new Error(`Rate limit exceeded. Try again at ${resetDate.toLocaleTimeString()}`);
    }
    
    throw new Error(body?.error?.message ?? `Request failed (${res.status})`);
  }
  
  if (res.status === 204) return undefined as T;
  return res.json();
}

// ---- AI ----
export async function processMessage(message: string): Promise<AiProcessResult> {
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
  try {
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
    if (!uploadRes.ok) {
      throw new Error(`Upload failed (${uploadRes.status})`);
    }

    return { name: file.name, path, size: file.size, type: file.type };
  } catch (error) {
    console.error("Upload failed:", error);
    throw new Error(`Failed to upload ${file.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
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

export async function sendScheduledTemplates() {
  return request<{ processed: number; results: any[] }>("/api/templates/send-scheduled", {
    method: "POST",
  });
}

export async function sendTemplateNow(id: string) {
  return request<{ success: boolean; emailId: string }>(`/api/templates/${id}/send`, {
    method: "POST",
  });
}

// ---- Analytics ----
export async function getUsage(params?: { dateFrom?: string; dateTo?: string }) {
  const qs = params
    ? `?${new URLSearchParams(params as Record<string, string>).toString()}`
    : "";
  return request<{ counts: Record<string, number>; recent: any[] }>(
    `/api/analytics/usage${qs}`
  );
}

export async function getTopics(params?: {
  contactId?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
}) {
  const qs = params
    ? `?${new URLSearchParams(
        Object.entries(params).reduce((acc, [k, v]) => {
          if (v !== undefined && v !== null && v !== "") {
            acc[k] = String(v);
          }
          return acc;
        }, {} as Record<string, string>)
      ).toString()}`
    : "";
  return request<{
    topics: { topic: string; count: number }[];
    totalEmails: number;
    filters: any;
  }>(`/api/analytics/topics${qs}`);
}

export async function getTopicTrends(params?: { contactId?: string; months?: number }) {
  const qs = params
    ? `?${new URLSearchParams(
        Object.entries(params).reduce((acc, [k, v]) => {
          if (v !== undefined && v !== null && v !== "") {
            acc[k] = String(v);
          }
          return acc;
        }, {} as Record<string, string>)
      ).toString()}`
    : "";
  return request<{
    labels: string[];
    data: number[];
    total: number;
  }>(`/api/analytics/topics/trends${qs}`);
}

export async function exportAnalytics(params?: { startDate?: string; endDate?: string }) {
  const qs = params
    ? `?${new URLSearchParams(
        Object.entries(params).reduce((acc, [k, v]) => {
          if (v !== undefined && v !== null && v !== "") {
            acc[k] = String(v);
          }
          return acc;
        }, {} as Record<string, string>)
      ).toString()}`
    : "";
  const token = useUserStore.getState().token;
  const res = await fetch(`${API_URL}/api/analytics/export${qs}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(`Export failed (${res.status})`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `analytics_${new Date().toISOString().split("T")[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ---- Pipeline ----
export async function getPipeline(contactId: string) {
  return request<{
    exists: boolean;
    pipeline: Pipeline | null;
  }>(`/api/pipeline/${contactId}`);
}

export async function generatePipeline(contactId: string, threadId: string) {
  return request<{
    pipeline: Pipeline;
  }>(`/api/pipeline/${contactId}/generate`, {
    method: 'POST',
    body: JSON.stringify({ threadId }),
  });
}

export async function updatePipeline(contactId: string, threadId: string) {
  return request<{
    pipeline: Pipeline;
  }>(`/api/pipeline/${contactId}/update`, {
    method: 'POST',
    body: JSON.stringify({ threadId }),
  });
}


export async function resolveRecipientsLocally(
  userId: string,
  raw: { name: string; email: string | null }[]
): Promise<{ name: string; email: string | null; contactId: string | null }[]> {
  // This is a fallback for when the backend resolver is too strict
  // It allows email-only recipients to pass through
  if (!raw || raw.length === 0) return [];
  
  // If we can't resolve, just pass through with contactId: null
  return raw.map((r) => ({
    name: r.name,
    email: r.email,
    contactId: null,
  }));
}


// ---- Pipeline Enhanced ----
export async function updatePipelineStage(
  pipelineId: string,
  stageId: string,
  status: string
) {
  return request<{
    success: boolean;
    stage: PipelineStage;
  }>(`/api/pipeline/${pipelineId}/stage/${stageId}`, {
    method: 'PUT',
    body: JSON.stringify({ status }),
  });
}

export async function getPipelineMetrics() {
  return request<PipelineMetrics>('/api/pipeline/metrics');
}

export async function getPipelineHistory(pipelineId: string) {
  return request<PipelineHistory[]>(`/api/pipeline/${pipelineId}/history`);
}