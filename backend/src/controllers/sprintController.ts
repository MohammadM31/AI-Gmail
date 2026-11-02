// backend/src/controllers/sprintController.ts
import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { supabase } from "../utils/supabaseClient";
import { ApiError } from "../middleware/errorHandler";
import {
  getOrCreateCurrentSprint,
  markSprintReady,
  closeSprint,
  Sprint,
} from "../services/sprintService";

const idSchema = z.object({ id: z.string().uuid() });

async function loadOwnedSprint(id: string, organizationId: string): Promise<Sprint> {
  const { data, error } = await supabase
    .from("Sprint")
    .select("*")
    .eq("id", id)
    .eq("organizationId", organizationId)
    .maybeSingle();

  if (error) throw new ApiError(500, error.message);
  if (!data) throw new ApiError(404, "Sprint not found");
  return data as Sprint;
}

async function countBySprint(
  table: "Requirement" | "Modification",
  sprintId: string,
  organizationId: string
) {
  const { count, error } = await supabase
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("organizationId", organizationId)
    .eq("sprintId", sprintId);

  if (error) throw new ApiError(500, error.message);
  return count ?? 0;
}

/** GET /api/sprints/current */
export async function getCurrentSprint(req: Request, res: Response, next: NextFunction) {
  try {
    const organizationId = req.auth!.organizationId;
    const sprint = await getOrCreateCurrentSprint(organizationId);

    const [requirementCount, modificationCount] = await Promise.all([
      countBySprint("Requirement", sprint.id, organizationId),
      countBySprint("Modification", sprint.id, organizationId),
    ]);

    res.json({ ...sprint, requirementCount, modificationCount });
  } catch (err) {
    next(err);
  }
}

/** GET /api/sprints?limit=26 */
export async function listSprints(req: Request, res: Response, next: NextFunction) {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 26, 1), 104);

    const { data, error } = await supabase
      .from("Sprint")
      .select("*")
      .eq("organizationId", req.auth!.organizationId)
      .order("weekStart", { ascending: false })
      .limit(limit);

    if (error) throw new ApiError(500, error.message);
    res.json(data ?? []);
  } catch (err) {
    next(err);
  }
}

/** GET /api/sprints/:id  -> sprint + its requirements and modifications */
export async function getSprint(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = idSchema.parse(req.params);
    const organizationId = req.auth!.organizationId;
    const sprint = await loadOwnedSprint(id, organizationId);

    const [reqs, mods] = await Promise.all([
      supabase
        .from("Requirement")
        .select("*")
        .eq("organizationId", organizationId)
        .eq("sprintId", id)
        .order("createdAt", { ascending: false }),
      supabase
        .from("Modification")
        .select("*")
        .eq("organizationId", organizationId)
        .eq("sprintId", id)
        .order("createdAt", { ascending: false }),
    ]);

    if (reqs.error) throw new ApiError(500, reqs.error.message);
    if (mods.error) throw new ApiError(500, mods.error.message);

    res.json({
      ...sprint,
      requirements: reqs.data ?? [],
      modifications: mods.data ?? [],
    });
  } catch (err) {
    next(err);
  }
}

/** POST /api/sprints/:id/ready */
export async function markReady(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = idSchema.parse(req.params);
    const organizationId = req.auth!.organizationId;
    const sprint = await loadOwnedSprint(id, organizationId);

    if (sprint.status === "CLOSED") {
      throw new ApiError(409, "Sprint is already closed");
    }

    await markSprintReady(id);
    res.json(await loadOwnedSprint(id, organizationId));
  } catch (err) {
    next(err);
  }
}

/** POST /api/sprints/:id/close */
export async function closeSprintHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = idSchema.parse(req.params);
    const organizationId = req.auth!.organizationId;
    const sprint = await loadOwnedSprint(id, organizationId);

    if (sprint.status === "CLOSED") {
      throw new ApiError(409, "Sprint is already closed");
    }

    await closeSprint(id);
    res.json(await loadOwnedSprint(id, organizationId));
  } catch (err) {
    next(err);
  }
}
