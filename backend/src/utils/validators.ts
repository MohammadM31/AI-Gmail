import { z } from "zod";

export const emailCreateSchema = z.object({
  recipients: z
    .array(z.object({ name: z.string(), email: z.string().email().nullable() }))
    .min(1, "At least one valid recipient is required"), // ✅ Enforce at least 1 recipient
  subject: z.string().min(1),
  content: z.string().min(1),
  bulletPoints: z.array(z.string()), // ✅ Removed min(1) - can be empty for very short emails
  chartData: z
    .object({
      type: z.string(), // ✅ Allow any chart type (bar, line, pie, doughnut, radar, polarArea, scatter, bubble)
      title: z.string(),
      labels: z.array(z.string()),
      values: z.array(z.number()),
    })
    .nullable()
    .optional(),
  threadId: z.string().nullable().optional(),
  attachments: z
    .array(
      z.object({
        name: z.string().min(1),
        path: z.string().min(1),
        size: z.number().optional(),
        type: z.string().optional(),
      })
    )
    .optional(),
});

export const contactSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  organization: z.string().optional(),
});

export const templateSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  prompt: z.string().min(1),
  chartConfig: z.record(z.any()).nullable().optional(),
  isPublic: z.boolean().optional(),
  recipientId: z.string().nullable().optional(),
  scheduleDate: z.string().nullable().optional(),
  autoSend: z.boolean().optional(),
});

export const registerSchema = z
  .object({
    email: z.string().email(),
    password: z.string().min(8, "Password must be at least 8 characters"),
    name: z.string().min(1),
    organizationName: z.string().min(1).optional(),
    inviteCode: z.string().min(1).optional(),
  })
  .refine((data) => Boolean(data.organizationName) !== Boolean(data.inviteCode), {
    message:
      "Provide either an organization name (to create one) or an invite code (to join one) — not both",
    path: ["organizationName"],
  });

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const settingsSchema = z.object({
  aiTone: z.enum(["professional", "casual", "urgent"]).optional(),
  defaultChartType: z.enum(["bar", "line", "pie"]).optional(),
  themePreference: z.enum(["light", "dark"]).optional(),
});

export const attachmentSchema = z.object({
  name: z.string().min(1),
  path: z.string().min(1),
  size: z.number().optional(),
  type: z.string().optional(),
});