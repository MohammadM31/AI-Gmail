import { Request, Response, NextFunction } from "express";
import { supabase } from "../utils/supabaseClient";
import { ApiError } from "../middleware/errorHandler";
import { getUsageSummary } from "../services/analyticsService";
import { processMessageWithAI } from "../services/geminiService";

export async function usage(req: Request, res: Response, next: NextFunction) {
  try {
    const { dateFrom, dateTo } = req.query as {
      dateFrom?: string;
      dateTo?: string;
    };

    let summary = await getUsageSummary(req.auth!.userId);

    // Filter by date range if provided
    if (dateFrom || dateTo) {
      summary.recent = summary.recent.filter((event) => {
        const eventDate = new Date(event.timestamp);
        if (dateFrom && eventDate < new Date(dateFrom)) return false;
        if (dateTo && eventDate > new Date(dateTo)) return false;
        return true;
      });

      // Recalculate counts based on filtered data
      const counts: Record<string, number> = {};
      for (const row of summary.recent) {
        counts[row.eventType] = (counts[row.eventType] ?? 0) + 1;
      }
      summary.counts = counts;
    }

    res.json(summary);
  } catch (err) {
    next(err);
  }
}

export async function topics(req: Request, res: Response, next: NextFunction) {
  try {
    const {
      contactId,
      startDate,
      endDate,
      limit = "5",
    } = req.query as {
      contactId?: string;
      startDate?: string;
      endDate?: string;
      limit?: string;
    };

    // Build query for emails
    let query = supabase
      .from("Email")
      .select("subject, content, recipients")
      .eq("senderId", req.auth!.userId)
      .eq("status", "sent");

    // Filter by contact
    if (contactId) {
      // First get the contact name
      const { data: contact, error: contactError } = await supabase
        .from("Contact")
        .select("name")
        .eq("id", contactId)
        .eq("userId", req.auth!.userId)
        .single();

      if (contactError || !contact) {
        throw new ApiError(404, "Contact not found");
      }

      // Filter emails where recipient contains the contact name
      query = query.contains("recipients", [{ name: contact.name }]);
    }

    // Filter by date range
    if (startDate) {
      query = query.gte("createdAt", new Date(startDate).toISOString());
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      query = query.lte("createdAt", end.toISOString());
    }

    // Get emails
    const { data: emails, error: emailsError } = await query.order("createdAt", { ascending: false }).limit(50);

    if (emailsError) throw new ApiError(500, emailsError.message);

    if (!emails || emails.length === 0) {
      return res.json({
        topics: [],
        totalEmails: 0,
        filters: { contactId, startDate, endDate },
      });
    }

    // Combine subjects and content for analysis
    const subjects = emails.map((e) => e.subject).join("\n");

    // Use Gemini to identify topics
    const result = await processMessageWithAI(
      `From these email subjects, identify the ${limit} most frequent topics as short bullet points (1-2 words each). 
      Return ONLY the topics, no explanations.
      Email subjects:
      ${subjects}`,
      []
    );

    // Count how many emails relate to each topic
    const topicCounts: Record<string, number> = {};
    for (const topic of result.bulletPoints) {
      const count = emails.filter((e) =>
        e.subject.toLowerCase().includes(topic.toLowerCase())
      ).length;
      topicCounts[topic] = count;
    }

    // Sort topics by count
    const sortedTopics = Object.entries(topicCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([topic, count]) => ({ topic, count }));

    res.json({
      topics: sortedTopics.slice(0, Number(limit)),
      totalEmails: emails.length,
      filters: { contactId, startDate, endDate },
    });
  } catch (err) {
    next(err);
  }
}

export async function topicTrends(req: Request, res: Response, next: NextFunction) {
  try {
    const { contactId, months = "6" } = req.query as {
      contactId?: string;
      months?: string;
    };

    const numMonths = Number(months);
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - numMonths);

    // Build query
    let query = supabase
      .from("Email")
      .select("subject, createdAt")
      .eq("senderId", req.auth!.userId)
      .eq("status", "sent")
      .gte("createdAt", startDate.toISOString());

    if (contactId) {
      const { data: contact, error: contactError } = await supabase
        .from("Contact")
        .select("name")
        .eq("id", contactId)
        .eq("userId", req.auth!.userId)
        .single();

      if (contactError || !contact) {
        throw new ApiError(404, "Contact not found");
      }

      query = query.contains("recipients", [{ name: contact.name }]);
    }

    const { data: emails, error } = await query.order("createdAt", { ascending: true });

    if (error) throw new ApiError(500, error.message);

    if (!emails || emails.length === 0) {
      return res.json({
        trends: [],
        labels: [],
      });
    }

    // Group emails by month
    const grouped: Record<string, number> = {};
    for (const email of emails) {
      const date = new Date(email.createdAt);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      grouped[key] = (grouped[key] || 0) + 1;
    }

    const labels = Object.keys(grouped).sort();
    const data = labels.map((label) => grouped[label]);

    res.json({
      labels,
      data,
      total: emails.length,
    });
  } catch (err) {
    next(err);
  }
}

export async function exportCsv(req: Request, res: Response, next: NextFunction) {
  try {
    const { startDate, endDate } = req.query as {
      startDate?: string;
      endDate?: string;
    };

    // Get all emails for export
    let query = supabase
      .from("Email")
      .select("id, subject, recipients, status, createdAt, sentAt, bulletPoints")
      .eq("senderId", req.auth!.userId);

    if (startDate) {
      query = query.gte("createdAt", new Date(startDate).toISOString());
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      query = query.lte("createdAt", end.toISOString());
    }

    const { data: emails, error } = await query.order("createdAt", { ascending: false });

    if (error) throw new ApiError(500, error.message);

    // Also get analytics events
    let analyticsQuery = supabase
      .from("Analytics")
      .select("eventType, timestamp, metadata")
      .eq("userId", req.auth!.userId);

    if (startDate) {
      analyticsQuery = analyticsQuery.gte("timestamp", new Date(startDate).toISOString());
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      analyticsQuery = analyticsQuery.lte("timestamp", end.toISOString());
    }

    const { data: analytics, error: analyticsError } = await analyticsQuery.order("timestamp", { ascending: false });

    if (analyticsError) throw new ApiError(500, analyticsError.message);

    // Build CSV
    const rows: string[][] = [];
    const headers = [
      "Type",
      "Subject/Event",
      "Recipients",
      "Status",
      "Date",
      "Bullet Points",
    ];
    rows.push(headers);

    // Add emails
    for (const email of (emails ?? [])) {
      rows.push([
        "Email",
        email.subject || "",
        email.recipients?.map((r: any) => r.name).join(", ") || "",
        email.status || "",
        new Date(email.createdAt).toISOString().split("T")[0],
        email.bulletPoints?.join("; ") || "",
      ]);
    }

    // Add analytics
    for (const event of (analytics ?? [])) {
      rows.push([
        "Analytics",
        event.eventType || "",
        "",
        "",
        new Date(event.timestamp).toISOString().split("T")[0],
        "",
      ]);
    }

    // Generate CSV string
    const csvContent = rows.map((row) => row.join(",")).join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename=analytics_${new Date().toISOString().split("T")[0]}.csv`);
    res.send(csvContent);
  } catch (err) {
    next(err);
  }
}