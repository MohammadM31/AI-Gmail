export interface ChartData {
  type: "bar" | "line" | "pie";
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
  emailId?: string; // ✅ ADDED
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
  senderId?: string; // ✅ ADDED
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
}

export type NavView =
  | "compose"
  | "inbox"
  | "contacts"
  | "templates"
  | "analytics"
  | "settings";