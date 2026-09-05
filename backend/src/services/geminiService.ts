// backend/src/services/pipelineService.ts
import crypto from "crypto";
import { supabase } from "../utils/supabaseClient";
import { processMessageWithAI } from "./geminiService";
import { logger } from "../utils/logger";

export interface PipelineStage {
  id: string;
  name: string;
  description: string;
  status: 'pending' | 'in-progress' | 'complete';
  order: number;
  startedAt?: string | null;
  completedAt?: string | null;
  dueDate?: string | null;
  duration?: number;
  emailIds?: string[];
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
    const { data: emails, error } = await supabase
      .from("Email")
      .select("content, subject, recipients, createdAt, senderId, id")
      .eq("threadId", threadId)
      .order("createdAt", { ascending: true });

    if (error) throw new Error(`Failed to fetch emails: ${error.message}`);
    if (!emails || emails.length === 0) {
      throw new Error("No emails found in this thread");
    }

    const { data: contact, error: contactError } = await supabase
      .from("Contact")
      .select("name")
      .eq("id", contactId)
      .eq("userId", userId)
      .single();

    if (contactError || !contact) {
      throw new Error("Contact not found");
    }

    const conversation = emails
      .map((e) => `From: ${e.senderId === userId ? 'You' : contact.name}\nSubject: ${e.subject}\nContent: ${e.content}`)
      .join("\n---\n");

    // ✅ Enhanced prompt for better stage extraction with dates
    const result = await processMessageWithAI(
      `You are an AI that analyzes email conversations and extracts the workflow or process being discussed.

      Analyze this email conversation between the user and ${contact.name}:

      ${conversation}

      Based on the conversation, identify:
      1. What is the main topic, project, or goal being discussed? 
      2. What are the actual steps or milestones in this process?
      3. What is the current status of each step?
      4. Estimate reasonable durations for each stage in days.

      Return a JSON object with:
      {
        "projectName": "string",
        "projectType": "sales | development | event | job | general",
        "stages": [
          {
            "name": "string",
            "description": "string",
            "status": "pending | in-progress | complete",
            "estimatedDuration": number (in days)
          }
        ]
      }

      Only return valid JSON, no other text.`,
      []
    );

    let pipelineData;
    try {
      const cleanedText = result.bulletPoints.join(' ').replace(/```json/g, '').replace(/```/g, '').trim();
      pipelineData = JSON.parse(cleanedText);
    } catch (parseError) {
      const rawText = JSON.stringify(result);
      const match = rawText.match(/\{[^]*\}/);
      if (match) {
        pipelineData = JSON.parse(match[0]);
      } else {
        throw new Error("Failed to parse AI response");
      }
    }

    // ✅ Enhanced stages with dates and email tracking
    const stages = pipelineData.stages.map((stage: any, index: number) => {
      const now = new Date().toISOString();
      return {
        id: crypto.randomUUID(),
        name: stage.name || `Step ${index + 1}`,
        description: stage.description || '',
        status: stage.status || 'pending',
        order: index,
        startedAt: index === 0 ? now : null,
        completedAt: stage.status === 'complete' ? now : null,
        dueDate: stage.estimatedDuration ? 
          new Date(Date.now() + (stage.estimatedDuration || 7) * 24 * 60 * 60 * 1000).toISOString() : 
          null,
        duration: stage.estimatedDuration || 0,
        emailIds: emails.map((e: any) => e.id),
      };
    });

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