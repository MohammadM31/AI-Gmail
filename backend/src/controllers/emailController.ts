// backend/src/controllers/emailController.ts
import { Request, Response, NextFunction } from "express";
import { supabase } from "../utils/supabaseClient";
import { ApiError } from "../middleware/errorHandler";
import { emailCreateSchema } from "../utils/validators";
import { createEmail as createEmailService, decryptEmailContent } from "../services/emailProcessor";
import { trackEvent } from "../services/analyticsService";
import { logAudit } from "../services/auditService";
import { processMessageWithAI } from "../services/geminiService";
import { getIo } from "../realtime/socket";

// ✅ Export createEmail so templateController can import it
export { createEmailService as createEmail };

export async function listEmails(req: Request, res: Response, next: NextFunction) {
  try {
    const {
      page = "1",
      pageSize = "20",
      q,
      filterType = "all",
      status,
      dateFrom,
      dateTo,
      sortBy = "newest",
    } = req.query as Record<string, string>;

    const from = (Number(page) - 1) * Number(pageSize);
    const to = from + Number(pageSize) - 1;

    let query = supabase
      .from("Email")
      .select("*", { count: "exact" })
      .eq("senderId", req.auth!.userId)
      .is("deletedAt", null);

    // --- Search filters ---
    if (q) {
      if (filterType === "subject") {
        query = query.textSearch("subject", q, { type: "websearch" });
      } else if (filterType === "recipient") {
        // Search in recipients JSON
        query = query.filter("recipients", "cs", `[{"name":"${q}"}]`);
      } else if (filterType === "status") {
        query = query.eq("status", q);
      } else {
        // Default: search in subject
        query = query.textSearch("subject", q, { type: "websearch" });
      }
    }

    // --- Status filter ---
    if (status && status !== "all") {
      query = query.eq("status", status);
    }

    // --- Date range filter ---
    if (dateFrom) {
      query = query.gte("createdAt", new Date(dateFrom).toISOString());
    }
    if (dateTo) {
      // Set end of day for inclusive filtering
      const endDate = new Date(dateTo);
      endDate.setHours(23, 59, 59, 999);
      query = query.lte("createdAt", endDate.toISOString());
    }

    // --- Sorting ---
    switch (sortBy) {
      case "newest":
        query = query.order("createdAt", { ascending: false });
        break;
      case "oldest":
        query = query.order("createdAt", { ascending: true });
        break;
      case "subject-asc":
        query = query.order("subject", { ascending: true });
        break;
      case "subject-desc":
        query = query.order("subject", { ascending: false });
        break;
      case "status":
        query = query.order("status", { ascending: true });
        break;
      default:
        query = query.order("createdAt", { ascending: false });
    }

    // --- Pagination ---
    query = query.range(from, to);

    const { data, error, count } = await query;
    if (error) throw new ApiError(500, error.message);

    res.json({
      items: (data ?? []).map(decryptEmailContent),
      total: count ?? 0,
    });
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

    // ✅ Validate recipients exist
    if (!input.recipients || input.recipients.length === 0) {
      throw new ApiError(400, "At least one valid recipient is required to send an email.");
    }

    const { data: contacts, error: contactsError } = await supabase
      .from("Contact")
      .select("name, email")
      .eq("userId", req.auth!.userId);

    if (contactsError) {
      throw new ApiError(500, "Failed to validate recipients.");
    }

    const contactNames = contacts?.map((c) => c.name.toLowerCase()) ?? [];
    const invalidRecipients = input.recipients.filter(
      (r) => !contactNames.includes(r.name.toLowerCase())
    );

    if (invalidRecipients.length > 0) {
      throw new ApiError(
        400,
        `Invalid recipients: ${invalidRecipients.map((r) => r.name).join(", ")}. Please add them to your contacts first.`
      );
    }

    const email = await createEmailService({ senderId: req.auth!.userId, ...input });
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
      `Summarize this email thread in 3-5 bullet points:\n${combined}`,
      []
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