import { Request, Response, NextFunction } from "express";
import { supabase } from "../utils/supabaseClient";
import { ApiError } from "../middleware/errorHandler";
import { emailCreateSchema } from "../utils/validators";
import { createEmail, decryptEmailContent } from "../services/emailProcessor";
import { trackEvent } from "../services/analyticsService";
import { logAudit } from "../services/auditService";
import { processMessageWithAI } from "../services/geminiService";
import { getIo } from "../realtime/socket";

export async function listEmails(req: Request, res: Response, next: NextFunction) {
  try {
    const { page = "1", pageSize = "20", q } = req.query as Record<string, string>;
    const from = (Number(page) - 1) * Number(pageSize);
    const to = from + Number(pageSize) - 1;

    let query = supabase
      .from("Email")
      .select("*", { count: "exact" })
      .eq("senderId", req.auth!.userId)
      .is("deletedAt", null)
      .order("createdAt", { ascending: false })
      .range(from, to);

    if (q) {
      query = query.textSearch("subject", q, { type: "websearch" });
    }

    const { data, error, count } = await query;
    if (error) throw new ApiError(500, error.message);

    res.json({ items: (data ?? []).map(decryptEmailContent), total: count ?? 0 });
  } catch (err) {
    next(err);
  }
}

export async function getEmail(req: Request, res: Response, next: NextFunction) {
  try {
    const { data, error } = await supabase
      .from("Email")
      .select("*")
      .eq("id", req.params.id)
      .eq("senderId", req.auth!.userId)
      .single();
    if (error || !data) throw new ApiError(404, "Email not found");
    res.json(decryptEmailContent(data));
  } catch (err) {
    next(err);
  }
}

export async function createEmailHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const input = emailCreateSchema.parse(req.body);
    const email = await createEmail({ senderId: req.auth!.userId, ...input });
    if (input.chartData) await trackEvent(req.auth!.userId, "chart_generated");
    res.status(201).json(email);
  } catch (err) {
    next(err);
  }
}

export async function updateEmail(req: Request, res: Response, next: NextFunction) {
  try {
    const { data, error } = await supabase
      .from("Email")
      .update({ ...req.body, status: "edited" })
      .eq("id", req.params.id)
      .eq("senderId", req.auth!.userId)
      .select()
      .single();
    if (error || !data) throw new ApiError(404, "Email not found");
    res.json(decryptEmailContent(data));
  } catch (err) {
    next(err);
  }
}

export async function deleteEmail(req: Request, res: Response, next: NextFunction) {
  try {
    const { error } = await supabase
      .from("Email")
      .update({ status: "deleted", deletedAt: new Date().toISOString() })
      .eq("id", req.params.id)
      .eq("senderId", req.auth!.userId);
    if (error) throw new ApiError(500, error.message);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function sendEmail(req: Request, res: Response, next: NextFunction) {
  try {
    const { data, error } = await supabase
      .from("Email")
      .update({ status: "sent", sentAt: new Date().toISOString() })
      .eq("id", req.params.id)
      .eq("senderId", req.auth!.userId)
      .select()
      .single();
    if (error || !data) throw new ApiError(404, "Email not found");

    await trackEvent(req.auth!.userId, "email_sent");
    await logAudit({ userId: req.auth!.userId, action: "email_sent", emailId: data.id, req });

    // Notify any connected clients in this org (e.g. recipients' inbox view).
    getIo()?.to(`org:${req.auth!.organizationId}`).emit("email:sent", { id: data.id });

    res.json(decryptEmailContent(data));
  } catch (err) {
    next(err);
  }
}

export async function getThread(req: Request, res: Response, next: NextFunction) {
  try {
    const { data, error } = await supabase
      .from("Email")
      .select("*")
      .eq("threadId", req.params.threadId)
      .order("createdAt", { ascending: true });
    if (error) throw new ApiError(500, error.message);
    res.json((data ?? []).map(decryptEmailContent));
  } catch (err) {
    next(err);
  }
}

export async function summarizeThread(req: Request, res: Response, next: NextFunction) {
  try {
    const { data, error } = await supabase
      .from("Email")
      .select("content, subject")
      .eq("threadId", req.params.threadId)
      .order("createdAt", { ascending: true });
    if (error) throw new ApiError(500, error.message);

    const decrypted = (data ?? []).map((d) => decryptEmailContent(d as any).content);
    const combined = decrypted.join("\n---\n");

    const result = await processMessageWithAI(
      `Summarize this email thread in 3-5 bullet points:\n${combined}`
    );
    res.json({ summary: result.bulletPoints });
  } catch (err) {
    next(err);
  }
}

export async function readReceipt(req: Request, res: Response, next: NextFunction) {
  try {
    const { data: existing, error: fetchErr } = await supabase
      .from("Email")
      .select("readReceipts")
      .eq("id", req.params.id)
      .single();
    if (fetchErr || !existing) throw new ApiError(404, "Email not found");

    const receipts = Array.isArray(existing.readReceipts) ? existing.readReceipts : [];
    receipts.push({ userId: req.auth!.userId, readAt: new Date().toISOString() });

    const { error } = await supabase
      .from("Email")
      .update({ readReceipts: receipts })
      .eq("id", req.params.id);
    if (error) throw new ApiError(500, error.message);

    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
