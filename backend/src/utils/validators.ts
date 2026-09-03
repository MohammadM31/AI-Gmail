// backend/src/utils/validators.ts
import { z } from "zod";

// Email content validation
export const emailContentSchema = z.string()
  .min(1, "Content is required")
  .max(50000, "Content exceeds maximum length of 50,000 characters");

// Recipient validation
export const recipientSchema = z.object({
  name: z.string().min(1, "Recipient name is required"),
  email: z.string().email("Invalid email format").nullable(),
});

export const emailCreateSchema = z.object({
  recipients: z
    .array(recipientSchema)
    .min(1, "At least one valid recipient is required")
    .max(50, "Maximum 50 recipients allowed"),
  subject: z.string()
    .min(1, "Subject is required")
    .max(200, "Subject exceeds maximum length of 200 characters"),
  content: emailContentSchema,
  bulletPoints: z.array(z.string().max(500, "Bullet point exceeds 500 characters"))
    .max(20, "Maximum 20 bullet points allowed"),
  chartData: z
    .object({
      type: z.enum(["bar", "line", "pie", "doughnut", "radar", "polarArea", "scatter", "bubble"]),
      title: z.string().max(100),
      labels: z.array(z.string()).max(20, "Maximum 20 labels allowed"),
      values: z.array(z.number()),
    })
    .nullable()
    .optional(),
  threadId: z.string().nullable().optional(),
  attachments: z
    .array(
      z.object({
        name: z.string().min(1).max(255),
        path: z.string().min(1).max(500),
        size: z.number().min(0).max(25 * 1024 * 1024).optional(),
        type: z.string().optional(),
      })
    )
    .max(10, "Maximum 10 attachments allowed")
    .optional(),
});

export const contactSchema = z.object({
  name: z.string()
    .min(1, "Name is required")
    .max(100, "Name exceeds maximum length"),
  email: z.string()
    .email("Invalid email format")
    .max(255, "Email exceeds maximum length"),
  organization: z.string().max(100).optional(),
});

export const templateSchema = z.object({
  name: z.string()
    .min(1, "Template name is required")
    .max(100, "Template name exceeds maximum length"),
  description: z.string().max(500).optional(),
  prompt: z.string()
    .min(1, "Prompt is required")
    .max(5000, "Prompt exceeds maximum length"),
  chartConfig: z.record(z.any()).nullable().optional(),
  isPublic: z.boolean().optional(),
  recipientId: z.string().nullable().optional(),
  scheduleDate: z.string()
    .nullable()
    .optional()
    .refine(
      (date) => !date || !isNaN(Date.parse(date)),
      "Invalid date format"
    ),
  autoSend: z.boolean().optional(),
});

export const registerSchema = z
  .object({
    email: z.string()
      .email("Invalid email format")
      .max(255, "Email exceeds maximum length"),
    password: z.string()
      .min(8, "Password must be at least 8 characters")
      .max(100, "Password exceeds maximum length")
      .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
      .regex(/[a-z]/, "Password must contain at least one lowercase letter")
      .regex(/[0-9]/, "Password must contain at least one number"),
    name: z.string()
      .min(1, "Name is required")
      .max(100, "Name exceeds maximum length"),
    organizationName: z.string()
      .min(1, "Organization name is required")
      .max(100, "Organization name exceeds maximum length")
      .optional(),
    inviteCode: z.string()
      .min(1)
      .max(50)
      .optional(),
  })
  .refine((data) => Boolean(data.organizationName) !== Boolean(data.inviteCode), {
    message: "Provide either an organization name (to create one) or an invite code (to join one) — not both",
    path: ["organizationName"],
  });

export const loginSchema = z.object({
  email: z.string()
    .email("Invalid email format")
    .max(255, "Email exceeds maximum length"),
  password: z.string()
    .min(1, "Password is required")
    .max(100, "Password exceeds maximum length"),
});

export const settingsSchema = z.object({
  aiTone: z.enum(["professional", "casual", "urgent"]).optional(),
  defaultChartType: z.enum(["bar", "line", "pie"]).optional(),
  themePreference: z.enum(["light", "dark"]).optional(),
});

export const attachmentSchema = z.object({
  name: z.string()
    .min(1)
    .max(255)
    .refine(
      (name) => !name.includes(".."),
      "Invalid filename: contains path traversal characters"
    ),
  path: z.string()
    .min(1)
    .max(500),
  size: z.number()
    .min(0)
    .max(25 * 1024 * 1024)
    .optional(),
  type: z.string()
    .regex(/^[a-z]+\/[a-z0-9-+.]+$/, "Invalid MIME type")
    .optional(),
});

// Bulk email schema
export const bulkEmailSchema = z.object({
  recipients: z.array(z.string().email("Invalid email format"))
    .min(1, "At least one recipient is required")
    .max(100, "Maximum 100 recipients per batch"),
  subject: z.string()
    .min(1, "Subject is required")
    .max(200, "Subject exceeds maximum length"),
  content: emailContentSchema,
  scheduleDate: z.string()
    .optional()
    .refine(
      (date) => !date || !isNaN(Date.parse(date)),
      "Invalid date format"
    ),
});