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
    if (error) throw new ApiError(409, error.message); // likely unique constraint
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
