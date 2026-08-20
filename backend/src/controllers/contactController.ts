import { Request, Response, NextFunction } from "express";
import { supabase } from "../utils/supabaseClient";
import { ApiError } from "../middleware/errorHandler";
import { contactSchema } from "../utils/validators";

export async function listContacts(req: Request, res: Response, next: NextFunction) {
  try {
    const { data, error } = await supabase
      .from("Contact")
      .select("*")
      .eq("userId", req.auth!.userId)
      .order("usageCount", { ascending: false });
    if (error) throw new ApiError(500, error.message);
    res.json(data ?? []);
  } catch (err) {
    next(err);
  }
}

export async function searchContacts(req: Request, res: Response, next: NextFunction) {
  try {
    const q = String(req.query.q ?? "");
    const { data, error } = await supabase
      .from("Contact")
      .select("*")
      .eq("userId", req.auth!.userId)
      .or(`name.ilike.%${q}%,email.ilike.%${q}%`)
      .order("usageCount", { ascending: false })
      .limit(10);
    if (error) throw new ApiError(500, error.message);
    res.json(data ?? []);
  } catch (err) {
    next(err);
  }
}

export async function createContact(req: Request, res: Response, next: NextFunction) {
  try {
    const input = contactSchema.parse(req.body);
    const { data, error } = await supabase
      .from("Contact")
      .insert({ ...input, userId: req.auth!.userId })
      .select()
      .single();
    if (error) {
      // Postgres 23505 = unique_violation — this contact (by email,
      // per the userId+email unique constraint) already exists for
      // this user. Any other DB error (missing table/column, RLS
      // denial, connection issue, etc.) was previously mislabeled as
      // 409 too, which made real failures look like "already exists"
      // and hid the actual cause.
      if (error.code === "23505") {
        throw new ApiError(409, "A contact with this email already exists");
      }
      throw new ApiError(500, error.message);
    }
    res.status(201).json(data);
  } catch (err) {
    next(err);
  }
}

export async function updateContact(req: Request, res: Response, next: NextFunction) {
  try {
    const { data, error } = await supabase
      .from("Contact")
      .update(req.body)
      .eq("id", req.params.id)
      .eq("userId", req.auth!.userId)
      .select()
      .single();
    if (error || !data) throw new ApiError(404, "Contact not found");
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function deleteContact(req: Request, res: Response, next: NextFunction) {
  try {
    const { error } = await supabase
      .from("Contact")
      .delete()
      .eq("id", req.params.id)
      .eq("userId", req.auth!.userId);
    if (error) throw new ApiError(500, error.message);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}