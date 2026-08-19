import { Request, Response, NextFunction } from "express";
import { supabase } from "../utils/supabaseClient";
import { ApiError } from "../middleware/errorHandler";

// The client never proxies file bytes through this server — it asks
// for a signed URL, then PUTs the file straight to Supabase Storage.
// Keeps large uploads off the Express process entirely.
const BUCKET = process.env.SUPABASE_ATTACHMENTS_BUCKET ?? "attachments";

export async function createUploadUrl(req: Request, res: Response, next: NextFunction) {
  try {
    const { fileName } = req.body as { fileName?: string };
    if (!fileName || !fileName.trim()) {
      throw new ApiError(400, "fileName is required");
    }

    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    // Namespaced by org then user so a signed download URL request can
    // be verified against the caller's own organization before issuing.
    const path = `${req.auth!.organizationId}/${req.auth!.userId}/${Date.now()}-${safeName}`;

    const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(path);
    if (error || !data) {
      throw new ApiError(500, error?.message ?? "Could not create upload URL");
    }

    res.json({ path, token: data.token, signedUrl: data.signedUrl, bucket: BUCKET });
  } catch (err) {
    next(err);
  }
}

export async function getSignedDownloadUrl(req: Request, res: Response, next: NextFunction) {
  try {
    const path = String(req.query.path ?? "");
    if (!path) throw new ApiError(400, "path is required");
    if (!path.startsWith(`${req.auth!.organizationId}/`)) {
      // Prevents one tenant from requesting a download URL for a file
      // path belonging to a different organization, even if guessed.
      throw new ApiError(403, "Not allowed to access this file");
    }

    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 10);
    if (error || !data) throw new ApiError(404, "File not found");

    res.json({ url: data.signedUrl });
  } catch (err) {
    next(err);
  }
}
