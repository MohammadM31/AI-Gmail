// frontend/src/types/index.ts

export interface ChartData {
  type: string;
  title: string;
  labels: string[];
  values: number[];
}

export interface AiProcessResult {
  recipients: { name: string; email: string | null }[];
  subject: string;
  bulletPoints: string[];
  chart: ChartData | null;
  tone: "professional" | "casual" | "urgent";
  emailId?: string;
  _warning?: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  organizationId: string;
}

export interface Attachment {
  name: string;
  path: string;
  size?: number;
  type?: string;
}

export interface EmailItem {
  id: string;
  senderId?: string;
  recipients: { name: string; email: string | null }[];
  subject: string;
  content: string;
  bulletPoints: string[];
  chartData: ChartData | null;
  attachments: Attachment[];
  status: "draft" | "sent" | "edited" | "deleted";
  threadId: string | null;
  sentAt: string | null;
  createdAt: string;
}

export interface UserSettingsData {
  aiTone: "professional" | "casual" | "urgent";
  defaultChartType: "bar" | "line" | "pie";
  themePreference: "light" | "dark";
}

export interface Contact {
  id: string;
  name: string;
  email: string;
  organization?: string | null;
  usageCount: number;
}

export interface Template {
  id: string;
  name: string;
  description?: string | null;
  prompt: string;
  isPublic: boolean;
  usageCount: number;
  recipientId?: string | null;
  scheduleDate?: string | null;
  autoSend?: boolean;
  isScheduled?: boolean;
  lastSentAt?: string | null;
  recipientName?: string;
}

export type NavView =
  | "compose"
  | "inbox"
  | "contacts"
  | "templates"
  | "analytics"
  | "settings";

// ✅ NEW: Pipeline Types
export interface PipelineStage {
  id: string;
  name: string;
  description: string;
  status: 'pending' | 'in-progress' | 'complete';
  order: number;
}

export interface Pipeline {
  id: string;
  contactId: string;
  contactName: string;
  projectName: string;
  projectType: 'sales' | 'development' | 'event' | 'job' | 'general';
  stages: PipelineStage[];
  updatedAt: string;
}