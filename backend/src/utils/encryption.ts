// backend/src/utils/encryption.ts
import crypto from "crypto";
import { logger } from "./logger";

// AES-256-GCM at-rest encryption
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

// Key rotation support
interface EncryptionKey {
  id: string;
  key: Buffer;
  createdAt: Date;
  isActive: boolean;
}

// In production, store these in a secure key management service
// This is a simple in-memory store for demonstration
const keyStore = new Map<string, EncryptionKey>();

// Initialize encryption keys
export function initializeEncryptionKeys(): void {
  const masterKey = process.env.ENCRYPTION_KEY;
  if (!masterKey) {
    throw new Error("ENCRYPTION_KEY is not set (32-byte base64 string expected)");
  }
  
  // Parse the master key
  const keyBuffer = Buffer.from(masterKey, "base64");
  if (keyBuffer.length !== 32) {
    throw new Error("ENCRYPTION_KEY must decode to exactly 32 bytes");
  }
  
  // Store as the current key
  const keyId = "master";
  keyStore.set(keyId, {
    id: keyId,
    key: keyBuffer,
    createdAt: new Date(),
    isActive: true,
  });
  
  logger.info("Encryption keys initialized");
}

// Get the current active encryption key
function getCurrentKey(): EncryptionKey {
  for (const [, key] of keyStore) {
    if (key.isActive) {
      return key;
    }
  }
  throw new Error("No active encryption key found");
}

// Rotate encryption key (create new key without breaking existing encrypted data)
export function rotateEncryptionKey(newKeyBase64: string): void {
  const keyBuffer = Buffer.from(newKeyBase64, "base64");
  if (keyBuffer.length !== 32) {
    throw new Error("New key must decode to exactly 32 bytes");
  }
  
  // Deactivate all existing keys
  for (const [, key] of keyStore) {
    key.isActive = false;
  }
  
  // Add new key
  const keyId = `key_${Date.now()}`;
  keyStore.set(keyId, {
    id: keyId,
    key: keyBuffer,
    createdAt: new Date(),
    isActive: true,
  });
  
  logger.info({ keyId }, "Encryption key rotated");
}

// Encrypt with key ID for future decryption
export function encryptWithKeyId(plaintext: string): { encrypted: string; keyId: string } {
  const key = getCurrentKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key.key, iv);
  
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  
  const authTag = cipher.getAuthTag();
  
  // Pack: iv + authTag + ciphertext
  const payload = Buffer.concat([
    iv,
    authTag,
    encrypted,
  ]);
  
  return {
    encrypted: payload.toString("base64"),
    keyId: key.id,
  };
}

// Encrypt (standard - uses current key)
export function encrypt(plaintext: string): string {
  const result = encryptWithKeyId(plaintext);
  // Prefix with key ID for future decryption
  return `${result.keyId}:${result.encrypted}`;
}

// Decrypt with key ID support
export function decrypt(payload: string): string {
  // Check if payload has key ID prefix
  let keyId: string | undefined;
  let encryptedData: string;
  
  if (payload.includes(":")) {
    const parts = payload.split(":");
    keyId = parts[0];
    encryptedData = parts.slice(1).join(":");
  } else {
    // Legacy format (no key ID)
    keyId = "master";
    encryptedData = payload;
  }
  
  // Get the key
  const key = keyStore.get(keyId);
  if (!key) {
    // Try to fallback to current key
    const currentKey = getCurrentKey();
    logger.warn({ keyId, fallback: currentKey.id }, "Key not found, using fallback");
    return decryptWithKey(encryptedData, currentKey.key);
  }
  
  return decryptWithKey(encryptedData, key.key);
}

// Decrypt with a specific key
function decryptWithKey(payload: string, key: Buffer): string {
  const buf = Buffer.from(payload, "base64");
  const iv = buf.subarray(0, IV_LENGTH);
  const authTag = buf.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const encrypted = buf.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  
  try {
    return Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]).toString("utf8");
  } catch (error) {
    logger.error({ error }, "Decryption failed");
    throw new Error("Failed to decrypt data");
  }
}

// Re-encrypt data with new key (for key rotation)
export function reEncrypt(encryptedData: string): string {
  try {
    const decrypted = decrypt(encryptedData);
    return encrypt(decrypted);
  } catch (error) {
    logger.error({ error }, "Re-encryption failed");
    throw new Error("Failed to re-encrypt data");
  }
}

// Initialize keys on module load
initializeEncryptionKeys();