import { supabase } from "../utils/supabaseClient";
import { ApiError } from "../middleware/errorHandler";

export interface TaskInput {
  title: string;
  projectId?: string;
  pipelineStageId?: string;
  emailId?: string;
}

async function assertProject(organizationId: string, projectId: string) {
  const { data, error } = await supabase
    .from("Project")
    .select("id")
    .eq("id", projectId)
    .eq("organizationId", organizationId)
    .maybeSingle();
  if (error) throw new ApiError(500, error.message);
  if (!data) throw new ApiError(400, "Project not found in this organization");
}

async function assertStage(organizationId: string, stageId: string) {
  const { data: people, error: peopleError } = await supabase
    .from("User")
    .select("id")
    .eq("organizationId", organizationId);
  if (peopleError) throw new ApiError(500, peopleError.message);
  const ids = (people ?? []).map((person) => person.id);
  if (ids.length === 0) throw new ApiError(400, "Pipeline stage not found in this organization");
  const { data, error } = await supabase.from("Pipeline").select("stages").in("userId", ids).limit(100);
  if (error) throw new ApiError(500, error.message);
  const found = (data ?? []).some(
    (pipeline) =>
      Array.isArray(pipeline.stages) &&
      pipeline.stages.some((stage: { id?: string }) => stage.id === stageId)
  );
  if (!found) throw new ApiError(400, "Pipeline stage not found in this organization");
}

export async function createTask(organizationId: string, userId: string, input: TaskInput) {
  if (!input.projectId && !input.pipelineStageId) {
    throw new ApiError(400, "Link the task to a project or a pipeline stage");
  }
  if (input.projectId) await assertProject(organizationId, input.projectId);
  if (input.pipelineStageId) await assertStage(organizationId, input.pipelineStageId);
  const { data, error } = await supabase
    .from("Task")
    .insert({
      organizationId,
      userId,
      title: input.title,
      projectId: input.projectId ?? null,
      pipelineStageId: input.pipelineStageId ?? null,
      emailId: input.emailId ?? null,
    })
    .select("*")
    .single();
  if (error) throw new ApiError(500, error.message);
  return data;
}

export async function listTasks(organizationId: string, projectId?: string, pipelineStageId?: string) {
  let query = supabase
    .from("Task")
    .select("*")
    .eq("organizationId", organizationId)
    .order("createdAt", { ascending: false });
  if (projectId) query = query.eq("projectId", projectId);
  if (pipelineStageId) query = query.eq("pipelineStageId", pipelineStageId);
  const { data, error } = await query;
  if (error) {
    if (/does not exist|schema cache|Could not find/i.test(error.message)) return [];
    throw new ApiError(500, error.message);
  }
  return data ?? [];
}
