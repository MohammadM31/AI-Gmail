// backend/src/controllers/pipelineController.ts
import { Request, Response, NextFunction } from "express";
import { supabase } from "../utils/supabaseClient";
import { ApiError } from "../middleware/errorHandler";
import { generatePipelineFromThread } from "../services/pipelineService";

export async function getPipeline(req: Request, res: Response, next: NextFunction) {
  try {
    const { contactId } = req.params;
    const userId = req.auth!.userId;

    const { data, error } = await supabase
      .from("Pipeline")
      .select("*")
      .eq("contactId", contactId)
      .eq("userId", userId)
      .single();

    if (error) {
      // No pipeline found - return exists: false
      return res.json({ exists: false, pipeline: null });
    }

    res.json({ exists: true, pipeline: data });
  } catch (err) {
    next(err);
  }
}

export async function generatePipeline(req: Request, res: Response, next: NextFunction) {
  try {
    const { contactId } = req.params;
    const { threadId } = req.body;
    const userId = req.auth!.userId;

    if (!threadId) {
      throw new ApiError(400, "threadId is required");
    }

    const pipeline = await generatePipelineFromThread(userId, contactId, threadId);

    const { data, error } = await supabase
      .from("Pipeline")
      .upsert({
        userId,
        contactId,
        contactName: pipeline.contactName,
        projectName: pipeline.projectName,
        projectType: pipeline.projectType,
        stages: pipeline.stages,
        updatedAt: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      throw new ApiError(500, error.message);
    }

    res.json({ pipeline: data });
  } catch (err) {
    next(err);
  }
}

export async function updatePipeline(req: Request, res: Response, next: NextFunction) {
  try {
    const { contactId } = req.params;
    const { threadId } = req.body;
    const userId = req.auth!.userId;

    if (!threadId) {
      throw new ApiError(400, "threadId is required");
    }

    const pipeline = await generatePipelineFromThread(userId, contactId, threadId);

    const { data, error } = await supabase
      .from("Pipeline")
      .update({
        projectName: pipeline.projectName,
        projectType: pipeline.projectType,
        stages: pipeline.stages,
        updatedAt: new Date().toISOString(),
      })
      .eq("contactId", contactId)
      .eq("userId", userId)
      .select()
      .single();

    if (error) {
      throw new ApiError(500, error.message);
    }

    res.json({ pipeline: data });
  } catch (err) {
    next(err);
  }
}