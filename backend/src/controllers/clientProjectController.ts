import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import {
  listClientProjectBoards,
  updateClientProjectBoard,
} from "../services/clientProjectService";

const phaseSchema = z.object({
  id: z.string().min(1).max(80),
  name: z.string().min(1).max(120),
  detail: z.string().max(1000),
  date: z.string().max(40).nullable(),
  edited: z.boolean().optional(),
});

const factSchema = z.object({
  id: z.string().min(1).max(80),
  label: z.string().min(1).max(80),
  value: z.string().max(500),
  edited: z.boolean().optional(),
});

const updateSchema = z.object({
  name: z.string().min(1).max(200),
  summary: z.string().max(2000),
  phases: z.array(phaseSchema).max(12),
  facts: z.array(factSchema).max(30),
});

export async function listClientProjects(req: Request, res: Response, next: NextFunction) {
  try {
    const boards = await listClientProjectBoards(req.auth!.userId, req.auth!.organizationId);
    res.json({ boards });
  } catch (err) {
    next(err);
  }
}

export async function updateClientProject(req: Request, res: Response, next: NextFunction) {
  try {
    const input = updateSchema.parse(req.body);
    const board = await updateClientProjectBoard(
      req.auth!.userId,
      req.auth!.organizationId,
      req.params.personId,
      {
        name: input.name,
        summary: input.summary,
        phases: input.phases.map((phase) => ({ ...phase, edited: phase.edited ?? false })),
        facts: input.facts.map((fact) => ({ ...fact, edited: fact.edited ?? false })),
      }
    );
    res.json(board);
  } catch (err) {
    next(err);
  }
}
