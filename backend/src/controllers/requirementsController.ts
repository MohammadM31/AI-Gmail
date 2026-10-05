import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { supabase } from "../utils/supabaseClient";
import {
  analyzeThreadRequirements,
  createModificationProposal,
} from "../services/requirementsService";
import { ApiError } from "../middleware/errorHandler";

const analyzeSchema = z.object({
  threadId: z.string().min(1),
  clientUserId: z.string().uuid(),
});

const projectSchema = z.object({
  clientUserId: z.string().uuid(),
  name: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  repositoryUrl: z.string().url().optional(),
  applicationUrl: z.string().url().optional(),
});

const proposalSchema = z.object({
  requirementId: z.string().uuid(),
});

const reviewSchema = z.object({
  decision: z.enum([
    "ACCEPTED",
    "REJECTED",
    "CHANGES_REQUESTED",
  ]),
  comment: z.string().max(5000).optional(),
});

function isReviewer(role: string | undefined, staffRole: string | undefined) {
  return (
    role === "STAFF" &&
    (staffRole === "IT" ||
      staffRole === "ADMIN" ||
      staffRole === "SUPER_ADMIN")
  );
}

export async function listProjects(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { data, error } = await supabase
      .from("Project")
      .select("*")
      .eq("organizationId", req.auth!.organizationId)
      .order("createdAt", { ascending: false });

    if (error) throw new ApiError(500, error.message);

    res.json(data ?? []);
  } catch (err) {
    next(err);
  }
}

export async function createProject(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const input = projectSchema.parse(req.body);

    const { data: client, error: clientError } = await supabase
      .from("User")
      .select("id, role")
      .eq("id", input.clientUserId)
      .eq("organizationId", req.auth!.organizationId)
      .single();

    if (clientError || !client) {
      throw new ApiError(404, "Client not found");
    }

    if (client.role !== "CLIENT") {
      throw new ApiError(400, "Projects must belong to a client");
    }

    const { data, error } = await supabase
      .from("Project")
      .insert({
        organizationId: req.auth!.organizationId,
        clientUserId: input.clientUserId,
        name: input.name,
        description: input.description ?? null,
        repositoryUrl: input.repositoryUrl ?? null,
        applicationUrl: input.applicationUrl ?? null,
      })
      .select()
      .single();

    if (error) throw new ApiError(500, error.message);

    res.status(201).json(data);
  } catch (err) {
    next(err);
  }
}

export async function analyzeRequirements(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const input = analyzeSchema.parse(req.body);

    const result = await analyzeThreadRequirements(
      req.auth!.organizationId,
      input.threadId,
      input.clientUserId
    );

    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function listRequirements(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const query = supabase
      .from("Requirement")
      .select("*")
      .eq("organizationId", req.auth!.organizationId)
      .order("createdAt", { ascending: false });

    const { data, error } = await query;

    if (error) throw new ApiError(500, error.message);

    res.json(data ?? []);
  } catch (err) {
    next(err);
  }
}

export async function createProposal(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { requirementId } = proposalSchema.parse(req.body);

    const proposal = await createModificationProposal(
      req.auth!.organizationId,
      requirementId,
      req.auth!.userId
    );

    res.status(201).json(proposal);
  } catch (err) {
    next(err);
  }
}

export async function listModifications(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { data, error } = await supabase
      .from("Modification")
      .select("*")
      .eq("organizationId", req.auth!.organizationId)
      .order("createdAt", { ascending: false });

    if (error) throw new ApiError(500, error.message);

    res.json(data ?? []);
  } catch (err) {
    next(err);
  }
}

export async function reviewModification(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { modificationId } = req.params;
    const input = reviewSchema.parse(req.body);

    const { data: reviewer, error: reviewerError } = await supabase
      .from("User")
      .select("role, staffRole")
      .eq("id", req.auth!.userId)
      .single();

    if (reviewerError || !reviewer) {
      throw new ApiError(403, "Reviewer account not found");
    }

    if (!isReviewer(reviewer.role, reviewer.staffRole)) {
      throw new ApiError(
        403,
        "Only staff members can review modifications"
      );
    }

    const { data: modification, error: modificationError } =
      await supabase
        .from("Modification")
        .select("id")
        .eq("id", modificationId)
        .eq("organizationId", req.auth!.organizationId)
        .single();

    if (modificationError || !modification) {
      throw new ApiError(404, "Modification not found");
    }

    const { data, error } = await supabase
      .from("Modification")
      .update({
        status: input.decision,
        reviewedBy: req.auth!.userId,
        reviewComment: input.comment ?? null,
        reviewedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .eq("id", modificationId)
      .eq("organizationId", req.auth!.organizationId)
      .select()
      .single();

    if (error) throw new ApiError(500, error.message);

    res.json(data);
  } catch (err) {
    next(err);
  }
}
