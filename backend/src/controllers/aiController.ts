import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { processMessageWithAI } from "../services/geminiService";
import { resolveRecipients } from "../services/recipientResolver";
import { supabase } from "../utils/supabaseClient";
import { trackEvent } from "../services/analyticsService";
import { logAudit } from "../services/auditService";
import { ApiError } from "../middleware/errorHandler";

const processSchema = z.object({ message: z.string().min(1, "message is required") });

export async function processMessage(req: Request, res: Response, next: NextFunction) {
  try {
    console.log("🔍 AI Request received:", req.body);
    const { message } = processSchema.parse(req.body);
    console.log("📝 Message to process:", message);
    
    console.log("🤖 Calling Gemini API...");
    const result = await processMessageWithAI(message);
    console.log("✅ Gemini response received:", result);
    
    const recipients = await resolveRecipients(req.auth!.userId, result.recipients);
    console.log("👤 Resolved recipients:", recipients);

    await trackEvent(req.auth!.userId, "ai_call");
    await logAudit({
      userId: req.auth!.userId,
      action: "ai_process",
      aiInput: message,
      aiOutput: result,
      req,
    });

    res.json({ ...result, recipients });
  } catch (err) {
    console.error("❌❌❌ AI PROCESSING ERROR ❌❌❌");
    console.error("Error:", err);
    if (err instanceof Error) {
      console.error("Message:", err.message);
      console.error("Stack:", err.stack);
    }
    next(err);
  }
}

export async function generateChart(req: Request, res: Response, next: NextFunction) {
  try {
    const { message } = processSchema.parse(req.body);
    const result = await processMessageWithAI(
      `Extract only chart-worthy numeric/trend data from this text as chart JSON:\n${message}`
    );
    res.json(result.chart);
  } catch (err) {
    next(err);
  }
}

export async function suggestRecipients(req: Request, res: Response, next: NextFunction) {
  try {
    const q = String(req.query.q ?? req.body?.q ?? "");
    const { data, error } = await supabase
      .from("Contact")
      .select("*")
      .eq("userId", req.auth!.userId)
      .ilike("name", `%${q}%`)
      .order("usageCount", { ascending: false })
      .limit(5);
    if (error) throw new ApiError(500, error.message);
    res.json(data ?? []);
  } catch (err) {
    next(err);
  }
}

export async function analyzeTopics(req: Request, res: Response, next: NextFunction) {
  try {
    const { messages } = z.object({ messages: z.array(z.string()) }).parse(req.body);
    const result = await processMessageWithAI(
      `Identify the 3-5 most frequent topics across these messages, as short bullet points:\n${messages.join(
        "\n"
      )}`
    );
    res.json({ topics: result.bulletPoints });
  } catch (err) {
    next(err);
  }
}

// ✅ TEST ENDPOINT - No auth required
export async function testGenerate(req: Request, res: Response) {
  try {
    const { message } = req.body;
    console.log("🧪 Test AI called with:", message);
    
    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }
    
    // Call Gemini directly
    const result = await processMessageWithAI(message);
    
    res.json({
      success: true,
      data: result
    });
  } catch (err) {
    console.error("❌ Test AI error:", err);
    res.status(500).json({
      error: err instanceof Error ? err.message : "Unknown error"
    });
  }
}