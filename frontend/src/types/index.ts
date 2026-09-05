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
  pipelineStageId?: string | null;
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

// ✅ FIXED: Only one "pipeline" entry
export type NavView =
  | "compose"
  | "inbox"
  | "contacts"
  | "pipeline"
  | "templates"
  | "analytics"
  | "settings";

// ✅ ENHANCED: Pipeline Types with Timeline Support
export interface PipelineStage {
  id: string;
  name: string;
  description: string;
  status: 'pending' | 'in-progress' | 'complete';
  order: number;
  startedAt?: string | null;
  completedAt?: string | null;
  dueDate?: string | null;
  duration?: number;
  emailIds?: string[];
  timeSpent?: number;
  timeEntries?: {
    start: string;
    end?: string;
    note?: string;
  }[];
}

export interface Pipeline {
  id: string;
  userId?: string;
  contactId: string;
  contactName: string;
  projectName: string;
  projectType: 'sales' | 'development' | 'event' | 'job' | 'general';
  stages: PipelineStage[];
  status: 'active' | 'completed' | 'archived';
  createdAt: string;
  updatedAt: string;
  completedAt?: string | null;
  totalDuration?: number;
}

export interface PipelineHistory {
  id: string;
  pipelineId: string;
  stageId: string;
  stageName: string;
  fromStatus: string;
  toStatus: string;
  changedAt: string;
  changedBy: string;
  note?: string;
}

export interface PipelineMetrics {
  avgCompletionDays: number;
  successRate: number;
  activeCount: number;
  completedCount: number;
  totalCount: number;
  bottleneckStages: {
    name: string;
    avgDuration: number;
    count: number;
  }[];
  avgDurationByType: Record<string, number>;
  monthlyTrends: {
    month: string;
    completed: number;
    started: number;
  }[];
}