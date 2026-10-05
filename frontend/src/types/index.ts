// frontend/src/types/index.ts

export interface ChartData {
  type: string;
  title: string;
  labels: string[];
  values: number[];
}

export interface AiProcessResult {
  recipients: {
    name: string;
    email: string | null;
  }[];

  subject: string;

  bulletPoints: string[];

  chart: ChartData | null;

  tone:
    | "professional"
    | "casual"
    | "urgent";

  emailId?: string;

  _warning?: string;
}

// ============================================================
// USERS
// ============================================================

export type UserRole =
  | "CLIENT"
  | "STAFF";

export type StaffRole =
  | "IT"
  | "ADMIN"
  | "SUPER_ADMIN";

export interface User {
  id: string;
  email: string;
  name: string;
  organizationId: string;

  role?: UserRole;

  staffRole?:
    | StaffRole
    | null;
}

// ============================================================
// ATTACHMENTS
// ============================================================

export interface Attachment {
  name: string;
  path: string;
  size?: number;
  type?: string;
}

// ============================================================
// EMAIL
// ============================================================

export interface EmailItem {
  id: string;

  senderId?: string;

  recipients: {
    name: string;
    email: string | null;
  }[];

  subject: string;

  content: string;

  bulletPoints: string[];

  chartData: ChartData | null;

  attachments: Attachment[];

  status:
    | "draft"
    | "sent"
    | "edited"
    | "deleted";

  threadId: string | null;

  sentAt: string | null;

  createdAt: string;

  pipelineStageId?: string | null;
}

// ============================================================
// SETTINGS
// ============================================================

export interface UserSettingsData {
  aiTone:
    | "professional"
    | "casual"
    | "urgent";

  defaultChartType:
    | "bar"
    | "line"
    | "pie";

  themePreference:
    | "light"
    | "dark";
}

// ============================================================
// CONTACTS
// ============================================================

export interface Contact {
  id: string;

  name: string;

  email: string;

  organization?: string | null;

  usageCount: number;
}

// ============================================================
// TEMPLATES
// ============================================================

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

// ============================================================
// NAVIGATION
// ============================================================

export type NavView =
  | "compose"
  | "inbox"
  | "contacts"
  | "pipeline"
  | "requirements"
  | "templates"
  | "analytics"
  | "settings";

// ============================================================
// PIPELINE
// ============================================================

export interface PipelineStage {
  id: string;

  name: string;

  description: string;

  status:
    | "pending"
    | "in-progress"
    | "complete";

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

  projectType:
    | "sales"
    | "development"
    | "event"
    | "job"
    | "general";

  stages: PipelineStage[];

  status:
    | "active"
    | "completed"
    | "archived";

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

  avgDurationByType:
    Record<string, number>;

  monthlyTrends: {
    month: string;
    completed: number;
    started: number;
  }[];
}

// ============================================================
// PROJECTS
// ============================================================

export interface Project {
  id: string;

  organizationId: string;

  clientUserId: string;

  name: string;

  description: string | null;

  repositoryUrl: string | null;

  applicationUrl: string | null;

  status:
    | "ACTIVE"
    | "ARCHIVED";

  createdAt: string;

  updatedAt: string;
}

// ============================================================
// REQUIREMENTS
// ============================================================

export type RequirementPriority =
  | "LOW"
  | "MEDIUM"
  | "HIGH"
  | "URGENT";

export type RequirementStatus =
  | "OPEN"
  | "CLARIFICATION_NEEDED"
  | "READY_FOR_PROPOSAL"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED";

export interface Requirement {
  id: string;

  organizationId: string;

  clientUserId: string;

  projectId: string | null;

  threadId: string | null;

  category: string;

  request: string;

  details: string[];

  priority: RequirementPriority;

  confidence: number;

  status: RequirementStatus;

  clarificationNeeded: boolean;

  clarificationQuestion: string | null;

  aiAnalysis: Record<string, unknown> | null;

  createdAt: string;

  updatedAt: string;
}

// ============================================================
// MODIFICATIONS
// ============================================================

export type ModificationStatus =
  | "PENDING_REVIEW"
  | "ACCEPTED"
  | "REJECTED"
  | "CHANGES_REQUESTED";

export interface Modification {
  id: string;

  organizationId: string;

  projectId: string;

  requirementId: string;

  createdBy: string;

  summary: string;

  implementationPlan: string[];

  affectedFiles: string[];

  status: ModificationStatus;

  reviewedBy: string | null;

  reviewComment: string | null;

  createdAt: string;

  updatedAt: string;

  reviewedAt: string | null;
}
