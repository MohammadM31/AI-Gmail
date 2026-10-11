// backend/src/controllers/requirementsSweeperController.ts
import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { supabase } from "../utils/supabaseClient";
import { ApiError } from "../middleware/errorHandler";
import { forceSweepForSprint } from "../services/requirementsSweeper";

const bodySchema = z.object({
  sprintId: z.string().uuid().optional(),
});

/**
 * POST /api/requirements/run-sweeper
 *
 * Staff-only. If `sprintId` is provided, force-sweeps that specific
 * sprint. Otherwise, finds the most recent OPEN sprint for the caller's
 * organization and force-sweeps it.
 */
export async function runSweeper(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    // Only staff can trigger
    const { data: user, error: uErr } = await supabase
      .from("User")
      .select("role, staffRole")
      .eq("id", req.auth!.userId)
      .single();

    if (uErr || !user) {
      throw new ApiError(403, "User not found");
    }

    if (user.role !== "STAFF") {
      throw new ApiError(403, "Only staff can trigger the sweeper");
    }

    const { sprintId } = bodySchema.parse(req.body ?? {});

    // Explicit string type — both branches below assign before use,
    // so TypeScript narrows correctly at the call site.
    let targetSprintId: string;

    if (sprintId) {
      // Verify the provided sprint belongs to the caller's org
      const { data: sprint, error: sErr } = await supabase
        .from("Sprint")
        .select("id")
        .eq("id", sprintId)
        .eq("organizationId", req.auth!.organizationId)
        .single();

      if (sErr || !sprint) {
        throw new ApiError(404, "Sprint not found in this organization");
      }

      targetSprintId = sprint.id;
    } else {
      // Find the most recent OPEN sprint for this org
      const { data: sprints, error: sErr } = await supabase
        .from("Sprint")
        .select("id")
        .eq("organizationId", req.auth!.organizationId)
        .in("status", ["OPEN"])
        .order("weekStart", { ascending: false })
        .limit(1);

      if (sErr) {
        throw new ApiError(500, sErr.message);
      }

      const sprint = (sprints ?? [])[0];
      if (!sprint) {
        throw new ApiError(404, "No open sprint for this organization");
      }

      targetSprintId = sprint.id;
    }

    const result = await forceSweepForSprint(targetSprintId);

    res.json({
      success: true,
      sprintId: targetSprintId,
      requirementsCreated: result.requirementsCreated,
      proposalsCreated: result.proposalsCreated,
    });
  } catch (err) {
    next(err);
  }
}