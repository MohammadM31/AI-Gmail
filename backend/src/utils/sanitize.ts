// backend/src/utils/sanitize.ts

export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** @deprecated Email bodies are stored raw. Escape at an HTML boundary with escapeHtml. */
export function sanitizeHtml(input: string): string {
  if (!input) return input;
  return escapeHtml(input);
}

export function sanitizeFilename(filename: string): string {
  if (!filename) return "file";
  
  return filename
    .replace(/\.\./g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(0, 255);
}

export const allowedMimeTypes = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/csv",
  "application/zip",
  "application/x-zip-compressed",
];

export function isValidFileType(mimeType: string): boolean {
  return allowedMimeTypes.includes(mimeType);
}

const MAX_FILE_SIZE = 10 * 1024 * 1024;

export function isValidFileSize(size: number): boolean {
  return size <= MAX_FILE_SIZE;
}