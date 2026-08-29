// backend/src/services/pipelineService.ts
import { supabase } from "../utils/supabaseClient";
import { processMessageWithAI } from "./geminiService";
import { logger } from "../utils/logger";

export interface PipelineStage {
  id: string;
  name: string;
  description: string;
  status: 'pending' | 'in-progress' | 'complete';
  order: number;
}

export interface ProjectPipeline {
  contactId: string;
  contactName: string;
  projectName: string;
  projectType: 'sales' | 'development' | 'event' | 'job' | 'general';
  stages: PipelineStage[];
}

export async function generatePipelineFromThread(
  userId: string,
  contactId: string,
  threadId: string
): Promise<ProjectPipeline> {
  try {
    // Fetch all emails in the thread
    const { data: emails, error } = await supabase
      .from("Email")
      .select("content, subject, recipients, createdAt")
      .eq("threadId", threadId)
      .order("createdAt", { ascending: true });

    if (error) throw new Error(`Failed to fetch emails: ${error.message}`);
    if (!emails || emails.length === 0) {
      throw new Error("No emails found in this thread");
    }

    // Get contact info
    const { data: contact, error: contactError } = await supabase
      .from("Contact")
      .select("name")
      .eq("id", contactId)
      .eq("userId", userId)
      .single();

    if (contactError || !contact) {
      throw new Error("Contact not found");
    }

    // Build conversation summary
    const conversation = emails
      .map((e) => `From: ${e.senderId === userId ? 'You' : contact.name}\nSubject: ${e.subject}\nContent: ${e.content}`)
      .join("\n---\n");

    // ✅ IMPROVED: AI extracts context-specific pipeline
    const result = await processMessageWithAI(
      `You are an AI that analyzes email conversations and extracts the workflow or process being discussed.

      Analyze this email conversation between the user and ${contact.name}:

      ${conversation}

      Based on the conversation, identify:
      1. What is the main topic, project, or goal being discussed? 
         (Be specific, this should be a concrete thing they're working on together)
      2. What are the actual steps or milestones in this process?
         (Extract these directly from what was discussed in the conversation)
      3. What is the current status of each step?

      IMPORTANT: 
      - The steps should be SPECIFIC to this conversation, not generic
      - If they're discussing a sales deal, show sales stages
      - If they're discussing fixing a bug, show bug-fix stages
      - If they're discussing planning an event, show event planning stages
      - Extract the actual workflow from what they talked about

      Return a JSON object with:
      {
        "projectName": "string (e.g., 'Acme Corp Sales Deal' or 'Login Bug Fix')",
        "projectType": "sales | development | event | job | general",
        "stages": [
          {
            "name": "string (actual step from conversation)",
            "description": "string (brief explanation)",
            "status": "pending | in-progress | complete"
          }
        ]
      }

      Example outputs:
      - For sales: ["Initial Contact", "Proposal Sent", "Demo Scheduled", "Negotiation", "Contract Signed"]
      - For bug fix: ["Issue Reported", "Investigating", "Fix in Progress", "Testing", "Deployed"]
      - For event: ["Date Confirmed", "Venue Booked", "Catering Arranged", "Entertainment Confirmed", "Final Checklist"]
      - For job: ["Application Submitted", "Phone Screen", "Technical Interview", "On-site Interview", "Offer Decision"]

      Only return valid JSON, no other text.`,
      []
    );

    // Parse the AI response
    let pipelineData;
    try {
      // Clean the response to ensure valid JSON
      const cleanedText = result.bulletPoints.join(' ').replace(/```json/g, '').replace(/```/g, '').trim();
      pipelineData = JSON.parse(cleanedText);
    } catch (parseError) {
      // Fallback: try to parse the raw response
      const rawText = JSON.stringify(result);
      const match = rawText.match(/\{[^]*\}/);
      if (match) {
        pipelineData = JSON.parse(match[0]);
      } else {
        throw new Error("Failed to parse AI response");
      }
    }

    // Assign order and IDs to stages
    const stages = pipelineData.stages.map((stage: any, index: number) => ({
      id: crypto.randomUUID(),
      name: stage.name || `Step ${index + 1}`,
      description: stage.description || '',
      status: stage.status || 'pending',
      order: index
    }));

    return {
      contactId,
      contactName: contact.name,
      projectName: pipelineData.projectName || 'Project',
      projectType: pipelineData.projectType || 'general',
      stages
    };
  } catch (error) {
    logger.error({ error, contactId, threadId }, "Failed to generate pipeline");
    throw error;
  }
}