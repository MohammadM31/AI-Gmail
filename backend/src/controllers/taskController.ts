import { NextFunction, Request, Response } from "express";
import { z } from "zod";
import { createTask, listTasks } from "../services/taskService";

const createSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    projectId: z.string().uuid().optional(),
    pipelineStageId: z.string().trim().min(1).max(100).optional(),
    emailId: z.string().uuid().optional(),
  })
  .refine((value) => Boolean(value.projectId || value.pipelineStageId), {
    message: "Link the task to a project or a pipeline stage",
  });

const listSchema = z.object({
  projectId: z.string().uuid().optional(),
  pipelineStageId: z.string().trim().min(1).max(100).optional(),
});

export async function postTask(req: Request, res: Response, next: NextFunction) {
  try {
    const input = createSchema.parse(req.body);
    const task = await createTask(req.auth!.organizationId, req.auth!.userId, input);
    res.status(201).json(task);
  } catch (err) {
    next(err);
  }
}

export async function getTasks(req: Request, res: Response, next: NextFunction) {
  try {
    const query = listSchema.parse(req.query);
    const tasks = await listTasks(req.auth!.organizationId, query.projectId, query.pipelineStageId);
    res.json(tasks);
  } catch (err) {
    next(err);
  }
}
