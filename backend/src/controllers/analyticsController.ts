import { Request, Response, NextFunction } from "express";
import { supabase } from "../utils/supabaseClient";
import { ApiError } from "../middleware/errorHandler";
import { getUsageSummary } from "../services/analyticsService";
import { processMessageWithAI } from "../services/geminiService";

export async function usage(req: Request, res: Response, next: NextFunction) {
  try {
    const summary = await getUsageSummary(req.auth!.userId);
    res.json(summary);
  } catch (err) {
    next(err);
  }
}

export async function topics(req: Request, res: Response, next: NextFunction) {
  try {
    const { data, error } = await supabase
      .from("Email")
      .select("subject")
      .eq("senderId", req.auth!.userId)
      .order("createdAt", { ascending: false })
      .limit(50);
    if (error) throw new ApiError(500, error.message);

    const subjects = (data ?? []).map((d) => d.subject).join("\n");
    if (!subjects) return res.json({ topics: [] });

    const result = await processMessageWithAI(
      `From these email subjects, list the 3-5 most frequent topics as short bullet points:\n${subjects}`
    );
    res.json({ topics: result.bulletPoints });
  } catch (err) {
    next(err);
  }
}

export async function exportCsv(req: Request, res: Response, next: NextFunction) {
  try {
    const { recent } = await getUsageSummary(req.auth!.userId);
    const header = "eventType,timestamp\n";
    const rows = recent.map((r) => `${r.eventType},${r.timestamp}`).join("\n");
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=analytics.csv");
    res.send(header + rows);
  } catch (err) {
    next(err);
  }
}
