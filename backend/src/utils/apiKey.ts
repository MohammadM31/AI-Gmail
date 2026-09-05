// backend/src/utils/apiKey.ts
import crypto from "crypto";
import { supabase } from "./supabaseClient";
import { logger } from "./logger";
import { Request, Response, NextFunction } from "express"; // ✅ ADDED

interface ApiKeyData {
  id: string;
  userId: string;
  key: string;
  name: string;
  lastUsed?: Date;
  expiresAt?: Date;
  createdAt: Date;
  isActive: boolean;
}

export function generateApiKey(): string {
  return `ak_${crypto.randomBytes(32).toString("hex")}`;
}

export function hashApiKey(key: string): string {
  return crypto.createHash("sha256").update(key).digest("hex");
}

export async function createApiKey(
  userId: string,
  name: string,
  expiresInDays: number = 30
): Promise<{ plainKey: string; keyId: string }> {
  const plainKey = generateApiKey();
  const hashedKey = hashApiKey(plainKey);
  const keyId = crypto.randomUUID();
  
  const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);
  
  const { data, error } = await supabase
    .from("ApiKeys")
    .insert({
      id: keyId,
      userId,
      keyHash: hashedKey,
      name,
      expiresAt: expiresAt.toISOString(),
      createdAt: new Date().toISOString(),
      isActive: true,
    })
    .select()
    .single();
  
  if (error) {
    logger.error({ error, userId }, "Failed to create API key");
    throw new Error("Failed to create API key");
  }
  
  logger.info({ userId, keyId, name }, "API key created");
  
  return { plainKey, keyId };
}

export async function validateApiKey(key: string): Promise<{ userId: string } | null> {
  const hashedKey = hashApiKey(key);
  
  const { data, error } = await supabase
    .from("ApiKeys")
    .select("*")
    .eq("keyHash", hashedKey)
    .eq("isActive", true)
    .single();
  
  if (error || !data) {
    return null;
  }
  
  if (data.expiresAt && new Date(data.expiresAt) < new Date()) {
    return null;
  }
  
  await supabase
    .from("ApiKeys")
    .update({ lastUsed: new Date().toISOString() })
    .eq("id", data.id);
  
  return { userId: data.userId };
}

export async function revokeApiKey(keyId: string, userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("ApiKeys")
    .update({ isActive: false })
    .eq("id", keyId)
    .eq("userId", userId)
    .select()
    .single();
  
  if (error || !data) {
    return false;
  }
  
  logger.info({ keyId, userId }, "API key revoked");
  return true;
}

export async function listApiKeys(userId: string): Promise<ApiKeyData[]> {
  const { data, error } = await supabase
    .from("ApiKeys")
    .select("*")
    .eq("userId", userId)
    .order("createdAt", { ascending: false });
  
  if (error) {
    logger.error({ error, userId }, "Failed to list API keys");
    return [];
  }
  
  return data.map((item: any) => ({
    id: item.id,
    userId: item.userId,
    key: "hidden",
    name: item.name,
    lastUsed: item.lastUsed ? new Date(item.lastUsed) : undefined,
    expiresAt: item.expiresAt ? new Date(item.expiresAt) : undefined,
    createdAt: new Date(item.createdAt),
    isActive: item.isActive,
  }));
}

export async function rotateApiKey(
  oldKeyId: string,
  userId: string,
  name?: string
): Promise<{ plainKey: string; keyId: string } | null> {
  const revoked = await revokeApiKey(oldKeyId, userId);
  if (!revoked) {
    return null;
  }
  
  const newKey = await createApiKey(
    userId,
    name || `Rotated from ${oldKeyId}`,
    30
  );
  
  logger.info({ oldKeyId, newKeyId: newKey.keyId, userId }, "API key rotated");
  return newKey;
}

// ✅ FIXED: Proper middleware with correct types
export async function apiKeyAuth(req: Request, res: Response, next: NextFunction) {
  const apiKey = req.headers["x-api-key"] as string;
  
  if (!apiKey) {
    const queryKey = req.query.api_key as string;
    if (!queryKey) {
      return next();
    }
    const result = await validateApiKey(queryKey);
    if (result) {
      (req as any).auth = { userId: result.userId, organizationId: "api-user" };
      return next();
    }
    return next(new Error("Invalid API key"));
  }
  
  const result = await validateApiKey(apiKey);
  if (!result) {
    return next(new Error("Invalid or expired API key"));
  }
  
  (req as any).auth = { userId: result.userId, organizationId: "api-user" };
  next();
}