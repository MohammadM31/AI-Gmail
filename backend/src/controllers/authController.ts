import { Request, Response, NextFunction } from "express";
import { supabase } from "../utils/supabaseClient";
import { ApiError } from "../middleware/errorHandler";
import { registerSchema, loginSchema } from "../utils/validators";
import { signAppToken } from "../utils/jwt";
import { generateInviteCode } from "../utils/inviteCode";

export async function register(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, password, name, organizationName, inviteCode } =
      registerSchema.parse(req.body);

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
    });
    if (authError || !authData.user) {
      throw new ApiError(400, authError?.message ?? "Sign up failed");
    }

    let organizationId: string;

    if (inviteCode) {
      // Join an existing organization.
      const { data: org, error: orgError } = await supabase
        .from("Organization")
        .select("id")
        .eq("inviteCode", inviteCode)
        .single();
      if (orgError || !org) {
        throw new ApiError(400, "Invalid invite code");
      }
      organizationId = org.id;
    } else {
      // Create a new organization with a fresh invite code.
      const { data: org, error: orgError } = await supabase
        .from("Organization")
        .insert({ name: organizationName, inviteCode: generateInviteCode() })
        .select()
        .single();
      if (orgError) throw new ApiError(500, orgError.message);
      organizationId = org.id;
    }

    const { error: userError } = await supabase.from("User").insert({
      id: authData.user.id,
      email,
      name,
      organizationId,
    });
    if (userError) throw new ApiError(500, userError.message);

    const token = signAppToken(authData.user.id, organizationId);

    res.status(201).json({
      user: { id: authData.user.id, email, name, organizationId },
      token,
    });
  } catch (err) {
    next(err);
  }
}

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, password } = loginSchema.parse(req.body);

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error || !data.session || !data.user) {
      throw new ApiError(401, "Invalid email or password");
    }

    const { data: userRow, error: userError } = await supabase
      .from("User")
      .select("*")
      .eq("id", data.user.id)
      .single();
    if (userError || !userRow) {
      throw new ApiError(404, "User profile not found for this account");
    }

    const token = signAppToken(userRow.id, userRow.organizationId);
    res.json({ user: userRow, token });
  } catch (err) {
    next(err);
  }
}

export async function logout(req: Request, res: Response, next: NextFunction) {
  try {
    await supabase.auth.signOut();
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function me(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.auth) throw new ApiError(401, "Not authenticated");
    const { data, error } = await supabase
      .from("User")
      .select("*")
      .eq("id", req.auth.userId)
      .single();
    if (error) throw new ApiError(404, "User not found");
    res.json(data);
  } catch (err) {
    next(err);
  }
}

// ---- Organization invite code ----
// Any member can view or rotate the shared invite code. There's no
// per-user role system yet (see README known gaps), so this is
// intentionally not restricted to an "admin" — add a role check here
// once User has a role column.

export async function getInviteCode(req: Request, res: Response, next: NextFunction) {
  try {
    const { data, error } = await supabase
      .from("Organization")
      .select("id, name, inviteCode")
      .eq("id", req.auth!.organizationId)
      .single();
    if (error || !data) throw new ApiError(404, "Organization not found");
    res.json({ organizationName: data.name, inviteCode: data.inviteCode });
  } catch (err) {
    next(err);
  }
}

export async function regenerateInviteCode(req: Request, res: Response, next: NextFunction) {
  try {
    const { data, error } = await supabase
      .from("Organization")
      .update({ inviteCode: generateInviteCode() })
      .eq("id", req.auth!.organizationId)
      .select("id, name, inviteCode")
      .single();
    if (error || !data) throw new ApiError(500, error?.message ?? "Failed to regenerate invite code");
    res.json({ organizationName: data.name, inviteCode: data.inviteCode });
  } catch (err) {
    next(err);
  }
}
