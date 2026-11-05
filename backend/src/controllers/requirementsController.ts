import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { supabase } from "../utils/supabaseClient";
import {
  analyzeThreadRequirements,
  createModificationProposal,
} from "../services/requirementsService";
import { ApiError } from "../middleware/errorHandler";
import { syncProjectDetails } from "../services/projectDetailSync";

const analyzeSchema = z.object({
  threadId: z.string().min(1),
  clientUserId: z.string().uuid(),
});

const projectSchema = z
  .object({
    clientUserId: z.string().uuid().optional(),
    contactId: z.string().uuid().optional(),
    name: z.string().min(1).max(200),
    description: z.string().max(5000).optional(),
    repositoryUrl: z.string().url().optional(),
    applicationUrl: z.string().url().optional(),
  })
  .refine((input) => Boolean(input.clientUserId || input.contactId), {
    message: "Choose a client",
  });

const projectUpdateSchema = z
  .object({
    name: z.string().min(1).max(200).optional(),
    description: z.string().max(5000).nullable().optional(),
    repositoryUrl: z.string().url().nullable().optional(),
    applicationUrl: z.string().url().nullable().optional(),
  })
  .refine((input) => Object.values(input).some((value) => value !== undefined), {
    message: "Nothing to update",
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
    const clientUserId = input.clientUserId ?? (await clientIdForContact(req.auth!.organizationId, input.contactId!));

    const { data: client, error: clientError } = await supabase
      .from("User")
      .select("id, role")
      .eq("id", clientUserId)
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
        clientUserId,
        name: input.name,
        description: input.description ?? null,
        repositoryUrl: input.repositoryUrl ?? null,
        applicationUrl: input.applicationUrl ?? null,
        status: "ACTIVE",
      })
      .select()
      .single();

    if (error) throw new ApiError(500, error.message);

    res.status(201).json(data);
  } catch (err) {
    next(err);
  }
}

export async function updateProject(req: Request, res: Response, next: NextFunction) {
  try {
    const input = projectUpdateSchema.parse(req.body);
    const { data, error } = await supabase
      .from("Project")
      .update(input)
      .eq("id", req.params.id)
      .eq("organizationId", req.auth!.organizationId)
      .select()
      .single();
    if (error || !data) throw new ApiError(404, "Project not found");
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function syncProjectsFromMail(req: Request, res: Response, next: NextFunction) {
  try {
    const updated = await syncProjectDetails(req.auth!.organizationId);
    res.json({ updated });
  } catch (err) {
    next(err);
  }
}

// One embedded-select query (no per-project queries): each Project row comes
// back with its client's name and the ids of its Requirement / Modification
// rows, and the counts are reduced in JS below. Relies on the foreign keys
// Project.clientUserId -> User.id, Requirement.projectId -> Project.id and
// Modification.projectId -> Project.id.
interface ProjectSummaryRow {
  client: { name: string | null } | { name: string | null }[] | null;
  requirements: { id: string }[] | null;
  modifications: { id: string; status: string }[] | null;
  [column: string]: unknown;
}

export async function listProjectsSummary(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { data, error } = await supabase
      .from("Project")
      .select(
        "*, client:User!clientUserId(name), requirements:Requirement(id), modifications:Modification(id, status)"
      )
      .eq("organizationId", req.auth!.organizationId)
      .eq("status", "ACTIVE")
      .order("createdAt", { ascending: false });

    if (error) throw new ApiError(500, error.message);

    const rows = (data ?? []) as ProjectSummaryRow[];

    const summaries = rows.map((row) => {
      const { client, requirements, modifications, ...project } = row;
      const clientRecord = Array.isArray(client) ? client[0] : client;

      return {
        ...project,
        clientName: clientRecord?.name ?? null,
        requirementCount: (requirements ?? []).length,
        pendingModificationCount: (modifications ?? []).filter(
          (modification) => modification.status === "PENDING_REVIEW"
        ).length,
      };
    });

    res.json(summaries);
  } catch (err) {
    next(err);
  }
}

async function clientIdForContact(organizationId: string, contactId: string): Promise<string> {
  const { data: contact, error } = await supabase
    .from("Contact")
    .select("id, name, email, userId")
    .eq("id", contactId)
    .maybeSingle();
  if (error || !contact?.email) throw new ApiError(404, "Client not found");

  const { data: owner } = await supabase
    .from("User")
    .select("organizationId")
    .eq("id", contact.userId)
    .maybeSingle();
  if (!owner || owner.organizationId !== organizationId) throw new ApiError(404, "Client not found");

  const email = String(contact.email).trim();
  const { data: existing } = await supabase
    .from("User")
    .select("id, role")
    .eq("organizationId", organizationId)
    .eq("email", email)
    .maybeSingle();
  if (existing?.role === "CLIENT") return existing.id;
  if (existing) throw new ApiError(400, "That address belongs to a staff account");

  const id = crypto.randomUUID();
  const { error: insertError } = await supabase.from("User").insert({
    id,
    email,
    name: contact.name || email,
    organizationId,
    role: "CLIENT",
  });
  if (insertError) throw new ApiError(500, insertError.message);
  return id;
}

export async function listClients(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { data, error } = await supabase
      .from("User")
      .select("id, name, email")
      .eq("organizationId", req.auth!.organizationId)
      .eq("role", "CLIENT")
      .order("name", { ascending: true });

    if (error) throw new ApiError(500, error.message);

    const { data: members, error: membersError } = await supabase
      .from("User")
      .select("id")
      .eq("organizationId", req.auth!.organizationId);
    if (membersError) throw new ApiError(500, membersError.message);

    const memberIds = (members ?? []).map((member) => member.id);
    const { data: contacts, error: contactsError } = memberIds.length
      ? await supabase.from("Contact").select("id, name, email").in("userId", memberIds)
      : { data: [], error: null };
    if (contactsError) throw new ApiError(500, contactsError.message);

    const seen = new Set((data ?? []).map((client) => client.email.trim().toLowerCase()));
    const fromContacts = [];
    for (const contact of contacts ?? []) {
      const email = String(contact.email ?? "").trim().toLowerCase();
      if (!email || seen.has(email)) continue;
      seen.add(email);
      fromContacts.push({ id: contact.id, name: contact.name, email: contact.email, kind: "contact" as const });
    }

    res.json([
      ...(data ?? []).map((client) => ({ ...client, kind: "user" as const })),
      ...fromContacts,
    ]);
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
