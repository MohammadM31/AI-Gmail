import { Request, Response, NextFunction } from "express";
import { supabase } from "../utils/supabaseClient";
import { ApiError } from "../middleware/errorHandler";
import { templateSchema } from "../utils/validators";

export async function listTemplates(req: Request, res: Response, next: NextFunction) {
  try {
    const { data, error } = await supabase
      .from("Template")
      .select("*")
      .or(`userId.eq.${req.auth!.userId},isPublic.eq.true`)
      .order("usageCount", { ascending: false });
    if (error) throw new ApiError(500, error.message);
    res.json(data ?? []);
  } catch (err) {
    next(err);
  }
}

export async function createTemplate(req: Request, res: Response, next: NextFunction) {
  try {
    const input = templateSchema.parse(req.body);
    const { data, error } = await supabase
      .from("Template")
      .insert({ ...input, userId: req.auth!.userId })
      .select()
      .single();
    if (error) throw new ApiError(500, error.message);
    res.status(201).json(data);
  } catch (err) {
    next(err);
  }
}

export async function updateTemplate(req: Request, res: Response, next: NextFunction) {
  try {
    const { data, error } = await supabase
      .from("Template")
      .update(req.body)
      .eq("id", req.params.id)
      .eq("userId", req.auth!.userId)
      .select()
      .single();
    if (error || !data) throw new ApiError(404, "Template not found");
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function deleteTemplate(req: Request, res: Response, next: NextFunction) {
  try {
    const { error } = await supabase
      .from("Template")
      .delete()
      .eq("id", req.params.id)
      .eq("userId", req.auth!.userId);
    if (error) throw new ApiError(500, error.message);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
