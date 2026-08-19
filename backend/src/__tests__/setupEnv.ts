import crypto from "crypto";

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret-not-for-prod";
process.env.ENCRYPTION_KEY =
  process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString("base64");
process.env.FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";
process.env.SUPABASE_URL = process.env.SUPABASE_URL || "https://test.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "test-key";
