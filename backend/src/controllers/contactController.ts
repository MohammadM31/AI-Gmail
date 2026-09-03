// backend/src/controllers/contactController.ts
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

// ✅ FIXED: Get thread summary between user and contact
export async function getContactSummary(req: Request, res: Response, next: NextFunction) {
  try {
    const { contactId } = req.params;
    const userId = req.auth!.userId;

    console.log(`🔍 Getting summary for contact: ${contactId}, user: ${userId}`);

    // Verify contact belongs to user
    const { data: contact, error: contactError } = await supabase
      .from("Contact")
      .select("name, email")
      .eq("id", contactId)
      .eq("userId", userId)
      .single();
    
    if (contactError || !contact) {
      console.log(`❌ Contact not found: ${contactId}`, contactError);
      throw new ApiError(404, "Contact not found");
    }

    console.log(`✅ Contact found: ${contact.name}`);

    // ✅ FIX: Fetch all emails and filter in JavaScript (JSONB contains doesn't work well)
    const { data: emails, error: emailsError } = await supabase
      .from("Email")
      .select("*")
      .eq("senderId", userId)
      .order("createdAt", { ascending: true });

    if (emailsError) {
      console.log(`❌ Email query error:`, emailsError);
      throw new ApiError(500, emailsError.message);
    }

    // ✅ Filter emails that contain the contact
    const contactEmails = (emails || []).filter((email) => {
      const recipients = email.recipients || [];
      return recipients.some((r: any) => 
        r.name?.toLowerCase() === contact.name.toLowerCase()
      );
    });

    console.log(`📧 Found ${contactEmails.length} emails with ${contact.name}`);

    if (!contactEmails || contactEmails.length === 0) {
      return res.json({ 
        contact: contact.name,
        summary: ["No conversation history with this contact yet."],
        emailCount: 0,
        emails: []
      });
    }

    // Decrypt email content
    const decryptedEmails = contactEmails.map((e) => decryptEmailContent(e));

    // Build conversation text
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

    const emailPreviews = decryptedEmails.map((e) => ({
      id: e.id,
      subject: e.subject,
      content: e.content.substring(0, 150) + (e.content.length > 150 ? "..." : ""),
      bulletPoints: e.bulletPoints || [],
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
    console.error(`❌ Error in getContactSummary:`, err);
    next(err);
  }
}

// ✅ FIXED: Get all threads with a specific contact
export async function getContactThreads(req: Request, res: Response, next: NextFunction) {
  try {
    const { contactId } = req.params;
    const userId = req.auth!.userId;

    console.log(`🔍 Getting threads for contact: ${contactId}, user: ${userId}`);

    // Verify contact belongs to user
    const { data: contact, error: contactError } = await supabase
      .from("Contact")
      .select("name, email")
      .eq("id", contactId)
      .eq("userId", userId)
      .single();
    
    if (contactError || !contact) {
      console.log(`❌ Contact not found: ${contactId}`);
      throw new ApiError(404, "Contact not found");
    }

    console.log(`✅ Contact found: ${contact.name}`);

    // ✅ FIX: Fetch all emails and filter in JavaScript
    const { data: sentEmails, error: sentError } = await supabase
      .from("Email")
      .select("*")
      .eq("senderId", userId)
      .order("createdAt", { ascending: false });

    if (sentError) {
      console.log(`❌ Email query error:`, sentError);
      throw new ApiError(500, sentError.message);
    }

    // ✅ Filter emails that contain the contact
    const contactEmails = (sentEmails || []).filter((email) => {
      const recipients = email.recipients || [];
      return recipients.some((r: any) => 
        r.name?.toLowerCase() === contact.name.toLowerCase()
      );
    });

    console.log(`📧 Found ${contactEmails.length} emails with ${contact.name}`);

    // Decrypt and format
    const decrypted = contactEmails.map((e) => decryptEmailContent(e));

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
        bulletPoints: m.bulletPoints || [],
        createdAt: m.createdAt,
        status: m.status,
      })),
    }));

    console.log(`✅ Returning ${formattedThreads.length} threads`);

    res.json({
      contact: contact.name,
      threads: formattedThreads,
      totalEmails: decrypted.length,
    });
  } catch (err) {
    console.error(`❌ Error in getContactThreads:`, err);
    next(err);
  }
}