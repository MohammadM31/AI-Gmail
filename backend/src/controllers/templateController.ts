import { Request, Response, NextFunction } from "express";
import { supabase } from "../utils/supabaseClient";
import { ApiError } from "../middleware/errorHandler";
import { templateSchema } from "../utils/validators";
import { createEmail, sendEmail } from "./emailController";
import { randomUUID } from "crypto";

// Helper to get the actual emailController functions without circular dependency
// We'll use supabase directly for sending scheduled templates

export async function listTemplates(req: Request, res: Response, next: NextFunction) {
  try {
    const { data, error } = await supabase
      .from("Template")
      .select("*")
      .or(`userId.eq.${req.auth!.userId},isPublic.eq.true`)
      .order("usageCount", { ascending: false });
    if (error) throw new ApiError(500, error.message);
    res.json(data ?? []);
  } catch (err) {
    next(err);
  }
}

export async function createTemplate(req: Request, res: Response, next: NextFunction) {
  try {
    const input = templateSchema.parse(req.body);
    
    // Validate recipient if provided
    if (input.recipientId) {
      const { data: contact, error: contactError } = await supabase
        .from("Contact")
        .select("id")
        .eq("id", input.recipientId)
        .eq("userId", req.auth!.userId)
        .single();
      
      if (contactError || !contact) {
        throw new ApiError(404, "Recipient contact not found");
      }
    }

    // Validate schedule date if provided
    let isScheduled = false;
    if (input.scheduleDate) {
      const scheduleDate = new Date(input.scheduleDate);
      if (scheduleDate < new Date()) {
        throw new ApiError(400, "Schedule date must be in the future");
      }
      isScheduled = true;
    }

    const { data, error } = await supabase
      .from("Template")
      .insert({
        ...input,
        userId: req.auth!.userId,
        isScheduled,
        autoSend: input.autoSend ?? false,
        usageCount: 0,
      })
      .select()
      .single();
    
    if (error) throw new ApiError(500, error.message);
    res.status(201).json(data);
  } catch (err) {
    next(err);
  }
}

export async function updateTemplate(req: Request, res: Response, next: NextFunction) {
  try {
    const input = templateSchema.parse(req.body);
    
    // Validate recipient if provided
    if (input.recipientId) {
      const { data: contact, error: contactError } = await supabase
        .from("Contact")
        .select("id")
        .eq("id", input.recipientId)
        .eq("userId", req.auth!.userId)
        .single();
      
      if (contactError || !contact) {
        throw new ApiError(404, "Recipient contact not found");
      }
    }

    // Update isScheduled based on scheduleDate
    let isScheduled = false;
    if (input.scheduleDate) {
      const scheduleDate = new Date(input.scheduleDate);
      if (scheduleDate < new Date()) {
        throw new ApiError(400, "Schedule date must be in the future");
      }
      isScheduled = true;
    }

    const { data, error } = await supabase
      .from("Template")
      .update({
        ...input,
        isScheduled,
        autoSend: input.autoSend ?? false,
      })
      .eq("id", req.params.id)
      .eq("userId", req.auth!.userId)
      .select()
      .single();
    
    if (error || !data) throw new ApiError(404, "Template not found");
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function deleteTemplate(req: Request, res: Response, next: NextFunction) {
  try {
    const { error } = await supabase
      .from("Template")
      .delete()
      .eq("id", req.params.id)
      .eq("userId", req.auth!.userId);
    if (error) throw new ApiError(500, error.message);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function getTemplate(req: Request, res: Response, next: NextFunction) {
  try {
    const { data, error } = await supabase
      .from("Template")
      .select("*")
      .eq("id", req.params.id)
      .eq("userId", req.auth!.userId)
      .single();
    if (error || !data) throw new ApiError(404, "Template not found");
    res.json(data);
  } catch (err) {
    next(err);
  }
}

// ✅ NEW: Send scheduled templates
export async function sendScheduledTemplates(req: Request, res: Response, next: NextFunction) {
  try {
    // Find templates that are due for sending
    const now = new Date();
    const { data: templates, error } = await supabase
      .from("Template")
      .select("*, Contact!recipientId(name, email)")
      .eq("autoSend", true)
      .eq("isScheduled", true)
      .lte("scheduleDate", now.toISOString())
      .is("lastSentAt", null);

    if (error) throw new ApiError(500, error.message);

    const results = [];
    for (const template of (templates ?? [])) {
      try {
        // Resolve the prompt with contact name
        const contactName = template.Contact?.name || "Recipient";
        const resolvedPrompt = template.prompt.replace(/{contact}/g, contactName);

        // Create and send email
        const emailId = randomUUID();
        const threadId = emailId;

        const { error: insertError } = await supabase
          .from("Email")
          .insert({
            id: emailId,
            senderId: template.userId,
            recipients: [{ name: template.Contact?.name || "Recipient", email: template.Contact?.email || null }],
            subject: `Automated: ${template.name}`,
            content: resolvedPrompt,
            bulletPoints: ["This email was sent automatically from a template."],
            chartData: null,
            attachments: [],
            status: "sent",
            threadId,
            sentAt: now.toISOString(),
          });

        if (insertError) {
          console.error("Failed to send scheduled template:", template.id, insertError);
          results.push({ id: template.id, success: false, error: insertError.message });
          continue;
        }

        // Mark template as sent
        await supabase
          .from("Template")
          .update({ 
            lastSentAt: now.toISOString(),
            usageCount: (template.usageCount || 0) + 1
          })
          .eq("id", template.id);

        results.push({ id: template.id, success: true });
      } catch (err) {
        console.error("Failed to process template:", template.id, err);
        results.push({ id: template.id, success: false, error: (err as Error).message });
      }
    }

    res.json({
      processed: results.length,
      results,
    });
  } catch (err) {
    next(err);
  }
}

// ✅ NEW: Manually trigger a template send
export async function sendTemplateNow(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;

    const { data: template, error } = await supabase
      .from("Template")
      .select("*, Contact!recipientId(name, email)")
      .eq("id", id)
      .eq("userId", req.auth!.userId)
      .single();

    if (error || !template) throw new ApiError(404, "Template not found");
    if (!template.recipientId || !template.Contact) {
      throw new ApiError(400, "Template has no recipient set");
    }

    // Resolve the prompt
    const contactName = template.Contact.name;
    const resolvedPrompt = template.prompt.replace(/{contact}/g, contactName);

    // Create email
    const emailId = randomUUID();
    const threadId = emailId;

    const { error: insertError } = await supabase
      .from("Email")
      .insert({
        id: emailId,
        senderId: req.auth!.userId,
        recipients: [{ name: contactName, email: template.Contact.email || null }],
        subject: `Manual: ${template.name}`,
        content: resolvedPrompt,
        bulletPoints: ["This email was sent manually from a template."],
        chartData: null,
        attachments: [],
        status: "sent",
        threadId,
        sentAt: new Date().toISOString(),
      });

    if (insertError) throw new ApiError(500, insertError.message);

    // Increment usage
    await supabase
      .from("Template")
      .update({ usageCount: (template.usageCount || 0) + 1 })
      .eq("id", id);

    res.json({ success: true, emailId });
  } catch (err) {
    next(err);
  }
}