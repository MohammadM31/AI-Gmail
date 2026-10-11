// backend/src/services/emailClassifierService.ts
import { supabase } from "../utils/supabaseClient";
import { logger } from "../utils/logger";
import { generateStructuredAI } from "./geminiService";
import { getOrCreateCurrentSprint } from "./sprintService";

let isRunning = false;

interface ClassifierResult {
  decision: "CONTINUED" | "QUEUED" | "IGNORED";
  matchedRequirementId: string | null;
  reason: string;
  confidence: number;
}

interface EmailRow {
  id: string;
  senderId: string;
  threadId: string | null;
  subject: string;
  content: string;
  createdAt: string;
}

interface RequirementRow {
  id: string;
  request: string;
  details: unknown; // jsonb
  category: string;
  status: string;
}

/**
 * Main cron entry point.
 * 1. Find all UNANALYZED emails whose sender is a CLIENT.
 * 2. For each, fetch thread context + open requirements in that thread.
 * 3. Ask Gemini to classify.
 * 4. Update the Email row.
 */
export async function classifyPendingEmails(): Promise<void> {
  if (isRunning) {
    logger.debug("Email classifier already running, skipping");
    return;
  }
  isRunning = true;
  try {
    await runClassifier();
  } catch (err) {
    logger.error({ err }, "Email classifier failed");
  } finally {
    isRunning = false;
  }
}

async function runClassifier(): Promise<void> {
  // Step 1: fetch unanalyzed emails from CLIENT senders
  const { data: emails, error } = await supabase
    .from("Email")
    .select("id, senderId, threadId, subject, content, createdAt, sender:User!senderId(id, role, organizationId)")
    .eq("classification", "UNANALYZED")
    .is("deletedAt", null)
    .order("createdAt", { ascending: true })
    .limit(50);

  if (error) {
    logger.warn({ error: error.message }, "Failed to fetch unanalyzed emails");
    return;
  }

  const clientEmails = (emails ?? []).filter(
    (e: any) => e.sender?.role === "CLIENT"
  );

  if (clientEmails.length === 0) {
    logger.debug("No unanalyzed client emails");
    return;
  }

  logger.info({ count: clientEmails.length }, "Classifying emails");

  for (const email of clientEmails) {
    try {
      await classifyOne(email as EmailRow, (email as any).sender.organizationId);
    } catch (err) {
      logger.warn({ err, emailId: email.id }, "Failed to classify email");
    }
  }
}

async function classifyOne(email: EmailRow, organizationId: string): Promise<void> {
  // No thread → nothing to correlate against → queue it
  if (!email.threadId) {
    await markQueued(email.id, organizationId);
    return;
  }

  // Fetch recent thread context (last 10 messages)
  const { data: context } = await supabase
    .from("Email")
    .select("id, senderId, content, createdAt, sender:User!senderId(name, role)")
    .eq("threadId", email.threadId)
    .is("deletedAt", null)
    .order("createdAt", { ascending: true })
    .limit(10);

  // Fetch open requirements attached to this thread
  const { data: openReqs } = await supabase
    .from("Requirement")
    .select("id, request, details, category, status")
    .eq("threadId", email.threadId)
    .in("status", ["OPEN", "CLARIFICATION_NEEDED", "READY_FOR_PROPOSAL", "IN_PROGRESS"])
    .order("lastMessageAt", { ascending: false })
    .limit(10);

  const reqs = (openReqs ?? []) as RequirementRow[];

  // Build the prompt
  const prompt = buildClassifierPrompt(email, context ?? [], reqs);

  let result: ClassifierResult;
  try {
    result = await generateStructuredAI<ClassifierResult>(prompt);
  } catch (err) {
    logger.warn({ err, emailId: email.id }, "Classifier AI call failed; defaulting to QUEUED");
    await markQueued(email.id, organizationId);
    return;
  }

  // Validate AI output
  if (!result || !["CONTINUED", "QUEUED", "IGNORED"].includes(result.decision)) {
    await markQueued(email.id, organizationId);
    return;
  }

  // Apply the decision
  if (result.decision === "CONTINUED" && result.matchedRequirementId) {
    // Verify the AI didn't hallucinate an ID
    const match = reqs.find((r) => r.id === result.matchedRequirementId);
    if (match) {
      await markContinued(email.id, match.id);
      return;
    }
    // Fall through to queue if the ID doesn't match
  }

  if (result.decision === "IGNORED") {
    await markIgnored(email.id);
    return;
  }

  await markQueued(email.id, organizationId);
}

function buildClassifierPrompt(
  email: EmailRow,
  context: any[],
  openRequirements: RequirementRow[]
): string {
  const contextText = context
    .map((m) => {
      const who = m.sender?.role === "CLIENT" ? "CLIENT" : "ADMIN";
      return `[${who}] ${m.content}`;
    })
    .join("\n");

  const reqText =
    openRequirements.length === 0
      ? "No open requirements for this thread."
      : openRequirements
          .map(
            (r) =>
              `ID: ${r.id}\nRequest: ${r.request}\nCategory: ${r.category}\nDetails: ${JSON.stringify(r.details)}`
          )
          .join("\n\n");

  return `You are classifying a new client message in a support/requirements thread.

Given:
1. The recent conversation context (client and admin messages)
2. The list of currently-open requirements for this thread

Decide which bucket the NEW message belongs to:

- "CONTINUED" — the message is expanding on, correcting, or clarifying an ALREADY-KNOWN requirement. Set matchedRequirementId to that requirement's ID.
- "QUEUED" — the message contains a NEW request, feature, or change that is not already captured in any open requirement.
- "IGNORED" — the message is small talk, greetings, thanks, or contains no actionable request.

Rules:
- If the message relates to a requirement, prefer CONTINUED over QUEUED.
- If you cannot confidently match a requirement, choose QUEUED.
- Never invent a requirement ID.
- Ignore anything not from the CLIENT — admin messages are context only.

CONVERSATION CONTEXT:
${contextText}

OPEN REQUIREMENTS FOR THIS THREAD:
${reqText}

NEW CLIENT MESSAGE TO CLASSIFY:
${email.content}

Return ONLY JSON:
{
  "decision": "CONTINUED" | "QUEUED" | "IGNORED",
  "matchedRequirementId": "<uuid or null>",
  "reason": "one short sentence",
  "confidence": 0.0
}
`;
}

async function markContinued(emailId: string, requirementId: string): Promise<void> {
  await supabase
    .from("Email")
    .update({
      classification: "CONTINUED",
      requirementId,
      classifiedAt: new Date().toISOString(),
    })
    .eq("id", emailId);

  // Bump the requirement's lastMessageAt so the dashboard shows recency
  await supabase
    .from("Requirement")
    .update({ lastMessageAt: new Date().toISOString() })
    .eq("id", requirementId);
}

async function markQueued(emailId: string, organizationId: string): Promise<void> {
  const sprint = await getOrCreateCurrentSprint(organizationId);
  await supabase
    .from("Email")
    .update({
      classification: "QUEUED",
      queuedForSprintId: sprint.id,
      classifiedAt: new Date().toISOString(),
    })
    .eq("id", emailId);
}

async function markIgnored(emailId: string): Promise<void> {
  await supabase
    .from("Email")
    .update({
      classification: "IGNORED",
      classifiedAt: new Date().toISOString(),
    })
    .eq("id", emailId);
}

/**
 * Start the classifier cron. Returns the interval handle for shutdown.
 */
export function startEmailClassifierCron(intervalMs: number = 15 * 60 * 1000): NodeJS.Timeout {
  logger.info({ intervalMs }, "Email classifier cron started");

  // Run once on boot (after a small delay so the server finishes starting)
  setTimeout(() => {
    classifyPendingEmails().catch((err) =>
      logger.error({ err }, "Initial email classification failed")
    );
  }, 10_000);

  const handle = setInterval(() => {
    classifyPendingEmails().catch((err) =>
      logger.error({ err }, "Periodic email classification failed")
    );
  }, intervalMs);

  return handle;
}