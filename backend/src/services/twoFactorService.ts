// backend/src/services/twoFactorService.ts
import { supabase } from "../utils/supabaseClient";
import { logger } from "../utils/logger";
import crypto from "crypto";
import speakeasy from "speakeasy";
import QRCode from "qrcode";

interface TwoFactorSetup {
  secret: string;
  qrCode: string;
  backupCodes: string[];
}

/**
 * Generate TOTP secret for 2FA setup
 */
export async function setupTwoFactor(userId: string): Promise<TwoFactorSetup> {
  try {
    // Generate secret
    const secret = speakeasy.generateSecret({
      name: `AI Gmail (${userId})`,
      length: 20,
    });

    // Generate backup codes (10 codes)
    const backupCodes = Array.from({ length: 10 }, () => {
      return crypto.randomBytes(4).toString("hex").toUpperCase();
    });

    // Store the secret in the database
    const { error } = await supabase
      .from("User")
      .update({
        twoFactorSecret: secret.base32,
        twoFactorEnabled: false,
        twoFactorBackupCodes: backupCodes.map(code => ({
          code,
          used: false,
        })),
      })
      .eq("id", userId);

    if (error) throw error;

    // Generate QR code
    const qrCode = await QRCode.toDataURL(secret.otpauth_url || "");

    logger.info({ userId }, "Two-factor authentication setup initiated");

    return {
      secret: secret.base32,
      qrCode,
      backupCodes,
    };
  } catch (error) {
    logger.error({ error, userId }, "Failed to set up 2FA");
    throw new Error("Failed to set up two-factor authentication");
  }
}

/**
 * Verify TOTP code
 */
export function verifyTotp(secret: string, token: string): boolean {
  try {
    return speakeasy.totp.verify({
      secret,
      encoding: "base32",
      token,
      window: 1, // Allow 1 step before/after (30 seconds each)
    });
  } catch (error) {
    return false;
  }
}

/**
 * Enable 2FA for a user
 */
export async function enableTwoFactor(userId: string, token: string): Promise<boolean> {
  try {
    // Get user's 2FA secret
    const { data: user, error } = await supabase
      .from("User")
      .select("twoFactorSecret")
      .eq("id", userId)
      .single();

    if (error || !user?.twoFactorSecret) {
      throw new Error("2FA not set up for this user");
    }

    // Verify the token
    const isValid = verifyTotp(user.twoFactorSecret, token);
    if (!isValid) {
      return false;
    }

    // Enable 2FA
    await supabase
      .from("User")
      .update({
        twoFactorEnabled: true,
      })
      .eq("id", userId);

    logger.info({ userId }, "Two-factor authentication enabled");
    return true;
  } catch (error) {
    logger.error({ error, userId }, "Failed to enable 2FA");
    return false;
  }
}

/**
 * Disable 2FA for a user
 */
export async function disableTwoFactor(userId: string, token: string): Promise<boolean> {
  try {
    // Get user's 2FA secret
    const { data: user, error } = await supabase
      .from("User")
      .select("twoFactorSecret, twoFactorEnabled")
      .eq("id", userId)
      .single();

    if (error || !user?.twoFactorSecret || !user.twoFactorEnabled) {
      throw new Error("2FA is not enabled for this user");
    }

    // Verify the token
    const isValid = verifyTotp(user.twoFactorSecret, token);
    if (!isValid) {
      return false;
    }

    // Disable 2FA
    await supabase
      .from("User")
      .update({
        twoFactorEnabled: false,
        twoFactorSecret: null,
        twoFactorBackupCodes: null,
      })
      .eq("id", userId);

    logger.info({ userId }, "Two-factor authentication disabled");
    return true;
  } catch (error) {
    logger.error({ error, userId }, "Failed to disable 2FA");
    return false;
  }
}

/**
 * Verify 2FA during login
 */
export async function verifyTwoFactorLogin(userId: string, token: string): Promise<boolean> {
  try {
    // Get user's 2FA secret
    const { data: user, error } = await supabase
      .from("User")
      .select("twoFactorSecret, twoFactorEnabled, twoFactorBackupCodes")
      .eq("id", userId)
      .single();

    if (error || !user?.twoFactorSecret || !user.twoFactorEnabled) {
      throw new Error("2FA is not enabled for this user");
    }

    // Check if it's a backup code
    const backupCodes = user.twoFactorBackupCodes || [];
    const isBackupCode = backupCodes.some(
      (bc: any) => bc.code === token && !bc.used
    );

    if (isBackupCode) {
      // Mark backup code as used
      const updatedCodes = backupCodes.map((bc: any) => {
        if (bc.code === token) {
          return { ...bc, used: true };
        }
        return bc;
      });

      await supabase
        .from("User")
        .update({
          twoFactorBackupCodes: updatedCodes,
        })
        .eq("id", userId);

      return true;
    }

    // Verify TOTP
    return verifyTotp(user.twoFactorSecret, token);
  } catch (error) {
    logger.error({ error, userId }, "Failed to verify 2FA login");
    return false;
  }
}

/**
 * Generate new backup codes
 */
export async function regenerateBackupCodes(userId: string, token: string): Promise<string[] | null> {
  try {
    // Get user's 2FA secret
    const { data: user, error } = await supabase
      .from("User")
      .select("twoFactorSecret, twoFactorEnabled")
      .eq("id", userId)
      .single();

    if (error || !user?.twoFactorSecret || !user.twoFactorEnabled) {
      throw new Error("2FA is not enabled for this user");
    }

    // Verify the token
    const isValid = verifyTotp(user.twoFactorSecret, token);
    if (!isValid) {
      return null;
    }

    // Generate new backup codes
    const backupCodes = Array.from({ length: 10 }, () => {
      return crypto.randomBytes(4).toString("hex").toUpperCase();
    });

    // Store new backup codes
    await supabase
      .from("User")
      .update({
        twoFactorBackupCodes: backupCodes.map(code => ({
          code,
          used: false,
        })),
      })
      .eq("id", userId);

    logger.info({ userId }, "Backup codes regenerated");
    return backupCodes;
  } catch (error) {
    logger.error({ error, userId }, "Failed to regenerate backup codes");
    return null;
  }
}