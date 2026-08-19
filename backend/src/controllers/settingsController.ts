import { Request, Response, NextFunction } from "express";
import { supabase } from "../utils/supabaseClient";
import { ApiError } from "../middleware/errorHandler";
import { settingsSchema } from "../utils/validators";

const DEFAULTS = {
  aiTone: "professional" as const,
  defaultChartType: "bar" as const,
  themePreference: "light" as const,
};

export async function getSettings(req: Request, res: Response, next: NextFunction) {
  try {
    const { data, error } = await supabase
      .from("UserSettings")
      .select("*")
      .eq("userId", req.auth!.userId)
      .maybeSingle();
    if (error) throw new ApiError(500, error.message);
    res.json(data ?? { userId: req.auth!.userId, ...DEFAULTS });
  } catch (err) {
    next(err);
  }
}

export async function updateSettings(req: Request, res: Response, next: NextFunction) {
  try {
    const input = settingsSchema.parse(req.body);
    const { data, error } = await supabase
      .from("UserSettings")
      .upsert({ userId: req.auth!.userId, ...input }, { onConflict: "userId" })
      .select()
      .single();
    if (error) throw new ApiError(500, error.message);
    res.json(data);
  } catch (err) {
    next(err);
  }
}
