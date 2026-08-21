import { Request, Response, NextFunction } from "express";
import { supabase } from "../utils/supabaseClient";
import { ApiError } from "../middleware/errorHandler";
import { contactSchema } from "../utils/validators";
import { processMessageWithAI } from "../services/geminiService";
import { decryptEmailContent } from "../services/emailProcessor";

export async function listContacts(req: Request, res: Response, next: NextFunction) {
  try {
    const { data, error } = await supabase
      .from("Contact")
      .select("*")
      .eq("userId", req.auth!.userId)
      .order("usageCount", { ascending: false });
    if (error) throw new ApiError(500, error.message);
    res.json(data ?? []);
  } catch (err) {
    next(err);
  }
}

export async function searchContacts(req: Request, res: Response, next: NextFunction) {
  try {
    const q = String(req.query.q ?? "");
    const { data, error } = await supabase
      .from("Contact")
      .select("*")
      .eq("userId", req.auth!.userId)
      .or(`name.ilike.%${q}%,email.ilike.%${q}%`)
      .order("usageCount", { ascending: false })
      .limit(10);
    if (error) throw new ApiError(500, error.message);
    res.json(data ?? []);
  } catch (err) {
    next(err);
  }
}

export async function createContact(req: Request, res: Response, next: NextFunction) {
  try {
    const input = contactSchema.parse(req.body);
    const { data, error } = await supabase
      .from("Contact")
      .insert({ ...input, userId: req.auth!.userId })
      .select()
      .single();
    if (error) {
      if (error.code === "23505") {
        throw new ApiError(409, "A contact with this email already exists");
      }
      throw new ApiError(500, error.message);
    }
    res.status(201).json(data);
  } catch (err) {
    next(err);
  }
}

export async function updateContact(req: Request, res: Response, next: NextFunction) {
  try {
    const { data, error } = await supabase
      .from("Contact")
      .update(req.body)
      .eq("id", req.params.id)
      .eq("userId", req.auth!.userId)
      .select()
      .single();
    if (error || !data) throw new ApiError(404, "Contact not found");
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function deleteContact(req: Request, res: Response, next: NextFunction) {
  try {
    const { error } = await supabase
      .from("Contact")
      .delete()
      .eq("id", req.params.id)
      .eq("userId", req.auth!.userId);
    if (error) throw new ApiError(500, error.message);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function getContactById(req: Request, res: Response, next: NextFunction) {
  try {
    const { data, error } = await supabase
      .from("Contact")
      .select("*")
      .eq("id", req.params.id)
      .eq("userId", req.auth!.userId)
      .single();
    if (error || !data) throw new ApiError(404, "Contact not found");
    res.json(data);
  } catch (err) {
    next(err);
  }
}

// ✅ NEW: Get thread summary between user and contact
export async function getContactSummary(req: Request, res: Response, next: NextFunction) {
  try {
    const { contactId } = req.params;
    const userId = req.auth!.userId;

    // Verify contact belongs to user
    const { data: contact, error: contactError } = await supabase
      .from("Contact")
      .select("name")
      .eq("id", contactId)
      .eq("userId", userId)
      .single();
    
    if (contactError || !contact) {
      throw new ApiError(404, "Contact not found");
    }

    // Fetch all emails between user and this contact
    // We need to find emails where:
    // - senderId is the user AND recipients contain the contact
    // - OR senderId is the contact (if we had sender info, but we don't)
    // For now, we'll find emails where the user is sender and contact is in recipients
    const { data: emails, error: emailsError } = await supabase
      .from("Email")
      .select("*")
      .eq("senderId", userId)
      .contains("recipients", [{ name: contact.name }])
      .order("createdAt", { ascending: true });

    if (emailsError) throw new ApiError(500, emailsError.message);

    if (!emails || emails.length === 0) {
      return res.json({ 
        contact: contact.name,
        summary: ["No conversation history with this contact yet."],
        emailCount: 0
      });
    }

    // Decrypt email content
    const decryptedEmails = emails.map((e) => decryptEmailContent(e));

    // Build conversation text for summarization
    const conversationText = decryptedEmails
      .map((e) => `Subject: ${e.subject}\nContent: ${e.content}\n---`)
      .join("\n");

    // Generate summary using Gemini
    const result = await processMessageWithAI(
      `Summarize the entire email conversation between the user and ${contact.name} in 3-5 bullet points. 
      Focus on the main topics discussed, decisions made, and key action items.
      
      Conversation history:
      ${conversationText}`,
      []
    );

    // Also extract email previews for conversation history
    const emailPreviews = decryptedEmails.map((e) => ({
      id: e.id,
      subject: e.subject,
      content: e.content.substring(0, 150) + (e.content.length > 150 ? "..." : ""),
      bulletPoints: e.bulletPoints,
      createdAt: e.createdAt,
      status: e.status,
      threadId: e.threadId,
    }));

    res.json({
      contact: contact.name,
      summary: result.bulletPoints || ["No summary available."],
      emailCount: decryptedEmails.length,
      emails: emailPreviews,
    });
  } catch (err) {
    next(err);
  }
}

// ✅ NEW: Get all threads with a specific contact
export async function getContactThreads(req: Request, res: Response, next: NextFunction) {
  try {
    const { contactId } = req.params;
    const userId = req.auth!.userId;

    // Verify contact belongs to user
    const { data: contact, error: contactError } = await supabase
      .from("Contact")
      .select("name")
      .eq("id", contactId)
      .eq("userId", userId)
      .single();
    
    if (contactError || !contact) {
      throw new ApiError(404, "Contact not found");
    }

    // Fetch all emails where user is sender and contact is in recipients
    const { data: sentEmails, error: sentError } = await supabase
      .from("Email")
      .select("*")
      .eq("senderId", userId)
      .contains("recipients", [{ name: contact.name }])
      .order("createdAt", { ascending: false });

    if (sentError) throw new ApiError(500, sentError.message);

    // Decrypt and format
    const decrypted = (sentEmails ?? []).map((e) => decryptEmailContent(e));

    // Group by threadId
    const threads: Record<string, any[]> = {};
    decrypted.forEach((email) => {
      const threadKey = email.threadId || email.id;
      if (!threads[threadKey]) {
        threads[threadKey] = [];
      }
      threads[threadKey].push(email);
    });

    // Format response
    const formattedThreads = Object.entries(threads).map(([threadId, messages]) => ({
      threadId,
      count: messages.length,
      lastMessage: messages[messages.length - 1],
      messages: messages.map((m) => ({
        id: m.id,
        subject: m.subject,
        content: m.content.substring(0, 200) + (m.content.length > 200 ? "..." : ""),
        bulletPoints: m.bulletPoints,
        createdAt: m.createdAt,
        status: m.status,
      })),
    }));

    res.json({
      contact: contact.name,
      threads: formattedThreads,
      totalEmails: decrypted.length,
    });
  } catch (err) {
    next(err);
  }
}