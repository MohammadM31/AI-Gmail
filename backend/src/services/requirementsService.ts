import { supabase } from "../utils/supabaseClient";
import { processMessageWithAI } from "./geminiService";

export interface RequirementAnalysis {
  projectName: string | null;
  projectConfidence: number;
  category: string;
  request: string;
  details: string[];
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  confidence: number;
  readyForModification: boolean;
  clarificationNeeded: boolean;
  clarificationQuestion: string | null;
}

interface Project {
  id: string;
  name: string;
  description: string | null;
}

function extractJson(text: string): string {
  return text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

async function analyzeConversation(
  conversation: string,
  projects: Project[]
): Promise<RequirementAnalysis> {
  const projectContext =
    projects.length > 0
      ? projects
          .map(
            (project) =>
              `ID: ${project.id}\nName: ${project.name}\nDescription: ${
                project.description || "No description"
              }`
          )
          .join("\n\n")
      : "No projects are currently registered.";

  const prompt = `
You are the requirements analyst for an application development company.

Your job is to analyze a conversation between staff and a client.

Determine:

1. What the client wants changed or improved.
2. Which project the request belongs to.
3. The category of the request.
4. Important details.
5. Priority.
6. Your confidence.
7. Whether enough information exists to create a modification proposal.

AVAILABLE PROJECTS:

${projectContext}

CONVERSATION:

${conversation}

IMPORTANT RULES:

- Do NOT invent a project.
- If the project cannot be identified confidently, return clarificationNeeded=true.
- If multiple projects could match, return clarificationNeeded=true.
- Do not assume missing requirements.
- Extract actual client requests only.
- readyForModification should only be true when the requested change is sufficiently clear.
- confidence must be between 0 and 1.

Return ONLY JSON:

{
  "projectName": string | null,
  "projectConfidence": number,
  "category": string,
  "request": string,
  "details": string[],
  "priority": "LOW" | "MEDIUM" | "HIGH" | "URGENT",
  "confidence": number,
  "readyForModification": boolean,
  "clarificationNeeded": boolean,
  "clarificationQuestion": string | null
}
`;

  const result = await processMessageWithAI(prompt, []);

  const raw = result.bulletPoints.join("\n");

  try {
    return JSON.parse(extractJson(raw));
  } catch {
    throw new Error("AI requirements analysis returned invalid JSON");
  }
}

export async function analyzeThreadRequirements(
  organizationId: string,
  threadId: string,
  clientUserId: string
) {
  const { data: emails, error: emailError } = await supabase
    .from("Email")
    .select("id, senderId, subject, content, createdAt")
    .eq("threadId", threadId)
    .order("createdAt", { ascending: true });

  if (emailError) {
    throw new Error(emailError.message);
  }

  if (!emails || emails.length === 0) {
    throw new Error("No emails found for this conversation");
  }

  const { data: projects, error: projectError } = await supabase
    .from("Project")
    .select("id, name, description")
    .eq("organizationId", organizationId)
    .eq("clientUserId", clientUserId)
    .eq("status", "ACTIVE");

  if (projectError) {
    throw new Error(projectError.message);
  }

  const conversation = emails
    .map(
      (email) =>
        `[${email.createdAt}] Subject: ${email.subject}\n${email.content}`
    )
    .join("\n\n");

  const analysis = await analyzeConversation(
    conversation,
    (projects || []) as Project[]
  );

  let projectId: string | null = null;

  if (analysis.projectName && projects) {
    const matched = projects.find(
      (project) =>
        project.name.toLowerCase() === analysis.projectName!.toLowerCase()
    );

    if (matched && analysis.projectConfidence >= 0.8) {
      projectId = matched.id;
    }
  }

  const status = analysis.clarificationNeeded
    ? "CLARIFICATION_NEEDED"
    : analysis.readyForModification
      ? "READY_FOR_PROPOSAL"
      : "OPEN";

  const { data: requirement, error } = await supabase
    .from("Requirement")
    .insert({
      organizationId,
      clientUserId,
      projectId,
      threadId,
      category: analysis.category,
      request: analysis.request,
      details: analysis.details,
      priority: analysis.priority,
      confidence: analysis.confidence,
      status,
      clarificationNeeded: analysis.clarificationNeeded,
      clarificationQuestion: analysis.clarificationQuestion,
      aiAnalysis: analysis,
    })
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return {
    requirement,
    analysis,
    projectId,
  };
}

export async function createModificationProposal(
  organizationId: string,
  requirementId: string,
  createdBy: string
) {
  const { data: requirement, error } = await supabase
    .from("Requirement")
    .select("*")
    .eq("id", requirementId)
    .eq("organizationId", organizationId)
    .single();

  if (error || !requirement) {
    throw new Error("Requirement not found");
  }

  if (!requirement.projectId) {
    throw new Error("A project must be identified before creating a proposal");
  }

  if (requirement.clarificationNeeded) {
    throw new Error(
      "Clarification is required before creating a modification proposal"
    );
  }

  const details = Array.isArray(requirement.details)
    ? requirement.details
    : [];

  const implementationPlan = [
    `Review the existing implementation related to: ${requirement.request}`,
    ...details.map((detail: string) => `Address requirement: ${detail}`),
    "Run tests for affected functionality",
    "Prepare the changes for human review",
  ];

  const { data: modification, error: modificationError } = await supabase
    .from("Modification")
    .insert({
      organizationId,
      projectId: requirement.projectId,
      requirementId,
      createdBy,
      summary: requirement.request,
      implementationPlan,
      affectedFiles: [],
      status: "PENDING_REVIEW",
    })
    .select()
    .single();

  if (modificationError) {
    throw new Error(modificationError.message);
  }

  await supabase
    .from("Requirement")
    .update({
      status: "IN_PROGRESS",
      updatedAt: new Date().toISOString(),
    })
    .eq("id", requirementId);

  return modification;
}
