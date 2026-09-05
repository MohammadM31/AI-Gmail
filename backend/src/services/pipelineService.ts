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
  timeSpent?: number;
  timeEntries?: {
    start: string;
    end?: string;
    note?: string;
  }[];
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
        timeSpent: 0,
        timeEntries: [],
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

export async function updateStageTime(
  pipelineId: string,
  stageId: string,
  action: 'start' | 'stop' | 'add',
  note?: string
) {
  const { data: pipeline, error } = await supabase
    .from("Pipeline")
    .select("stages")
    .eq("id", pipelineId)
    .single();

  if (error || !pipeline) throw new Error("Pipeline not found");

  const stages = pipeline.stages.map((stage: any) => {
    if (stage.id === stageId) {
      const now = new Date().toISOString();
      
      if (action === 'start') {
        return {
          ...stage,
          timeEntries: [...(stage.timeEntries || []), { start: now, note }],
        };
      }
      
      if (action === 'stop') {
        const entries = stage.timeEntries || [];
        const lastEntry = entries[entries.length - 1];
        if (lastEntry && !lastEntry.end) {
          lastEntry.end = now;
          const start = new Date(lastEntry.start);
          const end = new Date(now);
          const timeSpent = Math.round((end.getTime() - start.getTime()) / (1000 * 60));
          return {
            ...stage,
            timeEntries: entries,
            timeSpent: (stage.timeSpent || 0) + timeSpent,
          };
        }
      }
      
      if (action === 'add') {
        return {
          ...stage,
          timeEntries: [...(stage.timeEntries || []), { start: now, end: now, note }],
        };
      }
    }
    return stage;
  });

  await supabase
    .from("Pipeline")
    .update({ stages })
    .eq("id", pipelineId);

  return stages;
}

export async function suggestPipelineTemplate(conversation: string) {
  const result = await processMessageWithAI(
    `Based on this conversation, suggest a pipeline template:
    ${conversation}
    Return template name, stages, and estimated durations in days.
    Format as JSON with: { "name": string, "stages": [{ "name": string, "description": string, "estimatedDuration": number }] }`,
    []
  );
  return result;
}