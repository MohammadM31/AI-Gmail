// backend/src/controllers/aiController.ts
import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { processMessageWithAI } from "../services/geminiService";
import { resolveRecipients } from "../services/recipientResolver";
import { supabase } from "../utils/supabaseClient";
import { trackEvent } from "../services/analyticsService";
import { logAudit } from "../services/auditService";
import { 
  ApiError, 
  ValidationError, 
  ServiceUnavailableError,
  RateLimitError 
} from "../middleware/errorHandler";
import { aiRateLimiter } from "../middleware/rateLimiter";

const processSchema = z.object({ 
  message: z.string()
    .min(1, "Message is required")
    .max(10000, "Message exceeds maximum length of 10000 characters")
});

export async function processMessage(req: Request, res: Response, next: NextFunction) {
  try {
    // Validate input
    const { message } = processSchema.parse(req.body);
    logger.debug({ userId: req.auth!.userId, messageLength: message.length }, "AI request received");

    // Check if AI service is available
    if (!process.env.GEMINI_API_KEY) {
      throw new ServiceUnavailableError("Gemini AI");
    }

    // Fetch user's contacts
    const { data: contacts, error: contactsError } = await supabase
      .from("Contact")
      .select("name")
      .eq("userId", req.auth!.userId);

    if (contactsError) {
      logger.warn({ error: contactsError }, "Failed to fetch contacts, continuing without validation");
    }

    const contactNames = (contacts ?? []).map((c) => c.name);
    logger.debug({ contactCount: contactNames.length }, "User contacts fetched");

    // Process with AI
    let result;
    try {
      result = await processMessageWithAI(message, contactNames);
    } catch (aiError) {
      logger.error({ error: aiError, userId: req.auth!.userId }, "Gemini AI processing failed");
      throw new ServiceUnavailableError("Gemini AI");
    }

    // Log successful processing
    logger.info({ 
      userId: req.auth!.userId,
      recipientCount: result.recipients.length,
      hasChart: !!result.chart,
      tone: result.tone
    }, "AI processing successful");

    // Track analytics
    await trackEvent(req.auth!.userId, "ai_call");

    // Log audit
    await logAudit({
      userId: req.auth!.userId,
      action: "ai_process",
      aiInput: message,
      aiOutput: result,
      req,
    });

    // If no valid recipients, return early with warning
    if (result.recipients.length === 0) {
      return res.json({
        ...result,
        recipients: [],
        _warning: "No valid recipients found. Please add a contact or try again."
      });
    }

    // Resolve recipients (this validates they exist in user's contacts)
    const recipients = await resolveRecipients(req.auth!.userId, result.recipients);
    logger.debug({ resolvedCount: recipients.length }, "Recipients resolved");

    res.json({ ...result, recipients });
  } catch (err) {
    // Let the error handler middleware handle it
    next(err);
  }
}

export async function generateChart(req: Request, res: Response, next: NextFunction) {
  try {
    const { message } = processSchema.parse(req.body);
    const result = await processMessageWithAI(
      `Extract only chart-worthy numeric/trend data from this text as chart JSON:\n${message}`,
      []
    );
    res.json(result.chart);
  } catch (err) {
    next(err);
  }
}

export async function suggestRecipients(req: Request, res: Response, next: NextFunction) {
  try {
    const q = String(req.query.q ?? req.body?.q ?? "");
    if (q.length < 1) {
      return res.json([]);
    }

    const { data, error } = await supabase
      .from("Contact")
      .select("*")
      .eq("userId", req.auth!.userId)
      .ilike("name", `%${q}%`)
      .order("usageCount", { ascending: false })
      .limit(5);

    if (error) {
      throw new ApiError(500, error.message);
    }
    res.json(data ?? []);
  } catch (err) {
    next(err);
  }
}

export async function analyzeTopics(req: Request, res: Response, next: NextFunction) {
  try {
    const { messages } = z.object({ 
      messages: z.array(z.string()).max(50, "Maximum 50 messages allowed") 
    }).parse(req.body);

    const result = await processMessageWithAI(
      `Identify the 3-5 most frequent topics across these messages, as short bullet points:\n${messages.join("\n")}`,
      []
    );
    res.json({ topics: result.bulletPoints });
  } catch (err) {
    next(err);
  }
}

// Test endpoint with rate limiting
export async function testGenerate(req: Request, res: Response, next: NextFunction) {
  try {
    const { message } = z.object({ 
      message: z.string().min(1, "Message is required").max(5000) 
    }).parse(req.body);

    const result = await processMessageWithAI(message, []);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}